-- Migration: Add auto_assign_task_creator column to projects table
-- This feature allows projects to automatically assign the task creator to newly created tasks

-- Add the column to projects table
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS auto_assign_task_creator BOOLEAN DEFAULT FALSE;

-- Add comment to explain the column
COMMENT ON COLUMN projects.auto_assign_task_creator IS 'When enabled, automatically assigns the person who creates a task to that task';

-- Update create_project function to include auto_assign_task_creator
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
BEGIN
    _client_name = TRIM((_body ->> 'client_name')::TEXT);
    _project_name = TRIM((_body ->> 'name')::TEXT);
    _user_id = (_body ->> 'user_id')::UUID;
    _team_id = (_body ->> 'team_id')::UUID;

    SELECT id FROM clients WHERE LOWER(name) = LOWER(_client_name) AND team_id = _team_id INTO _client_id;
    SELECT id FROM team_members WHERE team_id = _team_id AND user_id = _user_id INTO _team_member_id;

    IF EXISTS(SELECT name FROM projects WHERE LOWER(name) = LOWER(_project_name) AND team_id = _team_id)
    THEN
        RAISE 'PROJECT_EXISTS_ERROR:%', _project_name;
    END IF;

    IF is_null_or_empty(_client_id) IS TRUE AND is_null_or_empty(_client_name) IS FALSE
    THEN
        INSERT INTO clients (name, team_id) VALUES (_client_name, _team_id) RETURNING id INTO _client_id;
    END IF;

    INSERT INTO projects (name, key, notes, color_code, team_id, client_id, owner_id, status_id, health_id, start_date,
                          end_date, folder_id, category_id, estimated_working_days, estimated_man_days, hours_per_day,
                          use_manual_progress, use_weighted_progress, use_time_progress, auto_assign_task_creator)
    VALUES (_project_name, (_body ->> 'key')::TEXT, (_body ->> 'notes')::TEXT, (_body ->> 'color_code')::TEXT, _team_id,
            _client_id, _user_id, (_body ->> 'status_id')::UUID, (_body ->> 'health_id')::UUID,
            (_body ->> 'start_date')::TIMESTAMPTZ, (_body ->> 'end_date')::TIMESTAMPTZ, 
            (_body ->> 'folder_id')::UUID, (_body ->> 'category_id')::UUID,
            (_body ->> 'working_days')::INTEGER, (_body ->> 'man_days')::INTEGER, (_body ->> 'hours_per_day')::INTEGER,
            COALESCE((_body ->> 'use_manual_progress')::BOOLEAN, FALSE), 
            COALESCE((_body ->> 'use_weighted_progress')::BOOLEAN, FALSE), 
            COALESCE((_body ->> 'use_time_progress')::BOOLEAN, FALSE),
            COALESCE((_body ->> 'auto_assign_task_creator')::BOOLEAN, FALSE))
    RETURNING id INTO _project_id;

    INSERT INTO project_logs (team_id, project_id, description)
    VALUES (_team_id, _project_id,
            REPLACE((_body ->> 'project_created_log')::TEXT, '@user',
                    (SELECT name FROM users WHERE id = _user_id)));

    INSERT INTO project_members (team_member_id, project_access_level_id, project_id, role_id)
    VALUES (_team_member_id, (SELECT id FROM project_access_levels WHERE key = 'ADMIN'),
            _project_id,
            (SELECT id FROM roles WHERE team_id = _team_id AND default_role IS TRUE));

    INSERT INTO task_statuses (name, project_id, team_id, category_id, sort_order)
    VALUES ('To Do', _project_id, _team_id, (SELECT id FROM sys_task_status_categories WHERE is_todo IS TRUE), 0);
    INSERT INTO task_statuses (name, project_id, team_id, category_id, sort_order)
    VALUES ('Doing', _project_id, _team_id, (SELECT id FROM sys_task_status_categories WHERE is_doing IS TRUE), 1);
    INSERT INTO task_statuses (name, project_id, team_id, category_id, sort_order)
    VALUES ('Done', _project_id, _team_id, (SELECT id FROM sys_task_status_categories WHERE is_done IS TRUE), 2);

    PERFORM insert_task_list_columns(_project_id);

    RETURN JSON_BUILD_OBJECT('id', _project_id, 'name', (_body ->> 'name')::TEXT);
