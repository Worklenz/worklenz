jest.unmock("../shared/csv-export");

import { sanitizeCsvValue } from "../shared/csv-export";

describe("csv-export", () => {
  describe("sanitizeCsvValue", () => {
    it.each(["=", "+", "-", "@", "\t", "\r"])(
      "prefixes a value starting with %s with a single quote",
      char => {
        expect(sanitizeCsvValue(`${char}cmd|' /C calc'!A1`)).toBe(
          `'${char}cmd|' /C calc'!A1`.replace(/"/g, '""')
        );
      }
    );

    it("does not prefix when the dangerous character is not leading", () => {
      expect(sanitizeCsvValue("Cost - Q1")).toBe("Cost - Q1");
      expect(sanitizeCsvValue("user@example.com")).toBe("user@example.com");
    });

    it("leaves normal values unchanged", () => {
      expect(sanitizeCsvValue("Task name")).toBe("Task name");
    });

    it("still doubles embedded double quotes", () => {
      expect(sanitizeCsvValue('Say "hi"')).toBe('Say ""hi""');
    });

    it("doubles quotes after prefixing a formula-triggering value", () => {
      expect(sanitizeCsvValue('=CMD("calc")')).toBe("'=CMD(\"\"calc\"\")");
    });

    it("returns an empty string for null/undefined/empty", () => {
      expect(sanitizeCsvValue(null)).toBe("");
      expect(sanitizeCsvValue(undefined)).toBe("");
      expect(sanitizeCsvValue("")).toBe("");
    });
  });
});
