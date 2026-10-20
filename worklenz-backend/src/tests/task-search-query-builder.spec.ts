import { buildTaskSearchQuery } from "../shared/task-search-query-builder";

describe("task search", () => {
  it.each(["PROJ-123", "123", "Release notes", "550e8400-e29b-41d4-a716-446655440000"])(
    "binds a task name, key or ID search safely: %s", search => {
      const result = buildTaskSearchQuery(search, "project-1", "excluded-task", { clause: "", params: [] });
      expect(result.params).toEqual([`%${search}%`, "project-1", "excluded-task"]);
      expect(result.query).toContain("t.name ILIKE $1");
      expect(result.query).toContain("CONCAT(p.key, '-', t.task_no) ILIKE $1");
      expect(result.query).toContain("t.task_no::text ILIKE $1");
      expect(result.query).toContain("t.id::text ILIKE $1");
      expect(result.query).not.toContain(search);
    }
  );

  it("applies project, excluded-task and assignee restrictions to all search alternatives", () => {
    const result = buildTaskSearchQuery("PROJ-123", "project-1", "excluded-task", {
      clause: "t.id IN (SELECT task_id FROM task_assignees WHERE team_member_id = $4)",
      params: ["member-1"],
    });
    expect(result.query).toMatch(/OR t.id::text ILIKE \$1\)\s+AND t.project_id = \$2 AND t.id != \$3/);
    expect(result.query).toContain("AND t.id IN (SELECT task_id FROM task_assignees WHERE team_member_id = $4)");
    expect(result.params).toEqual(["%PROJ-123%", "project-1", "excluded-task", "member-1"]);
  });

  it("trims search input and supports an empty search for initial suggestions", () => {
    expect(buildTaskSearchQuery("  PROJ-123  ", "p", "t", { clause: "", params: [] }).params[0]).toBe("%PROJ-123%");
    expect(buildTaskSearchQuery("", "p", "t", { clause: "", params: [] }).params[0]).toBe("%%");
  });
});
