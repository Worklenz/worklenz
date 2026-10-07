import {
  buildProgressTrackingListQuery,
  parseDeliveryConfidenceNote,
  parseDeliveryConfidenceStatus,
  UNSORTED_ORDER_BY,
} from "../controllers/reporting/progress-tracking/progress-tracking-query";

describe("buildProgressTrackingListQuery", () => {
  it("uses the unsorted default order, not a name sort, when no sort field is sent", () => {
    const query = buildProgressTrackingListQuery({}, 3);

    expect(query.orderBySql).toBe(UNSORTED_ORDER_BY);
    expect(query.orderBySql.startsWith("name")).toBe(false);
  });

  it("ignores a sort order sent without a sort field", () => {
    const query = buildProgressTrackingListQuery({ sortOrder: "desc" }, 3);
    expect(query.orderBySql).toBe(UNSORTED_ORDER_BY);
  });

  it("falls back to the unsorted order for a sort field that is not in the allow list", () => {
    const query = buildProgressTrackingListQuery(
      { sortField: "name; DROP TABLE projects", sortOrder: "desc" },
      3
    );

    expect(query.orderBySql).toBe(UNSORTED_ORDER_BY);
    expect(query.orderBySql).not.toContain("DROP");
    expect(query.whereSql).toBe("TRUE");
    expect(query.params).toEqual([]);
  });

  it("sorts by project name when name is requested explicitly", () => {
    const query = buildProgressTrackingListQuery({ sortField: "name", sortOrder: "desc" }, 3);
    expect(query.orderBySql.startsWith("name DESC")).toBe(true);
  });

  it("puts Off track first when sorting confidence ascending", () => {
    const query = buildProgressTrackingListQuery({ sortField: "confidence", sortOrder: "asc" }, 3);
    expect(query.orderBySql.startsWith("confidence_rank ASC")).toBe(true);
  });

  it("filters unset confidence with IS NULL and never defaults it to green", () => {
    const query = buildProgressTrackingListQuery({ confidence: "unset" }, 3);
    expect(query.whereSql).toContain("confidence IS NULL");
    expect(query.whereSql).not.toContain("green");
    expect(query.params).toEqual([]);
  });

  it("binds a confidence color and a search pattern, including encoded names", () => {
    const query = buildProgressTrackingListQuery(
      { confidence: "red", search: "A & B" },
      3
    );

    expect(query.whereSql).toContain("confidence = $5");
    expect(query.params[0]).toBe("%A & B%");
    expect(query.params[1]).toBe("%A &amp; B%");
    expect(query.params[2]).toBe("red");
  });

  it("keeps zero-task projects out of the numeric percent buckets", () => {
    const noTasks = buildProgressTrackingListQuery({ percentRange: "no_tasks" }, 3);
    const low = buildProgressTrackingListQuery({ percentRange: "0_25", hasBlockers: true }, 3);

    expect(noTasks.whereSql).toContain("percent_complete IS NULL");
    expect(low.whereSql).toContain("percent_complete BETWEEN 0 AND 25");
    expect(low.whereSql).toContain("blocked_count > 0");
  });

  it("escapes LIKE wildcards in search", () => {
    const query = buildProgressTrackingListQuery({ search: "100%" }, 3);
    expect(query.params[0]).toBe("%100\\%%");
    expect(query.whereSql).toContain("ESCAPE");
  });
});

describe("delivery confidence parsers", () => {
  it("treats unset as null and rejects unknown colors", () => {
    expect(parseDeliveryConfidenceStatus(null)).toEqual({ ok: true, status: null });
    expect(parseDeliveryConfidenceStatus("unset")).toEqual({ ok: true, status: null });
    expect(parseDeliveryConfidenceStatus("amber")).toEqual({ ok: true, status: "amber" });
    expect(parseDeliveryConfidenceStatus("yellow").ok).toBe(false);
  });

  it("trims notes, strips tags, and rejects notes over 280 characters", () => {
    expect(parseDeliveryConfidenceNote("  slipping <b>due</b> to vendor  ")).toEqual({
      ok: true,
      note: "slipping due to vendor",
    });
    expect(parseDeliveryConfidenceNote("   ")).toEqual({ ok: true, note: null });
    expect(parseDeliveryConfidenceNote("a".repeat(281)).ok).toBe(false);
  });
});
