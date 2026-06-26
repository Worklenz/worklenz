'use strict';
// Converted from: database/migrations/20250123000001-optimize-reporting-members-indexes.sql

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Migration: Optimize Reporting Members Query Performance
-- Description: Add indexes to improve performance of the getMembers query used in time-sheet-members reporting
-- Date: 2025-01-23
-- Related Issue: 30-second timeout on /worklenz/reporting/time-sheet-members

-- ============================================================================
-- PERFORMANCE INDEXES FOR REPORTING MEMBERS QUERY
-- ============================================================================

-- Index for team_member_info_view queries (most frequently accessed)
CREATE INDEX IF NOT EXISTS idx_team_members_team_id_active 
ON team_members(team_id, active) 
WHERE active = TRUE;

-- Index for project_members lookups by team_member_id
CREATE INDEX IF NOT EXISTS idx_project_members_team_member_id 
ON project_members(team_member_id);

-- Composite index for tasks_assignees with team_member_id
CREATE INDEX IF NOT EXISTS idx_tasks_assignees_team_member_task 
ON tasks_assignees(team_member_id, task_id);

-- Index for task_activity_logs user and team lookups
CREATE INDEX IF NOT EXISTS idx_task_activity_logs_user_team_created 
ON task_activity_logs(user_id, team_id, created_at DESC);

-- Index for task_work_log user lookups with created_at for time range queries
CREATE INDEX IF NOT EXISTS idx_task_work_log_user_created 
ON task_work_log(user_id, created_at DESC);

-- Index for task_work_log task_id lookups
CREATE INDEX IF NOT EXISTS idx_task_work_log_task_id 
ON task_work_log(task_id);

-- Composite index for tasks with project_id and status checks
CREATE INDEX IF NOT EXISTS idx_tasks_project_status 
ON tasks(project_id, status_id) 
WHERE archived = FALSE;

-- Index for tasks with billable flag for time log queries
CREATE INDEX IF NOT EXISTS idx_tasks_billable 
ON tasks(billable, project_id) 
WHERE archived = FALSE;

-- Index for projects team_id lookups
CREATE INDEX IF NOT EXISTS idx_projects_team_id 
ON projects(team_id);

-- Index for archived_projects for faster exclusion
CREATE INDEX IF NOT EXISTS idx_archived_projects_user_project 
ON archived_projects(user_id, project_id);

-- Index for task_activity_logs attribute_type and task_id for status lookups
CREATE INDEX IF NOT EXISTS idx_task_activity_logs_task_attribute_created 
ON task_activity_logs(task_id, attribute_type, created_at DESC) 
WHERE attribute_type = 'status';

-- ============================================================================
-- ANALYZE TABLES FOR QUERY PLANNER
-- ============================================================================

ANALYZE team_members;
ANALYZE project_members;
ANALYZE tasks_assignees;
ANALYZE task_activity_logs;
ANALYZE task_work_log;
ANALYZE tasks;
ANALYZE projects;
ANALYZE archived_projects;

-- ============================================================================
-- OPTIONAL: REFRESH MATERIALIZED VIEW IF EXISTS
-- ============================================================================

-- Refresh the materialized view for team_member_info if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_matviews 
        WHERE schemaname = 'public' 
        AND matviewname = 'team_member_info_mv'
    ) THEN
        REFRESH MATERIALIZED VIEW CONCURRENTLY team_member_info_mv;
        RAISE NOTICE 'Refreshed team_member_info_mv materialized view';
    END IF;
END $$;

-- ============================================================================
-- PERFORMANCE NOTES
-- ============================================================================

-- These indexes are designed to optimize the following query patterns:
-- 1. Filtering team members by team_id and active status
-- 2. Counting projects per member
-- 3. Aggregating task statistics per member
-- 4. Finding last activity timestamps
-- 5. Calculating billable/non-billable time
-- 6. Excluding archived projects efficiently
--
-- Expected performance improvement: 10-50x faster query execution
-- Estimated query time reduction: from 30+ seconds to <3 seconds

  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // This migration is a DDL/function change — no automatic rollback defined.
  // Review manually before running migrate:down.
};
