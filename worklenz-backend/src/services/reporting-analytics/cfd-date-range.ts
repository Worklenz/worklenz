import { STATUS_HISTORY_RETENTION_MONTHS } from "../../shared/reporting-analytics.constants";

export class InvalidCfdDateRangeError extends Error {}

/** Bound allocation and database work even when callers bypass filter parsing. */
export function cfdDatesInclusive(from: string, to: string): string[] {
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  const dayCount = (end.getTime() - start.getTime()) / 86400000 + 1;
  if (!Number.isInteger(dayCount) || dayCount < 1 ||
      dayCount > STATUS_HISTORY_RETENTION_MONTHS * 31 + 1 ||
      to > new Date().toISOString().slice(0, 10)) {
    throw new InvalidCfdDateRangeError("Invalid CFD date range");
  }
  return Array.from({ length: dayCount }, (_, i) =>
    new Date(start.getTime() + i * 86400000).toISOString().slice(0, 10)
  );
}
