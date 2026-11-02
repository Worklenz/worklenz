jest.mock("../shared/utils", () => ({
  toTsQuery: jest.fn(),
}));

import WorklenzControllerBase from "../controllers/worklenz-controller-base";

class PaginationTestController extends WorklenzControllerBase {
  static getOptions(query: Record<string, unknown>, searchField: string | string[], paramOffset: number) {
    return this.toPaginationOptions(query, searchField, false, paramOffset);
  }
}

describe("shared pagination search", () => {
  it("matches decoded and HTML-escaped values with sequential parameters", () => {
    const options = PaginationTestController.getOptions(
      { search: "R&D", field: "null" },
      ["t.name", "p.name"],
      2
    );

    expect(options.searchQuery).toContain("t.name ILIKE $2");
    expect(options.searchQuery).toContain("t.name ILIKE $3");
    expect(options.searchQuery).toContain("p.name ILIKE $4");
    expect(options.searchQuery).toContain("p.name ILIKE $5");
    expect(options.searchParams).toEqual([
      "%R&D%",
      "%R&amp;D%",
      "%R&D%",
      "%R&amp;D%",
    ]);
  });

  it("decodes entity-encoded search input before building both variants", () => {
    const options = PaginationTestController.getOptions(
      { search: "R&amp;D", field: "null" },
      "t.name",
      1
    );

    expect(options.searchParams).toEqual(["%R&D%", "%R&amp;D%"]);
  });
});
