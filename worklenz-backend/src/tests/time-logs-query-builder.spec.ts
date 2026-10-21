import {
  buildTimeLogMembersQuery,
  buildTimeLogsGroupsQuery,
  buildTimeLogsRowsQuery,
  buildTimeLogsTotalsQuery,
  ITimeLogsFilters,
  NO_CLIENT_FILTER_ID,
  NO_PRACTICE_FILTER_ID,
  parseIdList,
  parsePagination,
  parseTimeLogsFilters,
  parseTimeLogsGroupBy,
  parseTimeLogsView,
  TimeLogsFilterError,
} from "../controllers/reporting/time-logs-query-builder";

const TEAM = "11111111-1111-4111-8111-111111111111";
const USER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PROJECT = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const PRACTICE = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const CLIENT = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const TZ = "Europe/Berlin";

const base: ITimeLogsFilters = { teamId: TEAM, timezone: TZ };

/** Postgres rejects a parameter nothing references (42P18) — every $n must appear. */
const expectNoOrphanParams = (query: { text: string; values: unknown[] }) => {
  query.values.forEach((_, index) => {
    expect(query.text).toContain(`$${index + 1}`);
  });
  const used = Array.from(query.text.matchAll(/\$(\d+)/g)).map(m => Number(m[1]));
  expect(Math.max(0, ...used)).toBeLessThanOrEqual(query.values.length);
};

/**
 * The WHERE clause of a query, whitespace-normalised and with placeholder numbers blanked (they
 * differ between queries, since each registers its parameters in its own order), so two queries'
 * conditions can be compared for equality.
 */
const whereShape = (text: string): string => {
  const start = text.indexOf("WHERE p.team_id");
  const ends = [text.indexOf("GROUP BY", start), text.indexOf("ORDER BY", start)].filter(i => i > -1);
  const end = ends.length ? Math.min(...ends) : text.length;
  return text.slice(start, end).replace(/\s+/g, " ").replace(/\$\d+/g, "$?").trim();
};

