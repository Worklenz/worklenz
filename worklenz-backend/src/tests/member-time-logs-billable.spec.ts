import ReportingMembersController from "../controllers/reporting/reporting-members-controller";
import db from "../config/db";
import { createMockRequest, createMockResponse } from "./utils/express-mock";

jest.mock("../config/db", () => ({ query: jest.fn() }));

describe("member time logs billable filter", () => {
  it("returns no logs when neither option is selected", async () => {
    const req = createMockRequest({ body: { billable: { billable: false, nonBillable: false } } });
    const res = createMockResponse();

    await ReportingMembersController.getMemberTimelogs(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.done).toBe(true);
    expect(res.body.body).toEqual([]);
    expect(db.query).not.toHaveBeenCalled();
  });

  it.each([
    [{ billable: true, nonBillable: false }, "tasks.billable IS TRUE"],
    [{ billable: false, nonBillable: true }, "tasks.billable IS FALSE"],
    [{ billable: true, nonBillable: true }, null],
  ])("preserves filtering for %j", async (billable, expectedClause) => {
    (db.query as jest.Mock).mockResolvedValueOnce({ rows: [{ timezone: "UTC" }] })
      .mockResolvedValueOnce({ rows: [] });
    const req = createMockRequest({ body: { team_id: "team", team_member_id: "member", date_range: [], billable } });
    const res = createMockResponse();

    await ReportingMembersController.getMemberTimelogs(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.body).toEqual([]);
    const query = (db.query as jest.Mock).mock.calls[1][0] as string;
    if (expectedClause) expect(query).toContain(expectedClause);
    else expect(query).not.toContain("tasks.billable IS");
  });
});
