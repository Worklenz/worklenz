import {
  AUDIT_LOG_RETENTION_DEFAULT_MONTHS,
  AUDIT_LOG_RETENTION_MAX_MONTHS,
  AUDIT_LOG_RETENTION_MIN_MONTHS,
  AUDIT_LOG_RETENTION_OPTIONS,
  parseRetentionMonths,
} from "../shared/audit-log-retention";

describe("parseRetentionMonths", () => {
  it.each([3, 6, 12, 24])("accepts %i months", (months) => {
    expect(parseRetentionMonths(months)).toBe(months);
  });

  it("accepts numeric strings", () => {
    expect(parseRetentionMonths("12")).toBe(12);
  });

  it("accepts the exact min and max bounds", () => {
    expect(parseRetentionMonths(AUDIT_LOG_RETENTION_MIN_MONTHS)).toBe(AUDIT_LOG_RETENTION_MIN_MONTHS);
    expect(parseRetentionMonths(AUDIT_LOG_RETENTION_MAX_MONTHS)).toBe(AUDIT_LOG_RETENTION_MAX_MONTHS);
  });

  it.each([
    ["below min", AUDIT_LOG_RETENTION_MIN_MONTHS - 1],
    ["above max", AUDIT_LOG_RETENTION_MAX_MONTHS + 1],
    ["zero", 0],
    ["negative", -12],
    ["fractional", 6.5],
    ["fractional string", "6.5"],
    ["non-numeric string", "twelve"],
    ["empty string", ""],
    ["null", null],
    ["undefined", undefined],
    ["boolean", true],
    ["object", { months: 12 }],
    ["NaN", Number.NaN],
  ])("rejects %s", (_label, value) => {
    expect(parseRetentionMonths(value)).toBeNull();
  });

  it("keeps the default and every offered option inside the allowed range", () => {
    const values = [AUDIT_LOG_RETENTION_DEFAULT_MONTHS, ...AUDIT_LOG_RETENTION_OPTIONS];
    values.forEach((months) => expect(parseRetentionMonths(months)).toBe(months));
  });
});