describe("buildTimeLogsRowsQuery", () => {
  it("scopes to the team and adds no other filter by default", () => {
    const q = buildTimeLogsRowsQuery(base);
    expect(q.text).toContain("p.team_id = $");
    expect(q.text).not.toContain("ANY(");
    expect(q.text).not.toContain("ILIKE");
    expect(q.text).not.toContain("t.billable IS");
    expectNoOrphanParams(q);
  });

  it("buckets the day in the viewer's timezone with a single AT TIME ZONE", () => {
    const q = buildTimeLogsRowsQuery(base);
    expect(q.text).toMatch(/\(twl\.created_at AT TIME ZONE \$\d+::text\)::date/);
    expect(q.text).not.toContain("AT TIME ZONE 'UTC'");
    expect(q.values).toContain(TZ);
  });

  it("converts the inclusive date range to instants in the viewer's timezone", () => {
    const q = buildTimeLogsRowsQuery({ ...base, dateFrom: "2026-09-01", dateTo: "2026-09-30" });
    expect(q.text).toMatch(/twl\.created_at >= \(\$\d+::date\)::timestamp AT TIME ZONE \$\d+::text/);
    expect(q.text).toMatch(/twl\.created_at < \(\(\$\d+::date \+ 1\)::timestamp AT TIME ZONE \$\d+::text\)/);
    expect(q.values).toEqual(expect.arrayContaining(["2026-09-01", "2026-09-30"]));
    // timezone and team are each sent once and reused
    expect(q.values.filter(v => v === TZ)).toHaveLength(1);
    expect(q.values.filter(v => v === TEAM)).toHaveLength(1);
    expectNoOrphanParams(q);
  });

  it("omits the date condition for 'all time' (no range)", () => {
    const q = buildTimeLogsRowsQuery(base);
    expect(q.text).not.toContain("::date + 1");
  });

  it("filters members by user id, so deactivated and removed members stay filterable", () => {
    const q = buildTimeLogsRowsQuery({ ...base, userIds: [USER_A, USER_B] });
    expect(q.text).toMatch(/twl\.user_id = ANY\(\$\d+::uuid\[\]\)/);
    expect(q.values).toContainEqual([USER_A, USER_B]);
    expectNoOrphanParams(q);
  });

  it("filters projects", () => {
    const q = buildTimeLogsRowsQuery({ ...base, projectIds: [PROJECT] });
    expect(q.text).toMatch(/p\.id = ANY\(\$\d+::uuid\[\]\)/);
    expect(q.values).toContainEqual([PROJECT]);
  });

  it("returns each entry's client (via its project), and joins clients only for the name", () => {
    const q = buildTimeLogsRowsQuery(base);
    expect(q.text).toContain("LEFT JOIN clients c ON c.id = p.client_id");
    expect(q.text).toContain("p.client_id,");
    expect(q.text).toContain("c.name AS client_name");
  });

  it("returns each entry's Task ID (project key + task number, as shown across the app)", () => {
    expect(buildTimeLogsRowsQuery(base).text).toContain("CONCAT(p.key, '-', t.task_no) AS task_key");
  });

  it("sorts by Task ID as project key then task number, so WL-2 comes before WL-10", () => {
    expect(buildTimeLogsRowsQuery(base, { sortField: "task_key", sortOrder: "asc" }).text).toContain(
      "ORDER BY LOWER(p.key) ASC NULLS LAST, t.task_no ASC NULLS LAST"
    );
    expect(buildTimeLogsRowsQuery(base, { sortField: "task_key", sortOrder: "desc" }).text).toContain(
      "ORDER BY LOWER(p.key) DESC NULLS LAST, t.task_no DESC NULLS LAST"
    );
  });

  it("finds an entry by its Task ID in the search box", () => {
    const q = buildTimeLogsRowsQuery({ ...base, search: "WL-12" });
    expect(q.text).toContain("CONCAT(p.key, '-', t.task_no) ILIKE");
    expect(q.values).toContain("%WL-12%");
    expectNoOrphanParams(q);
  });

  it("filters by client", () => {
    const q = buildTimeLogsRowsQuery({ ...base, clientIds: [CLIENT] });
    expect(q.text).toMatch(/\(p\.client_id = ANY\(\$\d+::uuid\[\]\)\)/);
    expect(q.text).not.toContain("p.client_id IS NULL");
    expect(q.values).toContainEqual([CLIENT]);
    expectNoOrphanParams(q);
  });

  it("'No client' matches entries whose project has no client", () => {
    const only = buildTimeLogsRowsQuery({ ...base, clientIds: [NO_CLIENT_FILTER_ID] });
    expect(only.text).toContain("(p.client_id IS NULL)");
    expect(only.text).not.toContain("ANY(");
    expectNoOrphanParams(only);

    const mixed = buildTimeLogsRowsQuery({ ...base, clientIds: [CLIENT, NO_CLIENT_FILTER_ID] });
    expect(mixed.text).toMatch(/\(p\.client_id = ANY\(\$\d+::uuid\[\]\) OR p\.client_id IS NULL\)/);
    expect(mixed.values).toContainEqual([CLIENT]);
  });

  it("applies the client filter to the totals query too", () => {
    const filters = { ...base, clientIds: [CLIENT, NO_CLIENT_FILTER_ID] };
    expect(buildTimeLogsTotalsQuery(filters).text).toMatch(/p\.client_id = ANY/);
    expect(buildTimeLogsTotalsQuery(filters).text).toContain("p.client_id IS NULL");
  });

  it("filters by the logger's practice", () => {
    const q = buildTimeLogsRowsQuery({ ...base, practiceIds: [PRACTICE] });
    expect(q.text).toMatch(/tm\.practice_id = ANY\(\$\d+::uuid\[\]\)/);
    expect(q.text).not.toContain("tm.practice_id IS NULL");
    expect(q.values).toContainEqual([PRACTICE]);
  });

  it("'No practice' also matches removed members (no team_members row)", () => {
    const only = buildTimeLogsRowsQuery({ ...base, practiceIds: [NO_PRACTICE_FILTER_ID] });
    expect(only.text).toContain("(tm.practice_id IS NULL)");
    expect(only.text).not.toContain("ANY(");
    expectNoOrphanParams(only);

    const mixed = buildTimeLogsRowsQuery({ ...base, practiceIds: [PRACTICE, NO_PRACTICE_FILTER_ID] });
    expect(mixed.text).toMatch(/\(tm\.practice_id = ANY\(\$\d+::uuid\[\]\) OR tm\.practice_id IS NULL\)/);
    expect(mixed.values).toContainEqual([PRACTICE]);
  });

  it("applies only the billable side that is switched on", () => {
    expect(buildTimeLogsRowsQuery({ ...base, billable: { billable: true, nonBillable: false } }).text).toContain(
      "t.billable IS TRUE"
    );
    expect(buildTimeLogsRowsQuery({ ...base, billable: { billable: false, nonBillable: true } }).text).toContain(
      "t.billable IS FALSE"
    );
    const both = buildTimeLogsRowsQuery({ ...base, billable: { billable: true, nonBillable: true } });
    expect(both.text).not.toContain("t.billable IS");
  });

  it("searches task, project, member and description, escaping LIKE wildcards", () => {
    const q = buildTimeLogsRowsQuery({ ...base, search: "50%_off\\" });
    expect(q.text).toContain("t.name ILIKE");
    expect(q.text).toContain("p.name ILIKE");
    expect(q.text).toContain("u.name ILIKE");
    expect(q.text).toContain("twl.description");
    expect(q.values).toContain("%50\\%\\_off\\\\%");
    expectNoOrphanParams(q);
  });

  it("combines every filter with correct, gap-free parameter numbering", () => {
    const q = buildTimeLogsRowsQuery(
      {
        ...base,
        dateFrom: "2026-09-01",
        dateTo: "2026-09-17",
        userIds: [USER_A],
        projectIds: [PROJECT],
        clientIds: [CLIENT],
        practiceIds: [PRACTICE, NO_PRACTICE_FILTER_ID],
        billable: { billable: true, nonBillable: false },
        search: "invoice",
      },
      { sortField: "duration", sortOrder: "asc", limit: 20, offset: 40 }
    );
    expectNoOrphanParams(q);
    expect(q.text).toMatch(/LIMIT \$\d+ OFFSET \$\d+/);
    expect(q.values.slice(-2)).toEqual([20, 40]);
  });

  it("uses a whitelisted sort and falls back to the default order for unknown fields", () => {
    expect(buildTimeLogsRowsQuery(base, { sortField: "duration", sortOrder: "asc" }).text).toContain(
      "ORDER BY twl.time_spent ASC"
    );
    expect(buildTimeLogsRowsQuery(base, { sortField: "member", sortOrder: "desc" }).text).toContain(
      "ORDER BY LOWER(u.name) DESC"
    );
    const injected = buildTimeLogsRowsQuery(base, { sortField: "1; DROP TABLE users", sortOrder: "asc" });
    expect(injected.text).not.toContain("DROP TABLE");
    expect(injected.text).toContain("ORDER BY log_day DESC");
  });

  it.each(["constructor", "toString", "hasOwnProperty", "__proto__", "valueOf"])(
    "treats the inherited object key %p as an unknown sort field, not as SQL text",
    sortField => {
      const q = buildTimeLogsRowsQuery(base, { sortField, sortOrder: "asc" });
      expect(q.text).toContain("ORDER BY log_day DESC");
      expect(q.text).not.toContain("native code");
      expect(q.text).not.toContain("[object");
    }
  );

  it("sorts by client, with entries that have no client always last", () => {
    expect(buildTimeLogsRowsQuery(base, { sortField: "client", sortOrder: "asc" }).text).toContain(
      "ORDER BY LOWER(c.name) ASC NULLS LAST"
    );
    expect(buildTimeLogsRowsQuery(base, { sortField: "client", sortOrder: "desc" }).text).toContain(
      "ORDER BY LOWER(c.name) DESC NULLS LAST"
    );
  });

  it("sorts deterministically (id tiebreaker) so pages never overlap", () => {
    expect(buildTimeLogsRowsQuery(base).text).toContain("twl.id ASC");
    expect(buildTimeLogsRowsQuery(base, { sortField: "date", sortOrder: "asc" }).text).toContain("twl.id ASC");
  });

  it("classifies the logger as active, deactivated or removed", () => {
    const q = buildTimeLogsRowsQuery(base);
    expect(q.text).toContain("WHEN tm.id IS NULL THEN 'removed'");
    expect(q.text).toContain("WHEN tm.active IS FALSE THEN 'deactivated'");
  });

  it("never interpolates user input into the SQL text", () => {
    const q = buildTimeLogsRowsQuery({ ...base, search: "'; DROP TABLE tasks; --" });
    expect(q.text).not.toContain("DROP TABLE");
  });
});

