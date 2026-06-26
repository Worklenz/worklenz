-- Migration: Fix Team Lead Managed Members View Admin Condition
-- Description: Remove incorrect admin_role condition from team_lead_managed_members view
-- Version: v2.2.2
-- Date: 2025-01-21

-- Fix the team_lead_managed_members view to remove the incorrect admin_role condition
DROP VIEW IF EXISTS team_lead_managed_members CASCADE;

CREATE OR REPLACE VIEW team_lead_managed_members AS
WITH RECURSIVE subordinates AS (
    -- Direct reports
    SELECT 
        tm_manager.id as manager_id,
        tm_manager.user_id as manager_user_id,
        tm_manager.team_id,
        tm_member.id as managed_member_id,
        tm_member.user_id as managed_member_user_id,
        u_member.name as managed_member_name,
        u_member.email as managed_member_email,
        tm_member.role_id as managed_member_role_id,
        r_member.name as managed_member_role_name,
        1 as level
    FROM team_members tm_manager
    JOIN team_members tm_member ON tm_member.reports_to_member_id = tm_manager.id
    JOIN users u_member ON tm_member.user_id = u_member.id
    JOIN roles r_member ON tm_member.role_id = r_member.id
    JOIN roles r_manager ON tm_manager.role_id = r_manager.id
    WHERE tm_manager.active = TRUE 
    AND tm_member.active = TRUE
    AND r_manager.name = 'Team Lead'
    -- REMOVED: AND r_manager.admin_role = TRUE (this was incorrect after the fix migration)
    
    UNION
    
    -- Indirect reports (recursive)
    SELECT 
        s.manager_id,
        s.manager_user_id,
        s.team_id,
        tm_member.id as managed_member_id,
        tm_member.user_id as managed_member_user_id,
        u_member.name as managed_member_name,
        u_member.email as managed_member_email,
        tm_member.role_id as managed_member_role_id,
        r_member.name as managed_member_role_name,
        s.level + 1
    FROM subordinates s
    JOIN team_members tm_member ON tm_member.reports_to_member_id = s.managed_member_id
    JOIN users u_member ON tm_member.user_id = u_member.id
    JOIN roles r_member ON tm_member.role_id = r_member.id
    WHERE tm_member.active = TRUE
    AND s.level < 10 -- Prevent infinite recursion
)
SELECT * FROM subordinates;

-- Recreate dependent views that were dropped due to CASCADE
CREATE OR REPLACE VIEW team_lead_member_stats AS
SELECT 
    tlmm.manager_id,
    tlmm.manager_user_id,
    tlmm.team_id,
    COUNT(DISTINCT tlmm.managed_member_id) as managed_members_count,
    COUNT(DISTINCT t.id) as total_tasks,
    COUNT(DISTINCT CASE WHEN ts.name = 'Done' THEN t.id END) as completed_tasks,
    ROUND(
        CASE 
            WHEN COUNT(DISTINCT t.id) > 0 
            THEN (COUNT(DISTINCT CASE WHEN ts.name = 'Done' THEN t.id END)::decimal / COUNT(DISTINCT t.id)::decimal) * 100 
            ELSE 0 
        END, 2
    ) as completion_percentage,
    COALESCE(SUM(twl.time_spent), 0) as total_time_minutes,
    COUNT(DISTINCT CASE WHEN t.end_date < NOW() AND ts.name != 'Done' THEN t.id END) as overdue_tasks,
    COUNT(DISTINCT p.id) as active_projects
FROM team_lead_managed_members tlmm
LEFT JOIN tasks_assignees ta ON ta.team_member_id = tlmm.managed_member_id
LEFT JOIN tasks t ON t.id = ta.task_id AND t.archived = FALSE
LEFT JOIN task_statuses ts ON t.status_id = ts.id
LEFT JOIN task_work_log twl ON twl.user_id = tlmm.managed_member_user_id
LEFT JOIN projects p ON t.project_id = p.id 
LEFT JOIN archived_projects ap ON p.id = ap.project_id
WHERE ap.project_id IS NULL  -- Exclude archived projects
GROUP BY tlmm.manager_id, tlmm.manager_user_id, tlmm.team_id;

