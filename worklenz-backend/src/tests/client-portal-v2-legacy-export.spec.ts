jest.mock("../config/db", () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
    connect: jest.fn(),
  },
}));

import db from "../config/db";
import PortalWorkflowController from "../controllers/client-portal/v2/portal-workflow-controller";
import {
  LEGACY_MODULES,
  exportLegacyModuleJson,
  exportLegacyTableCsv,
  isLegacyModule,
  legacyTableNames,
} from "../services/client-portal-v2/legacy-export.service";
import { createMockRequest, createMockResponse } from "./utils/express-mock";
import { createQueryResult } from "./utils/db-mock";

const mockedQuery = db.query as jest.Mock;

beforeEach(() => {
  mockedQuery.mockReset();
});

describe("legacy export: which modules and tables exist", () => {
  it("covers exactly the four retired v1 modules", () => {
    expect([...LEGACY_MODULES]).toEqual(["requests", "services", "tickets", "chats"]);
    expect(isLegacyModule("requests")).toBe(true);
    expect(isLegacyModule("invoices")).toBe(false);
    expect(isLegacyModule("client_portal_requests; DROP TABLE x")).toBe(false);
  });

  it("lists each module's tables from a fixed allow-list", () => {
    expect(legacyTableNames("chats")).toEqual(["client_portal_chat_messages"]);
    expect(legacyTableNames("requests")).toContain("client_portal_request_status_history");
  });
});

describe("legacy export: reading the data", () => {
  it("scopes every table to the workspace, and status history through its request", async () => {
    mockedQuery.mockResolvedValue(createQueryResult([]));

    await exportLegacyModuleJson("team-123", "requests");

    const sql = mockedQuery.mock.calls.map(call => String(call[0]).replace(/\s+/g, " "));
    expect(sql).toHaveLength(4);
    expect(sql.filter(text => text.includes("t.organization_team_id = $1"))).toHaveLength(3);
    expect(sql.find(text => text.includes("client_portal_request_status_history"))).toContain(
      "t.request_id IN (SELECT id FROM client_portal_requests WHERE organization_team_id = $1)"
    );
    mockedQuery.mock.calls.forEach(call => expect(call[1]).toEqual(["team-123"]));
  });

  it("returns the rows of every table keyed by table name", async () => {
    mockedQuery.mockResolvedValue(createQueryResult([{ row: { id: "a", name: "Logo design" } }]));

    const result = await exportLegacyModuleJson("team-123", "services");

    expect(result.module).toBe("services");
    expect(Object.keys(result.tables)).toEqual(["client_portal_services", "client_portal_service_option_values"]);
    expect(result.tables.client_portal_services).toEqual([{ id: "a", name: "Logo design" }]);
  });
});

describe("legacy export: CSV", () => {
  it("writes the union of columns, nested values as JSON, and neutralises spreadsheet formulas", async () => {
    mockedQuery.mockResolvedValue(
      createQueryResult([
        { row: { id: "1", subject: "=HYPERLINK(\"http://evil\")", meta: { a: 1 } } },
        { row: { id: "2", subject: "Hello", extra: null } },
      ])
    );

    const csv = await exportLegacyTableCsv("team-123", "tickets", "client_portal_tickets");
    const [header, first, second] = csv.trim().split("\r\n");

    expect(header).toBe('"id","subject","meta","extra"');
    // A leading = is prefixed with an apostrophe so it opens as text, not as a formula.
    expect(first).toContain(`"'=HYPERLINK(""http://evil"")"`);
    expect(first).toContain('"{""a"":1}"');
    expect(second).toBe('"2","Hello","",""');
  });

  it("refuses a table that is not part of the module", async () => {
    await expect(exportLegacyTableCsv("team-123", "tickets", "users")).rejects.toMatchObject({ status: 400 });
    expect(mockedQuery).not.toHaveBeenCalled();
  });
});

describe("PortalWorkflowController.legacyExport", () => {
  const run = async (params: Record<string, string>, query: Record<string, string> = {}) => {
    const res = createMockResponse();
    // The download handlers set headers with res.set(); the shared mock does not provide it.
    res.set = jest.fn().mockImplementation((headers: Record<string, string>) => {
      res.headers = headers;
      return res;
    });
    await PortalWorkflowController.legacyExport(createMockRequest({ params, query }), res);
    return res;
  };

  it("answers 400 for a module that was not retired", async () => {
    const res = await run({ module: "invoices" });
    expect(res.statusCode).toBe(400);
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it("downloads one table as a CSV file", async () => {
    mockedQuery.mockResolvedValue(createQueryResult([{ row: { id: "1" } }]));

    const res = await run({ module: "chats" }, { format: "csv" });

    expect(res.statusCode).toBe(200);
    expect(res.headers["Content-Type"]).toContain("text/csv");
    expect(res.headers["Content-Disposition"]).toContain("client-portal-chats-client_portal_chat_messages.csv");
    expect(res.headers["Cache-Control"]).toBe("no-store");
  });

  it("downloads the whole module as JSON by default", async () => {
    mockedQuery.mockResolvedValue(createQueryResult([]));

    const res = await run({ module: "services" });

    expect(res.statusCode).toBe(200);
    expect(res.headers["Content-Type"]).toContain("application/json");
    expect(JSON.parse(res.body).module).toBe("services");
  });
});
