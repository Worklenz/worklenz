BEGIN;

-- ============================================================
-- Migration: Task Template Subtask Support
-- Adds parent_task_name column to task_templates_tasks so that
-- subtask hierarchy can be preserved in templates.
-- A NULL parent_task_name means the row is a top-level task.
-- A non-NULL parent_task_name links the row to its parent by name.
-- ============================================================

-- 1. Add parent_task_name column to task_templates_tasks
ALTER TABLE task_templates_tasks
    ADD COLUMN IF NOT EXISTS parent_task_name TEXT DEFAULT NULL;

-- 2. Replace create_task_template to support nested sub_tasks in the JSON payload.
--    Each task object may carry a "sub_tasks" JSON array.
--    Sub-tasks are stored with parent_task_name = parent task name.
CREATE OR REPLACE FUNCTION create_task_template(_name text, _team_id uuid, _tasks json)
    RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _template_id  UUID;
    _task         JSON;
    _subtask      JSON;
    _parent_name  TEXT;
BEGIN
    -- Prevent duplicate template names within the same team
    IF EXISTS (
        SELECT 1
        FROM task_templates
        WHERE LOWER(name) = LOWER(_name)
          AND team_id = _team_id
    ) THEN
        RAISE 'TASK_TEMPLATE_EXISTS_ERROR:%', _name;
    END IF;

    INSERT INTO task_templates (name, team_id)
    VALUES (_name, _team_id)
    RETURNING id INTO _template_id;

    -- Insert parent tasks and their subtasks
    FOR _task IN SELECT * FROM JSON_ARRAY_ELEMENTS(_tasks)
        LOOP
            _parent_name := TRIM((_task ->> 'name')::TEXT);

            -- Insert the parent task row (parent_task_name = NULL)
            INSERT INTO task_templates_tasks (template_id, name, total_minutes, parent_task_name)
            VALUES (
                _template_id,
                _parent_name,
                COALESCE(
                    (SELECT total_minutes FROM tasks WHERE id = (_task ->> 'id')::UUID),
                    (_task ->> 'total_minutes')::NUMERIC,
                    0
                ),
                NULL
            );

            -- Insert subtasks if present
            IF (_task -> 'sub_tasks') IS NOT NULL AND
               JSON_ARRAY_LENGTH(_task -> 'sub_tasks') > 0 THEN
                FOR _subtask IN SELECT * FROM JSON_ARRAY_ELEMENTS(_task -> 'sub_tasks')
                    LOOP
                        INSERT INTO task_templates_tasks (template_id, name, total_minutes, parent_task_name)
                        VALUES (
                            _template_id,
                            TRIM((_subtask ->> 'name')::TEXT),
                            COALESCE(
                                (SELECT total_minutes FROM tasks WHERE id = (_subtask ->> 'id')::UUID),
                                (_subtask ->> 'total_minutes')::NUMERIC,
                                0
                            ),
                            _parent_name
                        );
                    END LOOP;
            END IF;
        END LOOP;

    RETURN JSON_BUILD_OBJECT(
        'id', _template_id,
        'template_name', _name
    );
END
$$;

-- 3. Replace update_task_template to support nested sub_tasks in the JSON payload.
CREATE OR REPLACE FUNCTION update_task_template(_id uuid, _name text, _tasks json, _team_id uuid)
    RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _task         JSON;
    _subtask      JSON;
    _parent_name  TEXT;
BEGIN
    -- Prevent duplicate template names within the same team (excluding self)
    IF EXISTS (
        SELECT 1
        FROM task_templates
        WHERE LOWER(name) = LOWER(_name)
          AND team_id = _team_id
          AND id != _id
    ) THEN
        RAISE 'TASK_TEMPLATE_EXISTS_ERROR:%', _name;
    END IF;

    UPDATE task_templates
    SET name       = _name,
        updated_at = NOW()
    WHERE id = _id;

    -- Remove all existing tasks for this template before re-inserting
    DELETE FROM task_templates_tasks WHERE template_id = _id;

    -- Re-insert parent tasks and their subtasks
    FOR _task IN SELECT * FROM JSON_ARRAY_ELEMENTS(_tasks)
        LOOP
            _parent_name := TRIM((_task ->> 'name')::TEXT);

            INSERT INTO task_templates_tasks (template_id, name, total_minutes, parent_task_name)
            VALUES (
                _id,
                _parent_name,
                COALESCE((_task ->> 'total_minutes')::NUMERIC, 0),
                NULL
            );

            IF (_task -> 'sub_tasks') IS NOT NULL AND
               JSON_ARRAY_LENGTH(_task -> 'sub_tasks') > 0 THEN
                FOR _subtask IN SELECT * FROM JSON_ARRAY_ELEMENTS(_task -> 'sub_tasks')
                    LOOP
                        INSERT INTO task_templates_tasks (template_id, name, total_minutes, parent_task_name)
                        VALUES (
                            _id,
                            TRIM((_subtask ->> 'name')::TEXT),
                            COALESCE((_subtask ->> 'total_minutes')::NUMERIC, 0),
                            _parent_name
                        );
                    END LOOP;
            END IF;
        END LOOP;

    RETURN JSON_BUILD_OBJECT(
        'id', _id,
        'template_name', _name
    );