CREATE OR REPLACE VIEW team_lead_member_performance AS
SELECT 
    tlmm.manager_id,
    tlmm.manager_user_id,
    tlmm.team_id,
    tlmm.managed_member_id,
    tlmm.managed_member_user_id,
    tlmm.managed_member_name,
    tlmm.managed_member_email,
    tlmm.managed_member_role_name,
    tlmm.level as hierarchy_level,
    COUNT(DISTINCT t.id) as assigned_tasks,
    COUNT(DISTINCT CASE WHEN ts.name = 'Done' THEN t.id END) as completed_tasks,
    ROUND(
        CASE 
            WHEN COUNT(DISTINCT t.id) > 0 
            THEN (COUNT(DISTINCT CASE WHEN ts.name = 'Done' THEN t.id END)::decimal / COUNT(DISTINCT t.id)::decimal) * 100 
            ELSE 0 
        END, 2
    ) as completion_percentage,
    COALESCE(SUM(twl.time_spent), 0) as total_time_minutes,
    COUNT(DISTINCT CASE WHEN t.end_date < NOW() AND ts.name != 'Done' THEN t.id END) as overdue_tasks,
    COUNT(DISTINCT p.id) as active_projects,
    MAX(twl.created_at) as last_time_log
FROM team_lead_managed_members tlmm
LEFT JOIN tasks_assignees ta ON ta.team_member_id = tlmm.managed_member_id
LEFT JOIN tasks t ON t.id = ta.task_id AND t.archived = FALSE
LEFT JOIN task_statuses ts ON t.status_id = ts.id
LEFT JOIN task_work_log twl ON twl.user_id = tlmm.managed_member_user_id
LEFT JOIN projects p ON t.project_id = p.id 
LEFT JOIN archived_projects ap ON p.id = ap.project_id
WHERE ap.project_id IS NULL  -- Exclude archived projects
GROUP BY tlmm.manager_id, tlmm.manager_user_id, tlmm.team_id, 
         tlmm.managed_member_id, tlmm.managed_member_user_id, 
         tlmm.managed_member_name, tlmm.managed_member_email, 
         tlmm.managed_member_role_name, tlmm.level;

CREATE OR REPLACE VIEW team_lead_time_logs AS
SELECT 
    tlmm.manager_id,
    tlmm.manager_user_id,
    tlmm.team_id,
    tlmm.managed_member_id,
    tlmm.managed_member_user_id,
    tlmm.managed_member_name,
    twl.id as time_log_id,
    twl.time_spent,
    twl.description,
    twl.logged_by_timer,
    twl.created_at as logged_at,
    t.id as task_id,
    t.name as task_name,
    p.id as project_id,
    p.name as project_name
FROM team_lead_managed_members tlmm
JOIN task_work_log twl ON twl.user_id = tlmm.managed_member_user_id
LEFT JOIN tasks t ON twl.task_id = t.id AND t.archived = FALSE
LEFT JOIN projects p ON t.project_id = p.id 
LEFT JOIN archived_projects ap ON p.id = ap.project_id
WHERE ap.project_id IS NULL;  -- Exclude archived projects

-- Grant appropriate permissions
GRANT SELECT ON team_lead_managed_members TO worklenz_user;
GRANT SELECT ON team_lead_member_stats TO worklenz_user;
GRANT SELECT ON team_lead_member_performance TO worklenz_user;
GRANT SELECT ON team_lead_time_logs TO worklenz_user;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_team_lead_managed_members_manager ON team_lead_managed_members(manager_id);
CREATE INDEX IF NOT EXISTS idx_team_lead_managed_members_managed ON team_lead_managed_members(managed_member_id);
CREATE INDEX IF NOT EXISTS idx_team_lead_managed_members_team ON team_lead_managed_members(team_id);
