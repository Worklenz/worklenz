CREATE OR REPLACE FUNCTION accept_invitation(_email text, _team_member_id uuid, _user_id uuid) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
BEGIN
    IF _team_member_id IS NOT NULL
    THEN
        UPDATE team_members SET user_id = _user_id WHERE id = _team_member_id;
        DELETE FROM email_invitations WHERE email = _email AND team_member_id = _team_member_id;
    END IF;

    RETURN JSON_BUILD_OBJECT(
        'email', _email,
        'id', (SELECT id FROM teams WHERE id = (SELECT team_id FROM team_members WHERE id = _team_member_id))
        );
END;
$$;

CREATE OR REPLACE FUNCTION activate_team(_team_id uuid, _user_id uuid) RETURNS void
    LANGUAGE plpgsql
AS
$$
DECLARE
BEGIN
    UPDATE users
    SET active_team =_team_id
    WHERE id = _user_id
      AND EXISTS(SELECT id FROM team_members WHERE team_id = _team_id AND user_id = _user_id);

    DELETE
    FROM email_invitations
    WHERE team_id = _team_id
      AND team_member_id =
          (SELECT id FROM team_members WHERE user_id = _user_id AND team_members.team_id = _team_id);
END
$$;

CREATE OR REPLACE FUNCTION add_or_remove_pt_task_label(_task_id uuid, _label_id uuid) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _result JSON;
BEGIN
    IF EXISTS(SELECT task_id FROM cpt_task_labels WHERE task_id = _task_id AND label_id = _label_id)
    THEN
        DELETE FROM cpt_task_labels WHERE task_id = _task_id AND label_id = _label_id;
    ELSE
        INSERT INTO cpt_task_labels (task_id, label_id) VALUES (_task_id, _label_id);
    END IF;

    SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
    INTO _result
    FROM (SELECT cpt_task_labels.label_id AS id,
                 (SELECT name FROM team_labels WHERE id = cpt_task_labels.label_id) AS name,
                 (SELECT color_code FROM team_labels WHERE id = cpt_task_labels.label_id)
          FROM cpt_task_labels
          WHERE task_id = _task_id
          ORDER BY name) rec;

    RETURN _result;
END
$$;

CREATE OR REPLACE FUNCTION add_or_remove_task_label(_task_id uuid, _label_id uuid) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _result JSON;
BEGIN
    IF EXISTS(SELECT task_id FROM task_labels WHERE task_id = _task_id AND label_id = _label_id)
    THEN
        DELETE FROM task_labels WHERE task_id = _task_id AND label_id = _label_id;
    ELSE
        INSERT INTO task_labels (task_id, label_id) VALUES (_task_id, _label_id);
    END IF;

    SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
    INTO _result
    FROM (SELECT task_labels.label_id AS id,
                 (SELECT name FROM team_labels WHERE id = task_labels.label_id) AS name,
                 (SELECT color_code FROM team_labels WHERE id = task_labels.label_id)
          FROM task_labels
          WHERE task_id = _task_id
          ORDER BY name) rec;

    RETURN _result;
END
$$;

CREATE OR REPLACE FUNCTION assign_or_create_label(_team_id uuid, _task_id uuid, _name text, _color_code text) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _label_id UUID;
    _is_new   BOOLEAN;
BEGIN
    SELECT id FROM team_labels WHERE team_id = _team_id AND LOWER(name) = TRIM(LOWER(_name)) INTO _label_id;

    IF (is_null_or_empty(_label_id) IS TRUE)
    THEN
        INSERT INTO team_labels (name, team_id, color_code)
        VALUES (TRIM(_name), _team_id, _color_code)
        RETURNING id INTO _label_id;
        _is_new = TRUE;
    END IF;

    INSERT INTO task_labels (task_id, label_id) VALUES (_task_id, _label_id);

    RETURN JSON_BUILD_OBJECT('id', _label_id, 'is_new', _is_new);
END;
$$;

CREATE OR REPLACE FUNCTION assign_or_create_pt_label(_team_id uuid, _task_id uuid, _name text, _color_code text) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _label_id UUID;
    _is_new   BOOLEAN;
BEGIN
    SELECT id FROM team_labels WHERE team_id = _team_id AND LOWER(name) = TRIM(LOWER(_name)) INTO _label_id;

    IF (is_null_or_empty(_label_id) IS TRUE)
    THEN
        INSERT INTO team_labels (name, team_id, color_code)
        VALUES (TRIM(_name), _team_id, _color_code)
        RETURNING id INTO _label_id;
        _is_new = TRUE;
    END IF;

    INSERT INTO cpt_task_labels (task_id, label_id) VALUES (_task_id, _label_id);

    RETURN JSON_BUILD_OBJECT('id', _label_id, 'is_new', _is_new);
END;
$$;

CREATE OR REPLACE FUNCTION bulk_archive_tasks(_body json) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _task   JSON;
    _output JSON;
BEGIN
    FOR _task IN SELECT * FROM JSON_ARRAY_ELEMENTS((_body ->> 'tasks')::JSON)
        LOOP
            -- Archive the parent task
            UPDATE tasks
            SET archived = ((_body ->> 'type')::TEXT = 'archive')
            WHERE id = (_task ->> 'id')::UUID
              AND parent_task_id IS NULL;
            -- Prevent archiving subtasks

            -- Archive its sub-tasks
            UPDATE tasks
            SET archived = ((_body ->> 'type')::TEXT = 'archive')
            WHERE parent_task_id = (_task ->> 'id')::UUID;
        END LOOP;

    RETURN _output;
END;
$$;

CREATE OR REPLACE FUNCTION bulk_assign_label(_body json) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _task   JSON;
    _label  JSON;
    _output JSON;
BEGIN
    FOR _task IN SELECT * FROM JSON_ARRAY_ELEMENTS((_body ->> 'tasks')::JSON)
        LOOP
            FOR _label IN SELECT * FROM JSON_ARRAY_ELEMENTS((_body ->> 'labels')::JSON)
                LOOP
                    DELETE
                    FROM task_labels
                    WHERE task_id = (_task ->> 'id')::UUID
                      AND label_id = (_label ->> 'id')::UUID;
                    INSERT INTO task_labels (task_id, label_id)
                    VALUES ((_task ->> 'id')::UUID, (_label ->> 'id')::UUID);
                END LOOP;
        END LOOP;

    RETURN _output;
END;
$$;

CREATE OR REPLACE FUNCTION bulk_assign_or_create_label(_body json) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _task   JSON;
    _output JSON;
BEGIN
    FOR _task IN SELECT * FROM JSON_ARRAY_ELEMENTS((_body ->> 'tasks')::JSON)
        LOOP
            PERFORM assign_or_create_label((_body ->> 'team_id')::UUID, (_task ->> 'id')::UUID,
                                           (_body ->> 'text')::TEXT, (_body ->> 'color')::TEXT);
        END LOOP;
    RETURN _output;
END;
$$;

CREATE OR REPLACE FUNCTION bulk_assign_to_me(_body json) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _task              JSON;
    _output            JSON;
    _project_member    JSON;
    _team_member_id    UUID;
    _project_member_id UUID;
BEGIN
    SELECT id
    FROM team_members
    WHERE team_id = (_body ->> 'team_id')::UUID
      AND user_id = (_body ->> 'user_id')::UUID
    INTO _team_member_id;

    FOR _task IN SELECT * FROM JSON_ARRAY_ELEMENTS((_body ->> 'tasks')::JSON)
        LOOP

            SELECT id
            FROM project_members
            WHERE project_id = (_body ->> 'project_id')::UUID
              AND project_members.team_member_id = _team_member_id
            INTO _project_member_id;

            IF is_null_or_empty(_project_member_id)
            THEN
                SELECT create_project_member(JSON_BUILD_OBJECT(
                    'team_member_id', _team_member_id,
                    'team_id', (_body ->> 'team_id')::UUID,
                    'project_id', (_body ->> 'project_id')::UUID,
                    'user_id', (_body ->> 'user_id')::UUID,
                    'access_level', 'MEMBER'::TEXT
                    ))
                INTO _project_member;
                _project_member_id = (_project_member ->> 'id')::UUID;
            END IF;

            IF NOT EXISTS(SELECT task_id
                          FROM tasks_assignees
                          WHERE task_id = (_task ->> 'id')::UUID
                            AND project_member_id = _project_member_id
                            AND team_member_id = _team_member_id)
            THEN
                INSERT INTO tasks_assignees (task_id, project_member_id, team_member_id, assigned_by)
                VALUES ((_task ->> 'id')::UUID, _project_member_id, _team_member_id, (_body ->> 'user_id')::UUID);
            END IF;
        END LOOP;

    RETURN _output;
END;
$$;

CREATE OR REPLACE FUNCTION bulk_change_tasks_status(_body json) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _task   JSON;
    _output JSON;
BEGIN
    FOR _task IN SELECT * FROM JSON_ARRAY_ELEMENTS((_body ->> 'tasks')::JSON)
        LOOP
            UPDATE tasks SET status_id = (_body ->> 'status_id')::UUID WHERE id = (_task ->> 'id')::UUID;
        END LOOP;

    RETURN _output;
END;
$$;

CREATE OR REPLACE FUNCTION bulk_delete_pt_tasks(_body json) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _task   JSON;
    _output JSON;
BEGIN
    FOR _task IN SELECT * FROM JSON_ARRAY_ELEMENTS((_body ->> 'tasks')::JSON)
        LOOP
            DELETE FROM cpt_tasks WHERE id = (_task ->> 'id')::UUID;
        END LOOP;

    RETURN _output;
END;
$$;

CREATE OR REPLACE FUNCTION bulk_delete_tasks(_body json) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _task   JSON;
    _output JSON;
BEGIN
    FOR _task IN SELECT * FROM JSON_ARRAY_ELEMENTS((_body ->> 'tasks')::JSON)
        LOOP
            DELETE FROM tasks WHERE id = (_task ->> 'id')::UUID;
        END LOOP;

    RETURN _output;
END;
$$;

CREATE OR REPLACE FUNCTION complete_account_setup(_user_id uuid, _team_id uuid, _body json) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _project_id        UUID;
    _default_status_id UUID;
    _task_id           UUID;
    _task              TEXT;
    _members           JSON;
    _sort_order        INT;
    _team_member_id    UUID;
    _project_member_id UUID;
BEGIN

    -- Update team name
    UPDATE teams SET name = TRIM((_body ->> 'team_name')::TEXT) WHERE id = _team_id AND user_id = _user_id;

    -- Create the project
    INSERT INTO projects (name, team_id, owner_id, color_code, status_id, key)
    VALUES ((_body ->> 'project_name')::TEXT, _team_id, _user_id, '#3b7ad4',
            (SELECT id FROM sys_project_statuses WHERE is_default IS TRUE), (_body ->> 'key')::TEXT)
    RETURNING id INTO _project_id;

    -- Insert task's statuses
    INSERT INTO task_statuses (name, project_id, team_id, category_id)
    VALUES ('To do', _project_id, _team_id, (SELECT id FROM sys_task_status_categories WHERE is_todo IS TRUE))
    RETURNING id INTO _default_status_id;

    INSERT INTO task_statuses (name, project_id, team_id, category_id)
    VALUES ('Doing', _project_id, _team_id, (SELECT id FROM sys_task_status_categories WHERE is_doing IS TRUE));

    INSERT INTO task_statuses (name, project_id, team_id, category_id)
    VALUES ('Done', _project_id, _team_id, (SELECT id FROM sys_task_status_categories WHERE is_done IS TRUE));

    SELECT id FROM team_members WHERE user_id = _user_id AND team_id = _team_id INTO _team_member_id;

    INSERT INTO project_members (team_member_id, project_access_level_id, project_id, role_id)
    VALUES (_team_member_id, (SELECT id FROM project_access_levels WHERE key = 'PROJECT_MANAGER'),
            _project_id,
            (SELECT id FROM roles WHERE team_id = _team_id AND default_role IS TRUE))
    RETURNING id INTO _project_member_id;

    -- Insert tasks
    _sort_order = 1;
    FOR _task IN SELECT * FROM JSON_ARRAY_ELEMENTS((_body ->> 'tasks')::JSON)
        LOOP
            INSERT INTO tasks (name, priority_id, project_id, reporter_id, status_id, sort_order)
            VALUES (TRIM('"' FROM _task)::TEXT, (SELECT id FROM task_priorities WHERE value = 1), _project_id, _user_id,
                    _default_status_id, _sort_order)
            RETURNING id INTO _task_id;
            _sort_order = _sort_order + 1;

            INSERT INTO tasks_assignees (task_id, project_member_id, team_member_id, assigned_by)
            VALUES (_task_id, _project_member_id, _team_member_id, _user_id);
        END LOOP;

    -- Insert team members if available
    IF is_null_or_empty((_body ->> 'team_members')) IS FALSE
    THEN
        SELECT create_team_member(JSON_BUILD_OBJECT('team_id', _team_id, 'emails', (_body ->> 'team_members')))
        INTO _members;
    END IF;

    -- insert default columns for task list
    PERFORM insert_task_list_columns(_project_id);

    UPDATE users SET setup_completed = TRUE WHERE id = _user_id;

    -- Update organization name
    UPDATE organizations SET organization_name = TRIM((_body ->> 'team_name')::TEXT) WHERE user_id = _user_id;

    --insert user data
    INSERT INTO users_data (user_id, organization_name, contact_number, contact_number_secondary, trial_in_progress,
                            trial_expire_date, subscription_status)
    VALUES (_user_id, TRIM((_body ->> 'team_name')::TEXT), NULL, NULL, TRUE, CURRENT_DATE + INTERVAL '14 days',
            'trialing')
    ON CONFLICT (user_id) DO UPDATE SET organization_name = TRIM((_body ->> 'team_name')::TEXT);

    RETURN JSON_BUILD_OBJECT('id', _project_id, 'members', _members);
END;
$$;

CREATE OR REPLACE FUNCTION create_bulk_task_assignees(_team_member_id uuid, _project_id uuid, _task_id uuid, _reporter_user_id uuid) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _project_member    JSON;
    _project_member_id UUID;
    _team_id           UUID;
    _user_id           UUID;
BEGIN
    SELECT id
    FROM project_members
    WHERE team_member_id = _team_member_id
      AND project_id = _project_id
    INTO _project_member_id;

    SELECT team_id FROM team_members WHERE id = _team_member_id INTO _team_id;
    SELECT user_id FROM team_members WHERE id = _team_member_id INTO _user_id;

    IF is_null_or_empty(_project_member_id)
    THEN
        SELECT create_project_member(JSON_BUILD_OBJECT(
            'team_member_id', _team_member_id,
            'team_id', _team_id,
            'project_id', _project_id,
            'user_id', _reporter_user_id,
            'access_level', 'MEMBER'::TEXT
            ))
        INTO _project_member;
        _project_member_id = (_project_member ->> 'id')::UUID;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM tasks_assignees WHERE task_id = _task_id AND project_member_id = _project_member_id)
    THEN
        INSERT INTO tasks_assignees (task_id, project_member_id, team_member_id, assigned_by)
        VALUES (_task_id, _project_member_id, _team_member_id, _reporter_user_id);

        INSERT INTO task_activity_logs (task_id, team_id, attribute_type, user_id, log_type, old_value, new_value, project_id)
        VALUES (
                _task_id,
                (SELECT team_id FROM projects WHERE id = (SELECT project_id FROM tasks WHERE id = _task_id)),
                'assignee',
                _reporter_user_id,
                'assign',
                NULL,
                _user_id,
                (SELECT project_id FROM tasks WHERE id = _task_id)
                );

    END IF;

    RETURN JSON_BUILD_OBJECT(
        'task_id', _task_id,
        'project_member_id', _project_member_id,
        'team_member_id', _team_member_id,
        'team_id', _team_id,
        'user_id', _user_id
        );
END
$$;

CREATE OR REPLACE FUNCTION create_home_task(_body json) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _task_id UUID;
BEGIN

    INSERT INTO tasks (name, end_date, priority_id, project_id, reporter_id, status_id, sort_order)
    VALUES (TRIM((_body ->> 'name')::TEXT),
            (_body ->> 'end_date')::TIMESTAMP,
            (SELECT id FROM task_priorities WHERE value = 1),
            (_body ->> 'project_id')::UUID,
            (_body ->> 'reporter_id')::UUID,

               -- This should be came from client side later
            (SELECT id
             FROM task_statuses
             WHERE project_id = (_body ->> 'project_id')::UUID
               AND category_id IN (SELECT id FROM sys_task_status_categories WHERE is_todo IS TRUE)
             LIMIT 1),
            COALESCE((SELECT MAX(sort_order) + 1 FROM tasks WHERE project_id = (_body ->> 'project_id')::UUID), 0))
    RETURNING id INTO _task_id;

    -- RETURN(SELECT id FROM team_members WHERE user_id=(_body ->> 'reporter_id')::UUID AND team_id=(_body ->> 'team_id')::UUID);

    RETURN home_task_form_view_model((_body ->> 'reporter_id')::UUID, (_body ->> 'team_id')::UUID, _task_id,
                                     (_body ->> 'project_id')::UUID);
END;
$$;

CREATE OR REPLACE FUNCTION create_new_team(_name text, _user_id uuid) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _owner_id          UUID;
    _team_id           UUID;
    _organization_id           UUID;
    _admin_role_id     UUID;
    _owner_role_id     UUID;
    _trimmed_name      TEXT;
    _trimmed_team_name TEXT;
BEGIN

    _trimmed_team_name = TRIM(_name);
    -- get owner id
    SELECT user_id INTO _owner_id FROM teams WHERE id = (SELECT active_team FROM users WHERE id = _user_id);
    SELECT id INTO _organization_id FROM organizations WHERE user_id = _user_id;

    -- insert team
    INSERT INTO teams (name, user_id, organization_id)
    VALUES (_trimmed_team_name, _owner_id, _organization_id)
    RETURNING id INTO _team_id;

    -- insert default roles
    INSERT INTO roles (name, team_id, default_role) VALUES ('Member', _team_id, TRUE);
    INSERT INTO roles (name, team_id, admin_role) VALUES ('Admin', _team_id, TRUE) RETURNING id INTO _admin_role_id;
    INSERT INTO roles (name, team_id, admin_role) VALUES ('Team Lead', _team_id, TRUE);
    INSERT INTO roles (name, team_id, owner) VALUES ('Owner', _team_id, TRUE) RETURNING id INTO _owner_role_id;

    -- insert team member
    INSERT INTO team_members (user_id, team_id, role_id)
    VALUES (_owner_id, _team_id, _owner_role_id);

    IF (_user_id <> _owner_id)
    THEN
        INSERT INTO team_members (user_id, team_id, role_id)
        VALUES (_user_id, _team_id, _admin_role_id);
    END IF;

    RETURN JSON_BUILD_OBJECT(
            'id', _user_id,
            'name', _trimmed_name,
            'team_id', _team_id
        );
END;
$$;

CREATE OR REPLACE FUNCTION create_new_team(_name text, _user_id uuid, _current_team_id uuid) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _owner_id          UUID;
    _team_id           UUID;
    _role_id           UUID;
    _trimmed_team_name TEXT;
BEGIN

    _trimmed_team_name = TRIM(_name);

    -- get owner id
    SELECT user_id INTO _owner_id FROM teams WHERE id = (SELECT active_team FROM users WHERE id = _user_id);

    -- insert team
    INSERT INTO teams (name, user_id, organization_id)
    VALUES (_trimmed_team_name, _owner_id, (SELECT id FROM organizations WHERE user_id = _owner_id)::UUID)
    RETURNING id INTO _team_id;

    -- insert default roles
    INSERT INTO roles (name, team_id, default_role) VALUES ('Member', _team_id, TRUE);
    INSERT INTO roles (name, team_id, admin_role) VALUES ('Admin', _team_id, TRUE);
    INSERT INTO roles (name, team_id, admin_role) VALUES ('Team Lead', _team_id, TRUE);
    INSERT INTO roles (name, team_id, owner) VALUES ('Owner', _team_id, TRUE) RETURNING id INTO _role_id;

    -- insert team member
    INSERT INTO team_members (user_id, team_id, role_id)
    VALUES (_user_id, _team_id, _role_id);

    RETURN JSON_BUILD_OBJECT(
            'id', _user_id,
            'name', _trimmed_team_name,
            'team_id', _team_id
        );
END;
$$;

CREATE OR REPLACE FUNCTION create_notification(_user_id uuid, _team_id uuid, _task_id uuid, _project_id uuid, _message text) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
BEGIN
    IF (_user_id IS NOT NULL AND _team_id IS NOT NULL AND is_null_or_empty(_message) IS FALSE)
    THEN
        INSERT INTO user_notifications (message, user_id, team_id, task_id, project_id)
        VALUES (TRIM(_message), _user_id, _team_id, _task_id, _project_id);
    END IF;

    RETURN JSON_BUILD_OBJECT(
        'project', (SELECT name FROM projects WHERE id = _project_id),
        'project_color', (SELECT color_code FROM projects WHERE id = _project_id),
        'team', (SELECT name FROM teams WHERE id = _team_id)
        );
END
$$;

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

    -- log record
    INSERT INTO project_logs (team_id, project_id, description)
    VALUES (_team_id, _project_id,
            REPLACE((_body ->> 'project_created_log')::TEXT, '@user',
                    (SELECT name FROM users WHERE id = _user_id)));

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
            'name', (_body ->> 'name')::TEXT
           );
END;
$$;

CREATE OR REPLACE FUNCTION create_project_comment(_body json) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _project_id    UUID;
    _created_by    UUID;
    _comment_id    UUID;
    _team_id       UUID;
    _user_name     TEXT;
    _project_name  TEXT;
    _content       TEXT;
    _mention_index INT := 0;
    _mention       JSON;
BEGIN
    _project_id = (_body ->> 'project_id');
    _created_by = (_body ->> 'created_by');
    _content = (_body ->> 'content');
    _team_id = (_body ->> 'team_id');

    SELECT name FROM users WHERE id = _created_by LIMIT 1 INTO _user_name;
    SELECT name FROM projects WHERE id = _project_id INTO _project_name;

    INSERT INTO project_comments (content, created_by, project_id)
    VALUES (_content, _created_by, _project_id)
    RETURNING id INTO _comment_id;

    FOR _mention IN SELECT * FROM JSON_ARRAY_ELEMENTS((_body ->> 'mentions')::JSON)
        LOOP

            INSERT INTO project_comment_mentions (comment_id, mentioned_index, mentioned_by, informed_by)
            VALUES (_comment_id, _mention_index, _created_by, (_mention ->> 'id')::UUID);

            PERFORM create_notification(
                    (SELECT id FROM users WHERE id = (_mention ->> 'id')::UUID),
                    (_team_id)::UUID,
                    null,
                    (_project_id)::UUID,
                    CONCAT('<b>', _user_name, '</b> has mentioned you in a comment on <b>', _project_name, '</b>')
                );
            _mention_index := _mention_index + 1;

        END LOOP;

    RETURN JSON_BUILD_OBJECT(
            'id', (_comment_id)::UUID,
            'content', (_content)::TEXT,
            'project_name', (_project_name)::TEXT,
            'team_name', (SELECT name FROM teams WHERE id = (_team_id)::UUID)
        );
END
$$;

CREATE OR REPLACE FUNCTION create_project_member(_body json) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _id             UUID;
    _team_member_id UUID;
    _team_id        UUID;
    _project_id     UUID;
    _user_id        UUID;
    _member_user_id UUID;
    _notification   TEXT;
    _access_level   TEXT;
BEGIN
    _team_member_id = (_body ->> 'team_member_id')::UUID;
    _team_id = (_body ->> 'team_id')::UUID;
    _project_id = (_body ->> 'project_id')::UUID;
    _user_id = (_body ->> 'user_id')::UUID;
    _access_level = (_body ->> 'access_level')::TEXT;

    SELECT user_id FROM team_members WHERE id = _team_member_id INTO _member_user_id;

    INSERT INTO project_members (team_member_id, project_access_level_id, project_id, role_id)
    VALUES (_team_member_id, (SELECT id FROM project_access_levels WHERE key = _access_level)::UUID,
            _project_id,
            (SELECT id FROM roles WHERE team_id = _team_id AND default_role IS TRUE))
    RETURNING id INTO _id;

    IF (_member_user_id != _user_id)
    THEN
        _notification = CONCAT('You have been added to the <b>',
                               (SELECT name FROM projects WHERE id = _project_id),
                               '</b> by <b>',
                               (SELECT name FROM users WHERE id = _user_id), '</b>');
        PERFORM create_notification(
                (SELECT user_id FROM team_members WHERE id = _team_member_id),
                _team_id,
                NULL,
                _project_id,
                _notification
            );
    END IF;

    RETURN JSON_BUILD_OBJECT(
            'id', _id,
            'notification', _notification,
            'socket_id', (SELECT socket_id FROM users WHERE id = _member_user_id),
            'project', (SELECT name FROM projects WHERE id = _project_id),
            'project_id', _project_id,
            'project_color', (SELECT color_code FROM projects WHERE id = _project_id),
            'team', (SELECT name FROM teams WHERE id = _team_id),
            'member_user_id', _member_user_id
        );
END
$$;

CREATE OR REPLACE FUNCTION create_project_template(_body json) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _template_id UUID;
BEGIN
    -- check whether the project name is already in
    IF EXISTS(SELECT name
              FROM custom_project_templates
              WHERE LOWER(name) = LOWER((_body ->> 'name')::TEXT)
                AND team_id = (_body ->> 'team_id')::uuid)
    THEN
        RAISE 'TEMPLATE_EXISTS_ERROR:%', (_body ->> 'name')::TEXT;
    END IF;

    -- insert client if not exists
    INSERT INTO custom_project_templates(name, phase_label, color_code, notes, team_id)
    VALUES ((_body ->> 'name')::TEXT, (_body ->> 'phase_label')::TEXT, (_body ->> 'color_code')::TEXT,
            (_body ->> 'notes')::TEXT,
            (_body ->> 'team_id')::uuid)
    RETURNING id INTO _template_id;

    RETURN JSON_BUILD_OBJECT('id', _template_id);
END;
$$;

CREATE OR REPLACE FUNCTION create_pt_task_status(_body json, _team_id uuid) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _status_id    UUID;
    _group_status JSON;
BEGIN
    INSERT INTO cpt_task_statuses (name, template_id, team_id, category_id, sort_order)
    VALUES (TRIM((_body ->> 'name')::TEXT),
            (_body ->> 'template_id')::UUID,
            _team_id,
            (_body ->> 'category_id')::UUID,
            COALESCE((SELECT MAX(sort_order) + 1
                      FROM cpt_task_statuses
                      WHERE template_id = (_body ->> 'template_id') ::UUID),
                         0)) RETURNING id INTO _status_id;
    SELECT ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec)))
    FROM (SELECT id,
                 name,
                 template_id,
                 team_id,
                 category_id,
                 sort_order,
                 (SELECT color_code
                  FROM sys_task_status_categories
                  WHERE id =
                        (SELECT category_id FROM cpt_task_statuses WHERE id = _status_id)) AS color_code
          FROM cpt_task_statuses
          WHERE id = _status_id) rec INTO _group_status;
    RETURN _group_status;
END;
$$;

CREATE OR REPLACE FUNCTION create_quick_pt_task(_body json) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _task_id     UUID;
    _parent_task UUID;
    _status_id   UUID;
    _priority_id UUID;
BEGIN

    _parent_task = (_body ->> 'parent_task_id')::UUID;
    _status_id = COALESCE(
            (_body ->> 'status_id')::UUID,
            (SELECT id
             FROM cpt_task_statuses
             WHERE template_id = (_body ->> 'template_id')::UUID
               AND category_id IN (SELECT id FROM sys_task_status_categories WHERE is_todo IS TRUE)
             LIMIT 1)
        );
    _priority_id = COALESCE((_body ->> 'priority_id')::UUID, (SELECT id FROM task_priorities WHERE value = 1));

    INSERT INTO cpt_tasks(name, priority_id, template_id, status_id, parent_task_id, sort_order, task_no)
    VALUES (TRIM((_body ->> 'name')::TEXT),
            _priority_id,
            (_body ->> 'template_id')::UUID,

               -- This should be came from client side later
            _status_id, _parent_task,
            COALESCE((SELECT MAX(sort_order) + 1 FROM cpt_tasks WHERE template_id = (_body ->> 'template_id')::UUID),
                     0), ((SELECT COUNT(*) FROM cpt_tasks WHERE template_id = (_body ->> 'template_id')::UUID) + 1))
    RETURNING id INTO _task_id;

    PERFORM handle_on_pt_task_phase_change(_task_id, (_body ->> 'phase_id')::UUID);

    RETURN get_single_pt_task(_task_id);
END;
$$;

CREATE OR REPLACE FUNCTION create_quick_task(_body json) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _task_id     UUID;
    _parent_task UUID;
    _status_id   UUID;
    _priority_id UUID;
    _start_date  TIMESTAMP;
    _end_date    TIMESTAMP;
