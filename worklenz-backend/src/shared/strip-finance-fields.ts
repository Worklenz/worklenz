/**
 * Phase 4 — omit financial fields from API payloads when the caller
 * does not have project finance access.
 */

const PROJECT_FINANCE_KEYS = [
  "budget",
  "calculation_method",
] as const;

/** Fields commonly returned on task/finance payloads. */
const TASK_FINANCE_KEYS = [
  "fixed_cost",
  "actual_cost",
  "time_based_cost",
  "billable_cost",
  "rate_per_hour",
  "man_day_rate",
  "cost",
  "expense",
] as const;

export const stripProjectFinanceFields = <T extends Record<string, unknown>>(
  project: T | null | undefined,
  hasFinanceAccess: boolean
): T | null | undefined => {
  if (!project || hasFinanceAccess) {
    return project;
  }

  const next = { ...project } as Record<string, unknown>;
  for (const key of PROJECT_FINANCE_KEYS) {
    if (key in next) {
      next[key] = null;
    }
  }
  return next as T;
};

export const stripTaskFinanceFields = <T extends Record<string, unknown>>(
  task: T | null | undefined,
  hasFinanceAccess: boolean
): T | null | undefined => {
  if (!task || hasFinanceAccess) {
    return task;
  }

  const next = { ...task } as Record<string, unknown>;
  for (const key of TASK_FINANCE_KEYS) {
    if (key in next) {
      delete next[key];
    }
  }
  return next as T;
};

export const stripFinanceFromTemplateSettings = (
  settings: Record<string, unknown> | null | undefined,
  hasFinanceAccess: boolean
): Record<string, unknown> | null | undefined => {
  if (!settings || hasFinanceAccess) {
    return settings;
  }

  const next = { ...settings };
  if ("budget" in next) {
    delete next.budget;
  }
  return next;
};
