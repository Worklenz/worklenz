jest.mock("../config/db", () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock("../shared/entitlements/gates", () => ({ teamCanUseFeature: jest.fn() }));

import db from "../config/db";
import { teamCanUseFeature } from "../shared/entitlements/gates";
import { checkPhaseCompletionGuard } from "../shared/phase-completion-guard";

describe("phase completion after a plan change", () => {
  beforeEach(() => {
    jest.mocked(db.query).mockResolvedValue({ rows: [{
      team_id: "team",
      is_done_status: true,
      phase_assignees_enabled: true,
      phase_assignee_team_member_id: "assignee",
      current_user_team_member_id: "other",
      phase_assignee_name: "Assignee",
      is_admin_or_owner: false,
    }] } as never);
  });

  it("does not block task completion when the team loses the feature", async () => {
    jest.mocked(teamCanUseFeature).mockResolvedValue(false);
    expect(await checkPhaseCompletionGuard("user", "task", "done")).toEqual({ blocked: false, blockerName: null });
  });

  it("continues enforcing the assignee restriction for eligible teams", async () => {
    jest.mocked(teamCanUseFeature).mockResolvedValue(true);
    expect(await checkPhaseCompletionGuard("user", "task", "done")).toEqual({ blocked: true, blockerName: "Assignee" });
  });
});