END;
$$;

-- Update update_project function to include auto_assign_task_creator
CREATE OR REPLACE FUNCTION update_project(_body json) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _user_id                        UUID;
    _team_id                        UUID;
    _client_id                      UUID;
    _project_id                     UUID;
    _project_manager_team_member_id UUID;
    _client_name                    TEXT;
    _project_name                   TEXT;
BEGIN
    _client_name = TRIM((_body ->> 'client_name')::TEXT);
    _project_name = TRIM((_body ->> 'name')::TEXT);
    _user_id = (_body ->> 'user_id')::UUID;
    _team_id = (_body ->> 'team_id')::UUID;
    _project_manager_team_member_id = (_body ->> 'team_member_id')::UUID;

    SELECT id FROM clients WHERE LOWER(name) = LOWER(_client_name) AND team_id = _team_id INTO _client_id;

    IF is_null_or_empty(_client_id) IS TRUE AND is_null_or_empty(_client_name) IS FALSE
    THEN
        INSERT INTO clients (name, team_id) VALUES (_client_name, _team_id) RETURNING id INTO _client_id;
    END IF;

    IF EXISTS(
        SELECT name FROM projects WHERE LOWER(name) = LOWER(_project_name)
                                    AND team_id = _team_id AND id != (_body ->> 'id')::UUID
    )
    THEN
        RAISE 'PROJECT_EXISTS_ERROR:%', _project_name;
    END IF;

    UPDATE projects
    SET name                   = _project_name,
        notes                  = (_body ->> 'notes')::TEXT,
        color_code             = (_body ->> 'color_code')::TEXT,
        status_id              = (_body ->> 'status_id')::UUID,
        health_id              = (_body ->> 'health_id')::UUID,
        key                    = (_body ->> 'key')::TEXT,
        start_date             = (_body ->> 'start_date')::TIMESTAMPTZ,
        end_date               = (_body ->> 'end_date')::TIMESTAMPTZ,
        client_id              = _client_id,
        folder_id              = (_body ->> 'folder_id')::UUID,
        category_id            = (_body ->> 'category_id')::UUID,
        updated_at             = CURRENT_TIMESTAMP,
        estimated_working_days = (_body ->> 'working_days')::INTEGER,
        estimated_man_days     = (_body ->> 'man_days')::INTEGER,
        hours_per_day          = (_body ->> 'hours_per_day')::INTEGER,
        use_manual_progress    = COALESCE((_body ->> 'use_manual_progress')::BOOLEAN, FALSE),
        use_weighted_progress  = COALESCE((_body ->> 'use_weighted_progress')::BOOLEAN, FALSE),
        use_time_progress      = COALESCE((_body ->> 'use_time_progress')::BOOLEAN, FALSE),
        auto_assign_task_creator = COALESCE((_body ->> 'auto_assign_task_creator')::BOOLEAN, FALSE)
    WHERE id = (_body ->> 'id')::UUID
      AND team_id = _team_id
    RETURNING id INTO _project_id;

    UPDATE project_members SET project_access_level_id = (SELECT id FROM project_access_levels WHERE key = 'MEMBER') WHERE project_id = _project_id;

    IF NOT (_project_manager_team_member_id IS NULL)
    THEN
        PERFORM update_project_manager(_project_manager_team_member_id, _project_id::UUID);
    END IF;

    RETURN JSON_BUILD_OBJECT(
            'id', _project_id,
            'name', (_body ->> 'name')::TEXT,
            'project_manager_id', _project_manager_team_member_id::UUID
        );
END;
$$;

