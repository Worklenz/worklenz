-- Migration: Optimize reporting projects grouped query performance
-- Date: 2026-05-07
-- Description: Add indexes to improve performance of getGrouped endpoint

-- Index for task status category lookups (replaces function calls)
-- This allows direct JOIN instead of calling is_completed/is_doing/is_todo functions
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_statuses_category_project
ON task_statuses(category_id, project_id);

-- Composite index for tasks aggregation in project_tasks CTE
-- Covers: project_id, archived, status_id for efficient filtering and grouping
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_project_archived_status
ON tasks(project_id, archived, status_id)
WHERE archived IS FALSE;

-- Index for project filtering with common lookup columns
-- Covers most WHERE clause conditions in the grouped query
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_team_status_health_category
ON projects(team_id, status_id, health_id, category_id);

-- Index for project manager filtering
-- Optimizes the projectManagersClause subquery
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_project_members_access_level_team_member
ON project_members(project_access_level_id, team_member_id, project_id);

-- Index for team member user lookup (used in manager filtering)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_team_members_user_team
ON team_members(user_id, team_id, id);

-- Index for archived projects filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_archived_projects_project_user
ON archived_projects(project_id, user_id);

-- Index for project name search (used in searchQuery)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_name_lower
ON projects(LOWER(name));

-- Covering index for teams lookup in JSON aggregation
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_teams_id_name
ON teams(id, name);
