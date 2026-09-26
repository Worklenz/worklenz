jest.mock("../cron_jobs/helpers", () => ({
  getBaseUrl: () => "https://app.worklenz.com",
}));

jest.mock("../config/db", () => ({
  __esModule: true,
  default: { query: jest.fn() },
}));

jest.unmock("../services/digest-send-policy");
jest.unmock("../services/digest-role-service");
jest.unmock("../services/digest-query-service");
jest.unmock("../services/digest-urls");
jest.unmock("../services/digest-unsubscribe");

import {
  getAdminTeamIds,
  getAssignedByMeScope,
  isAdminInAnyWorkspace,
  isPMInAnyWorkspace,
  mergeDigestRoleRows,
  WorkspaceDigestRole,
} from "../services/digest-role-service";
import { isSuccessfulDigestSend, shouldSkipEmptyDigest, skipDailyForMondayConflict } from "../services/digest-send-policy";
import {
  adminProjectJoin,
  buildDigestTaskUrl,
  mapDigestRows,
  NOT_ARCHIVED_TASK_SQL,
  notArchivedProjectFilter,
} from "../services/digest-query-service";
import { buildUnsubscribeUrl } from "../services/digest-urls";
import { unsubscribeByToken } from "../services/digest-unsubscribe";
import db from "../config/db";

const mockedDb = db as unknown as { query: jest.Mock };

describe("digest role resolution", () => {
  it("treats workspace admins as Admin with no PM project list", () => {
    const roles = mergeDigestRoleRows(
      [{ team_id: "ws-a", team_name: "Workspace A" }],
      [],
      [{ team_id: "ws-a", team_name: "Workspace A" }]
    );

    expect(roles).toEqual([
      { teamId: "ws-a", teamName: "Workspace A", isAdmin: true, pmProjectIds: [] },
    ]);
    expect(isAdminInAnyWorkspace(roles)).toBe(true);
    expect(isPMInAnyWorkspace(roles)).toBe(false);
  });

  it("treats project managers as PM when they are not workspace Admin", () => {
    const roles = mergeDigestRoleRows(
      [],
      [{ project_id: "p1", team_id: "ws-a", team_name: "Workspace A" }],
      [{ team_id: "ws-a", team_name: "Workspace A" }]
    );

    expect(roles[0].isAdmin).toBe(false);
    expect(roles[0].pmProjectIds).toEqual(["p1"]);
    expect(isPMInAnyWorkspace(roles)).toBe(true);
    expect(getAssignedByMeScope(roles)).toEqual({
      adminTeamIds: [],
      pmProjectIds: ["p1"],
    });
  });

  it("treats remaining memberships as Member", () => {
    const roles = mergeDigestRoleRows(
      [],
      [],
      [{ team_id: "ws-b", team_name: "Workspace B" }]
    );

    expect(roles).toEqual([
      { teamId: "ws-b", teamName: "Workspace B", isAdmin: false, pmProjectIds: [] },
    ]);
    expect(isAdminInAnyWorkspace(roles)).toBe(false);
    expect(isPMInAnyWorkspace(roles)).toBe(false);
  });

  it("scopes PM and Member workspaces independently in one send", () => {
    const roles = mergeDigestRoleRows(
      [],
      [{ project_id: "p1", team_id: "ws-a", team_name: "Workspace A" }],
      [
        { team_id: "ws-a", team_name: "Workspace A" },
        { team_id: "ws-b", team_name: "Workspace B" },
      ]
    );

    expect(roles).toHaveLength(2);
    const wsA = roles.find(r => r.teamId === "ws-a") as WorkspaceDigestRole;
    const wsB = roles.find(r => r.teamId === "ws-b") as WorkspaceDigestRole;
    expect(wsA.pmProjectIds).toEqual(["p1"]);
    expect(wsB.isAdmin).toBe(false);
    expect(wsB.pmProjectIds).toEqual([]);
  });

  it("reflects a promotion to Admin on the next merge without cached role", () => {
    const before = mergeDigestRoleRows(
      [],
      [{ project_id: "p1", team_id: "ws-a", team_name: "Workspace A" }],
      [{ team_id: "ws-a", team_name: "Workspace A" }]
    );
    expect(isAdminInAnyWorkspace(before)).toBe(false);

    const after = mergeDigestRoleRows(
      [{ team_id: "ws-a", team_name: "Workspace A" }],
      [{ project_id: "p1", team_id: "ws-a", team_name: "Workspace A" }],
      [{ team_id: "ws-a", team_name: "Workspace A" }]
    );

    expect(isAdminInAnyWorkspace(after)).toBe(true);
    expect(getAdminTeamIds(after)).toEqual(["ws-a"]);
  });
});

