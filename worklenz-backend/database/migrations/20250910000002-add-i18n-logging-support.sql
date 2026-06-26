-- Migration: Add i18n support for activity logging
-- This migration adds fields to store i18n keys and parameters for internationalized logging

-- Add i18n fields to project_logs table
ALTER TABLE project_logs ADD COLUMN IF NOT EXISTS i18n_key TEXT;
ALTER TABLE project_logs ADD COLUMN IF NOT EXISTS i18n_params JSONB;
ALTER TABLE project_logs ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE project_logs ADD COLUMN IF NOT EXISTS user_name TEXT;
ALTER TABLE project_logs ADD COLUMN IF NOT EXISTS project_name TEXT;

-- Add foreign key constraint for user_id
ALTER TABLE project_logs 
ADD CONSTRAINT project_logs_user_id_fk 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

-- Add i18n fields to task_activity_logs table  
ALTER TABLE task_activity_logs ADD COLUMN IF NOT EXISTS i18n_key TEXT;
ALTER TABLE task_activity_logs ADD COLUMN IF NOT EXISTS i18n_params JSONB;

-- Create index for better performance on i18n_key queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_project_logs_i18n_key ON project_logs(i18n_key);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_activity_logs_i18n_key ON task_activity_logs(i18n_key);

-- Create function to log project activities with i18n support
CREATE OR REPLACE FUNCTION log_project_activity_i18n(
    _team_id UUID,
    _project_id UUID,
    _user_id UUID,
    _i18n_key TEXT,
    _i18n_params JSONB DEFAULT '{}',
    _project_name TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    _user_name TEXT;
    _resolved_project_name TEXT;
BEGIN
    -- Get user name
    SELECT name INTO _user_name FROM users WHERE id = _user_id;
    
    -- Get project name if not provided
    IF _project_name IS NULL THEN
        SELECT name INTO _resolved_project_name FROM projects WHERE id = _project_id;
    ELSE
        _resolved_project_name := _project_name;
    END IF;
    
    -- Add user info to params
    _i18n_params := _i18n_params || jsonb_build_object(
        'userName', COALESCE(_user_name, 'Unknown User'),
        'projectName', COALESCE(_resolved_project_name, 'Unknown Project')
    );
    
    -- Insert the log entry
    INSERT INTO project_logs (
        team_id, 
        project_id, 
        user_id,
        user_name,
        project_name,
        i18n_key, 
        i18n_params,
        description
    ) VALUES (
        _team_id,
        _project_id,
        _user_id,
        _user_name,
        _resolved_project_name,
        _i18n_key,
        _i18n_params,
        -- Keep fallback description for backward compatibility
        CASE _i18n_key
            WHEN 'activityLogs.project.created' THEN 'Project created by ' || COALESCE(_user_name, 'Unknown User')
            WHEN 'activityLogs.project.updated' THEN 'Project updated by ' || COALESCE(_user_name, 'Unknown User')
            WHEN 'activityLogs.project.deleted' THEN 'Project deleted by ' || COALESCE(_user_name, 'Unknown User')
            WHEN 'activityLogs.project.archived' THEN 'Project archived by ' || COALESCE(_user_name, 'Unknown User')
            WHEN 'activityLogs.project.unarchived' THEN 'Project unarchived by ' || COALESCE(_user_name, 'Unknown User')
            WHEN 'activityLogs.project.favorited' THEN 'Project favorited by ' || COALESCE(_user_name, 'Unknown User')
            WHEN 'activityLogs.project.unfavorited' THEN 'Project unfavorited by ' || COALESCE(_user_name, 'Unknown User')
            WHEN 'activityLogs.project.statusChanged' THEN 'Project status changed by ' || COALESCE(_user_name, 'Unknown User')
            WHEN 'activityLogs.project.managerAssigned' THEN 'Project manager assigned by ' || COALESCE(_user_name, 'Unknown User')
            WHEN 'activityLogs.project.managerRemoved' THEN 'Project manager removed by ' || COALESCE(_user_name, 'Unknown User')
            WHEN 'activityLogs.project.memberAdded' THEN (_i18n_params->>'memberName') || ' was added to the project by ' || COALESCE(_user_name, 'Unknown User')
            WHEN 'activityLogs.project.memberRemoved' THEN (_i18n_params->>'memberName') || ' was removed from the project by ' || COALESCE(_user_name, 'Unknown User')
            ELSE 'Activity by ' || COALESCE(_user_name, 'Unknown User')
        END
    );
END;
$$;

-- Create function to log task activities with i18n support
CREATE OR REPLACE FUNCTION log_task_activity_i18n(
    _task_id UUID,
    _team_id UUID,
    _project_id UUID,
    _user_id UUID,
    _attribute_type TEXT,
    _log_type TEXT,
    _i18n_key TEXT,
    _i18n_params JSONB DEFAULT '{}',
    _old_value TEXT DEFAULT NULL,
    _new_value TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    -- Insert the log entry
    INSERT INTO task_activity_logs (
        task_id,
        team_id,
        project_id,
        user_id,
        attribute_type,
        log_type,
        old_value,
        new_value,
        i18n_key,
        i18n_params
    ) VALUES (
        _task_id,
        _team_id,
        _project_id,
        _user_id,
        _attribute_type,
        _log_type,
        _old_value,
        _new_value,
        _i18n_key,
        _i18n_params
    );
END;
$$;

-- Update existing logs to have basic i18n keys for backward compatibility
-- This will help transition existing logs to the new system
UPDATE project_logs SET 
    i18n_key = CASE
        WHEN description LIKE '%created by%' THEN 'activityLogs.project.created'
        WHEN description LIKE '%updated by%' THEN 'activityLogs.project.updated'
        WHEN description LIKE '%deleted by%' THEN 'activityLogs.project.deleted'
        WHEN description LIKE '%archived by%' THEN 'activityLogs.project.archived'
        WHEN description LIKE '%unarchived by%' THEN 'activityLogs.project.unarchived'
        WHEN description LIKE '%favorited by%' THEN 'activityLogs.project.favorited'
        WHEN description LIKE '%unfavorited by%' THEN 'activityLogs.project.unfavorited'
        WHEN description LIKE '%status changed by%' THEN 'activityLogs.project.statusChanged'
        WHEN description LIKE '%manager assigned by%' THEN 'activityLogs.project.managerAssigned'
        WHEN description LIKE '%manager removed by%' THEN 'activityLogs.project.managerRemoved'
        WHEN description LIKE '%was added to the project by%' THEN 'activityLogs.project.memberAdded'
        WHEN description LIKE '%was removed from the project by%' THEN 'activityLogs.project.memberRemoved'
        ELSE 'activityLogs.generic.activity'
    END,
    i18n_params = jsonb_build_object(
        'userName', 
        CASE 
            WHEN description LIKE '%by %' THEN 
                TRIM(SUBSTRING(description FROM '.* by (.*)'))
            ELSE 'Unknown User'
        END,
        'projectName', COALESCE(project_name, 'Unknown Project')
    )
WHERE i18n_key IS NULL;

COMMENT ON COLUMN project_logs.i18n_key IS 'Internationalization key for the log message';
COMMENT ON COLUMN project_logs.i18n_params IS 'Parameters for interpolating the i18n message';
COMMENT ON COLUMN project_logs.user_id IS 'ID of the user who performed the action';
COMMENT ON COLUMN project_logs.user_name IS 'Name of the user who performed the action (cached)';
COMMENT ON COLUMN project_logs.project_name IS 'Name of the project (cached for historical reference)';

COMMENT ON COLUMN task_activity_logs.i18n_key IS 'Internationalization key for the log message';
COMMENT ON COLUMN task_activity_logs.i18n_params IS 'Parameters for interpolating the i18n message';

-- Update the create_project function to also create i18n logs
CREATE OR REPLACE FUNCTION create_project(_body json) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _user_id        UUID;
    _team_id        UUID;
    _client_id      UUID;
    _project_id     UUID;
    _client_name    TEXT;
    _project_name   TEXT;
    _team_member_id UUID;
    _user_name      TEXT;
BEGIN
    -- need a test, can be throw errors
    _client_name = TRIM((_body ->> 'client_name')::TEXT);
    _project_name = TRIM((_body ->> 'name')::TEXT);

    -- add inside the controller
    _user_id = (_body ->> 'user_id')::UUID;
    _team_id = (_body ->> 'team_id')::UUID;

    -- cache exists client if exists
    SELECT id FROM clients WHERE LOWER(name) = LOWER(_client_name) AND team_id = _team_id INTO _client_id;
    SELECT id FROM team_members WHERE team_id = _team_id AND user_id = _user_id INTO _team_member_id;

    -- check whether the project name is already in
    IF EXISTS(SELECT name
              FROM projects
              WHERE LOWER(name) = LOWER(_project_name)
                AND team_id = _team_id)
    THEN
        RAISE 'PROJECT_EXISTS_ERROR:%', _project_name;
    END IF;

    -- insert client if not exists
    IF is_null_or_empty(_client_id) IS TRUE AND is_null_or_empty(_client_name) IS FALSE
    THEN
        INSERT INTO clients (name, team_id) VALUES (_client_name, _team_id) RETURNING id INTO _client_id;
    END IF;

    -- insert project
    INSERT INTO projects (name, key, notes, color_code, team_id, client_id, owner_id, status_id, health_id, start_date,
                          end_date,
                          folder_id, category_id, estimated_working_days, estimated_man_days, hours_per_day)
    VALUES (_project_name, (_body ->> 'key')::TEXT, (_body ->> 'notes')::TEXT, (_body ->> 'color_code')::TEXT, _team_id,
            _client_id,
            _user_id, (_body ->> 'status_id')::UUID, (_body ->> 'health_id')::UUID,
            (_body ->> 'start_date')::TIMESTAMPTZ,
            (_body ->> 'end_date')::TIMESTAMPTZ, (_body ->> 'folder_id')::UUID, (_body ->> 'category_id')::UUID,
            (_body ->> 'working_days')::INTEGER, (_body ->> 'man_days')::INTEGER, (_body ->> 'hours_per_day')::INTEGER)
    RETURNING id INTO _project_id;

    -- Note: Logging is now handled in the application layer

    -- insert the project creator as a project member
    INSERT INTO project_members (team_member_id, project_access_level_id, project_id, role_id)
    VALUES (_team_member_id, (SELECT id FROM project_access_levels WHERE key = 'ADMIN'),
            _project_id,
            (SELECT id FROM roles WHERE team_id = _team_id AND default_role IS TRUE));

    -- insert statuses
    INSERT INTO task_statuses (name, project_id, team_id, category_id, sort_order)
    VALUES ('To Do', _project_id, _team_id, (SELECT id FROM sys_task_status_categories WHERE is_todo IS TRUE), 0);
    INSERT INTO task_statuses (name, project_id, team_id, category_id, sort_order)
    VALUES ('Doing', _project_id, _team_id, (SELECT id FROM sys_task_status_categories WHERE is_doing IS TRUE), 1);
    INSERT INTO task_statuses (name, project_id, team_id, category_id, sort_order)
    VALUES ('Done', _project_id, _team_id, (SELECT id FROM sys_task_status_categories WHERE is_done IS TRUE), 2);

    -- insert default columns for task list
    PERFORM insert_task_list_columns(_project_id);

    RETURN JSON_BUILD_OBJECT(
            'id', _project_id,
            'name', _project_name
           );
END
$$;