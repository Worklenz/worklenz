import { AssigneeResolutionContext } from "./types";

// Worklenz only has Low / Medium / High / Critical — there is no "Urgent"
// priority, so aliases must resolve to one of those four names or the value
// silently falls back to the default (Low) priority. Kept in sync with
// `resolvePriorityId` below; exported so both can be unit tested directly
// instead of only through a full `commit()` run.
export const PRIORITY_ALIASES: Record<string, string> = {
  highest: "critical",
  urgent: "critical",
  blocker: "critical",
  lowest: "low",
  minor: "low",
  trivial: "low",
  normal: "medium",
  moderate: "medium",
};

export const resolvePriorityId = (
  value: string | null | undefined,
  priorityMap: Map<string, string>,
  defaultPriorityId: string | null,
): string | null => {
  if (!value) return defaultPriorityId;
  const key = value.toString().trim().toLowerCase();
  return (
    priorityMap.get(key) ||
    priorityMap.get(PRIORITY_ALIASES[key] || key) ||
    defaultPriorityId
  );
};

export const lookupStatusId = (
  value: string | null | undefined,
  statusMap: Map<string, string>,
  sourcesToTargetStatus: Map<string, string>,
  defaultStatusId: string | null,
): string | null => {
  if (!value) return defaultStatusId;
  const key = value.toString().trim().toLowerCase();
  // Apply value mapping (e.g. "Doing" → "Doing") before status lookup
  const mappedKey = sourcesToTargetStatus.get(key) || key;
  return statusMap.get(mappedKey) || defaultStatusId;
};

export const normalizeAssigneeToken = (token: string) =>
  token.trim().toLowerCase().replace(/\s+/g, " ");

export const resolveAssignees = (
  value: string | null | undefined,
  ctx: AssigneeResolutionContext,
): string[] => {
  if (!ctx.shouldImportMembers || !value) return [];
  const normalized = value.toString().trim();
  if (!normalized) return [];
  const lower = normalized.toLowerCase();
  const nameKey = normalizeAssigneeToken(normalized);
  const teamMemberId =
    ctx.assigneeMap.get(normalized) ||
    ctx.assigneeMap.get(lower) ||
    ctx.teamMemberEmailMap.get(lower) ||
    ctx.teamMemberNameMap.get(nameKey);
  return teamMemberId ? [teamMemberId] : [];
};

export const parseDateValue = (value?: string | null): Date | null => {
  if (!value) return null;
  const input = value.toString().trim();
  if (!input) return null;

  // ISO/RFC timestamps and unambiguous ISO dates.
  if (/^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/.test(input)) {
    const parsed = new Date(input);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  // Common spreadsheet dates: D/M/Y or M/D/Y. If both first two values are
  // <= 12, retain the conventional M/D/Y interpretation used by JS/browser
  // CSV previews; an out-of-range month disambiguates D/M/Y automatically.
  const numeric = input.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  if (numeric) {
    const first = Number(numeric[1]);
    const second = Number(numeric[2]);
    const year = Number(numeric[3]);
    const month = first > 12 ? second : first;
    const day = first > 12 ? first : second;
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return parsed.getUTCFullYear() === year &&
      parsed.getUTCMonth() === month - 1 &&
      parsed.getUTCDate() === day
      ? parsed
      : null;
  }

  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const COMPLETED_DATE_KEYS = new Set([
  "completed on",
  "completed_on",
  "completed date",
  "completeddate",
  "completed",
]);

export const getRawCompletedValue = (raw: unknown): string | null => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const source = raw as Record<string, unknown>;
  for (const [key, value] of Object.entries(source)) {
    if (!COMPLETED_DATE_KEYS.has(key.trim().toLowerCase())) continue;
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
};