BEGIN

    _parent_task = (_body ->> 'parent_task_id')::UUID;
    _status_id = COALESCE(
        (_body ->> 'status_id')::UUID,
        (SELECT id
         FROM task_statuses
         WHERE project_id = (_body ->> 'project_id')::UUID
           AND category_id IN (SELECT id FROM sys_task_status_categories WHERE is_todo IS TRUE)
         LIMIT 1)
        );
    _priority_id = COALESCE((_body ->> 'priority_id')::UUID, (SELECT id FROM task_priorities WHERE value = 1));
    _start_date = (_body ->> 'start_date')::TIMESTAMP;
    _end_date = (_body ->> 'end_date')::TIMESTAMP;

    INSERT INTO tasks (name, priority_id, project_id, reporter_id, status_id, parent_task_id, sort_order, start_date, end_date)
    VALUES (TRIM((_body ->> 'name')::TEXT),
            _priority_id,
            (_body ->> 'project_id')::UUID,
            (_body ->> 'reporter_id')::UUID,

               -- This should be came from client side later
            _status_id, _parent_task,
            COALESCE((SELECT MAX(sort_order) + 1 FROM tasks WHERE project_id = (_body ->> 'project_id')::UUID), 0),
            (_body ->> 'start_date')::TIMESTAMP,
            (_body ->> 'end_date')::TIMESTAMP)
    RETURNING id INTO _task_id;

    PERFORM handle_on_task_phase_change(_task_id, (_body ->> 'phase_id')::UUID);

    RETURN get_single_task(_task_id);
END;
$$;

CREATE OR REPLACE FUNCTION create_task(_body json) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _assignee      TEXT;
    _attachment_id TEXT;
    _assignee_id   UUID;
    _task_id       UUID;
    _label         JSON;
BEGIN
    INSERT INTO tasks (name, done, priority_id, project_id, reporter_id, start_date, end_date, total_minutes,
                       description, parent_task_id, status_id, sort_order)
    VALUES (TRIM((_body ->> 'name')::TEXT), (FALSE),
            COALESCE((_body ->> 'priority_id')::UUID, (SELECT id FROM task_priorities WHERE value = 1)),
            (_body ->> 'project_id')::UUID,
            (_body ->> 'reporter_id')::UUID,
            (_body ->> 'start')::TIMESTAMPTZ,
            (_body ->> 'end')::TIMESTAMPTZ,
            (_body ->> 'total_minutes')::NUMERIC,
            (_body ->> 'description')::TEXT,
            (_body ->> 'parent_task_id')::UUID,
            (_body ->> 'status_id')::UUID,
            COALESCE((SELECT MAX(sort_order) + 1 FROM tasks WHERE project_id = (_body ->> 'project_id')::UUID), 0))
    RETURNING id INTO _task_id;

    -- insert task assignees
    FOR _assignee IN SELECT * FROM JSON_ARRAY_ELEMENTS((_body ->> 'assignees')::JSON)
        LOOP
            _assignee_id = TRIM('"' FROM _assignee)::UUID;
            PERFORM create_task_assignee(_assignee_id, (_body ->> 'project_id')::UUID, _task_id,
                                         (_body ->> 'reporter_id')::UUID);
        END LOOP;

    FOR _attachment_id IN SELECT * FROM JSON_ARRAY_ELEMENTS((_body ->> 'attachments')::JSON)
        LOOP
            UPDATE task_attachments SET task_id = _task_id WHERE id = TRIM('"' FROM _attachment_id)::UUID;
        END LOOP;

    FOR _label IN SELECT * FROM JSON_ARRAY_ELEMENTS((_body ->> 'labels')::JSON)
        LOOP
            PERFORM assign_or_create_label((_body ->> 'team_id')::UUID, _task_id, (_label ->> 'name')::TEXT,
                                           (_label ->> 'color')::TEXT);
        END LOOP;

    RETURN get_task_form_view_model((_body ->> 'reporter_id')::UUID, (_body ->> 'team_id')::UUID, _task_id,
                                    (_body ->> 'project_id')::UUID);
END;
$$;

CREATE OR REPLACE FUNCTION create_task_assignee(_team_member_id uuid, _project_id uuid, _task_id uuid, _reporter_user_id uuid) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _project_member    JSON;
    _project_member_id UUID;
    _team_id           UUID;
    _user_id           UUID;
BEGIN
    SELECT id
    FROM project_members
    WHERE team_member_id = _team_member_id
      AND project_id = _project_id
    INTO _project_member_id;

    SELECT team_id FROM team_members WHERE id = _team_member_id INTO _team_id;
    SELECT user_id FROM team_members WHERE id = _team_member_id INTO _user_id;

    IF is_null_or_empty(_project_member_id)
    THEN
        SELECT create_project_member(JSON_BUILD_OBJECT(
            'team_member_id', _team_member_id,
            'team_id', _team_id,
            'project_id', _project_id,
            'user_id', _reporter_user_id,
            'access_level', 'MEMBER'::TEXT
            ))
        INTO _project_member;
        _project_member_id = (_project_member ->> 'id')::UUID;
    END IF;

    INSERT INTO tasks_assignees (task_id, project_member_id, team_member_id, assigned_by)
    VALUES (_task_id, _project_member_id, _team_member_id, _reporter_user_id);

    RETURN JSON_BUILD_OBJECT(
        'task_id', _task_id,
        'project_member_id', _project_member_id,
        'team_member_id', _team_member_id,
        'team_id', _team_id,
        'user_id', _user_id
        );
END
$$;

CREATE OR REPLACE FUNCTION create_task_comment(_body json) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _task_id             UUID;
    _user_id             UUID;
    _comment_id          UUID;
    _team_member_id      UUID;
    _mentioned_member_id TEXT;
    _user_name           TEXT;
    _task_name           TEXT;
    _mention_index INT := 0;
    _mention       JSON;
BEGIN

    _task_id = (_body ->> 'task_id')::UUID;
    _user_id = (_body ->> 'user_id')::UUID;

    SELECT name FROM users WHERE id = _user_id LIMIT 1 INTO _user_name;
    SELECT name FROM tasks WHERE id = _task_id INTO _task_name;

    SELECT id
    FROM team_members
    WHERE user_id = _user_id
      AND team_id = (_body ->> 'team_id')::UUID
    INTO _team_member_id;

    INSERT INTO task_comments (user_id, team_member_id, task_id)
    VALUES (_user_id, _team_member_id, _task_id)
    RETURNING id INTO _comment_id;

    INSERT INTO task_comment_contents (index, comment_id, text_content)
    VALUES (0, _comment_id, (_body ->> 'content')::TEXT);

    -- notify mentions
    FOR _mention IN SELECT * FROM JSON_ARRAY_ELEMENTS((_body ->> 'mentions')::JSON)
        LOOP
            INSERT INTO task_comment_mentions (comment_id, mentioned_index, mentioned_by, informed_by)
                VALUES (_comment_id, _mention_index, _user_id, (_mention ->> 'team_member_id')::UUID);
            PERFORM create_notification(
                (SELECT user_id FROM team_members WHERE id = TRIM(BOTH '"' FROM (_mention ->> 'team_member_id'))::UUID),
                (_body ->> 'team_id')::UUID,
                _task_id,
                (SELECT project_id FROM tasks WHERE id = _task_id),
                CONCAT('<b>', _user_name, '</b> has mentioned you in a comment on <b>', _task_name, '</b>')
                );
            _mention_index := _mention_index + 1;
        END LOOP;

    RETURN JSON_BUILD_OBJECT(
        'id', _comment_id,
        'content', (_body ->> 'content')::TEXT,
        'task_name', _task_name,
        'project_id', (SELECT project_id FROM tasks WHERE id = _task_id),
        'project_name', (SELECT name FROM projects WHERE id = (SELECT project_id FROM tasks WHERE id = _task_id)),
        'team_name', (SELECT name FROM teams WHERE id = (_body ->> 'team_id')::UUID)
        );
END
$$;

CREATE OR REPLACE FUNCTION create_task_status(_body json, _team_id uuid) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _status_id    UUID;
    _group_status JSON;
BEGIN

    INSERT INTO task_statuses (name, project_id, team_id, category_id, sort_order)
    VALUES (TRIM((_body ->> 'name')::TEXT),
            (_body ->> 'project_id')::UUID,
            _team_id,
            (_body ->> 'category_id')::UUID,
            COALESCE((SELECT MAX(sort_order) + 1 FROM task_statuses WHERE project_id = (_body ->> 'project_id')::UUID),
                     0))
    RETURNING id INTO _status_id;

    SELECT ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec)))
    FROM (SELECT id,
                 name,
                 project_id,
                 team_id,
                 category_id,
                 sort_order,
                 (SELECT color_code
                  FROM sys_task_status_categories
                  WHERE id =
                        (SELECT category_id FROM task_statuses WHERE id = _status_id)) AS color_code
          FROM task_statuses
          WHERE id = _status_id) rec
    INTO _group_status;

    RETURN _group_status;

END;
$$;

CREATE OR REPLACE FUNCTION create_task_template(_name text, _team_id uuid, _tasks json) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _template_id UUID;
    _task        JSON;
BEGIN

    -- check whether the project name is already in
    IF EXISTS(
        SELECT name FROM task_templates WHERE LOWER(name) = LOWER(_name)
                                    AND team_id = _team_id
    )
    THEN
        RAISE 'TASK_TEMPLATE_EXISTS_ERROR:%', _name;
    END IF;

    INSERT INTO task_templates (name, team_id) VALUES (_name, _team_id) RETURNING id INTO _template_id;

    -- insert tasks for task templates
    FOR _task IN SELECT * FROM JSON_ARRAY_ELEMENTS(_tasks)
        LOOP
            INSERT INTO task_templates_tasks (template_id, name, total_minutes) VALUES (_template_id, (_task ->> 'name')::TEXT, (SELECT total_minutes FROM tasks WHERE id = (_task ->> 'id')::UUID)::NUMERIC);
        END LOOP;

    RETURN JSON_BUILD_OBJECT(
        'id', _template_id,
        'template_name', _name
        );
END
$$;

CREATE OR REPLACE FUNCTION create_team_member(_body json) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _team_id        UUID;
    _user_id        UUID;
    _job_title_id   UUID;
    _team_member_id UUID;
    _role_id        UUID;
    _email          TEXT;
    _output         JSON;
BEGIN
    _team_id = (_body ->> 'team_id')::UUID;

    -- Check if role_name is provided, otherwise fall back to is_admin flag
    IF is_null_or_empty((_body ->> 'role_name')) IS FALSE
    THEN
        SELECT id FROM roles WHERE name = (_body ->> 'role_name')::TEXT AND team_id = _team_id INTO _role_id;
    ELSIF ((_body ->> 'is_admin')::BOOLEAN IS TRUE)
    THEN
        SELECT id FROM roles WHERE team_id = _team_id AND admin_role IS TRUE AND name = 'Admin' INTO _role_id;
    ELSE
        SELECT id FROM roles WHERE team_id = _team_id AND default_role IS TRUE INTO _role_id;
    END IF;

    IF is_null_or_empty((_body ->> 'job_title')) IS FALSE
    THEN
        SELECT insert_job_title((_body ->> 'job_title')::TEXT, _team_id) INTO _job_title_id;
    ELSE
        _job_title_id = NULL;
    END IF;

    CREATE TEMPORARY TABLE temp_new_team_members (
        name                TEXT,
        email               TEXT,
        is_new              BOOLEAN,
        team_member_id      UUID,
        team_member_user_id UUID
    );

    FOR _email IN SELECT * FROM JSON_ARRAY_ELEMENTS((_body ->> 'emails')::JSON)
        LOOP

            _email = LOWER(TRIM('"' FROM _email)::TEXT);

            SELECT id FROM users WHERE email = _email INTO _user_id;

            INSERT INTO team_members (job_title_id, user_id, team_id, role_id)
            VALUES (_job_title_id, _user_id, _team_id, _role_id)
            RETURNING id INTO _team_member_id;

            IF EXISTS(SELECT id
                      FROM email_invitations
                      WHERE email = _email
                        AND team_id = _team_id)
            THEN
                --                 DELETE
--                 FROM team_members
--                 WHERE id = (SELECT team_member_id
--                             FROM email_invitations
--                             WHERE email = _email
--                               AND team_id = _team_id);
--                 DELETE FROM email_invitations WHERE team_id = _team_id AND email = _email;

                DELETE FROM email_invitations WHERE email = _email AND team_id = _team_id;

--                 RAISE 'ERROR_EMAIL_INVITATION_EXISTS:%', _email;
            END IF;

            INSERT INTO email_invitations(team_id, team_member_id, email, name)
            VALUES (_team_id, _team_member_id, _email, SPLIT_PART(_email, '@', 1));

            INSERT INTO temp_new_team_members (is_new, team_member_id, team_member_user_id, name, email)
            VALUES ((is_null_or_empty(_user_id)), _team_member_id, _user_id,
                    (SELECT name FROM users WHERE id = _user_id), _email);
        END LOOP;

    SELECT ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec)))
    FROM (SELECT * FROM temp_new_team_members) rec
    INTO _output;

    DROP TABLE temp_new_team_members;

    RETURN _output;
END;
$$;

CREATE OR REPLACE FUNCTION delete_user(_id uuid) RETURNS void
    LANGUAGE plpgsql
AS
$$
DECLARE
BEGIN
--     SET SESSION_REPLICATION_ROLE = replica;

    UPDATE users SET active_team = NULL WHERE id = _id;
    DELETE FROM notification_settings WHERE user_id = _id;
    DELETE FROM teams WHERE user_id = _id;
    DELETE FROM roles WHERE team_id IN (SELECT id FROM teams WHERE user_id = _id);
    DELETE
    FROM tasks_assignees
    WHERE project_member_id IN
          (SELECT id FROM project_members WHERE team_member_id IN (SELECT id FROM team_members WHERE user_id = _id));
    DELETE FROM project_members WHERE team_member_id IN (SELECT id FROM team_members WHERE user_id = _id);
    DELETE FROM team_members WHERE user_id = _id;
    DELETE FROM job_titles WHERE team_id = (SELECT id FROM teams WHERE user_id = _id);
    DELETE
    FROM tasks
    WHERE project_id IN (SELECT id FROM projects WHERE team_id = (SELECT id FROM teams WHERE user_id = _id));
    DELETE FROM projects WHERE team_id = (SELECT id FROM teams WHERE user_id = _id);
    DELETE FROM clients WHERE team_id = (SELECT id FROM teams WHERE user_id = _id);
    DELETE FROM teams WHERE user_id = _id;
    DELETE FROM personal_todo_list WHERE user_id = _id;
    DELETE FROM user_notifications WHERE user_id = _id;
    UPDATE users SET active_team = NULL WHERE id = _id;
    DELETE FROM users WHERE id = _id;

--     SET SESSION_REPLICATION_ROLE = default;
END;
$$;

CREATE OR REPLACE FUNCTION deserialize_user(_id uuid) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _result JSON;
BEGIN
    -- Optimized version using CTEs for better performance and maintainability
    WITH user_team_data AS (
        SELECT
            u.id,
            u.name,
            u.email,
            u.timezone_id AS timezone,
            u.avatar_url,
            u.user_no,
            u.socket_id,
            u.created_at AS joined_date,
            u.updated_at AS last_updated,
            u.setup_completed AS my_setup_completed,
            (is_null_or_empty(u.google_id) IS FALSE) AS is_google,
            COALESCE(u.active_team, (SELECT id FROM teams WHERE user_id = u.id LIMIT 1)) AS team_id,
            u.active_team
        FROM users u
        WHERE u.id = _id
    ),
    team_org_data AS (
        SELECT
            utd.*,
            t.name AS team_name,
            t.user_id AS owner_id,
            o.subscription_status,
            o.license_type_id,
            o.trial_expire_date
        FROM user_team_data utd
        INNER JOIN teams t ON t.id = utd.team_id
        LEFT JOIN organizations o ON o.user_id = t.user_id
    ),
    notification_data AS (
        SELECT
            tod.*,
            COALESCE(ns.email_notifications_enabled, TRUE) AS email_notifications_enabled
        FROM team_org_data tod
        LEFT JOIN notification_settings ns ON (ns.user_id = tod.id AND ns.team_id = tod.team_id)
    ),
    alerts_data AS (
        SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(alert_rec))), '[]'::JSON) AS alerts
        FROM (SELECT description, type FROM worklenz_alerts WHERE active IS TRUE) alert_rec
    ),
    complete_user_data AS (
        SELECT
            nd.*,
            tz.name AS timezone_name,
            slt.key AS subscription_type,
            tm.id AS team_member_id,
            ad.alerts,
            CASE
                WHEN nd.subscription_status = 'trialing' THEN nd.trial_expire_date::DATE
                WHEN EXISTS(SELECT 1 FROM licensing_custom_subs WHERE user_id = nd.owner_id)
                    THEN (SELECT end_date FROM licensing_custom_subs WHERE user_id = nd.owner_id LIMIT 1)::DATE
                WHEN EXISTS(SELECT 1 FROM licensing_user_subscriptions WHERE user_id = nd.owner_id AND active IS TRUE)
                    THEN (SELECT (next_bill_date)::DATE - INTERVAL '1 day'
                          FROM licensing_user_subscriptions
                          WHERE user_id = nd.owner_id AND active IS TRUE
                          LIMIT 1)::DATE
                ELSE NULL
            END AS valid_till_date,
            CASE
                WHEN is_owner(nd.id, nd.active_team) THEN nd.my_setup_completed
                ELSE TRUE
            END AS setup_completed,
            is_owner(nd.id, nd.active_team) AS owner,
            is_admin(nd.id, nd.active_team) AS is_admin
        FROM notification_data nd
        CROSS JOIN alerts_data ad
        LEFT JOIN timezones tz ON tz.id = nd.timezone
        LEFT JOIN sys_license_types slt ON slt.id = nd.license_type_id
        LEFT JOIN team_members tm ON (tm.user_id = nd.id AND tm.team_id = nd.team_id AND tm.active IS TRUE)
    )
    SELECT ROW_TO_JSON(complete_user_data.*) INTO _result FROM complete_user_data;

    -- Ensure notification settings exist using INSERT...ON CONFLICT for better concurrency
    INSERT INTO notification_settings (user_id, team_id, email_notifications_enabled, popup_notifications_enabled, show_unread_items_count)
    SELECT _id,
           COALESCE((SELECT active_team FROM users WHERE id = _id),
                   (SELECT id FROM teams WHERE user_id = _id LIMIT 1)),
           TRUE, TRUE, TRUE
    ON CONFLICT (user_id, team_id) DO NOTHING;

    RETURN _result;
END
$$;

CREATE OR REPLACE FUNCTION get_activity_logs_by_task(_task_id uuid) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _result JSON;
BEGIN
    SELECT ROW_TO_JSON(rec)
    INTO _result
    FROM (SELECT (SELECT tasks.created_at FROM tasks WHERE tasks.id = _task_id),
                 (SELECT name
                  FROM users
                  WHERE id = (SELECT reporter_id FROM tasks WHERE id = _task_id)),
                 (SELECT avatar_url
                  FROM users
                  WHERE id = (SELECT reporter_id FROM tasks WHERE id = _task_id)),
                 (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec2))), '[]'::JSON)
                  FROM (SELECT task_id,
                               created_at,
                               attribute_type,
                               log_type,

                               -- new case,
                               (CASE
                                    WHEN (attribute_type = 'status')
                                        THEN (SELECT name FROM task_statuses WHERE id = old_value::UUID)
                                    WHEN (attribute_type = 'priority')
                                        THEN (SELECT name FROM task_priorities WHERE id = old_value::UUID)
                                    WHEN (attribute_type = 'phase' AND old_value <> 'Unmapped')
                                        THEN (SELECT name FROM project_phases WHERE id = old_value::UUID)
                                    ELSE (old_value) END) AS previous,

                               -- new case
                               (CASE
                                    WHEN (attribute_type = 'assignee')
                                        THEN (SELECT name FROM users WHERE id = new_value::UUID)
                                    WHEN (attribute_type = 'label')
                                        THEN (SELECT name FROM team_labels WHERE id = new_value::UUID)
                                    WHEN (attribute_type = 'status')
                                        THEN (SELECT name FROM task_statuses WHERE id = new_value::UUID)
                                    WHEN (attribute_type = 'priority')
                                        THEN (SELECT name FROM task_priorities WHERE id = new_value::UUID)
                                    WHEN (attribute_type = 'phase' AND new_value <> 'Unmapped')
                                        THEN (SELECT name FROM project_phases WHERE id = new_value::UUID)
                                    ELSE (new_value) END) AS current,

                               -- new case
                               (CASE
                                    WHEN (attribute_type = 'assignee')
                                        THEN (SELECT ROW_TO_JSON(rec)
                                              FROM (SELECT (CASE
                                                                WHEN (new_value IS NOT NULL)
                                                                    THEN (SELECT name FROM users WHERE users.id = new_value::UUID)
                                                                ELSE (next_string) END) AS name,
                                                           (SELECT avatar_url FROM users WHERE users.id = new_value::UUID)) rec)
                                    ELSE (NULL) END) AS assigned_user,

                               -- new case
                               (CASE
                                    WHEN (attribute_type = 'label')
                                        THEN (SELECT ROW_TO_JSON(rec)
                                              FROM (SELECT (SELECT name FROM team_labels WHERE id = new_value::UUID),
                                                           (SELECT color_code FROM team_labels WHERE id = new_value::UUID)) rec)
                                    ELSE (NULL) END) AS label_data,

                               -- new case
                               (CASE
                                    WHEN (attribute_type = 'status')
                                        THEN (SELECT ROW_TO_JSON(rec)
                                              FROM (SELECT (SELECT name FROM task_statuses WHERE id = old_value::UUID),
                                                           (SELECT color_code
                                                            FROM sys_task_status_categories
                                                            WHERE id = (SELECT category_id FROM task_statuses WHERE id = old_value::UUID)),
                                                           (SELECT color_code_dark
                                                            FROM sys_task_status_categories
                                                            WHERE id = (SELECT category_id FROM task_statuses WHERE id = old_value::UUID))) rec)
                                    ELSE (NULL) END) AS previous_status,

                               -- new case
                               (CASE
                                    WHEN (attribute_type = 'status')
                                        THEN (SELECT ROW_TO_JSON(rec)
                                              FROM (SELECT (SELECT name FROM task_statuses WHERE id = new_value::UUID),
                                                           (SELECT color_code
                                                            FROM sys_task_status_categories
                                                            WHERE id = (SELECT category_id FROM task_statuses WHERE id = new_value::UUID)),
                                                           (SELECT color_code_dark
                                                            FROM sys_task_status_categories
                                                            WHERE id = (SELECT category_id FROM task_statuses WHERE id = new_value::UUID))) rec)
                                    ELSE (NULL) END) AS next_status,

                               -- new case
                               (CASE
                                    WHEN (attribute_type = 'priority')
                                        THEN (SELECT ROW_TO_JSON(rec)
                                              FROM (SELECT (SELECT name FROM task_priorities WHERE id = old_value::UUID),
                                                           (SELECT color_code FROM task_priorities WHERE id = old_value::UUID)) rec)
                                    ELSE (NULL) END) AS previous_priority,

                               -- new case
                               (CASE
                                    WHEN (attribute_type = 'priority')
                                        THEN (SELECT ROW_TO_JSON(rec)
                                              FROM (SELECT (SELECT name FROM task_priorities WHERE id = new_value::UUID),
                                                           (SELECT color_code FROM task_priorities WHERE id = new_value::UUID)) rec)
                                    ELSE (NULL) END) AS next_priority,

                               -- new case
                               (CASE
                                    WHEN (attribute_type = 'phase' AND old_value <> 'Unmapped')
                                        THEN (SELECT ROW_TO_JSON(rec)
                                              FROM (SELECT (SELECT name FROM project_phases WHERE id = old_value::UUID),
                                                           (SELECT color_code FROM project_phases WHERE id = old_value::UUID)) rec)
                                    ELSE (NULL) END) AS previous_phase,

                               -- new case
                               (CASE
                                    WHEN (attribute_type = 'phase' AND new_value <> 'Unmapped')
                                        THEN (SELECT ROW_TO_JSON(rec)
                                              FROM (SELECT (SELECT name FROM project_phases WHERE id = new_value::UUID),
                                                           (SELECT color_code FROM project_phases WHERE id = new_value::UUID)) rec)
                                    ELSE (NULL) END) AS next_phase,

                               -- new case
                               (SELECT ROW_TO_JSON(rec)
                                FROM (SELECT (SELECT name FROM users WHERE users.id = tal.user_id),
                                             (SELECT avatar_url FROM users WHERE users.id = tal.user_id)) rec) AS done_by


                        FROM task_activity_logs tal
                        WHERE task_id = _task_id
                        ORDER BY created_at DESC) rec2) AS logs) rec;
    RETURN _result;
END;
$$;

CREATE OR REPLACE FUNCTION get_billing_info(_user_id uuid) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _is_custom BOOLEAN := FALSE;
    _is_ltd    BOOLEAN := FALSE;
    _result    JSON;
BEGIN
    SELECT EXISTS(SELECT id FROM licensing_custom_subs WHERE user_id = _user_id) INTO _is_custom;
    SELECT EXISTS(SELECT 1 FROM licensing_coupon_codes WHERE redeemed_by = _user_id) INTO _is_ltd;

    SELECT ROW_TO_JSON(rec)
    INTO _result
    FROM (SELECT (SELECT name FROM users WHERE ud.user_id = users.id),
                 (SELECT email FROM users WHERE ud.user_id = users.id),
                 contact_number,
                 contact_number_secondary,
                 trial_in_progress,
                 trial_expire_date,
                 unit_price::NUMERIC,
                 cancel_url,
                 subscription_status AS status,
                 lus.cancellation_effective_date,
                 lus.paused_at,
                 lus.paused_from::DATE,
                 lus.paused_reason,
                 _is_custom AS is_custom,
                 _is_ltd AS is_ltd_user,
                 (SELECT SUM(team_members_limit) FROM licensing_coupon_codes WHERE redeemed_by = _user_id) AS ltd_users,
                 (CASE
                      WHEN (_is_custom) THEN 'Custom Plan'
                      WHEN (_is_ltd) THEN 'Life Time Deal'
                      ELSE
                              (SELECT name FROM licensing_pricing_plans WHERE id = lus.plan_id) END) AS plan_name,
                 (SELECT key FROM sys_license_types WHERE id = ud.license_type_id) AS subscription_type,
                 (SELECT id AS plan_id FROM licensing_pricing_plans WHERE id = lus.plan_id),
                 (SELECT default_currency AS default_currency FROM licensing_pricing_plans WHERE id = lus.plan_id),
                 (SELECT billing_type FROM licensing_pricing_plans WHERE id = lus.plan_id),
                 (CASE
                      WHEN ud.subscription_status = 'trialing' THEN ud.trial_expire_date::DATE
                      WHEN EXISTS (SELECT 1 FROM licensing_custom_subs lcs WHERE lcs.user_id = ud.user_id) THEN
                          (SELECT end_date FROM licensing_custom_subs lcs WHERE lcs.user_id = ud.user_id)::DATE
                      WHEN EXISTS (SELECT 1 FROM licensing_user_subscriptions lus WHERE lus.user_id = ud.user_id) THEN
                          (SELECT next_bill_date::DATE - INTERVAL '1 day'
                           FROM licensing_user_subscriptions lus
                           WHERE lus.user_id = ud.user_id)::DATE
                     END) AS valid_till_date,
                 is_lkr_billing
          FROM organizations ud
                   LEFT JOIN licensing_user_subscriptions lus ON ud.user_id = lus.user_id
          WHERE ud.user_id = _user_id) rec;
    RETURN _result;
END;
$$;

CREATE OR REPLACE FUNCTION get_daily_digest() RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _result JSON;
BEGIN
    SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
    INTO _result
    FROM (
             --
             SELECT name,
                    email,
                    (SELECT get_daily_digest_recently_assigned(u.id)) AS recently_assigned,
                    (SELECT get_daily_digest_overdue(u.id)) AS overdue,
                    (SELECT get_daily_digest_recently_completed(u.id)) AS recently_completed
             FROM users u
             --
         ) rec;
    RETURN _result;
END;
$$;

CREATE OR REPLACE FUNCTION get_daily_digest_overdue(_user_id uuid) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _result JSON;
BEGIN
    SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
    INTO _result
    FROM (
             --
             SELECT id,
                    name,
                    (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(r))), '[]'::JSON) AS projects
                     FROM (
                              --
                              SELECT id,
                                     name,
                                     (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(r))), '[]'::JSON) AS tasks
                                      FROM (
                                               --
                                               SELECT t.id,
                                                      t.name,
                                                      (SELECT STRING_AGG(DISTINCT
                                                                         (SELECT name
                                                                          FROM team_member_info_view
                                                                          WHERE team_member_id = tasks_assignees.team_member_id),
                                                                         ', ')
                                                       FROM tasks_assignees
                                                       WHERE task_id = t.id) AS members
                                               FROM tasks_assignees
                                                        INNER JOIN tasks t ON tasks_assignees.task_id = t.id
                                                        INNER JOIN team_members tm ON tasks_assignees.team_member_id = tm.id
                                               WHERE tm.user_id = _user_id
                                                 AND t.project_id = projects.id
                                                 AND t.end_date IS NOT NULL
                                                 AND t.end_date < CURRENT_DATE
                                                 AND EXISTS(SELECT id
                                                            FROM task_statuses
                                                            WHERE id = t.status_id
                                                              AND category_id IN
                                                                  (SELECT id FROM sys_task_status_categories WHERE is_done IS FALSE))
                                               LIMIT 10
                                               --
                                           ) r)
                              FROM projects
                              WHERE projects.team_id IN
                                    (SELECT team_id
                                     FROM team_members
                                     WHERE user_id = _user_id
                                       AND team_members.team_id = teams.id)
                              --
                          ) r)
             FROM teams
             WHERE (SELECT daily_digest_enabled
                    FROM notification_settings
                    WHERE team_id = teams.id
                      AND user_id = _user_id) IS TRUE
               AND EXISTS(SELECT 1
                          FROM team_members
                          WHERE team_id = teams.id
                            AND team_members.user_id = _user_id)
             --
         ) rec;

    RETURN _result;
