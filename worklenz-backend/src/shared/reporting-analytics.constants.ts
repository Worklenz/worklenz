/** Shared limits for Reporting & Analytics (Phase 0). Keep in sync with frontend mirror. */

export const MAX_GADGETS_PER_DASHBOARD = 20;
export const MAX_VELOCITY_TEMPLATES_PER_USER = 20;
export const MAX_WORKSPACE_VELOCITY_TEMPLATES = 10;
export const STATUS_HISTORY_RETENTION_MONTHS = 24;
export const TEMPLATE_NAME_MAX_LENGTH = 60;
/** Days the sidebar NEW badge stays visible after feature launch. */
export const ANALYTICS_NEW_BADGE_DAYS = 30;

/**
 * Feature launch date for NEW badges (UTC midnight).
 * Bump when shipping analytics to users so the 30-day window restarts.
 */
export const ANALYTICS_FEATURE_LAUNCH_ISO = "2026-10-27T00:00:00.000Z";

/** v1 gadget catalogue — Embed/iFrame intentionally omitted (OQ-8). */
export const GADGET_CATALOGUE_V1 = [
  "sprint_progress",
  "issue_count",
  "burndown",
  "burnup",
  "velocity",
  "cumulative_flow",
  "time_in_status",
  "sla_compliance",
  "sla_breaches",
  "assignee_workload",
  "priority_breakdown",
  "created_vs_resolved",
  "average_age",
  "recent_activity",
] as const;

export type AnalyticsGadgetType = (typeof GADGET_CATALOGUE_V1)[number];

export const ANALYTICS_CACHE_TTL_SECONDS = 15 * 60;
export const ANALYTICS_ROUTE_PREFIX = "/analytics";

/** Built-in reports that can own saved filters; keep aligned with analytics navigation. */
export const ANALYTICS_REPORT_KINDS = [
  "project-health",
  "planned-vs-actual-tasks",
  "planned-vs-actual-milestones",
  "utilization",
  "time-report",
  "budget-tracking",
  "velocity",
  "cumulative-flow",
  "time-in-status",
  "sla",
] as const;

// Preserve each report's allowance while bounding totals, including legacy report kinds.
export const MAX_ANALYTICS_TEMPLATES_PER_USER =
  MAX_VELOCITY_TEMPLATES_PER_USER * ANALYTICS_REPORT_KINDS.length;
export const MAX_WORKSPACE_ANALYTICS_TEMPLATES =
  MAX_WORKSPACE_VELOCITY_TEMPLATES * ANALYTICS_REPORT_KINDS.length;
export const TEMPLATE_FILTERS_MAX_BYTES = 16 * 1024;
