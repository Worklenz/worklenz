-- Migration: Update Permission Checking Functions for Hierarchy-Based Team Lead Access
-- Description: Creates minimal permission functions that work with existing schema
-- Version: v2.2.2
-- Date: 2025-01-21

-- Step 1: Create function to check if user can access team management features
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

-- Step 2: Create function to check if user can access billing (Owner only)
CREATE OR REPLACE FUNCTION can_access_billing(_user_id uuid, _team_id uuid) 
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
    -- Only Owner can access billing
    RETURN is_owner(_user_id, _team_id);
END
$$;

-- Step 3: Create function to check if user can manage specific team member
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

-- Step 4: Create function to get user's effective permissions summary
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

-- Step 5: Grant necessary permissions
GRANT EXECUTE ON FUNCTION can_access_team_management(uuid, uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION can_access_billing(uuid, uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION can_manage_specific_member(uuid, uuid, uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION get_user_permissions_summary(uuid, uuid) TO PUBLIC;

-- Step 6: Add verification that functions work correctly
DO $$
DECLARE
    test_user_id uuid := gen_random_uuid();
    test_team_id uuid := gen_random_uuid();
    test_result boolean;
BEGIN
    -- Test that functions exist and can be called
    BEGIN
        SELECT can_access_team_management(test_user_id, test_team_id) INTO test_result;
        RAISE NOTICE 'Permission functions created successfully';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE EXCEPTION 'Permission function creation failed: %', SQLERRM;
    END;
END
$$;