jest.unmock("../shared/template-copy-name");

import {
  allocateCopyName,
  stripCopyNameRoot,
} from "../shared/template-copy-name";

describe("template-copy-name", () => {
  describe("stripCopyNameRoot", () => {
    it("returns the base name", () => {
      expect(stripCopyNameRoot("Temp 1")).toBe("Temp 1");
    });

    it("strips Copy of prefixes and numbering", () => {
      expect(stripCopyNameRoot("Copy of Temp 1")).toBe("Temp 1");
      expect(stripCopyNameRoot("Copy of Temp 1 (2)")).toBe("Temp 1");
      expect(stripCopyNameRoot("Copy of Copy of Temp 1")).toBe("Temp 1");
    });

    it("falls back for empty names", () => {
      expect(stripCopyNameRoot("")).toBe("Template");
      expect(stripCopyNameRoot("   ")).toBe("Template");
    });
  });

  describe("allocateCopyName", () => {
    it("prefixes Copy of when free", () => {
      expect(allocateCopyName("Temp 1", [])).toBe("Copy of Temp 1");
    });

    it("numbers when Copy of root already exists", () => {
      expect(
        allocateCopyName("Temp 1", ["Copy of Temp 1", "Other"])
      ).toBe("Copy of Temp 1 (2)");
      expect(
        allocateCopyName("Temp 1", ["Copy of Temp 1", "Copy of Temp 1 (2)"])
      ).toBe("Copy of Temp 1 (3)");
    });

    it("does not create Copy of Copy of chains", () => {
      expect(allocateCopyName("Copy of Temp 1", ["Copy of Temp 1"])).toBe(
        "Copy of Temp 1 (2)"
      );
      expect(
        allocateCopyName("Copy of Temp 1 (2)", [
          "Copy of Temp 1",
          "Copy of Temp 1 (2)",
        ])
      ).toBe("Copy of Temp 1 (3)");
    });

    it("is case-insensitive against existing names", () => {
      expect(allocateCopyName("Temp 1", ["copy of temp 1"])).toBe(
        "Copy of Temp 1 (2)"
      );
    });
  });
});
