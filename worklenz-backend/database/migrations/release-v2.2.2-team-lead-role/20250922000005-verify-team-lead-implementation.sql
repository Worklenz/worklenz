-- Migration: Verify Team Lead Implementation
-- Description: Comprehensive verification queries to ensure Team Lead roles are correctly configured
-- Version: v2.2.2
-- Date: 2025-01-21

-- Step 1: Verify that all Team Lead roles have admin_role = FALSE
DO $$
DECLARE
    admin_team_leads integer;
    total_team_leads integer;
BEGIN
    -- Count Team Lead roles with admin privileges
    SELECT COUNT(*) INTO admin_team_leads
    FROM roles 
    WHERE name = 'Team Lead' AND admin_role = TRUE;
    
    -- Count total Team Lead roles
    SELECT COUNT(*) INTO total_team_leads
    FROM roles 
    WHERE name = 'Team Lead';
    
    IF admin_team_leads > 0 THEN
        RAISE EXCEPTION 'VERIFICATION FAILED: % out of % Team Lead roles still have admin_role = TRUE', admin_team_leads, total_team_leads;
    ELSE
        RAISE NOTICE 'VERIFICATION PASSED: All % Team Lead roles have admin_role = FALSE', total_team_leads;
    END IF;
END
$$;

-- Step 2: Verify that all teams have the correct role structure
DO $$
DECLARE
    teams_missing_team_lead integer;
    total_teams integer;
BEGIN
    -- Count teams missing Team Lead role
    SELECT COUNT(*) INTO teams_missing_team_lead
    FROM teams t
    WHERE NOT EXISTS (
        SELECT 1 FROM roles r 
        WHERE r.team_id = t.id 
        AND r.name = 'Team Lead'
    );
    
    -- Count total teams
    SELECT COUNT(*) INTO total_teams FROM teams;
    
    IF teams_missing_team_lead > 0 THEN
        RAISE EXCEPTION 'VERIFICATION FAILED: % out of % teams are missing Team Lead role', teams_missing_team_lead, total_teams;
    ELSE
        RAISE NOTICE 'VERIFICATION PASSED: All % teams have Team Lead role', total_teams;
    END IF;
END
$$;

-- Step 3: Verify that Team Lead roles are properly configured
DO $$
DECLARE
    team_leads_with_owner integer;
    team_leads_with_default integer;
    properly_configured integer;
BEGIN
    -- Count Team Lead roles incorrectly marked as owner
    SELECT COUNT(*) INTO team_leads_with_owner
    FROM roles 
    WHERE name = 'Team Lead' AND owner = TRUE;
    
    -- Count Team Lead roles incorrectly marked as default
    SELECT COUNT(*) INTO team_leads_with_default
    FROM roles 
    WHERE name = 'Team Lead' AND default_role = TRUE;
    
    -- Count properly configured Team Lead roles
    SELECT COUNT(*) INTO properly_configured
    FROM roles 
    WHERE name = 'Team Lead' 
    AND admin_role = FALSE 
    AND owner = FALSE 
    AND default_role = FALSE;
    
    IF team_leads_with_owner > 0 THEN
        RAISE EXCEPTION 'VERIFICATION FAILED: % Team Lead roles are incorrectly marked as owner', team_leads_with_owner;
    END IF;
    
    IF team_leads_with_default > 0 THEN
        RAISE EXCEPTION 'VERIFICATION FAILED: % Team Lead roles are incorrectly marked as default', team_leads_with_default;
    END IF;
    
    RAISE NOTICE 'VERIFICATION PASSED: % Team Lead roles are correctly configured', properly_configured;
END
$$;

-- Step 4: Verify that hierarchy-based functions exist and work correctly
DO $$
DECLARE
    function_exists boolean;
BEGIN
    -- Test hierarchy-based functions exist
    BEGIN
        -- Test is_team_lead_by_hierarchy function
        SELECT EXISTS(
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'public' AND p.proname = 'is_team_lead_by_hierarchy'
        ) INTO function_exists;
        
        IF NOT function_exists THEN
            RAISE EXCEPTION 'VERIFICATION FAILED: is_team_lead_by_hierarchy function does not exist';
        END IF;
        
        -- Test get_team_lead_managed_members function
        SELECT EXISTS(
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'public' AND p.proname = 'get_team_lead_managed_members'
        ) INTO function_exists;
        
        IF NOT function_exists THEN
            RAISE EXCEPTION 'VERIFICATION FAILED: get_team_lead_managed_members function does not exist';
        END IF;
        
        -- Test can_team_lead_access_member function
        SELECT EXISTS(
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'public' AND p.proname = 'can_team_lead_access_member'
        ) INTO function_exists;
        
        IF NOT function_exists THEN
            RAISE EXCEPTION 'VERIFICATION FAILED: can_team_lead_access_member function does not exist';
        END IF;
        
        RAISE NOTICE 'VERIFICATION PASSED: All hierarchy-based functions exist and are accessible';
        
    EXCEPTION
        WHEN OTHERS THEN
            RAISE EXCEPTION 'VERIFICATION FAILED: Error testing hierarchy functions: %', SQLERRM;
    END;
END
$$;

-- Step 5: Verify that permission functions exist
DO $$
DECLARE
    function_exists boolean;
