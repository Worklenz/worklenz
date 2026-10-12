const mockTxQuery = jest.fn();
const mockRelease = jest.fn();
const mockInviteContact = jest.fn();

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
  default: { getEmailTemplate: jest.fn(() => "") },
}));

jest.mock("../cron_jobs/helpers", () => ({
  __esModule: true,
  getClientPortalBaseUrl: () => "https://portal.test",
}));

// Everything real except the invitation itself, which has its own tests.
jest.mock("../services/client-contacts-service", () => ({
  ...jest.requireActual("../services/client-contacts-service"),
  inviteContact: (...args: unknown[]) => mockInviteContact(...args),
}));

import db from "../config/db";
import ClientPortalOnboardingController from "../controllers/client-portal/client-portal-onboarding-controller";
import {
  IMPORT_MAX_ROWS,
  buildFullName,
  commitImport,
  prepareImportRows,
  validateImport,
} from "../services/client-onboarding-service";
import { createMockRequest, createMockResponse } from "./utils/express-mock";
import { createQueryResult } from "./utils/db-mock";

const mockedQuery = db.query as jest.Mock;
const mockedConnect = (db.pool as any).connect as jest.Mock;

const CLIENT_ID = "22222222-2222-4222-8222-222222222222";
const CONTACT_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "33333333-3333-4333-8333-333333333333";

const NO_LOOKUPS = { existingEmails: new Set<string>(), existingClients: new Map<string, string>() };

const viewRow = (overrides: Record<string, unknown> = {}) => ({
  id: CONTACT_ID,
  client_id: CLIENT_ID,
  company_name: "Beacon Logistics",
  name: "Jane Doe",
  email: "jane@beacon.io",
  phone: null,
  job_title: null,
  role: "poc",
  has_login: false,
  last_login_at: null,
  invited_at: null,
  created_at: "2026-01-01T00:00:00.000Z",
  portal_status_key: "not_invited",
  projects: [],
  ...overrides,
});

type Handler = [RegExp, ReturnType<typeof createQueryResult> | (() => ReturnType<typeof createQueryResult>)];

/** Routes a transaction's statements by SQL text; anything unlisted succeeds with no rows. */
const stubTransaction = (handlers: Handler[]) => {
  mockTxQuery.mockImplementation(async (sql: string) => {
    const match = handlers.find(([pattern]) => pattern.test(String(sql)));
    if (!match) return createQueryResult([]);
    return typeof match[1] === "function" ? match[1]() : match[1];
  });
};

const newCompanyHandlers = (): Handler[] => [
  // The company just created is then found when a later row of the same company is added to it.
  [/SELECT id FROM clients WHERE id/, createQueryResult([{ id: CLIENT_ID }])],
  [/INSERT INTO clients/, createQueryResult([{ id: CLIENT_ID, name: "Beacon Logistics", company_name: "Beacon Logistics" }])],
  [/INSERT INTO client_contacts/, createQueryResult([{ id: CONTACT_ID, client_id: CLIENT_ID, role: "poc" }])],
];

const statements = () => mockTxQuery.mock.calls.map(([sql]) => String(sql));

beforeEach(() => {
  mockedQuery.mockReset();
  mockTxQuery.mockReset();
  mockRelease.mockReset();
  mockInviteContact.mockReset();
  mockedConnect.mockReset();
  mockedConnect.mockResolvedValue({ query: mockTxQuery, release: mockRelease });
});

describe("buildFullName", () => {
  it("joins the parts that are present", () => {
    expect(buildFullName(" Jane ", " Doe ")).toBe("Jane Doe");
    expect(buildFullName("Jane", "")).toBe("Jane");
    expect(buildFullName("Jane", null)).toBe("Jane");
  });
});

