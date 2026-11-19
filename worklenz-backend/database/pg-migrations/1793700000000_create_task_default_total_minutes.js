/**
 * Migration: Default missing total_minutes in create_task()
 * Date: 2026-11-04
 *
 * create_task() inserts total_minutes from the JSON body. When callers omit it
 * (e.g. change-request convert, ticket convert), Postgres receives NULL and
 * violates tasks.total_minutes NOT NULL — the column DEFAULT is not applied
 * because the column is listed in the INSERT. Match create_task_template and
 * use COALESCE(..., 0).
 */

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
CREATE OR REPLACE FUNCTION create_task(_body json) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _assignee                     TEXT;
    _attachment_id                TEXT;
    _assignee_id                  UUID;
    _task_id                      UUID;
    _label                        JSON;
    _auto_assign_task_creator     BOOLEAN;
    _auto_assign_subtask_phase    BOOLEAN;
    _parent_phase_id              UUID;
    _phase_id_to_assign           UUID;
    _reporter_id                  UUID;
    _project_id                   UUID;
    _team_id                      UUID;
    _team_member_id               UUID;
    _is_admin                     BOOLEAN;
    _already_assigned             BOOLEAN := FALSE;
    _parent_task_id               UUID;
BEGIN
    _reporter_id = (_body ->> 'reporter_id')::UUID;
    _project_id = (_body ->> 'project_id')::UUID;
    _team_id = (_body ->> 'team_id')::UUID;
    _parent_task_id = (_body ->> 'parent_task_id')::UUID;

    IF _parent_task_id IS NOT NULL THEN
        SELECT p.auto_assign_subtask_phase, tp.phase_id
        INTO _auto_assign_subtask_phase, _parent_phase_id
        FROM projects p
        LEFT JOIN task_phase tp ON tp.task_id = _parent_task_id
        WHERE p.id = _project_id;
    END IF;

    IF (_body ->> 'phase_id')::UUID IS NOT NULL THEN
        _phase_id_to_assign := (_body ->> 'phase_id')::UUID;
    ELSIF _auto_assign_subtask_phase IS TRUE AND _parent_phase_id IS NOT NULL THEN
        _phase_id_to_assign := _parent_phase_id;
    ELSE
        _phase_id_to_assign := NULL;
    END IF;

    INSERT INTO tasks (name, done, priority_id, project_id, reporter_id, start_date, end_date, total_minutes,
                       description, parent_task_id, status_id, sort_order)
    VALUES (TRIM((_body ->> 'name')::TEXT), (FALSE),
            COALESCE((_body ->> 'priority_id')::UUID, (SELECT id FROM task_priorities WHERE value = 1)),
            _project_id,
            _reporter_id,
            (_body ->> 'start')::TIMESTAMPTZ,
            (_body ->> 'end')::TIMESTAMPTZ,
            COALESCE((_body ->> 'total_minutes')::NUMERIC, 0),
            (_body ->> 'description')::TEXT,
            _parent_task_id,
            (_body ->> 'status_id')::UUID,
            COALESCE((SELECT MAX(sort_order) + 1 FROM tasks WHERE project_id = _project_id), 0))
    RETURNING id INTO _task_id;

    IF _phase_id_to_assign IS NOT NULL THEN
        PERFORM handle_on_task_phase_change(_task_id, _phase_id_to_assign);
    END IF;

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
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  // Restore previous behavior (explicit NULL when body omits total_minutes).
  pgm.sql(`
CREATE OR REPLACE FUNCTION create_task(_body json) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _assignee                     TEXT;
    _attachment_id                TEXT;
    _assignee_id                  UUID;
    _task_id                      UUID;
    _label                        JSON;
    _auto_assign_task_creator     BOOLEAN;
    _auto_assign_subtask_phase    BOOLEAN;
    _parent_phase_id              UUID;
    _phase_id_to_assign           UUID;
    _reporter_id                  UUID;
    _project_id                   UUID;
    _team_id                      UUID;
    _team_member_id               UUID;
    _is_admin                     BOOLEAN;
    _already_assigned             BOOLEAN := FALSE;
    _parent_task_id               UUID;
BEGIN
    _reporter_id = (_body ->> 'reporter_id')::UUID;
    _project_id = (_body ->> 'project_id')::UUID;
    _team_id = (_body ->> 'team_id')::UUID;
    _parent_task_id = (_body ->> 'parent_task_id')::UUID;

    IF _parent_task_id IS NOT NULL THEN
        SELECT p.auto_assign_subtask_phase, tp.phase_id
        INTO _auto_assign_subtask_phase, _parent_phase_id
        FROM projects p
        LEFT JOIN task_phase tp ON tp.task_id = _parent_task_id
        WHERE p.id = _project_id;
    END IF;

    IF (_body ->> 'phase_id')::UUID IS NOT NULL THEN
        _phase_id_to_assign := (_body ->> 'phase_id')::UUID;
    ELSIF _auto_assign_subtask_phase IS TRUE AND _parent_phase_id IS NOT NULL THEN
        _phase_id_to_assign := _parent_phase_id;
    ELSE
        _phase_id_to_assign := NULL;
    END IF;

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
            _parent_task_id,
            (_body ->> 'status_id')::UUID,
            COALESCE((SELECT MAX(sort_order) + 1 FROM tasks WHERE project_id = _project_id), 0))
    RETURNING id INTO _task_id;

    IF _phase_id_to_assign IS NOT NULL THEN
        PERFORM handle_on_task_phase_change(_task_id, _phase_id_to_assign);
    END IF;

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
  `);
};
