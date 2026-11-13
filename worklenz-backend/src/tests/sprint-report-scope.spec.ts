import {
  buildSprintMembershipPredicate,
  buildSprintScopeIdsCte,
  buildSprintScopeTasksFrom,
} from "../shared/sprint-report-scope";

interface FixtureTask {
  id: string;
  parent_task_id: string | null;
  /** When set, the task has its own task_phase row for that sprint id. */
  phase_id: string | null;
  archived?: boolean;
}

/**
 * Mirrors `buildSprintScopeIdsCte` / `buildSprintScopeTasksFrom` membership rules
 * so regressions for inherited sprint membership and multi-level descendants are
 * caught without a live Postgres fixture.
 */
function resolveSprintScope(tasks: FixtureTask[], sprintId: string): string[] {
  const byId = new Map(tasks.map(task => [task.id, task]));
  const hasOwnPhase = (id: string) => byId.get(id)?.phase_id != null;
  const members = new Set(
    tasks.filter(task => task.phase_id === sprintId && !task.archived).map(task => task.id)
  );

  let grew = true;
  while (grew) {
    grew = false;
    for (const task of tasks) {
      if (task.archived || members.has(task.id) || hasOwnPhase(task.id)) continue;
      if (task.parent_task_id && members.has(task.parent_task_id)) {
        members.add(task.id);
        grew = true;
      }
    }
  }

  return [...members].sort();
}

describe("sprint report scope SQL helpers", () => {
  it("builds a recursive CTE seeded from task_phase with descendant inheritance", () => {
    const cte = buildSprintScopeIdsCte("$2", "sprint_scope");

    expect(cte.startsWith("sprint_scope AS (")).toBe(true);
    expect(cte).toContain("FROM task_phase tp");
    expect(cte).toContain("WHERE tp.phase_id = $2");
    expect(cte).toContain("child.parent_task_id = ss.id");
    expect(cte).toContain("NOT EXISTS (SELECT 1 FROM task_phase own WHERE own.task_id = child.id)");
  });

  it("builds a membership predicate that uses the recursive CTE", () => {
    const predicate = buildSprintMembershipPredicate("t", "$2");

    expect(predicate).toContain("t.id IN (");
    expect(predicate).toContain("WITH RECURSIVE");
    expect(predicate).toContain("parent_task_id");
    expect(predicate).toContain("NOT EXISTS (SELECT 1 FROM task_phase own");
  });

  it("builds a tasks FROM fragment that expands inherited descendants", () => {
    const from = buildSprintScopeTasksFrom("pp.id");

    expect(from.startsWith("WITH RECURSIVE sprint_scope AS")).toBe(true);
    expect(from).toContain("WHERE tp.phase_id = pp.id");
    expect(from).toContain("INNER JOIN sprint_scope ss ON child.parent_task_id = ss.id");
    expect(from).toContain("NOT EXISTS (SELECT 1 FROM task_phase own WHERE own.task_id = child.id)");
  });
});

describe("inherited sprint membership (multi-level descendants)", () => {
  const SPRINT = "sprint-a";
  const OTHER = "sprint-b";

  it("includes parent, child, and grandchild when only the parent has a task_phase row", () => {
    const scope = resolveSprintScope(
      [
        {id: "parent", parent_task_id: null, phase_id: SPRINT},
        {id: "child", parent_task_id: "parent", phase_id: null},
        {id: "grandchild", parent_task_id: "child", phase_id: null},
      ],
      SPRINT
    );

    expect(scope).toEqual(["child", "grandchild", "parent"]);
  });

  it("counts three completed issues for a custom sprint report fixture (parent phase only)", () => {
    // Review fixture: all three completed; only parent has task_phase → done_count = 3
    const completedInSprint = resolveSprintScope(
      [
        {id: "parent", parent_task_id: null, phase_id: SPRINT},
        {id: "child", parent_task_id: "parent", phase_id: null},
        {id: "grandchild", parent_task_id: "child", phase_id: null},
      ],
      SPRINT
    );

    expect(completedInSprint).toHaveLength(3);
  });

  it("does not pull a grandchild through a child that belongs to another sprint", () => {
    const scope = resolveSprintScope(
      [
        {id: "parent", parent_task_id: null, phase_id: SPRINT},
        {id: "child", parent_task_id: "parent", phase_id: OTHER},
        {id: "grandchild", parent_task_id: "child", phase_id: null},
      ],
      SPRINT
    );

    expect(scope).toEqual(["parent"]);
  });

  it("still includes a direct child with its own matching task_phase row", () => {
    const scope = resolveSprintScope(
      [
        {id: "parent", parent_task_id: null, phase_id: SPRINT},
        {id: "child", parent_task_id: "parent", phase_id: SPRINT},
        {id: "grandchild", parent_task_id: "child", phase_id: null},
      ],
      SPRINT
    );

    expect(scope).toEqual(["child", "grandchild", "parent"]);
  });

  it("excludes archived descendants from inherited membership", () => {
    const scope = resolveSprintScope(
      [
        {id: "parent", parent_task_id: null, phase_id: SPRINT},
        {id: "child", parent_task_id: "parent", phase_id: null, archived: true},
        {id: "grandchild", parent_task_id: "child", phase_id: null},
      ],
      SPRINT
    );

    expect(scope).toEqual(["parent"]);
  });
});
