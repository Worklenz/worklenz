-- Migration: Fix Team Lead Role Admin Privileges
-- Description: Removes admin_role privileges from Team Lead roles and implements hierarchy-based access
-- Version: v2.2.2
-- Date: 2025-01-21

-- Step 1: Remove admin_role privileges from existing Team Lead roles
UPDATE roles 
SET admin_role = FALSE 
WHERE name = 'Team Lead' AND admin_role = TRUE;

-- Step 2: Create a function to check if a user is a Team Lead based on hierarchy
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

-- Step 3: Create a function to get Team Lead's managed members
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

-- Step 4: Create a function to check if Team Lead can access a specific member
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

-- Step 5: Update the existing is_admin function to exclude Team Leads
CREATE OR REPLACE FUNCTION is_admin(_user_id uuid, _team_id uuid) RETURNS boolean
    LANGUAGE plpgsql
AS
$$
DECLARE
BEGIN
    RETURN EXISTS(SELECT 1
                  FROM team_members
                  WHERE team_id = _team_id
                    AND user_id = _user_id
                    AND role_id = (SELECT id
                                   FROM roles
                                   WHERE id = team_members.role_id
                                     AND admin_role IS TRUE
                                     AND name = 'Admin')); -- Only Admin role, not Team Lead
END
$$;

-- Step 6: Create a new function to check if user has management privileges (including Team Lead)
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

-- Step 7: Add verification queries
-- Check that all Team Lead roles now have admin_role = FALSE
DO $$
DECLARE
    admin_team_leads integer;
BEGIN
    SELECT COUNT(*) INTO admin_team_leads
    FROM roles 
    WHERE name = 'Team Lead' AND admin_role = TRUE;
    
    IF admin_team_leads > 0 THEN
        RAISE EXCEPTION 'Migration failed: % Team Lead roles still have admin_role = TRUE', admin_team_leads;
    ELSE
        RAISE NOTICE 'Migration successful: All Team Lead roles now have admin_role = FALSE';
    END IF;
END
$$;

-- Step 8: Grant necessary permissions
GRANT EXECUTE ON FUNCTION is_team_lead_by_hierarchy(uuid, uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION get_team_lead_managed_members(uuid, uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION can_team_lead_access_member(uuid, uuid, uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION has_management_privileges(uuid, uuid) TO PUBLIC;