END
$$;

CREATE OR REPLACE FUNCTION get_daily_digest_recently_assigned(_user_id uuid) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _result JSON;
BEGIN
    SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
    INTO _result
    FROM (
             --

             --
             SELECT id,
                    name,
                    (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(r))), '[]'::JSON) AS projects
                     FROM (
                              --
                              SELECT id,
                                     name,
                                     (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(r))), '[]'::JSON) AS tasks
                                      FROM (
                                               --
                                               SELECT t.id,
                                                      t.name,
                                                      (SELECT STRING_AGG(DISTINCT
                                                                         (SELECT name
                                                                          FROM team_member_info_view
                                                                          WHERE team_member_id = tasks_assignees.team_member_id),
                                                                         ', ')
                                                       FROM tasks_assignees
                                                       WHERE task_id = t.id) AS members
                                               FROM tasks_assignees
                                                        INNER JOIN tasks t ON tasks_assignees.task_id = t.id
                                                        INNER JOIN team_members tm ON tasks_assignees.team_member_id = tm.id
                                               WHERE tm.user_id = _user_id
                                                 AND t.project_id = projects.id
                                                 AND TO_CHAR(tasks_assignees.created_at, 'yyyy-mm-dd') =
                                                     TO_CHAR(CURRENT_DATE, 'yyyy-mm-dd')
                                               --
                                           ) r)
                              FROM projects
                              WHERE projects.team_id IN
                                    (SELECT team_id
                                     FROM team_members
                                     WHERE user_id = _user_id
                                       AND team_members.team_id = teams.id)
                              --
                          ) r)
             FROM teams
             WHERE (SELECT daily_digest_enabled
                    FROM notification_settings
                    WHERE team_id = teams.id
                      AND user_id = _user_id) IS TRUE
               AND EXISTS(SELECT 1
                          FROM team_members
                          WHERE team_id = teams.id
                            AND team_members.user_id = _user_id)
             --
         ) rec;

    RETURN _result;
END
$$;

CREATE OR REPLACE FUNCTION get_daily_digest_recently_completed(_user_id uuid) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _result JSON;
BEGIN
    SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
    INTO _result
    FROM (
             --
             SELECT id,
                    name,
                    (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(r))), '[]'::JSON) AS projects
                     FROM (
                              --
                              SELECT name,
                                     (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(r))), '[]'::JSON) AS tasks
                                      FROM (
                                               --
                                               SELECT t.id,
                                                      t.name,
                                                      (SELECT STRING_AGG(DISTINCT
                                                                         (SELECT name
                                                                          FROM team_member_info_view
                                                                          WHERE team_member_id = tasks_assignees.team_member_id),
                                                                         ', ')
                                                       FROM tasks_assignees
                                                       WHERE task_id = t.id) AS members
                                               FROM tasks_assignees
                                                        INNER JOIN tasks t ON tasks_assignees.task_id = t.id
                                                        INNER JOIN team_members tm ON tasks_assignees.team_member_id = tm.id
                                               WHERE tm.user_id = _user_id
                                                 AND t.project_id = projects.id
                                                 AND t.completed_at IS NOT NULL
                                                 AND TO_CHAR(t.completed_at, 'yyyy-mm-dd') =
                                                     TO_CHAR(CURRENT_DATE, 'yyyy-mm-dd')
                                               LIMIT 10
                                               --
                                           ) r)
                              FROM projects
                              WHERE projects.team_id IN
                                    (SELECT team_id
                                     FROM team_members
                                     WHERE user_id = _user_id
                                       AND team_members.team_id = teams.id)
                              --
                          ) r)
             FROM teams
             WHERE (SELECT daily_digest_enabled
                    FROM notification_settings
                    WHERE team_id = teams.id
                      AND user_id = _user_id) IS TRUE
               AND EXISTS(SELECT 1
                          FROM team_members
                          WHERE team_id = teams.id
                            AND team_members.user_id = _user_id)
             --
         ) rec;

    RETURN _result;
END
$$;

CREATE OR REPLACE FUNCTION get_last_updated_tasks_by_project(_project_id uuid, _limit integer, _offset integer, _archived boolean) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _tasks JSON;
BEGIN
    SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
    INTO _tasks
    FROM (SELECT id,
                 name,
                 (SELECT name FROM task_statuses WHERE status_id = task_statuses.id) AS status,
                 status_id,
                 end_date,
                 priority_id AS priority,
                 updated_at,
                 (SELECT color_code
                  FROM sys_task_status_categories
                  WHERE id = (SELECT category_id FROM task_statuses WHERE id = status_id)) AS status_color
          FROM tasks
          WHERE project_id = _project_id
            AND CASE
                    WHEN (_archived IS TRUE) THEN project_id IS NOT NULL
                    ELSE archived IS FALSE END
          ORDER BY updated_at DESC
          LIMIT _limit OFFSET _offset) rec;
    RETURN _tasks;
END
$$;

CREATE OR REPLACE FUNCTION get_my_tasks(_team_id uuid, _user_id uuid, _size numeric, _offset numeric, _filter text) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _result JSON;
BEGIN
    -- _filter = '0' is tasks due today
    IF _filter = '0'
    THEN
        SELECT ROW_TO_JSON(rec)
        INTO _result
        FROM (SELECT COUNT(*) AS total,
                     (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                      FROM (SELECT t.id,
                                   t.name,
                                   t.project_id,
                                   t.status_id,
                                   t.start_date,
                                   t.end_date,
                                   t.created_at,
                                   p.team_id,
                                   p.name AS project_name,
                                   p.color_code AS project_color,
                                   (SELECT name FROM task_statuses WHERE id = t.status_id) AS status,
                                   (SELECT color_code
                                    FROM sys_task_status_categories
                                    WHERE id = (SELECT category_id FROM task_statuses WHERE id = t.status_id)) AS status_color,
                                   TRUE AS is_task
                            FROM tasks t
                                     CROSS JOIN projects p
                            WHERE t.project_id = p.id
                              AND t.archived IS FALSE
                              AND t.end_date::DATE = CURRENT_DATE::DATE
                              AND t.status_id NOT IN (SELECT id
                                                      FROM task_statuses
                                                      WHERE category_id NOT IN
                                                            (SELECT id FROM sys_task_status_categories WHERE is_done IS FALSE))
                              AND t.id IN
                                  (SELECT task_id
                                   FROM tasks_assignees
                                   WHERE team_member_id = (SELECT id
                                                           FROM team_members
                                                           WHERE user_id = _user_id
                                                             AND team_id = _team_id))
                            ORDER BY p.updated_at, created_at
                            LIMIT _size OFFSET _offset) rec) AS data
              FROM tasks t
                       CROSS JOIN projects p
              WHERE t.project_id = p.id
                AND t.archived IS FALSE
                AND t.end_date::DATE = CURRENT_DATE::DATE
                AND t.status_id NOT IN (SELECT id
                                        FROM task_statuses
                                        WHERE category_id NOT IN
                                              (SELECT id FROM sys_task_status_categories WHERE is_done IS FALSE))
                AND t.id IN
                    (SELECT task_id
                     FROM tasks_assignees
                     WHERE team_member_id = (SELECT id
                                             FROM team_members
                                             WHERE user_id = _user_id
                                               AND team_id = _team_id))) rec;
        RETURN _result;
    END IF;

    -- _filter = '1' is upcoming tasks
    IF _filter = '1'
    THEN
        SELECT ROW_TO_JSON(rec)
        INTO _result
        FROM (SELECT COUNT(*) AS total,
                     (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                      FROM (SELECT t.id,
                                   t.name,
                                   t.project_id,
                                   t.status_id,
                                   t.start_date,
                                   t.end_date,
                                   t.created_at,
                                   p.team_id,
                                   p.name AS project_name,
                                   p.color_code AS project_color,
                                   (SELECT name FROM task_statuses WHERE id = t.status_id) AS status,
                                   (SELECT color_code
                                    FROM sys_task_status_categories
                                    WHERE id = (SELECT category_id FROM task_statuses WHERE id = t.status_id)) AS status_color,
                                   TRUE AS is_task
                            FROM tasks t
                                     CROSS JOIN projects p
                            WHERE t.project_id = p.id
                              AND t.archived IS FALSE
                              AND t.end_date::DATE > CURRENT_DATE::DATE
                              AND t.status_id NOT IN (SELECT id
                                                      FROM task_statuses
                                                      WHERE category_id NOT IN
                                                            (SELECT id FROM sys_task_status_categories WHERE is_done IS FALSE))
                              AND t.id IN
                                  (SELECT task_id
                                   FROM tasks_assignees
                                   WHERE team_member_id = (SELECT id
                                                           FROM team_members
                                                           WHERE user_id = _user_id
                                                             AND team_id = _team_id))
                            ORDER BY p.updated_at, created_at
                            LIMIT _size OFFSET _offset) rec) AS data
              FROM tasks t
                       CROSS JOIN projects p
              WHERE t.project_id = p.id
                AND t.archived IS FALSE
                AND t.end_date::DATE > CURRENT_DATE::DATE
                AND t.status_id NOT IN (SELECT id
                                        FROM task_statuses
                                        WHERE category_id NOT IN
                                              (SELECT id FROM sys_task_status_categories WHERE is_done IS FALSE))
                AND t.id IN
                    (SELECT task_id
                     FROM tasks_assignees
                     WHERE team_member_id = (SELECT id
                                             FROM team_members
                                             WHERE user_id = _user_id
                                               AND team_id = _team_id))) rec;
        RETURN _result;
    END IF;

    -- _filter = '2' is overdue tasks
    IF _filter = '2'
    THEN
        SELECT ROW_TO_JSON(rec)
        INTO _result
        FROM (SELECT COUNT(*) AS total,
                     (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                      FROM (SELECT t.id,
                                   t.name,
                                   t.project_id,
                                   t.status_id,
                                   t.start_date,
                                   t.end_date,
                                   t.created_at,
                                   p.team_id,
                                   p.name AS project_name,
                                   p.color_code AS project_color,
                                   (SELECT name FROM task_statuses WHERE id = t.status_id) AS status,
                                   (SELECT color_code
                                    FROM sys_task_status_categories
                                    WHERE id = (SELECT category_id FROM task_statuses WHERE id = t.status_id)) AS status_color,
                                   TRUE AS is_task
                            FROM tasks t
                                     CROSS JOIN projects p
                            WHERE t.project_id = p.id
                              AND t.archived IS FALSE
                              AND t.end_date::DATE < CURRENT_DATE::DATE
                              AND t.status_id NOT IN (SELECT id
                                                      FROM task_statuses
                                                      WHERE category_id NOT IN
                                                            (SELECT id FROM sys_task_status_categories WHERE is_done IS FALSE))
                              AND t.id IN
                                  (SELECT task_id
                                   FROM tasks_assignees
                                   WHERE team_member_id = (SELECT id
                                                           FROM team_members
                                                           WHERE user_id = _user_id
                                                             AND team_id = _team_id))
                            ORDER BY p.updated_at, created_at
                            LIMIT _size OFFSET _offset) rec) AS data
              FROM tasks t
                       CROSS JOIN projects p
              WHERE t.project_id = p.id
                AND t.archived IS FALSE
                AND t.end_date::DATE < CURRENT_DATE::DATE
                AND t.status_id NOT IN (SELECT id
                                        FROM task_statuses
                                        WHERE category_id NOT IN
                                              (SELECT id FROM sys_task_status_categories WHERE is_done IS FALSE))
                AND t.id IN
                    (SELECT task_id
                     FROM tasks_assignees
                     WHERE team_member_id = (SELECT id
                                             FROM team_members
                                             WHERE user_id = _user_id
                                               AND team_id = _team_id))) rec;
        RETURN _result;
    END IF;

    -- _filter = '3' is todo list
    IF _filter = '3'
    THEN
        SELECT ROW_TO_JSON(rec)
        INTO _result
        FROM (SELECT COUNT(*) AS total,
                     (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                      FROM (SELECT id, name, created_at, color_code, done
                            FROM personal_todo_list
                            WHERE user_id = _user_id
                            ORDER BY updated_at, created_at
                            LIMIT _size OFFSET _offset) rec) AS data) rec;
        RETURN _result;
    END IF;

END;
$$;

CREATE OR REPLACE FUNCTION get_project_daily_digest() RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _result JSON;
BEGIN

    SELECT COALESCE(JSON_AGG(rec), '[]'::JSON)
    INTO _result
    FROM (SELECT id,
                 name,
                 (SELECT name FROM teams WHERE id = projects.team_id) AS team_name,

                 (SELECT COALESCE(JSON_AGG(rec), '[]'::JSON)
                  FROM (SELECT id,
                               name,
                               (SELECT STRING_AGG(DISTINCT
                                                  (SELECT name
                                                   FROM team_member_info_view
                                                   WHERE team_member_id = tasks_assignees.team_member_id),
                                                  ', ')
                                FROM tasks_assignees
                                WHERE task_id = tasks.id) AS members
                        FROM tasks
                        WHERE project_id = projects.id
                          AND TO_CHAR(tasks.completed_at, 'yyyy-mm-dd') =
                              TO_CHAR(CURRENT_DATE, 'yyyy-mm-dd')) rec) AS today_completed,

                 (SELECT COALESCE(JSON_AGG(rec), '[]'::JSON)
                  FROM (SELECT id,
                               name,
                               (SELECT STRING_AGG(DISTINCT
                                                  (SELECT name
                                                   FROM team_member_info_view
                                                   WHERE team_member_id = tasks_assignees.team_member_id),
                                                  ', ')
                                FROM tasks_assignees
                                WHERE task_id = tasks.id) AS members
                        FROM tasks
                        WHERE project_id = projects.id
                          AND TO_CHAR(tasks.created_at, 'yyyy-mm-dd') =
                              TO_CHAR(CURRENT_DATE, 'yyyy-mm-dd')) rec) AS today_new,

                 (SELECT COALESCE(JSON_AGG(rec), '[]'::JSON)
                  FROM (SELECT id,
                               name,
                               (SELECT STRING_AGG(DISTINCT
                                                  (SELECT name
                                                   FROM team_member_info_view
                                                   WHERE team_member_id = tasks_assignees.team_member_id),
                                                  ', ')
                                FROM tasks_assignees
                                WHERE task_id = tasks.id) AS members
                        FROM tasks
                        WHERE project_id = projects.id
                          AND TO_CHAR(tasks.end_date, 'yyyy-mm-dd') =
                              TO_CHAR(CURRENT_DATE + INTERVAL '1 day', 'yyyy-mm-dd')) rec) AS due_tomorrow,

                 (SELECT COALESCE(JSON_AGG(rec), '[]'::JSON)
                  FROM (SELECT name, email
                        FROM users
                        WHERE id = (SELECT user_id
                                    FROM project_subscribers
                                    WHERE project_id = projects.id
                                      AND user_id = users.id)) rec) AS subscribers

          FROM projects
          WHERE EXISTS(SELECT 1 FROM project_subscribers WHERE project_id = projects.id)
          ORDER BY team_id, name) rec;

    RETURN _result;
END
$$;

CREATE OR REPLACE FUNCTION get_project_deadline_tasks(_project_id uuid, _archived boolean) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _result JSON;

BEGIN
    SELECT COALESCE(ROW_TO_JSON(rec), '[]'::JSON)
    INTO _result
    FROM (SELECT (SELECT COUNT(*)
                  FROM tasks
                  WHERE project_id = _project_id
                    AND CASE
                            WHEN (_archived IS TRUE) THEN project_id IS NOT NULL
                            ELSE archived IS FALSE END
                    AND end_date::DATE > (SELECT end_date
                                          FROM projects
                                          WHERE id = _project_id)::DATE) AS deadline_tasks_count,
                 (SELECT SUM(twl.time_spent)
                  FROM tasks t
                           CROSS JOIN task_work_log twl
                  WHERE twl.task_id = t.id
                    AND t.project_id = _project_id
                    AND twl.created_at::DATE > (SELECT end_date
                                                FROM projects
                                                WHERE id = _project_id)::DATE
                    AND CASE
                            WHEN (_archived IS TRUE) THEN t.project_id IS NOT NULL
                            ELSE t.archived IS FALSE END) AS deadline_logged_hours,
                 (SELECT end_date FROM projects WHERE id = _project_id) AS project_end_date,
                 (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(r))), '[]'::JSON) AS tasks
                  FROM (SELECT id,
                               name,
                               status_id,
                               start_date,
                               end_date,
                               (SELECT name FROM task_statuses WHERE id = tasks.status_id) AS status,
                               (SELECT color_code
                                FROM sys_task_status_categories
                                WHERE id = (SELECT category_id FROM task_statuses WHERE id = status_id)) AS status_color

                        FROM tasks
                        WHERE project_id = _project_id
                          AND CASE
                                  WHEN (_archived IS TRUE) THEN project_id IS NOT NULL
                                  ELSE archived IS FALSE END
                          AND end_date::DATE > (SELECT end_date
                                                FROM projects
                                                WHERE id = _project_id)::DATE) r)) rec;
    RETURN _result;

END;
$$;

CREATE OR REPLACE FUNCTION get_project_gantt_tasks(_project_id uuid) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _tasks JSON;
BEGIN
    SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
    INTO _tasks
    FROM (SELECT p.id,
                 p.name,
                 0 AS level,
                 (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                  FROM (SELECT pm.id,
                               pm.team_member_id,
                               pm.project_access_level_id,
                               (SELECT name
                                FROM job_titles
                                WHERE job_titles.id = tm.job_title_id) AS job_title,
                               (SELECT name
                                FROM team_member_info_view
                                WHERE team_member_info_view.team_member_id = tm.id),
                               u.avatar_url,
                               (SELECT email
                                FROM team_member_info_view
                                WHERE team_member_info_view.team_member_id = tm.id),
                               (SELECT name
                                FROM project_access_levels
                                WHERE project_access_levels.id = pm.project_access_level_id) AS access_level,
                               (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                                FROM (SELECT t.id,
                                             t.name,
                                             t.start_date AS start,
                                             t.project_id,
                                             t.priority_id,
                                             t.done,
                                             t.end_date AS "end",
                                             (SELECT color_code
                                              FROM projects
                                              WHERE projects.id = t.project_id) AS color_code,
                                             t.status_id,
                                             (SELECT name FROM task_statuses WHERE id = t.status_id) AS status,
                                             (SELECT ARRAY_AGG(ROW_TO_JSON(rec))
                                              FROM (SELECT project_member_id AS id,
                                                           (SELECT name
                                                            FROM team_member_info_view
                                                            WHERE team_member_info_view.team_member_id = tm.id),
                                                           u2.avatar_url,
                                                           (SELECT team_member_info_view.email
                                                            FROM team_member_info_view
                                                            WHERE team_member_info_view.team_member_id = tm.id)
                                                    FROM tasks_assignees
                                                             INNER JOIN project_members pm ON pm.id = tasks_assignees.project_member_id
                                                             INNER JOIN team_members tm2 ON pm.team_member_id = tm2.id
                                                             LEFT JOIN users u2 ON tm2.user_id = u2.id
                                                    WHERE project_id = _project_id::UUID
                                                      AND project_member_id = pm.id
                                                      AND t.id = tasks_assignees.task_id
                                                    ORDER BY name) rec) AS assignees
                                      FROM tasks_assignees ta,
                                           tasks t
                                      WHERE t.archived IS FALSE
                                        AND ta.project_member_id = pm.id
                                        AND t.id = ta.task_id
                                      ORDER BY start_date) rec) AS tasks
                        FROM project_members pm
                                 INNER JOIN team_members tm ON pm.team_member_id = tm.id
                                 LEFT JOIN users u ON tm.user_id = u.id
                        WHERE project_id = p.id) rec) AS team_members
          FROM projects p
          WHERE p.id = _project_id::UUID) rec;

    RETURN _tasks;
END;
$$;

CREATE OR REPLACE FUNCTION get_project_member_insights(_project_id uuid, _archived boolean) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _result JSON;

BEGIN
    SELECT COALESCE(ROW_TO_JSON(rec), '[]'::JSON)
    INTO _result
    FROM (SELECT (SELECT COUNT(*) FROM project_members WHERE project_id = _project_id) AS total_members_count,
                 (SELECT COUNT(*)
                  FROM project_members
                  WHERE project_id = _project_id
                    AND team_member_id NOT IN
                        (SELECT team_member_id
                         FROM tasks_assignees
                         WHERE task_id IN (SELECT id
                                           FROM tasks
                                           WHERE tasks.project_id = _project_id
                                             AND CASE
                                                     WHEN (_archived IS TRUE) THEN project_id IS NOT NULL
                                                     ELSE archived IS FALSE END))) AS unassigned_members,
                 (SELECT COUNT(*)
                  FROM project_members
                  WHERE project_id = _project_id
                    AND team_member_id IN
                        (SELECT team_member_id
                         FROM tasks_assignees
                         WHERE task_id IN (SELECT id
                                           FROM tasks
                                           WHERE tasks.project_id = _project_id
                                             AND CASE
                                                     WHEN (_archived IS TRUE) THEN project_id IS NOT NULL
                                                     ELSE archived IS FALSE END
                                             AND tasks.end_date::DATE < NOW()::DATE))) AS overdue_members) rec;
    RETURN _result;

END;
$$;

CREATE OR REPLACE FUNCTION get_project_members(_project_id uuid) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _output JSON;
BEGIN
    SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
    FROM (
             --
             SELECT (SELECT name FROM team_member_info_view WHERE team_member_info_view.team_member_id = tm.id),
                    u.avatar_url
             FROM project_members
                      INNER JOIN team_members tm ON project_members.team_member_id = tm.id
                      LEFT JOIN users u ON tm.user_id = u.id
             WHERE project_id = _project_id
             --
         ) rec
    INTO _output;

    RETURN _output;
END;
$$;

CREATE OR REPLACE FUNCTION get_project_overview_data(_project_id uuid, _archived boolean) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _result JSON;

BEGIN
    SELECT COALESCE(ROW_TO_JSON(rec), '[]'::JSON)
    INTO _result
    FROM (SELECT (SELECT COUNT(*) FROM tasks WHERE project_id = _project_id) AS total_tasks_count,
                 (SELECT COUNT(*)
                  FROM tasks
                  WHERE project_id = _project_id
                    AND archived IS TRUE) AS archived_tasks_count,
                 (SELECT COUNT(*)
                  FROM tasks
                  WHERE completed_at > CURRENT_DATE - INTERVAL '7 days'
                    AND project_id = _project_id
                    AND CASE
                            WHEN (_archived IS TRUE) THEN project_id IS NOT NULL
                            ELSE archived IS FALSE END) AS last_week_count,
                 (SELECT COUNT(*)
                  FROM tasks
                  WHERE project_id = _project_id
                    AND parent_task_id IS NOT NULL
                    AND CASE
                            WHEN (_archived IS TRUE) THEN project_id IS NOT NULL
                            ELSE archived IS FALSE END) AS sub_tasks_count,
                 (SELECT COUNT(*)
                  FROM tasks
                  WHERE project_id = _project_id
                    AND CASE
                            WHEN (_archived IS TRUE) THEN project_id IS NOT NULL
                            ELSE archived IS FALSE END
                    AND status_id IN (SELECT id
                                      FROM task_statuses
                                      WHERE project_id = _project_id
                                        AND category_id IN
                                            (SELECT id
                                             FROM sys_task_status_categories
                                             WHERE sys_task_status_categories.is_done IS TRUE))) AS completed_tasks_count,
                 (SELECT color_code
                  FROM sys_task_status_categories
                  WHERE sys_task_status_categories.is_done IS TRUE) AS completed_tasks_color_code,
                 (SELECT COUNT(*)
                  FROM tasks
                  WHERE project_id = _project_id
                    AND CASE
                            WHEN (_archived IS TRUE) THEN project_id IS NOT NULL
                            ELSE archived IS FALSE END
                    AND status_id IN (SELECT id
                                      FROM task_statuses
                                      WHERE project_id = _project_id
                                        AND category_id IN
                                            (SELECT id
                                             FROM sys_task_status_categories
                                             WHERE sys_task_status_categories.is_doing IS TRUE))) AS pending_tasks_count,
                 (SELECT color_code
                  FROM sys_task_status_categories
                  WHERE sys_task_status_categories.is_doing IS TRUE) AS pending_tasks_color_code,
                 (SELECT COUNT(*)
                  FROM tasks
                  WHERE project_id = _project_id
                    AND CASE
                            WHEN (_archived IS TRUE) THEN project_id IS NOT NULL
                            ELSE archived IS FALSE END
                    AND is_completed(status_id, project_id) IS FALSE) AS todo_tasks_count,
                 (SELECT color_code
                  FROM sys_task_status_categories
                  WHERE sys_task_status_categories.is_todo IS TRUE) AS todo_tasks_color_code,
                 (SELECT COUNT(*)
                  FROM tasks
                  WHERE project_id = _project_id
                    AND end_date::DATE < NOW()::DATE
                    AND CASE
                            WHEN (_archived IS TRUE) THEN project_id IS NOT NULL
                            ELSE archived IS FALSE END
                    AND status_id IN (SELECT id
                                      FROM task_statuses
                                      WHERE project_id = _project_id
                                        AND category_id IN
                                            (SELECT id
                                             FROM sys_task_status_categories
                                             WHERE sys_task_status_categories.is_done IS FALSE))) AS overdue_count,
                 (SELECT SUM(total_minutes)
                  FROM tasks
                  WHERE project_id = _project_id
                    AND CASE
                            WHEN (_archived IS TRUE) THEN project_id IS NOT NULL
                            ELSE archived IS FALSE END) AS total_minutes_sum,
                 (SELECT SUM(time_spent)
                  FROM task_work_log
                           CROSS JOIN tasks t
                  WHERE task_id = t.id
                    AND CASE
                            WHEN (_archived IS TRUE) THEN project_id IS NOT NULL
                            ELSE archived IS FALSE END
                    AND t.project_id = _project_id) AS time_spent_sum) rec;
    RETURN _result;

END;
$$;

CREATE OR REPLACE FUNCTION get_project_wise_resources(_start_date date, _end_date date, _team_id uuid) RETURNS text
    LANGUAGE plpgsql
AS
$$
DECLARE
    _projects JSON;

BEGIN
    SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
    FROM (SELECT id,
                 name,
                 color_code,
                 FALSE AS collapsed,
                 (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                  FROM (SELECT date_series,
                               project_id,
                               SUM(total_minutes / 60),
                               JSON_AGG(JSON_BUILD_OBJECT('id', tasks_.id,
                                                          'name', tasks_.name
                                   )) AS scheduled_tasks
                        FROM GENERATE_SERIES(
                                 _start_date::DATE,
                                 _end_date::DATE,
                                 '1 day'
                                 ) AS date_series
                                 CROSS JOIN (SELECT id, name, project_id, total_minutes, start_date, end_date
                                             FROM tasks) AS tasks_
                        WHERE (date_series >= tasks_.start_date::DATE AND date_series <= tasks_.end_date::DATE)
                          AND tasks_.project_id = projects.id
                        GROUP BY date_series, project_id) rec) AS schedule,
                 (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                  FROM (SELECT team_member_id,
                               (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                                FROM (SELECT date_series,
                                             project_id,
                                             SUM(total_minutes / 60),
                                             JSON_AGG(JSON_BUILD_OBJECT('id', tasks_.id,
                                                                        'name', tasks_.name
                                                 )) AS scheduled_tasks
                                      FROM GENERATE_SERIES(
                                               _start_date::DATE,
                                               _end_date::DATE,
                                               '1 day'
                                               ) AS date_series
                                               CROSS JOIN (SELECT id, name, project_id, total_minutes, start_date, end_date
                                                           FROM tasks,
                                                                tasks_assignees
                                                           WHERE task_id = tasks.id
                                                             AND tasks_assignees.team_member_id = project_members.team_member_id) AS tasks_
                                      WHERE (date_series >= tasks_.start_date::DATE AND
                                             date_series <= tasks_.end_date::DATE)
                                        AND tasks_.project_id = projects.id
                                      GROUP BY date_series, project_id) rec) AS tasks,
                               (SELECT name
                                FROM users
                                WHERE users.id =
                                      (SELECT user_id
                                       FROM team_members
                                       WHERE team_members.id = project_members.team_member_id)),
                               (SELECT email
                                FROM email_invitations
                                WHERE project_members.team_member_id = email_invitations.team_member_id) AS invitee_email,
                               (SELECT avatar_url
                                FROM users
                                WHERE users.id =
                                      (SELECT user_id
                                       FROM team_members
                                       WHERE team_members.id = project_members.team_member_id))
                        FROM project_members
                        WHERE project_id = projects.id) rec) AS project_members,
                 (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                  FROM (SELECT date_series,
                               project_id,
                               SUM(total_minutes / 60),
                               JSON_AGG(JSON_BUILD_OBJECT('id', tasks_.id,
                                                          'name', tasks_.name
                                   )) AS scheduled_tasks
                        FROM GENERATE_SERIES(
                                 _start_date::DATE,
                                 _end_date,
                                 '1 day'
                                 ) AS date_series
                                 CROSS JOIN (SELECT id, name, project_id, total_minutes, start_date, end_date
                                             FROM tasks
                                             WHERE tasks.project_id = project_id
                                               AND tasks.id NOT IN (SELECT task_id FROM tasks_assignees)) AS tasks_
                        WHERE (date_series >= tasks_.start_date::DATE AND date_series <= tasks_.end_date::DATE)
                          AND tasks_.project_id = projects.id
                        GROUP BY date_series, project_id) rec) AS unassigned_tasks
          FROM projects
          WHERE team_id = _team_id
            AND id NOT IN (SELECT project_id FROM archived_projects WHERE project_id = projects.id)
          ORDER BY updated_at DESC) rec
    INTO _projects;

    RETURN _projects;
