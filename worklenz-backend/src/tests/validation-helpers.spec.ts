import {
  isValidUuid,
  isValidUuidArray,
  sanitizeString,
  sanitizeHtml,
  validateDateRange,
  validateEnum,
  validatePagination,
  isValidEmail,
  isValidInteger,
} from "../shared/validation-helpers";

describe("validation-helpers", () => {
  const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";
  const ANOTHER_VALID_UUID = "6fa459ea-ee8a-4ca4-894e-db77e160355e";

  describe("isValidUuid", () => {
    it("returns true for standard v4 UUID", () => {
      expect(isValidUuid(VALID_UUID)).toBe(true);
      expect(isValidUuid(ANOTHER_VALID_UUID)).toBe(true);
      expect(isValidUuid(`  ${VALID_UUID}  `)).toBe(true);
    });

    it("returns false for non-v4 or invalid formats", () => {
      expect(isValidUuid("not-a-uuid")).toBe(false);
      expect(isValidUuid("550e8400-e29b-01d4-a716-446655440000")).toBe(false); // not version 4
      expect(isValidUuid("")).toBe(false);
      expect(isValidUuid(null as any)).toBe(false);
      expect(isValidUuid(undefined as any)).toBe(false);
      expect(isValidUuid(12345 as any)).toBe(false);
    });
  });

  describe("isValidUuidArray", () => {
    it("returns true when every entry is a valid UUID", () => {
      expect(isValidUuidArray([VALID_UUID, ANOTHER_VALID_UUID])).toBe(true);
    });

    it("returns false if any element is invalid", () => {
      expect(isValidUuidArray([VALID_UUID, "invalid", ANOTHER_VALID_UUID])).toBe(false);
    });

    it("returns false for empty array or non-array inputs", () => {
      expect(isValidUuidArray([])).toBe(false);
      expect(isValidUuidArray(null as any)).toBe(false);
      expect(isValidUuidArray(undefined as any)).toBe(false);
      expect(isValidUuidArray("string" as any)).toBe(false);
    });
  });

  describe("sanitizeString", () => {
    it("strips null bytes and control characters while preserving newline and tabs", () => {
      const input = "Hello\0 World\x07!\nLine 2\tTabbed";
      const sanitized = sanitizeString(input);
      expect(sanitized).toBe("Hello World!\nLine 2\tTabbed");
    });

    it("truncates strings exceeding maxLength", () => {
      const longInput = "a".repeat(200);
      const sanitized = sanitizeString(longInput, 50);
      expect(sanitized.length).toBe(50);
    });

    it("handles non-string inputs gracefully", () => {
      expect(sanitizeString(null as any)).toBe("");
      expect(sanitizeString(undefined as any)).toBe("");
      expect(sanitizeString(1234 as any)).toBe("");
    });
  });

  describe("sanitizeHtml", () => {
    it("removes script tags and inline content", () => {
      const input = `<p>Safe text</p><script>alert('xss');</script><span>More text</span>`;
      const output = sanitizeHtml(input);
      expect(output).not.toContain("<script");
      expect(output).not.toContain("alert");
      expect(output).toContain("<p>Safe text</p>");
      expect(output).toContain("<span>More text</span>");
    });

    it("removes dangerous event handler attributes", () => {
      const input = `<img src="pic.jpg" onerror="alert('hack')" onload="foo()" />`;
      const output = sanitizeHtml(input);
      expect(output).not.toContain("onerror");
      expect(output).not.toContain("onload");
    });

    it("removes javascript: protocol", () => {
      const input = `<a href="javascript:doBadStuff()">Click me</a>`;
      const output = sanitizeHtml(input);
      expect(output).not.toContain("javascript:");
    });

    it("returns empty string for non-string input", () => {
      expect(sanitizeHtml(null as any)).toBe("");
      expect(sanitizeHtml(undefined as any)).toBe("");
    });
  });

  describe("validateDateRange", () => {
    it("returns isValid: true for valid date range", () => {
      const res = validateDateRange("2024-01-01", "2024-01-15");
      expect(res.isValid).toBe(true);
      expect(res.error).toBeUndefined();
    });

    it("accepts Date objects directly", () => {
      const start = new Date("2024-05-01");
      const end = new Date("2024-05-10");
      expect(validateDateRange(start, end).isValid).toBe(true);
    });

    it("returns error when start date is after end date", () => {
      const res = validateDateRange("2024-06-15", "2024-06-01");
      expect(res.isValid).toBe(false);
      expect(res.error).toContain("Start date must be before or equal to end date");
    });

    it("returns error when start or end date is invalid", () => {
      expect(validateDateRange("invalid-date", "2024-01-01").isValid).toBe(false);
      expect(validateDateRange("2024-01-01", "not-a-date").isValid).toBe(false);
    });

    it("enforces maximum allowed range in days", () => {
      const res = validateDateRange("2024-01-01", "2025-06-01", 100);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain("Date range cannot exceed 100 days");
    });
  });

  describe("validateEnum", () => {
    const ALLOWED = ["TODO", "IN_PROGRESS", "DONE"];

    it("validates allowed values case-sensitively by default", () => {
      expect(validateEnum("TODO", ALLOWED)).toBe(true);
      expect(validateEnum("todo", ALLOWED)).toBe(false);
      expect(validateEnum("ARCHIVED", ALLOWED)).toBe(false);
    });

    it("validates case-insensitively when caseSensitive is false", () => {
      expect(validateEnum("todo", ALLOWED, false)).toBe(true);
      expect(validateEnum("In_Progress", ALLOWED, false)).toBe(true);
      expect(validateEnum("archived", ALLOWED, false)).toBe(false);
    });

    it("returns false for invalid inputs", () => {
      expect(validateEnum("", ALLOWED)).toBe(false);
      expect(validateEnum("TODO", [])).toBe(false);
      expect(validateEnum(null as any, ALLOWED)).toBe(false);
    });
  });

  describe("validatePagination", () => {
    it("normalizes standard positive numbers", () => {
      const res = validatePagination(2, 20);
      expect(res).toEqual({
        page: 2,
        pageSize: 20,
        offset: 20,
      });
    });

    it("normalizes string parameters", () => {
      const res = validatePagination("3", "15");
      expect(res).toEqual({
        page: 3,
        pageSize: 15,
        offset: 30,
      });
    });

    it("falls back to defaults for undefined, zero, or negative numbers", () => {
      const res1 = validatePagination(undefined, undefined);
      expect(res1).toEqual({
        page: 1,
        pageSize: 10,
        offset: 0,
      });

      const res2 = validatePagination(-5, 0);
      expect(res2).toEqual({
        page: 1,
        pageSize: 10,
        offset: 0,
      });
    });

    it("caps pageSize to maxPageSize", () => {
      const res = validatePagination(1, 500, 50);
      expect(res.pageSize).toBe(50);
    });
  });

  describe("isValidEmail", () => {
    it("validates standard email addresses", () => {
      expect(isValidEmail("user@example.com")).toBe(true);
      expect(isValidEmail("first.last@company.co.uk")).toBe(true);
      expect(isValidEmail("  user+tag@domain.org  ")).toBe(true);
    });

    it("rejects invalid emails", () => {
      expect(isValidEmail("not-an-email")).toBe(false);
      expect(isValidEmail("user@")).toBe(false);
      expect(isValidEmail("@domain.com")).toBe(false);
      expect(isValidEmail("")).toBe(false);
      expect(isValidEmail(null as any)).toBe(false);
    });
  });

  describe("isValidInteger", () => {
    it("validates integer numbers and strings", () => {
      expect(isValidInteger(42)).toBe(true);
      expect(isValidInteger("42")).toBe(true);
      expect(isValidInteger(0)).toBe(true);
      expect(isValidInteger("-10")).toBe(true);
    });

    it("rejects non-integers and invalid formats", () => {
      expect(isValidInteger(3.14)).toBe(false);
      expect(isValidInteger("abc")).toBe(false);
      expect(isValidInteger(NaN)).toBe(false);
    });

    it("respects min and max constraints", () => {
      expect(isValidInteger(5, 1, 10)).toBe(true);
      expect(isValidInteger(0, 1, 10)).toBe(false);
      expect(isValidInteger(15, 1, 10)).toBe(false);
      expect(isValidInteger("5", 1, 10)).toBe(true);
    });
  });
});
