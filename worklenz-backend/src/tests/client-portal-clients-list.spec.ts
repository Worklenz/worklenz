jest.mock("../config/db", () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

jest.mock("../services/token-service", () => ({
  __esModule: true,
  default: {},
}));

jest.mock("../shared/email", () => ({
  __esModule: true,
  sendEmail: jest.fn(),
  sendEmailEnhanced: jest.fn(),
  EmailRequest: jest.fn(),
}));

import db from "../config/db";
import ClientPortalClientsController from "../controllers/client-portal/client-portal-clients-controller";
import { createMockRequest, createMockResponse } from "./utils/express-mock";
import { createQueryResult } from "./utils/db-mock";

const mockedQuery = db.query as jest.Mock;

const clientRow = (overrides: Record<string, unknown> = {}) => ({
  id: "client-1",
  name: "Brandbase",
  email: "alex@brandbase.com",
  company_name: "Brandbase Ltd",
  phone: null,
  phone_country_code: null,
  address: null,
  contact_person: "Alex Chen",
  status: "active",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  assigned_projects_count: "2",
  has_portal_access: false,
  invitation_sent_at: null,
  invitation_expires_at: null,
  invitation_accepted: null,
  poc_names: [],
  last_login_at: null,
  portal_status_key: "not_invited",
  ...overrides,
});

// NOTE: the controller appends LIMIT/OFFSET to the same params array after the count query ran, so
// a recorded count call also lists them; assertions on its params only look at the filter values.
const countCall = () => mockedQuery.mock.calls.find(([sql]) => String(sql).includes("COUNT(*) as total"))!;
const dataCall = () => mockedQuery.mock.calls.find(([sql]) => String(sql).includes("portal_status_key"))!;

describe("ClientPortalClientsController.getClients", () => {
  beforeEach(() => {
    mockedQuery.mockReset();
    mockedQuery.mockImplementation(async (sql: string) =>
      String(sql).includes("COUNT(*) as total")
        ? createQueryResult([{ total: "1" }])
        : createQueryResult([clientRow()])
    );
  });

  it("filters a portal status on the derived status, before paging", async () => {
    const res = createMockResponse();

    await ClientPortalClientsController.getClients(
      createMockRequest({ query: { status: "expired", page: "2", limit: "5" } }),
      res
    );

    const [countSql, countParams] = countCall();
    // Expiry follows the invitation's own expires_at, so a resend restarts the window.
    expect(countSql).toContain("invitation_expires_at > NOW()");
    expect(countSql).toMatch(/\) = \$2/);
    expect(countParams.slice(0, 2)).toEqual(["team-123", "expired"]);

    const [dataSql, dataParams] = dataCall();
    expect(dataSql).toMatch(/\) = \$2[\s\S]*LIMIT \$3 OFFSET \$4/);
    expect(dataParams).toEqual(["team-123", "expired", 5, 5]);
  });

  it("treats 'active' as a portal status, not as a client status", async () => {
    await ClientPortalClientsController.getClients(
      createMockRequest({ query: { status: "active" } }),
      createMockResponse()
    );

    const [countSql, countParams] = countCall();
    expect(countSql).not.toContain("LOWER(COALESCE(c.status");
    expect(countParams.slice(0, 2)).toEqual(["team-123", "active"]);
  });

  it.each(["inactive", "pending"])("still filters the client status '%s'", async status => {
    await ClientPortalClientsController.getClients(
      createMockRequest({ query: { status } }),
      createMockResponse()
    );

    const [countSql, countParams] = countCall();
    expect(countSql).toContain("LOWER(COALESCE(c.status, 'active')) = $2");
    expect(countParams.slice(0, 2)).toEqual(["team-123", status]);
    expect(countSql).not.toMatch(/\) = \$3/);
  });

  it("ignores an unknown status instead of filtering on it", async () => {
    await ClientPortalClientsController.getClients(
      createMockRequest({ query: { status: "bogus; DROP TABLE clients" } }),
      createMockResponse()
    );

    const [countSql, countParams] = countCall();
    expect(countSql).not.toContain("DROP TABLE");
    // Only the team is bound; the next values are the paging params appended afterwards.
    expect(countParams.slice(0, 1)).toEqual(["team-123"]);
    expect(countParams).toHaveLength(3);
  });

  it("orders by id after the sort column so pages never overlap", async () => {
    await ClientPortalClientsController.getClients(
      createMockRequest({ query: { sortBy: "assigned_projects_count", sortOrder: "desc" } }),
      createMockResponse()
    );

    const [dataSql] = dataCall();
    expect(dataSql).toContain("ORDER BY assigned_projects_count DESC, id ASC");
  });

  it("returns the derived portal status and last sign-in for each client", async () => {
    mockedQuery.mockImplementation(async (sql: string) =>
      String(sql).includes("COUNT(*) as total")
        ? createQueryResult([{ total: "2" }])
        : createQueryResult([
            clientRow({
              id: "a",
              has_portal_access: true,
              last_login_at: "2026-05-01T10:00:00.000Z",
              portal_status_key: "active",
            }),
            clientRow({
              id: "b",
              invitation_sent_at: "2026-04-01T10:00:00.000Z",
              invitation_accepted: false,
              portal_status_key: "expired",
            }),
          ])
    );
    const res = createMockResponse();

    await ClientPortalClientsController.getClients(createMockRequest(), res);

    const { clients, total } = res.body.body;
    expect(total).toBe(2);
    expect(clients[0]).toMatchObject({
      id: "a",
      portal_status: { status: "active", label: "Active", color: "green" },
      last_login_at: "2026-05-01T10:00:00.000Z",
      assigned_projects_count: 2,
      contact_person: "Alex Chen",
    });
    expect(clients[1].portal_status).toEqual({ status: "expired", label: "Expired", color: "red" });
    expect(clients[1].last_login_at).toBeNull();
  });
});