-- Update create_quick_task function to auto-assign creator if enabled
CREATE OR REPLACE FUNCTION create_quick_task(_body json) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _task_id                  UUID;
    _parent_task              UUID;
    _status_id                UUID;
    _priority_id              UUID;
    _start_date               TIMESTAMP;
    _end_date                 TIMESTAMP;
    _auto_assign_task_creator BOOLEAN;
    _reporter_id              UUID;
    _project_id               UUID;
    _team_id                  UUID;
    _team_member_id           UUID;
    _is_admin                 BOOLEAN;
BEGIN
    _parent_task = (_body ->> 'parent_task_id')::UUID;
    _reporter_id = (_body ->> 'reporter_id')::UUID;
    _project_id = (_body ->> 'project_id')::UUID;
    
    _status_id = COALESCE(
        (_body ->> 'status_id')::UUID,
        (SELECT id
         FROM task_statuses
         WHERE project_id = _project_id
           AND category_id IN (SELECT id FROM sys_task_status_categories WHERE is_todo IS TRUE)
         LIMIT 1)
    );
    _priority_id = COALESCE((_body ->> 'priority_id')::UUID, (SELECT id FROM task_priorities WHERE value = 1));
    _start_date = (_body ->> 'start_date')::TIMESTAMP;
    _end_date = (_body ->> 'end_date')::TIMESTAMP;

    INSERT INTO tasks (name, priority_id, project_id, reporter_id, status_id, parent_task_id, sort_order, roadmap_sort_order, start_date, end_date)
    VALUES (TRIM((_body ->> 'name')::TEXT),
            _priority_id,
            _project_id,
            _reporter_id,
            _status_id, 
            _parent_task,
            COALESCE((SELECT MAX(COALESCE(sort_order, roadmap_sort_order, 0)) + 1 FROM tasks WHERE project_id = _project_id), 0),
            COALESCE((SELECT MAX(COALESCE(roadmap_sort_order, sort_order, 0)) + 1 FROM tasks WHERE project_id = _project_id), 0),
            _start_date,
            _end_date)
    RETURNING id INTO _task_id;

    PERFORM handle_on_task_phase_change(_task_id, (_body ->> 'phase_id')::UUID);

    -- Check if auto-assign is enabled for this project
    SELECT auto_assign_task_creator, team_id INTO _auto_assign_task_creator, _team_id
    FROM projects
    WHERE id = _project_id;

    -- If auto-assign is enabled, assign the task creator
    IF _auto_assign_task_creator IS TRUE THEN
        -- Get the team_member_id and check if their role is admin or owner
        SELECT tm.id, (r.admin_role OR r.owner) INTO _team_member_id, _is_admin
        FROM team_members tm
        INNER JOIN roles r ON tm.role_id = r.id
        WHERE tm.user_id = _reporter_id
          AND tm.team_id = _team_id;

        IF _team_member_id IS NOT NULL THEN
            -- Check if user is already a project member
            IF NOT EXISTS (
                SELECT 1 FROM project_members 
                WHERE project_id = _project_id 
                  AND team_member_id = _team_member_id
            ) THEN
                -- Only auto-add and assign if user is admin or owner
                -- create_task_assignee will automatically add them to project_members
                IF _is_admin IS TRUE THEN
                    PERFORM create_task_assignee(_team_member_id, _project_id, _task_id, _reporter_id);
                END IF;
            ELSE
                -- User is already a project member, assign them to the task
                PERFORM create_task_assignee(_team_member_id, _project_id, _task_id, _reporter_id);
            END IF;
        END IF;
    END IF;

    RETURN get_single_task(_task_id);
END;
$$;

-- Update create_task function to auto-assign creator if enabled
CREATE OR REPLACE FUNCTION create_task(_body json) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _assignee                 TEXT;
    _attachment_id            TEXT;
    _assignee_id              UUID;
    _task_id                  UUID;
    _label                    JSON;
    _auto_assign_task_creator BOOLEAN;
    _reporter_id              UUID;
    _project_id               UUID;
    _team_id                  UUID;
    _team_member_id           UUID;
    _is_admin                 BOOLEAN;
    _already_assigned         BOOLEAN := FALSE;
