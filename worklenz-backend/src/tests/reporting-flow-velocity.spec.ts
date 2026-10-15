jest.mock("../config/db", () => ({ __esModule: true, default: { query: jest.fn() } }));

import {
  buildCumulativeFlow,
  buildTimeInStatus,
  FlowBand,
  buildTaskOrderBy,
  FlowError,
  groupTimeInStatusTasks,
  resolveFlowRange,
  TimeInStatusTask,
} from "../services/reporting-flow.service";
import { buildVelocity } from "../services/reporting-velocity.service";
import { InvalidOverviewLayoutError, validateLayout } from "../services/reporting-overview-layout.service";
import { InvalidDashboardError, validateGadgets } from "../services/dashboard-validation";

const PROJECT_ID = "6f1c1f3e-0f5a-4c43-9a3b-1b7f2f4f9c11";

const BANDS: FlowBand[] = [
  { id: "todo", name: "To Do", color: "#aaaaaa", category: "todo" },
  { id: "doing", name: "In Progress", color: "#bbbbbb", category: "doing" },
  { id: "done", name: "Done", color: "#cccccc", category: "done" },
];

describe("buildVelocity", () => {
  it("averages only completed sprints and computes completion rates", () => {
    const result = buildVelocity("story_points", [
      { id: "a", name: "S1", sprint_status: "completed", committed: 10, completed: 8 },
      { id: "b", name: "S2", sprint_status: "completed", committed: 12, completed: 12 },
      { id: "c", name: "S3", sprint_status: "active", committed: 9, completed: 2 },
    ]);
    expect(result.average_velocity).toBe(10);
    expect(result.completed_sprint_count).toBe(2);
    expect(result.sprints.map(sprint => sprint.completion_rate)).toEqual([80, 100, 22]);
    expect(result.best_sprint).toEqual({ name: "S2", completed: 12 });
    expect(result.worst_sprint).toEqual({ name: "S1", completed: 8 });
    expect(result.commitment_accuracy).toBe(91);
  });

  it("has no average before a sprint completes and no rate without a commitment", () => {
    const result = buildVelocity("issue_count", [{ id: "a", name: "S1", sprint_status: "active", committed: null, completed: "3" }]);
    expect(result.average_velocity).toBeNull();
    expect(result.sprints[0]).toMatchObject({ committed: null, completed: 3, completion_rate: null });
  });
});

describe("resolveFlowRange", () => {
  const now = new Date("2026-10-14T10:00:00Z");

  it("defaults to the last 30 days ending today", () => {
    const range = resolveFlowRange(undefined, undefined, now);
    expect(range.end.toISOString().slice(0, 10)).toBe("2026-10-14");
    expect(range.start.toISOString().slice(0, 10)).toBe("2026-09-15");
  });

  it("rejects inverted and oversized ranges", () => {
    expect(() => resolveFlowRange("2026-10-10", "2026-10-01", now)).toThrow(FlowError);
    expect(() => resolveFlowRange("2024-01-01", "2026-01-01", now)).toThrow(FlowError);
  });
});

describe("buildCumulativeFlow", () => {
  const now = new Date("2026-10-03T12:00:00Z");
  const range = resolveFlowRange("2026-10-01", "2026-10-05", now);

  it("fills missing bands with zero, leaves future days empty and summarises throughput", () => {
    const result = buildCumulativeFlow(
      "project",
      range,
      BANDS,
      [
        { day: "2026-10-01", band_id: "todo", task_count: "5" },
        { day: "2026-10-02", band_id: "todo", task_count: "4" },
        { day: "2026-10-02", band_id: "doing", task_count: "1" },
        { day: "2026-10-03", band_id: "todo", task_count: "3" },
        { day: "2026-10-03", band_id: "doing", task_count: "1" },
        { day: "2026-10-03", band_id: "done", task_count: "2" },
      ],
      null,
      now
    );
    expect(result.series).toHaveLength(5);
    expect(result.series[0].counts).toEqual({ todo: 5, doing: 0, done: 0 });
    expect(result.series[3].counts).toBeNull();
    expect(result.series[4].counts).toBeNull();
    expect(result.summary).toEqual({ total: 6, in_progress: 1, done: 2, throughput_per_day: 1, added: 1, avg_cycle_days: null });
  });
});

describe("buildTimeInStatus", () => {
  const range = resolveFlowRange("2026-10-01", "2026-10-05", new Date("2026-10-05T00:00:00Z"));

  it("drops done bands, keeps board order and weights the overall mean by task count", () => {
    const result = buildTimeInStatus("team", range, BANDS, [
      { band_id: "done", task_count: 9, avg_hours: 999, median_hours: 999, total_hours: 9000 },
      { band_id: "doing", task_count: 1, avg_hours: 30, median_hours: 30, total_hours: 30 },
      { band_id: "todo", task_count: 3, avg_hours: 10, median_hours: 8, total_hours: 30 },
    ]);
    expect(result.rows.map(row => row.band.id)).toEqual(["todo", "doing"]);
    expect(result.avg_hours_overall).toBe(15);
  });

  it("returns an empty result when nothing moved", () => {
    expect(buildTimeInStatus("team", range, BANDS, [])).toMatchObject({ rows: [], avg_hours_overall: 0 });
  });
});

