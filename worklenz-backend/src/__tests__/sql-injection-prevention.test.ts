import db from "../config/db";
import PtTaskStatusesController from "../controllers/project-templates/pt-task-statuses-controller";
import ReportingController from "../controllers/reporting-controller";
import ReportingMembersController from "../controllers/reporting/reporting-members-controller";
import ClientPortalServicesController from "../controllers/client-portal/client-portal-services-controller";
import ClientsController from "../controllers/clients-controller";
import { getMemberTimeSheets } from "../controllers/reporting/reporting-allocation-controller-updated";
import { createMockRequest, createMockResponse } from "../tests/utils/express-mock";

jest.mock("../shared/storage", () => ({}));
jest.mock("../config/db", () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock("../decorators/handle-exceptions", () => ({
  __esModule: true,
  default: () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) => descriptor,
}));

const injected = "x'); SELECT pg_sleep(10); --";
const queryMock = db.query as jest.MockedFunction<typeof db.query>;

const lastQuery = (): [string, unknown[]] => {
  const calls = queryMock.mock.calls;
  const [sql, params] = calls[calls.length - 1];
  return [sql, params ?? []];
};

beforeEach(() => jest.clearAllMocks());

describe("template status names", () => {
  it("binds names and identifiers without inserting them into SQL", async () => {
    queryMock.mockResolvedValue({ rows: [{ has_duplicate: false }] } as Awaited<ReturnType<typeof db.query>>);
    const req = createMockRequest({ params: { id: injected }, body: { name: injected, template_id: injected } });
    await PtTaskStatusesController.updateName(req, createMockResponse());
    const [sql, params] = lastQuery();
    expect(sql).not.toContain(injected);
    expect(params).toEqual([injected, injected, injected]);
    expect(sql).toContain("NOT EXISTS (SELECT 1 FROM duplicate)");
  });

  it("preserves the existing duplicate-name error", async () => {
    queryMock.mockResolvedValue({ rows: [{ has_duplicate: true }] } as Awaited<ReturnType<typeof db.query>>);
    await expect(PtTaskStatusesController.updateName(
      createMockRequest({ params: { id: "status" }, body: { name: "Todo", template_id: "template" } }),
      createMockResponse()
    )).rejects.toThrow("STATUS_EXISTS_ERROR:Todo");
  });
});

