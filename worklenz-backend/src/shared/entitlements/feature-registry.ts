import { PlanSourceKind, PlanTier } from "./types";

/**
 * Feature registry: the October 2026 plan matrix as data (product's matrix is the source of
 * truth; deviations are called out inline). Each feature has the lowest tier that includes it.
 *
 * - allowSources:  source kinds that get the feature even below minTier
 * - denySources:   source kinds that never get it, whatever their tier
 * - grandfathered: sources flagged grandfathered get it even below minTier
 */
export interface IFeatureDef {
  minTier: PlanTier;
  allowSources?: PlanSourceKind[];
  denySources?: PlanSourceKind[];
  grandfathered?: boolean;
}

const free = (extra: Partial<IFeatureDef> = {}): IFeatureDef => ({ minTier: "free", ...extra });
const pro = (extra: Partial<IFeatureDef> = {}): IFeatureDef => ({ minTier: "pro", ...extra });
const business = (extra: Partial<IFeatureDef> = {}): IFeatureDef => ({ minTier: "business", ...extra });

// Planner is Business-only in the UI today (PlannerLayout shows an upgrade preview to everyone
// else, Pro and AppSumo included). AppSumo is granted Timeline and Workload per the matrix; this
// is new access versus today's strict-LTD behavior, so it only takes effect when
// ENTITLEMENTS_ENFORCE is on.
const PLANNER_LTD: Partial<IFeatureDef> = { allowSources: ["appsumo_ltd", "appsumo_expansion"] };

export const FEATURE_REGISTRY = {
  // Project management
  task_list_view: free(),
  kanban_board: free(),
  project_phases: pro(),
  project_categories: pro(),
  project_archive: free(),
  project_subscribe: free(),
  project_managers: pro(),
  project_advanced_settings: free(),
  project_health: pro(),
  project_updates: free(),
  project_files: free(),
  task_attachments: free(),
  project_insights: pro(),
  project_roadmap: pro(),
  project_chat: free(),

  // Templates
  builtin_templates: free(),
  custom_project_templates: pro(),
  task_templates: pro(),

  // Task management
  task_comments: free(),
  task_labels: free(),
  task_priorities: free(),
  task_description: free(),
  task_archive: pro(),
  recurring_tasks: pro(),
  subtasks: free(),
  custom_fields: pro(),
  task_filters: free(),
  when_done_notification: pro(),
  billable_marking: free(),
  activity_log: pro(),
  task_dependencies: free(),

  // Time management
  live_timer: pro(),
  time_logging: pro(),
  time_estimation: free(),

  // Reporting
  reports_export: pro(),
  reports_projects: pro(),
  reports_members: pro(),
  reports_tasks_overview: pro(),
  reports_timesheet: pro(),
  reports_projects_time: pro(),
  reports_members_time: pro(),
  reports_estimated_vs_actual: pro(),
  reports_time_logs: pro(),
  advanced_reporting: business(),

  // Planner. Business only (Pro does not get it). Matrix: AppSumo has Gantt (timeline) and
  // Workload but not Schedule.
  planner_schedule: business(),
  planner_timeline: business(PLANNER_LTD),
  planner_workload: business(PLANNER_LTD),
  gantt_edit: business(),

  // Team management
  teams: free(),
  member_deactivation: free(),
  members_progress: pro({ denySources: ["appsumo_ltd"] }),
  team_lead_role: free(),

  // Finance
  finance_module: business(),
  billable_reporting: business(),

  // Personal productivity & UI
  personal_tasks: free(),
  personal_calendar: free(),
  personal_todo: free(),
  daily_digest: free(),
  theme_switch: free(),
  language_selection: free(),

  // Client portal
  client_portal: business(),
  client_portal_branding: business(),
  client_portal_requests: business(),
  client_portal_chats: business(),
  client_portal_services: business(),
  client_portal_invoices: business(),

  // Integrations & support
  slack_integration: business(),
  priority_support: business(),

  // Gated today but not listed in the matrix: registered at Business so current behavior is
  // preserved until product places them.
  task_export: business(),
  restrict_task_creation: business(),
} satisfies Record<string, IFeatureDef>;

export type FeatureKey = keyof typeof FEATURE_REGISTRY;

/** Any of these grants access to the Planner APIs (Schedule, Timeline, Workload). */
export const PLANNER_FEATURES: FeatureKey[] = ["planner_schedule", "planner_timeline", "planner_workload"];

export const FEATURE_KEYS = Object.keys(FEATURE_REGISTRY) as FeatureKey[];

/** Free-tier numeric limits, from the matrix. Paid tiers have no member cap (billed per user). */
export const FREE_MEMBER_LIMIT = 5;
export const FREE_PROJECT_LIMIT = 3;
export const UNLIMITED = -1;

/** Default guest allowance per tier (-1 = unlimited). */
export const TIER_GUEST_LIMIT: Record<PlanTier, number> = {
  free: 0,
  pro: 5,
  business: UNLIMITED,
  enterprise: UNLIMITED,
};

/** AppSumo: 5 seats per redeemed code, capped at 50. 5+ codes lift the guest limit. */
export const APPSUMO_SEATS_PER_CODE = 5;
export const APPSUMO_MAX_SEATS = 50;
export const APPSUMO_UNLIMITED_GUEST_CODE_COUNT = 5;
export const APPSUMO_LTD_GUEST_LIMIT = 5;
