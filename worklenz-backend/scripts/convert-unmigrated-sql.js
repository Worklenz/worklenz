#!/usr/bin/env node
'use strict';

/**
 * Converts remaining unmigrated SQL files into standard node-pg-migrate JS migrations
 * inside database/pg-migrations.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'database', 'pg-migrations');

function makeIdempotent(sql) {
  let s = sql;
  s = s.replace(/\bCREATE TABLE\b(?!\s+IF\s+NOT\s+EXISTS\b)/gi, 'CREATE TABLE IF NOT EXISTS');
  s = s.replace(/\bADD COLUMN\b(?!\s+IF\s+NOT\s+EXISTS\b)/gi, 'ADD COLUMN IF NOT EXISTS');
  s = s.replace(/\bCREATE UNIQUE INDEX\b(?!\s+IF\s+NOT\s+EXISTS\b)/gi, 'CREATE UNIQUE INDEX IF NOT EXISTS');
  s = s.replace(/\bCREATE INDEX\b(?!\s+IF\s+NOT\s+EXISTS\b)/gi, 'CREATE INDEX IF NOT EXISTS');
  s = s.replace(/\bCREATE SEQUENCE\b(?!\s+IF\s+NOT\s+EXISTS\b)/gi, 'CREATE SEQUENCE IF NOT EXISTS');
  s = s.replace(/\bDROP TABLE\b(?!\s+IF\s+EXISTS\b)/gi, 'DROP TABLE IF EXISTS');
  s = s.replace(/\bDROP INDEX\b(?!\s+IF\s+EXISTS\b)/gi, 'DROP INDEX IF EXISTS');
  s = s.replace(/\bDROP SEQUENCE\b(?!\s+IF\s+EXISTS\b)/gi, 'DROP SEQUENCE IF EXISTS');

  // Wrap ADD CONSTRAINT in pg_constraint existence check
  s = s.replace(
    /ALTER\s+TABLE\s+([^\s;]+)\s+ADD\s+CONSTRAINT\s+([^\s;]+)\s+([^;]+);/gi,
    (match, table, constraint, rest) => {
      const cleanCon = constraint.replace(/["']/g, '');
      return `DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${cleanCon}' AND conrelid = '${table}'::regclass) THEN
    ALTER TABLE ${table} ADD CONSTRAINT ${constraint} ${rest};
  END IF;
END $$;`;
    }
  );

  return s;
}

function escapeForTemplateLiteral(str) {
  return str.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
}

function removeTopLevelTransactions(sql) {
  return sql.replace(/^\s*(BEGIN|COMMIT)\s*;/gim, '');
}

function buildMigrationJS(description, sql) {
  const safe = escapeForTemplateLiteral(makeIdempotent(removeTopLevelTransactions(sql)));
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
  // Review manually before running migrate:down.
};
`;
}

const FILES_TO_CONVERT = [
  { rel: 'database/migrations/import-tasks/20260101000000-create-imports.sql', name: 'create_import_tasks_tables' },
  { rel: 'database/migrations/import-tasks/20260106000001-add-position-import-hierarchy.sql', name: 'add_position_import_hierarchy' },
  { rel: 'database/migrations/import-tasks/20260318000000-set-import-jobs-id-default-uuid-generate-v4.sql', name: 'set_import_jobs_id_default_uuid' },
  { rel: 'database/migrations/release-v2.5/20260203000000-add-auto-assign-task-creator.sql', name: 'add_auto_assign_task_creator' },
  { rel: 'database/migrations/release-v2.5/20260212000000-add-recurring-mode-selection.sql', name: 'add_recurring_mode_selection' },
  { rel: 'database/migrations/release-v2.5/20260224000000-add-project-members-to-account-setup.sql', name: 'add_project_members_to_account_setup' },
  { rel: 'database/migrations/release-v2.5/20260316000000-add-business-plan-overrides.sql', name: 'add_business_plan_overrides' },
  { rel: 'database/migrations/release-v2.5/add_calculate_member_capacity_function.sql', name: 'add_calculate_member_capacity_function' },
  { rel: 'database/migrations/release-v2.5/update_register_db_functions_OWD.sql', name: 'update_register_db_functions_owd' },
  { rel: 'database/migrations/20260105000008-update-request-sequences-per-service.sql', name: 'update_request_sequences_per_service' },
  { rel: 'database/migrations/20260210000000-recurring-tasks-complete-fix.sql', name: 'recurring_tasks_complete_fix' },
  { rel: 'database/migrations/20260213000000-fix-notification-email-loop.sql', name: 'fix_notification_email_loop' },
  { rel: 'database/migrations/20260213000001-cleanup-stuck-notifications.sql', name: 'cleanup_stuck_notifications' },
  { rel: 'database/migrations/20260213000002-add-retry-mechanism.sql', name: 'add_retry_mechanism' },
  { rel: 'database/migrations/20260213000003-clear-pending-notifications.sql', name: 'clear_pending_notifications' },
  { rel: 'database/migrations/20260213000004-fix-notification-email-edge-cases.sql', name: 'fix_notification_email_edge_cases' },
  { rel: 'database/migrations/20260217000002-fix-quick-task-sort-order.sql', name: 'fix_quick_task_sort_order' },
  { rel: 'database/migrations/20260217000003-fix-template-import-sort-order.sql', name: 'fix_template_import_sort_order' },
  { rel: 'database/migrations/20260220000002-add-grouped-reporting-indexes.sql', name: 'add_grouped_reporting_indexes' },
  { rel: 'database/migrations/20260222000000-fix-task-activity-logs-cascade-delete.sql', name: 'fix_task_activity_logs_cascade_delete' },
  { rel: 'database/migrations/20260222000001-fix-bulk-delete-activity-logs.sql', name: 'fix_bulk_delete_activity_logs' },
  { rel: 'database/migrations/20260309000000-invalidate-bcrypt-reset-tokens.sql', name: 'invalidate_bcrypt_reset_tokens' },
  { rel: 'database/migrations/20260317000000-fix-create-task-auto-assign-task-creator.sql', name: 'fix_create_task_auto_assign_task_creator' },
  { rel: 'database/migrations/20260319000001-fix-bulk-archive-subtask-selection.sql', name: 'fix_bulk_archive_subtask_selection' },
  { rel: 'database/migrations/20260320000001-make-bulk-archive-recursive.sql', name: 'make_bulk_archive_recursive' },
  { rel: 'database/migrations/20260403000000-add-critical-task-priority.sql', name: 'add_critical_task_priority' },
  { rel: 'database/migrations/20260424000001-add-due-time-to-tasks.sql', name: 'add_due_time_to_tasks' },
  { rel: 'database/migrations/20260427000001-add-due-time-to-task-form-view-model.sql', name: 'add_due_time_to_task_form_view_model' },
  { rel: 'database/migrations/20260427000002-add-due-time-column-to-task-list.sql', name: 'add_due_time_column_to_task_list' },
  { rel: 'database/migrations/20260430000000-add-multiple-reaction-types.sql', name: 'add_multiple_reaction_types' },
  { rel: 'database/migrations/20260507000000-add-priority-to-projects.sql', name: 'add_priority_to_projects' },
  { rel: 'database/migrations/20260507000000-optimize-reporting-projects-grouped.sql', name: 'optimize_reporting_projects_grouped' },
  { rel: 'database/migrations/20260507000001-update-project-functions-with-priority.sql', name: 'update_project_functions_with_priority' },
  { rel: 'database/migrations/release-v2.6/20260515000000-add-restrict-task-creation.sql', name: 'add_restrict_task_creation' },
  { rel: 'database/migrations/20260520000001-task-template-subtask-support.sql', name: 'task_template_subtask_support' },
  { rel: 'database/migrations/20260520000002-task-template-3level-subtask-support.sql', name: 'task_template_3level_subtask_support' },
  { rel: 'database/migrations/20260529000001-soft-delete-task-comments.sql', name: 'soft_delete_task_comments' },
  { rel: 'database/migrations/20260616000000-add-phase-assignees-enabled.sql', name: 'add_phase_assignees_enabled' },
  { rel: 'database/migrations/20260616000001-add-default-assignee-to-phases.sql', name: 'add_default_assignee_to_phases' },
  { rel: 'database/migrations/release-v2.6/20260626000001-add-annual-pro-license-type.sql', name: 'add_annual_pro_license_type' },
  { rel: 'database/migrations/20260709000001-add-comment-id-to-user-notifications.sql', name: 'add_comment_id_to_user_notifications' },
  { rel: 'database/migrations/20260714000000-fix-email-notifications-default.sql', name: 'fix_email_notifications_default' },
  { rel: 'database/migrations/release-v2.6/20260727000000-add-base-currency-to-organizations.sql', name: 'add_base_currency_to_organizations' },
  { rel: 'database/migrations/20260728000001-enforce-task-name-250-char-limit.sql', name: 'enforce_task_name_250_char_limit' },
  { rel: 'database/migrations/20260728000002-fix-task-name-constraint-to-250-chars.sql', name: 'fix_task_name_constraint_to_250_chars' },
  { rel: 'database/migrations/release-v2.6/20260731000000-add-timelog-backdate-limit.sql', name: 'add_timelog_backdate_limit' },
  { rel: 'database/migrations/20260731000000-add-tasks-assignees-assigned-by-index.sql', name: 'add_tasks_assignees_assigned_by_index' },
  { rel: 'database/migrations/20260802000000-add-personal-todo-list-user-dates-index.sql', name: 'add_personal_todo_list_user_dates_index' },
  { rel: 'database/migrations/20260803000000-add-task-phase-phase-id-index.sql', name: 'add_task_phase_phase_id_index' },
];

let created = 0;
let skipped = 0;

FILES_TO_CONVERT.forEach((item, index) => {
  const seq = String(index + 1).padStart(6, '0');
  const filename = `20260821${seq}_${item.name}.js`;
  const outPath = path.join(OUT_DIR, filename);

  if (fs.existsSync(outPath)) {
    skipped++;
    return;
  }

  const srcPath = path.join(ROOT, item.rel);
  if (!fs.existsSync(srcPath)) {
    console.warn(`[WARN] Source file not found: ${item.rel}`);
    return;
  }

  const sql = fs.readFileSync(srcPath, 'utf8');
  const content = buildMigrationJS(`Converted from ${item.rel}`, sql);
  fs.writeFileSync(outPath, content, 'utf8');
  created++;
  console.log(`Created: ${filename}`);
});

console.log(`\nConversion complete: ${created} created, ${skipped} skipped.`);