describe("buildTimeLogsRowsQuery — By task view", () => {
  const taskView = (options = {}, filters: ITimeLogsFilters = base) =>
    buildTimeLogsRowsQuery(filters, { view: "task", ...options });

  it("collapses the entries into one row per task, with the time summed", () => {
    const q = taskView();
    expect(q.text).toContain("t.id AS id");
    expect(q.text).toContain("SUM(twl.time_spent)::FLOAT8 AS time_spent");
    expect(q.text).toContain("COUNT(*)::INT AS entry_count");
    expect(q.text).toMatch(/GROUP BY t\.id, t\.name, t\.task_no, t\.billable, p\.id, p\.key, p\.name, p\.client_id, c\.name/);
    // not one row per entry
    expect(q.text).not.toMatch(/SELECT twl\.id,/);
  });

  it("shows the task's latest entry as its date, in the viewer's timezone", () => {
    const q = taskView();
    expect(q.text).toMatch(/\(MAX\(twl\.created_at\) AT TIME ZONE \$\d+::text\)::date/);
    expect(q.values).toContain(TZ);
  });

  it("lists every member who logged on the task, newest description first", () => {
    const q = taskView();
    expect(q.text).toContain("JSONB_AGG(DISTINCT JSONB_BUILD_OBJECT(");
    expect(q.text).toContain("'member_status'");
    expect(q.text).toContain("WHEN tm.id IS NULL THEN 'removed'");
    expect(q.text).toContain("STRING_AGG(DISTINCT u.name, ', ' ORDER BY u.name) AS user_name");
    expect(q.text).toContain("ORDER BY twl.created_at DESC) AS description");
  });

  it("applies exactly the same conditions as the flat view, before grouping", () => {
    const filters: ITimeLogsFilters = {
      ...base,
      dateFrom: "2026-09-01",
      dateTo: "2026-09-30",
      userIds: [USER_A],
      clientIds: [NO_CLIENT_FILTER_ID],
      search: "x",
    };
    expect(whereShape(taskView({}, filters).text)).toBe(whereShape(buildTimeLogsRowsQuery(filters).text));
    expect(whereShape(taskView({}, filters).text)).toContain("p.client_id IS NULL");
    expectNoOrphanParams(taskView({}, filters));
  });

  it("sorts on the aggregates, and falls back to the most recently logged task", () => {
    expect(taskView({ sortField: "duration", sortOrder: "desc" }).text).toContain(
      "ORDER BY SUM(twl.time_spent) DESC NULLS LAST"
    );
    expect(taskView({ sortField: "date", sortOrder: "asc" }).text).toContain(
      "ORDER BY MAX(twl.created_at) ASC NULLS LAST"
    );
    expect(taskView({ sortField: "member", sortOrder: "asc" }).text).toContain(
      "ORDER BY MIN(LOWER(u.name)) ASC NULLS LAST"
    );
    expect(taskView({ sortField: "task_key", sortOrder: "asc" }).text).toContain(
      "ORDER BY LOWER(p.key) ASC NULLS LAST, t.task_no ASC NULLS LAST"
    );
    expect(taskView().text).toContain("ORDER BY MAX(twl.created_at) DESC, t.id ASC");
  });

  it("keeps paging deterministic with the task id as the final tiebreaker", () => {
    expect(taskView({ sortField: "client", sortOrder: "asc" }).text).toMatch(/t\.id ASC\s*$/);
  });

  it.each(["constructor", "toString", "__proto__", "1; DROP TABLE users"])(
    "treats %p as an unknown sort field in the By task view too",
    sortField => {
      const q = taskView({ sortField, sortOrder: "asc" });
      expect(q.text).toContain("ORDER BY MAX(twl.created_at) DESC, t.id ASC");
      expect(q.text).not.toContain("DROP TABLE");
      expect(q.text).not.toContain("native code");
    }
  );

  it("pages with LIMIT/OFFSET placeholders after every filter", () => {
    const q = taskView({ limit: 20, offset: 40 }, { ...base, userIds: [USER_A] });
    expect(q.values.slice(-2)).toEqual([20, 40]);
    expectNoOrphanParams(q);
  });

  it("is opt-in: omitting the view returns entries as logged", () => {
    expect(buildTimeLogsRowsQuery(base).text).toMatch(/SELECT twl\.id,/);
    expect(buildTimeLogsRowsQuery(base, { view: "flat" }).text).toMatch(/SELECT twl\.id,/);
  });
});

