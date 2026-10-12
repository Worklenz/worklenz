/**
 * Effective hourly rate for time-based cost, honoring an organization's
 * man_days calculation method. Shared by finance-overview-controller.ts
 * (PORTFOLIO_FINANCE_SQL) and finance-reports-controller.ts (Budgets,
 * Billable Time, Profitability, Forecasts) so the same cost figure is
 * computed everywhere data is rolled up from task_work_log — this is the
 * single source of truth for that formula; do not reimplement it inline.
 *
 * Expects an `fprr` alias in scope from a join to
 * finance_project_rate_card_roles via project_members.project_rate_card_role_id
 * (see RATE_JOINS in finance-reports-controller.ts, or the equivalent join
 * inside PORTFOLIO_FINANCE_SQL).
 *
 * calcMethod/hoursPerDay must come from the organization's own settings
 * (not user input) — they're embedded as SQL literals here, not bound
 * query parameters.
 */
export const buildRateSql = (calcMethod: string, hoursPerDay: number): string => {
  const safeHoursPerDay = Number.isFinite(hoursPerDay) && hoursPerDay > 0 ? hoursPerDay : 8;
  if (calcMethod === "man_days") {
    return `
      COALESCE(
        NULLIF(fprr.man_day_rate, 0) / ${safeHoursPerDay},
        fprr.rate,
        0
      )::FLOAT
    `;
  }
  return `
    COALESCE(
      fprr.rate,
      0
    )::FLOAT
  `;
};