describe("reporting filters", () => {
  it("passes request filter arrays as bound values", async () => {
    queryMock.mockResolvedValue({ rows: [{ team_members: { total: 0, team_members: [] } }] } as Awaited<ReturnType<typeof db.query>>);
    await ReportingController.getReportingMembers(createMockRequest({ body: {
      teamId: "team", projects: [injected], status: [injected], duration: "CUSTOM",
      dateRange: ["2026-10-01", "2026-10-02"],
    } }), createMockResponse());
    expect(lastQuery()[0]).not.toContain(injected);
    expect(lastQuery()[1].slice(2, 4)).toEqual([[injected], [injected]]);
  });

  it.each(["", "name"])("binds project/status lists and custom dates with search '%s'", async (search) => {
    queryMock.mockResolvedValue({ rows: [{ team_members: { total: 0, data: [] } }] } as Awaited<ReturnType<typeof db.query>>);
    await ReportingController.getTeamMemberInsightData("team", [injected], [injected], search, "CUSTOM", "user", ["2026-10-01", "2026-10-02"]);
    const [sql, params] = lastQuery();
    expect(sql).not.toContain(injected);
    expect(params).toEqual(["team", "user", [injected], [injected], ...(search ? ["name:*"] : []), "2026-10-01", "2026-10-02"]);
    expect(sql).toContain("SELECT UNNEST($3::UUID[])");
    expect(sql).toContain(`task_work_log.created_at::DATE >= $${search ? 6 : 5}::DATE`);
  });

  it("keeps member date parameters after project and status filters", async () => {
    queryMock.mockResolvedValue({ rows: [] } as unknown as Awaited<ReturnType<typeof db.query>>);
    await ReportingController.getProjectsOfMember([injected], ["status"], ["2026-10-01", "2026-10-02"], "member", "CUSTOM");
    const [sql, params] = lastQuery();
    expect(sql).not.toContain(injected);
    expect(sql).toContain("AND task_work_log.created_at::DATE >= $4::DATE");
    expect(params).toEqual(["member", injected, "status", "2026-10-01", "2026-10-02"]);
  });

  it.each([true, false])("binds member IDs alongside search parameters (archived=%s)", async (archived) => {
    queryMock.mockResolvedValue({ rows: [] } as unknown as Awaited<ReturnType<typeof db.query>>);
    await ReportingMembersController.getMemberProjectsData("team", injected, "AND p.name ILIKE $1", ["%name%"], archived, "user");
    const [sql, params] = lastQuery();
    expect(sql).not.toContain(injected);
    expect(sql).toContain("team_member_id = $2::UUID");
    expect(params).toEqual(["%name%", injected, "user", archived]);
  });

  it("binds IDs in cross-team member lookups", async () => {
    queryMock.mockResolvedValue({ rows: [] } as unknown as Awaited<ReturnType<typeof db.query>>);
    await ReportingMembersController.getMemberProjectsData("", injected, "", [], false, "user");
    expect(lastQuery()[0]).toContain("tmiv2.team_member_id = $1::UUID");
    expect(lastQuery()[0]).not.toContain(injected);
  });

  it.each([true, false])("binds timezone timesheet filters (archived=%s)", async (archived) => {
    queryMock.mockResolvedValue({ rows: [] } as unknown as Awaited<ReturnType<typeof db.query>>);
    await getMemberTimeSheets(createMockRequest({ query: { archived: String(archived) }, body: {
      teams: [injected], projects: [injected], timezone: "UTC", date_range: ["2026-10-01", "2026-10-02"],
      billable: { billable: true, nonBillable: false },
    } }), createMockResponse());
    const [sql, params] = lastQuery();
    expect(sql).not.toContain(injected);
    expect(sql).toContain("t.billable IS TRUE");
    expect(params.slice(0, 2)).toEqual([[injected], [injected]]);
    expect(params[9]).toBe(archived);
  });
});

describe("client service sorting", () => {
  it.each([injected, "__proto__", ["name"]])("rejects unexpected sort fields %s", async (sortBy) => {
    queryMock.mockResolvedValue({ rows: [{ total: "0" }] } as Awaited<ReturnType<typeof db.query>>);
    await ClientPortalServicesController.getOrganizationServices(createMockRequest({ query: { sortBy, sortOrder: injected } }), createMockResponse());
    const sql = queryMock.mock.calls[0][0];
    expect(sql).toContain("ORDER BY s.name ASC");
    expect(sql).not.toContain(injected);
  });

  it("supports allowlisted service sorting", async () => {
    queryMock.mockResolvedValue({ rows: [{ total: "0" }] } as Awaited<ReturnType<typeof db.query>>);
    await ClientPortalServicesController.getOrganizationServices(createMockRequest({ query: { sortBy: "created_at", sortOrder: "DESC" } }), createMockResponse());
    expect(queryMock.mock.calls[0][0]).toContain("ORDER BY s.created_at DESC");
  });

  it.each([
    [ClientsController.getClientRequests, "created_at"],
    [ClientsController.getClientTickets, "created_at"],
    [ClientsController.getClientServices, "name"],
  ])("uses a fixed column for invalid admin sorting", async (handler, defaultColumn) => {
    queryMock.mockResolvedValue({ rows: [{}] } as Awaited<ReturnType<typeof db.query>>);
    await handler.call(ClientsController, createMockRequest({ query: { sortBy: injected, sortOrder: injected } }), createMockResponse());
    expect(lastQuery()[0]).not.toContain(injected);
    expect(lastQuery()[0]).toContain(`ORDER BY ${defaultColumn}`);
  });
});