describe("buildTimeLogsGroupsQuery", () => {
  it.each([
    ["member", "u.id::text AS group_key", "u.name AS group_label", "GROUP BY u.id, u.name, u.avatar_url"],
    ["project", "p.id::text AS group_key", "p.name AS group_label", "GROUP BY p.id, p.name, p.color_code"],
    ["client", "COALESCE(c.id::text, '__no_client__') AS group_key", "c.name AS group_label", "GROUP BY c.id, c.name"],
  ] as const)("groups by %s", (groupBy, key, label, groupClause) => {
    const q = buildTimeLogsGroupsQuery(base, groupBy);
    expect(q.text).toContain(key);
    expect(q.text).toContain(label);
    expect(q.text).toContain(groupClause);
    expectNoOrphanParams(q);
  });

  it("rolls each group up into entries, tasks and a billable / non-billable split", () => {
    const text = buildTimeLogsGroupsQuery(base, "member").text;
    expect(text).toContain("COUNT(*)::INT AS entry_count");
    expect(text).toContain("COUNT(DISTINCT t.id)::INT AS task_count");
    expect(text).toContain("COUNT(DISTINCT p.id)::INT AS project_count");
    expect(text).toContain("COUNT(DISTINCT twl.user_id)::INT AS member_count");
    expect(text).toContain("COUNT(*) FILTER (WHERE COALESCE(t.billable, FALSE))::INT AS billable_entry_count");
    expect(text).toContain("COUNT(DISTINCT t.id) FILTER (WHERE COALESCE(t.billable, FALSE))::INT AS billable_task_count");
    expect(text).toContain("SUM(twl.time_spent) FILTER (WHERE COALESCE(t.billable, FALSE))");
    // an unflagged task counts as non-billable, so the two halves add up to the group's total
    expect(text).toContain("FILTER (WHERE NOT COALESCE(t.billable, FALSE))");
    expect(text).toContain("AS subtotal");
  });

  it("pages the groups and reports how many there are", () => {
    const q = buildTimeLogsGroupsQuery({ ...base, userIds: [USER_A] }, "project", { limit: 20, offset: 40 });
    expect(q.text).toContain("COUNT(*) OVER()::INT AS total_groups");
    expect(q.text).toMatch(/LIMIT \$\d+ OFFSET \$\d+/);
    expect(q.values.slice(-2)).toEqual([20, 40]);
    expectNoOrphanParams(q);
  });

  it("orders groups by name, with a nameless group (no client) last", () => {
    expect(buildTimeLogsGroupsQuery(base, "client").text).toContain("ORDER BY LOWER(c.name) ASC NULLS LAST");
  });

  it("tags a member group as active, deactivated or removed", () => {
    const text = buildTimeLogsGroupsQuery(base, "member").text;
    expect(text).toContain("MAX(CASE");
    expect(text).toContain("AS group_status");
    expect(text).toContain("WHEN tm.id IS NULL THEN 'removed'");
  });

  it("applies the same filters as the list, so a group's rollup matches its entries", () => {
    const filters: ITimeLogsFilters = {
      ...base,
      dateFrom: "2026-09-01",
      dateTo: "2026-09-30",
      projectIds: [PROJECT],
      practiceIds: [PRACTICE],
      billable: { billable: true, nonBillable: false },
      search: "invoice",
    };
    const groups = whereShape(buildTimeLogsGroupsQuery(filters, "member").text);
    expect(groups).toBe(whereShape(buildTimeLogsRowsQuery(filters).text));
    expect(groups).toContain("t.billable IS TRUE");
    expect(groups).toContain("tm.practice_id = ANY(");
  });

  it("rejects a grouping it does not know, including inherited object keys", () => {
    expect(() => buildTimeLogsGroupsQuery(base, "constructor" as never)).toThrow(TimeLogsFilterError);
    expect(() => buildTimeLogsGroupsQuery(base, "task" as never)).toThrow(TimeLogsFilterError);
  });
});

