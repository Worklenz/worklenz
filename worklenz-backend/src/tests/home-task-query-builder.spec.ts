// jest.config.js sets automock: true repo-wide, which replaces every
// exported function (including the module under test) with a jest.fn()
// stub — unmock explicitly so these pure functions run for real.
jest.unmock("../shared/home-task-query-builder");
jest.unmock("../shared/validation-helpers");

import {
  toArray,
  toUuidArray,
  escapeLikePattern,
  buildTaskFilterClauses,
  buildTaskOrderClause,
  buildTabClause,
} from "../shared/home-task-query-builder";

const VALID_UUID_1 = "550e8400-e29b-41d4-a716-446655440000";
const VALID_UUID_2 = "6fa459ea-ee8a-4ca4-894e-db77e160355e";

describe("toArray", () => {
  it("returns [] for undefined/null/empty string", () => {
    expect(toArray(undefined)).toEqual([]);
    expect(toArray(null)).toEqual([]);
    expect(toArray("")).toEqual([]);
  });

  it("wraps a scalar into a single-element array", () => {
    expect(toArray("todo")).toEqual(["todo"]);
  });

  it("passes arrays through, stringified and with blanks filtered", () => {
    expect(toArray(["a", "", "b"])).toEqual(["a", "b"]);
  });
});

describe("toUuidArray", () => {
  it("drops entries that aren't valid UUIDs", () => {
    expect(toUuidArray([VALID_UUID_1, "not-a-uuid", VALID_UUID_2, "123"]))
      .toEqual([VALID_UUID_1, VALID_UUID_2]);
  });

  it("returns [] when nothing is a valid UUID", () => {
    expect(toUuidArray(["nope", "still-not-a-uuid"])).toEqual([]);
  });
});

describe("escapeLikePattern", () => {
  it("HTML-escapes & < > to match sanitizePlainText's stored form", () => {
    expect(escapeLikePattern("R&D")).toBe("R&amp;D");
  });

  it("escapes ILIKE wildcard metacharacters % and _", () => {
    expect(escapeLikePattern("50%_done")).toBe("50\\%\\_done");
  });

  it("escapes a literal backslash", () => {
    expect(escapeLikePattern("a\\b")).toBe("a\\\\b");
  });
});

describe("buildTaskFilterClauses", () => {
  it("returns an empty clause and leaves values untouched when nothing is set", () => {
    const values: unknown[] = [];
    const clause = buildTaskFilterClauses({}, values, 3, 3);
    expect(clause).toBe("");
    expect(values).toEqual([]);
  });

  it("builds status/priority/project/assignee clauses at the right $N offsets for paramOffset=3 (getTasks/getUnassignedTasks convention)", () => {
    const values: unknown[] = [];
    const clause = buildTaskFilterClauses(
      {
        status: ["todo", "doing"],
        priority_ids: [VALID_UUID_1],
        project_ids: [VALID_UUID_2],
        assignee_ids: [VALID_UUID_1],
      },
      values,
      3,
      3
    );

    expect(clause).toBe(
      "AND LOWER(ts.name) = ANY($4) AND t.priority_id = ANY($5) AND t.project_id = ANY($6)"
      + " AND EXISTS (SELECT 1 FROM tasks_assignees ta2 WHERE ta2.task_id = t.id AND ta2.team_member_id = ANY($7))"
    );
    expect(values).toEqual([
      ["todo", "doing"],
      [VALID_UUID_1],
      [VALID_UUID_2],
      [VALID_UUID_1],
    ]);
  });

  it("shifts every $N when paramOffset changes, without touching values", () => {
    const values: unknown[] = [];
    const clause = buildTaskFilterClauses({ status: ["todo"] }, values, 5, 3);
    expect(clause).toBe("AND LOWER(ts.name) = ANY($6)");
  });

  it("silently drops malformed UUIDs instead of letting them reach Postgres", () => {
    const values: unknown[] = [];
    const clause = buildTaskFilterClauses(
      { project_ids: ["not-a-uuid", VALID_UUID_1] },
      values,
      3,
      3
    );
    expect(clause).toBe("AND t.project_id = ANY($4)");
    expect(values).toEqual([[VALID_UUID_1]]);
  });

  it("omits the project/assignee/priority clause entirely if every id is invalid", () => {
    const values: unknown[] = [];
    const clause = buildTaskFilterClauses({ project_ids: ["nope"] }, values, 3, 3);
    expect(clause).toBe("");
    expect(values).toEqual([]);
  });

  it("escapes the search term and reuses one $N for both ILIKE sides", () => {
    const values: unknown[] = [];
    const clause = buildTaskFilterClauses({ search: "50%" }, values, 3, 3);
    expect(clause).toBe(
      "AND (t.name ILIKE $4 ESCAPE '\\' OR (p.key || '-' || t.task_no::TEXT) ILIKE $4 ESCAPE '\\')"
    );
    expect(values).toEqual(["%50\\%%"]);
  });

  it("builds a tz-aware overdue_only clause bound to tzParamIndex, with the completion guard", () => {
    const values: unknown[] = [];
    const clause = buildTaskFilterClauses({ overdue_only: "true" }, values, 3, 3);
    expect(clause).toBe(
      "AND t.end_date IS NOT NULL AND (t.end_date AT TIME ZONE $3)::DATE < (NOW() AT TIME ZONE $3)::DATE AND NOT is_completed(t.status_id, t.project_id)"
    );
    expect(values).toEqual([]);
  });

  it("builds the no_due_only clause", () => {
    const values: unknown[] = [];
    const clause = buildTaskFilterClauses({ no_due_only: "true" }, values, 3, 3);
    expect(clause).toBe("AND t.end_date IS NULL");
  });

  it("combines multiple filters in order, keeping $N and values in lockstep", () => {
    const values: unknown[] = [];
    const clause = buildTaskFilterClauses(
      { priority_ids: [VALID_UUID_1], search: "bug", overdue_only: "true" },
      values,
      3,
      3
    );
    expect(clause).toBe(
      "AND t.priority_id = ANY($4)"
      + " AND (t.name ILIKE $5 ESCAPE '\\' OR (p.key || '-' || t.task_no::TEXT) ILIKE $5 ESCAPE '\\')"
      + " AND t.end_date IS NOT NULL AND (t.end_date AT TIME ZONE $3)::DATE < (NOW() AT TIME ZONE $3)::DATE AND NOT is_completed(t.status_id, t.project_id)"
    );
    expect(values).toEqual([[VALID_UUID_1], "%bug%"]);
  });
});

