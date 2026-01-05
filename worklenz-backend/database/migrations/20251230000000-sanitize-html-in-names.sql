-- Migration: Sanitize existing user names, project names, and team names to remove HTML tags
-- This migration removes any HTML tags that may have been injected before the HTML sanitization fix
-- Date: 2025-12-30
-- Handles duplicate names by appending a counter suffix

-- Sanitize existing user names (remove HTML tags)
-- Users don't have a unique constraint on name, so simple update works
UPDATE users 
SET name = REGEXP_REPLACE(name, '<[^>]*>', '', 'g')
WHERE name ~ '<[^>]*>';

-- Sanitize existing project names (remove HTML tags)
-- Projects have unique constraint on (name, team_id), so we need to handle duplicates
DO $$
DECLARE
    project_record RECORD;
    sanitized_name TEXT;
    counter INTEGER;
    final_name TEXT;
BEGIN
    -- Process each project that contains HTML tags
    FOR project_record IN 
        SELECT id, name, team_id 
        FROM projects 
        WHERE name ~ '<[^>]*>'
        ORDER BY created_at ASC  -- Process older projects first
    LOOP
        -- Remove HTML tags
        sanitized_name := REGEXP_REPLACE(project_record.name, '<[^>]*>', '', 'g');
        final_name := sanitized_name;
        counter := 1;
        
        -- Check if this name already exists for this team
        WHILE EXISTS (
            SELECT 1 FROM projects 
            WHERE name = final_name 
            AND team_id = project_record.team_id 
            AND id != project_record.id
        ) LOOP
            -- Append counter to make it unique
            final_name := sanitized_name || ' (' || counter || ')';
            counter := counter + 1;
        END LOOP;
        
        -- Update the project with the sanitized (and possibly suffixed) name
        UPDATE projects 
        SET name = final_name 
        WHERE id = project_record.id;
        
        IF final_name != sanitized_name THEN
            RAISE NOTICE 'Project renamed: "%" -> "%" (duplicate resolved)', project_record.name, final_name;
        END IF;
    END LOOP;
END $$;

-- Sanitize existing team names (remove HTML tags)
-- Teams have unique constraint on (name, organization_id), handle duplicates
DO $$
DECLARE
    team_record RECORD;
    sanitized_name TEXT;
    counter INTEGER;
    final_name TEXT;
BEGIN
    -- Process each team that contains HTML tags
    FOR team_record IN 
        SELECT id, name, organization_id 
        FROM teams 
        WHERE name ~ '<[^>]*>'
        ORDER BY created_at ASC
    LOOP
        -- Remove HTML tags
        sanitized_name := REGEXP_REPLACE(team_record.name, '<[^>]*>', '', 'g');
        final_name := sanitized_name;
        counter := 1;
        
        -- Check if this name already exists for this organization
        WHILE EXISTS (
            SELECT 1 FROM teams 
            WHERE name = final_name 
            AND organization_id = team_record.organization_id 
            AND id != team_record.id
        ) LOOP
            -- Append counter to make it unique
            final_name := sanitized_name || ' (' || counter || ')';
            counter := counter + 1;
        END LOOP;
        
        -- Update the team with the sanitized (and possibly suffixed) name
        UPDATE teams 
        SET name = final_name 
        WHERE id = team_record.id;
        
        IF final_name != sanitized_name THEN
            RAISE NOTICE 'Team renamed: "%" -> "%" (duplicate resolved)', team_record.name, final_name;
        END IF;
    END LOOP;
END $$;

-- Log the number of affected records
DO $$
DECLARE
    user_count INTEGER;
    project_count INTEGER;
    team_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO user_count FROM users WHERE name ~ '<[^>]*>';
    SELECT COUNT(*) INTO project_count FROM projects WHERE name ~ '<[^>]*>';
    SELECT COUNT(*) INTO team_count FROM teams WHERE name ~ '<[^>]*>';
    
    RAISE NOTICE 'HTML Sanitization Migration Complete:';
    RAISE NOTICE '  - Users sanitized: %', user_count;
    RAISE NOTICE '  - Projects sanitized: %', project_count;
    RAISE NOTICE '  - Teams sanitized: %', team_count;
END $$;