describe("parseTimeLogsView / parseTimeLogsGroupBy", () => {
  it("only 'task' selects the By task view; anything else is the flat view", () => {
    expect(parseTimeLogsView("task")).toBe("task");
    expect(parseTimeLogsView("flat")).toBe("flat");
    expect(parseTimeLogsView(undefined)).toBe("flat");
    expect(parseTimeLogsView("constructor")).toBe("flat");
  });

  it("accepts member, project and client; no grouping is null", () => {
    expect(parseTimeLogsGroupBy("member")).toBe("member");
    expect(parseTimeLogsGroupBy("project")).toBe("project");
    expect(parseTimeLogsGroupBy("client")).toBe("client");
    expect(parseTimeLogsGroupBy("none")).toBeNull();
    expect(parseTimeLogsGroupBy(undefined)).toBeNull();
    expect(parseTimeLogsGroupBy("")).toBeNull();
  });

  it("rejects anything else with a message the client can show", () => {
    expect(() => parseTimeLogsGroupBy("task")).toThrow(TimeLogsFilterError);
    expect(() => parseTimeLogsGroupBy("1; DROP TABLE users")).toThrow("group_by must be one of");
  });
});

describe("buildTimeLogsTotalsQuery", () => {
  it("counts and sums the whole filtered set, with no paging", () => {
    const q = buildTimeLogsTotalsQuery({ ...base, projectIds: [PROJECT] });
    expect(q.text).toContain("COUNT(*)");
    // the By task view pages by task, so the totals also say how many tasks there are
    expect(q.text).toContain("COUNT(DISTINCT t.id)::INT AS total_tasks");
    expect(q.text).toContain("SUM(twl.time_spent)");
    expect(q.text).not.toContain("LIMIT");
    expectNoOrphanParams(q);
  });

  it("has no orphan timezone parameter when there is no date range", () => {
    const q = buildTimeLogsTotalsQuery(base);
    expect(q.values).toEqual([TEAM]);
    expectNoOrphanParams(q);
  });

  it("applies exactly the same conditions as the rows query", () => {
    const filters: ITimeLogsFilters = {
      ...base,
      dateFrom: "2026-09-01",
      dateTo: "2026-09-30",
      userIds: [USER_A],
      practiceIds: [NO_PRACTICE_FILTER_ID],
      search: "x",
    };
    const whereOf = (text: string) => text.slice(text.indexOf("WHERE"));
    const rowsWhere = whereOf(buildTimeLogsRowsQuery(filters).text).split("ORDER BY")[0].replace(/\s+/g, " ").trim();
    const totalsWhere = whereOf(buildTimeLogsTotalsQuery(filters).text).replace(/\s+/g, " ").trim();
    // placeholder numbers differ between the two (timezone is registered first for rows), so compare shapes
    const shape = (s: string) => s.replace(/\$\d+/g, "$?");
    expect(shape(totalsWhere)).toBe(shape(rowsWhere));
  });
});

