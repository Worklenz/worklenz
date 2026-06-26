-- Migration: Add invited team members as project members during account setup
-- Date: 2026-02-24
-- Description: Modifies complete_account_setup function to automatically add invited team members
--              to the newly created project, not just to the team. This ensures invited members
--              have immediate access to the project created during account setup.

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
    _member            JSON;
    _invited_team_member_id UUID;
    _project_member_result JSON;
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
        
        -- NEW: Add each invited team member to the project as well
        -- This ensures they have access to the project, not just the team
        IF _members IS NOT NULL
        THEN
            FOR _member IN SELECT * FROM JSON_ARRAY_ELEMENTS(_members)
            LOOP
                _invited_team_member_id = (_member ->> 'team_member_id')::UUID;
                
                -- Only add to project if team_member_id exists (member was successfully created)
                IF _invited_team_member_id IS NOT NULL
                THEN
                    -- Add the invited team member to the project with MEMBER access level
                    SELECT create_project_member(JSON_BUILD_OBJECT(
                        'team_member_id', _invited_team_member_id,
                        'team_id', _team_id,
                        'project_id', _project_id,
                        'user_id', _user_id,
                        'access_level', 'MEMBER'
                    )) INTO _project_member_result;
                END IF;
            END LOOP;
        END IF;
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