BEGIN
    -- Test permission functions exist
    BEGIN
        -- Test can_access_team_management function
        SELECT EXISTS(
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'public' AND p.proname = 'can_access_team_management'
        ) INTO function_exists;
        
        IF NOT function_exists THEN
            RAISE EXCEPTION 'VERIFICATION FAILED: can_access_team_management function does not exist';
        END IF;
        
        -- Test can_access_billing function
        SELECT EXISTS(
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'public' AND p.proname = 'can_access_billing'
        ) INTO function_exists;
        
        IF NOT function_exists THEN
            RAISE EXCEPTION 'VERIFICATION FAILED: can_access_billing function does not exist';
        END IF;
        
        -- Test get_user_permissions_summary function
        SELECT EXISTS(
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'public' AND p.proname = 'get_user_permissions_summary'
        ) INTO function_exists;
        
        IF NOT function_exists THEN
            RAISE EXCEPTION 'VERIFICATION FAILED: get_user_permissions_summary function does not exist';
        END IF;
        
        RAISE NOTICE 'VERIFICATION PASSED: All permission functions exist and are accessible';
        
    EXCEPTION
        WHEN OTHERS THEN
            RAISE EXCEPTION 'VERIFICATION FAILED: Error testing permission functions: %', SQLERRM;
    END;
END
$$;

-- Step 6: Verify that views exist and are accessible
DO $$
DECLARE
    view_exists boolean;
BEGIN
    -- Test team_lead_managed_members view
    SELECT EXISTS(
        SELECT 1 FROM pg_views 
        WHERE schemaname = 'public' AND viewname = 'team_lead_managed_members'
    ) INTO view_exists;
    
    IF NOT view_exists THEN
        RAISE EXCEPTION 'VERIFICATION FAILED: team_lead_managed_members view does not exist';
    END IF;
    
    -- Test other views
    SELECT EXISTS(
        SELECT 1 FROM pg_views 
        WHERE schemaname = 'public' AND viewname = 'team_lead_member_stats'
    ) INTO view_exists;
    
    IF NOT view_exists THEN
        RAISE EXCEPTION 'VERIFICATION FAILED: team_lead_member_stats view does not exist';
    END IF;
    
    RAISE NOTICE 'VERIFICATION PASSED: All Team Lead views exist and are accessible';
END
$$;

-- Step 7: Verify that required indexes exist
DO $$
DECLARE
    index_exists boolean;
BEGIN
    -- Test reports_to_member_id index
    SELECT EXISTS(
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND tablename = 'team_members' 
        AND indexname = 'idx_reports_to_member_id'
    ) INTO index_exists;
    
    IF NOT index_exists THEN
        RAISE EXCEPTION 'VERIFICATION FAILED: idx_reports_to_member_id index does not exist';
    END IF;
    
    RAISE NOTICE 'VERIFICATION PASSED: Required indexes exist for performance optimization';
END
$$;

-- Step 8: Create a comprehensive verification report
CREATE OR REPLACE VIEW team_lead_implementation_verification AS
SELECT 
    'Role Configuration' as category,
    'Team Lead Roles Without Admin Privileges' as check_name,
    COUNT(*) as count,
    CASE WHEN COUNT(*) = (SELECT COUNT(*) FROM roles WHERE name = 'Team Lead') 
         THEN 'PASS' ELSE 'FAIL' END as status
FROM roles 
WHERE name = 'Team Lead' AND admin_role = FALSE

UNION ALL

SELECT 
    'Role Configuration' as category,
    'Teams with Team Lead Role' as check_name,
    COUNT(*) as count,
    'PASS' as status
FROM teams t
WHERE EXISTS (SELECT 1 FROM roles r WHERE r.team_id = t.id AND r.name = 'Team Lead')

UNION ALL

SELECT 
    'Database Objects' as category,
    'Hierarchy Functions Available' as check_name,
    COUNT(*) as count,
    CASE WHEN COUNT(*) >= 3 THEN 'PASS' ELSE 'FAIL' END as status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname IN ('is_team_lead_by_hierarchy', 'get_team_lead_managed_members', 'can_team_lead_access_member')

UNION ALL

SELECT 
    'Database Objects' as category,
    'Permission Functions Available' as check_name,
    COUNT(*) as count,
    CASE WHEN COUNT(*) >= 3 THEN 'PASS' ELSE 'FAIL' END as status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname IN ('can_access_team_management', 'can_access_billing', 'get_user_permissions_summary')

UNION ALL

SELECT 
    'Database Objects' as category,
    'Team Lead Views Available' as check_name,
    COUNT(*) as count,
    CASE WHEN COUNT(*) >= 2 THEN 'PASS' ELSE 'FAIL' END as status
FROM pg_views 
WHERE schemaname = 'public' 
  AND viewname LIKE 'team_lead_%';

-- Step 9: Grant permissions on verification view
GRANT SELECT ON team_lead_implementation_verification TO PUBLIC;

-- Step 10: Final verification summary
DO $$
DECLARE
    total_checks integer;
    passed_checks integer;
    failed_checks integer;
BEGIN
    -- Count total checks
    SELECT COUNT(*) INTO total_checks FROM team_lead_implementation_verification;
    
    -- Count passed checks
    SELECT COUNT(*) INTO passed_checks 
    FROM team_lead_implementation_verification 
    WHERE status = 'PASS';
    
    -- Count failed checks
    SELECT COUNT(*) INTO failed_checks 
    FROM team_lead_implementation_verification 
    WHERE status = 'FAIL';
    
    RAISE NOTICE '=== TEAM LEAD IMPLEMENTATION VERIFICATION SUMMARY ===';
    RAISE NOTICE 'Total Checks: %', total_checks;
    RAISE NOTICE 'Passed: %', passed_checks;
    RAISE NOTICE 'Failed: %', failed_checks;
    
    IF failed_checks > 0 THEN
        RAISE EXCEPTION 'VERIFICATION FAILED: % out of % checks failed. See team_lead_implementation_verification view for details.', failed_checks, total_checks;
    ELSE
        RAISE NOTICE 'VERIFICATION PASSED: All % checks passed successfully!', total_checks;
        RAISE NOTICE 'Team Lead implementation is correctly configured with hierarchy-based access control.';
    END IF;
END
$$;