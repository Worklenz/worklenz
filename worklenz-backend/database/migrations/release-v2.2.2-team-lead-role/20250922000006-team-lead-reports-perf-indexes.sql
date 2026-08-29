-- Migration: Performance indexes for team-lead reports
-- Adds indexes that are missing but needed by the team-lead reporting queries.

-- Speed up the recursive CTE anchor: finding all Team Lead members in a team
-- (team_members JOIN roles WHERE r.name = 'Team Lead' AND tm.active = TRUE)
CREATE INDEX IF NOT EXISTS idx_team_members_role_active
  ON team_members (role_id, active)
  WHERE active = TRUE;

-- Speed up the organization_working_days lookup by organization_id
-- (used by the working-days count in getTeamTimeLogsSummary)
CREATE INDEX IF NOT EXISTS idx_org_working_days_org_id
  ON organization_working_days (organization_id);

-- Composite index that covers the team_lead_time_logs view join pattern:
-- task_work_log filtered by user_id with a date range on created_at
-- (already created by 20250922000001 as idx_task_work_log_user_task,
--  but that migration may not have run on all environments)
CREATE INDEX IF NOT EXISTS idx_task_work_log_user_created_at
  ON task_work_log (user_id, created_at DESC);