describe("buildTimeLogMembersQuery", () => {
  it("lists active members plus deactivated/removed users who logged time", () => {
    const q = buildTimeLogMembersQuery({ ...base, dateFrom: "2026-09-01", dateTo: "2026-09-30" });
    expect(q.text).toContain("WITH logged_users AS");
    expect(q.text).toContain("tm.active IS TRUE OR tm.user_id IN (SELECT user_id FROM logged_users)");
    expect(q.text).toContain("NOT EXISTS (SELECT 1 FROM team_members tm WHERE tm.user_id = u.id");
    expect(q.text).toContain("UNION ALL");
    expect(q.text).toMatch(/ORDER BY m\.is_active DESC/);
    expectNoOrphanParams(q);
  });

  it("scopes 'logged time' to the date range only when one is given", () => {
    const withRange = buildTimeLogMembersQuery({ ...base, dateFrom: "2026-09-01", dateTo: "2026-09-30" });
    expect(withRange.text).toContain("::date + 1");
    const allTime = buildTimeLogMembersQuery(base);
    expect(allTime.text).not.toContain("::date + 1");
    expect(allTime.values).toEqual([TEAM]);
    expectNoOrphanParams(allTime);
  });
});

describe("parseIdList", () => {
  it("accepts arrays and comma-separated strings, de-duplicating", () => {
    expect(parseIdList([USER_A, USER_B, USER_A], "member")).toEqual([USER_A, USER_B]);
    expect(parseIdList(`${USER_A}, ${USER_B}`, "member")).toEqual([USER_A, USER_B]);
    expect(parseIdList(undefined, "member")).toEqual([]);
    expect(parseIdList("", "member")).toEqual([]);
  });

  it("rejects anything that is not a UUID (would otherwise be a Postgres 22P02 → 500)", () => {
    expect(() => parseIdList(["not-a-uuid"], "member")).toThrow(TimeLogsFilterError);
    expect(() => parseIdList(`${USER_A},1;DROP`, "member")).toThrow("Invalid member id");
  });

  it("allows the 'No client' sentinel only where it is named, and still rejects junk", () => {
    expect(parseIdList([NO_CLIENT_FILTER_ID, CLIENT], "client", [NO_CLIENT_FILTER_ID])).toEqual([
      NO_CLIENT_FILTER_ID,
      CLIENT,
    ]);
    expect(() => parseIdList([NO_CLIENT_FILTER_ID], "client")).toThrow("Invalid client id");
    expect(() => parseTimeLogsFilters({ client_ids: ["nope"] }, { teamId: TEAM, timezone: TZ })).toThrow(
      "Invalid client id"
    );
  });

  it("allows only the named sentinel values", () => {
    expect(parseIdList([NO_PRACTICE_FILTER_ID], "practice", [NO_PRACTICE_FILTER_ID])).toEqual([NO_PRACTICE_FILTER_ID]);
    expect(() => parseIdList([NO_PRACTICE_FILTER_ID], "practice")).toThrow(TimeLogsFilterError);
  });
});

