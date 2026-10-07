/**
 * Migration: Fix auto_assign_subtask_phase function bugs
 * Date: 2026-09-07
 * Description (what this "fix" corrects vs earlier migrations in this PR):
 *   1. create_task / create_quick_task: earlier drafts selected/inserted tasks.phase_id
 *      (column does not exist). Final versions read parent phase from task_phase and
 *      assign via handle_on_task_phase_change. Precedence: explicit phase_id → inherit
 *      parent when auto_assign_subtask_phase → else NULL.
 *   2. cascade_phase_to_subtasks: earlier CROSS JOIN LATERAL recursion was invalid /
 *      then replaced with per-sibling FOREACH (N recursive calls). Final version uses
 *      one WITH RECURSIVE CTE to collect all descendants, then a single batched
 *      DELETE/UPDATE+INSERT — O(descendants) writes, not O(depth × breadth) function calls.
 *   3. handle_task_reparent: early-exit on projects.auto_assign_subtask_phase = FALSE
 *      (default) so bulk re-parent / convert-to-subtask only pay a cheap PK lookup when
 *      the setting is off; phase inheritance + cascade only when opted in.
 *
 * Final tested state for create_task / create_quick_task / cascade_phase_to_subtasks /
 * handle_task_reparent is THIS migration (runs after 130000–160000).
 */

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  // Fix create_task: inherit phase from task_phase junction table
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

  // Fix create_quick_task: inherit phase from task_phase
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

    IF _parent_task IS NOT NULL THEN
        SELECT p.auto_assign_subtask_phase, tp.phase_id
        INTO _auto_assign_subtask_phase, _parent_phase_id
        FROM projects p
        LEFT JOIN task_phase tp ON tp.task_id = _parent_task
        WHERE p.id = _project_id;
    END IF;

    IF (_body ->> 'phase_id')::UUID IS NOT NULL THEN
        _phase_id_to_assign := (_body ->> 'phase_id')::UUID;
    ELSIF _auto_assign_subtask_phase IS TRUE AND _parent_phase_id IS NOT NULL THEN
        _phase_id_to_assign := _parent_phase_id;
    ELSE
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

    PERFORM handle_on_task_phase_change(_task_id, _phase_id_to_assign);

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

    RETURN get_single_task(_task_id);
END;
$$;
  `);

  // Fix cascade_phase_to_subtasks: single recursive CTE + one batched write
  pgm.sql(`
CREATE OR REPLACE FUNCTION cascade_phase_to_subtasks(_parent_task_id UUID, _new_phase_id UUID) RETURNS TABLE(changed_task_id UUID, changed_phase_id UUID, changed_phase_name TEXT, changed_phase_color TEXT)
    LANGUAGE plpgsql
AS
$$
DECLARE
    _auto_assign_subtask_phase BOOLEAN;
    _descendant_ids            UUID[];
    _phase_name                TEXT;
    _phase_color               TEXT;
BEGIN
    SELECT p.auto_assign_subtask_phase
    INTO _auto_assign_subtask_phase
    FROM tasks t
    INNER JOIN projects p ON p.id = t.project_id
    WHERE t.id = _parent_task_id;

    IF _auto_assign_subtask_phase IS NOT TRUE THEN
        RETURN;
    END IF;

    -- Collect the full descendant tree in one pass (wide + deep trees)
    WITH RECURSIVE descendants AS (
        SELECT id
        FROM tasks
        WHERE parent_task_id = _parent_task_id
        UNION ALL
        SELECT t.id
        FROM tasks t
        INNER JOIN descendants d ON t.parent_task_id = d.id
    )
    SELECT ARRAY_AGG(id) INTO _descendant_ids
    FROM descendants;

    IF _descendant_ids IS NULL OR array_length(_descendant_ids, 1) IS NULL THEN
        RETURN;
    END IF;

    IF _new_phase_id IS NOT NULL THEN
        SELECT name, color_code INTO _phase_name, _phase_color
        FROM project_phases
        WHERE id = _new_phase_id;
    END IF;

    IF _new_phase_id IS NULL THEN
        DELETE FROM task_phase
        WHERE task_id = ANY(_descendant_ids);
    ELSE
        UPDATE task_phase
        SET phase_id = _new_phase_id
        WHERE task_id = ANY(_descendant_ids);

        INSERT INTO task_phase (task_id, phase_id)
        SELECT d.task_id, _new_phase_id
        FROM unnest(_descendant_ids) AS d(task_id)
        WHERE NOT EXISTS (SELECT 1 FROM task_phase tp WHERE tp.task_id = d.task_id);
    END IF;

    RETURN QUERY
    SELECT
        descendant_id,
        _new_phase_id,
        _phase_name,
        _phase_color
    FROM unnest(_descendant_ids) AS descendant_id;
END;
$$;
  `);

  // Fix handle_task_reparent: cheap early-exit when setting is off (default)
  pgm.sql(`
CREATE OR REPLACE FUNCTION handle_task_reparent() RETURNS TRIGGER
    LANGUAGE plpgsql
AS
$$
DECLARE
    _new_parent_phase_id       UUID;
    _auto_assign_subtask_phase BOOLEAN;
BEGIN
    IF (OLD.parent_task_id IS DISTINCT FROM NEW.parent_task_id) AND (NEW.parent_task_id IS NOT NULL) THEN
        -- Default is FALSE: exit before parent phase lookup on bulk re-parent paths
        SELECT auto_assign_subtask_phase
        INTO _auto_assign_subtask_phase
        FROM projects
        WHERE id = NEW.project_id;

        IF _auto_assign_subtask_phase IS NOT TRUE THEN
            RETURN NEW;
        END IF;

        SELECT tp.phase_id
        INTO _new_parent_phase_id
        FROM task_phase tp
        WHERE tp.task_id = NEW.parent_task_id;

        PERFORM handle_on_task_phase_change(NEW.id, _new_parent_phase_id);
    END IF;

    RETURN NEW;
END;
$$;
  `);

  pgm.sql(`
    COMMENT ON FUNCTION cascade_phase_to_subtasks(UUID, UUID) IS
    'Cascades parent phase to all descendants when auto_assign_subtask_phase is enabled. Uses one WITH RECURSIVE CTE + one batched DELETE/UPDATE+INSERT (not per-sibling recursion).';
  `);

  pgm.sql(`
    COMMENT ON FUNCTION handle_task_reparent() IS
    'AFTER UPDATE OF parent_task_id: when auto_assign_subtask_phase is enabled, inherit new parent phase. Early-exits when setting is FALSE (column default).';
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  // Intentionally no-op: rolling back would restore broken functions.
  // Use prior migrations' down paths if a full revert is required.
};