END;
$$;

CREATE OR REPLACE FUNCTION get_reporting_member_current_doing_tasks(_team_member_id uuid, _user_id uuid, _include_archived boolean, _limit numeric, _offset numeric) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _result JSON;

BEGIN
    SELECT ROW_TO_JSON(rec)
    INTO _result
    FROM (SELECT COUNT(*) AS total,
                 (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                  FROM ((SELECT t.id,
                                t.name AS task,
                                p.name AS project,
                                p.id AS project_id,
                                (SELECT name FROM teams WHERE id = p.team_id) AS team_name,
                                (SELECT name
                                 FROM task_statuses
                                 WHERE id = t.status_id) AS status,
                                (SELECT color_code
                                 FROM sys_task_status_categories
                                 WHERE id =
                                       (SELECT category_id FROM task_statuses WHERE id = t.status_id)) AS status_color,
                                t.end_date,
                                t.updated_at AS last_updated
                         FROM tasks t
                                  LEFT JOIN tasks_assignees ta ON t.id = ta.task_id
                                  LEFT JOIN projects p ON t.project_id = p.id
                         WHERE ta.team_member_id = _team_member_id
                           AND p.team_id IN (SELECT team_id
                                             FROM team_members
                                             WHERE user_id = _user_id
                                               AND role_id IN (SELECT id
                                                               FROM roles
                                                               WHERE (admin_role IS TRUE OR owner IS TRUE)))
                           AND CASE
                                   WHEN (_include_archived IS TRUE) THEN team_id IS NOT NULL
                                   ELSE NOT EXISTS(SELECT project_id
                                                   FROM archived_projects
                                                   WHERE project_id = p.id) END
                           AND t.status_id IN
                               (SELECT id
                                FROM task_statuses
                                WHERE category_id IN
                                      (SELECT id FROM sys_task_status_categories WHERE is_done IS FALSE))
                         ORDER BY end_date DESC
                         LIMIT _limit OFFSET _offset)) rec) AS data
          FROM tasks t
                   LEFT JOIN tasks_assignees ta ON t.id = ta.task_id
                   LEFT JOIN projects p ON t.project_id = p.id
          WHERE ta.team_member_id = _team_member_id
            AND p.team_id IN (SELECT team_id
                              FROM team_members
                              WHERE user_id = _user_id
                                AND role_id IN (SELECT id
                                                FROM roles
                                                WHERE (admin_role IS TRUE OR owner IS TRUE)))
            AND CASE
                    WHEN (_include_archived IS TRUE) THEN team_id IS NOT NULL
                    ELSE NOT EXISTS(SELECT project_id
                                    FROM archived_projects
                                    WHERE project_id = p.id) END
            AND t.status_id IN
                (SELECT id
                 FROM task_statuses
                 WHERE category_id IN
                       (SELECT id FROM sys_task_status_categories WHERE is_done IS FALSE))) rec;
    RETURN _result;
END;
$$;

CREATE OR REPLACE FUNCTION get_reporting_member_overdue_tasks(_team_member_id uuid, _user_id uuid, _include_archived boolean, _limit numeric, _offset numeric) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _result JSON;

BEGIN
    SELECT ROW_TO_JSON(rec)
    INTO _result
    FROM (SELECT COUNT(*) AS total,
                 (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                  FROM ((SELECT t.id,
                                t.name AS task,
                                p.name AS project,
                                p.id AS project_id,
                                (SELECT name FROM teams WHERE id = p.team_id) AS team_name,
                                (SELECT name
                                 FROM task_statuses
                                 WHERE id = t.status_id) AS status,
                                (SELECT color_code
                                 FROM sys_task_status_categories
                                 WHERE id =
                                       (SELECT category_id FROM task_statuses WHERE id = t.status_id)) AS status_color,
                                t.end_date,
                                t.updated_at AS last_updated,
                                t.end_date AS due_date
                         FROM tasks t
                                  LEFT JOIN tasks_assignees ta ON t.id = ta.task_id
                                  LEFT JOIN projects p ON t.project_id = p.id
                         WHERE ta.team_member_id = _team_member_id
                           AND p.team_id IN (SELECT team_id
                                             FROM team_members
                                             WHERE user_id = _user_id
                                               AND role_id IN (SELECT id
                                                               FROM roles
                                                               WHERE (admin_role IS TRUE OR owner IS TRUE)))
                           AND CASE
                                   WHEN (_include_archived IS TRUE) THEN team_id IS NOT NULL
                                   ELSE NOT EXISTS(SELECT project_id
                                                   FROM archived_projects
                                                   WHERE project_id = p.id) END
                           AND t.status_id IN
                               (SELECT id
                                FROM task_statuses
                                WHERE category_id IN
                                      (SELECT id FROM sys_task_status_categories WHERE is_done IS FALSE))
                           AND t.end_date::DATE < NOW()::DATE
                         ORDER BY end_date DESC
                         LIMIT _limit OFFSET _offset)) rec) AS data
          FROM tasks t
                   LEFT JOIN tasks_assignees ta ON t.id = ta.task_id
                   LEFT JOIN projects p ON t.project_id = p.id
          WHERE ta.team_member_id = _team_member_id
            AND p.team_id IN (SELECT team_id
                              FROM team_members
                              WHERE user_id = _user_id
                                AND role_id IN (SELECT id
                                                FROM roles
                                                WHERE (admin_role IS TRUE OR owner IS TRUE)))
            AND CASE
                    WHEN (_include_archived IS TRUE) THEN team_id IS NOT NULL
                    ELSE NOT EXISTS(SELECT project_id
                                    FROM archived_projects
                                    WHERE project_id = p.id) END
            AND t.status_id IN
                (SELECT id
                 FROM task_statuses
                 WHERE category_id IN
                       (SELECT id FROM sys_task_status_categories WHERE is_done IS FALSE))
            AND t.end_date::DATE < NOW()::DATE) rec;
    RETURN _result;
END;
$$;

CREATE OR REPLACE FUNCTION get_reporting_member_recently_logged_tasks(_team_member_id uuid, _user_id uuid, _include_archived boolean) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _result JSON;

BEGIN
    SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
    INTO _result
    FROM ((SELECT DISTINCT twl.task_id AS id,
                           t.name,
                           (SELECT SUM(twl.time_spent)) AS logged_time,
                           p.name AS project_name,
                           p.id AS project_id,
                           (SELECT name FROM teams WHERE id = p.team_id) AS team_name,
                           (SELECT name
                            FROM task_statuses
                            WHERE id = (SELECT status_id FROM tasks WHERE id = twl.task_id)) AS status,
                           (SELECT color_code
                            FROM sys_task_status_categories
                            WHERE id =
                                  (SELECT category_id FROM task_statuses WHERE id = t.status_id)) AS status_color,
                           t.end_date::DATE,
                           (SELECT MAX(created_at)
                            FROM task_work_log
                            WHERE task_work_log.task_id = twl.task_id) AS logged_timestamp
           FROM task_work_log twl
                    LEFT JOIN tasks t ON twl.task_id = t.id
                    LEFT JOIN projects p ON t.project_id = p.id
           WHERE user_id = (SELECT user_id FROM team_members WHERE id = _team_member_id)

             -- check if the team is a team that the user is either an admin or owner
             AND p.team_id IN
                 (SELECT team_id
                  FROM team_members
                  WHERE user_id = _user_id
                    AND role_id IN (SELECT id
                                    FROM roles
                                    WHERE (admin_role IS TRUE OR owner IS TRUE)))

             -- check if the include_archived flag is true or false
             AND CASE
                     WHEN (_include_archived IS TRUE) THEN team_id IS NOT NULL
                     ELSE NOT EXISTS(SELECT project_id
                                     FROM archived_projects
                                     WHERE project_id = p.id) END

           GROUP BY task_id, t.name, project_id, t.end_date, p.name, p.team_id, t.status_id, p.id
           ORDER BY (SELECT MAX(created_at) FROM task_work_log WHERE task_work_log.task_id = twl.task_id) DESC
           LIMIT 10)) rec;
    RETURN _result;

END;
$$;

CREATE OR REPLACE FUNCTION get_reporting_members_stats(_team_member_id uuid, _include_archived boolean, _user_id uuid) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _result JSON;
    _teams  UUID[];

BEGIN
    -- SELECT the team_id to select into the _teams variable so the function doesn't have to run it multiple times
    SELECT ARRAY_AGG(team_id)
    INTO _teams
    FROM team_members
    WHERE user_id = _user_id
      AND role_id IN (SELECT id
                      FROM roles
                      WHERE (admin_role IS TRUE OR owner IS TRUE));
    /*
    ##### id IN (SELECT UNNEST(_teams)) #####

    the above piece of query is added to all the queries below to ensure that the statistics that are shown are related
    to the teams that the user is either an admin or owner of the team
    */

    SELECT COALESCE(ROW_TO_JSON(rec), '[]'::JSON)
    INTO _result
    FROM ((SELECT (SELECT name FROM team_member_info_view WHERE team_member_id = _team_member_id),

                  -- get total teams that the user is added to
                  (SELECT COUNT(*)
                   FROM teams
                   WHERE id IN (SELECT team_id
                                FROM team_members
                                WHERE team_members.user_id =
                                      (SELECT user_id
                                       FROM team_members
                                       WHERE id = _team_member_id))
                     AND id IN (SELECT UNNEST(_teams))) AS total_teams,

                  -- select total projects the user is added to
                  (SELECT COUNT(*)
                   FROM project_members
                            LEFT JOIN projects p ON project_members.project_id = p.id
                   WHERE team_member_id IN (SELECT id
                                            FROM team_members
                                            WHERE user_id =
                                                  (SELECT user_id FROM team_members WHERE id = _team_member_id))

                     -- check if the team is a team that the user is either an admin or owner
                     AND p.team_id IN (SELECT UNNEST(_teams))
                     AND p.team_id IN (SELECT team_id
                                       FROM projects
                                       WHERE id IN (SELECT project_id
                                                    FROM tasks
                                                    WHERE id IN (SELECT task_id
                                                                 FROM tasks_assignees
                                                                 WHERE tasks.id = tasks_assignees.task_id
                                                                   AND team_member_id IN
                                                                       (SELECT id
                                                                        FROM team_members
                                                                        WHERE user_id = (SELECT user_id
                                                                                         FROM team_members
                                                                                         WHERE id = _team_member_id)))))
                     AND CASE
                             WHEN (_include_archived IS TRUE) THEN project_members.project_id IS NOT NULL
                             ELSE NOT EXISTS(SELECT project_id
                                             FROM archived_projects
                                             WHERE project_id = project_members.project_id) END) AS project_members,

                  -- select the total number of seconds estimated for the tasks that the user is assigned to
                  (SELECT SUM(total_minutes * 60)
                   FROM tasks
                            LEFT JOIN projects p ON tasks.project_id = p.id
                   WHERE EXISTS(SELECT 1
                                FROM tasks_assignees
                                WHERE tasks.id = tasks_assignees.task_id
                                  AND team_member_id IN
                                      (SELECT id
                                       FROM team_members
                                       WHERE user_id = _user_id))

                     -- check if the team is a team that the user is either an admin or owner
                     AND p.team_id IN (SELECT UNNEST(_teams))
                     AND CASE
                             WHEN (_include_archived IS TRUE) THEN tasks.project_id IS NOT NULL
                             ELSE NOT EXISTS(SELECT project_id
                                             FROM archived_projects
                                             WHERE project_id = tasks.project_id) END) AS total_estimated,

                  -- select the total logged time for the tasks that the user is assigned to
                  (SELECT SUM(time_spent)
                   FROM tasks
                            LEFT JOIN task_work_log twl ON tasks.id = twl.task_id
                            LEFT JOIN projects p ON tasks.project_id = p.id
                   WHERE EXISTS(SELECT 1
                                FROM tasks_assignees
                                WHERE tasks.id = tasks_assignees.task_id
                                  AND team_member_id IN
                                      (SELECT id
                                       FROM team_members
                                       WHERE user_id = _user_id))

                     -- check if the team is a team that the user is either an admin or owner
                     AND p.team_id IN (SELECT UNNEST(_teams))

                     AND CASE
                             WHEN (_include_archived IS TRUE) THEN tasks.project_id IS NOT NULL
                             ELSE NOT EXISTS(SELECT project_id
                                             FROM archived_projects
                                             WHERE project_id = tasks.project_id) END) AS total_logged,

                  -- select the total tasks that the user is assigned to
                  (SELECT COUNT(*)
                   FROM tasks
                            LEFT JOIN projects p ON tasks.project_id = p.id
                   WHERE EXISTS(SELECT 1
                                FROM tasks_assignees
                                WHERE tasks.id = tasks_assignees.task_id
                                  AND team_member_id IN
                                      (SELECT id
                                       FROM team_members
                                       WHERE user_id = _user_id))

                     -- check if the team is a team that the user is either an admin or owner
                     AND p.team_id IN (SELECT UNNEST(_teams))

                     AND CASE
                             WHEN (_include_archived IS TRUE) THEN tasks.project_id IS NOT NULL
                             ELSE NOT EXISTS(SELECT project_id
                                             FROM archived_projects
                                             WHERE project_id = tasks.project_id) END) AS total_tasks,

                  -- select the total tasks that the user has completed
                  (SELECT COUNT(*)
                   FROM tasks
                            LEFT JOIN projects p ON tasks.project_id = p.id

                   WHERE EXISTS(SELECT 1
                                FROM tasks_assignees
                                WHERE tasks.id = tasks_assignees.task_id
                                  AND team_member_id IN
                                      (SELECT id
                                       FROM team_members
                                       WHERE user_id = _user_id))

                     -- check if the team is a team that the user is either an admin or owner
                     AND p.team_id IN (SELECT UNNEST(_teams))

                     AND tasks.status_id IN
                         (SELECT id
                          FROM task_statuses
                          WHERE category_id IN
                                (SELECT id FROM sys_task_status_categories WHERE is_done IS TRUE))
                     AND CASE
                             WHEN (_include_archived IS TRUE) THEN tasks.project_id IS NOT NULL
                             ELSE NOT EXISTS(SELECT project_id
                                             FROM archived_projects
                                             WHERE project_id = tasks.project_id) END) AS total_tasks_completed,

                  -- select the total tasks that are overdue
                  (SELECT COUNT(*)
                   FROM tasks
                            LEFT JOIN projects p ON tasks.project_id = p.id

                   WHERE EXISTS(SELECT 1
                                FROM tasks_assignees
                                WHERE tasks.id = tasks_assignees.task_id
                                  AND team_member_id IN
                                      (SELECT id
                                       FROM team_members
                                       WHERE user_id = _user_id))

                     -- check if the team is a team that the user is either an admin or owner
                     AND p.team_id IN (SELECT UNNEST(_teams))

                     AND tasks.end_date::DATE < NOW()::DATE
                     AND tasks.status_id IN
                         (SELECT id
                          FROM task_statuses
                          WHERE category_id IN
                                (SELECT id FROM sys_task_status_categories WHERE is_done IS FALSE))
                     AND CASE
                             WHEN (_include_archived IS TRUE) THEN tasks.project_id IS NOT NULL
                             ELSE NOT EXISTS(SELECT project_id
                                             FROM archived_projects
                                             WHERE project_id = tasks.project_id) END) AS overdue_tasks)) rec;
    RETURN _result;

END;
$$;

CREATE OR REPLACE FUNCTION get_reporting_overview_stats(_user_id uuid, _include_archived boolean) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _result JSON;

BEGIN
    SELECT COALESCE(ROW_TO_JSON(rec), '[]'::JSON)
    INTO _result
    FROM ((SELECT (SELECT COUNT(*)
                   FROM team_members
                   WHERE user_id = _user_id
                     AND role_id IN (SELECT id
                                     FROM roles
                                     WHERE (admin_role IS TRUE OR owner IS TRUE))) AS total_teams,
                  (SELECT COUNT(*)
                   FROM projects
                   WHERE team_id IN
                         (SELECT team_id
                          FROM team_members
                          WHERE user_id = _user_id
                            AND role_id IN (SELECT id
                                            FROM roles
                                            WHERE (admin_role IS TRUE OR owner IS TRUE)))
                     AND CASE
                             WHEN (_include_archived IS TRUE) THEN team_id IS NOT NULL
                             ELSE NOT EXISTS(SELECT project_id
                                             FROM archived_projects
                                             WHERE project_id = projects.id) END) AS total_projects,
                  (SELECT COUNT(*)
                   FROM projects
                   WHERE team_id IN
                         (SELECT team_id
                          FROM team_members
                          WHERE user_id = _user_id
                            AND role_id IN (SELECT id
                                            FROM roles
                                            WHERE (admin_role IS TRUE OR owner IS TRUE)))
                     AND CASE
                             WHEN (_include_archived IS TRUE) THEN team_id IS NOT NULL
                             ELSE NOT EXISTS(SELECT project_id
                                             FROM archived_projects
                                             WHERE project_id = projects.id) END
                     AND status_id IN (SELECT ID
                                       FROM sys_project_statuses
                                       WHERE sys_project_statuses.name NOT IN ('Completed', 'Cancelled'))) AS active_projects,
                  (SELECT COUNT(*)
                   FROM (SELECT DISTINCT user_id
                         FROM team_members tm
                                  LEFT JOIN email_invitations ei ON tm.id = ei.team_member_id
                         WHERE tm.team_id IN (SELECT team_id
                                              FROM team_members
                                              WHERE user_id = _user_id
                                                AND role_id IN (SELECT id
                                                                FROM roles
                                                                WHERE (admin_role IS TRUE OR owner IS TRUE)))) AS members) AS total_members,
                  (SELECT COUNT(*)
                   FROM (SELECT DISTINCT user_id
                         FROM team_members tm
                                  LEFT JOIN email_invitations ei ON tm.id = ei.team_member_id
                         WHERE tm.team_id IN (SELECT team_id
                                              FROM team_members
                                              WHERE user_id = _user_id
                                                AND role_id IN (SELECT id
                                                                FROM roles
                                                                WHERE (admin_role IS TRUE OR owner IS TRUE)))
                           AND team_member_id NOT IN
                               (SELECT team_member_id
                                FROM project_members pm
                                WHERE pm.project_id IN
                                      (SELECT id FROM projects WHERE projects.team_id = tm.team_id))) AS members) AS unassigned_members,
                  (SELECT COUNT(*)
                   FROM (SELECT DISTINCT user_id
                         FROM team_members tm
                                  LEFT JOIN email_invitations ei ON tm.id = ei.team_member_id
                         WHERE tm.team_id IN (SELECT team_id
                                              FROM team_members
                                              WHERE user_id = _user_id
                                                AND role_id IN (SELECT id
                                                                FROM roles
                                                                WHERE (admin_role IS TRUE OR owner IS TRUE)))
                           AND tm.id IN (SELECT ta.team_member_id
                                         FROM tasks_assignees ta
                                                  LEFT JOIN tasks t
                                                            ON t.id = ta.task_id AND t.end_date::DATE < NOW()::DATE AND
                                                               t.status_id IN
                                                               (SELECT id
                                                                FROM task_statuses
                                                                WHERE category_id NOT IN
                                                                      (SELECT id FROM sys_task_status_categories WHERE is_done IS FALSE)))) AS members) AS overdue_task_members,
                  (SELECT COUNT(*)
                   FROM projects
                   WHERE team_id IN
                         (SELECT team_id
                          FROM team_members
                          WHERE user_id = _user_id
                            AND role_id IN (SELECT id
                                            FROM roles
                                            WHERE (admin_role IS TRUE OR owner IS TRUE)))
                     AND end_date::DATE < NOW()::DATE
                     AND CASE
                             WHEN (_include_archived IS TRUE) THEN team_id IS NOT NULL
                             ELSE NOT EXISTS(SELECT project_id
                                             FROM archived_projects
                                             WHERE project_id = projects.id) END) AS overdue_projects)) rec;
    RETURN _result;

END;
$$;

CREATE OR REPLACE FUNCTION get_reporting_projects_stats(_user_id uuid, _include_archived boolean) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _result JSON;
    _teams  UUID[];

BEGIN
    -- SELECT the team_id to select into the _teams variable so the function doesn't have to run it multiple times
    SELECT ARRAY_AGG(team_id)
    INTO _teams
    FROM team_members
    WHERE user_id = _user_id
      AND role_id IN (SELECT id
                      FROM roles
                      WHERE (admin_role IS TRUE OR owner IS TRUE));

    SELECT COALESCE(ROW_TO_JSON(rec), '[]'::JSON)
    INTO _result
    FROM ((SELECT (SELECT COUNT(*)
                   FROM projects
                   WHERE team_id IN (SELECT UNNEST(_teams))
                     AND CASE
                             WHEN (_include_archived IS TRUE) THEN team_id IS NOT NULL
                             ELSE NOT EXISTS(SELECT project_id
                                             FROM archived_projects
                                             WHERE project_id = projects.id) END
                     AND status_id IN (SELECT ID
                                       FROM sys_project_statuses
                                       WHERE sys_project_statuses.name NOT IN ('Completed', 'Cancelled'))) AS active_projects,
                  (SELECT COUNT(*)
                   FROM projects
                   WHERE team_id IN (SELECT UNNEST(_teams))
                     AND end_date::DATE < NOW()::DATE
                     AND CASE
                             WHEN (_include_archived IS TRUE) THEN team_id IS NOT NULL
                             ELSE NOT EXISTS(SELECT project_id
                                             FROM archived_projects
                                             WHERE project_id = projects.id) END) AS overdue_projects,
                  (SELECT SUM(time_spent)
                   FROM task_work_log
                   WHERE task_id IN (SELECT id
                                     FROM tasks
                                     WHERE project_id IN (SELECT id
                                                          FROM projects
                                                          WHERE team_id IN (SELECT UNNEST(_teams))
                                                            AND CASE
                                                                    WHEN (_include_archived IS TRUE)
                                                                        THEN team_id IS NOT NULL
                                                                    ELSE NOT EXISTS(SELECT project_id
                                                                                    FROM archived_projects
                                                                                    WHERE project_id = projects.id
                                                                                      AND user_id = _user_id) END)))::INT AS total_logged,
                  (SELECT SUM(total_minutes * 60)
                   FROM tasks
                   WHERE project_id IN (SELECT id
                                        FROM projects
                                        WHERE team_id IN (SELECT UNNEST(_teams))
                                          AND CASE
                                                  WHEN (TRUE IS TRUE) THEN team_id IS NOT NULL
                                                  ELSE NOT EXISTS(SELECT project_id
                                                                  FROM archived_projects
                                                                  WHERE project_id = projects.id
                                                                    AND user_id = _user_id) END))::INT AS total_estimated,
                  (SELECT COUNT(*)
                   FROM tasks
                   WHERE archived IS FALSE
                     AND project_id IN (SELECT id
                                        FROM projects
                                        WHERE team_id IN (SELECT UNNEST(_teams))
                                          AND CASE
                                                  WHEN (TRUE IS TRUE) THEN team_id IS NOT NULL
                                                  ELSE NOT EXISTS(SELECT project_id
                                                                  FROM archived_projects
                                                                  WHERE project_id = projects.id
                                                                    AND user_id = _user_id) END))::INT AS all_tasks_count,
                  (SELECT COUNT(*)
                   FROM tasks
                   WHERE archived IS FALSE
                     AND project_id IN (SELECT id
                                        FROM projects
                                        WHERE team_id IN (SELECT UNNEST(_teams))
                                          AND CASE
                                                  WHEN (TRUE IS TRUE) THEN team_id IS NOT NULL
                                                  ELSE NOT EXISTS(SELECT project_id
                                                                  FROM archived_projects
                                                                  WHERE project_id = projects.id
                                                                    AND user_id = _user_id) END)
                     AND status_id IN (SELECT id
                                       FROM task_statuses
                                       WHERE project_id = tasks.project_id
                                         AND category_id IN
                                             (SELECT id FROM sys_task_status_categories WHERE is_done IS TRUE)))::INT AS completed_tasks_count)) rec;
    RETURN _result;

END;
$$;

CREATE OR REPLACE FUNCTION get_resource_gantt_tasks(_user_id uuid) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _tasks   JSON;
    _team_id UUID;
BEGIN

    SELECT active_team FROM users WHERE id = _user_id::UUID INTO _team_id;

    SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
    INTO _tasks
    FROM (SELECT projects.id,
                 projects.name,
                 0 AS level,
                 FALSE AS collapsed,
                 (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                  FROM (SELECT pm.id,
                               pm.team_member_id,
                               pm.project_access_level_id,
                               FALSE AS overdue,
                               (SELECT name
                                FROM job_titles
                                WHERE job_titles.id = tm.job_title_id) AS job_title,
                               (SELECT name
                                FROM team_member_info_view
                                WHERE team_member_info_view.team_member_id = tm.id),
                               u.avatar_url,
                               (SELECT name
                                FROM project_access_levels
                                WHERE project_access_levels.id = pm.project_access_level_id) AS access_level,
                               (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                                FROM (SELECT t.id,
                                             t.id AS task_id,
                                             t.name,
                                             t.start_date AS start,
                                             t.project_id,
                                             t.priority_id,
                                             t.done,
                                             t.end_date AS "end",
                                             0 AS progress,
                                             2 AS level,
                                             TRUE AS "showOnGraph",
                                             t.status_id,
                                             (SELECT name FROM task_statuses WHERE id = t.status_id) AS status,
                                             (SELECT color_code
                                              FROM projects
                                              WHERE projects.id = t.project_id) AS color_code,
                                             (SELECT ARRAY_AGG(ROW_TO_JSON(rec))
                                              FROM (SELECT project_member_id AS id,
                                                           (SELECT name
                                                            FROM team_member_info_view
                                                            WHERE team_member_info_view.team_member_id = tm.id)
                                                    FROM tasks_assignees
                                                             INNER JOIN project_members pm ON pm.id = tasks_assignees.project_member_id
                                                             INNER JOIN team_members tm2 ON pm.team_member_id = tm2.id
                                                             LEFT JOIN users u2 ON tm2.user_id = u2.id
                                                    WHERE project_id = t.project_id
                                                      AND project_member_id = pm.id
                                                      AND t.id = tasks_assignees.task_id
                                                    ORDER BY name) rec) AS assignees
                                      FROM tasks_assignees ta,
                                           tasks t
                                      WHERE t.archived IS FALSE
                                        AND ta.project_member_id = pm.id
                                        AND t.id = ta.task_id
                                      ORDER BY start_date) rec) AS tasks
                        FROM project_members pm
                                 INNER JOIN team_members tm ON pm.team_member_id = tm.id
                                 LEFT JOIN users u ON tm.user_id = u.id
                        WHERE project_id = projects.id) rec) AS team_members
          FROM projects
          WHERE team_id = _team_id
            AND (CASE
                     WHEN (is_owner(_user_id, _team_id) OR is_admin(_user_id, _team_id)) THEN TRUE
                     ELSE is_member_of_project(projects.id, _user_id, _team_id) END)
          ORDER BY NAME) rec;

    RETURN _tasks;
END;
$$;

CREATE OR REPLACE FUNCTION get_selected_tasks(_id uuid) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _tasks JSON;
BEGIN
    SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
    INTO _tasks
    FROM (SELECT t.id,
                 t.name,
                 t.start_date AS start,
                 t.end_date AS "end",
                 t.project_id,
                 (SELECT name FROM task_priorities WHERE task_priorities.id = t.priority_id) AS priority,
                 t.priority_id,
                 t.done,
                 t.created_at,
                 t.status_id,
                 (SELECT ARRAY_AGG(ROW_TO_JSON(rec))
                  FROM (SELECT project_member_id AS id,
                               u2.name AS name,
                               (SELECT avatar_url FROM users WHERE id = tm2.user_id),
                               COALESCE((u2.email), (SELECT email
                                                     FROM email_invitations
                                                     WHERE email_invitations.team_member_id = tm2.id)) AS email
                        FROM tasks_assignees
                                 INNER JOIN project_members pm ON pm.id = tasks_assignees.project_member_id
                                 INNER JOIN team_members tm2 ON pm.team_member_id = tm2.id
                                 LEFT JOIN users u2 ON tm2.user_id = u2.id
                        WHERE project_id = _id::UUID
                          AND project_member_id = pm.id
                          AND t.id = tasks_assignees.task_id
                        ORDER BY name) rec) AS assignees
          FROM tasks t
          WHERE archived IS FALSE
            AND project_id = _id::UUID
            AND (t.start_date IS NOT NULL
              OR t.end_date IS NOT NULL
              OR t.id IN (SELECT task_id FROM tasks_assignees))) rec;

    RETURN _tasks;
END;
$$;

