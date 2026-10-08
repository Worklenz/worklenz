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

const CLIENT_ID = "22222222-2222-4222-8222-222222222222";

type Route = [RegExp, unknown[]];

/** Answers each statement by what it selects from; anything unlisted returns no rows. */
const stubQueries = (routes: Route[]) => {
  mockedQuery.mockImplementation(async (sql: string) => {
    const match = routes.find(([pattern]) => pattern.test(String(sql)));
    return createQueryResult((match?.[1] as any[]) ?? []);
  });
};

const request = () => createMockRequest({ params: { id: CLIENT_ID } });

beforeEach(() => {
  mockedQuery.mockReset();
});

describe("ClientPortalClientsController.getClientStats", () => {
  // First match wins, and the portal status query mentions client_contacts and client_users inside
  // its own subqueries, so it is listed before the routes that would otherwise claim it.
  const baseRoutes = (): Route[] => [
    [/portal_status_key/, [{ portal_status_key: "invited", invitation_sent_at: "2026-09-20T08:00:00.000Z" }]],
    [/SELECT id FROM clients WHERE id/, [{ id: CLIENT_ID }]],
    [/COUNT\(\*\) as total_projects/, [{ total_projects: "3", active_projects: "2", completed_projects: "1" }]],
    [/FROM client_contacts/, [{ total: 3, enabled: 2 }]],
    [/FROM client_portal_requests/, [{ total: 5, pending: 2 }]],
    [/COUNT\(\*\) FILTER \(WHERE status IN \('sent', 'pending', 'overdue'\) AND payment_status/, [{ total: 6, due: 2 }]],
    [/GROUP BY currency/, [{ currency: "USD", amount: 1500.5 }, { currency: "EUR", amount: 200 }]],
    [/AS open_tasks/, [{ open_tasks: 7 }]],
    [/AS unanswered/, [{ unanswered: 4 }]],
    [/FROM client_users WHERE client_id/, [{ last_login_at: "2026-09-01T10:00:00.000Z", signed_in: 1 }]],
  ];

  it("returns the numbers the workspace shows, read from real data", async () => {
    stubQueries(baseRoutes());
    const res = createMockResponse();

    await ClientPortalClientsController.getClientStats(request(), res);

    expect(res.body.body).toMatchObject({
      tasksOpen: 7,
      invoicesDue: 2,
      unansweredMessages: 4,
      totalTeamMembers: 3,
      activeTeamMembers: 2,
      totalRequests: 5,
      pendingRequests: 2,
      lastLoginAt: "2026-09-01T10:00:00.000Z",
      hasSignedIn: true,
      portalStatus: { status: "invited", label: "Invited" },
      invitedAt: "2026-09-20T08:00:00.000Z",
    });
  });

  it("keeps the older keys existing consumers read", async () => {
    stubQueries(baseRoutes());
    const res = createMockResponse();

    await ClientPortalClientsController.getClientStats(request(), res);

    expect(res.body.body).toMatchObject({
      totalProjects: 3,
      activeProjects: 2,
      completedProjects: 1,
      totalInvoices: 6,
      unpaidInvoices: 2,
    });
  });

  it("reports what is owed per currency and never adds currencies together", async () => {
    stubQueries(baseRoutes());
    const res = createMockResponse();

    await ClientPortalClientsController.getClientStats(request(), res);

    expect(res.body.body.outstanding).toEqual([
      { currency: "USD", amount: 1500.5 },
      { currency: "EUR", amount: 200 },
    ]);
  });

  it("counts an invoice as due once it is sent, not while it is a draft, and only for this team", async () => {
    stubQueries(baseRoutes());

    await ClientPortalClientsController.getClientStats(request(), createMockResponse());

    const invoiceCall = mockedQuery.mock.calls.find(([sql]) =>
      /FROM client_portal_invoices/.test(String(sql)) && /FILTER/.test(String(sql))
    )!;
    expect(String(invoiceCall[0])).toContain("status IN ('sent', 'pending', 'overdue') AND payment_status <> 'paid'");
    expect(invoiceCall[1]).toEqual([CLIENT_ID, "team-123"]);
  });

  it("does not count archived or finished tasks as open", async () => {
    stubQueries(baseRoutes());

    await ClientPortalClientsController.getClientStats(request(), createMockResponse());

    const taskCall = mockedQuery.mock.calls.find(([sql]) => /AS open_tasks/.test(String(sql)))!;
    expect(String(taskCall[0])).toContain("t.archived IS FALSE");
    expect(String(taskCall[0])).toContain("COALESCE(tsc.is_done, FALSE) = FALSE");
    expect(taskCall[1]).toEqual([CLIENT_ID, "team-123"]);
  });

  it("uses the same unanswered rule as the Clients page: client messages after the last team reply", async () => {
    stubQueries(baseRoutes());

    await ClientPortalClientsController.getClientStats(request(), createMockResponse());

    const messageCall = mockedQuery.mock.calls.find(([sql]) => /AS unanswered/.test(String(sql)))!;
    expect(String(messageCall[0])).toContain("m.sender_type = 'client'");
    expect(String(messageCall[0])).toContain("sender_type = 'team_member'");
  });

  it("falls back to zeros and Not invited for a client with no data", async () => {
    stubQueries([[/SELECT id FROM clients WHERE id/, [{ id: CLIENT_ID }]]]);
    const res = createMockResponse();

    await ClientPortalClientsController.getClientStats(request(), res);

    expect(res.body.body).toMatchObject({
      tasksOpen: 0,
      invoicesDue: 0,
      unansweredMessages: 0,
      outstanding: [],
      lastLoginAt: null,
      hasSignedIn: false,
      portalStatus: { status: "not_invited" },
    });
  });

  it("returns 404 for a client outside the team", async () => {
    stubQueries([]);
    const res = createMockResponse();

    await ClientPortalClientsController.getClientStats(request(), res);

    expect(res.statusCode).toBe(404);
  });
});

describe("ClientPortalClientsController.getClientProjects", () => {
  it("includes the end date and health the workspace lists", async () => {
    stubQueries([
      [/SELECT id FROM clients WHERE id/, [{ id: CLIENT_ID }]],
      [/COUNT\(\*\) as total/, [{ total: "1" }]],
      [
        /FROM projects p/,
        [
          {
            id: "p1",
            name: "Website",
            notes: null,
            status_name: "In Progress",
            status_color: "#70a6f3",
            end_date: "2026-11-01T00:00:00.000Z",
            health_name: "At Risk",
            health_color: "#f37070",
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-02T00:00:00.000Z",
            total_tasks: "10",
            completed_tasks: "4",
          },
        ],
      ],
    ]);
    const res = createMockResponse();

    await ClientPortalClientsController.getClientProjects(request(), res);

    expect(res.body.body.projects[0]).toMatchObject({
      id: "p1",
      end_date: "2026-11-01T00:00:00.000Z",
      health_name: "At Risk",
      health_color: "#f37070",
      total_tasks: 10,
      completed_tasks: 4,
    });
    const dataSql = String(mockedQuery.mock.calls.find(([sql]) => /sph\.name/.test(String(sql)))![0]);
    expect(dataSql).toContain("LEFT JOIN sys_project_healths sph");
  });
});

describe("ClientPortalClientsController.getClientActivity", () => {
  it("words chat activity from the team's side", async () => {
    stubQueries([[/SELECT id, name FROM clients WHERE id/, [{ id: CLIENT_ID, name: "Brandbase" }]]]);

    await ClientPortalClientsController.getClientActivity(request(), createMockResponse());

    const chatCall = mockedQuery.mock.calls.find(([sql]) => /'chat_message' as activity_type/.test(String(sql)))!;
    const sql = String(chatCall[0]);
    expect(sql).toContain("'Client sent a message'");
    expect(sql).not.toContain("'You sent a message'");
  });
});
