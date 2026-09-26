/**
 * TVR-19 — Permission matrix for `restrict_tasks_to_assignee`.
 *
 * Covers acceptance criteria:
 *   roles  ×  Owner | Admin | Team Lead | Member | Guest (| Project Manager)
 *   views  ×  List | Board | Roadmap | Calendar | search  (shared filter contract)
 *   states ×  assigned | unassigned | subtask-only parent | multi-assignee
 *
 * True browser e2e is not in this repo; these tests lock the server-side helper
 * every in-scope view calls (TasksControllerV2, GanttController, HomePage /
 * Calendar, tasks quick-search).
 */

jest.unmock("../shared/assignee-task-scope");
jest.unmock("../shared/team-permissions");

jest.mock("../config/db", () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

import db from "../config/db";
import { IPassportSession } from "../interfaces/passport-session";
import {
  ASSIGNEE_SCOPE_EXCLUDED_SURFACES,
  buildAssigneeScopeFilter,
  buildAssigneeScopeReadonlyExpression,
  buildAssigneeVisibleTasksClause,
  buildMultiProjectAssigneeScopeClause,
  canUserAccessTaskDetail,
  canUserEditTask,
  canUserViewTask,
  isAssigneeScopeReadonlyForTask,
  isAssigneeScopeSessionExempt,
  resolveAssigneeTaskScope,
} from "../shared/assignee-task-scope";

const mockedDb = db as jest.Mocked<typeof db>;

const USER_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const TASK_ID = "33333333-3333-4333-8333-333333333333";
const TEAM_MEMBER_ID = "44444444-4444-4444-8444-444444444444";

const mockQueryResult = (rows: Record<string, unknown>[]) =>
  ({
    rows,
    rowCount: rows.length,
    command: "",
    oid: 0,
    fields: [],
  }) as any;

const session = (
  overrides: Partial<IPassportSession> = {}
): IPassportSession =>
  ({
    id: USER_ID,
    team_member_id: TEAM_MEMBER_ID,
    owner: false,
    is_admin: false,
    role_name: "Member",
    is_guest: false,
    ...overrides,
  }) as IPassportSession;

describe("TVR-19 assignee-scope permission matrix", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("role matrix — session exemption (TVR-17)", () => {
    it.each([
      ["Owner", session({ owner: true, role_name: "Owner" }), true],
      ["Admin", session({ is_admin: true, role_name: "Admin" }), true],
      ["Team Lead", session({ role_name: "Team Lead" }), true],
      ["Guest", session({ is_guest: true, role_name: "Member" }), true],
      ["Member", session({ role_name: "Member" }), false],
    ] as const)("%s → sessionExempt=%s", (_label, user, expected) => {
      expect(isAssigneeScopeSessionExempt(user)).toBe(expected);
    });

    it("treats Team Lead role_name case-insensitively via normalize", () => {
      expect(
        isAssigneeScopeSessionExempt(session({ role_name: "team lead" }))
      ).toBe(true);
    });
  });

  describe("role matrix — resolveAssigneeTaskScope when setting ON", () => {
    it("Owner/Admin/Team Lead/Guest never apply filter (session short-circuit)", async () => {
      const roles = [
        session({ owner: true, role_name: "Owner" }),
        session({ is_admin: true, role_name: "Admin" }),
        session({ role_name: "Team Lead" }),
        session({ is_guest: true }),
      ];

      for (const user of roles) {
        const scope = await resolveAssigneeTaskScope(USER_ID, PROJECT_ID, user);
        expect(scope.applyFilter).toBe(false);
        expect(mockedDb.query).not.toHaveBeenCalled();
        mockedDb.query.mockClear();
      }
    });

    it("Member applies filter when setting ON and not PM/guest/privileged in DB", async () => {
      mockedDb.query.mockResolvedValueOnce(
        mockQueryResult([
          {
            restrict_on: true,
            team_member_id: TEAM_MEMBER_ID,
            is_privileged_role: false,
            is_guest: false,
            is_project_manager: false,
          },
        ])
      );

      const scope = await resolveAssigneeTaskScope(
        USER_ID,
        PROJECT_ID,
        session({ role_name: "Member" })
      );

      expect(scope).toEqual({
        applyFilter: true,
        teamMemberId: TEAM_MEMBER_ID,
      });
    });

    it("Project Manager bypasses via DB even as Member session", async () => {
      mockedDb.query.mockResolvedValueOnce(
        mockQueryResult([
          {
            restrict_on: true,
            team_member_id: TEAM_MEMBER_ID,
            is_privileged_role: false,
            is_guest: false,
            is_project_manager: true,
          },
        ])
      );

      const scope = await resolveAssigneeTaskScope(
        USER_ID,
        PROJECT_ID,
        session({ role_name: "Member" })
      );

      expect(scope.applyFilter).toBe(false);
    });

    it("DB-backed Team Lead / Guest bypass when session is incomplete", async () => {
      mockedDb.query.mockResolvedValueOnce(
        mockQueryResult([
          {
            restrict_on: true,
            team_member_id: TEAM_MEMBER_ID,
            is_privileged_role: true,
            is_guest: false,
            is_project_manager: false,
          },
        ])
      );

      const scope = await resolveAssigneeTaskScope(
        USER_ID,
        PROJECT_ID,
        session({ role_name: "Member" })
      );
      expect(scope.applyFilter).toBe(false);

      mockedDb.query.mockResolvedValueOnce(
        mockQueryResult([
          {
            restrict_on: true,
            team_member_id: TEAM_MEMBER_ID,
            is_privileged_role: false,
            is_guest: true,
            is_project_manager: false,
          },
        ])
      );
      const guestScope = await resolveAssigneeTaskScope(
        USER_ID,
        PROJECT_ID,
        session({ role_name: "Member" })
      );
      expect(guestScope.applyFilter).toBe(false);
    });

    it("setting OFF → no filter for Member", async () => {
      mockedDb.query.mockResolvedValueOnce(
        mockQueryResult([
          {
            restrict_on: false,
            team_member_id: TEAM_MEMBER_ID,
            is_privileged_role: false,
            is_guest: false,
            is_project_manager: false,
          },
        ])
      );

      const scope = await resolveAssigneeTaskScope(
        USER_ID,
        PROJECT_ID,
        session({ role_name: "Member" })
      );
      expect(scope.applyFilter).toBe(false);
    });
  });

  describe("view contract — shared filter used by List/Board/Roadmap/Calendar/search", () => {
    const restrictedScope = {
      applyFilter: true,
      teamMemberId: TEAM_MEMBER_ID,
    };

    it("List/Board/Roadmap single-project filter binds team member and visible clause", () => {
      const filter = buildAssigneeScopeFilter(restrictedScope, "t.id", 2);
      expect(filter.params).toEqual([TEAM_MEMBER_ID]);
      expect(filter.clause).toContain("tasks_assignees");
      expect(filter.clause).toContain("$2::UUID");
      expect(filter.clause).toContain("parent_task_id");
    });

    it("exempt scope yields empty clause for all single-project views", () => {
      expect(
        buildAssigneeScopeFilter(
          { applyFilter: false, teamMemberId: TEAM_MEMBER_ID },
          "t.id",
          2
        )
      ).toEqual({ clause: "", params: [] });
    });

    it("Calendar / search multi-project clause skips for privileged session", () => {
      expect(buildMultiProjectAssigneeScopeClause("t.id", 2, true)).toBe("");
    });

    it("Calendar / search multi-project clause includes Guest + privileged role + assignee visibility", () => {
      const clause = buildMultiProjectAssigneeScopeClause("t.id", 2, false);
      expect(clause).toContain("restrict_tasks_to_assignee");
      expect(clause).toContain("'Owner', 'Admin', 'Team Lead'");
      expect(clause).toContain("is_guest = TRUE");
      expect(clause).toContain("'GUEST'");
      expect(clause).toContain("'PROJECT_MANAGER'");
      expect(clause).toContain("tasks_assignees");
    });

    it("visible-tasks clause covers assigned task OR parent of assigned subtask", () => {
      const clause = buildAssigneeVisibleTasksClause("t.id", 3);
      expect(clause).toMatch(/task_id FROM tasks_assignees/);
      expect(clause).toMatch(/parent_task_id/);
      expect(clause).toContain("$3::UUID");
    });
  });

  describe("task state matrix — Member with restrict ON", () => {
    const member = session({ role_name: "Member" });

    const mockViewRow = (overrides: Record<string, unknown>) => {
      mockedDb.query.mockResolvedValueOnce(
        mockQueryResult([
          {
            restrict_on: true,
            team_member_id: TEAM_MEMBER_ID,
            is_guest: false,
            is_privileged_role: false,
            is_project_manager: false,
            is_visible: false,
            is_directly_assigned: false,
            is_parent_of_assigned_subtask: false,
            ...overrides,
          },
        ])
      );
    };

    it("assigned → can view and edit", async () => {
      mockViewRow({ is_visible: true, is_directly_assigned: true });
      expect(await canUserViewTask(USER_ID, TASK_ID, member)).toBe(true);

      mockViewRow({ is_directly_assigned: true });
      expect(await canUserEditTask(USER_ID, TASK_ID, member)).toBe(true);
    });

    it("unassigned → cannot view or edit", async () => {
      mockViewRow({ is_visible: false, is_directly_assigned: false });
      expect(await canUserViewTask(USER_ID, TASK_ID, member)).toBe(false);

      mockViewRow({ is_directly_assigned: false });
      expect(await canUserEditTask(USER_ID, TASK_ID, member)).toBe(false);
    });

    it("subtask-only (parent of assigned subtask) → view yes, edit no, readonly yes", async () => {
      mockViewRow({
        is_visible: true,
        is_directly_assigned: false,
        is_parent_of_assigned_subtask: true,
      });
      expect(await canUserViewTask(USER_ID, TASK_ID, member)).toBe(true);

      mockViewRow({
        is_directly_assigned: false,
        is_parent_of_assigned_subtask: true,
      });
      expect(await canUserEditTask(USER_ID, TASK_ID, member)).toBe(false);

      mockViewRow({
        is_directly_assigned: false,
        is_parent_of_assigned_subtask: true,
      });
      expect(
        await isAssigneeScopeReadonlyForTask(USER_ID, TASK_ID, member)
      ).toBe(true);
    });

    it("multi-assignee (member is one of several) → view and edit", async () => {
      // Visibility SQL is OR over tasks_assignees — any match is enough.
      mockViewRow({ is_visible: true, is_directly_assigned: true });
      expect(await canUserViewTask(USER_ID, TASK_ID, member)).toBe(true);

      mockViewRow({ is_directly_assigned: true });
      expect(await canUserEditTask(USER_ID, TASK_ID, member)).toBe(true);

      const visible = buildAssigneeVisibleTasksClause("t.id", 1);
      expect(visible).toContain("tasks_assignees WHERE team_member_id");
    });

    it("readonly SQL expression matches parent-of-subtask-only case", () => {
      const expr = buildAssigneeScopeReadonlyExpression("t.id", 2);
      expect(expr).toContain("NOT EXISTS");
      expect(expr).toContain("tasks_assignees");
      expect(expr).toContain("parent_task_id");
    });
  });

  describe("notification / mention deep-link exception (TVR-12)", () => {
    const member = session({ role_name: "Member" });

    it("denies detail access without visibility or notification proof", async () => {
      mockedDb.query
        .mockResolvedValueOnce(
          mockQueryResult([
            {
              restrict_on: true,
              is_guest: false,
              is_privileged_role: false,
              is_project_manager: false,
              is_visible: false,
            },
          ])
        )
        .mockResolvedValueOnce(mockQueryResult([{ has_access: false }]));

      expect(
        await canUserAccessTaskDetail(USER_ID, TASK_ID, member, {
          requireNotificationLink: true,
          notificationLinkFrom: "notification",
        })
      ).toBe(false);
    });

    it("allows detail access with notification proof + from=notification", async () => {
      mockedDb.query
        .mockResolvedValueOnce(
          mockQueryResult([
            {
              restrict_on: true,
              is_guest: false,
              is_privileged_role: false,
              is_project_manager: false,
              is_visible: false,
            },
          ])
        )
        .mockResolvedValueOnce(mockQueryResult([{ has_access: true }]));

      expect(
        await canUserAccessTaskDetail(USER_ID, TASK_ID, member, {
          requireNotificationLink: true,
          notificationLinkFrom: "notification",
        })
      ).toBe(true);
    });

    it("blocks notification proof when deep-link from is missing", async () => {
      mockedDb.query
        .mockResolvedValueOnce(
          mockQueryResult([
            {
              restrict_on: true,
              is_guest: false,
              is_privileged_role: false,
              is_project_manager: false,
              is_visible: false,
            },
          ])
        )
        .mockResolvedValueOnce(mockQueryResult([{ has_access: true }]));

      expect(
        await canUserAccessTaskDetail(USER_ID, TASK_ID, member, {
          requireNotificationLink: true,
          notificationLinkFrom: null,
        })
      ).toBe(false);
    });
  });

  describe("privileged roles always see/edit any task", () => {
    it.each([
      ["Owner", session({ owner: true, role_name: "Owner" })],
      ["Admin", session({ is_admin: true, role_name: "Admin" })],
      ["Team Lead", session({ role_name: "Team Lead" })],
      ["Guest", session({ is_guest: true })],
    ] as const)("%s bypasses view/edit without DB visibility check", async (_label, user) => {
      expect(await canUserViewTask(USER_ID, TASK_ID, user)).toBe(true);
      expect(await canUserEditTask(USER_ID, TASK_ID, user)).toBe(true);
      expect(mockedDb.query).not.toHaveBeenCalled();
    });
  });

  describe("TVR-18 excluded surfaces", () => {
    it("documents Reports / Workload / Insights as out of scope", () => {
      expect(ASSIGNEE_SCOPE_EXCLUDED_SURFACES).toEqual(
        expect.arrayContaining([
          "reports",
          "team-lead-reports",
          "workload",
          "project-insights",
          "project-overview-dashboard",
        ])
      );
    });
  });
});