CREATE OR REPLACE FUNCTION get_single_pt_task(_id uuid) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _result JSON;
BEGIN
    SELECT ROW_TO_JSON(rec)
    INTO _result
    FROM (SELECT id,
                 name,
                 cpt_tasks.template_id AS template_id,
                 cpt_tasks.parent_task_id,
                 cpt_tasks.parent_task_id IS NOT NULL AS is_sub_task,
                 (SELECT name FROM cpt_tasks WHERE id = cpt_tasks.parent_task_id) AS parent_task_name,
                 (SELECT COUNT('*')
                  FROM cpt_tasks
                  WHERE parent_task_id = cpt_tasks.id) AS sub_tasks_count,
                 cpt_tasks.status_id AS status,
                 (SELECT name FROM cpt_task_statuses WHERE id = cpt_tasks.status_id) AS status_name,
                 (SELECT color_code
                  FROM sys_task_status_categories
                  WHERE id = (SELECT category_id FROM cpt_task_statuses  WHERE id = cpt_tasks.status_id)) AS status_color,
                 (SELECT COALESCE(ROW_TO_JSON(r), '{}'::JSON)
                 FROM (SELECT is_done, is_doing, is_todo
                    FROM sys_task_status_categories
                    WHERE id = (SELECT category_id FROM cpt_task_statuses WHERE id = cpt_tasks.status_id)) r) AS status_category,
                 (SELECT name
                  FROM cpt_phases
                  WHERE id = (SELECT phase_id FROM cpt_task_phases WHERE task_id = cpt_tasks.id)) AS phase_name,
                 (SELECT phase_id FROM cpt_task_phases WHERE task_id = cpt_tasks.id) AS phase_id,
                 (SELECT ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(r)))
                  FROM (SELECT cpt_task_labels.label_id AS id,
                               (SELECT name FROM team_labels WHERE id = cpt_task_labels.label_id) AS name,
                               (SELECT color_code FROM team_labels WHERE id = cpt_task_labels.label_id)
                        FROM cpt_task_labels
                        WHERE task_id = cpt_tasks.id
                        ORDER BY name) r) AS labels,
                 (SELECT id FROM task_priorities WHERE id = cpt_tasks.priority_id) AS priority,
                 (SELECT name FROM task_priorities WHERE id = cpt_tasks.priority_id) AS priority_name,
                 (SELECT value FROM task_priorities WHERE id = cpt_tasks.priority_id) AS priority_value,
                 total_minutes,
                 sort_order,
                 (SELECT ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(r)))
                  FROM (SELECT cpt_task_statuses.id AS id,
                               cpt_task_statuses.name AS name,
                               (SELECT color_code
                                FROM sys_task_status_categories
                                WHERE id = cpt_task_statuses.category_id)
                        FROM cpt_task_statuses
                        WHERE cpt_task_statuses.template_id = cpt_tasks.template_id) r) AS template_statuses
          FROM cpt_tasks
          WHERE id = _id) rec;
    RETURN _result;
END
$$;

CREATE OR REPLACE FUNCTION get_single_task(_id uuid) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _result JSON;
BEGIN

    SELECT ROW_TO_JSON(rec)
    INTO _result
    FROM (SELECT id,
                 name,
                 (SELECT name FROM projects WHERE project_id = projects.id) AS project_name,
                 CONCAT((SELECT key FROM projects WHERE id = project_id), '-', task_no) AS task_key,
                 tasks.project_id AS project_id,
                 tasks.parent_task_id,
                 tasks.parent_task_id IS NOT NULL AS is_sub_task,
                 (SELECT name FROM tasks WHERE id = tasks.parent_task_id) AS parent_task_name,
                 (SELECT COUNT('*')
                  FROM tasks
                  WHERE parent_task_id = tasks.id
                    AND archived IS FALSE) AS sub_tasks_count,

                 tasks.status_id AS status,
                 tasks.archived,

                 (SELECT name FROM task_statuses WHERE id = tasks.status_id) AS status_name,
                 (SELECT name FROM task_priorities WHERE id = tasks.priority_id) AS priority_name,

                 (SELECT color_code
                  FROM sys_task_status_categories
                  WHERE id = (SELECT category_id FROM task_statuses WHERE id = tasks.status_id)) AS status_color,

                 (SELECT color_code_dark
                  FROM sys_task_status_categories
                  WHERE id = (SELECT category_id FROM task_statuses WHERE id = tasks.status_id)) AS status_color_dark,

                 (SELECT get_task_assignees(tasks.id)) AS assignees,

                 (SELECT name
                  FROM project_phases
                  WHERE id = (SELECT phase_id FROM task_phase WHERE task_id = tasks.id)) AS phase_name,
                 (SELECT color_code
                  FROM project_phases
                  WHERE id = (SELECT phase_id FROM task_phase WHERE task_id = tasks.id)) AS phase_color_code,
                 (SELECT phase_id FROM task_phase WHERE task_id = tasks.id) AS phase_id,

                 (SELECT COALESCE(ROW_TO_JSON(r), '{}'::JSON)
                  FROM (SELECT is_done, is_doing, is_todo
                        FROM sys_task_status_categories
                        WHERE id = (SELECT category_id FROM task_statuses WHERE id = tasks.status_id)) r) AS status_category,

                 (SELECT ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(r)))
                  FROM (SELECT task_labels.label_id AS id,
                               (SELECT name FROM team_labels WHERE id = task_labels.label_id) AS name,
                               (SELECT color_code FROM team_labels WHERE id = task_labels.label_id)
                        FROM task_labels
                        WHERE task_id = tasks.id
                        ORDER BY name) r) AS labels,

                 (SELECT name FROM users WHERE id = reporter_id) AS reporter,
                 (SELECT id FROM task_priorities WHERE id = tasks.priority_id) AS priority,
                 (SELECT value FROM task_priorities WHERE id = tasks.priority_id) AS priority_value,
                 total_minutes,
                 (SELECT SUM(time_spent) FROM task_work_log WHERE task_id = tasks.id) AS total_minutes_spent,
                 start_date,
                 end_date,
                 sort_order,
                 (SELECT color_code FROM projects WHERE projects.id = tasks.project_id) AS project_color,
                 (SELECT ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(r)))
                  FROM (SELECT task_statuses.id AS id,
                               task_statuses.name AS name,
                               (SELECT color_code
                                FROM sys_task_status_categories
                                WHERE id = task_statuses.category_id)
                        FROM task_statuses
                        WHERE task_statuses.project_id = tasks.project_id) r) AS project_statuses
          FROM tasks
          WHERE id = _id) rec;

    RETURN _result;
END
$$;

CREATE OR REPLACE FUNCTION get_task_assignees(_task_id uuid) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _output JSON;
BEGIN
    SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
    FROM (SELECT team_member_id,
                 project_member_id,
                 COALESCE((SELECT name FROM team_member_info_view WHERE team_member_info_view.team_member_id = tm.id), '') as name,
                 COALESCE((SELECT email_notifications_enabled
                  FROM notification_settings
                  WHERE team_id = tm.team_id
                    AND notification_settings.user_id = u.id), false) AS email_notifications_enabled,
                 COALESCE(u.avatar_url, '') as avatar_url,
                 u.id AS user_id,
                 COALESCE(u.email, '') as email,
                 COALESCE(u.socket_id, '') as socket_id,
                 tm.team_id AS team_id
          FROM tasks_assignees
                   INNER JOIN team_members tm ON tm.id = tasks_assignees.team_member_id
                   LEFT JOIN users u ON tm.user_id = u.id
          WHERE task_id = _task_id) rec
    INTO _output;

    RETURN _output;
END;
$$;

CREATE OR REPLACE FUNCTION get_task_complete_info(_task_id uuid, _status_id uuid) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _color_code      TEXT;
    _color_code_dark TEXT;
    _members         JSON;
BEGIN
    SELECT color_code
    FROM sys_task_status_categories
    WHERE id = (SELECT category_id FROM task_statuses WHERE id = _status_id)
    INTO _color_code;

    SELECT color_code_dark
    FROM sys_task_status_categories
    WHERE id = (SELECT category_id FROM task_statuses WHERE id = _status_id)
    INTO _color_code_dark;

    SELECT get_task_assignees(_task_id) INTO _members;

    RETURN JSON_BUILD_OBJECT(
            'color_code', _color_code,
            'color_code_dark', _color_code_dark,
            'members', _members
           );
END;
$$;

CREATE OR REPLACE FUNCTION get_task_complete_ratio(_task_id uuid) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _parent_task_done FLOAT = 0;
    _sub_tasks_done   FLOAT = 0;
    _sub_tasks_count  FLOAT = 0;
    _total_completed  FLOAT = 0;
    _total_tasks      FLOAT = 0;
    _ratio            FLOAT = 0;
BEGIN
    SELECT (CASE
                WHEN EXISTS(SELECT 1
                            FROM tasks_with_status_view
                            WHERE tasks_with_status_view.task_id = _task_id
                              AND is_done IS TRUE) THEN 1
                ELSE 0 END)
    INTO _parent_task_done;
    SELECT COUNT(*) FROM tasks WHERE parent_task_id = _task_id AND archived IS FALSE INTO _sub_tasks_count;

    SELECT COUNT(*)
    FROM tasks_with_status_view
    WHERE parent_task_id = _task_id
      AND is_done IS TRUE
    INTO _sub_tasks_done;

    _total_completed = _parent_task_done + _sub_tasks_done;
--     _total_tasks = _sub_tasks_count + 1; -- +1 for the parent task
    _total_tasks = _sub_tasks_count; -- +1 for the parent task
    _ratio = (_total_completed / _total_tasks) * 100;

    RETURN JSON_BUILD_OBJECT(
        'ratio', _ratio,
        'total_completed', _total_completed,
        'total_tasks', _total_tasks
        );
END
$$;

CREATE OR REPLACE FUNCTION get_task_form_view_model(_user_id uuid, _team_id uuid, _task_id uuid, _project_id uuid) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _task         JSON;
    _priorities   JSON;
    _projects     JSON;
    _statuses     JSON;
    _team_members JSON;
    _assignees    JSON;
    _phases       JSON;
BEGIN

    -- Select task info
    SELECT COALESCE(ROW_TO_JSON(rec), '{}'::JSON)
    INTO _task
    FROM (SELECT id,
                 name,
                 description,
                 start_date,
                 end_date,
                 done,
                 total_minutes,
                 priority_id,
                 project_id,
                 created_at,
                 updated_at,
                 status_id,
                 parent_task_id,
                 sort_order,
                 (SELECT phase_id FROM task_phase WHERE task_id = tasks.id) AS phase_id,
                 CONCAT((SELECT key FROM projects WHERE id = tasks.project_id), '-', task_no) AS task_key,
                 (SELECT start_time
                  FROM task_timers
                  WHERE task_id = tasks.id
                    AND user_id = _user_id) AS timer_start_time,
                 parent_task_id IS NOT NULL AS is_sub_task,
                 (SELECT COUNT('*')
                  FROM tasks
                  WHERE parent_task_id = tasks.id
                    AND archived IS FALSE) AS sub_tasks_count,
                 (SELECT COUNT(*)
                  FROM tasks_with_status_view tt
                  WHERE (tt.parent_task_id = tasks.id OR tt.task_id = tasks.id)
                    AND tt.is_done IS TRUE)
                     AS completed_count,
                 (SELECT COUNT(*) FROM task_attachments WHERE task_id = tasks.id) AS attachments_count,
                 (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(r))), '[]'::JSON)
                  FROM (SELECT task_labels.label_id AS id,
                               (SELECT name FROM team_labels WHERE id = task_labels.label_id),
                               (SELECT color_code FROM team_labels WHERE id = task_labels.label_id)
                        FROM task_labels
                        WHERE task_id = tasks.id
                        ORDER BY name) r) AS labels,
                 (SELECT color_code
                  FROM sys_task_status_categories
                  WHERE id = (SELECT category_id FROM task_statuses WHERE id = tasks.status_id)) AS status_color,
                 (SELECT color_code_dark
                  FROM sys_task_status_categories
                  WHERE id = (SELECT category_id FROM task_statuses WHERE id = tasks.status_id)) AS status_color_dark,
                 (SELECT COUNT(*) FROM tasks WHERE parent_task_id = _task_id) AS sub_tasks_count,
                 (SELECT name FROM users WHERE id = tasks.reporter_id) AS reporter,
                 (SELECT get_task_assignees(tasks.id)) AS assignees,
                 (SELECT id FROM team_members WHERE user_id = _user_id AND team_id = _team_id) AS team_member_id,
                 billable,
                 schedule_id
          FROM tasks
          WHERE id = _task_id) rec;

    SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
    INTO _priorities
    FROM (SELECT id, name FROM task_priorities ORDER BY value) rec;

    SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
    INTO _phases
    FROM (SELECT id, name FROM project_phases WHERE project_id = _project_id ORDER BY name) rec;

    SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
    INTO _projects
    FROM (SELECT id, name
          FROM projects
          WHERE team_id = _team_id
            AND (CASE
                     WHEN (is_owner(_user_id, _team_id) OR is_admin(_user_id, _team_id) IS TRUE) THEN TRUE
                     ELSE is_member_of_project(projects.id, _user_id, _team_id) END)
          ORDER BY name) rec;

    SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
    INTO _statuses
    FROM (SELECT id, name FROM task_statuses WHERE project_id = _project_id) rec;

    SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
    INTO _team_members
    FROM (SELECT team_members.id,
                 (SELECT name FROM team_member_info_view WHERE team_member_info_view.team_member_id = team_members.id),
                 (SELECT email FROM team_member_info_view WHERE team_member_info_view.team_member_id = team_members.id),
                 (SELECT avatar_url
                  FROM team_member_info_view
                  WHERE team_member_info_view.team_member_id = team_members.id)
          FROM team_members
                   LEFT JOIN users u ON team_members.user_id = u.id
          WHERE team_id = _team_id AND team_members.active IS TRUE) rec;

    SELECT get_task_assignees(_task_id) INTO _assignees;

    RETURN JSON_BUILD_OBJECT(
        'task', _task,
        'priorities', _priorities,
        'projects', _projects,
        'statuses', _statuses,
        'team_members', _team_members,
        'assignees', _assignees,
        'phases', _phases
        );
END;
$$;

CREATE OR REPLACE FUNCTION get_task_updates() RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _result JSON;
BEGIN
    SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
    INTO _result
    FROM (SELECT name,
                 email,
                 (SELECT id
                  FROM team_members
                  WHERE team_id = users.active_team
                    AND user_id = users.id) AS team_member_id,
                 (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(r))), '[]'::JSON) AS teams
                  FROM (SELECT id,
                               name,
                               (SELECT team_member_id
                                FROM team_member_info_view
                                WHERE team_id = teams.id
                                  AND user_id = users.id) AS team_member_id,
                               (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(r))), '[]'::JSON) AS projects
                                FROM (SELECT id,
                                             name,
                                             (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(r))), '[]'::JSON) AS tasks
                                              FROM (SELECT t.id,
                                                           t.name AS name,
                                                           (SELECT name FROM users WHERE id = task_updates.reporter_id) AS updater_name,
                                                           (SELECT STRING_AGG(DISTINCT
                                                                              (SELECT name
                                                                               FROM team_member_info_view
                                                                               WHERE team_member_id = tasks_assignees.team_member_id),
                                                                              ', ')
                                                            FROM tasks_assignees
                                                            WHERE task_id = task_updates.task_id) AS members
                                                    FROM task_updates
                                                             INNER JOIN tasks t ON task_updates.task_id = t.id
                                                    WHERE task_updates.user_id = users.id
                                                      AND task_updates.project_id = projects.id
                                                      AND task_updates.type = 'ASSIGN'
                                                      AND is_sent IS FALSE
                                                    ORDER BY task_updates.created_at) r)
                                      FROM projects
                                      WHERE team_id = teams.id
                                        AND EXISTS(SELECT 1
                                                   FROM task_updates
                                                   WHERE project_id = projects.id
                                                     AND type = 'ASSIGN'
                                                     AND is_sent IS FALSE)) r)
                        FROM teams
                        WHERE EXISTS(SELECT 1 FROM team_members WHERE team_id = teams.id AND user_id = users.id)
                          AND (SELECT email_notifications_enabled
                               FROM notification_settings
                               WHERE team_id = teams.id
                                 AND user_id = users.id) IS TRUE) r)
          FROM users
          WHERE EXISTS(SELECT 1 FROM task_updates WHERE user_id = users.id)) rec;

    UPDATE task_updates SET is_sent = TRUE;

    RETURN _result;
END
$$;

CREATE OR REPLACE FUNCTION get_tasks_by_project_member(_project_id uuid, _team_member_id uuid, _archived boolean) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _result JSON;
BEGIN
    SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(r))), '[]'::JSON)
    INTO _result
    FROM (SELECT id,
                 name,
                 status_id,
                 (SELECT name FROM task_statuses WHERE status_id = task_statuses.id) AS status,
                 start_date,
                 end_date,
                 completed_at,
                 total_minutes,
                 (SELECT color_code
                  FROM sys_task_status_categories
                  WHERE id = (SELECT category_id FROM task_statuses WHERE id = status_id)) AS status_color,
                 CASE
                     WHEN CURRENT_DATE::DATE > end_date::DATE
                         AND status_id NOT IN (SELECT id
                                               FROM task_statuses
                                               WHERE project_id = _project_id
                                                 AND category_id IN
                                                     (SELECT id
                                                      FROM sys_task_status_categories
                                                      WHERE sys_task_status_categories.is_done IS FALSE))
                         THEN FALSE
                     ELSE
                         CASE
                             WHEN CURRENT_DATE::DATE > end_date::DATE
                                 THEN TRUE
                             ELSE FALSE
                             END END AS is_overdue,
                 CASE
                     WHEN status_id
                         NOT IN (SELECT id
                                 FROM task_statuses
                                 WHERE project_id = _project_id
                                   AND category_id IN
                                       (SELECT id
                                        FROM sys_task_status_categories
                                        WHERE sys_task_status_categories.is_done IS FALSE))
                         THEN 0
                     ELSE
                         CASE
                             WHEN CURRENT_DATE::DATE > end_date::DATE
                                 THEN NOW()::DATE - end_date::DATE
                             ELSE 0
                             END END AS days_overdue,

                 (SELECT SUM(time_spent) FROM task_work_log WHERE task_id = tasks.id) - (total_minutes * 60) AS overlogged_time,

                 COALESCE(completed_at::DATE - end_date::DATE, 0) AS late_days
          FROM tasks
          WHERE project_id = _project_id
            AND CASE
                    WHEN (_archived IS TRUE) THEN project_id IS NOT NULL
                    ELSE archived IS FALSE END
            AND id IN
                (SELECT task_id FROM tasks_assignees WHERE team_member_id = _team_member_id)) r;
    RETURN _result;
END
$$;

CREATE OR REPLACE FUNCTION get_tasks_by_status(_id uuid, _status text) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _tasks   JSON;
    _team_id UUID;
BEGIN
    SELECT team_id FROM projects WHERE id = _id INTO _team_id;

    SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
    INTO _tasks
    FROM (SELECT id,
                 name,

                 t.parent_task_id,
                 t.parent_task_id IS NOT NULL AS is_sub_task,
                 (SELECT name FROM tasks WHERE id = t.parent_task_id) AS parent_task_name,
                 (SELECT COUNT('*') FROM tasks WHERE parent_task_id = t.id) AS sub_tasks_count,

                 status_id AS status,
                 sort_order,

                 (SELECT COUNT(*)
                  FROM tasks_with_status_view tt
                  WHERE (tt.parent_task_id = t.id OR tt.task_id = t.id)
                    AND tt.is_done IS TRUE)
                     AS completed_count,

                 (SELECT get_task_assignees(t.id)) AS assignees,

                 (SELECT ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(r)))
                  FROM (SELECT task_labels.label_id AS id,
                               (SELECT name FROM team_labels WHERE id = task_labels.label_id),
                               (SELECT color_code FROM team_labels WHERE id = task_labels.label_id)
                        FROM task_labels
                        WHERE task_id = t.id
                        ORDER BY name) r) AS labels,

                 (SELECT name FROM users WHERE id = reporter_id) AS reporter,
                 (SELECT task_priorities.name FROM task_priorities WHERE id = t.priority_id) AS priority,
                 start_date,
                 end_date
          FROM tasks t
          WHERE archived IS FALSE
            AND (project_id = _id)
            AND (t.status_id IN (SELECT id FROM task_statuses WHERE name = _status))
          ORDER BY sort_order) rec;

    RETURN _tasks;
END;
$$;

CREATE OR REPLACE FUNCTION get_tasks_total_and_completed_counts(_task_id uuid) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _total_tasks     INT;
    _total_completed INT;
BEGIN
    SELECT COUNT(*)
    FROM tasks
    WHERE (parent_task_id = _task_id OR id = _task_id)
      AND archived IS FALSE
    INTO _total_tasks;

    SELECT COUNT(*)
    FROM tasks_with_status_view tt
    WHERE (tt.parent_task_id = _task_id
        OR tt.task_id = _task_id)
      AND tt.is_done IS TRUE
    INTO _total_completed;

    RETURN JSON_BUILD_OBJECT(
        'total_tasks', _total_tasks,
        'total_completed', _total_completed
        );
END
$$;

CREATE OR REPLACE FUNCTION get_team_id_from_task(_id uuid) RETURNS uuid
    LANGUAGE plpgsql
AS
$$
DECLARE
    _team_id UUID;
BEGIN
    SELECT team_id INTO _team_id FROM projects WHERE id = (SELECT project_id FROM tasks WHERE tasks.id = _id);
    RETURN _team_id;
END
$$;

CREATE OR REPLACE FUNCTION get_team_members(_team_id uuid, _project_id uuid) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _result JSON;
BEGIN

    SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
    INTO _result
    FROM (
             --
             WITH mbers AS (SELECT team_members.id,
                                   tmiv.name AS name,
                                   tmiv.email,
                                   tmiv.avatar_url,
                                   team_members.user_id,
                                   EXISTS(SELECT 1
                                          FROM project_members
                                          WHERE project_id = _project_id
                                            AND project_members.team_member_id = team_members.id) AS exists_in_project,
                                   0 AS usage,
                                   (CASE
                                       WHEN EXISTS (SELECT 1
                                                    FROM email_invitations
                                                    WHERE team_member_id = team_members.id) THEN TRUE
                                       ELSE FALSE
                                       END) AS is_pending
                            FROM team_members
                                     LEFT JOIN users u ON team_members.user_id = u.id
                                     LEFT JOIN team_member_info_view tmiv ON team_members.id = tmiv.team_member_id
                            WHERE team_members.team_id = _team_id
                              AND team_members.active IS TRUE
                            ORDER BY tmiv.name)
             SELECT id, name, user_id, email, avatar_url, usage, is_pending
             FROM mbers
             ORDER BY exists_in_project DESC
             --
         ) rec;

    RETURN _result;
END;
$$;

CREATE OR REPLACE FUNCTION get_team_wise_resources(_start_date date, _end_date date, _team_id uuid) RETURNS text
    LANGUAGE plpgsql
AS
$$
DECLARE
    _projects JSON;

BEGIN
    SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
    FROM (SELECT id,
                 FALSE AS collapsed,
                 (SELECT name FROM users WHERE user_id = users.id),
                 (SELECT email
                  FROM email_invitations
                  WHERE team_members.id = email_invitations.team_member_id) AS invitee_email,
                 (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                  FROM (SELECT date_series,
                               SUM(total_minutes / 60),
                               JSON_AGG(JSON_BUILD_OBJECT('id', tasks_.id,
                                                          'name', tasks_.name,
                                                          'project_id', tasks_.project_id,
                                                          'project_name', (SELECT projects.name
                                                                           FROM projects
                                                                           WHERE projects.id = tasks_.project_id)
                                   )) AS scheduled_tasks
                        FROM GENERATE_SERIES(
                                 _start_date::DATE,
                                 _end_date::DATE,
                                 '1 day'
                                 ) AS date_series
                                 CROSS JOIN (SELECT id, name, project_id, total_minutes, start_date, end_date
                                             FROM tasks) AS tasks_,
                             tasks_assignees
                        WHERE (date_series BETWEEN tasks_.start_date::DATE AND tasks_.end_date::DATE)
                          AND tasks_assignees.team_member_id = team_members.id
                          AND tasks_.id = tasks_assignees.task_id
                        GROUP BY date_series) rec) AS schedule,
                 (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                  FROM (SELECT projects.id,
                               name,
                               projects.color_code,
                               (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                                FROM (SELECT date_series,
                                             project_id,
                                             SUM(total_minutes / 60),
                                             JSON_AGG(JSON_BUILD_OBJECT('id', tasks_.id,
                                                                        'name', tasks_.name
                                                 )) AS scheduled_tasks
                                      FROM GENERATE_SERIES(
                                               _start_date::DATE,
                                               _end_date::DATE,
                                               '1 day'
                                               ) AS date_series
                                               CROSS JOIN (SELECT id, name, project_id, total_minutes, start_date, end_date
                                                           FROM tasks) AS tasks_,
                                           tasks_assignees
                                      WHERE (date_series BETWEEN tasks_.start_date::DATE AND tasks_.end_date::DATE)
                                        AND tasks_assignees.team_member_id = team_members.id
                                        AND tasks_.id = tasks_assignees.task_id
                                        AND tasks_.project_id = projects.id
                                      GROUP BY date_series, project_id) rec) AS tasks
                        FROM projects,
                             project_members
                        WHERE project_id = projects.id
                          AND team_members.id IN (project_members.team_member_id)
                        ORDER BY updated_at DESC) rec) AS project_members
          FROM team_members
          WHERE team_id = _team_id
            AND user_id IS NOT NULL
          ORDER BY (SELECT name FROM users WHERE user_id = users.id)) rec
    INTO _projects;

    RETURN _projects;
END;
$$;

CREATE OR REPLACE FUNCTION get_unselected_tasks(_id uuid) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _tasks JSON;
BEGIN
    SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
    INTO _tasks
    FROM (SELECT t.id,
                 t.name,
                 t.start_date AT TIME ZONE 'Asia/Colombo' AS start,
                 t.end_date AS "end",
                 t.project_id,
                 (SELECT name FROM task_priorities WHERE task_priorities.id = t.priority_id) AS priority,
                 t.priority_id,
                 t.done,
                 t.created_at,
                 t.status_id,
                 (SELECT ARRAY_AGG(ROW_TO_JSON(rec))
                  FROM (SELECT project_member_id AS id,
                               u2.name AS name,
                               (SELECT avatar_url FROM users WHERE id = tm2.user_id),
                               COALESCE((u2.email), (SELECT email
                                                     FROM email_invitations
                                                     WHERE email_invitations.team_member_id = tm2.id)) AS email
                        FROM tasks_assignees
                                 INNER JOIN project_members pm ON pm.id = tasks_assignees.project_member_id
                                 INNER JOIN team_members tm2 ON pm.team_member_id = tm2.id
                                 LEFT JOIN users u2 ON tm2.user_id = u2.id
                        WHERE project_id = _id::UUID
                          AND project_member_id = pm.id
                          AND t.id = tasks_assignees.task_id
                        ORDER BY name) rec) AS assignees
          FROM tasks t
          WHERE archived IS FALSE
            AND project_id = _id::UUID
            AND (t.start_date IS NULL
              OR t.end_date IS NULL
              OR t.id NOT IN (SELECT task_id FROM tasks_assignees))) rec;

    RETURN _tasks;
END;
$$;

CREATE OR REPLACE FUNCTION handle_on_pt_task_phase_change(_task_id uuid, _phase_id uuid) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _name TEXT;
    _color_code TEXT;
BEGIN
    IF NOT EXISTS(SELECT 1 FROM cpt_task_phases WHERE task_id = _task_id)
    THEN
        IF (is_null_or_empty(_phase_id) IS FALSE)
        THEN
            INSERT INTO cpt_task_phases (task_id, phase_id) VALUES (_task_id, _phase_id);
        END IF;
    ELSE
        IF (is_null_or_empty(_phase_id) IS TRUE)
        THEN
            DELETE FROM cpt_task_phases WHERE task_id = _task_id;
        ELSE
            UPDATE cpt_task_phases SET phase_id = _phase_id WHERE task_id = _task_id;
        END IF;
    END IF;
    IF (is_null_or_empty(_phase_id) IS FALSE)
    THEN
        SELECT name FROM cpt_phases WHERE id = _phase_id INTO _name;
        SELECT color_code FROM cpt_phases WHERE id = _phase_id INTO _color_code;
    END IF;
    RETURN JSON_BUILD_OBJECT('name', _name, 'color_code', _color_code);
END
$$;

CREATE OR REPLACE FUNCTION handle_on_pt_task_status_change(_task_id uuid, _status_id uuid) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _task_info            JSON;
    _status_category      JSON;
    _task_name            TEXT;
    _previous_status_name TEXT;
    _new_status_name      TEXT;
BEGIN
    SELECT name FROM cpt_tasks WHERE id = _task_id INTO _task_name;

    SELECT name
    FROM cpt_task_statuses
    WHERE id = (SELECT status_id FROM cpt_tasks WHERE id = _task_id)
    INTO _previous_status_name;

    SELECT name FROM cpt_task_statuses WHERE id = _status_id INTO _new_status_name;

    IF (_previous_status_name != _new_status_name)
    THEN
        UPDATE cpt_tasks SET status_id = _status_id WHERE id = _task_id;
    END IF;

    SELECT COALESCE(ROW_TO_JSON(r), '{}'::JSON)
    FROM (SELECT is_done, is_doing, is_todo
          FROM sys_task_status_categories
          WHERE id = (SELECT category_id FROM cpt_task_statuses WHERE id = _status_id)) r
    INTO _status_category;

    RETURN JSON_BUILD_OBJECT(
        'template_id', (SELECT template_id FROM cpt_tasks WHERE id = _task_id),
        'color_code', (SELECT color_code FROM sys_task_status_categories WHERE id = (SELECT category_id FROM cpt_task_statuses WHERE id = _status_id))::TEXT,
        'status_category', _status_category
        );