END
$$;

-- 4. Replace import_tasks_from_template to restore subtask hierarchy on import.
--    Two-pass approach:
--      Pass 1 – insert all parent tasks (parent_task_name IS NULL), capture name→new_id mapping.
--      Pass 2 – insert subtasks using the mapping to set parent_task_id.
CREATE OR REPLACE FUNCTION import_tasks_from_template(_project_id uuid, _user_id uuid, _tasks json)
    RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _task          JSON;
    _max_sort      INT;
    _task_id_new   UUID;
    _default_status_id UUID;
    _default_priority_id UUID;
    -- Temporary table to map template task name → newly created task UUID
    _parent_map    JSONB := '{}'::JSONB;
    _parent_id     UUID;
BEGIN
    SELECT COALESCE((SELECT MAX(sort_order) FROM tasks WHERE project_id = _project_id), 0)
    INTO _max_sort;

    -- Cache the default status and priority to avoid repeated sub-selects
    SELECT id
    INTO _default_status_id
    FROM task_statuses
    WHERE project_id = _project_id
      AND category_id IN (
          SELECT id FROM sys_task_status_categories WHERE is_todo IS TRUE
      )
    LIMIT 1;

    SELECT id
    INTO _default_priority_id
    FROM task_priorities
    WHERE value = 1;

    -- -------------------------------------------------------
    -- Pass 1: Insert parent tasks (parent_task_name IS NULL)
    -- -------------------------------------------------------
    FOR _task IN
        SELECT * FROM JSON_ARRAY_ELEMENTS(_tasks)
        WHERE (value ->> 'parent_task_name') IS NULL
    LOOP
        _max_sort := _max_sort + 1;

        INSERT INTO tasks (
            name, priority_id, project_id, reporter_id, status_id,
            sort_order, roadmap_sort_order,
            status_sort_order, priority_sort_order, phase_sort_order, member_sort_order,
            total_minutes
        )
        VALUES (
            TRIM((_task ->> 'name')::TEXT),
            _default_priority_id,
            _project_id,
            _user_id,
            _default_status_id,
            _max_sort, _max_sort,
            _max_sort, _max_sort, _max_sort, _max_sort,
            COALESCE((_task ->> 'total_minutes')::NUMERIC, 0)
        )
        RETURNING id INTO _task_id_new;

        -- Log task creation activity
        INSERT INTO task_activity_logs (
            task_id, team_id, attribute_type, user_id, log_type,
            old_value, new_value, project_id
        )
        VALUES (
            _task_id_new,
            (SELECT team_id FROM projects WHERE id = _project_id),
            'status',
            _user_id,
            'update',
            NULL,
            _default_status_id,
            _project_id
        );

        -- Store name → new UUID mapping for subtask pass
        _parent_map := _parent_map || JSONB_BUILD_OBJECT(
            TRIM((_task ->> 'name')::TEXT),
            _task_id_new::TEXT
        );
    END LOOP;

    -- -------------------------------------------------------
    -- Pass 2: Insert subtasks (parent_task_name IS NOT NULL)
    -- -------------------------------------------------------
    FOR _task IN
        SELECT * FROM JSON_ARRAY_ELEMENTS(_tasks)
        WHERE (value ->> 'parent_task_name') IS NOT NULL
    LOOP
        -- Resolve parent UUID from the mapping built in pass 1
        _parent_id := (_parent_map ->> TRIM((_task ->> 'parent_task_name')::TEXT))::UUID;

        -- Skip orphaned subtasks whose parent was not found (safety guard)
        IF _parent_id IS NULL THEN
            CONTINUE;
        END IF;

        _max_sort := _max_sort + 1;

        INSERT INTO tasks (
            name, priority_id, project_id, reporter_id, status_id,
            parent_task_id,
            sort_order, roadmap_sort_order,
            status_sort_order, priority_sort_order, phase_sort_order, member_sort_order,
            total_minutes
        )
        VALUES (
            TRIM((_task ->> 'name')::TEXT),
            _default_priority_id,
            _project_id,
            _user_id,
            _default_status_id,
            _parent_id,
            _max_sort, _max_sort,
            _max_sort, _max_sort, _max_sort, _max_sort,
            COALESCE((_task ->> 'total_minutes')::NUMERIC, 0)
        )
        RETURNING id INTO _task_id_new;

        -- Log subtask creation activity
        INSERT INTO task_activity_logs (
            task_id, team_id, attribute_type, user_id, log_type,
            old_value, new_value, project_id
        )
        VALUES (
            _task_id_new,
            (SELECT team_id FROM projects WHERE id = _project_id),
            'status',
            _user_id,
            'update',
            NULL,
            _default_status_id,
            _project_id
        );
    END LOOP;

    RETURN JSON_BUILD_OBJECT('id', _project_id);
END;
$$;

COMMIT;
