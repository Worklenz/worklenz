-- Verification script to check Team Lead role deployment
-- Run this after the migration to verify all teams have the Team Lead role

-- Check how many teams exist
SELECT 'Total Teams' as type, COUNT(*) as count FROM teams;

-- Check how many teams have Team Lead role
SELECT 'Teams with Team Lead role' as type, COUNT(DISTINCT team_id) as count 
FROM roles 
WHERE name = 'Team Lead' AND admin_role = TRUE;

-- List teams missing Team Lead role (should be empty after migration)
SELECT 'Teams missing Team Lead role:' as info;
SELECT t.id as team_id, t.name as team_name
FROM teams t
WHERE NOT EXISTS (
    SELECT 1 FROM roles r 
    WHERE r.team_id = t.id 
    AND r.name = 'Team Lead' 
    AND r.admin_role = TRUE
);

-- Show all roles for each team to verify structure
SELECT 'Role distribution per team:' as info;
SELECT t.name as team_name, r.name as role_name, r.admin_role, r.default_role, r.owner
FROM teams t
LEFT JOIN roles r ON t.id = r.team_id
ORDER BY t.name, 
    CASE r.name 
        WHEN 'Owner' THEN 1 
        WHEN 'Admin' THEN 2 
        WHEN 'Team Lead' THEN 3 
        WHEN 'Member' THEN 4 
        ELSE 5 
    END;