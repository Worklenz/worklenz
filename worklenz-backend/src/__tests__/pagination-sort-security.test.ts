import WorklenzControllerBase from "../controllers/worklenz-controller-base";

class PaginationForTest extends WorklenzControllerBase {
  static parse(field: unknown, order?: unknown, allowedSortFields?: readonly string[]) {
    return this.toPaginationOptions({ field, order }, "name", false, 1, allowedSortFields);
  }
}

describe("pagination sort fields", () => {
  it.each(["(SELECT pg_sleep(1))", "name DESC; SELECT 1", "name--", "null", undefined, ["name"]])(
    "rejects unsafe sort field %s", field => {
      expect(PaginationForTest.parse(field).sortField).toBe("name");
    }
  );
  it("rejects identifiers outside an endpoint allowlist", () => {
    expect(PaginationForTest.parse("team_id", "desc", ["name", "id"])).toMatchObject({ sortField: "name", sortOrder: "desc" });
    expect(PaginationForTest.parse("id", "asc", ["name", "id"]).sortField).toBe("id");
  });
  it("handles non-string sort directions safely", () => {
    expect(PaginationForTest.parse("name", ["desc"]).sortOrder).toBe("asc");
  });
  it.each(["name", "projects.name", "created_at"])("preserves valid field %s", field => {
    expect(PaginationForTest.parse(field).sortField).toBe(field);
  });
});