describe("prepareImportRows", () => {
  const row = (overrides: Record<string, unknown> = {}) => ({
    company: "Beacon Logistics",
    first_name: "Jane",
    last_name: "Doe",
    email: "jane@beacon.io",
    ...overrides,
  });

  it("accepts a complete row", () => {
    const [result] = prepareImportRows([row()], NO_LOOKUPS);

    expect(result).toMatchObject({
      row: 1,
      status: "ok",
      errors: [],
      name: "Jane Doe",
      company: "Beacon Logistics",
      company_exists: false,
    });
  });

  it("numbers rows from 1 and keeps them in order", () => {
    const results = prepareImportRows([row(), row({ email: "b@beacon.io" })], NO_LOOKUPS);

    expect(results.map((item) => item.row)).toEqual([1, 2]);
  });

  it("flags a missing first name and a missing email", () => {
    const [result] = prepareImportRows([row({ first_name: " ", email: "" })], NO_LOOKUPS);

    expect(result.status).toBe("error");
    expect(result.errors).toEqual(expect.arrayContaining(["missing_first_name", "missing_email"]));
  });

  it("does not need a last name or a company", () => {
    const [result] = prepareImportRows([row({ last_name: "", company: "" })], NO_LOOKUPS);

    expect(result.status).toBe("ok");
  });

  it.each(["jane", "jane@", "@beacon.io", "jane@beacon"])("rejects the email %j", (email) => {
    expect(prepareImportRows([row({ email })], NO_LOOKUPS)[0].errors).toContain("invalid_email");
  });

  it("flags an email repeated in the file, but only from its second use", () => {
    const [first, second] = prepareImportRows([row(), row({ email: "JANE@beacon.io" })], NO_LOOKUPS);

    expect(first.status).toBe("ok");
    expect(second.errors).toContain("duplicate_in_file");
  });

  it("flags an email that already belongs to a company user, ignoring case", () => {
    const [result] = prepareImportRows([row()], {
      ...NO_LOOKUPS,
      existingEmails: new Set(["jane@beacon.io"]),
    });

    expect(result.errors).toContain("email_in_use");
  });

  it("flags a company name over the 60 character limit", () => {
    const [result] = prepareImportRows([row({ company: "x".repeat(61) })], NO_LOOKUPS);

    expect(result.errors).toContain("company_name_too_long");
  });

  it("joins an existing company by its name, ignoring case", () => {
    const [result] = prepareImportRows([row({ company: "BEACON logistics" })], {
      ...NO_LOOKUPS,
      existingClients: new Map([["beacon logistics", CLIENT_ID]]),
    });

    expect(result).toMatchObject({ status: "ok", company_exists: true, existingClientId: CLIENT_ID });
  });

  it("puts rows that name the same company in one group, and rows without one on their own", () => {
    const results = prepareImportRows(
      [
        row(),
        row({ email: "sam@beacon.io", first_name: "Sam", company: "beacon logistics" }),
        row({ email: "solo@x.io", first_name: "Solo", company: "" }),
      ],
      NO_LOOKUPS
    );

    expect(results[0].groupKey).toBe(results[1].groupKey);
    expect(results[2].groupKey).not.toBe(results[0].groupKey);
  });

  it("uses the person's name as the client for a row with no company", () => {
    const [result] = prepareImportRows([row({ company: "" })], NO_LOOKUPS);

    expect(result.company).toBe("Jane Doe");
  });

  it("refuses a person-named client whose name is already taken, in the team or in the file", () => {
    const [inTeam] = prepareImportRows([row({ company: "" })], {
      ...NO_LOOKUPS,
      existingClients: new Map([["jane doe", CLIENT_ID]]),
    });
    const [firstJane, secondJane] = prepareImportRows(
      [row({ company: "" }), row({ company: "", email: "other@x.io" })],
      NO_LOOKUPS
    );

    expect(inTeam.errors).toContain("client_name_taken");
    expect(firstJane.status).toBe("ok");
    expect(secondJane.errors).toContain("client_name_taken");
  });

  it("tolerates cells that are not text", () => {
    const [result] = prepareImportRows([{ first_name: 5, email: null } as any], NO_LOOKUPS);

    expect(result.status).toBe("error");
  });
});

