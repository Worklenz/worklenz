#!/usr/bin/env node
'use strict';

/**
 * Converts existing SQL migrations to node-pg-migrate JS format.
 * Run once: node scripts/generate-pg-migrations.js
 */

const fs   = require('fs');
const path = require('path');

const ROOT      = path.join(__dirname, '..');
const OUT_DIR   = path.join(ROOT, 'database', 'pg-migrations');

// ---------------------------------------------------------------------------
// Idempotency transformations
// ---------------------------------------------------------------------------

function makeIdempotent(sql) {
  let s = sql;

  // CREATE TABLE → IF NOT EXISTS
  s = s.replace(/\bCREATE TABLE\b(?!\s+IF\s+NOT\s+EXISTS\b)/gi,
    'CREATE TABLE IF NOT EXISTS');

  // ADD COLUMN → IF NOT EXISTS  (handles multi-line)
  s = s.replace(/\bADD COLUMN\b(?!\s+IF\s+NOT\s+EXISTS\b)/gi,
    'ADD COLUMN IF NOT EXISTS');

  // ALTER TABLE … ADD CONSTRAINT → skip silently when duplicate
  s = s.replace(
    /\bADD CONSTRAINT\b(?!\s+IF\s+NOT\s+EXISTS\b)/gi,
    'ADD CONSTRAINT IF NOT EXISTS'
  );

  // CREATE [UNIQUE] INDEX → IF NOT EXISTS
  s = s.replace(/\bCREATE UNIQUE INDEX\b(?!\s+IF\s+NOT\s+EXISTS\b)/gi,
    'CREATE UNIQUE INDEX IF NOT EXISTS');
  s = s.replace(/\bCREATE INDEX\b(?!\s+IF\s+NOT\s+EXISTS\b)/gi,
    'CREATE INDEX IF NOT EXISTS');

  // CREATE SEQUENCE → IF NOT EXISTS
  s = s.replace(/\bCREATE SEQUENCE\b(?!\s+IF\s+NOT\s+EXISTS\b)/gi,
    'CREATE SEQUENCE IF NOT EXISTS');

  // DROP TABLE / INDEX / SEQUENCE → IF EXISTS
  s = s.replace(/\bDROP TABLE\b(?!\s+IF\s+EXISTS\b)/gi,   'DROP TABLE IF EXISTS');
  s = s.replace(/\bDROP INDEX\b(?!\s+IF\s+EXISTS\b)/gi,   'DROP INDEX IF EXISTS');
  s = s.replace(/\bDROP SEQUENCE\b(?!\s+IF\s+EXISTS\b)/gi,'DROP SEQUENCE IF EXISTS');

  return s;
}

// Escape backticks inside the SQL so it can be used inside a JS template literal
function escapeForTemplateLiteral(str) {
  return str.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
}

// ---------------------------------------------------------------------------
// JS migration template
// ---------------------------------------------------------------------------

function buildMigrationJS(description, sql) {
  const safe = escapeForTemplateLiteral(makeIdempotent(sql));
  return `'use strict';
// ${description}

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(\`
${safe}
  \`);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // This migration is a DDL/function change — no automatic rollback defined.
  // Review manually before running migrate:down.
};
`;
}

// ---------------------------------------------------------------------------
// Migration list  (Unix ms timestamps, ordered chronologically)
// ---------------------------------------------------------------------------
// Timestamps for undated files are estimated from context / project history.
// Two files on the same date get +1 ms increments.

