/**
 * Audit Log retention policy — Audit log spec, task 6.1.
 *
 * Spike 0.4 left the configurable range open, so it is taken from the design mockup's
 * retention pill (3 / 6 / 12 / 24 months, default 12). The DB CHECK on
 * organizations.audit_log_retention_months (1-120) is only a sanity bound; this module is the
 * product policy and can widen without a migration as long as it stays inside 1-120.
 */
export const AUDIT_LOG_RETENTION_MIN_MONTHS = 3;
export const AUDIT_LOG_RETENTION_MAX_MONTHS = 24;
export const AUDIT_LOG_RETENTION_DEFAULT_MONTHS = 12;
export const AUDIT_LOG_RETENTION_PCI_MIN_MONTHS = 12;
export const AUDIT_LOG_RETENTION_OPTIONS = [3, 6, 12, 24] as const;

/** Returns the value as a whole number of months if it is within the allowed range, else null. */
export const parseRetentionMonths = (value: unknown): number | null => {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !/^\s*\d+\s*$/.test(value)) return null;

  const months = Number(value);
  if (!Number.isInteger(months)) return null;
  if (months < AUDIT_LOG_RETENTION_MIN_MONTHS || months > AUDIT_LOG_RETENTION_MAX_MONTHS) return null;

  return months;
};