describe("buildTaskOrderClause", () => {
  it("defaults to end_date ASC with the t.id tiebreaker when nothing is set", () => {
    expect(buildTaskOrderClause({})).toBe("ORDER BY t.end_date ASC NULLS LAST, t.id ASC");
  });

  it("maps known sort fields", () => {
    expect(buildTaskOrderClause({ sort_field: "name" })).toBe("ORDER BY t.name ASC NULLS LAST, t.id ASC");
    expect(buildTaskOrderClause({ sort_field: "project_name" })).toBe("ORDER BY p.name ASC NULLS LAST, t.id ASC");
    expect(buildTaskOrderClause({ sort_field: "priority" })).toBe("ORDER BY tp.value ASC NULLS LAST, t.id ASC");
    expect(buildTaskOrderClause({ sort_field: "status" })).toBe("ORDER BY ts.name ASC NULLS LAST, t.id ASC");
  });

  it("falls back to end_date for an unknown sort field", () => {
    expect(buildTaskOrderClause({ sort_field: "not_a_real_field" })).toBe("ORDER BY t.end_date ASC NULLS LAST, t.id ASC");
  });

  it("respects sort_order=desc", () => {
    expect(buildTaskOrderClause({ sort_field: "name", sort_order: "desc" })).toBe("ORDER BY t.name DESC NULLS LAST, t.id ASC");
  });
});

describe("buildTabClause", () => {
  it("returns no predicate for the All tab", () => {
    expect(buildTabClause("All", 3)).toBe("");
  });

  it("builds tz-aware predicates for Today/Upcoming/UpcomingNowOn", () => {
    expect(buildTabClause("Today", 3)).toBe(
      "AND (t.end_date AT TIME ZONE $3)::DATE = (NOW() AT TIME ZONE $3)::DATE"
    );
    expect(buildTabClause("Upcoming", 3)).toBe(
      "AND (t.end_date AT TIME ZONE $3)::DATE > (NOW() AT TIME ZONE $3)::DATE"
    );
    expect(buildTabClause("UpcomingNowOn", 3)).toBe(
      "AND (t.end_date AT TIME ZONE $3)::DATE >= (NOW() AT TIME ZONE $3)::DATE"
    );
  });

  it("Overdue includes the not-null guard and the completion guard, matching is_overdue", () => {
    expect(buildTabClause("Overdue", 3)).toBe(
      "AND t.end_date IS NOT NULL AND (t.end_date AT TIME ZONE $3)::DATE < (NOW() AT TIME ZONE $3)::DATE AND NOT is_completed(t.status_id, t.project_id)"
    );
  });

  it("NoDueDate and an unknown tab", () => {
    expect(buildTabClause("NoDueDate", 3)).toBe("AND t.end_date IS NULL");
    expect(buildTabClause("SomethingElse", 3)).toBe("");
  });

  it("uses whatever tzParamIndex the caller passes", () => {
    expect(buildTabClause("Today", 7)).toBe(
      "AND (t.end_date AT TIME ZONE $7)::DATE = (NOW() AT TIME ZONE $7)::DATE"
    );
  });
});
