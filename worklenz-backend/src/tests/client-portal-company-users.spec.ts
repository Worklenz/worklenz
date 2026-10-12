const mockTxQuery = jest.fn();
const mockRelease = jest.fn();

jest.mock("../config/db", () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
    pool: { connect: jest.fn() },
  },
}));

jest.mock("../shared/email", () => ({
  __esModule: true,
  sendEmail: jest.fn(),
  sendEmailEnhanced: jest.fn(),
  EmailRequest: jest.fn(),
}));

jest.mock("../shared/file-constants", () => ({
  __esModule: true,
  default: { getEmailTemplate: jest.fn(() => "Hi [VAR_CLIENT_NAME], join: [VAR_PORTAL_LINK]") },
}));

jest.mock("../cron_jobs/helpers", () => ({
  __esModule: true,
  getClientPortalBaseUrl: () => "https://portal.test",
}));

import db from "../config/db";
import { sendEmail } from "../shared/email";
import ClientPortalCompanyUsersController from "../controllers/client-portal/client-portal-company-users-controller";
import {
  CONTACT_PORTAL_STATUS_SQL,
  ContactServiceError,
  getLoginAccessState,
  inviteContact,
  linkContactToLogin,
  replaceProjectAccess,
} from "../services/client-contacts-service";
import { createMockRequest, createMockResponse } from "./utils/express-mock";
import { createQueryResult } from "./utils/db-mock";

const mockedQuery = db.query as jest.Mock;
const mockedConnect = (db.pool as any).connect as jest.Mock;
const mockedSendEmail = sendEmail as jest.Mock;

const CONTACT_ID = "11111111-1111-4111-8111-111111111111";
const CLIENT_ID = "22222222-2222-4222-8222-222222222222";
const PROJECT_ID = "33333333-3333-4333-8333-333333333333";

const viewRow = (overrides: Record<string, unknown> = {}) => ({
  id: CONTACT_ID,
  client_id: CLIENT_ID,
  company_name: "Brandbase",
  name: "Alex Chen",
  email: "alex@brandbase.com",
  phone: null,
  job_title: "CEO",
  role: "poc",
  has_login: false,
  last_login_at: null,
  invited_at: null,
  created_at: "2026-01-01T00:00:00.000Z",
  portal_status_key: "not_invited",
  projects: [],
  ...overrides,
});

/** Routes a transaction's statements by SQL text; anything unlisted succeeds with no rows. */
const stubTransaction = (handlers: Array<[RegExp, ReturnType<typeof createQueryResult>]>) => {
  mockTxQuery.mockImplementation(async (sql: string) => {
    const match = handlers.find(([pattern]) => pattern.test(String(sql)));
    return match ? match[1] : createQueryResult([]);
  });
};

beforeEach(() => {
  mockedQuery.mockReset();
  mockTxQuery.mockReset();
  mockRelease.mockReset();
  mockedSendEmail.mockReset();
  mockedConnect.mockReset();
  mockedConnect.mockResolvedValue({ query: mockTxQuery, release: mockRelease });
});

describe("derived portal status", () => {
  it("puts Disabled first so it overrides every other state", () => {
    const sql = CONTACT_PORTAL_STATUS_SQL;
    expect(sql.indexOf("'disabled'")).toBeLessThan(sql.indexOf("'active'"));
    expect(sql).toContain("inv.expires_at > NOW()");
  });
});