describe("validateImport", () => {
  const stubLookups = (emails: string[] = [], clients: Array<Record<string, unknown>> = []) => {
    mockedQuery.mockImplementation(async (sql: string) =>
      String(sql).includes("FROM client_contacts")
        ? createQueryResult(emails.map((email) => ({ email })))
        : createQueryResult(clients)
    );
  };

  it("summarises what the import would do without writing", async () => {
    stubLookups(["taken@x.io"], [{ id: CLIENT_ID, name: "Beacon Logistics", company_name: null }]);

    const { summary, rows } = await validateImport("team-123", [
      { company: "Beacon Logistics", first_name: "A", email: "a@x.io" },
      { company: "New Co", first_name: "B", email: "b@x.io" },
      { company: "New Co", first_name: "C", email: "c@x.io" },
      { company: "Bad Co", first_name: "D", email: "taken@x.io" },
    ]);

    expect(summary).toEqual({ total: 4, valid: 3, invalid: 1, new_companies: 1, existing_companies: 1 });
    expect(rows[3]).toMatchObject({ status: "error", errors: ["email_in_use"] });
    expect(mockTxQuery).not.toHaveBeenCalled();
  });

  it("matches an existing company by its company name as well as its client name", async () => {
    stubLookups([], [{ id: CLIENT_ID, name: "Brandbase", company_name: "Brandbase Ltd" }]);

    const { rows } = await validateImport("team-123", [
      { company: "brandbase ltd", first_name: "A", email: "a@x.io" },
    ]);

    expect(rows[0].company_exists).toBe(true);
  });

  it("rejects an empty file and one over the row limit", async () => {
    stubLookups();

    await expect(validateImport("team-123", [])).rejects.toMatchObject({ code: "MISSING_FIELDS" });
    await expect(validateImport("team-123", undefined)).rejects.toMatchObject({ code: "MISSING_FIELDS" });
    await expect(
      validateImport(
        "team-123",
        Array.from({ length: IMPORT_MAX_ROWS + 1 }, (_, i) => ({ first_name: "A", email: `a${i}@x.io` }))
      )
    ).rejects.toMatchObject({ code: "TOO_MANY_ROWS" });
  });
});

