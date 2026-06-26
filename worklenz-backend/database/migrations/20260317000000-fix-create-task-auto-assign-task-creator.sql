-- Migration: Restore task creator auto-assignment in create_task()
-- Problem: create_task() lost the auto-assign branch even though the project setting
--          and create_quick_task() still support it. Standard task creation therefore
--          skips assigning the creator when auto_assign_task_creator is enabled.
-- Created: 2026-03-17

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

    FOR _assignee IN SELECT * FROM JSON_ARRAY_ELEMENTS((_body ->> 'assignees')::JSON)
        LOOP
            _assignee_id = TRIM('"' FROM _assignee)::UUID;
            PERFORM create_task_assignee(_assignee_id, _project_id, _task_id, _reporter_id);

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
            PERFORM assign_or_create_label(_team_id, _task_id, (_label ->> 'name')::TEXT, (_label ->> 'color')::TEXT);
        END LOOP;

    IF _already_assigned IS FALSE THEN
        SELECT auto_assign_task_creator INTO _auto_assign_task_creator
        FROM projects
        WHERE id = _project_id;

        IF _auto_assign_task_creator IS TRUE THEN
            SELECT tm.id, (r.admin_role OR r.owner) INTO _team_member_id, _is_admin
            FROM team_members tm
            INNER JOIN roles r ON tm.role_id = r.id
            WHERE tm.user_id = _reporter_id
              AND tm.team_id = _team_id;

            IF _team_member_id IS NOT NULL THEN
                IF NOT EXISTS (
                    SELECT 1
                    FROM project_members
                    WHERE project_id = _project_id
                      AND team_member_id = _team_member_id
                ) THEN
                    IF _is_admin IS TRUE THEN
                        PERFORM create_task_assignee(_team_member_id, _project_id, _task_id, _reporter_id);
                    END IF;
                ELSE
                    PERFORM create_task_assignee(_team_member_id, _project_id, _task_id, _reporter_id);
                END IF;
            END IF;
        END IF;
    END IF;

    RETURN get_task_form_view_model(_reporter_id, _team_id, _task_id, _project_id);
END;
$$;
