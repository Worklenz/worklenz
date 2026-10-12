/**
 * Migration: Add subtask phase inheritance on creation
 * Date: 2026-09-07
 * Description: When auto_assign_subtask_phase is enabled for a project,
 *              newly created subtasks automatically inherit their parent task's phase_id.
 *              
 *              Priority order at creation:
 *              1. Explicit phase_id in request body (user selection wins)
 *              2. Parent task's phase_id (if setting ON and parent has phase)
 *              3. NULL (unmapped)
 *              
 *              Note: Explicit phase wins at creation, but will be overwritten by
 *              cascade sync when parent's phase changes (implemented in later migration).
 *              This is Option 2 from EXPLICIT_PHASE_SELECTION_ANALYSIS.md.
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

    -- If this is a subtask and phase inheritance is enabled, get parent's phase from task_phase
    IF _parent_task_id IS NOT NULL THEN
        SELECT p.auto_assign_subtask_phase, tp.phase_id
        INTO _auto_assign_subtask_phase, _parent_phase_id
        FROM projects p
        LEFT JOIN task_phase tp ON tp.task_id = _parent_task_id
        WHERE p.id = _project_id;
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

    -- Assign phase via junction table (tasks has no phase_id column)
    IF (_body ->> 'phase_id')::UUID IS NOT NULL THEN
        PERFORM handle_on_task_phase_change(_task_id, (_body ->> 'phase_id')::UUID);
    ELSIF _auto_assign_subtask_phase IS TRUE AND _parent_phase_id IS NOT NULL THEN
        PERFORM handle_on_task_phase_change(_task_id, _parent_phase_id);
    END IF;

    -- Insert task assignees from the request.
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

    -- Auto-assign the creator unless they were explicitly assigned already.
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

  // Add comment documenting the new behavior
  pgm.sql(`
    COMMENT ON FUNCTION create_task(json) IS 
    'Creates a new task. For subtasks: explicit phase_id in request wins, otherwise inherits parent phase when auto_assign_subtask_phase is enabled. Parent phase always wins on future cascade updates.';
  `);

  // Update create_quick_task function (used by List/Board views for inline creation)
  pgm.sql(`
CREATE OR REPLACE FUNCTION create_quick_task(_body json) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _task_id                      UUID;
    _parent_task                  UUID;
    _status_id                    UUID;
    _priority_id                  UUID;
    _start_date                   TIMESTAMP;
    _end_date                     TIMESTAMP;
    _schedule_id                  UUID;
    _description                  TEXT;
    _next_sort_order              INTEGER;
    _auto_assign_task_creator     BOOLEAN;
    _auto_assign_subtask_phase    BOOLEAN;
    _parent_phase_id              UUID;
    _reporter_id                  UUID;
    _project_id                   UUID;
    _team_id                      UUID;
    _team_member_id               UUID;
    _is_admin                     BOOLEAN;
    _phase_id_to_assign           UUID;
BEGIN
    _reporter_id = (_body ->> 'reporter_id')::UUID;
    _project_id  = (_body ->> 'project_id')::UUID;
    _parent_task = (_body ->> 'parent_task_id')::UUID;
    _schedule_id = (_body ->> 'schedule_id')::UUID;
    _description = (_body ->> 'description')::TEXT;

    -- If this is a subtask and phase inheritance is enabled, get parent's phase from task_phase
    IF _parent_task IS NOT NULL THEN
        SELECT p.auto_assign_subtask_phase, tp.phase_id
        INTO _auto_assign_subtask_phase, _parent_phase_id
        FROM projects p
        LEFT JOIN task_phase tp ON tp.task_id = _parent_task
        WHERE p.id = _project_id;
    END IF;

    -- Priority: explicit phase_id wins, then parent's phase if setting enabled, else NULL
    IF (_body ->> 'phase_id')::UUID IS NOT NULL THEN
        -- User explicitly provided a phase_id, use it
        _phase_id_to_assign := (_body ->> 'phase_id')::UUID;
    ELSIF _auto_assign_subtask_phase IS TRUE AND _parent_phase_id IS NOT NULL THEN
        -- No explicit phase, but setting is ON and parent has phase, inherit it
        _phase_id_to_assign := _parent_phase_id;
    ELSE
        -- No explicit phase, no parent phase, or setting is OFF
        _phase_id_to_assign := NULL;
    END IF;

    _status_id := COALESCE(
        (_body ->> 'status_id')::UUID,
        (SELECT id
         FROM task_statuses
         WHERE project_id = _project_id
           AND category_id IN (SELECT id FROM sys_task_status_categories WHERE is_todo IS TRUE)
         LIMIT 1)
    );
    _priority_id := COALESCE((_body ->> 'priority_id')::UUID, (SELECT id FROM task_priorities WHERE value = 1));
    _start_date  := (_body ->> 'start_date')::TIMESTAMP;
    _end_date    := (_body ->> 'end_date')::TIMESTAMP;

    -- Calculate the next sort order value once and apply it to every sort column.
    SELECT COALESCE(MAX(GREATEST(
        COALESCE(sort_order, 0),
        COALESCE(roadmap_sort_order, 0),
        COALESCE(status_sort_order, 0),
        COALESCE(priority_sort_order, 0),
        COALESCE(phase_sort_order, 0),
        COALESCE(member_sort_order, 0)
    )) + 1, 0)
    INTO _next_sort_order
    FROM tasks
    WHERE project_id = _project_id;

    INSERT INTO tasks (
        name,
        priority_id,
        project_id,
        reporter_id,
        status_id,
        parent_task_id,
        sort_order,
        roadmap_sort_order,
        status_sort_order,
        priority_sort_order,
        phase_sort_order,
        member_sort_order,
        start_date,
        end_date,
        schedule_id,
        description
    )
    VALUES (
        SUBSTRING(TRIM((_body ->> 'name')::TEXT), 1, 250),
        _priority_id,
        _project_id,
        _reporter_id,
        _status_id,
        _parent_task,
        _next_sort_order,
        _next_sort_order,
        _next_sort_order,
        _next_sort_order,
        _next_sort_order,
        _next_sort_order,
        _start_date,
        _end_date,
        _schedule_id,
        _description
    )
    RETURNING id INTO _task_id;

    -- Use the inherited or explicit phase_id
    PERFORM handle_on_task_phase_change(_task_id, _phase_id_to_assign);

    -- Check if auto-assign is enabled for this project
    SELECT auto_assign_task_creator, team_id
    INTO _auto_assign_task_creator, _team_id
    FROM projects
    WHERE id = _project_id;

    -- If auto-assign is enabled, assign the task creator
    IF _auto_assign_task_creator IS TRUE THEN
        SELECT tm.id, (r.admin_role OR r.owner)
        INTO _team_member_id, _is_admin
        FROM team_members tm
        INNER JOIN roles r ON tm.role_id = r.id
        WHERE tm.user_id = _reporter_id
          AND tm.team_id = _team_id;

        IF _team_member_id IS NOT NULL THEN
            IF NOT EXISTS (
                SELECT 1 FROM project_members
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

    RETURN get_single_task(_task_id);
END;
$$;
  `);

  pgm.sql(`
    COMMENT ON FUNCTION create_quick_task(json) IS 
    'Creates a task quickly (used by inline creation in List/Board views). For subtasks: explicit phase_id in request wins, otherwise inherits parent phase when auto_assign_subtask_phase is enabled.';
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  // Restore previous version without phase inheritance
  pgm.sql(`
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

    -- Insert task assignees from the request.
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

    -- Auto-assign the creator unless they were explicitly assigned already.
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

  // Restore previous create_quick_task without phase inheritance
  pgm.sql(`
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
    _schedule_id              UUID;
    _description              TEXT;
    _next_sort_order          INTEGER;
    _auto_assign_task_creator BOOLEAN;
    _reporter_id              UUID;
    _project_id               UUID;
    _team_id                  UUID;
    _team_member_id           UUID;
    _is_admin                 BOOLEAN;
BEGIN
    _reporter_id := (_body ->> 'reporter_id')::UUID;
    _project_id  := (_body ->> 'project_id')::UUID;
    _parent_task := (_body ->> 'parent_task_id')::UUID;
    _schedule_id := (_body ->> 'schedule_id')::UUID;
    _description := (_body ->> 'description')::TEXT;

    _status_id := COALESCE(
        (_body ->> 'status_id')::UUID,
        (SELECT id
         FROM task_statuses
         WHERE project_id = _project_id
           AND category_id IN (SELECT id FROM sys_task_status_categories WHERE is_todo IS TRUE)
         LIMIT 1)
    );
    _priority_id := COALESCE((_body ->> 'priority_id')::UUID, (SELECT id FROM task_priorities WHERE value = 1));
    _start_date  := (_body ->> 'start_date')::TIMESTAMP;
    _end_date    := (_body ->> 'end_date')::TIMESTAMP;

    SELECT COALESCE(MAX(GREATEST(
        COALESCE(sort_order, 0),
        COALESCE(roadmap_sort_order, 0),
        COALESCE(status_sort_order, 0),
        COALESCE(priority_sort_order, 0),
        COALESCE(phase_sort_order, 0),
        COALESCE(member_sort_order, 0)
    )) + 1, 0)
    INTO _next_sort_order
    FROM tasks
    WHERE project_id = _project_id;

    INSERT INTO tasks (
        name,
        priority_id,
        project_id,
        reporter_id,
        status_id,
        parent_task_id,
        sort_order,
        roadmap_sort_order,
        status_sort_order,
        priority_sort_order,
        phase_sort_order,
        member_sort_order,
        start_date,
        end_date,
        schedule_id,
        description
    )
    VALUES (
        SUBSTRING(TRIM((_body ->> 'name')::TEXT), 1, 250),
        _priority_id,
        _project_id,
        _reporter_id,
        _status_id,
        _parent_task,
        _next_sort_order,
        _next_sort_order,
        _next_sort_order,
        _next_sort_order,
        _next_sort_order,
        _next_sort_order,
        _start_date,
        _end_date,
        _schedule_id,
        _description
    )
    RETURNING id INTO _task_id;

    PERFORM handle_on_task_phase_change(_task_id, (_body ->> 'phase_id')::UUID);

    SELECT auto_assign_task_creator, team_id
    INTO _auto_assign_task_creator, _team_id
    FROM projects
    WHERE id = _project_id;

    IF _auto_assign_task_creator IS TRUE THEN
        SELECT tm.id, (r.admin_role OR r.owner)
        INTO _team_member_id, _is_admin
        FROM team_members tm
        INNER JOIN roles r ON tm.role_id = r.id
        WHERE tm.user_id = _reporter_id
          AND tm.team_id = _team_id;

        IF _team_member_id IS NOT NULL THEN
            IF NOT EXISTS (
                SELECT 1 FROM project_members
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

    RETURN get_task_form_view_model(_reporter_id, _team_id, _task_id, _project_id);
END;
$$;
  `);
};