describe("commitImport", () => {
  const stubLookups = (clients: Array<Record<string, unknown>> = []) => {
    mockedQuery.mockImplementation(async (sql: string) =>
      String(sql).includes("FROM client_contacts") ? createQueryResult([]) : createQueryResult(clients)
    );
  };

  it("creates a new company with its first row as POC and the rest as members", async () => {
    stubLookups();
    stubTransaction(newCompanyHandlers());

    const outcome = await commitImport("team-123", [
      { company: "Beacon Logistics", first_name: "Jane", email: "jane@beacon.io" },
      { company: "Beacon Logistics", first_name: "Sam", email: "sam@beacon.io" },
    ]);

    expect(outcome).toMatchObject({ created_companies: 1, added_users: 2, skipped: 0 });
    const contactInserts = mockTxQuery.mock.calls.filter(([sql]) => /INSERT INTO client_contacts/.test(String(sql)));
    expect(contactInserts).toHaveLength(2);
    expect(contactInserts[0][1][6]).toBe("poc");
    expect(contactInserts[1][1][6]).toBe("member");
    // Nobody is emailed by an import.
    expect(mockInviteContact).not.toHaveBeenCalled();
  });

  it("adds every row of an existing company as a member", async () => {
    stubLookups([{ id: CLIENT_ID, name: "Beacon Logistics", company_name: null }]);
    stubTransaction([
      [/SELECT id FROM clients WHERE id/, createQueryResult([{ id: CLIENT_ID }])],
      [/INSERT INTO client_contacts/, createQueryResult([{ id: CONTACT_ID, client_id: CLIENT_ID, role: "member" }])],
    ]);

    const outcome = await commitImport("team-123", [
      { company: "Beacon Logistics", first_name: "Sam", email: "sam@beacon.io" },
    ]);

    expect(outcome).toMatchObject({ created_companies: 0, added_users: 1 });
    expect(statements().some((sql) => /INSERT INTO clients/.test(sql))).toBe(false);
  });

  it("skips invalid rows and still imports the valid ones", async () => {
    stubLookups();
    stubTransaction(newCompanyHandlers());

    const outcome = await commitImport("team-123", [
      { company: "Beacon Logistics", first_name: "Jane", email: "jane@beacon.io" },
      { company: "Other Co", first_name: "", email: "nope" },
    ]);

    expect(outcome).toMatchObject({ created_companies: 1, added_users: 1, skipped: 1 });
    expect(outcome.rows[1].errors).toEqual(expect.arrayContaining(["missing_first_name", "invalid_email"]));
  });

  it("gives each company its own transaction, so one failure does not lose the others", async () => {
    stubLookups();
    let clientInserts = 0;
    stubTransaction([
      [
        /INSERT INTO clients/,
        // Placeholder replaced below: the second company fails.
        createQueryResult([{ id: CLIENT_ID, name: "Beacon Logistics", company_name: "Beacon Logistics" }]),
      ],
      [/INSERT INTO client_contacts/, createQueryResult([{ id: CONTACT_ID, client_id: CLIENT_ID, role: "poc" }])],
    ]);
    const base = mockTxQuery.getMockImplementation()!;
    mockTxQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (/INSERT INTO clients/.test(String(sql))) {
        clientInserts += 1;
        if (clientInserts === 2) throw new Error("boom");
      }
      return base(sql, params);
    });
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);

    const outcome = await commitImport("team-123", [
      { company: "First Co", first_name: "A", email: "a@x.io" },
      { company: "Second Co", first_name: "B", email: "b@x.io" },
      { company: "Third Co", first_name: "C", email: "c@x.io" },
    ]);

    consoleError.mockRestore();
    expect(outcome).toMatchObject({ created_companies: 2, added_users: 2, skipped: 1 });
    expect(outcome.rows[1]).toMatchObject({ status: "error", errors: ["import_failed"] });
    expect(statements().filter((sql) => sql === "ROLLBACK")).toHaveLength(1);
    expect(statements().filter((sql) => sql === "COMMIT")).toHaveLength(2);
  });
});