END
$$;

CREATE OR REPLACE FUNCTION handle_on_task_phase_change(_task_id uuid, _phase_id uuid) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _name TEXT;
    _color_code TEXT;
BEGIN
    IF NOT EXISTS(SELECT 1 FROM task_phase WHERE task_id = _task_id)
    THEN
        IF (is_null_or_empty(_phase_id) IS FALSE)
        THEN
            INSERT INTO task_phase (task_id, phase_id) VALUES (_task_id, _phase_id);
        END IF;
    ELSE
        IF (is_null_or_empty(_phase_id) IS TRUE)
        THEN
            DELETE FROM task_phase WHERE task_id = _task_id;
        ELSE
            UPDATE task_phase SET phase_id = _phase_id WHERE task_id = _task_id;
        END IF;
    END IF;

    IF (is_null_or_empty(_phase_id) IS FALSE)
    THEN
        SELECT name FROM project_phases WHERE id = _phase_id INTO _name;
        SELECT color_code FROM project_phases WHERE id = _phase_id INTO _color_code;
    END IF;

    RETURN JSON_BUILD_OBJECT('name', _name, 'color_code', _color_code);
END
$$;

CREATE OR REPLACE FUNCTION handle_on_task_status_change(_user_id uuid, _task_id uuid, _status_id uuid) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _updater_name         TEXT;
    _task_name            TEXT;
    _previous_status_name TEXT;
    _new_status_name      TEXT;
    _message              TEXT;
    _task_info            JSON;
    _status_category      JSON;
    _schedule_id          JSON;
    _task_completed_at    TIMESTAMPTZ;
BEGIN
    SELECT COALESCE(name, '') FROM tasks WHERE id = _task_id INTO _task_name;

    SELECT COALESCE(name, '')
    FROM task_statuses
    WHERE id = (SELECT status_id FROM tasks WHERE id = _task_id)
    INTO _previous_status_name;

    SELECT COALESCE(name, '') FROM task_statuses WHERE id = _status_id INTO _new_status_name;

    IF (_previous_status_name != _new_status_name)
    THEN
        UPDATE tasks SET status_id = _status_id WHERE id = _task_id;

        SELECT get_task_complete_info(_task_id, _status_id) INTO _task_info;

        SELECT COALESCE(name, '') FROM users WHERE id = _user_id INTO _updater_name;

        _message = CONCAT(_updater_name, ' transitioned "', _task_name, '" from ', _previous_status_name, ' ⟶ ',
                          _new_status_name);
    END IF;

    SELECT completed_at FROM tasks WHERE id = _task_id INTO _task_completed_at;
    
    -- Handle schedule_id properly for recurring tasks
    SELECT CASE 
        WHEN schedule_id IS NULL THEN 'null'::json
        ELSE json_build_object('id', schedule_id)
    END
    FROM tasks 
    WHERE id = _task_id 
    INTO _schedule_id;

    SELECT COALESCE(ROW_TO_JSON(r), '{}'::JSON)
    FROM (SELECT is_done, is_doing, is_todo
          FROM sys_task_status_categories
          WHERE id = (SELECT category_id FROM task_statuses WHERE id = _status_id)) r
    INTO _status_category;

    RETURN JSON_BUILD_OBJECT(
            'message', COALESCE(_message, ''),
            'project_id', (SELECT project_id FROM tasks WHERE id = _task_id),
            'parent_done', (CASE
                                WHEN EXISTS(SELECT 1
                                            FROM tasks_with_status_view
                                            WHERE tasks_with_status_view.task_id = _task_id
                                              AND is_done IS TRUE) THEN 1
                                ELSE 0 END),
            'color_code', COALESCE((_task_info ->> 'color_code')::TEXT, ''),
            'color_code_dark', COALESCE((_task_info ->> 'color_code_dark')::TEXT, ''),
            'total_tasks', COALESCE((_task_info ->> 'total_tasks')::INT, 0),
            'total_completed', COALESCE((_task_info ->> 'total_completed')::INT, 0),
            'members', COALESCE((_task_info ->> 'members')::JSON, '[]'::JSON),
            'completed_at', _task_completed_at,
            'status_category', COALESCE(_status_category, '{}'::JSON),
            'schedule_id', COALESCE(_schedule_id, 'null'::JSON)
           );
END
$$;

CREATE OR REPLACE FUNCTION handle_pt_task_list_sort_between_groups(_from_index integer, _to_index integer, _task_id uuid, _template_id uuid) RETURNS void
    LANGUAGE plpgsql
AS
$$
DECLARE
BEGIN

    IF (_to_index = -1)
    THEN
        _to_index = COALESCE((SELECT MAX(sort_order) + 1 FROM cpt_tasks WHERE template_id = _template_id), 0);
    END IF;

    IF _to_index > _from_index
    THEN
        UPDATE cpt_tasks
        SET sort_order = sort_order - 1
        WHERE template_id = _template_id
          AND sort_order > _from_index
          AND sort_order < _to_index;

        UPDATE cpt_tasks SET sort_order = _to_index - 1 WHERE id = _task_id AND template_id = _template_id;
    END IF;

    IF _to_index < _from_index
    THEN
        UPDATE cpt_tasks
        SET sort_order = sort_order + 1
        WHERE template_id = _template_id
          AND sort_order > _to_index
          AND sort_order < _from_index;

        UPDATE cpt_tasks SET sort_order = _to_index + 1 WHERE id = _task_id AND template_id = _template_id;
    END IF;
END
$$;

CREATE OR REPLACE FUNCTION handle_pt_task_list_sort_inside_group(_from_index integer, _to_index integer, _task_id uuid, _template_id uuid) RETURNS void
    LANGUAGE plpgsql
AS
$$
BEGIN
    IF _to_index > _from_index
    THEN
        UPDATE cpt_tasks
        SET sort_order = sort_order - 1
        WHERE template_id = _template_id
          AND sort_order > _from_index
          AND sort_order <= _to_index;
    END IF;

    IF _to_index < _from_index
    THEN
        UPDATE cpt_tasks
        SET sort_order = sort_order + 1
        WHERE template_id = _template_id
          AND sort_order >= _to_index
          AND sort_order < _from_index;
    END IF;

    UPDATE cpt_tasks SET sort_order = _to_index WHERE id = _task_id AND template_id = _template_id;
END
$$;

CREATE OR REPLACE FUNCTION handle_pt_task_list_sort_order_change(_body json) RETURNS void
    LANGUAGE plpgsql
AS
$$
DECLARE
    _from_index INT;
    _to_index   INT;
    _task_id    UUID;
    _template_id UUID;
    _from_group UUID;
    _to_group   UUID;
    _group_by   TEXT;
BEGIN
    _template_id = (_body ->> 'template_id')::UUID;
    _task_id = (_body ->> 'task_id')::UUID;
    _from_index = (_body ->> 'from_index')::INT;
    _to_index = (_body ->> 'to_index')::INT;
    _from_group = (_body ->> 'from_group')::UUID;
    _to_group = (_body ->> 'to_group')::UUID;
    _group_by = (_body ->> 'group_by')::TEXT;

    IF (_from_group <> _to_group OR (_from_group <> _to_group) IS NULL)
    THEN
        IF (_group_by = 'status')
        THEN
            UPDATE cpt_tasks SET status_id = _to_group WHERE id = _task_id AND status_id = _from_group;
        END IF;

        IF (_group_by = 'priority')
        THEN
            UPDATE cpt_tasks SET priority_id = _to_group WHERE id = _task_id AND priority_id = _from_group;
        END IF;

        IF (_group_by = 'phase')
        THEN
            IF (is_null_or_empty(_to_group) IS FALSE)
            THEN
                INSERT INTO cpt_task_phases (task_id, phase_id)
                VALUES (_task_id, _to_group)
                ON CONFLICT (task_id) DO UPDATE SET phase_id = _to_group;
            END IF;
            IF (is_null_or_empty(_to_group) IS TRUE)
            THEN
                DELETE
                FROM cpt_task_phases
                WHERE task_id = _task_id;
            END IF;

        END IF;

        IF ((_body ->> 'to_last_index')::BOOLEAN IS TRUE AND _from_index < _to_index)
        THEN
            PERFORM handle_pt_task_list_sort_inside_group(_from_index, _to_index, _task_id, _template_id);
        ELSE
            PERFORM handle_pt_task_list_sort_between_groups(_from_index, _to_index, _task_id, _template_id);
        END IF;
    ELSE
        PERFORM handle_pt_task_list_sort_inside_group(_from_index, _to_index, _task_id, _template_id);
    END IF;
END
$$;

CREATE OR REPLACE FUNCTION handle_task_list_sort_between_groups(_from_index integer, _to_index integer, _task_id uuid, _project_id uuid) RETURNS void
    LANGUAGE plpgsql
AS
$$
DECLARE
BEGIN

    IF (_to_index = -1)
    THEN
        _to_index = COALESCE((SELECT MAX(sort_order) + 1 FROM tasks WHERE project_id = _project_id), 0);
    END IF;

    IF _to_index > _from_index
    THEN
        UPDATE tasks
        SET sort_order = sort_order - 1
        WHERE project_id = _project_id
          AND sort_order > _from_index
          AND sort_order < _to_index;

        UPDATE tasks SET sort_order = _to_index - 1 WHERE id = _task_id AND project_id = _project_id;
    END IF;

    IF _to_index < _from_index
    THEN
        UPDATE tasks
        SET sort_order = sort_order + 1
        WHERE project_id = _project_id
          AND sort_order > _to_index
          AND sort_order < _from_index;

        UPDATE tasks SET sort_order = _to_index + 1 WHERE id = _task_id AND project_id = _project_id;
    END IF;
END
$$;

CREATE OR REPLACE FUNCTION handle_task_list_sort_inside_group(_from_index integer, _to_index integer, _task_id uuid, _project_id uuid) RETURNS void
    LANGUAGE plpgsql
AS
$$
BEGIN
    IF _to_index > _from_index
    THEN
        UPDATE tasks
        SET sort_order = sort_order - 1
        WHERE project_id = _project_id
          AND sort_order > _from_index
          AND sort_order <= _to_index;
    END IF;

    IF _to_index < _from_index
    THEN
        UPDATE tasks
        SET sort_order = sort_order + 1
        WHERE project_id = _project_id
          AND sort_order >= _to_index
          AND sort_order < _from_index;
    END IF;

    UPDATE tasks SET sort_order = _to_index WHERE id = _task_id AND project_id = _project_id;
END
$$;

-- Helper function to get the appropriate sort column name based on grouping type
CREATE OR REPLACE FUNCTION get_sort_column_name(_group_by TEXT) RETURNS TEXT
    LANGUAGE plpgsql
AS
$$
BEGIN
    CASE _group_by
        WHEN 'status' THEN RETURN 'status_sort_order';
        WHEN 'priority' THEN RETURN 'priority_sort_order';
        WHEN 'phase' THEN RETURN 'phase_sort_order';
        WHEN 'members' THEN RETURN 'member_sort_order';
        -- For backward compatibility, still support general sort_order but be explicit
        WHEN 'general' THEN RETURN 'sort_order';
        ELSE RETURN 'status_sort_order'; -- Default to status sorting
    END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION handle_task_list_sort_order_change(_body json) RETURNS void
    LANGUAGE plpgsql
AS
$$
DECLARE
    _from_index INT;
    _to_index   INT;
    _task_id    UUID;
    _project_id UUID;
    _from_group UUID;
    _to_group   UUID;
    _group_by   TEXT;
    _sort_column TEXT;
    _sql TEXT;
BEGIN
    _project_id = (_body ->> 'project_id')::UUID;
    _task_id = (_body ->> 'task_id')::UUID;
    _from_index = (_body ->> 'from_index')::INT;
    _to_index = (_body ->> 'to_index')::INT;
    _from_group = (_body ->> 'from_group')::UUID;
    _to_group = (_body ->> 'to_group')::UUID;
    _group_by = (_body ->> 'group_by')::TEXT;
    
    -- Get the appropriate sort column
    _sort_column := get_sort_column_name(_group_by);
    
    -- Handle group changes first
    IF (_from_group <> _to_group OR (_from_group <> _to_group) IS NULL) THEN
        IF (_group_by = 'status') THEN
            UPDATE tasks 
            SET status_id = _to_group, updated_at = CURRENT_TIMESTAMP
            WHERE id = _task_id 
              AND project_id = _project_id;
        END IF;
        
        IF (_group_by = 'priority') THEN
            UPDATE tasks 
            SET priority_id = _to_group, updated_at = CURRENT_TIMESTAMP
            WHERE id = _task_id 
              AND project_id = _project_id;
        END IF;
        
        IF (_group_by = 'phase') THEN
            IF (is_null_or_empty(_to_group) IS FALSE) THEN
                INSERT INTO task_phase (task_id, phase_id)
                VALUES (_task_id, _to_group)
                ON CONFLICT (task_id) DO UPDATE SET phase_id = _to_group;
            ELSE
                DELETE FROM task_phase WHERE task_id = _task_id;
            END IF;
        END IF;
    END IF;

    -- Handle sort order changes for the grouping-specific column only
    IF (_from_index <> _to_index) THEN
        -- Update the grouping-specific sort order (no unique constraint issues)
        IF (_to_index > _from_index) THEN
            -- Moving down: decrease sort order for items between old and new position
            _sql := 'UPDATE tasks SET ' || _sort_column || ' = ' || _sort_column || ' - 1, ' ||
                   'updated_at = CURRENT_TIMESTAMP ' ||
                   'WHERE project_id = $1 AND ' || _sort_column || ' > $2 AND ' || _sort_column || ' <= $3';
            EXECUTE _sql USING _project_id, _from_index, _to_index;
        ELSE
            -- Moving up: increase sort order for items between new and old position  
            _sql := 'UPDATE tasks SET ' || _sort_column || ' = ' || _sort_column || ' + 1, ' ||
                   'updated_at = CURRENT_TIMESTAMP ' ||
                   'WHERE project_id = $1 AND ' || _sort_column || ' >= $2 AND ' || _sort_column || ' < $3';
            EXECUTE _sql USING _project_id, _to_index, _from_index;
        END IF;
        
        -- Set the new sort order for the moved task
        _sql := 'UPDATE tasks SET ' || _sort_column || ' = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2';
        EXECUTE _sql USING _to_index, _task_id;
    END IF;
END
$$;

CREATE OR REPLACE FUNCTION handle_task_name_change(_task_id uuid, _task_name text, _user_id uuid) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _name          TEXT;
    _previous_name TEXT;
    _user_name     TEXT;
    _message       TEXT;
    _assignees     JSON;
BEGIN

    IF (is_null_or_empty(_task_name))
    THEN
        SELECT name FROM tasks WHERE id = _task_id INTO _name;
    ELSE
        SELECT name FROM tasks WHERE id = _task_id INTO _previous_name;
        UPDATE tasks SET name = _task_name WHERE id = _task_id RETURNING name INTO _name;
    END IF;

    IF (_name != _previous_name)
    THEN
        SELECT get_task_assignees(_task_id) INTO _assignees;

        SELECT name FROM users WHERE id = _user_id INTO _user_name;

        _message = CONCAT(_user_name, ' has renamed "', _previous_name, '" → "', _name, '"');
    END IF;

    RETURN JSON_BUILD_OBJECT(
        'name', _name,
        'previous_name', _previous_name,
        'project_id', (SELECT project_id FROM tasks WHERE id = _task_id),
        'message', _message,
        'members', _assignees
        );
END
$$;

CREATE OR REPLACE FUNCTION handle_task_roadmap_sort_order(_from_index integer, _to_index integer, _task_id uuid) RETURNS void
    LANGUAGE plpgsql
AS
$$
DECLARE
    _project_id uuid;
BEGIN
    SELECT project_id INTO _project_id FROM tasks WHERE id = _task_id;

    IF _to_index > _from_index
    THEN
        UPDATE tasks
        SET roadmap_sort_order = roadmap_sort_order - 1
        WHERE project_id = _project_id
          AND roadmap_sort_order > _from_index
          AND roadmap_sort_order <= _to_index;
    END IF;

    IF _to_index < _from_index
    THEN
        UPDATE tasks
        SET roadmap_sort_order = roadmap_sort_order + 1
        WHERE project_id = _project_id
          AND roadmap_sort_order >= _to_index
          AND roadmap_sort_order < _from_index;
    END IF;

    UPDATE tasks SET roadmap_sort_order = _to_index WHERE id = _task_id AND project_id = _project_id;
END
$$;

CREATE OR REPLACE FUNCTION home_task_form_view_model(_user_id uuid, _team_id uuid, _task_id uuid, _project_id uuid) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _task JSON;
BEGIN

    -- Select task info
    SELECT COALESCE(ROW_TO_JSON(rec), '{}'::JSON)
    INTO _task
    FROM (SELECT id,
                 name,
                 start_date,
                 end_date,
                 done,
                 priority_id,
                 project_id,
                 created_at,
                 updated_at,
                 status_id,
                 parent_task_id,
                 parent_task_id IS NOT NULL AS is_sub_task,
                 (SELECT COUNT(*) FROM tasks WHERE parent_task_id = _task_id) AS sub_tasks_count,
                 (SELECT name FROM users WHERE id = tasks.reporter_id) AS reporter,
                 (SELECT get_task_assignees(tasks.id)) AS assignees,
                 (SELECT id FROM team_members WHERE user_id = _user_id AND team_id = _team_id) AS team_member_id
          FROM tasks
          WHERE id = _task_id) rec;

    RETURN JSON_BUILD_OBJECT(
        'task', _task
        );
END;
$$;

CREATE OR REPLACE FUNCTION import_tasks_from_template(_project_id uuid, _user_id uuid, _tasks json) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _task     JSON;
    _max_sort INT;
    _task_id_new UUID;
BEGIN

    SELECT COALESCE((SELECT MAX(sort_order) FROM tasks WHERE project_id = _project_id), 0) INTO _max_sort;

    -- insert tasks for task templates
    FOR _task IN SELECT * FROM JSON_ARRAY_ELEMENTS(_tasks)
        LOOP
            _max_sort = _max_sort + 1;
            INSERT INTO tasks (name, priority_id, project_id, reporter_id, status_id, sort_order, total_minutes)
            VALUES (TRIM((_task ->> 'name')::TEXT),
                    (SELECT id FROM task_priorities WHERE value = 1),
                    _project_id,
                    _user_id,

                       -- This should be came from client side later
                    (SELECT id
                     FROM task_statuses
                     WHERE project_id = _project_id::UUID
                       AND category_id IN (SELECT id FROM sys_task_status_categories WHERE is_todo IS TRUE)
                     LIMIT 1), _max_sort, (_task ->> 'total_minutes')::NUMERIC) RETURNING id INTO _task_id_new;

            INSERT INTO task_activity_logs (task_id, team_id, attribute_type, user_id, log_type, old_value, new_value, project_id)
                VALUES (
                        _task_id_new,
                        (SELECT team_id FROM projects WHERE id = _project_id),
                        'status',
                        _user_id,
                        'update',
                        NULL,
                        (SELECT id FROM task_statuses WHERE project_id = _project_id::UUID AND category_id IN (SELECT id FROM sys_task_status_categories WHERE is_todo IS TRUE)LIMIT 1),
                        _project_id
                        );

        END LOOP;

    RETURN JSON_BUILD_OBJECT('id', _project_id);
END;
$$;

CREATE OR REPLACE FUNCTION in_organization(_team_id_in uuid, _team_id uuid) RETURNS boolean
    LANGUAGE plpgsql
AS
$$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM teams t1
        JOIN teams t2 ON t1.user_id = t2.user_id
        WHERE t1.id = _team_id_in AND t2.id = _team_id
    );
END;
$$;

CREATE OR REPLACE FUNCTION insert_job_title(_job_title text, _team_id uuid) RETURNS uuid
    LANGUAGE plpgsql
AS
$$
DECLARE
    _job_title_id UUID;
BEGIN
    IF EXISTS(SELECT name FROM job_titles WHERE name = _job_title AND team_id = _team_id)
    THEN
        SELECT id FROM job_titles WHERE name = _job_title AND team_id = _team_id INTO _job_title_id;
    ELSE
        INSERT INTO job_titles (name, team_id)
        VALUES (_job_title, _team_id)
        RETURNING id INTO _job_title_id;
    END IF;

    RETURN _job_title_id;
END;
$$;

CREATE OR REPLACE FUNCTION insert_task_list_columns(_project_id uuid) RETURNS void
    LANGUAGE plpgsql
AS
$$
DECLARE
BEGIN
    INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
    VALUES (_project_id, 'Key', 'KEY', 0, FALSE);
    INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
    VALUES (_project_id, 'Description', 'DESCRIPTION', 2, FALSE);
    INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
    VALUES (_project_id, 'Progress', 'PROGRESS', 3, TRUE);
    INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
    VALUES (_project_id, 'Status', 'STATUS', 4, TRUE);
    INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
    VALUES (_project_id, 'Members', 'ASSIGNEES', 5, TRUE);
    INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
    VALUES (_project_id, 'Labels', 'LABELS', 6, TRUE);
    INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
    VALUES (_project_id, 'Phase', 'PHASE', 7, TRUE);
    INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
    VALUES (_project_id, 'Priority', 'PRIORITY', 8, TRUE);
    INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
    VALUES (_project_id, 'Time Tracking', 'TIME_TRACKING', 9, TRUE);
    INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
    VALUES (_project_id, 'Estimation', 'ESTIMATION', 10, FALSE);
    INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
    VALUES (_project_id, 'Start Date', 'START_DATE', 11, FALSE);
    INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
    VALUES (_project_id, 'Due Date', 'DUE_DATE', 12, TRUE);
    INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
    VALUES (_project_id, 'Completed Date', 'COMPLETED_DATE', 13, FALSE);
    INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
    VALUES (_project_id, 'Created Date', 'CREATED_DATE', 14, FALSE);
    INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
    VALUES (_project_id, 'Last Updated', 'LAST_UPDATED', 15, FALSE);
    INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
    VALUES (_project_id, 'Reporter', 'REPORTER', 16, FALSE);
END
$$;

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
                                     AND admin_role IS TRUE));
END
$$;

CREATE OR REPLACE FUNCTION is_completed(_status_id uuid, _project_id uuid) RETURNS boolean
    LANGUAGE plpgsql
AS
$$
DECLARE
BEGIN
    RETURN (SELECT _status_id IN (SELECT id
                                  FROM task_statuses
                                  WHERE project_id = _project_id
                                    AND category_id =
                                        (SELECT id FROM sys_task_status_categories WHERE is_done IS TRUE)));
END
$$;

CREATE OR REPLACE FUNCTION is_doing(_status_id uuid, _project_id uuid) RETURNS boolean
    LANGUAGE plpgsql
AS
$$
DECLARE
BEGIN
    RETURN (SELECT _status_id IN (SELECT id
                                  FROM task_statuses
                                  WHERE project_id = _project_id
                                    AND category_id =
                                        (SELECT id FROM sys_task_status_categories WHERE is_doing IS TRUE)));
END
$$;

CREATE OR REPLACE FUNCTION is_member_of_project(_project_id uuid, _user_id uuid, _team_id uuid) RETURNS boolean
    LANGUAGE plpgsql
AS
$$
DECLARE
BEGIN
    RETURN EXISTS(SELECT 1
                  FROM project_members
                  WHERE project_id = _project_id
                    AND team_member_id = (SELECT id FROM team_members WHERE team_id = _team_id AND user_id = _user_id));
END
$$;

CREATE OR REPLACE FUNCTION is_null_or_empty(_value anyelement) RETURNS boolean
    LANGUAGE plpgsql
AS
$$
BEGIN
    RETURN COALESCE(TRIM(_value::TEXT), '') = '';
END;
$$;

CREATE OR REPLACE FUNCTION is_overdue(_task_id uuid) RETURNS boolean
    LANGUAGE plpgsql
AS
$$
DECLARE
BEGIN
    RETURN EXISTS(SELECT 1
                  FROM tasks
                  WHERE id = _task_id
                    AND end_date < CURRENT_TIMESTAMP
                    AND is_completed(tasks.status_id, tasks.project_id) IS FALSE);
END
$$;

CREATE OR REPLACE FUNCTION is_owner(_user_id uuid, _team_id uuid) RETURNS boolean
    LANGUAGE plpgsql
AS
$$
DECLARE
BEGIN
    RETURN EXISTS(SELECT 1
                  FROM teams
                  WHERE teams.user_id = _user_id
                    AND teams.id = _team_id);
END
$$;

CREATE OR REPLACE FUNCTION is_todo(_status_id uuid, _project_id uuid) RETURNS boolean
    LANGUAGE plpgsql
AS
$$
DECLARE
BEGIN
    RETURN (SELECT _status_id IN (SELECT id
                                  FROM task_statuses
                                  WHERE project_id = _project_id
                                    AND category_id =
                                        (SELECT id FROM sys_task_status_categories WHERE is_todo IS TRUE)));
END
$$;

CREATE OR REPLACE FUNCTION lower_email() RETURNS trigger
    LANGUAGE plpgsql
AS
$$
DECLARE
BEGIN

    IF (is_null_or_empty(NEW.email) IS FALSE)
    THEN
        NEW.email = LOWER(TRIM(NEW.email));
    END IF;

    RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION migrate_member_allocations(_body json) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _member JSON;
    _output JSON;
BEGIN
    FOR _member IN SELECT * FROM JSON_ARRAY_ELEMENTS(_body::JSON)
        LOOP
            INSERT INTO project_member_allocations(project_id, team_member_id, allocated_from, allocated_to)
            VALUES ((_member ->> 'project_id')::UUID, (_member ->> 'team_member_id')::UUID,
                    (_member ->> 'allocated_from')::DATE,
                    (_member ->> 'allocated_to')::DATE);
        END LOOP;
    RETURN _output;
END;
$$;

CREATE OR REPLACE FUNCTION move_tasks_and_delete_status(_body json) RETURNS void
    LANGUAGE plpgsql
AS
$$
DECLARE
    _status_id   UUID;
    _category_id UUID;
BEGIN
    _status_id = (_body ->> 'id')::UUID;
    SELECT category_id FROM task_statuses WHERE id = _status_id INTO _category_id;

    IF (is_null_or_empty(_body ->> 'replacing_status') IS FALSE)
    THEN
        UPDATE tasks
        SET status_id = (_body ->> 'replacing_status')::UUID
        WHERE project_id = (_body ->> 'project_id')::UUID
          AND status_id = _status_id;
    END IF;

    IF ((SELECT COUNT(*)
         FROM task_statuses
         WHERE category_id = _category_id
           AND project_id = (_body ->> 'project_id')::UUID) < 2)
    THEN
        RAISE 'ERROR_ONE_SHOULD_EXISTS';
    END IF;

    DELETE FROM task_statuses WHERE id = _status_id AND project_id = (_body ->> 'project_id')::UUID;
END
$$;

CREATE OR REPLACE FUNCTION notification_settings_delete_trigger_fn() RETURNS trigger
    LANGUAGE plpgsql
AS
$$
DECLARE
BEGIN
    DELETE FROM notification_settings WHERE user_id = OLD.user_id AND team_id = OLD.team_id;
    RETURN OLD;
END
$$;

CREATE OR REPLACE FUNCTION notification_settings_insert_trigger_fn() RETURNS trigger
    LANGUAGE plpgsql
AS
$$
DECLARE
BEGIN

    IF (NOT EXISTS(SELECT 1 FROM notification_settings WHERE team_id = NEW.team_id AND user_id = NEW.user_id)) AND
       (is_null_or_empty(NEW.user_id) IS FALSE) AND (EXISTS(SELECT 1 FROM users WHERE id = NEW.user_id))
    THEN
        INSERT INTO notification_settings (popup_notifications_enabled, show_unread_items_count, user_id,
                                           team_id)
        VALUES (TRUE, TRUE, NEW.user_id, NEW.team_id);
    END IF;

    RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION notify_task_assignment_update(_type text, _reporter_id uuid, _task_id uuid, _user_id uuid, _team_id uuid) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _reporter_name TEXT;
    _task_name     TEXT;
    _message       TEXT;
    _team_id       UUID;
    _project_id    UUID;
BEGIN
    IF (is_null_or_empty(_task_id) IS FALSE)
    THEN

        SELECT project_id FROM tasks WHERE id = _task_id INTO _project_id;
        SELECT team_id FROM projects WHERE id = _project_id INTO _team_id;

        INSERT INTO task_updates (type, reporter_id, task_id, user_id, team_id, project_id)
        VALUES (_type, _reporter_id, _task_id, _user_id, _team_id, (SELECT project_id FROM tasks WHERE id = _task_id));

        SELECT name FROM users WHERE id = _reporter_id INTO _reporter_name;
        SELECT name FROM tasks WHERE id = _task_id INTO _task_name;

        IF (_type = 'ASSIGN')
        THEN
            _message = CONCAT('<b>', _reporter_name, '</b> has assigned you in <b>', _task_name, '</b>');
        ELSE
            _message = CONCAT('<b>', _reporter_name, '</b> has removed you from <b>', _task_name, '</b>');
        END IF;

        PERFORM create_notification(_user_id, _team_id, _task_id, _project_id, _message);

        RETURN JSON_BUILD_OBJECT(
            'receiver_socket_id', (SELECT socket_id FROM users WHERE id = _user_id),
            'team', (SELECT name FROM teams WHERE id = _team_id),
            'team_id', _team_id,
            'project', (SELECT name FROM projects WHERE id = _project_id),
            'project_color', (SELECT color_code FROM projects WHERE id = _project_id),
            'project_id', _project_id,
            'task_id', _task_id,
            'message', _message
            );

    END IF;

    RETURN NULL;