const MIGRATIONS = [
  // ── Undated / pre-history ─────────────────────────────────────────────────
  { ts: 1735689600000, rel: 'database/sql/migrations/add_member_time_off_table.sql',            name: 'add_member_time_off_table' },
  { ts: 1735689601000, rel: 'database/sql/migrations/run_member_time_off_migration.sql',         name: 'run_member_time_off_migration' },
  { ts: 1735776000000, rel: 'database/migrations/001_add_appsumo_plan_tables.sql',               name: 'add_appsumo_plan_tables' },
  { ts: 1735862400000, rel: 'database/migrations/user_deletion_logs.sql',                        name: 'add_user_deletion_logs' },
  { ts: 1735948800000, rel: 'database/migrations/fix-create-task-assignee-duplicate.sql',        name: 'fix_create_task_assignee_duplicate' },
  { ts: 1736035200000, rel: 'database/migrations/fix-update-team-member-return-type.sql',        name: 'fix_update_team_member_return_type' },
  { ts: 1736121600000, rel: 'database/migrations/fix_duplicate_sort_orders.sql',                 name: 'fix_duplicate_sort_orders' },

  // ── 2025-01-15 ─────────────────────────────────────────────────────────────
  { ts: 1736899200000, rel: 'database/migrations/20250115000000-performance-indexes.sql',         name: 'performance_indexes' },
  { ts: 1737331200000, rel: 'database/migrations/20250123000001-optimize-reporting-members-indexes.sql', name: 'optimize_reporting_members_indexes' },
  { ts: 1737936000000, rel: 'database/migrations/20250128000000-fix-window-function-error.sql',  name: 'fix_window_function_error' },
  { ts: 1738195200000, rel: 'database/migrations/20250130000000-add-holiday-calendar.sql',       name: 'add_holiday_calendar' },
  { ts: 1738195201000, rel: 'database/migrations/20250130000001-create-slack-integration.sql',   name: 'create_slack_integration' },
  { ts: 1738627200000, rel: 'database/migrations/20250204000000-add-custom-columns-to-templates.sql', name: 'add_custom_columns_to_templates' },
  { ts: 1740096000000, rel: 'database/migrations/20250221000000-add-sort-order-columns-to-cpt-tasks.sql', name: 'add_sort_order_columns_to_cpt_tasks' },

  // ── Release 2.1.2 (Jul 2025) ───────────────────────────────────────────────
  { ts: 1752537600000, rel: 'database/migrations/release-2.1.2/20250715000000-add-grouping-sort-orders.sql',  name: 'add_grouping_sort_orders' },
  { ts: 1752537601000, rel: 'database/migrations/release-2.1.2/20250715000001-update-sort-functions.sql',     name: 'update_sort_functions' },
  { ts: 1752537602000, rel: 'database/migrations/release-2.1.2/20250715000002-fix-sort-constraint.sql',       name: 'fix_sort_constraint' },

  // ── Release 2.1.4 (Jul 2025) ───────────────────────────────────────────────
  { ts: 1753315200000, rel: 'database/migrations/release-v2.1.4/20250724000000-add-survey-tables.sql',        name: 'add_survey_tables' },

  // ── Release 2.2.0 — client portal core (Jul–Aug 2025) ─────────────────────
  { ts: 1753401600000, rel: 'database/migrations/release-v2.2.0/20250101000001-create-client-portal-tables.sql',   name: 'create_client_portal_tables' },
  { ts: 1753401601000, rel: 'database/migrations/release-v2.2.0/20250101000002-enhance-existing-tables.sql',        name: 'enhance_existing_tables_for_portal' },
  { ts: 1753401602000, rel: 'database/migrations/release-v2.2.0/20250101000003-create-client-portal-functions.sql', name: 'create_client_portal_functions' },
  { ts: 1753401603000, rel: 'database/migrations/release-v2.2.0/20250101000004-create-client-portal-triggers.sql',  name: 'create_client_portal_triggers' },
  { ts: 1753401604000, rel: 'database/migrations/release-v2.2.0/20250101000005-create-client-portal-views.sql',     name: 'create_client_portal_views' },
  { ts: 1753401605000, rel: 'database/migrations/release-v2.2.0/20250101000006-seed-client-portal-data.sql',        name: 'seed_client_portal_data' },
  { ts: 1753401606000, rel: 'database/migrations/release-v2.2.0/20250101000007-create-message-reads-table.sql',     name: 'create_message_reads_table' },
  { ts: 1753401607000, rel: 'database/migrations/release-v2.2.0/003-create-client-invitations.sql',                 name: 'create_client_invitations' },
  { ts: 1753401608000, rel: 'database/migrations/release-v2.2.0/004-add-assigned-to-requests.sql',                  name: 'add_assigned_to_requests' },
  { ts: 1753401609000, rel: 'database/migrations/release-v2.2.0/005-create-organization-invitations.sql',           name: 'create_organization_invitations' },
  { ts: 1753488000000, rel: 'database/migrations/release-v2.2.0/20250718000001-fix-client-portal-triggers.sql',     name: 'fix_client_portal_triggers' },

  // ── Release 2.2.1 — business plan trial ───────────────────────────────────
  { ts: 1753574400000, rel: 'database/migrations/release-v2.2.1-business-plan-trial/002_add_plan_trials.sql',                      name: 'add_plan_trials' },
  { ts: 1753574401000, rel: 'database/migrations/release-v2.2.1-business-plan-trial/002-add-user-limit-to-pricing-plans.sql',       name: 'add_user_limit_to_pricing_plans' },
  { ts: 1753574402000, rel: 'database/migrations/release-v2.2.1-business-plan-trial/003_update_deserialize_user_for_plan_trials.sql', name: 'update_deserialize_user_for_plan_trials' },
  { ts: 1753574403000, rel: 'database/migrations/release-v2.2.1-business-plan-trial/004_auto_start_business_trial_on_signup.sql',   name: 'auto_start_business_trial_on_signup' },

  // ── Progress tracking (Apr–May 2025) ───────────────────────────────────────
  { ts: 1745366400000, rel: 'database/migrations/20250422132400-manual-task-progress.sql',                      name: 'manual_task_progress' },
  { ts: 1745452800000, rel: 'database/migrations/20250423000000-subtask-manual-progress.sql',                   name: 'subtask_manual_progress' },
  { ts: 1745539200000, rel: 'database/migrations/20250424000000-add-progress-and-weight-activity-types.sql',    name: 'add_progress_and_weight_activity_types' },
  { ts: 1745625600000, rel: 'database/migrations/20250425000000-update-time-based-progress.sql',                name: 'update_time_based_progress' },
  { ts: 1745712000000, rel: 'database/migrations/20250426000000-improve-parent-task-progress-calculation.sql',  name: 'improve_parent_task_progress_calculation' },
  { ts: 1745712001000, rel: 'database/migrations/20250426000000-update-progress-mode-handlers.sql',             name: 'update_progress_mode_handlers' },
  { ts: 1745798400000, rel: 'database/migrations/20250427000000-fix-progress-mode-type.sql',                    name: 'fix_progress_mode_type' },
  { ts: 1746576000000, rel: 'database/migrations/20250506000000-fix-multilevel-subtask-progress-calculation.sql', name: 'fix_multilevel_subtask_progress_calculation' },

  // ── Release 2.2.2 — team lead role (Sep 2025) ─────────────────────────────
  { ts: 1758326400000, rel: 'database/migrations/add-role-name-to-session.sql',                                                        name: 'add_role_name_to_session' },
  { ts: 1758326401000, rel: 'database/migrations/add-team-lead-role-migration.sql',                                                    name: 'add_team_lead_role_migration' },
  { ts: 1758412800000, rel: 'database/migrations/release-v2.2.2-team-lead-role/20250922000000-add-reports-to-team-members.sql',        name: 'add_reports_to_team_members' },
  { ts: 1758412801000, rel: 'database/migrations/release-v2.2.2-team-lead-role/20250922000001-create-team-lead-member-views.sql',      name: 'create_team_lead_member_views' },
  { ts: 1758412802000, rel: 'database/migrations/release-v2.2.2-team-lead-role/20250922000002-fix-team-lead-admin-privileges.sql',     name: 'fix_team_lead_admin_privileges' },
  { ts: 1758412803000, rel: 'database/migrations/release-v2.2.2-team-lead-role/20250922000003-fix-team-lead-view-admin-condition.sql', name: 'fix_team_lead_view_admin_condition' },
  { ts: 1758412804000, rel: 'database/migrations/release-v2.2.2-team-lead-role/20250922000003-update-team-creation-functions.sql',     name: 'update_team_creation_functions' },
  { ts: 1758412805000, rel: 'database/migrations/release-v2.2.2-team-lead-role/20250922000004-update-permission-functions.sql',        name: 'update_permission_functions' },

  // ── Holiday settings (Jul 2025) ────────────────────────────────────────────
  { ts: 1753574500000, rel: 'database/migrations/20250728000000-add-organization-holiday-settings.sql', name: 'add_organization_holiday_settings' },

  // ── Project logs / i18n (Sep 2025) ────────────────────────────────────────
  { ts: 1757289600000, rel: 'database/migrations/20250910000001-preserve-project-logs-after-deletion.sql', name: 'preserve_project_logs_after_deletion' },
  { ts: 1757289601000, rel: 'database/migrations/20250910000002-add-i18n-logging-support.sql',              name: 'add_i18n_logging_support' },

  // ── Email tracking (Sep 2025) ──────────────────────────────────────────────
  { ts: 1759377600000, rel: 'database/migrations/20250929000000-enhance-email-tracking.sql', name: 'enhance_email_tracking' },

  // ── Invitation links (Nov 2025) ────────────────────────────────────────────
  { ts: 1762617600000, rel: 'database/migrations/20251106000000-create-invitation-links.sql', name: 'create_invitation_links' },

  // ── Apple sign-in (Nov 2025) ───────────────────────────────────────────────
  { ts: 1763049600000, rel: 'database/migrations/20251112000001-add-apple-sign-in-support.sql',        name: 'add_apple_sign_in_support' },
  { ts: 1763049601000, rel: 'database/migrations/20251112000002-add-register-apple-user-function.sql', name: 'add_register_apple_user_function' },

  // ── Release 2.2.3 (Dec 2025) ──────────────────────────────────────────────
  { ts: 1766448000000, rel: 'database/migrations/release-v2.2.3/20251223000000-add-sort-order-columns-to-cpt-tasks.sql', name: 'add_sort_order_columns_to_cpt_tasks_v2' },

  // ── Dec 2025 miscellaneous ────────────────────────────────────────────────
  { ts: 1766188800000, rel: 'database/migrations/20251211000000-create-client-portal-notification-reads.sql', name: 'create_client_portal_notification_reads' },
  { ts: 1766188801000, rel: 'database/migrations/20251211-duplicate-task.sql',                                name: 'add_duplicate_task_function' },
  { ts: 1766275200000, rel: 'database/migrations/20251216000000-fix-create-project-member-team-lead-access-level.sql', name: 'fix_create_project_member_team_lead_access_level' },
  { ts: 1766275201000, rel: 'database/migrations/20251216000000-optimize-subtask-filtering.sql',               name: 'optimize_subtask_filtering' },
  { ts: 1766361600000, rel: 'database/migrations/20251217000000-fix-task-completed-date-trigger.sql',          name: 'fix_task_completed_date_trigger' },
  { ts: 1766880000000, rel: 'database/migrations/20251224000000-create-client-portal-task-comments.sql',       name: 'create_client_portal_task_comments' },
  { ts: 1766880001000, rel: 'database/migrations/20251224000001-create-client-task-views.sql',                 name: 'create_client_task_views' },
  { ts: 1767398400000, rel: 'database/migrations/20251230000000-sanitize-html-in-names.sql',                   name: 'sanitize_html_in_names' },
  { ts: 1767484800000, rel: 'database/migrations/20251231000000-add-password-reset-tokens.sql',                name: 'add_password_reset_tokens' },

  // ── Release 2.3.0 (Dec 2025 → Jan 2026) ───────────────────────────────────
  { ts: 1767571200000, rel: 'database/migrations/release-v2.3.0/001-add-multi-org-support.sql',                      name: 'add_multi_org_support' },
  { ts: 1767571201000, rel: 'database/migrations/release-v2.3.0/002-add-user-id-to-client-users.sql',                name: 'add_user_id_to_client_users' },
  { ts: 1767571202000, rel: 'database/migrations/release-v2.3.0/002-add-unique-constraint-to-client-portal-access.sql', name: 'add_unique_constraint_to_client_portal_access' },
  { ts: 1767571203000, rel: 'database/migrations/release-v2.3.0/003-fix-google-oauth-invite-setup-completed.sql',    name: 'fix_google_oauth_invite_setup_completed' },
  { ts: 1767571204000, rel: 'database/migrations/release-v2.3.0/003-fix-missing-unique-constraints.sql',             name: 'fix_missing_unique_constraints' },

  // ── Release 2.3.1 (Dec 2025 → Jan 2026) ───────────────────────────────────
  { ts: 1767657600000, rel: 'database/migrations/release-v2.3.1/20250101000003-add-service-pricing-fields.sql',         name: 'add_service_pricing_fields' },
  { ts: 1767657601000, rel: 'database/migrations/release-v2.3.1/20250101000008-create-client-portal-attachments.sql',   name: 'create_client_portal_attachments' },
  { ts: 1767657602000, rel: 'database/migrations/release-v2.3.1/20250101000010-add-admin-comments-viewed-tracking.sql', name: 'add_admin_comments_viewed_tracking' },
  { ts: 1767744000000, rel: 'database/migrations/release-v2.3.1/20251202000000-add-request-status-history.sql',         name: 'add_request_status_history' },
  { ts: 1767830400000, rel: 'database/migrations/release-v2.3.1/20251207000000-add-notes-to-client-portal-invoices.sql',  name: 'add_notes_to_client_portal_invoices' },
  { ts: 1767830401000, rel: 'database/migrations/release-v2.3.1/20251207000001-add-company-details-to-client-portal-settings.sql', name: 'add_company_details_to_client_portal_settings' },
  { ts: 1767916800000, rel: 'database/migrations/release-v2.3.1/20251212000000-add-invite-slug-to-clients.sql',          name: 'add_invite_slug_to_clients' },
  { ts: 1767916801000, rel: 'database/migrations/release-v2.3.1/20251212000001-add-client-portal-notifications-read.sql', name: 'add_client_portal_notifications_read' },
  { ts: 1767916802000, rel: 'database/migrations/release-v2.3.1/20251212000002-add-updated-at-to-client-invitations.sql', name: 'add_updated_at_to_client_invitations' },

  // ── Jan 2026 ──────────────────────────────────────────────────────────────
  { ts: 1767571300000, rel: 'database/sql/migrations/20260114000000-capacity-calculation-function.sql', name: 'add_capacity_calculation_function' },
  { ts: 1767657700000, rel: 'database/migrations/20260101000000-add-bulk-change-due-date-function.sql', name: 'add_bulk_change_due_date_function' },
  { ts: 1767744100000, rel: 'database/migrations/20260102000000-fix-client-status-null-values.sql',     name: 'fix_client_status_null_values' },
  { ts: 1767830500000, rel: 'database/migrations/20260103000000-add-payment-proof-url-to-invoices.sql', name: 'add_payment_proof_url_to_invoices' },
  { ts: 1767830501000, rel: 'database/migrations/20260103000001-add-payment-proof-purpose.sql',         name: 'add_payment_proof_purpose' },
  { ts: 1767916900000, rel: 'database/migrations/20260105000006-create-client-portal-request-sequences.sql', name: 'create_client_portal_request_sequences' },
  { ts: 1767916901000, rel: 'database/migrations/20260105000007-fix-client-portal-request-unique-constraint.sql', name: 'fix_client_portal_request_unique_constraint' },
  { ts: 1767916902000, rel: 'database/migrations/20260105000009-add-service-key-field.sql',              name: 'add_service_key_field' },

  // ── Jan 2026 (late) ────────────────────────────────────────────────────────
  { ts: 1769040000000, rel: 'database/migrations/20260129000000-fix-project-comment-response-structure.sql', name: 'fix_project_comment_response_structure' },
  { ts: 1769040001000, rel: 'database/migrations/20260129000001-add-comment-reactions-and-edit-audit.sql',   name: 'add_comment_reactions_and_edit_audit' },

  // ── Feb 2026 ──────────────────────────────────────────────────────────────
  { ts: 1769558400000, rel: 'database/migrations/20260210000000-create-project-files.sql',             name: 'create_project_files' },
  { ts: 1769558401000, rel: 'database/migrations/20260210000000-fix-recurring-tasks.sql',              name: 'fix_recurring_tasks' },
  { ts: 1769731200000, rel: 'database/migrations/20260212000000-fix-team-plan-trial-propagation.sql',  name: 'fix_team_plan_trial_propagation' },
  { ts: 1769731201000, rel: 'database/migrations/20260212000001-fix-team-plan-trial-propagation-simple.sql', name: 'fix_team_plan_trial_propagation_simple' },
  { ts: 1769904000000, rel: 'database/migrations/20260217000000-create-client-password-reset-tokens.sql', name: 'create_client_password_reset_tokens' },
  { ts: 1770163200000, rel: 'database/migrations/20260220000003-add-team-currency-to-rate-cards.sql',  name: 'add_team_currency_to_rate_cards' },
  { ts: 1770163201000, rel: 'database/migrations/20260220000004-create-finance-rate-card-roles.sql',   name: 'create_finance_rate_card_roles' },

  // ── Release 2.5 (Feb 2026) ────────────────────────────────────────────────
  { ts: 1770249600000, rel: 'database/migrations/release-v2.5/20260202000001-fix-project-date-timezone-handling-v2.sql', name: 'fix_project_date_timezone_handling' },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

let generated = 0;
let skipped   = 0;

for (const m of MIGRATIONS) {
  const sqlPath = path.join(ROOT, m.rel);
  const outPath = path.join(OUT_DIR, `${m.ts}_${m.name}.js`);

  // Skip if output already exists
  if (fs.existsSync(outPath)) {
    console.log(`  skip  ${m.ts}_${m.name} (already exists)`);
    skipped++;
    continue;
  }

  if (!fs.existsSync(sqlPath)) {
    console.warn(`  WARN  source not found: ${m.rel}`);
    continue;
  }

  const sql = fs.readFileSync(sqlPath, 'utf8');
  const js  = buildMigrationJS(`Converted from: ${m.rel}`, sql);

  fs.writeFileSync(outPath, js, 'utf8');
  console.log(`  wrote ${m.ts}_${m.name}.js`);
  generated++;
}

console.log(`\nDone — generated: ${generated}, skipped: ${skipped}`);