describe("ClientPortalCompanyUsersController.list", () => {
  beforeEach(() => {
    mockedQuery.mockImplementation(async (sql: string) =>
      String(sql).includes("COUNT(*)::int AS total")
        ? createQueryResult([{ total: 1 }])
        : createQueryResult([viewRow({ projects: [{ project_id: PROJECT_ID, name: "Site", level: "view" }] })])
    );
  });

  it("scopes to the team and filters on the derived status before paging", async () => {
    const res = createMockResponse();

    await ClientPortalCompanyUsersController.list(
      createMockRequest({
        query: { status: "invited, expired,bogus", search: "ali", client_id: CLIENT_ID, page: "2", limit: "5" },
      }),
      res
    );

    const [countSql, countParams] = mockedQuery.mock.calls.find(([sql]) =>
      String(sql).includes("COUNT(*)::int AS total")
    )!;
    expect(countParams).toEqual(["team-123", CLIENT_ID, "%ali%", ["invited", "expired"]]);
    expect(countSql).toContain("= ANY($4::text[])");

    const [, dataParams] = mockedQuery.mock.calls.find(([sql]) => String(sql).includes("portal_status_key"))!;
    expect(dataParams.slice(-2)).toEqual([5, 5]);

    expect(res.body.body).toMatchObject({ total: 1, page: 2, limit: 5 });
    expect(res.body.body.users[0]).toMatchObject({
      portal_status: { status: "not_invited", label: "Not Invited" },
      project_count: 1,
    });
  });

  it("rejects a malformed client id without querying", async () => {
    const res = createMockResponse();

    await ClientPortalCompanyUsersController.list(createMockRequest({ query: { client_id: "nope" } }), res);

    expect(res.statusCode).toBe(400);
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it("requires a team", async () => {
    const res = createMockResponse();

    await ClientPortalCompanyUsersController.list(createMockRequest({ user: {} }), res);

    expect(res.statusCode).toBe(401);
  });
});

describe("ClientPortalCompanyUsersController.stats", () => {
  it("returns the four counts, defaulting to zero", async () => {
    mockedQuery.mockResolvedValueOnce(
      createQueryResult([{ total: 8, pocs: 5, disabled: 1, companies_without_poc: 1 }])
    );
    const res = createMockResponse();

    await ClientPortalCompanyUsersController.stats(createMockRequest(), res);

    expect(res.body.body).toEqual({ total: 8, pocs: 5, companies_without_poc: 1, disabled: 1 });
    // Companies are counted by id, not by name.
    expect(String(mockedQuery.mock.calls[0][0])).toContain("GROUP BY client_id");
  });
});

describe("ClientPortalCompanyUsersController.setStatus", () => {
  it("rejects a non-boolean body", async () => {
    const res = createMockResponse();

    await ClientPortalCompanyUsersController.setStatus(
      createMockRequest({ params: { userId: CONTACT_ID }, body: { disabled: "yes" } }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it("only stamps or clears disabled_at, so the prior status is restored on enable", async () => {
    mockedQuery
      .mockResolvedValueOnce(createQueryResult([{ id: CONTACT_ID }]))
      .mockResolvedValueOnce(createQueryResult([viewRow({ portal_status_key: "disabled" })]));
    const res = createMockResponse();

    await ClientPortalCompanyUsersController.setStatus(
      createMockRequest({ params: { userId: CONTACT_ID }, body: { disabled: true } }),
      res
    );

    const [sql, params] = mockedQuery.mock.calls[0];
    expect(params).toEqual([true, CONTACT_ID, "team-123"]);
    expect(String(sql)).toContain("disabled_at");
    expect(String(sql)).not.toContain("client_users");
    expect(res.body.body.portal_status.status).toBe("disabled");
  });

  it("returns 404 for a user outside the team", async () => {
    mockedQuery.mockResolvedValueOnce(createQueryResult([]));
    const res = createMockResponse();

    await ClientPortalCompanyUsersController.setStatus(
      createMockRequest({ params: { userId: CONTACT_ID }, body: { disabled: false } }),
      res
    );

    expect(res.statusCode).toBe(404);
  });
});

describe("ClientPortalCompanyUsersController.setRole", () => {
  it("rejects a role other than poc or member", async () => {
    const res = createMockResponse();

    await ClientPortalCompanyUsersController.setRole(
      createMockRequest({ params: { userId: CONTACT_ID }, body: { role: "admin" } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it("does not stop a company from ending up with no POC", async () => {
    mockedQuery
      .mockResolvedValueOnce(createQueryResult([{ id: CONTACT_ID }]))
      .mockResolvedValueOnce(createQueryResult([viewRow({ role: "member" })]));
    const res = createMockResponse();

    await ClientPortalCompanyUsersController.setRole(
      createMockRequest({ params: { userId: CONTACT_ID }, body: { role: "member" } }),
      res
    );

    expect(res.statusCode).toBe(200);
    // No "at least one POC" guard: the update is a plain single-row write.
    expect(String(mockedQuery.mock.calls[0][0])).not.toContain("NOT EXISTS");
  });
});

describe("ClientPortalCompanyUsersController.setProjects", () => {
  const contactLookup: [RegExp, ReturnType<typeof createQueryResult>] = [
    /FROM client_contacts\s+WHERE id = \$1 AND team_id = \$2/,
    createQueryResult([{ id: CONTACT_ID, client_id: CLIENT_ID, team_id: "team-123" }]),
  ];

  it("rejects an unknown permission level before touching the database", async () => {
    const res = createMockResponse();

    await ClientPortalCompanyUsersController.setProjects(
      createMockRequest({
        params: { userId: CONTACT_ID },
        body: { projects: [{ project_id: PROJECT_ID, level: "owner" }] },
      }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(mockedConnect).not.toHaveBeenCalled();
  });

  it("rolls back when a project does not belong to the company", async () => {
    stubTransaction([contactLookup, [/FROM projects/, createQueryResult([])]]);
    const res = createMockResponse();

    await ClientPortalCompanyUsersController.setProjects(
      createMockRequest({
        params: { userId: CONTACT_ID },
        body: { projects: [{ project_id: PROJECT_ID, level: "view" }] },
      }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(mockTxQuery.mock.calls.map(([sql]) => String(sql))).toContain("ROLLBACK");
    expect(mockRelease).toHaveBeenCalled();
  });

  it("replaces the access list in one transaction", async () => {
    stubTransaction([contactLookup, [/FROM projects/, createQueryResult([{ id: PROJECT_ID }])]]);
    mockedQuery.mockResolvedValueOnce(
      createQueryResult([viewRow({ projects: [{ project_id: PROJECT_ID, name: "Site", level: "comment" }] })])
    );
    const res = createMockResponse();

    await ClientPortalCompanyUsersController.setProjects(
      createMockRequest({
        params: { userId: CONTACT_ID },
        body: { projects: [{ project_id: PROJECT_ID, level: "comment" }] },
      }),
      res
    );

    const statements = mockTxQuery.mock.calls.map(([sql]) => String(sql));
    expect(statements.some((sql) => sql.includes("DELETE FROM client_contact_project_access"))).toBe(true);
    expect(statements.some((sql) => sql.includes("INSERT INTO client_contact_project_access"))).toBe(true);
    expect(statements).toContain("COMMIT");
    expect(res.statusCode).toBe(200);
  });
});

describe("ClientPortalCompanyUsersController.update", () => {
  it("won't change the email of someone who already has a login", async () => {
    stubTransaction([
      [/FOR UPDATE/, createQueryResult([{ id: CONTACT_ID, client_user_id: "login-1", email: "old@x.com" }])],
    ]);
    const res = createMockResponse();

    await ClientPortalCompanyUsersController.update(
      createMockRequest({ params: { userId: CONTACT_ID }, body: { email: "new@x.com" } }),
      res
    );

    expect(res.statusCode).toBe(409);
    expect(mockTxQuery.mock.calls.map(([sql]) => String(sql))).toContain("ROLLBACK");
  });

  it("refuses an email another company's user already has", async () => {
    stubTransaction([
      [/FOR UPDATE/, createQueryResult([{ id: CONTACT_ID, client_user_id: null, email: "old@x.com" }])],
      [
        /FROM client_contacts cc\s+JOIN clients c/,
        createQueryResult([{ id: "other", client_id: "other-client", company_name: "Avant", client_name: "Avant" }]),
      ],
    ]);
    const res = createMockResponse();

    await ClientPortalCompanyUsersController.update(
      createMockRequest({ params: { userId: CONTACT_ID }, body: { email: "taken@x.com" } }),
      res
    );

    expect(res.statusCode).toBe(409);
    expect(res.body.message).toContain("Avant");
  });

  it("drops the pending invitation when the email changes, since it went to the old address", async () => {
    stubTransaction([
      [/FOR UPDATE/, createQueryResult([{ id: CONTACT_ID, client_user_id: null, email: "old@x.com" }])],
    ]);
    mockedQuery.mockResolvedValueOnce(createQueryResult([viewRow({ email: "new@x.com" })]));
    const res = createMockResponse();

    await ClientPortalCompanyUsersController.update(
      createMockRequest({ params: { userId: CONTACT_ID }, body: { email: "new@x.com", name: "Alex C" } }),
      res
    );

    const statements = mockTxQuery.mock.calls.map(([sql]) => String(sql));
    expect(statements.some((sql) => sql.includes("DELETE FROM client_invitations"))).toBe(true);
    expect(res.statusCode).toBe(200);
  });

  it("validates fields", async () => {
    const res = createMockResponse();

    await ClientPortalCompanyUsersController.update(
      createMockRequest({ params: { userId: CONTACT_ID }, body: { name: "   " } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });
});

describe("ClientPortalCompanyUsersController.remove", () => {
  it("deletes the login when nothing else uses it", async () => {
    stubTransaction([
      [
        /FROM client_contacts\s+WHERE id = \$1 AND team_id = \$2/,
        createQueryResult([{ id: CONTACT_ID, client_id: CLIENT_ID, client_user_id: "login-1" }]),
      ],
      [/SELECT 1 FROM client_contacts WHERE client_user_id/, createQueryResult([])],
    ]);
    const res = createMockResponse();

    await ClientPortalCompanyUsersController.remove(createMockRequest({ params: { userId: CONTACT_ID } }), res);

    const statements = mockTxQuery.mock.calls.map(([sql]) => String(sql));
    expect(statements).toContain("DELETE FROM client_users WHERE id = $1");
    expect(res.statusCode).toBe(200);
  });

  it("only detaches this team's organisation when the login is shared with another team", async () => {
    stubTransaction([
      [
        /FROM client_contacts\s+WHERE id = \$1 AND team_id = \$2/,
        createQueryResult([{ id: CONTACT_ID, client_id: CLIENT_ID, client_user_id: "login-1" }]),
      ],
      [/SELECT 1 FROM client_contacts WHERE client_user_id/, createQueryResult([{ "?column?": 1 }])],
    ]);
    const res = createMockResponse();

    await ClientPortalCompanyUsersController.remove(createMockRequest({ params: { userId: CONTACT_ID } }), res);

    const statements = mockTxQuery.mock.calls.map(([sql]) => String(sql));
    expect(statements.some((sql) => sql.includes("DELETE FROM client_users"))).toBe(false);
    expect(statements.some((sql) => sql.includes("DELETE FROM client_user_organizations"))).toBe(true);
  });

  it("returns 404 when the user is not in the team", async () => {
    stubTransaction([]);
    const res = createMockResponse();

    await ClientPortalCompanyUsersController.remove(createMockRequest({ params: { userId: CONTACT_ID } }), res);

    expect(res.statusCode).toBe(404);
  });
});

describe("ClientPortalCompanyUsersController.invite", () => {
  it("maps a disabled user to 409", async () => {
    mockedQuery.mockResolvedValueOnce(
      createQueryResult([
        { id: CONTACT_ID, client_id: CLIENT_ID, name: "A", email: "a@x.com", disabled_at: "2026-01-01", is_active: false },
      ])
    );
    const res = createMockResponse();

    await ClientPortalCompanyUsersController.invite(createMockRequest({ params: { userId: CONTACT_ID } }), res);

    expect(res.statusCode).toBe(409);
  });
});

describe("inviteContact", () => {
  const contactRow = (overrides: Record<string, unknown> = {}) => ({
    id: CONTACT_ID,
    client_id: CLIENT_ID,
    name: "Alex Chen",
    email: "alex@brandbase.com",
    disabled_at: null,
    client_name: "Brandbase",
    company_name: "Brandbase Ltd",
    client_phone: null,
    is_active: false,
    team_name: "Acme Studio",
    ...overrides,
  });

  const run = (delivery: "email" | "link") =>
    inviteContact({ teamId: "team-123", contactId: CONTACT_ID, invitedBy: "user-123", delivery });

  it("refuses to invite someone who already has portal access", async () => {
    mockedQuery.mockResolvedValueOnce(createQueryResult([contactRow({ is_active: true })]));

    await expect(run("email")).rejects.toMatchObject({ code: "ALREADY_ACTIVE" });
  });

  it("refuses an unknown user", async () => {
    mockedQuery.mockResolvedValueOnce(createQueryResult([]));

    await expect(run("email")).rejects.toBeInstanceOf(ContactServiceError);
  });

  it("restarts the window of the existing pending invitation instead of adding a second one", async () => {
    mockedQuery
      .mockResolvedValueOnce(createQueryResult([contactRow()]))
      .mockResolvedValueOnce(createQueryResult([{ expires_at: "2026-10-04T00:00:00.000Z" }]));
    mockedSendEmail.mockResolvedValueOnce("message-id");

    const result = await run("email");

    const [updateSql, updateParams] = mockedQuery.mock.calls[1];
    expect(String(updateSql)).toContain("UPDATE client_invitations");
    expect(String(updateSql)).toContain("created_at = NOW()");
    expect(updateParams[4]).toBe(CONTACT_ID);
    expect(mockedQuery).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ emailSent: true, link: null, delivery: "email" });
    expect(mockedSendEmail).toHaveBeenCalledTimes(1);
  });

  it("creates the first invitation tied to the contact", async () => {
    mockedQuery
      .mockResolvedValueOnce(createQueryResult([contactRow()]))
      .mockResolvedValueOnce(createQueryResult([]))
      .mockResolvedValueOnce(createQueryResult([{ expires_at: "2026-10-04T00:00:00.000Z" }]));
    mockedSendEmail.mockResolvedValueOnce("message-id");

    await run("email");

    const [insertSql, insertParams] = mockedQuery.mock.calls[2];
    expect(String(insertSql)).toContain("INSERT INTO client_invitations");
    expect(insertParams[5]).toBe(CONTACT_ID);
  });

  it("returns the link without emailing when delivery is link", async () => {
    mockedQuery
      .mockResolvedValueOnce(createQueryResult([contactRow()]))
      .mockResolvedValueOnce(createQueryResult([{ expires_at: "2026-10-04T00:00:00.000Z" }]));

    const result = await run("link");

    expect(mockedSendEmail).not.toHaveBeenCalled();
    expect(result.link).toMatch(/^https:\/\/portal\.test\/invite\?token=wli_/);
    expect(result.emailSent).toBe(false);
  });

  it("hands the link back when the email could not be sent", async () => {
    mockedQuery
      .mockResolvedValueOnce(createQueryResult([contactRow()]))
      .mockResolvedValueOnce(createQueryResult([{ expires_at: "2026-10-04T00:00:00.000Z" }]));
    mockedSendEmail.mockResolvedValueOnce(null);

    const result = await run("email");

    expect(result.emailSent).toBe(false);
    expect(result.link).toContain("/invite?token=");
  });
});

describe("replaceProjectAccess", () => {
  it("rejects an invalid level", async () => {
    const q = { query: jest.fn() };

    await expect(
      replaceProjectAccess(q, {
        contactId: CONTACT_ID,
        clientId: CLIENT_ID,
        teamId: "team-123",
        access: [{ projectId: PROJECT_ID, level: "root" as any }],
      })
    ).rejects.toMatchObject({ code: "INVALID_LEVEL" });
    expect(q.query).not.toHaveBeenCalled();
  });

  it("collapses a project listed twice to its last level", async () => {
    const q = { query: jest.fn().mockResolvedValue(createQueryResult([{ id: PROJECT_ID }])) };

    const saved = await replaceProjectAccess(q, {
      contactId: CONTACT_ID,
      clientId: CLIENT_ID,
      teamId: "team-123",
      access: [
        { projectId: PROJECT_ID, level: "view" },
        { projectId: PROJECT_ID, level: "contributor" },
      ],
    });

    expect(saved).toEqual([{ projectId: PROJECT_ID, level: "contributor" }]);
  });

  it("clears access when given an empty list", async () => {
    const q = { query: jest.fn().mockResolvedValue(createQueryResult([])) };

    await replaceProjectAccess(q, { contactId: CONTACT_ID, clientId: CLIENT_ID, teamId: "team-123", access: [] });

    expect(q.query).toHaveBeenCalledTimes(1);
    expect(String(q.query.mock.calls[0][0])).toContain("DELETE FROM client_contact_project_access");
  });
});

describe("linkContactToLogin", () => {
  it("unlinks the login's other contact in the team, then links this one", async () => {
    const q = { query: jest.fn().mockResolvedValue(createQueryResult([])) };

    const id = await linkContactToLogin(q, {
      teamId: "team-123",
      clientId: CLIENT_ID,
      clientUserId: "login-1",
      email: "alex@brandbase.com",
      name: "Alex",
      contactId: CONTACT_ID,
    });

    expect(id).toBe(CONTACT_ID);
    expect(String(q.query.mock.calls[0][0])).toContain("SET client_user_id = NULL");
    expect(String(q.query.mock.calls[1][0])).toContain("SET client_user_id = $1");
  });

  it("leaves alone an email that belongs to another company's contact", async () => {
    const q = {
      query: jest
        .fn()
        .mockResolvedValueOnce(
          createQueryResult([{ id: "other", client_id: "someone-else", company_name: "Avant", client_name: "Avant" }])
        ),
    };

    const id = await linkContactToLogin(q, {
      teamId: "team-123",
      clientId: CLIENT_ID,
      clientUserId: "login-1",
      email: "alex@brandbase.com",
      name: "Alex",
    });

    expect(id).toBeNull();
    expect(q.query).toHaveBeenCalledTimes(1);
  });

  it("creates the company user when the invitation predates them", async () => {
    const q = {
      query: jest
        .fn()
        .mockResolvedValueOnce(createQueryResult([])) // no contact with this email
        .mockResolvedValueOnce(createQueryResult([])) // createContact: email check
        .mockResolvedValueOnce(createQueryResult([{ id: CONTACT_ID }])) // insert
        .mockResolvedValue(createQueryResult([])),
    };

    const id = await linkContactToLogin(q, {
      teamId: "team-123",
      clientId: CLIENT_ID,
      clientUserId: "login-1",
      email: "alex@brandbase.com",
      name: "Alex",
    });

    expect(id).toBe(CONTACT_ID);
    expect(q.query.mock.calls.some(([sql]) => String(sql).includes("INSERT INTO client_contacts"))).toBe(true);
  });
});

describe("getLoginAccessState", () => {
  it("reports a removed login", async () => {
    const q = { query: jest.fn().mockResolvedValue(createQueryResult([])) };

    expect(await getLoginAccessState(q, "login-1", CLIENT_ID)).toEqual({
      exists: false,
      loginStatus: null,
      isDisabled: false,
    });
  });

  it("reports a disabled company user", async () => {
    const q = {
      query: jest.fn().mockResolvedValue(createQueryResult([{ login_status: "active", is_disabled: true }])),
    };

    expect(await getLoginAccessState(q, "login-1", CLIENT_ID)).toEqual({
      exists: true,
      loginStatus: "active",
      isDisabled: true,
    });
  });
});