describe("buildTaskOrderBy", () => {
  it("maps whitelisted fields and honours the direction", () => {
    expect(buildTaskOrderBy("name", "desc")).toBe("ORDER BY t.name DESC, t.id");
    expect(buildTaskOrderBy("task_key", "asc")).toBe("ORDER BY p.key ASC, t.task_no ASC, t.id");
    expect(buildTaskOrderBy("hours_overdue", "asc")).toContain("NULLS LAST");
  });

  it("never lets an unknown field reach SQL and falls back to longest time in status", () => {
    expect(buildTaskOrderBy("name; DROP TABLE tasks", "asc")).toBe("ORDER BY q.hours_in_status DESC, t.id");
    expect(buildTaskOrderBy(undefined, undefined)).toBe("ORDER BY q.hours_in_status DESC, t.id");
  });
});

describe("groupTimeInStatusTasks", () => {
  const task = (id: string, overrides: Partial<TimeInStatusTask>): TimeInStatusTask => ({
    id,
    name: id,
    task_key: null,
    project_id: "p1",
    project_name: "Alpha",
    project_color: "#111111",
    status_name: "To Do",
    status_color: "#222222",
    hours_in_status: 10,
    hours_overdue: null,
    assignees: [],
    updated_at: "2026-10-01T00:00:00.000Z",
    ...overrides,
  });
  const ann = { id: "m1", name: "Ann", avatar_url: null };
  const bob = { id: "m2", name: "Bob", avatar_url: null };
  const tasks = [
    task("a", { assignees: [ann, bob], hours_in_status: 20, hours_overdue: 5 }),
    task("b", { project_id: "p2", project_name: "Beta", status_name: "Doing", assignees: [ann] }),
    task("c", {}),
  ];

  it("groups by project with averages and overdue counts", () => {
    const groups = groupTimeInStatusTasks(tasks, "project");
    expect(groups.map(g => [g.group_name, g.task_count])).toEqual([["Alpha", 2], ["Beta", 1]]);
    expect(groups[0]).toMatchObject({ avg_hours: 15, overdue_count: 1 });
  });

  it("groups by status", () => {
    expect(groupTimeInStatusTasks(tasks, "status").map(g => g.group_name)).toEqual(["To Do", "Doing"]);
  });

  it("shows a task under each assignee and collects the unassigned", () => {
    const groups = groupTimeInStatusTasks(tasks, "assignee");
    expect(groups.find(g => g.group_name === "Ann")?.task_count).toBe(2);
    expect(groups.find(g => g.group_name === "Bob")?.task_count).toBe(1);
    expect(groups.find(g => g.group_id === "unassigned")?.task_count).toBe(1);
  });
});

describe("overview layout + gadget validation for the flow widgets", () => {
  const layoutWith = (key: string, config: Record<string, unknown>) => ({
    version: 1,
    widgets: [{ id: "w1", key, x: 0, y: 0, w: 6, h: 9, hidden: false, config }],
  });

  it("accepts the new widget keys and sprintCount", () => {
    const config = { progressScope: "project", projectId: PROJECT_ID, progressMetric: "issue_count", sprintCount: 8 };
    expect(validateLayout(layoutWith("velocity_chart", config)).widgets[0].config).toEqual(config);
    expect(validateLayout(layoutWith("cumulative_flow", { progressScope: "team" })).widgets).toHaveLength(1);
    expect(validateLayout(layoutWith("time_in_status", { includeSubtasks: true })).widgets).toHaveLength(1);
  });

  it("rejects an out-of-range sprintCount", () => {
    expect(() => validateLayout(layoutWith("velocity_chart", { sprintCount: 2 }))).toThrow(InvalidOverviewLayoutError);
    expect(() => validateLayout(layoutWith("velocity_chart", { sprintCount: 13 }))).toThrow(InvalidOverviewLayoutError);
  });

  it("validates the new gadget fields", () => {
    const gadget = (type: string, config: Record<string, unknown>) => ({ type, x: 0, y: 0, w: 4, h: 3, config });
    expect(() => validateGadgets([gadget("velocity_chart", { metric: "issue_count", include_subtasks: true })])).not.toThrow();
    expect(() => validateGadgets([gadget("velocity_chart", { metric: "hours" })])).toThrow(InvalidDashboardError);
    expect(() => validateGadgets([gadget("time_in_status", { include_subtasks: "yes" })])).toThrow(InvalidDashboardError);
  });
});