describe("ClientPortalOnboardingController.onboard", () => {
  const request = (body: Record<string, unknown>) => createMockRequest({ body });

  const stubHappyPath = () => {
    stubTransaction(newCompanyHandlers());
    mockedQuery.mockImplementation(async (sql: string) =>
      /INSERT INTO client_portal_chat_messages/.test(String(sql))
        ? createQueryResult([])
        : createQueryResult([viewRow()])
    );
  };

  it("requires a first name", async () => {
    const res = createMockResponse();

    await ClientPortalOnboardingController.onboard(request({ email: "jane@beacon.io" }), res);

    expect(res.statusCode).toBe(400);
    expect(mockedConnect).not.toHaveBeenCalled();
  });

  it("creates the company and its first contact as POC in one transaction, without inviting", async () => {
    stubHappyPath();
    const res = createMockResponse();

    await ClientPortalOnboardingController.onboard(
      request({ company_name: "Beacon Logistics", first_name: "Jane", last_name: "Doe", email: "jane@beacon.io" }),
      res
    );

    expect(res.statusCode).toBe(201);
    const clientInsert = mockTxQuery.mock.calls.find(([sql]) => /INSERT INTO clients/.test(String(sql)))!;
    // name, email, company_name, phone, contact_person, team
    expect(clientInsert[1]).toEqual(["Beacon Logistics", "jane@beacon.io", "Beacon Logistics", null, "Jane Doe", "team-123"]);
    const contactInsert = mockTxQuery.mock.calls.find(([sql]) => /INSERT INTO client_contacts/.test(String(sql)))!;
    expect(contactInsert[1][6]).toBe("poc");
    expect(statements()).toContain("COMMIT");
    expect(mockInviteContact).not.toHaveBeenCalled();
    expect(res.body.body.invite).toMatchObject({ requested: false });
  });

  it("names the client after the person when no company is given", async () => {
    stubHappyPath();
    const res = createMockResponse();

    await ClientPortalOnboardingController.onboard(
      request({ first_name: "Jane", last_name: "Doe", email: "jane@beacon.io" }),
      res
    );

    const clientInsert = mockTxQuery.mock.calls.find(([sql]) => /INSERT INTO clients/.test(String(sql)))!;
    expect(clientInsert[1][0]).toBe("Jane Doe");
    expect(clientInsert[1][2]).toBeNull();
  });

  it("refuses a company name that is too long or already taken", async () => {
    stubTransaction([[/SELECT id FROM clients WHERE team_id/, createQueryResult([{ id: "existing" }])]]);
    const taken = createMockResponse();
    await ClientPortalOnboardingController.onboard(
      request({ company_name: "Beacon", first_name: "Jane", email: "jane@beacon.io" }),
      taken
    );
    expect(taken.statusCode).toBe(409);

    const tooLong = createMockResponse();
    await ClientPortalOnboardingController.onboard(
      request({ company_name: "x".repeat(61), first_name: "Jane", email: "jane@beacon.io" }),
      tooLong
    );
    expect(tooLong.statusCode).toBe(400);
  });

  it("refuses an email another company user already has", async () => {
    stubTransaction([
      [/INSERT INTO clients/, createQueryResult([{ id: CLIENT_ID, name: "Beacon", company_name: "Beacon" }])],
      [
        /FROM client_contacts cc\s+JOIN clients c/,
        createQueryResult([{ id: "other", client_id: "x", company_name: "Avant", client_name: "Avant" }]),
      ],
    ]);
    const res = createMockResponse();

    await ClientPortalOnboardingController.onboard(
      request({ company_name: "Beacon", first_name: "Jane", email: "jane@beacon.io" }),
      res
    );

    expect(res.statusCode).toBe(409);
    expect(res.body.message).toContain("Avant");
    expect(statements()).toContain("ROLLBACK");
  });

  it("validates the email before writing anything", async () => {
    stubTransaction([]);
    const res = createMockResponse();

    await ClientPortalOnboardingController.onboard(request({ first_name: "Jane", email: "nope" }), res);

    expect(res.statusCode).toBe(400);
    expect(statements().some((sql) => /INSERT/.test(sql))).toBe(false);
  });

  it("sends the invite after saving when asked, by the chosen delivery", async () => {
    stubHappyPath();
    mockInviteContact.mockResolvedValue({
      contactId: CONTACT_ID,
      email: "jane@beacon.io",
      delivery: "link",
      link: "https://portal.test/invite?token=wli_x",
      expiresAt: "2026-10-04T00:00:00.000Z",
      emailSent: false,
    });
    const res = createMockResponse();

    await ClientPortalOnboardingController.onboard(
      request({ first_name: "Jane", email: "jane@beacon.io", send_invite: true, delivery: "link" }),
      res
    );

    expect(mockInviteContact).toHaveBeenCalledWith(
      expect.objectContaining({ contactId: CONTACT_ID, delivery: "link", teamId: "team-123", invitedBy: "user-123" })
    );
    expect(res.body.body.invite).toMatchObject({
      requested: true,
      delivery: "link",
      link: "https://portal.test/invite?token=wli_x",
    });
  });

  it("keeps the saved client when the invitation fails", async () => {
    stubHappyPath();
    mockInviteContact.mockRejectedValue(new Error("SES is down"));
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const res = createMockResponse();

    await ClientPortalOnboardingController.onboard(
      request({ first_name: "Jane", email: "jane@beacon.io", send_invite: true }),
      res
    );

    consoleError.mockRestore();
    expect(res.statusCode).toBe(201);
    expect(res.body.body.invite).toMatchObject({ requested: true, error: "SES is down" });
    expect(statements()).toContain("COMMIT");
  });

  it("posts the welcome message from the person who added the client", async () => {
    stubHappyPath();
    const res = createMockResponse();

    await ClientPortalOnboardingController.onboard(
      request({ first_name: "Jane", email: "jane@beacon.io", welcome_message: "Welcome, Jane!" }),
      res
    );

    const insert = mockedQuery.mock.calls.find(([sql]) =>
      /INSERT INTO client_portal_chat_messages/.test(String(sql))
    )!;
    expect(insert[1]).toEqual([CLIENT_ID, "team-123", "user-123", "Welcome, Jane!"]);
    expect(res.body.body.welcome_message_posted).toBe(true);
  });

  it("does not post a message unless one is given", async () => {
    stubHappyPath();
    const res = createMockResponse();

    await ClientPortalOnboardingController.onboard(request({ first_name: "Jane", email: "jane@beacon.io" }), res);

    expect(
      mockedQuery.mock.calls.some(([sql]) => /INSERT INTO client_portal_chat_messages/.test(String(sql)))
    ).toBe(false);
    expect(res.body.body.welcome_message_posted).toBe(false);
  });

  it("turns a unique-name race into the same 409", async () => {
    stubTransaction([]);
    mockTxQuery.mockImplementation(async (sql: string) => {
      if (/INSERT INTO clients/.test(String(sql))) {
        throw Object.assign(new Error("dup"), { code: "23505", constraint: "clients_name_team_id_uindex" });
      }
      return createQueryResult([]);
    });
    const res = createMockResponse();

    await ClientPortalOnboardingController.onboard(
      request({ company_name: "Beacon", first_name: "Jane", email: "jane@beacon.io" }),
      res
    );

    expect(res.statusCode).toBe(409);
  });
});

