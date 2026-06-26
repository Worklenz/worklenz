-- Migration: Create Team Lead Member-Based Reporting Views
-- Description: Creates views to support team lead scoped reporting based on member hierarchy
-- Version: v2.2.2
-- Date: 2025-01-21

-- View for team lead managed members (based on reports_to_member_id hierarchy)
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
    AND r_manager.admin_role = TRUE
    
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

-- View for team lead reporting statistics based on managed members
CREATE OR REPLACE VIEW team_lead_member_stats AS
SELECT 
    tlmm.manager_id as team_lead_id,
    tlmm.manager_user_id as team_lead_user_id,
    tlmm.team_id,
    COUNT(DISTINCT tlmm.managed_member_id) as managed_member_count,
    COUNT(DISTINCT tasks.id) as total_tasks,
    COUNT(DISTINCT CASE WHEN tasks.done = TRUE THEN tasks.id END) as completed_tasks,
    CASE 
        WHEN COUNT(DISTINCT tasks.id) > 0 
        THEN ROUND((COUNT(DISTINCT CASE WHEN tasks.done = TRUE THEN tasks.id END) * 100.0) / COUNT(DISTINCT tasks.id), 2)
        ELSE 0 
    END as completion_percentage,
    COALESCE(SUM(twl.time_spent), 0) as total_time_minutes,
    COUNT(DISTINCT CASE WHEN tasks.end_date < CURRENT_DATE AND tasks.done = FALSE THEN tasks.id END) as overdue_tasks,
    COUNT(DISTINCT tasks.project_id) as active_projects
FROM team_lead_managed_members tlmm
LEFT JOIN tasks_assignees ta ON tlmm.managed_member_id = ta.team_member_id
LEFT JOIN tasks ON ta.task_id = tasks.id AND tasks.archived = FALSE
LEFT JOIN task_work_log twl ON tasks.id = twl.task_id AND twl.user_id = tlmm.managed_member_user_id
GROUP BY 
    tlmm.manager_id, 
    tlmm.manager_user_id, 
    tlmm.team_id;

-- View for team lead member performance details
CREATE OR REPLACE VIEW team_lead_member_performance AS
SELECT 
    tlmm.manager_id as team_lead_id,
    tlmm.manager_user_id as team_lead_user_id,
    tlmm.managed_member_id,
    tlmm.managed_member_user_id,
    tlmm.managed_member_name,
    tlmm.managed_member_email,
    tlmm.managed_member_role_name,
    tlmm.level as hierarchy_level,
    COUNT(DISTINCT tasks.id) as assigned_tasks,
    COUNT(DISTINCT CASE WHEN tasks.done = TRUE THEN tasks.id END) as completed_tasks,
    CASE 
        WHEN COUNT(DISTINCT tasks.id) > 0 
        THEN ROUND((COUNT(DISTINCT CASE WHEN tasks.done = TRUE THEN tasks.id END) * 100.0) / COUNT(DISTINCT tasks.id), 2)
        ELSE 0 
    END as completion_percentage,
    COALESCE(SUM(twl.time_spent), 0) as total_time_minutes,
    COUNT(DISTINCT CASE WHEN tasks.end_date < CURRENT_DATE AND tasks.done = FALSE THEN tasks.id END) as overdue_tasks,
    COUNT(DISTINCT tasks.project_id) as active_projects,
    MAX(twl.created_at) as last_time_log
FROM team_lead_managed_members tlmm
LEFT JOIN tasks_assignees ta ON tlmm.managed_member_id = ta.team_member_id
LEFT JOIN tasks ON ta.task_id = tasks.id AND tasks.archived = FALSE
LEFT JOIN task_work_log twl ON tasks.id = twl.task_id AND twl.user_id = tlmm.managed_member_user_id
GROUP BY 
    tlmm.manager_id, 
    tlmm.manager_user_id, 
    tlmm.managed_member_id,
    tlmm.managed_member_user_id,
    tlmm.managed_member_name,
    tlmm.managed_member_email,
    tlmm.managed_member_role_name,
    tlmm.level;

-- View for team lead time log details (for time tracking reporting)
CREATE OR REPLACE VIEW team_lead_time_logs AS
SELECT 
    tlmm.manager_id as team_lead_id,
    tlmm.manager_user_id as team_lead_user_id,
    tlmm.managed_member_id,
    tlmm.managed_member_user_id,
    tlmm.managed_member_name,
    twl.id as time_log_id,
    twl.time_spent,
    twl.description,
    twl.logged_by_timer,
    twl.created_at as logged_at,
    tasks.id as task_id,
    tasks.name as task_name,
    p.id as project_id,
    p.name as project_name
FROM team_lead_managed_members tlmm
JOIN task_work_log twl ON twl.user_id = tlmm.managed_member_user_id
JOIN tasks ON twl.task_id = tasks.id AND tasks.archived = FALSE
JOIN projects p ON tasks.project_id = p.id
WHERE tasks.archived = FALSE;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_team_members_reports_to_active 
ON team_members (reports_to_member_id, active) 
WHERE active = TRUE;

CREATE INDEX IF NOT EXISTS idx_task_work_log_user_task 
ON task_work_log (user_id, task_id, created_at);

CREATE INDEX IF NOT EXISTS idx_tasks_assignees_member_task 
ON tasks_assignees (team_member_id, task_id);

-- Grant necessary permissions
GRANT SELECT ON team_lead_managed_members TO PUBLIC;
GRANT SELECT ON team_lead_member_stats TO PUBLIC;
GRANT SELECT ON team_lead_member_performance TO PUBLIC;
GRANT SELECT ON team_lead_time_logs TO PUBLIC;