END
$$;

CREATE OR REPLACE FUNCTION register_google_user(_body json) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _user_id         UUID;
    _organization_id UUID;
    _team_id         UUID;
    _role_id         UUID;

    _name            TEXT;
    _email           TEXT;
    _google_id       TEXT;
BEGIN
    _name = (_body ->> 'displayName')::TEXT;
    _email = (_body ->> 'email')::TEXT;
    _google_id = (_body ->> 'id');

    INSERT INTO users (name, email, google_id, timezone_id)
    VALUES (_name, _email, _google_id, COALESCE((SELECT id FROM timezones WHERE name = (_body ->> 'timezone')),
                                                (SELECT id FROM timezones WHERE name = 'UTC')))
    RETURNING id INTO _user_id;

    --insert organization data
    INSERT INTO organizations (user_id, organization_name, contact_number, contact_number_secondary, trial_in_progress,
                               trial_expire_date, subscription_status, license_type_id)
    VALUES (_user_id, TRIM((_body ->> 'team_name')::TEXT), NULL, NULL, TRUE, CURRENT_DATE + INTERVAL '9999 days',
            'active', (SELECT id FROM sys_license_types WHERE key = 'SELF_HOSTED'))
    RETURNING id INTO _organization_id;

    INSERT INTO teams (name, user_id, organization_id)
    VALUES (_name, _user_id, _organization_id)
    RETURNING id INTO _team_id;

    -- insert default roles
    INSERT INTO roles (name, team_id, default_role) VALUES ('Member', _team_id, TRUE);
    INSERT INTO roles (name, team_id, admin_role) VALUES ('Admin', _team_id, TRUE);
    INSERT INTO roles (name, team_id, admin_role) VALUES ('Team Lead', _team_id, TRUE);
    INSERT INTO roles (name, team_id, owner) VALUES ('Owner', _team_id, TRUE) RETURNING id INTO _role_id;

    INSERT INTO team_members (user_id, team_id, role_id)
    VALUES (_user_id, _team_id, _role_id);

    IF (is_null_or_empty(_body ->> 'team') OR is_null_or_empty(_body ->> 'member_id'))
    THEN
        UPDATE users SET active_team = _team_id WHERE id = _user_id;
    ELSE
        -- Verify team member
        IF EXISTS(SELECT id
                  FROM team_members
                  WHERE id = (_body ->> 'member_id')::UUID
                    AND team_id = (_body ->> 'team')::UUID)
        THEN
            UPDATE team_members
            SET user_id = _user_id
            WHERE id = (_body ->> 'member_id')::UUID
              AND team_id = (_body ->> 'team')::UUID;

            DELETE
            FROM email_invitations
            WHERE team_id = (_body ->> 'team')::UUID
              AND team_member_id = (_body ->> 'member_id')::UUID;

            UPDATE users SET active_team = (_body ->> 'team')::UUID WHERE id = _user_id;
        END IF;
    END IF;

    RETURN JSON_BUILD_OBJECT(
            'id', _user_id,
            'email', _email,
            'google_id', _google_id
           );
END
$$;

CREATE OR REPLACE FUNCTION register_user(_body json) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _user_id           UUID;
    _organization_id   UUID;
    _team_id           UUID;
    _role_id           UUID;
    _trimmed_email     TEXT;
    _trimmed_name      TEXT;
    _trimmed_team_name TEXT;
BEGIN

    _trimmed_email = LOWER(TRIM((_body ->> 'email')));
    _trimmed_name = TRIM((_body ->> 'name'));
    _trimmed_team_name = TRIM((_body ->> 'team_name'));

    -- check user exists
    IF EXISTS(SELECT email FROM users WHERE email = _trimmed_email)
    THEN
        RAISE 'EMAIL_EXISTS_ERROR:%', (_body ->> 'email');
    END IF;

    -- insert user
    INSERT INTO users (name, email, password, timezone_id)
    VALUES (_trimmed_name, _trimmed_email, (_body ->> 'password'),
            COALESCE((SELECT id FROM timezones WHERE name = (_body ->> 'timezone')),
                     (SELECT id FROM timezones WHERE name = 'UTC')))
    RETURNING id INTO _user_id;

    --insert organization data
    INSERT INTO organizations (user_id, organization_name, contact_number, contact_number_secondary, trial_in_progress,
                               trial_expire_date, subscription_status, license_type_id)
    VALUES (_user_id, TRIM((_body ->> 'team_name')::TEXT), NULL, NULL, TRUE, CURRENT_DATE + INTERVAL '9999 days',
            'active', (SELECT id FROM sys_license_types WHERE key = 'SELF_HOSTED'))
    RETURNING id INTO _organization_id;


    -- insert team
    INSERT INTO teams (name, user_id, organization_id)
    VALUES (_trimmed_team_name, _user_id, _organization_id)
    RETURNING id INTO _team_id;

    IF (is_null_or_empty((_body ->> 'invited_team_id')))
    THEN
        UPDATE users SET active_team = _team_id WHERE id = _user_id;
    ELSE
        IF NOT EXISTS(SELECT id
                      FROM email_invitations
                      WHERE team_id = (_body ->> 'invited_team_id')::UUID
                        AND email = _trimmed_email)
        THEN
            RAISE 'ERROR_INVALID_JOINING_EMAIL';
        END IF;
        UPDATE users SET active_team = (_body ->> 'invited_team_id')::UUID WHERE id = _user_id;
    END IF;

    -- insert default roles
    INSERT INTO roles (name, team_id, default_role) VALUES ('Member', _team_id, TRUE);
    INSERT INTO roles (name, team_id, admin_role) VALUES ('Admin', _team_id, TRUE);
    INSERT INTO roles (name, team_id, admin_role) VALUES ('Team Lead', _team_id, TRUE);
    INSERT INTO roles (name, team_id, owner) VALUES ('Owner', _team_id, TRUE) RETURNING id INTO _role_id;

    -- insert team member
    INSERT INTO team_members (user_id, team_id, role_id)
    VALUES (_user_id, _team_id, _role_id);

    -- update team member table with user id
    IF (_body ->> 'team_member_id') IS NOT NULL
    THEN
        UPDATE team_members SET user_id = (_user_id)::UUID WHERE id = (_body ->> 'team_member_id')::UUID;
        DELETE
        FROM email_invitations
        WHERE email = _trimmed_email
          AND team_member_id = (_body ->> 'team_member_id')::UUID;
    END IF;

    RETURN JSON_BUILD_OBJECT(
            'id', _user_id,
            'name', _trimmed_name,
            'email', _trimmed_email,
            'team_id', _team_id
           );
END;
$$;

CREATE OR REPLACE FUNCTION remove_project_member(_id uuid, _user_id uuid, _team_id uuid) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _team_member_id UUID;
    _project_id     UUID;
    _member_user_id UUID;
    _notification   TEXT;
BEGIN
    SELECT project_id FROM project_members WHERE id = _id INTO _project_id;
    SELECT team_member_id FROM project_members WHERE id = _id INTO _team_member_id;
    SELECT user_id FROM team_members WHERE id = _team_member_id INTO _member_user_id;
    DELETE FROM project_members WHERE id = _id;
    DELETE FROM project_member_allocations WHERE project_id = _project_id AND team_member_id = _team_member_id;

    IF (_member_user_id != _user_id)
    THEN
        _notification =
            CONCAT('You have been removed from the <b>', (SELECT name FROM projects WHERE id = _project_id),
                   '</b> by <b>',
                   (SELECT name FROM users WHERE id = _user_id), '</b>');
        PERFORM create_notification(
            (SELECT user_id FROM team_members WHERE id = _team_member_id),
            _team_id,
            NULL,
            _project_id,
            _notification
            );
    END IF;

    RETURN JSON_BUILD_OBJECT(
        'id', _id,
        'notification', _notification,
        'socket_id', (SELECT socket_id FROM users WHERE id = _member_user_id),
        'project', (SELECT name FROM projects WHERE id = _project_id),
        'project_id', _project_id,
        'project_color', (SELECT color_code FROM projects WHERE id = _project_id),
        'team', (SELECT name FROM teams WHERE id = _team_id),
        'member_user_id', _member_user_id
        );
END;
$$;

CREATE OR REPLACE FUNCTION remove_task_assignee(_task_id uuid, _team_member_id uuid, _project_id uuid) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _team_id UUID;
    _user_id UUID;
BEGIN

    SELECT team_id FROM team_members WHERE id = _team_member_id INTO _team_id;
    SELECT user_id FROM team_members WHERE id = _team_member_id INTO _user_id;

    DELETE
    FROM tasks_assignees
    WHERE task_id = _task_id
      AND project_member_id =
          (SELECT id FROM project_members WHERE team_member_id = _team_member_id AND project_id = _project_id);

    RETURN JSON_BUILD_OBJECT(
        'user_id', _user_id,
        'team_id', _team_id
        );
END
$$;

CREATE OR REPLACE FUNCTION remove_team_member(_id uuid, _user_id uuid, _team_id uuid) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _removed_user_id   UUID;
    _removed_team_name TEXT;
BEGIN
    SELECT user_id FROM team_members WHERE id = _id INTO _removed_user_id;
    SELECT name FROM teams WHERE id = _team_id INTO _removed_team_name;

    UPDATE users
    SET active_team = (SELECT id FROM teams WHERE user_id = _removed_user_id LIMIT 1)
    WHERE active_team = _team_id
      AND id = _removed_user_id;

    PERFORM create_notification(
        _removed_user_id,
        _team_id,
        NULL,
        NULL,
        CONCAT('You have been removed from <b>', (SELECT name FROM teams WHERE id = _team_id), '</b> by <b>',
               (SELECT name FROM users WHERE id = _user_id), '</b>')
        );

    DELETE FROM team_members WHERE id = _id AND team_id = _team_id;

    RETURN JSON_BUILD_OBJECT(
        'id', _removed_user_id,
        'team', _removed_team_name,
        'socket_id', (SELECT socket_id FROM users WHERE id = _user_id)
        );
END;
$$;

CREATE OR REPLACE FUNCTION resend_team_invitation(_body json) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _id      UUID;
    _team_id UUID;
    _user_id UUID;
    _email   TEXT;
    _output  JSON;
BEGIN
    _team_id = (_body ->> 'team_id')::UUID;
    _id = (_body ->> 'id')::UUID;

    SELECT email FROM email_invitations WHERE team_member_id = _id AND team_id = _team_id INTO _email;
    SELECT id FROM users WHERE email = _email INTO _user_id;

    IF is_null_or_empty(_email) IS FALSE
    THEN
        DELETE FROM email_invitations WHERE team_id = _team_id AND team_member_id = _id;
    END IF;

    INSERT INTO email_invitations(team_id, team_member_id, email, name)
    VALUES (_team_id, _id, _email, SPLIT_PART(_email, '@', 1));

    SELECT JSON_BUILD_OBJECT(
               'name', (SELECT name FROM users WHERE id = _user_id),
               'email', _email,
               'is_new', is_null_or_empty(_user_id),
               'team_member_id', _id,
               'team_member_user_id', _user_id
               )
    INTO _output;

    RETURN _output;
END;
$$;

CREATE OR REPLACE FUNCTION set_active_team(_user_id uuid, _team_id uuid) RETURNS void
    LANGUAGE plpgsql
AS
$$
DECLARE
BEGIN
    IF EXISTS(SELECT id FROM team_members WHERE team_id = _team_id AND user_id = _user_id)
    THEN
        UPDATE users SET active_team = _team_id WHERE id = _user_id;
    ELSE
        UPDATE users SET active_team = (SELECT id FROM teams WHERE user_id = users.id LIMIT 1) WHERE id = _user_id;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION set_active_team_by_member_id(_team_member_id uuid) RETURNS void
    LANGUAGE plpgsql
AS
$$
DECLARE
BEGIN
    PERFORM set_active_team(
        (SELECT user_id FROM team_members WHERE id = _team_member_id),
        (SELECT team_id FROM team_members WHERE id = _team_member_id)
        );
END;
$$;

CREATE OR REPLACE FUNCTION set_task_updated_at_trigger_fn() RETURNS trigger
    LANGUAGE plpgsql
AS
$$
DECLARE
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION slugify(value text) RETURNS text
    IMMUTABLE
    STRICT
    LANGUAGE sql
AS
$$
    -- removes accents (diacritic signs) from a given string --
WITH "unaccented" AS (SELECT unaccent("value") AS "value"),
     -- lowercase the string
     "lowercase" AS (SELECT LOWER("value") AS "value"
                     FROM "unaccented"),
     -- replaces anything that's not a letter, number, hyphen('-'), or underscore('_') with a hyphen('-')
     "hyphenated" AS (SELECT REGEXP_REPLACE("value", '[^a-z0-9\\-_.''`"]+', '-', 'gi') AS "value"
                      FROM "lowercase"),
     -- trims hyphens('-') if they exist on the head or tail of the string
     "trimmed" AS (SELECT REGEXP_REPLACE(REGEXP_REPLACE("value", '\\-+$', ''), '^\\-', '') AS "value"
                   FROM "hyphenated")
SELECT "value"
FROM "trimmed";
$$;

CREATE OR REPLACE FUNCTION sys_insert_project_healths() RETURNS void
    LANGUAGE plpgsql
AS
$$
BEGIN
    INSERT INTO sys_project_healths (name, color_code, sort_order, is_default)
    VALUES ('Not Set', '#a9a9a9', 0, TRUE);
    INSERT INTO sys_project_healths (name, color_code, sort_order, is_default)
    VALUES ('Needs Attention', '#fbc84c', 1, FALSE);
    INSERT INTO sys_project_healths (name, color_code, sort_order, is_default)
    VALUES ('At Risk', '#f37070', 2, FALSE);
    INSERT INTO sys_project_healths (name, color_code, sort_order, is_default)
    VALUES ('Good', '#75c997', 3, FALSE);
END;
$$;

CREATE OR REPLACE FUNCTION task_status_change_trigger_fn() RETURNS trigger
    LANGUAGE plpgsql
AS
$$
DECLARE
BEGIN
    IF ((SELECT is_done
         FROM sys_task_status_categories
         WHERE id = (SELECT category_id FROM task_statuses WHERE id = NEW.status_id)) IS TRUE)
    THEN
        UPDATE tasks SET completed_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    ELSE
        UPDATE tasks SET completed_at = NULL WHERE id = NEW.id;
    END IF;

    RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION tasks_task_subscriber_notify_done_trigger() RETURNS trigger
    LANGUAGE plpgsql
AS
$$
DECLARE
BEGIN
    IF (EXISTS(SELECT 1
               FROM sys_task_status_categories
               WHERE id = (SELECT category_id FROM task_statuses WHERE id = NEW.status_id)
                 AND is_done IS TRUE))
    THEN
        PERFORM pg_notify('db_task_status_changed', NEW.id::TEXT);
    END IF;

    RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION to_seconds(t text) RETURNS integer
    LANGUAGE plpgsql
AS
$$
DECLARE
    hs INTEGER;
    ms INTEGER;
    s  INTEGER;
BEGIN
    SELECT (EXTRACT(HOUR FROM t::TIME) * 60 * 60) INTO hs;
    SELECT (EXTRACT(MINUTES FROM t::TIME) * 60) INTO ms;
    SELECT (EXTRACT(SECONDS FROM t::TIME)) INTO s;
    SELECT (hs + ms + s) INTO s;
    RETURN s;
END;
$$;

CREATE OR REPLACE FUNCTION toggle_archive_all_projects(_project_id uuid) RETURNS void
    LANGUAGE plpgsql
AS
$$
DECLARE
    _user_id UUID;

BEGIN
    IF EXISTS(SELECT project_id FROM archived_projects WHERE project_id = _project_id)
    THEN
        DELETE FROM archived_projects WHERE project_id = _project_id;
    ELSE
        FOR _user_id IN
            SELECT user_id FROM team_members WHERE team_id = (SELECT team_id FROM projects WHERE id = _project_id)
            LOOP
                IF NOT (is_null_or_empty(_user_id))
                THEN
                    INSERT INTO archived_projects (user_id, project_id)
                    VALUES (_user_id, _project_id);
                END IF;
            END LOOP;
    END IF;
END
$$;

CREATE OR REPLACE FUNCTION toggle_archive_project(_user_id uuid, _project_id uuid) RETURNS void
    LANGUAGE plpgsql
AS
$$
DECLARE
BEGIN
    IF EXISTS(SELECT user_id FROM archived_projects WHERE user_id = _user_id AND project_id = _project_id)
    THEN
        DELETE FROM archived_projects WHERE user_id = _user_id AND project_id = _project_id;
    ELSE
        INSERT INTO archived_projects (user_id, project_id) VALUES (_user_id, _project_id);
    END IF;
END
$$;

CREATE OR REPLACE FUNCTION toggle_favorite_project(_user_id uuid, _project_id uuid) RETURNS void
    LANGUAGE plpgsql
AS
$$
DECLARE
BEGIN
    IF EXISTS(SELECT user_id FROM favorite_projects WHERE user_id = _user_id AND project_id = _project_id)
    THEN
        DELETE FROM favorite_projects WHERE user_id = _user_id AND project_id = _project_id;
    ELSE
        INSERT INTO favorite_projects (user_id, project_id) VALUES (_user_id, _project_id);
    END IF;
END
$$;

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
    -- need a test, can be throw errors
    _client_name = TRIM((_body ->> 'client_name')::TEXT);
    _project_name = TRIM((_body ->> 'name')::TEXT);

    -- add inside the controller
    _user_id = (_body ->> 'user_id')::UUID;
    _team_id = (_body ->> 'team_id')::UUID;
    _project_manager_team_member_id = (_body ->> 'team_member_id')::UUID;

    -- cache exists client if exists
    SELECT id FROM clients WHERE LOWER(name) = LOWER(_client_name) AND team_id = _team_id INTO _client_id;

    -- insert client if not exists
    IF is_null_or_empty(_client_id) IS TRUE AND is_null_or_empty(_client_name) IS FALSE
    THEN
        INSERT INTO clients (name, team_id) VALUES (_client_name, _team_id) RETURNING id INTO _client_id;
    END IF;

    -- check whether the project name is already in
    IF EXISTS(
        SELECT name FROM projects WHERE LOWER(name) = LOWER(_project_name)
                                    AND team_id = _team_id AND id != (_body ->> 'id')::UUID
    )
    THEN
        RAISE 'PROJECT_EXISTS_ERROR:%', _project_name;
    END IF;

    -- update the project
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
        hours_per_day          = (_body ->> 'hours_per_day')::INTEGER
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

CREATE OR REPLACE FUNCTION update_project_manager(_team_member_id uuid, _project_id uuid) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _project_member_id UUID;
    _team_id           UUID;
    _user_id           UUID;
    _project_member    JSON;
BEGIN

    SELECT id
    FROM project_members
    WHERE team_member_id = _team_member_id
      AND project_id = _project_id
    INTO _project_member_id;

    SELECT team_id FROM team_members WHERE id = _team_member_id INTO _team_id;
    SELECT user_id FROM team_members WHERE id = _team_member_id INTO _user_id;

    IF is_null_or_empty(_project_member_id)
    THEN
        SELECT create_project_member(JSON_BUILD_OBJECT(
                'team_member_id', _team_member_id,
                'team_id', _team_id,
                'project_id', _project_id,
                'user_id', _user_id,
                'access_level', 'PROJECT_MANAGER'::TEXT
            ))
        INTO _project_member;
    END IF;

    UPDATE project_members SET project_access_level_id = (SELECT id FROM project_access_levels WHERE key = 'PROJECT_MANAGER') WHERE id = _project_member_id AND project_id = _project_id;

    RETURN JSON_BUILD_OBJECT(
            'project_member_id', _project_member_id,
            'team_member_id', _team_member_id,
            'team_id', _team_id,
            'user_id', _user_id
        );
END
$$;

CREATE OR REPLACE FUNCTION update_project_tasks_counter_trigger_fn() RETURNS trigger
    LANGUAGE plpgsql
AS
$$
DECLARE
BEGIN

    UPDATE projects SET tasks_counter = (tasks_counter + 1) WHERE id = NEW.project_id;
    NEW.task_no = (SELECT tasks_counter FROM projects WHERE id = NEW.project_id);

    RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION update_status_order(_status_ids json) RETURNS void
    LANGUAGE plpgsql
AS
$$
DECLARE
    _iterator  NUMERIC := 0;
    _status_id TEXT;
    _project_id UUID;
    _base_sort_order NUMERIC;
BEGIN
    -- Get the project_id from the first status to ensure we update all statuses in the same project
    SELECT project_id INTO _project_id
    FROM task_statuses 
    WHERE id = (SELECT TRIM(BOTH '"' FROM JSON_ARRAY_ELEMENTS(_status_ids)::TEXT) LIMIT 1)::UUID;

    -- Update the sort_order for statuses in the provided order
    FOR _status_id IN SELECT * FROM JSON_ARRAY_ELEMENTS((_status_ids)::JSON)
        LOOP
            UPDATE task_statuses
            SET sort_order = _iterator
            WHERE id = (SELECT TRIM(BOTH '"' FROM _status_id))::UUID;
            _iterator := _iterator + 1;
        END LOOP;

    -- Get the base sort order for remaining statuses (simple count approach)
    SELECT COUNT(*) INTO _base_sort_order
    FROM task_statuses ts2 
    WHERE ts2.project_id = _project_id 
    AND ts2.id = ANY(SELECT (TRIM(BOTH '"' FROM JSON_ARRAY_ELEMENTS(_status_ids)::TEXT))::UUID);

    -- Update remaining statuses with simple sequential numbering
    -- Reset iterator to start from base_sort_order
    _iterator := _base_sort_order;
    
    -- Use a cursor approach to avoid window functions
    FOR _status_id IN 
        SELECT id::TEXT FROM task_statuses 
        WHERE project_id = _project_id 
        AND id NOT IN (SELECT (TRIM(BOTH '"' FROM JSON_ARRAY_ELEMENTS(_status_ids)::TEXT))::UUID)
        ORDER BY sort_order
    LOOP
        UPDATE task_statuses 
        SET sort_order = _iterator
        WHERE id = _status_id::UUID;
        _iterator := _iterator + 1;
    END LOOP;

    RETURN;
END
$$;

CREATE OR REPLACE FUNCTION update_task(_body json) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _assignee      TEXT;
    _assignee_id   UUID;
    _label         JSON;
    _old_assignees JSON;
    _new_assignees JSON;
BEGIN
    UPDATE tasks
    SET name          = TRIM((_body ->> 'name')::TEXT),
        start_date    = (_body ->> 'start')::TIMESTAMPTZ,
        end_date      = (_body ->> 'end')::TIMESTAMPTZ,
        priority_id   = (_body ->> 'priority_id')::UUID,
        description   = COALESCE(TRIM((_body ->> 'description')::TEXT), description),
        total_minutes = (_body ->> 'total_minutes')::NUMERIC,
        status_id     = (_body ->> 'status_id')::UUID
    WHERE id = (_body ->> 'id')::UUID;

    SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
    INTO _old_assignees
    FROM (
             --
             SELECT team_member_id,
                    (SELECT user_id FROM team_members WHERE id = tasks_assignees.team_member_id),
                    (SELECT team_id FROM team_members WHERE id = tasks_assignees.team_member_id)
             FROM tasks_assignees
             WHERE task_id = (_body ->> 'id')::UUID
             --
         ) rec;

    -- delete existing task assignees
    DELETE FROM tasks_assignees WHERE task_id = (_body ->> 'id')::UUID;

    -- insert task assignees
    FOR _assignee IN SELECT * FROM JSON_ARRAY_ELEMENTS((_body ->> 'assignees')::JSON)
        LOOP
            _assignee_id = TRIM('"' FROM _assignee)::UUID;
            PERFORM create_task_assignee(_assignee_id, (_body ->> 'project_id')::UUID, (_body ->> 'id')::UUID,
                                         (_body ->> 'reporter_id')::UUID);
        END LOOP;

    IF ((_body ->> 'inline')::BOOLEAN IS FALSE)
    THEN
        DELETE FROM task_labels WHERE task_id = (_body ->> 'id')::UUID;
        FOR _label IN SELECT * FROM JSON_ARRAY_ELEMENTS((_body ->> 'labels')::JSON)
            LOOP
                PERFORM assign_or_create_label((_body ->> 'team_id')::UUID, (_body ->> 'id')::UUID,
                                               (_label ->> 'name')::TEXT,
                                               (_label ->> 'color')::TEXT);
            END LOOP;
    END IF;


    SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
    INTO _new_assignees
    FROM (
             --
             SELECT team_member_id,
                    (SELECT user_id FROM team_members WHERE id = tasks_assignees.team_member_id),
                    (SELECT team_id FROM team_members WHERE id = tasks_assignees.team_member_id)
             FROM tasks_assignees
             WHERE task_id = (_body ->> 'id')::UUID
             --
         ) rec;

    RETURN JSON_BUILD_OBJECT(
        'id', (_body ->> 'id')::UUID,
        'name', (_body ->> 'name')::TEXT,
        'old_assignees', _old_assignees,
        'new_assignees', _new_assignees
        );
END;
$$;

CREATE OR REPLACE FUNCTION update_task_status(_updated_task_id uuid, _status_id uuid, _task_ids json) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _iterator NUMERIC := 0;
    _task_id  TEXT;
BEGIN
    UPDATE tasks SET status_id = _status_id WHERE id = _updated_task_id;

    FOR _task_id IN SELECT * FROM JSON_ARRAY_ELEMENTS((_task_ids)::JSON)
        LOOP
            UPDATE tasks
            SET sort_order = _iterator
            WHERE id = (SELECT TRIM(BOTH '"' FROM _task_id))::UUID;
            _iterator := _iterator + 1;
        END LOOP;

    RETURN JSON_BUILD_OBJECT(
        'id', _updated_task_id
        );
END;
$$;

CREATE OR REPLACE FUNCTION update_task_status(_task_id uuid, _project_id uuid, _status_id uuid, _from_index integer, _to_index integer) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
BEGIN
    UPDATE tasks SET status_id = _status_id WHERE id = _task_id AND project_id = _project_id;

    IF (_from_index != _to_index)
    THEN
        IF _to_index > _from_index
        THEN
            UPDATE tasks
            SET sort_order = sort_order - 1
            WHERE project_id = _project_id
              AND sort_order > _from_index
              AND sort_order <= _to_index;
        END IF;

        IF _to_index < _from_index
        THEN
            UPDATE tasks
            SET sort_order = sort_order + 1
            WHERE project_id = _project_id
              AND sort_order >= _to_index
              AND sort_order < _from_index;
        END IF;

        UPDATE tasks SET sort_order = _to_index WHERE id = _task_id AND project_id = _project_id;
    END IF;

    RETURN JSON_BUILD_OBJECT(
        'id', _task_id
        );
END;
$$;

CREATE OR REPLACE FUNCTION update_task_template(_id uuid, _name text, _tasks json) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _task JSON;

BEGIN
    UPDATE task_templates SET name = _name, updated_at = NOW() WHERE id = _id;

    -- delete all existing tasks for the selected template
    DELETE FROM task_templates_tasks WHERE template_id = _id;

    -- insert tasks for task templates
    FOR _task IN SELECT * FROM JSON_ARRAY_ELEMENTS(_tasks)
        LOOP
            INSERT INTO task_templates_tasks (template_id, name) VALUES (_id, (_task ->> 'name')::TEXT);
        END LOOP;

    RETURN JSON_BUILD_OBJECT(
        'id', _id,
        'template_name', _name
        );
END
$$;

CREATE OR REPLACE FUNCTION update_team_member(_body json) RETURNS void
    LANGUAGE plpgsql
AS
$$
DECLARE
    _team_id      UUID;
    _job_title_id UUID;
    _role_id      UUID;
BEGIN
    _team_id = (_body ->> 'team_id')::UUID;

    -- Check if role_name is provided, otherwise fall back to is_admin flag
    IF is_null_or_empty((_body ->> 'role_name')) IS FALSE
    THEN
        SELECT id FROM roles WHERE name = (_body ->> 'role_name')::TEXT AND team_id = _team_id INTO _role_id;
    ELSIF ((_body ->> 'is_admin')::BOOLEAN IS TRUE)
    THEN
        SELECT id FROM roles WHERE team_id = _team_id AND admin_role IS TRUE AND name = 'Admin' INTO _role_id;
    ELSE
        SELECT id FROM roles WHERE team_id = _team_id AND default_role IS TRUE INTO _role_id;
    END IF;

    IF is_null_or_empty((_body ->> 'job_title')) IS FALSE
    THEN
        SELECT insert_job_title((_body ->> 'job_title')::TEXT, _team_id) INTO _job_title_id;
    ELSE
        _job_title_id = NULL;
    END IF;

    UPDATE team_members
    SET job_title_id = _job_title_id,
        role_id      = _role_id,
        updated_at   = CURRENT_TIMESTAMP
    WHERE id = (_body ->> 'id')::UUID
      AND team_id = _team_id;
END;
$$;

CREATE OR REPLACE FUNCTION update_team_name(_body json) RETURNS void
    LANGUAGE plpgsql
AS
$$
DECLARE
    _name TEXT;
