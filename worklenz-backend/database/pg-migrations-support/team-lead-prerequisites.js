'use strict';

// Restore only missing objects from the historical Team Lead migrations.
// Existing definitions may contain later fixes and must not be replaced.
module.exports = `

-- Source: 1758412803000_fix_team_lead_view_admin_condition.js
DO $repair$
BEGIN
    IF to_regclass('public.team_lead_managed_members') IS NULL THEN
        EXECUTE $definition$
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
        $definition$;
    END IF;
END
$repair$;

-- Source: 1758412803000_fix_team_lead_view_admin_condition.js
DO $repair$
BEGIN
    IF to_regclass('public.team_lead_member_stats') IS NULL THEN
        EXECUTE $definition$
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
        $definition$;
    END IF;
END
$repair$;

-- Source: 1758412803000_fix_team_lead_view_admin_condition.js
DO $repair$
BEGIN
    IF to_regclass('public.team_lead_member_performance') IS NULL THEN
        EXECUTE $definition$
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
        $definition$;
    END IF;
END
$repair$;

-- Source: 1758412803000_fix_team_lead_view_admin_condition.js
DO $repair$
BEGIN
    IF to_regclass('public.team_lead_time_logs') IS NULL THEN
        EXECUTE $definition$
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
WHERE ap.project_id IS NULL;
        $definition$;
    END IF;
END
$repair$;

-- Source: 1758412802000_fix_team_lead_admin_privileges.js
DO $repair$
BEGIN
    IF to_regprocedure('public.is_team_lead_by_hierarchy(uuid,uuid)') IS NULL THEN
        EXECUTE $definition$
CREATE OR REPLACE FUNCTION is_team_lead_by_hierarchy(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
    has_reports boolean;
BEGIN
    -- Check if user has any direct or indirect reports in the team
    SELECT EXISTS(
        SELECT 1
        FROM team_lead_managed_members
        WHERE manager_user_id = _user_id
        AND team_id = _team_id
    ) INTO has_reports;

    RETURN has_reports;
END
$$;
        $definition$;
    END IF;
END
$repair$;

-- Source: 1758412802000_fix_team_lead_admin_privileges.js
DO $repair$
BEGIN
    IF to_regprocedure('public.get_team_lead_managed_members(uuid,uuid)') IS NULL THEN
        EXECUTE $definition$
CREATE OR REPLACE FUNCTION get_team_lead_managed_members(_team_lead_user_id uuid, _team_id uuid)
RETURNS TABLE(
    managed_member_id uuid,
    managed_member_user_id uuid,
    managed_member_name text,
    managed_member_email text,
    managed_member_role_name text,
    hierarchy_level integer
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        tlmm.managed_member_id,
        tlmm.managed_member_user_id,
        tlmm.managed_member_name,
        tlmm.managed_member_email,
        tlmm.managed_member_role_name,
        tlmm.level
    FROM team_lead_managed_members tlmm
    WHERE tlmm.manager_user_id = _team_lead_user_id
    AND tlmm.team_id = _team_id;
END
$$;
        $definition$;
    END IF;
END
$repair$;

-- Source: 1758412802000_fix_team_lead_admin_privileges.js
DO $repair$
BEGIN
    IF to_regprocedure('public.can_team_lead_access_member(uuid,uuid,uuid)') IS NULL THEN
        EXECUTE $definition$
CREATE OR REPLACE FUNCTION can_team_lead_access_member(
    _team_lead_user_id uuid,
    _team_id uuid,
    _target_member_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
    has_access boolean;
BEGIN
    -- Check if the target member is in the Team Lead's managed hierarchy
    SELECT EXISTS(
        SELECT 1
        FROM team_lead_managed_members
        WHERE manager_user_id = _team_lead_user_id
        AND team_id = _team_id
        AND managed_member_id = _target_member_id
    ) INTO has_access;

    RETURN has_access;
END
$$;
        $definition$;
    END IF;
END
$repair$;

-- Source: 1758412802000_fix_team_lead_admin_privileges.js
DO $repair$
BEGIN
    IF to_regprocedure('public.has_management_privileges(uuid,uuid)') IS NULL THEN
        EXECUTE $definition$
CREATE OR REPLACE FUNCTION has_management_privileges(_user_id uuid, _team_id uuid) RETURNS boolean
    LANGUAGE plpgsql
AS
$$
DECLARE
    user_role_name text;
    is_team_owner boolean;
    is_team_admin boolean;
    has_team_lead_reports boolean;
BEGIN
    -- Get user's role name
    SELECT r.name INTO user_role_name
    FROM team_members tm
    JOIN roles r ON tm.role_id = r.id
    WHERE tm.user_id = _user_id AND tm.team_id = _team_id;

    -- Check if user is owner
    SELECT is_owner(_user_id, _team_id) INTO is_team_owner;

    -- Check if user is admin
    SELECT is_admin(_user_id, _team_id) INTO is_team_admin;

    -- Check if Team Lead has reports
    IF user_role_name = 'Team Lead' THEN
        SELECT is_team_lead_by_hierarchy(_user_id, _team_id) INTO has_team_lead_reports;
    ELSE
        has_team_lead_reports := FALSE;
    END IF;

    RETURN is_team_owner OR is_team_admin OR has_team_lead_reports;
END
$$;
        $definition$;
    END IF;
END
$repair$;

-- Source: 1758412805000_update_permission_functions.js
DO $repair$
BEGIN
    IF to_regprocedure('public.can_access_team_management(uuid,uuid)') IS NULL THEN
        EXECUTE $definition$
CREATE OR REPLACE FUNCTION can_access_team_management(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
    user_role_name text;
    has_management_access boolean;
BEGIN
    -- Get user's role name
    SELECT r.name INTO user_role_name
    FROM team_members tm
    JOIN roles r ON tm.role_id = r.id
    WHERE tm.user_id = _user_id AND tm.team_id = _team_id;

    -- Check access based on role
    CASE user_role_name
        WHEN 'Owner' THEN
            has_management_access := TRUE;
        WHEN 'Admin' THEN
            has_management_access := TRUE;
        WHEN 'Team Lead' THEN
            -- Team Lead has access only if they have reports
            has_management_access := is_team_lead_by_hierarchy(_user_id, _team_id);
        ELSE
            has_management_access := FALSE;
    END CASE;

    RETURN has_management_access;
END
$$;
        $definition$;
    END IF;
END
$repair$;

-- Source: 1758412805000_update_permission_functions.js
DO $repair$
BEGIN
    IF to_regprocedure('public.can_access_billing(uuid,uuid)') IS NULL THEN
        EXECUTE $definition$
CREATE OR REPLACE FUNCTION can_access_billing(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
    -- Only Owner can access billing
    RETURN is_owner(_user_id, _team_id);
END
$$;
        $definition$;
    END IF;
END
$repair$;

-- Source: 1758412805000_update_permission_functions.js
DO $repair$
BEGIN
    IF to_regprocedure('public.can_manage_specific_member(uuid,uuid,uuid)') IS NULL THEN
        EXECUTE $definition$
CREATE OR REPLACE FUNCTION can_manage_specific_member(
    _manager_user_id uuid,
    _team_id uuid,
    _target_member_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
    manager_role_name text;
    target_role_name text;
    can_manage boolean;
BEGIN
    -- Get manager's role
    SELECT r.name INTO manager_role_name
    FROM team_members tm
    JOIN roles r ON tm.role_id = r.id
    WHERE tm.user_id = _manager_user_id AND tm.team_id = _team_id;

    -- Get target member's role
    SELECT r.name INTO target_role_name
    FROM team_members tm
    JOIN roles r ON tm.role_id = r.id
    WHERE tm.id = _target_member_id;

    -- Determine access based on roles
    CASE manager_role_name
        WHEN 'Owner' THEN
            -- Owner can manage anyone except other owners
            can_manage := (target_role_name != 'Owner');
        WHEN 'Admin' THEN
            -- Admin can manage Team Leads and Members, but not Owner
            can_manage := target_role_name IN ('Team Lead', 'Member');
        WHEN 'Team Lead' THEN
            -- Team Lead can only manage their direct/indirect reports
            can_manage := can_team_lead_access_member(_manager_user_id, _team_id, _target_member_id);
        ELSE
            can_manage := FALSE;
    END CASE;

    RETURN can_manage;
END
$$;
        $definition$;
    END IF;
END
$repair$;

-- Source: 1758412805000_update_permission_functions.js
DO $repair$
BEGIN
    IF to_regprocedure('public.get_user_permissions_summary(uuid,uuid)') IS NULL THEN
        EXECUTE $definition$
CREATE OR REPLACE FUNCTION get_user_permissions_summary(_user_id uuid, _team_id uuid)
RETURNS TABLE(
    role_name text,
    is_owner boolean,
    is_admin boolean,
    is_team_lead boolean,
    can_access_management boolean,
    can_access_billing boolean,
    managed_members_count integer
)
LANGUAGE plpgsql
AS $$
DECLARE
    user_role text;
    managed_count integer := 0;
BEGIN
    -- Get user's role
    SELECT r.name INTO user_role
    FROM team_members tm
    JOIN roles r ON tm.role_id = r.id
    WHERE tm.user_id = _user_id AND tm.team_id = _team_id;

    -- Count managed members if Team Lead
    IF user_role = 'Team Lead' THEN
        SELECT COUNT(*) INTO managed_count
        FROM team_lead_managed_members
        WHERE manager_user_id = _user_id AND team_id = _team_id;
    END IF;

    RETURN QUERY
    SELECT
        user_role as role_name,
        (user_role = 'Owner') as is_owner,
        (user_role = 'Admin') as is_admin,
        (user_role = 'Team Lead' AND managed_count > 0) as is_team_lead,
        can_access_team_management(_user_id, _team_id) as can_access_management,
        can_access_billing(_user_id, _team_id) as can_access_billing,
        managed_count as managed_members_count;
END
$$;
        $definition$;
    END IF;
END
$repair$;
`;
