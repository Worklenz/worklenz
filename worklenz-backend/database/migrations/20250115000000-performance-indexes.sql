-- Performance indexes for optimized tasks queries
-- Migration: 20250115000000-performance-indexes.sql

-- Composite index for main task filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_project_archived_parent 
ON tasks(project_id, archived, parent_task_id) 
WHERE archived = FALSE;

-- Index for status joins
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_status_project 
ON tasks(status_id, project_id) 
WHERE archived = FALSE;

-- Index for assignees lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_assignees_task_member 
ON tasks_assignees(task_id, team_member_id);

-- Index for phase lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_phase_task_phase 
ON task_phase(task_id, phase_id);

-- Index for subtask counting
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_parent_archived 
ON tasks(parent_task_id, archived) 
WHERE parent_task_id IS NOT NULL AND archived = FALSE;

-- Index for labels
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_labels_task_label 
ON task_labels(task_id, label_id);

-- Index for comments count
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_comments_task 
ON task_comments(task_id);

-- Index for attachments count
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_attachments_task 
ON task_attachments(task_id);

-- Index for work log aggregation
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_work_log_task 
ON task_work_log(task_id);

-- Index for subscribers check
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_subscribers_task 
ON task_subscribers(task_id);

-- Index for dependencies check
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_dependencies_task 
ON task_dependencies(task_id);

-- Index for timers lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_timers_task_user 
ON task_timers(task_id, user_id);

-- Index for custom columns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cc_column_values_task 
ON cc_column_values(task_id);

-- Index for team member info view optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_team_members_team_user 
ON team_members(team_id, user_id) 
WHERE active = TRUE;

-- Index for notification settings
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notification_settings_user_team 
ON notification_settings(user_id, team_id);

-- Index for task status categories
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_statuses_category 
ON task_statuses(category_id, project_id);

-- Index for project phases
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_project_phases_project_sort 
ON project_phases(project_id, sort_index);

-- Index for task priorities
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_priorities_value 
ON task_priorities(value);

-- Index for team labels
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_team_labels_team 
ON team_labels(team_id);

-- NEW INDEXES FOR PERFORMANCE OPTIMIZATION --

-- Composite index for task main query optimization (covers most WHERE conditions)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_performance_main
ON tasks(project_id, archived, parent_task_id, status_id, priority_id)
WHERE archived = FALSE;

-- Index for sorting by sort_order with project filter
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_project_sort_order
ON tasks(project_id, sort_order)
WHERE archived = FALSE;

-- Index for email_invitations to optimize team_member_info_view
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_invitations_team_member
ON email_invitations(team_member_id);

-- Covering index for task status with category information
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_statuses_covering
ON task_statuses(id, category_id, project_id);

-- Index for task aggregation queries (parent task progress calculation)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_parent_status_archived
ON tasks(parent_task_id, status_id, archived)
WHERE archived = FALSE;

-- Index for project team member filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_team_members_project_lookup
ON team_members(team_id, active, user_id)
WHERE active = TRUE;

-- Covering index for tasks with frequently accessed columns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_covering_main
ON tasks(id, project_id, archived, parent_task_id, status_id, priority_id, sort_order, name)
WHERE archived = FALSE;

-- Index for task search functionality
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_name_search
ON tasks USING gin(to_tsvector('english', name))
WHERE archived = FALSE;

-- Index for date-based filtering (if used)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_dates
ON tasks(project_id, start_date, end_date)
WHERE archived = FALSE;

-- Index for task timers with user filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_timers_user_task
ON task_timers(user_id, task_id);

-- Index for sys_task_status_categories lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sys_task_status_categories_covering
ON sys_task_status_categories(id, color_code, color_code_dark, is_done, is_doing, is_todo); 