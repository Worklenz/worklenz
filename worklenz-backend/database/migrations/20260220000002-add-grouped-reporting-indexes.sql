-- Migration: Add indexes for grouped project reporting queries
-- Improves performance when grouping by category, status, health, and filtering by teams
-- Created: 2026-02-20

-- Index for category grouping (most common grouping)
-- Helps optimize GROUP BY category_id queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_category_team
ON projects (category_id, team_id)
WHERE category_id IS NOT NULL;

-- Index for status grouping
-- Helps optimize GROUP BY status_id queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_status_team
ON projects (status_id, team_id)
WHERE status_id IS NOT NULL;

-- Index for health grouping
-- Helps optimize GROUP BY health_id queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_health_team
ON projects (health_id, team_id)
WHERE health_id IS NOT NULL;

-- Composite index for active tasks (used in CTE aggregation)
-- Improves performance of project_tasks CTE in getGrouped query
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_project_archived
ON tasks (project_id, archived)
WHERE archived = FALSE;

-- Index for task status filtering (speeds up is_completed/is_doing/is_todo checks)
-- Helps aggregate task counts by status type
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_status_project
ON tasks (status_id, project_id)
WHERE archived = FALSE;

-- Note: Using CONCURRENTLY to avoid locking tables during index creation
-- This allows the migration to run on production without downtime
