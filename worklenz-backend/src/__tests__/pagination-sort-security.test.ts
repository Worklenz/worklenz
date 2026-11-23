import WorklenzControllerBase from "../controllers/worklenz-controller-base";

class PaginationForTest extends WorklenzControllerBase {
  static parse(field: unknown) {
    return this.toPaginationOptions({ field }, "name");
  }
}

describe("pagination sort fields", () => {
  it.each(["(SELECT pg_sleep(1))", "name DESC; SELECT 1", "name--", "null", undefined, ["name"]])(
    "rejects unsafe sort field %s", field => {
      expect(PaginationForTest.parse(field).sortField).toBe("name");
    }
  );
  it.each(["name", "projects.name", "created_at"])("preserves valid field %s", field => {
    expect(PaginationForTest.parse(field).sortField).toBe(field);
  });
});
