jest.mock("../config/db", () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

jest.mock("../shared/team-permissions", () => ({
  isTeamLead: jest.fn(),
}));

import db from "../config/db";
import { isTeamLead } from "../shared/team-permissions";
import ReportingControllerBase from "../controllers/reporting/reporting-controller-base";

describe("ReportingControllerBase.buildProjectFilterForTeamLead", () => {
  it("binds assigned project IDs instead of interpolating them into SQL", async () => {
    const assignedProjectIds = ["project-1' OR TRUE --"];
    (isTeamLead as jest.Mock).mockResolvedValue(true);
    (db.query as jest.Mock).mockResolvedValue({
      rows: assignedProjectIds.map(project_id => ({ project_id })),
    });

    const filter = await ReportingControllerBase.buildProjectFilterForTeamLead(
      { user: { id: "user-1", team_id: "team-1" } } as any,
      4,
    );

    expect(filter).toEqual({
      clause: "AND p.id = ANY($4::UUID[])",
      params: [assignedProjectIds],
    });
    expect(filter.clause).not.toContain(assignedProjectIds[0]);
  });
});