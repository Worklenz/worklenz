/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
  // Composite index for main task filtering
  pgm.sql(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_project_archived_parent 
    ON tasks(project_id, archived, parent_task_id) 
    WHERE archived = FALSE
  `);

  // Index for status joins
  pgm.sql(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_status_project 
    ON tasks(status_id, project_id) 
    WHERE archived = FALSE
  `);

  // Index for assignees lookup
  pgm.sql(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_assignees_task_member 
    ON tasks_assignees(task_id, team_member_id)
  `);

  // Index for phase lookup
  pgm.sql(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_phase_task_phase 
    ON task_phase(task_id, phase_id)
  `);

  // Index for subtask counting
  pgm.sql(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_parent_archived 
    ON tasks(parent_task_id, archived) 
    WHERE parent_task_id IS NOT NULL AND archived = FALSE
  `);

  // Index for labels
  pgm.sql(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_labels_task_label 
    ON task_labels(task_id, label_id)
  `);

  // Index for comments count
  pgm.sql(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_comments_task 
    ON task_comments(task_id)
  `);

  // Index for attachments count
  pgm.sql(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_attachments_task 
    ON task_attachments(task_id)
  `);

  // Index for work log aggregation
  pgm.sql(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_work_log_task 
    ON task_work_log(task_id)
  `);

  // Index for subscribers check
  pgm.sql(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_subscribers_task 
    ON task_subscribers(task_id)
  `);

  // Index for dependencies check
  pgm.sql(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_dependencies_task 
    ON task_dependencies(task_id)
  `);

  // Additional performance indexes
  pgm.sql(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_dependencies_related 
    ON task_dependencies(related_task_id)
  `);

  // Index for custom column values
  pgm.sql(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cc_column_values_task 
    ON cc_column_values(task_id)
  `);

  // Index for project members lookup
  pgm.sql(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_project_members_team_project 
    ON project_members(team_member_id, project_id)
  `);

  // Index for sorting
  pgm.sql(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_project_sort 
    ON tasks(project_id, sort_order) 
    WHERE archived = FALSE
  `);

  // Index for roadmap sorting
  pgm.sql(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_project_roadmap_sort 
    ON tasks(project_id, roadmap_sort_order) 
    WHERE archived = FALSE
  `);

  // Index for user lookup in team members
  pgm.sql(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_team_members_user_team 
    ON team_members(user_id, team_id) 
    WHERE active = TRUE
  `);

  // Index for task statuses lookup
  pgm.sql(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_statuses_project_category 
    ON task_statuses(project_id, category_id)
  `);

  // Index for task priorities lookup
  pgm.sql(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_priority 
    ON tasks(priority_id) 
    WHERE archived = FALSE
  `);
};

exports.down = pgm => {
  // Drop indexes in reverse order
  pgm.sql('DROP INDEX IF EXISTS idx_tasks_priority');
  pgm.sql('DROP INDEX IF EXISTS idx_task_statuses_project_category');
  pgm.sql('DROP INDEX IF EXISTS idx_team_members_user_team');
  pgm.sql('DROP INDEX IF EXISTS idx_tasks_project_roadmap_sort');
  pgm.sql('DROP INDEX IF EXISTS idx_tasks_project_sort');
  pgm.sql('DROP INDEX IF EXISTS idx_project_members_team_project');
  pgm.sql('DROP INDEX IF EXISTS idx_cc_column_values_task');
  pgm.sql('DROP INDEX IF EXISTS idx_task_dependencies_related');
  pgm.sql('DROP INDEX IF EXISTS idx_task_dependencies_task');
  pgm.sql('DROP INDEX IF EXISTS idx_task_subscribers_task');
  pgm.sql('DROP INDEX IF EXISTS idx_task_work_log_task');
  pgm.sql('DROP INDEX IF EXISTS idx_task_attachments_task');
  pgm.sql('DROP INDEX IF EXISTS idx_task_comments_task');
  pgm.sql('DROP INDEX IF EXISTS idx_task_labels_task_label');
  pgm.sql('DROP INDEX IF EXISTS idx_tasks_parent_archived');
  pgm.sql('DROP INDEX IF EXISTS idx_task_phase_task_phase');
  pgm.sql('DROP INDEX IF EXISTS idx_tasks_assignees_task_member');
  pgm.sql('DROP INDEX IF EXISTS idx_tasks_status_project');
  pgm.sql('DROP INDEX IF EXISTS idx_tasks_project_archived_parent');
};