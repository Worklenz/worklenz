-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS permissions_name_uindex
    ON permissions (name);

CREATE UNIQUE INDEX IF NOT EXISTS bounced_emails_email_uindex
    ON bounced_emails (email);

CREATE INDEX IF NOT EXISTS clients_id_team_id_index
    ON clients (id, team_id);

CREATE UNIQUE INDEX IF NOT EXISTS clients_name_team_id_uindex
    ON clients (name, team_id);

CREATE UNIQUE INDEX IF NOT EXISTS cpt_phases_name_project_uindex
    ON cpt_phases (name, template_id);

CREATE UNIQUE INDEX IF NOT EXISTS cpt_task_phase_cpt_task_phase_uindex
    ON cpt_task_phases (task_id, phase_id);

CREATE UNIQUE INDEX IF NOT EXISTS cpt_task_phase_task_id_uindex
    ON cpt_task_phases (task_id);

CREATE UNIQUE INDEX IF NOT EXISTS cpt_task_statuses_template_id_name_uindex
    ON cpt_task_statuses (template_id, name);

CREATE UNIQUE INDEX IF NOT EXISTS custom_project_templates_name_team_id_uindex
    ON custom_project_templates (name, team_id);

-- Create index on expire field
CREATE INDEX IF NOT EXISTS idx_pg_sessions_expire 
    ON pg_sessions (expire);

CREATE UNIQUE INDEX IF NOT EXISTS job_titles_name_team_id_uindex
    ON job_titles (name, team_id);

CREATE INDEX IF NOT EXISTS job_titles_team_id_index
    ON job_titles (team_id);

CREATE UNIQUE INDEX IF NOT EXISTS licensing_admin_users_name_uindex
    ON licensing_admin_users (name);

CREATE UNIQUE INDEX IF NOT EXISTS licensing_admin_users_phone_no_uindex
    ON licensing_admin_users (phone_no);

CREATE UNIQUE INDEX IF NOT EXISTS licensing_admin_users_username_uindex
    ON licensing_admin_users (username);

CREATE UNIQUE INDEX IF NOT EXISTS licensing_coupon_codes_coupon_code_uindex
    ON licensing_coupon_codes (coupon_code);

CREATE INDEX IF NOT EXISTS licensing_coupon_codes_redeemed_by_index
    ON licensing_coupon_codes (redeemed_by);

CREATE UNIQUE INDEX IF NOT EXISTS licensing_pricing_plans_uindex
    ON licensing_pricing_plans (id);

CREATE UNIQUE INDEX IF NOT EXISTS licensing_user_plans_uindex
    ON licensing_user_subscriptions (id);

CREATE INDEX IF NOT EXISTS licensing_user_subscriptions_user_id_index
    ON licensing_user_subscriptions (user_id);

CREATE INDEX IF NOT EXISTS notification_settings_team_user_id_index
    ON notification_settings (team_id, user_id);

CREATE UNIQUE INDEX IF NOT EXISTS personal_todo_list_index_uindex
    ON personal_todo_list (user_id, index);

CREATE UNIQUE INDEX IF NOT EXISTS project_access_levels_key_uindex
    ON project_access_levels (key);

CREATE UNIQUE INDEX IF NOT EXISTS project_access_levels_name_uindex
    ON project_access_levels (name);

CREATE UNIQUE INDEX IF NOT EXISTS project_categories_name_team_id_uindex
    ON project_categories (name, team_id);

CREATE INDEX IF NOT EXISTS project_comments_project_id_index
    ON project_comments (project_id);

CREATE UNIQUE INDEX IF NOT EXISTS project_folders_team_id_key_uindex
    ON project_folders (team_id, key);

CREATE UNIQUE INDEX IF NOT EXISTS project_folders_team_id_name_uindex
    ON project_folders (team_id, name);

CREATE INDEX IF NOT EXISTS project_members_project_id_index
    ON project_members (project_id);

CREATE INDEX IF NOT EXISTS project_members_project_id_member_id_index
    ON project_members (project_id, team_member_id);

CREATE INDEX IF NOT EXISTS project_members_team_member_id_index
    ON project_members (team_member_id);

CREATE UNIQUE INDEX IF NOT EXISTS project_members_team_member_project_uindex
    ON project_members (team_member_id, project_id);

CREATE UNIQUE INDEX IF NOT EXISTS project_phases_name_project_uindex
    ON project_phases (name, project_id);

CREATE UNIQUE INDEX IF NOT EXISTS project_subscribers_user_task_team_member_uindex
    ON project_subscribers (user_id, project_id, team_member_id);

CREATE INDEX IF NOT EXISTS project_task_list_cols_index
    ON project_task_list_cols (project_id, index);

CREATE UNIQUE INDEX IF NOT EXISTS project_task_list_cols_key_project_uindex
    ON project_task_list_cols (key, project_id);

CREATE INDEX IF NOT EXISTS projects_folder_id_index
    ON projects (folder_id);

CREATE INDEX IF NOT EXISTS projects_id_team_id_index
    ON projects (id, team_id);

CREATE UNIQUE INDEX IF NOT EXISTS projects_key_team_id_uindex
    ON projects (key, team_id);

CREATE INDEX IF NOT EXISTS projects_name_index
    ON projects (name);

CREATE UNIQUE INDEX IF NOT EXISTS projects_name_team_id_uindex
    ON projects (name, team_id);

CREATE INDEX IF NOT EXISTS projects_team_id_folder_id_index
    ON projects (team_id, folder_id);

CREATE INDEX IF NOT EXISTS projects_team_id_index
    ON projects (team_id);

CREATE INDEX IF NOT EXISTS projects_team_id_name_index
    ON projects (team_id, name);

-- Performance indexes for optimized tasks queries
-- From migration: 20250115000000-performance-indexes.sql

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

-- Advanced performance indexes for task optimization

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

-- Indexes for task_updates table to prevent deadlocks and improve performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_updates_user_project_type_sent
ON task_updates(user_id, project_id, type, is_sent)
WHERE is_sent = FALSE;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_updates_sent_status
ON task_updates(is_sent, type)
WHERE is_sent = FALSE;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_updates_cleanup
ON task_updates(is_sent, created_at)
WHERE is_sent = TRUE;

