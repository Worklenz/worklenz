import { SqlHelper } from "../shared/sql-helpers";

describe("SQL placeholder safety", () => {
  it("keeps hostile filter values exclusively in bound parameters", () => {
    const value = "'); DROP TABLE users; --";
    expect(SqlHelper.buildInClause([value, "member-2"], 3)).toEqual({
      clause: "$3, $4",
      params: [value, "member-2"],
    });
  });

  it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER])(
    "rejects unsafe placeholder offsets: %s",
    (offset) => {
      expect(() => SqlHelper.buildInClause(["id"], offset)).toThrow(RangeError);
    },
  );

  it("rejects a string that could alter the SQL rather than a numeric offset", () => {
    expect(() =>
      SqlHelper.buildInClause(
        ["id"],
        "1); DROP TABLE users;--" as unknown as number,
      ),
    ).toThrow(RangeError);
  });
});


it("rejects a string sent where a filter array is required", () => {
  expect(() => SqlHelper.buildInClause("member-1" as unknown as string[])).toThrow(TypeError);
});