BEGIN
    _name = (_body ->> 'name')::TEXT;

    IF ((SELECT name FROM teams WHERE id = (_body ->> 'id')::UUID) != _name)
    THEN
        UPDATE teams
        SET name       = _name,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = (_body ->> 'id')::UUID
          AND user_id = (_body ->> 'user_id')::UUID;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION update_existing_phase_colors(_body json) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    result         JSON;
    _phase         JSON;
BEGIN

    FOR _phase IN SELECT * FROM JSON_ARRAY_ELEMENTS((_body ->> 'phases')::JSON)
        LOOP
            UPDATE project_phases SET color_code = (_phase ->> 'color_code')::WL_HEX_COLOR WHERE id = (_phase ->> 'id')::UUID;
        END LOOP;

    SELECT ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec)))
    FROM (SELECT * FROM project_phases) rec
    INTO result;

    RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION update_existing_phase_sort_order(_body json) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    result         JSON;
    _phase         JSON;
BEGIN

    FOR _phase IN SELECT * FROM JSON_ARRAY_ELEMENTS((_body ->> 'phases')::JSON)
        LOOP
            UPDATE project_phases SET sort_index = (_phase ->> 'sort_number')::INT WHERE id = (_phase ->> 'id')::UUID AND project_id = (_phase ->> 'project_id')::UUID;
        END LOOP;

    SELECT ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec)))
    FROM (SELECT * FROM project_phases) rec
    INTO result;

    RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION handle_phase_sort_order(_body json) RETURNS void
    LANGUAGE plpgsql
AS
$$
DECLARE
    _phase      JSON;
    _sort_index INT := 0;
BEGIN

    FOR _phase IN SELECT * FROM JSON_ARRAY_ELEMENTS((_body ->> 'phases')::JSON)
        LOOP
            UPDATE project_phases SET sort_index = _sort_index::INT WHERE id = (_phase ->> 'id')::UUID AND project_id = (_body ->> 'project_id')::UUID;
            _sort_index = _sort_index + 1;
        END LOOP;
END
$$;

CREATE OR REPLACE FUNCTION bulk_change_tasks_priority(_body json, _userid uuid) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _task   JSON;
    _output JSON;
    _previous_priority UUID;
BEGIN
    FOR _task IN SELECT * FROM JSON_ARRAY_ELEMENTS((_body ->> 'tasks')::JSON)
        LOOP
            _previous_priority = (SELECT priority_id FROM tasks WHERE id = (_task ->> 'id')::UUID);

            UPDATE tasks SET priority_id = (_body ->> 'priority_id')::UUID WHERE id = (_task ->> 'id')::UUID;

            IF (_previous_priority IS DISTINCT FROM (_body ->> 'priority_id')::UUID)
                THEN
                    INSERT INTO task_activity_logs (task_id, team_id, attribute_type, user_id, log_type, old_value, new_value, project_id)
                    VALUES (
                            (_task ->> 'id')::UUID,
                            (SELECT team_id FROM projects WHERE id = (SELECT project_id FROM tasks WHERE id = (_task ->> 'id')::UUID)),
                            'priority',
                            _userId,
                            'update',
                            _previous_priority,
                            (_body ->> 'priority_id')::UUID,
                            (SELECT project_id FROM tasks WHERE id = (_task ->> 'id')::UUID)
                            );
            END IF;
        END LOOP;
    RETURN _output;
END;
$$;

CREATE OR REPLACE FUNCTION bulk_change_tasks_phase(_body json, _userid uuid) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _task   JSON;
    _output JSON;
    _previous_phase UUID;
BEGIN
    FOR _task IN SELECT * FROM JSON_ARRAY_ELEMENTS((_body ->> 'tasks')::JSON)
        LOOP
            _previous_phase = (SELECT phase_id FROM task_phase WHERE task_id = (_task ->> 'id')::UUID);

            IF NOT EXISTS(SELECT 1 FROM task_phase WHERE task_id = (_task ->> 'id')::UUID)
            THEN
                INSERT INTO task_phase (task_id, phase_id) VALUES ((_task ->> 'id')::UUID, (_body ->> 'phase_id')::UUID);
            ELSE
                UPDATE task_phase SET phase_id = (_body ->> 'phase_id')::UUID WHERE task_id = (_task ->> 'id')::UUID;
            END IF;

            IF (_previous_phase IS DISTINCT FROM (_body ->> 'phase_id')::UUID)
                THEN
                    INSERT INTO task_activity_logs (task_id, team_id, attribute_type, user_id, log_type, old_value, new_value, project_id)
                    VALUES (
                            (_task ->> 'id')::UUID,
                            (SELECT team_id FROM projects WHERE id = (SELECT project_id FROM tasks WHERE id = (_task ->> 'id')::UUID)),
                            'phase',
                            _userId,
                            'update',
                            _previous_phase,
                            (_body ->> 'phase_id')::UUID,
                            (SELECT project_id FROM tasks WHERE id = (_task ->> 'id')::UUID)
                            );
            END IF;


        END LOOP;
    RETURN _output;
END;
$$;

CREATE OR REPLACE FUNCTION bulk_assign_label(_body json, _user_id uuid) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _task   JSON;
    _label  JSON;
    _output JSON;
BEGIN
    FOR _task IN SELECT * FROM JSON_ARRAY_ELEMENTS((_body ->> 'tasks')::JSON)
        LOOP
            FOR _label IN SELECT * FROM JSON_ARRAY_ELEMENTS((_body ->> 'labels')::JSON)
                LOOP

                    DELETE FROM task_labels WHERE task_id = (_task ->> 'id')::UUID AND label_id = (_label ->> 'id')::UUID;

                    INSERT INTO task_labels (task_id, label_id) VALUES ((_task ->> 'id')::UUID, (_label ->> 'id')::UUID);

                    INSERT INTO task_activity_logs
                        (task_id, team_id, attribute_type, user_id, log_type, old_value, new_value, next_string, project_id)
                    VALUES
                        (
                            (_task ->> 'id')::UUID,
                            (SELECT team_id FROM projects WHERE id = (SELECT project_id FROM tasks WHERE tasks.id = (_task ->> 'id')::UUID)),
                            'label',
                            _user_id::UUID,
                            'create',
                            NULL,
                            (_label ->> 'id')::UUID,
                            NULL,
                            (SELECT project_id FROM tasks WHERE tasks.id = (_task ->> 'id')::UUID)
                        );

                END LOOP;
        END LOOP;

    RETURN _output;
END;
$$;

CREATE OR REPLACE FUNCTION update_phase_name(_phase_id uuid, _phase_name text, _template_id uuid) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _color_code TEXT;
BEGIN
    IF EXISTS(SELECT name
              FROM cpt_phases
              WHERE name = _phase_name
                AND template_id = _template_id)
    THEN
        RAISE 'PHASE_EXISTS_ERROR:%', _phase_name::TEXT;
    END IF;
    UPDATE cpt_phases
    SET name = _phase_name
    WHERE id = _phase_id
      AND template_id = _template_id
    RETURNING color_code INTO _color_code;

    RETURN JSON_BUILD_OBJECT(
            'color_code', _color_code,
            'id', _phase_id,
            'name', _phase_name
        );
END
$$;

CREATE OR REPLACE FUNCTION mark_bulk_refunds(coupon_data jsonb[]) RETURNS void
    LANGUAGE plpgsql
AS
$$
DECLARE
    data_record JSONB;
BEGIN
    FOREACH data_record IN ARRAY coupon_data
        LOOP
            UPDATE licensing_coupon_codes
            SET is_refunded = TRUE,
                reason      = TRIM(data_record ->> 'reason'),
                feedback    = TRIM(data_record ->> 'feedback'),
                refunded_at = (data_record ->> 'refund_date')::TIMESTAMPTZ
            WHERE coupon_code = (data_record ->> 'code')::TEXT;
        END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION is_overdue_for_date(_task_id uuid, _end_date date) RETURNS boolean
    LANGUAGE plpgsql
AS
$$
DECLARE
BEGIN
    RETURN EXISTS(SELECT 1
                  FROM tasks
                  WHERE id = _task_id
                    AND end_date < _end_date
                    AND is_completed(tasks.status_id, tasks.project_id) IS FALSE);
END
$$;

CREATE OR REPLACE FUNCTION is_completed_between(_task_id uuid, _start_date date, _end_date date) RETURNS boolean
    LANGUAGE plpgsql
AS
$$
DECLARE
    BEGIN
    RETURN EXISTS ( SELECT 1 FROM tasks WHERE id = _task_id AND completed_at::DATE >= _start_date::DATE AND completed_at::DATE <= _end_date::DATE);
END
$$;

CREATE OR REPLACE FUNCTION update_task_template(_id uuid, _name text, _tasks json, _team_id uuid) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _task JSON;

BEGIN

    -- check whether the project name is already in
    IF EXISTS(
        SELECT name FROM task_templates WHERE LOWER(name) = LOWER(_name)
                                    AND team_id = _team_id AND id != _id
    )
    THEN
        RAISE 'TASK_TEMPLATE_EXISTS_ERROR:%', _name;
    END IF;

    UPDATE task_templates SET name = _name, updated_at = NOW() WHERE id = _id;

    -- delete all existing tasks for the selected template
    DELETE FROM task_templates_tasks WHERE template_id = _id;

    -- insert tasks for task templates
    FOR _task IN SELECT * FROM JSON_ARRAY_ELEMENTS(_tasks)
        LOOP
            INSERT INTO task_templates_tasks (template_id, name) VALUES (_id, (_task ->> 'name')::TEXT);
        END LOOP;

    RETURN JSON_BUILD_OBJECT(
        'id', _id,
        'template_name', _name
        );
END
$$;

CREATE OR REPLACE FUNCTION insert_task_dependency(_task_id uuid, _related_task_id uuid, _dependency_type dependency_type DEFAULT 'blocked_by'::dependency_type) RETURNS void
    LANGUAGE plpgsql
AS
$$
BEGIN
    -- Attempt to insert into task_dependencies
    INSERT INTO task_dependencies (task_id, related_task_id, dependency_type)
    VALUES (_task_id, _related_task_id, _dependency_type)
    ON CONFLICT (task_id, related_task_id, dependency_type)
    DO NOTHING;

    -- Check if the insert was successful
    IF NOT FOUND THEN
        -- Raise an exception if a conflict was found
        RAISE EXCEPTION 'DEPENDENCY_EXISTS';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION can_update_task(_task_id uuid, _status_id uuid) RETURNS boolean
    LANGUAGE plpgsql
AS
$$
DECLARE
    -- Declare a variable to store whether the update can continue
    can_continue BOOLEAN;
BEGIN
    -- First, check if the status is not in the "done" category
    SELECT EXISTS (
        SELECT 1
        FROM task_statuses ts
        WHERE ts.id = _status_id
          AND ts.project_id = (SELECT project_id FROM tasks WHERE id = _task_id)
          AND ts.category_id IN (
              SELECT id FROM sys_task_status_categories WHERE is_done IS FALSE
          )
    ) INTO can_continue;

    -- If the status is not "done", continue the process
    IF can_continue THEN
        RETURN TRUE;
    END IF;

    -- If the status is "done", check if any dependent tasks are not completed
    SELECT NOT EXISTS (
        SELECT 1
        FROM task_dependencies td
        LEFT JOIN tasks t ON t.id = td.related_task_id
        WHERE td.task_id = _task_id
          AND t.status_id NOT IN (
              SELECT id
              FROM task_statuses ts
              WHERE t.project_id = ts.project_id
                AND ts.category_id IN (
                    SELECT id FROM sys_task_status_categories WHERE is_done IS TRUE
                )
          )
    ) INTO can_continue;

    -- Return whether the update can continue based on the dependent task completion check
    RETURN can_continue;
END;
$$;

CREATE OR REPLACE FUNCTION bulk_change_tasks_status(_body json, _userid uuid) RETURNS uuid[]
    LANGUAGE plpgsql
AS
$$
DECLARE
    _task            JSON;
    _output          JSON;
    _previous_status UUID;
    _failed_tasks    UUID[];
BEGIN

    FOR _task IN SELECT * FROM JSON_ARRAY_ELEMENTS((_body ->> 'tasks')::JSON)
        LOOP
            IF can_update_task((_task ->> 'id')::UUID, (_body ->> 'status_id')::UUID)
            THEN
                -- Proceed with the update if the task is eligible for update
                _previous_status = (SELECT status_id FROM tasks WHERE id = (_task ->> 'id')::UUID);

                UPDATE tasks SET status_id = (_body ->> 'status_id')::UUID WHERE id = (_task ->> 'id')::UUID;

                IF (_previous_status IS DISTINCT FROM (_body ->> 'status_id')::UUID)
                THEN
                    INSERT INTO task_activity_logs (task_id, team_id, attribute_type, user_id, log_type, old_value,
                                                    new_value, project_id)
                    VALUES ((_task ->> 'id')::UUID,
                            (SELECT team_id
                             FROM projects
                             WHERE id = (SELECT project_id FROM tasks WHERE id = (_task ->> 'id')::UUID)),
                            'status',
                            _userId,
                            'update',
                            _previous_status,
                            (_body ->> 'status_id')::UUID,
                            (SELECT project_id FROM tasks WHERE id = (_task ->> 'id')::UUID));
                END IF;
            ELSE
                -- Add failed task IDs to the array
                _failed_tasks := ARRAY_APPEND(_failed_tasks, (_task ->> 'id')::UUID);
            END IF;

        END LOOP;
    RETURN _failed_tasks;
END
$$;

CREATE OR REPLACE FUNCTION create_recurring_task_template(p_task_id uuid, p_schedule_id uuid) RETURNS uuid
    LANGUAGE plpgsql
AS
$$
DECLARE
    v_new_id UUID;
BEGIN
    INSERT INTO task_recurring_templates (
        id,
        task_id,
        schedule_id,
        name,
        description,
        end_date,
        priority_id,
        project_id,
        assignees,
        labels
    )
    SELECT
        uuid_generate_v4(),
        t.id AS task_id,
        p_schedule_id,
        t.name,
        t.description,
        t.end_date,
        t.priority_id,
        t.project_id,
        COALESCE(
            (SELECT JSONB_AGG(JSONB_BUILD_OBJECT('project_member_id', tas.project_member_id, 'team_member_id', tas.team_member_id))
             FROM tasks_assignees tas
             WHERE tas.task_id = t.id),
            '[]'::JSONB
        ) AS assignees,
        COALESCE(
            (SELECT JSONB_AGG(JSONB_BUILD_OBJECT('label_id', tla.label_id))
             FROM task_labels tla
             WHERE tla.task_id = t.id),
            '[]'::JSONB
        ) AS labels
    FROM tasks t
    WHERE t.id = p_task_id
    RETURNING id INTO v_new_id;

    RETURN v_new_id;
END;
$$;

CREATE OR REPLACE FUNCTION transfer_team_ownership(_team_id UUID, _new_owner_id UUID) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _old_owner_id UUID;
    _owner_role_id UUID;
    _admin_role_id UUID;
    _old_org_id UUID;
    _new_org_id UUID;
    _has_license BOOLEAN;
    _old_owner_role_id UUID;
    _new_owner_role_id UUID;
    _has_active_coupon BOOLEAN;
    _other_teams_count INTEGER;
    _new_owner_org_id UUID;
    _license_type_id UUID;
    _has_valid_license BOOLEAN;
BEGIN
    -- Get the current owner's ID and organization
    SELECT t.user_id, t.organization_id 
    INTO _old_owner_id, _old_org_id 
    FROM teams t 
    WHERE t.id = _team_id;
    
    IF _old_owner_id IS NULL THEN
        RAISE EXCEPTION 'Team not found';
    END IF;

    -- Get the new owner's organization
    SELECT organization_id INTO _new_owner_org_id
    FROM organizations
    WHERE user_id = _new_owner_id;

    -- Get the old organization
    SELECT id INTO _old_org_id
    FROM organizations
    WHERE id = _old_org_id;

    IF _old_org_id IS NULL THEN
        RAISE EXCEPTION 'Organization not found';
    END IF;

    -- Check if new owner has any valid license type
    SELECT EXISTS (
        SELECT 1 
        FROM (
            -- Check regular subscriptions
            SELECT lus.user_id, lus.status, lus.active
            FROM licensing_user_subscriptions lus
            WHERE lus.user_id = _new_owner_id 
            AND lus.active = TRUE
            AND lus.status IN ('active', 'trialing')
            
            UNION ALL
            
            -- Check custom subscriptions
            SELECT lcs.user_id, lcs.subscription_status as status, TRUE as active
            FROM licensing_custom_subs lcs
            WHERE lcs.user_id = _new_owner_id
            AND lcs.end_date > CURRENT_DATE
            
            UNION ALL
            
            -- Check trial status in organizations
            SELECT o.user_id, o.subscription_status as status, TRUE as active
            FROM organizations o
            WHERE o.user_id = _new_owner_id
            AND o.trial_in_progress = TRUE
            AND o.trial_expire_date > CURRENT_DATE
        ) valid_licenses
    ) INTO _has_valid_license;

    IF NOT _has_valid_license THEN
        RAISE EXCEPTION 'New owner does not have a valid license (subscription, custom subscription, or trial)';
    END IF;

    -- Check if new owner has any active coupon codes
    SELECT EXISTS (
        SELECT 1 
        FROM licensing_coupon_codes lcc
        WHERE lcc.redeemed_by = _new_owner_id 
        AND lcc.is_redeemed = TRUE
        AND lcc.is_refunded = FALSE
    ) INTO _has_active_coupon;

    IF _has_active_coupon THEN
        RAISE EXCEPTION 'New owner has active coupon codes that need to be handled before transfer';
    END IF;

    -- Count other teams in the organization for information purposes
    SELECT COUNT(*) INTO _other_teams_count
    FROM teams
    WHERE organization_id = _old_org_id
    AND id != _team_id;

    -- If new owner has their own organization, move the team to their organization
    IF _new_owner_org_id IS NOT NULL THEN
        -- Update the team to use the new owner's organization
        UPDATE teams 
        SET user_id = _new_owner_id,
            organization_id = _new_owner_org_id
        WHERE id = _team_id;
        
        -- Create notification about organization change
        PERFORM create_notification(
            _old_owner_id,
            _team_id,
            NULL,
            NULL,
            CONCAT('Team <b>', (SELECT name FROM teams WHERE id = _team_id), '</b> has been moved to a different organization')
        );

        PERFORM create_notification(
            _new_owner_id,
            _team_id,
            NULL,
            NULL,
            CONCAT('Team <b>', (SELECT name FROM teams WHERE id = _team_id), '</b> has been moved to your organization')
        );
    ELSE
        -- If new owner doesn't have an organization, transfer the old organization to them
        UPDATE organizations
        SET user_id = _new_owner_id
        WHERE id = _old_org_id;
        
        -- Update the team to use the same organization
        UPDATE teams 
        SET user_id = _new_owner_id,
            organization_id = _old_org_id
        WHERE id = _team_id;

        -- Notify both users about organization ownership transfer
        PERFORM create_notification(
            _old_owner_id,
            NULL,
            NULL,
            NULL,
            CONCAT('You are no longer the owner of organization <b>', (SELECT organization_name FROM organizations WHERE id = _old_org_id), '</b>')
        );

        PERFORM create_notification(
            _new_owner_id,
            NULL,
            NULL,
            NULL,
            CONCAT('You are now the owner of organization <b>', (SELECT organization_name FROM organizations WHERE id = _old_org_id), '</b>')
        );
    END IF;
    
    -- Get the owner and admin role IDs
    SELECT id INTO _owner_role_id FROM roles WHERE team_id = _team_id AND owner = TRUE;
    SELECT id INTO _admin_role_id FROM roles WHERE team_id = _team_id AND admin_role = TRUE;

    -- Get current role IDs for both users
    SELECT role_id INTO _old_owner_role_id 
    FROM team_members 
    WHERE team_id = _team_id AND user_id = _old_owner_id;

    SELECT role_id INTO _new_owner_role_id 
    FROM team_members 
    WHERE team_id = _team_id AND user_id = _new_owner_id;
    
    -- Update the old owner's role to admin if they want to stay in the team
    IF _old_owner_role_id IS NOT NULL THEN
        UPDATE team_members 
        SET role_id = _admin_role_id 
        WHERE team_id = _team_id AND user_id = _old_owner_id;
    END IF;
    
    -- Update the new owner's role to owner
    IF _new_owner_role_id IS NOT NULL THEN
        UPDATE team_members 
        SET role_id = _owner_role_id 
        WHERE team_id = _team_id AND user_id = _new_owner_id;
    ELSE
        -- If new owner is not a team member yet, add them
        INSERT INTO team_members (user_id, team_id, role_id)
        VALUES (_new_owner_id, _team_id, _owner_role_id);
    END IF;

    -- Create notification for both users about team ownership
    PERFORM create_notification(
        _old_owner_id,
        _team_id,
        NULL,
        NULL,
        CONCAT('You are no longer the owner of team <b>', (SELECT name FROM teams WHERE id = _team_id), '</b>')
    );

    PERFORM create_notification(
        _new_owner_id,
        _team_id,
        NULL,
        NULL,
        CONCAT('You are now the owner of team <b>', (SELECT name FROM teams WHERE id = _team_id), '</b>')
    );
    
    RETURN json_build_object(
        'success', TRUE,
        'old_owner_id', _old_owner_id,
        'new_owner_id', _new_owner_id,
        'team_id', _team_id,
        'old_org_id', _old_org_id,
        'new_org_id', COALESCE(_new_owner_org_id, _old_org_id),
        'old_role_id', _old_owner_role_id,
        'new_role_id', _new_owner_role_id,
        'has_valid_license', _has_valid_license,
        'has_active_coupon', _has_active_coupon,
        'other_teams_count', _other_teams_count,
        'org_ownership_transferred', _new_owner_org_id IS NULL,
        'team_moved_to_new_org', _new_owner_org_id IS NOT NULL
    );
END;
$$;

-- PERFORMANCE OPTIMIZATION: Optimized version with batching for large datasets
CREATE OR REPLACE FUNCTION handle_task_list_sort_between_groups_optimized(_from_index integer, _to_index integer, _task_id uuid, _project_id uuid, _batch_size integer DEFAULT 100) RETURNS void
    LANGUAGE plpgsql
AS
$$
DECLARE
    _offset INT := 0;
    _affected_rows INT;
BEGIN
    -- PERFORMANCE OPTIMIZATION: Use direct updates without CTE in UPDATE
    IF (_to_index = -1)
    THEN
        _to_index = COALESCE((SELECT MAX(sort_order) + 1 FROM tasks WHERE project_id = _project_id), 0);
    END IF;

    -- PERFORMANCE OPTIMIZATION: Batch updates for large datasets
    IF _to_index > _from_index
    THEN
        LOOP
            UPDATE tasks
            SET sort_order = sort_order - 1
            WHERE project_id = _project_id
              AND sort_order > _from_index
              AND sort_order < _to_index
              AND sort_order > _offset
              AND sort_order <= _offset + _batch_size;
            
            GET DIAGNOSTICS _affected_rows = ROW_COUNT;
            EXIT WHEN _affected_rows = 0;
            _offset := _offset + _batch_size;
        END LOOP;

        UPDATE tasks SET sort_order = _to_index - 1 WHERE id = _task_id AND project_id = _project_id;
    END IF;

    IF _to_index < _from_index
    THEN
        _offset := 0;
        LOOP
            UPDATE tasks
            SET sort_order = sort_order + 1
            WHERE project_id = _project_id
              AND sort_order > _to_index
              AND sort_order < _from_index
              AND sort_order > _offset
              AND sort_order <= _offset + _batch_size;
            
            GET DIAGNOSTICS _affected_rows = ROW_COUNT;
            EXIT WHEN _affected_rows = 0;
            _offset := _offset + _batch_size;
        END LOOP;

        UPDATE tasks SET sort_order = _to_index + 1 WHERE id = _task_id AND project_id = _project_id;
    END IF;
END
$$;

-- PERFORMANCE OPTIMIZATION: Optimized version with batching for large datasets
CREATE OR REPLACE FUNCTION handle_task_list_sort_inside_group_optimized(_from_index integer, _to_index integer, _task_id uuid, _project_id uuid, _batch_size integer DEFAULT 100) RETURNS void
    LANGUAGE plpgsql
AS
$$
DECLARE
    _offset INT := 0;
    _affected_rows INT;
BEGIN
    -- PERFORMANCE OPTIMIZATION: Batch updates for large datasets without CTE in UPDATE
    IF _to_index > _from_index
    THEN
        LOOP
            UPDATE tasks
            SET sort_order = sort_order - 1
            WHERE project_id = _project_id
              AND sort_order > _from_index
              AND sort_order <= _to_index
              AND sort_order > _offset
              AND sort_order <= _offset + _batch_size;
            
            GET DIAGNOSTICS _affected_rows = ROW_COUNT;
            EXIT WHEN _affected_rows = 0;
            _offset := _offset + _batch_size;
        END LOOP;
    END IF;

    IF _to_index < _from_index
    THEN
        _offset := 0;
        LOOP
            UPDATE tasks
            SET sort_order = sort_order + 1
            WHERE project_id = _project_id
              AND sort_order >= _to_index
              AND sort_order < _from_index
              AND sort_order > _offset
              AND sort_order <= _offset + _batch_size;
            
            GET DIAGNOSTICS _affected_rows = ROW_COUNT;
            EXIT WHEN _affected_rows = 0;
            _offset := _offset + _batch_size;
        END LOOP;
    END IF;

    UPDATE tasks SET sort_order = _to_index WHERE id = _task_id AND project_id = _project_id;
END
$$;

-- Updated bulk sort order function that avoids sort_order conflicts
CREATE OR REPLACE FUNCTION update_task_sort_orders_bulk(_updates json, _group_by text DEFAULT 'status') RETURNS void
    LANGUAGE plpgsql
AS
$$
DECLARE
    _update_record RECORD;
    _sort_column TEXT;
    _sql TEXT;
BEGIN
    -- Get the appropriate sort column based on grouping
    _sort_column := get_sort_column_name(_group_by);
    
    -- Process each update record
    FOR _update_record IN 
        SELECT 
            (item->>'task_id')::uuid as task_id,
            (item->>'sort_order')::int as sort_order,
            (item->>'status_id')::uuid as status_id,
            (item->>'priority_id')::uuid as priority_id,
            (item->>'phase_id')::uuid as phase_id
        FROM json_array_elements(_updates) as item
    LOOP
        -- Update the grouping-specific sort column and other fields
        _sql := 'UPDATE tasks SET ' || _sort_column || ' = $1, ' ||
                'status_id = COALESCE($2, status_id), ' ||
                'priority_id = COALESCE($3, priority_id), ' ||
                'updated_at = CURRENT_TIMESTAMP ' ||
                'WHERE id = $4';
        
        EXECUTE _sql USING 
            _update_record.sort_order,
            _update_record.status_id,
            _update_record.priority_id,
            _update_record.task_id;
        
        -- Handle phase updates separately since it's in a different table
        IF _update_record.phase_id IS NOT NULL THEN
            INSERT INTO task_phase (task_id, phase_id)
            VALUES (_update_record.task_id, _update_record.phase_id)
            ON CONFLICT (task_id) DO UPDATE SET phase_id = _update_record.phase_id;
        END IF;
    END LOOP;
END
$$;

-- Function to get the appropriate sort column name based on grouping type
CREATE OR REPLACE FUNCTION get_sort_column_name(_group_by TEXT) RETURNS TEXT
    LANGUAGE plpgsql
AS
$$
BEGIN
    CASE _group_by
        WHEN 'status' THEN RETURN 'status_sort_order';
        WHEN 'priority' THEN RETURN 'priority_sort_order';
        WHEN 'phase' THEN RETURN 'phase_sort_order';
        -- For backward compatibility, still support general sort_order but be explicit
        WHEN 'general' THEN RETURN 'sort_order';
        ELSE RETURN 'status_sort_order'; -- Default to status sorting
    END CASE;
END;
$$;

-- Updated bulk sort order function to handle different sort columns
CREATE OR REPLACE FUNCTION update_task_sort_orders_bulk(_updates json, _group_by text DEFAULT 'status') RETURNS void
    LANGUAGE plpgsql
AS
$$
DECLARE
    _update_record RECORD;
    _sort_column TEXT;
    _sql TEXT;
BEGIN
    -- Get the appropriate sort column based on grouping
    _sort_column := get_sort_column_name(_group_by);
    
    -- Process each update record
    FOR _update_record IN 
        SELECT 
            (item->>'task_id')::uuid as task_id,
            (item->>'sort_order')::int as sort_order,
            (item->>'status_id')::uuid as status_id,
            (item->>'priority_id')::uuid as priority_id,
            (item->>'phase_id')::uuid as phase_id
        FROM json_array_elements(_updates) as item
    LOOP
        -- Update the grouping-specific sort column and other fields
        _sql := 'UPDATE tasks SET ' || _sort_column || ' = $1, ' ||
                'status_id = COALESCE($2, status_id), ' ||
                'priority_id = COALESCE($3, priority_id), ' ||
                'updated_at = CURRENT_TIMESTAMP ' ||
                'WHERE id = $4';
        
        EXECUTE _sql USING 
            _update_record.sort_order,
            _update_record.status_id,
            _update_record.priority_id,
            _update_record.task_id;
        
        -- Handle phase updates separately since it's in a different table
        IF _update_record.phase_id IS NOT NULL THEN
            INSERT INTO task_phase (task_id, phase_id)
            VALUES (_update_record.task_id, _update_record.phase_id)
            ON CONFLICT (task_id) DO UPDATE SET phase_id = _update_record.phase_id;
        END IF;
    END LOOP;
END;
$$;