describe("parseTimeLogsFilters", () => {
  const ctx = { teamId: TEAM, timezone: TZ };

  it("parses a POST body", () => {
    const f = parseTimeLogsFilters(
      {
        date_from: "2026-09-01",
        date_to: "2026-09-17",
        user_ids: [USER_A],
        project_ids: [PROJECT],
        client_ids: [CLIENT, NO_CLIENT_FILTER_ID],
        practice_ids: [PRACTICE, NO_PRACTICE_FILTER_ID],
        billable: { billable: true, nonBillable: false },
        search: "  invoice ",
      },
      ctx
    );
    expect(f).toMatchObject({
      dateFrom: "2026-09-01",
      dateTo: "2026-09-17",
      userIds: [USER_A],
      projectIds: [PROJECT],
      clientIds: [CLIENT, NO_CLIENT_FILTER_ID],
      practiceIds: [PRACTICE, NO_PRACTICE_FILTER_ID],
      billable: { billable: true, nonBillable: false },
      search: "invoice",
    });
  });

  it("parses a GET query (comma-separated ids, JSON billable)", () => {
    const f = parseTimeLogsFilters(
      { user_ids: `${USER_A},${USER_B}`, billable: JSON.stringify({ billable: false, nonBillable: true }) },
      ctx
    );
    expect(f.userIds).toEqual([USER_A, USER_B]);
    expect(f.billable).toEqual({ billable: false, nonBillable: true });
  });

  it("'all' mode keeps the date range and drops every other filter", () => {
    const f = parseTimeLogsFilters(
      {
        date_from: "2026-09-01",
        date_to: "2026-09-30",
        user_ids: [USER_A],
        project_ids: [PROJECT],
        client_ids: [CLIENT],
        practice_ids: [PRACTICE],
        billable: { billable: true, nonBillable: false },
        search: "x",
      },
      ctx,
      "all"
    );
    expect(f).toEqual({ ...ctx, dateFrom: "2026-09-01", dateTo: "2026-09-30" });
  });

  it("rejects malformed, half-open and inverted date ranges", () => {
    expect(() => parseTimeLogsFilters({ date_from: "2026-9-1", date_to: "2026-09-30" }, ctx)).toThrow(
      TimeLogsFilterError
    );
    expect(() => parseTimeLogsFilters({ date_from: "2026-09-01" }, ctx)).toThrow("Both a start and an end date");
    expect(() => parseTimeLogsFilters({ date_from: "2026-09-30", date_to: "2026-09-01" }, ctx)).toThrow(
      "Start date must not be after end date"
    );
    expect(() => parseTimeLogsFilters({ date_from: "2026-02-30", date_to: "2026-03-01" }, ctx)).toThrow(
      TimeLogsFilterError
    );
  });

  it("rejects an unparseable billable filter", () => {
    expect(() => parseTimeLogsFilters({ billable: "{nope" }, ctx)).toThrow("Invalid billable filter");
  });

  it("allows an empty filter set (everything, all time)", () => {
    expect(parseTimeLogsFilters({}, ctx)).toMatchObject({ dateFrom: null, dateTo: null, userIds: [], search: null });
  });
});

describe("parsePagination", () => {
  it("defaults and clamps", () => {
    expect(parsePagination({})).toEqual({ page: 1, pageSize: 20 });
    expect(parsePagination({ page: "3", page_size: "50" })).toEqual({ page: 3, pageSize: 50 });
    expect(parsePagination({ page: -4, page_size: 100000 })).toEqual({ page: 1, pageSize: 100 });
    expect(parsePagination({ page: "abc", page_size: "abc" })).toEqual({ page: 1, pageSize: 20 });
  });
});