BEGIN
    _reporter_id = (_body ->> 'reporter_id')::UUID;
    _project_id = (_body ->> 'project_id')::UUID;
    _team_id = (_body ->> 'team_id')::UUID;

    INSERT INTO tasks (name, done, priority_id, project_id, reporter_id, start_date, end_date, total_minutes,
                       description, parent_task_id, status_id, sort_order)
    VALUES (TRIM((_body ->> 'name')::TEXT), (FALSE),
            COALESCE((_body ->> 'priority_id')::UUID, (SELECT id FROM task_priorities WHERE value = 1)),
            _project_id,
            _reporter_id,
            (_body ->> 'start')::TIMESTAMPTZ,
            (_body ->> 'end')::TIMESTAMPTZ,
            (_body ->> 'total_minutes')::NUMERIC,
            (_body ->> 'description')::TEXT,
            (_body ->> 'parent_task_id')::UUID,
            (_body ->> 'status_id')::UUID,
            COALESCE((SELECT MAX(sort_order) + 1 FROM tasks WHERE project_id = _project_id), 0))
    RETURNING id INTO _task_id;

    -- Insert task assignees from the request
    FOR _assignee IN SELECT * FROM JSON_ARRAY_ELEMENTS((_body ->> 'assignees')::JSON)
        LOOP
            _assignee_id = TRIM('"' FROM _assignee)::UUID;
            PERFORM create_task_assignee(_assignee_id, _project_id, _task_id, _reporter_id);
            
            -- Check if the reporter is already in the assignees list
            IF _assignee_id IN (
                SELECT id FROM team_members WHERE user_id = _reporter_id
            ) THEN
                _already_assigned := TRUE;
            END IF;
        END LOOP;

    FOR _attachment_id IN SELECT * FROM JSON_ARRAY_ELEMENTS((_body ->> 'attachments')::JSON)
        LOOP
            UPDATE task_attachments SET task_id = _task_id WHERE id = TRIM('"' FROM _attachment_id)::UUID;
        END LOOP;

    FOR _label IN SELECT * FROM JSON_ARRAY_ELEMENTS((_body ->> 'labels')::JSON)
        LOOP
            PERFORM assign_or_create_label(_team_id, _task_id, (_label ->> 'name')::TEXT,
                                           (_label ->> 'color')::TEXT);
        END LOOP;

    -- Check if auto-assign is enabled for this project and creator is not already assigned
    IF _already_assigned IS FALSE THEN
        SELECT auto_assign_task_creator INTO _auto_assign_task_creator
        FROM projects
        WHERE id = _project_id;

        -- If auto-assign is enabled, assign the task creator
        IF _auto_assign_task_creator IS TRUE THEN
            -- Get the team_member_id and check if their role is admin or owner
            SELECT tm.id, (r.admin_role OR r.owner) INTO _team_member_id, _is_admin
            FROM team_members tm
            INNER JOIN roles r ON tm.role_id = r.id
            WHERE tm.user_id = _reporter_id
              AND tm.team_id = _team_id;

            IF _team_member_id IS NOT NULL THEN
                -- Check if user is already a project member
                IF NOT EXISTS (
                    SELECT 1 FROM project_members 
                    WHERE project_id = _project_id 
                      AND team_member_id = _team_member_id
                ) THEN
                    -- Only auto-add and assign if user is admin or owner
                    -- create_task_assignee will automatically add them to project_members
                    IF _is_admin IS TRUE THEN
                        PERFORM create_task_assignee(_team_member_id, _project_id, _task_id, _reporter_id);
                    END IF;
                ELSE
                    -- User is already a project member, assign them to the task
                    PERFORM create_task_assignee(_team_member_id, _project_id, _task_id, _reporter_id);
                END IF;
            END IF;
        END IF;
    END IF;

    RETURN get_task_form_view_model(_reporter_id, _team_id, _task_id, _project_id);
END;
$$;