describe("digest skip and send logging policy", () => {
  it("skips daily for members when personal sections are empty", () => {
    expect(shouldSkipEmptyDigest(false, false)).toBe(true);
  });

  it("does not skip weekly emails for admins when personal sections are empty", () => {
    expect(shouldSkipEmptyDigest(false, true)).toBe(false);
  });

  it("does not skip when personal content exists", () => {
    expect(shouldSkipEmptyDigest(true, false)).toBe(false);
  });

  it("skips Monday daily only when weekly start is enabled at the same send time", () => {
    expect(skipDailyForMondayConflict(1, true, "08:00", "08:00")).toBe(true);
    expect(skipDailyForMondayConflict(1, true, "08:00", "09:00")).toBe(false);
    expect(skipDailyForMondayConflict(1, false, "08:00", "08:00")).toBe(false);
    expect(skipDailyForMondayConflict(2, true, "08:00", "08:00")).toBe(false);
  });

  it("treats only a non-empty send result as a delivered email", () => {
    expect(isSuccessfulDigestSend("ses-message-id")).toBe(true);
    expect(isSuccessfulDigestSend(null)).toBe(false);
    expect(isSuccessfulDigestSend(undefined)).toBe(false);
    expect(isSuccessfulDigestSend("")).toBe(false);
  });
});

describe("digest task URLs and archived filters", () => {
  it("deep-links tasks through the project task list", () => {
    expect(buildDigestTaskUrl("project-1", "task-1")).toBe(
      "https://app.worklenz.com/worklenz/projects/project-1?tab=tasks-list&task=task-1"
    );
  });

  it("maps weekdayLabel and falls back to No Project", () => {
    const [task] = mapDigestRows(
      [
        {
          id: "task-1",
          project_id: "project-1",
          name: "Write spec",
          project_name: null,
          workspace_name: "Acme",
          weekday_label: "Tuesday  ",
        },
      ],
      2
    );

    expect(task.taskUrl).toContain("project-1");
    expect(task.taskUrl).toContain("task=task-1");
    expect(task.projectName).toBe("No Project");
    expect(task.workspaceName).toBe("Acme");
    expect(task.weekdayLabel).toBe("Tuesday");
  });

  it("excludes archived tasks and user-archived projects from personal sections", () => {
    expect(NOT_ARCHIVED_TASK_SQL).toBe("t.archived IS FALSE");
    expect(notArchivedProjectFilter("$1")).toContain("archived_projects");
    expect(notArchivedProjectFilter("$1")).toContain("user_id = $1");
  });

  it("does not apply the viewer's personal archive to admin team totals", () => {
    const joinSql = adminProjectJoin();
    expect(joinSql).toContain("t.archived IS FALSE");
    expect(joinSql).not.toContain("archived_projects");
  });
});

describe("digest unsubscribe", () => {
  it("builds a public unsubscribe URL that does not require login", () => {
    const url = buildUnsubscribeUrl("abc123");
    expect(url).toBe("https://app.worklenz.com/public/digest/unsubscribe?token=abc123");
    expect(url).not.toContain("/api/v1/");
  });

  it("disables all three digest types without a session", async () => {
    mockedDb.query
      .mockResolvedValueOnce({ rows: [{ user_id: "user-1", used_at: null }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await unsubscribeByToken("abc123");

    expect(result).toBe("ok");
    const updateSql = mockedDb.query.mock.calls[1][0] as string;
    expect(updateSql).toMatch(/daily_enabled = FALSE/);
    expect(updateSql).toMatch(/weekly_start_enabled = FALSE/);
    expect(updateSql).toMatch(/weekly_end_enabled = FALSE/);
    expect(mockedDb.query.mock.calls[1][1]).toEqual(["user-1"]);
  });
});