describe("ClientPortalOnboardingController.addCompanyUser", () => {
  const request = (body: Record<string, unknown>) =>
    createMockRequest({ params: { id: CLIENT_ID }, body });

  const companyExists: Handler = [/SELECT id FROM clients WHERE id/, createQueryResult([{ id: CLIENT_ID }])];
  const contactInserted: Handler = [
    /INSERT INTO client_contacts/,
    createQueryResult([{ id: CONTACT_ID, client_id: CLIENT_ID, role: "member" }]),
  ];

  beforeEach(() => {
    mockedQuery.mockResolvedValue(createQueryResult([viewRow({ role: "member" })]));
  });

  it("rejects a role other than poc or member", async () => {
    const res = createMockResponse();

    await ClientPortalOnboardingController.addCompanyUser(
      request({ first_name: "Sam", email: "sam@x.io", role: "admin" }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it("rejects a malformed project access list before touching the database", async () => {
    const res = createMockResponse();

    await ClientPortalOnboardingController.addCompanyUser(
      request({ first_name: "Sam", email: "sam@x.io", project_access: [{ project_id: "nope", level: "view" }] }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(mockedConnect).not.toHaveBeenCalled();
  });

  it("returns 404 for a client outside the team", async () => {
    stubTransaction([]);
    const res = createMockResponse();

    await ClientPortalOnboardingController.addCompanyUser(request({ first_name: "Sam", email: "sam@x.io" }), res);

    expect(res.statusCode).toBe(404);
  });

  it("adds a member by default and can add a POC", async () => {
    stubTransaction([companyExists, contactInserted]);
    const member = createMockResponse();
    await ClientPortalOnboardingController.addCompanyUser(
      request({ first_name: "Sam", email: "sam@x.io" }),
      member
    );
    expect(member.statusCode).toBe(201);
    const memberInsert = mockTxQuery.mock.calls.find(([sql]) => /INSERT INTO client_contacts/.test(String(sql)))!;
    expect(memberInsert[1][6]).toBe("member");

    mockTxQuery.mockClear();
    stubTransaction([companyExists, contactInserted]);
    const poc = createMockResponse();
    await ClientPortalOnboardingController.addCompanyUser(
      request({ first_name: "Sam", email: "sam2@x.io", role: "poc" }),
      poc
    );
    const pocInsert = mockTxQuery.mock.calls.find(([sql]) => /INSERT INTO client_contacts/.test(String(sql)))!;
    expect(pocInsert[1][6]).toBe("poc");
  });

  it("saves the project access chosen in the wizard with the user", async () => {
    stubTransaction([companyExists, contactInserted, [/FROM projects/, createQueryResult([{ id: PROJECT_ID }])]]);
    const res = createMockResponse();

    await ClientPortalOnboardingController.addCompanyUser(
      request({
        first_name: "Sam",
        email: "sam@x.io",
        project_access: [{ project_id: PROJECT_ID, level: "comment" }],
      }),
      res
    );

    const insert = mockTxQuery.mock.calls.find(([sql]) =>
      /INSERT INTO client_contact_project_access/.test(String(sql))
    )!;
    expect(insert[1]).toEqual([CONTACT_ID, [PROJECT_ID], ["comment"]]);
    expect(res.statusCode).toBe(201);
  });

  it("does not save the user when a chosen project is not the company's", async () => {
    stubTransaction([companyExists, contactInserted, [/FROM projects/, createQueryResult([])]]);
    const res = createMockResponse();

    await ClientPortalOnboardingController.addCompanyUser(
      request({
        first_name: "Sam",
        email: "sam@x.io",
        project_access: [{ project_id: PROJECT_ID, level: "view" }],
      }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(statements()).toContain("ROLLBACK");
  });

  it("invites after saving when asked", async () => {
    stubTransaction([companyExists, contactInserted]);
    mockInviteContact.mockResolvedValue({
      contactId: CONTACT_ID,
      email: "sam@x.io",
      delivery: "email",
      link: null,
      expiresAt: "2026-10-04T00:00:00.000Z",
      emailSent: true,
    });
    const res = createMockResponse();

    await ClientPortalOnboardingController.addCompanyUser(
      request({ first_name: "Sam", email: "sam@x.io", send_invite: true }),
      res
    );

    expect(mockInviteContact).toHaveBeenCalledWith(expect.objectContaining({ delivery: "email" }));
    expect(res.body.body.invite).toMatchObject({ requested: true, email_sent: true });
  });
});

describe("ClientPortalOnboardingController import endpoints", () => {
  it("answers a dry run with the per-row result", async () => {
    mockedQuery.mockImplementation(async () => createQueryResult([]));
    const res = createMockResponse();

    await ClientPortalOnboardingController.importValidate(
      createMockRequest({ body: { rows: [{ first_name: "A", email: "a@x.io" }] } }),
      res
    );

    expect(res.body.body.summary).toMatchObject({ total: 1, valid: 1 });
  });

  it("answers 400 for a missing or oversized file", async () => {
    const missing = createMockResponse();
    await ClientPortalOnboardingController.importCommit(createMockRequest({ body: {} }), missing);
    expect(missing.statusCode).toBe(400);

    const tooMany = createMockResponse();
    await ClientPortalOnboardingController.importValidate(
      createMockRequest({
        body: { rows: Array.from({ length: IMPORT_MAX_ROWS + 1 }, () => ({ first_name: "A", email: "a@x.io" })) },
      }),
      tooMany
    );
    expect(tooMany.statusCode).toBe(400);
  });

  it("requires a team", async () => {
    const res = createMockResponse();

    await ClientPortalOnboardingController.importCommit(createMockRequest({ user: {}, body: { rows: [] } }), res);

    expect(res.statusCode).toBe(401);
  });
});