describe("ClientPortalClientsController.getClientsStats", () => {
  beforeEach(() => {
    mockedQuery.mockReset();
  });

  it("requires an authenticated team", async () => {
    const res = createMockResponse();

    await ClientPortalClientsController.getClientsStats(
      createMockRequest({ user: { id: "user-123" } }),
      res
    );

    expect(res.statusCode).toBe(401);
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it("counts clients by portal status and unanswered messages for the caller's team", async () => {
    mockedQuery.mockImplementation(async (sql: string) =>
      String(sql).includes("unanswered_messages")
        ? createQueryResult([{ unanswered_messages: 6 }])
        : createQueryResult([{ total: 48, active: 4, invited: 1, expired: 3, not_invited: 40 }])
    );
    const res = createMockResponse();

    await ClientPortalClientsController.getClientsStats(createMockRequest(), res);

    expect(res.body.body).toEqual({
      total: 48,
      active: 4,
      invited: 1,
      expired: 3,
      not_invited: 40,
      unanswered_messages: 6,
    });
    expect(mockedQuery).toHaveBeenCalledTimes(2);
    mockedQuery.mock.calls.forEach(([, params]) => expect(params).toEqual(["team-123"]));

    // The status definition must be the one the list filters on.
    const [clientsSql] = mockedQuery.mock.calls.find(([sql]) => String(sql).includes("classified"))!;
    expect(clientsSql).toContain("invitation_expires_at > NOW()");
    // A user an admin disabled must not make the company look Active.
    expect(clientsSql).toContain("cc.disabled_at IS NOT NULL");
  });

  it("returns zeros for a team with no clients or messages", async () => {
    mockedQuery.mockResolvedValue(createQueryResult([]));
    const res = createMockResponse();

    await ClientPortalClientsController.getClientsStats(createMockRequest(), res);

    expect(res.body.body).toEqual({
      total: 0,
      active: 0,
      invited: 0,
      expired: 0,
      not_invited: 0,
      unanswered_messages: 0,
    });
  });

  it("reports a failure instead of throwing", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    mockedQuery.mockRejectedValue(new Error("db down"));
    const res = createMockResponse();

    await ClientPortalClientsController.getClientsStats(createMockRequest(), res);

    expect(res.statusCode).toBe(500);
    expect(res.body.done).toBe(false);
  });
});
