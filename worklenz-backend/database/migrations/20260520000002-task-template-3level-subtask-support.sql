BEGIN;

-- ============================================================
-- Migration: Task Template 3-Level Subtask Support
-- Extends the template functions to handle task > subtask > sub-subtask
-- (3 levels deep, matching the project task hierarchy limit).
--
-- The task_templates_tasks table already has parent_task_name from the
-- previous migration. No schema change is needed — the same column
-- stores parent references at every depth level.
-- ============================================================

-- 1. Replace create_task_template to support 3-level nesting.
--    JSON shape per task:
--      { name, total_minutes, id?, sub_tasks: [{ name, total_minutes, sub_tasks: [...] }] }
CREATE OR REPLACE FUNCTION create_task_template(_name text, _team_id uuid, _tasks json)
    RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _template_id   UUID;
    _task          JSON;
    _subtask       JSON;
    _grandchild    JSON;
    _parent_name   TEXT;
    _subtask_name  TEXT;
BEGIN
    IF EXISTS (
        SELECT 1 FROM task_templates
        WHERE LOWER(name) = LOWER(_name) AND team_id = _team_id
    ) THEN
        RAISE 'TASK_TEMPLATE_EXISTS_ERROR:%', _name;
    END IF;

    INSERT INTO task_templates (name, team_id)
    VALUES (_name, _team_id)
    RETURNING id INTO _template_id;

    FOR _task IN SELECT * FROM JSON_ARRAY_ELEMENTS(_tasks)
    LOOP
        _parent_name := TRIM((_task ->> 'name')::TEXT);

        -- Level 1: parent task (parent_task_name = NULL)
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

        -- Level 2: subtasks of the parent
        IF (_task -> 'sub_tasks') IS NOT NULL AND JSON_ARRAY_LENGTH(_task -> 'sub_tasks') > 0 THEN
            FOR _subtask IN SELECT * FROM JSON_ARRAY_ELEMENTS(_task -> 'sub_tasks')
            LOOP
                _subtask_name := TRIM((_subtask ->> 'name')::TEXT);

                INSERT INTO task_templates_tasks (template_id, name, total_minutes, parent_task_name)
                VALUES (
                    _template_id,
                    _subtask_name,
                    COALESCE(
                        (SELECT total_minutes FROM tasks WHERE id = (_subtask ->> 'id')::UUID),
                        (_subtask ->> 'total_minutes')::NUMERIC,
                        0
                    ),
                    _parent_name
                );

                -- Level 3: sub-subtasks of the subtask
                IF (_subtask -> 'sub_tasks') IS NOT NULL AND JSON_ARRAY_LENGTH(_subtask -> 'sub_tasks') > 0 THEN
                    FOR _grandchild IN SELECT * FROM JSON_ARRAY_ELEMENTS(_subtask -> 'sub_tasks')
                    LOOP
                        INSERT INTO task_templates_tasks (template_id, name, total_minutes, parent_task_name)
                        VALUES (
                            _template_id,
                            TRIM((_grandchild ->> 'name')::TEXT),
                            COALESCE(
                                (SELECT total_minutes FROM tasks WHERE id = (_grandchild ->> 'id')::UUID),
                                (_grandchild ->> 'total_minutes')::NUMERIC,
                                0
                            ),
                            _subtask_name
                        );
                    END LOOP;
                END IF;
            END LOOP;
        END IF;
    END LOOP;

    RETURN JSON_BUILD_OBJECT('id', _template_id, 'template_name', _name);
END
$$;

-- 2. Replace update_task_template to support 3-level nesting.
CREATE OR REPLACE FUNCTION update_task_template(_id uuid, _name text, _tasks json, _team_id uuid)
    RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _task          JSON;
    _subtask       JSON;
    _grandchild    JSON;
    _parent_name   TEXT;
    _subtask_name  TEXT;
BEGIN
    IF EXISTS (
        SELECT 1 FROM task_templates
        WHERE LOWER(name) = LOWER(_name) AND team_id = _team_id AND id != _id
    ) THEN
        RAISE 'TASK_TEMPLATE_EXISTS_ERROR:%', _name;
    END IF;

    UPDATE task_templates SET name = _name, updated_at = NOW() WHERE id = _id;

    DELETE FROM task_templates_tasks WHERE template_id = _id;

    FOR _task IN SELECT * FROM JSON_ARRAY_ELEMENTS(_tasks)
    LOOP
        _parent_name := TRIM((_task ->> 'name')::TEXT);

        -- Level 1
        INSERT INTO task_templates_tasks (template_id, name, total_minutes, parent_task_name)
        VALUES (
            _id,
            _parent_name,
            COALESCE((_task ->> 'total_minutes')::NUMERIC, 0),
            NULL
        );

        -- Level 2
        IF (_task -> 'sub_tasks') IS NOT NULL AND JSON_ARRAY_LENGTH(_task -> 'sub_tasks') > 0 THEN
            FOR _subtask IN SELECT * FROM JSON_ARRAY_ELEMENTS(_task -> 'sub_tasks')
            LOOP
                _subtask_name := TRIM((_subtask ->> 'name')::TEXT);

                INSERT INTO task_templates_tasks (template_id, name, total_minutes, parent_task_name)
                VALUES (
                    _id,
                    _subtask_name,
                    COALESCE((_subtask ->> 'total_minutes')::NUMERIC, 0),
                    _parent_name
                );

                -- Level 3
                IF (_subtask -> 'sub_tasks') IS NOT NULL AND JSON_ARRAY_LENGTH(_subtask -> 'sub_tasks') > 0 THEN
                    FOR _grandchild IN SELECT * FROM JSON_ARRAY_ELEMENTS(_subtask -> 'sub_tasks')
                    LOOP
                        INSERT INTO task_templates_tasks (template_id, name, total_minutes, parent_task_name)
                        VALUES (
                            _id,
                            TRIM((_grandchild ->> 'name')::TEXT),
                            COALESCE((_grandchild ->> 'total_minutes')::NUMERIC, 0),
                            _subtask_name
                        );
                    END LOOP;
                END IF;
            END LOOP;
        END IF;
    END LOOP;

    RETURN JSON_BUILD_OBJECT('id', _id, 'template_name', _name);
END
$$;

-- 3. Replace import_tasks_from_template to support 3-level nesting.
--
--    The frontend sends a flat array where each row has:
--      { name, total_minutes, parent_task_name }
--
--    parent_task_name = NULL  → level-1 (top-level task)
--    parent_task_name = <L1>  → level-2 (subtask of L1)
--    parent_task_name = <L2>  → level-3 (sub-subtask of L2)
--
--    Three-pass approach:
--      Pass 1 – insert L1 tasks, build L1 name→UUID map (_l1_map)
--      Pass 2 – insert L2 tasks using _l1_map, build L2 name→UUID map (_l2_map)
--      Pass 3 – insert L3 tasks using _l2_map
--
--    A row is L2 if its parent_task_name exists in _l1_map.
--    A row is L3 if its parent_task_name exists in _l2_map.
--    Orphaned rows (parent not found in either map) are skipped safely.
CREATE OR REPLACE FUNCTION import_tasks_from_template(_project_id uuid, _user_id uuid, _tasks json)
    RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _task                JSON;
    _max_sort            INT;
    _task_id_new         UUID;
    _default_status_id   UUID;
    _default_priority_id UUID;
    _team_id             UUID;
    -- name → new UUID maps for each level
    _l1_map              JSONB := '{}'::JSONB;
    _l2_map              JSONB := '{}'::JSONB;
    _parent_id           UUID;
BEGIN
    SELECT COALESCE((SELECT MAX(sort_order) FROM tasks WHERE project_id = _project_id), 0)
    INTO _max_sort;

    SELECT team_id INTO _team_id FROM projects WHERE id = _project_id;

    SELECT id INTO _default_status_id
    FROM task_statuses
    WHERE project_id = _project_id
      AND category_id IN (SELECT id FROM sys_task_status_categories WHERE is_todo IS TRUE)
    LIMIT 1;

    SELECT id INTO _default_priority_id
    FROM task_priorities WHERE value = 1;

    -- -------------------------------------------------------
    -- Pass 1: Level-1 tasks (parent_task_name IS NULL)
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
            _default_priority_id, _project_id, _user_id, _default_status_id,
            _max_sort, _max_sort, _max_sort, _max_sort, _max_sort, _max_sort,
            COALESCE((_task ->> 'total_minutes')::NUMERIC, 0)
        )
        RETURNING id INTO _task_id_new;

        INSERT INTO task_activity_logs (task_id, team_id, attribute_type, user_id, log_type, old_value, new_value, project_id)
        VALUES (_task_id_new, _team_id, 'status', _user_id, 'update', NULL, _default_status_id, _project_id);

        _l1_map := _l1_map || JSONB_BUILD_OBJECT(TRIM((_task ->> 'name')::TEXT), _task_id_new::TEXT);
    END LOOP;

    -- -------------------------------------------------------
    -- Pass 2: Level-2 tasks (parent_task_name matches an L1 name)
    -- -------------------------------------------------------
    FOR _task IN
        SELECT * FROM JSON_ARRAY_ELEMENTS(_tasks)
        WHERE (value ->> 'parent_task_name') IS NOT NULL
    LOOP
        _parent_id := (_l1_map ->> TRIM((_task ->> 'parent_task_name')::TEXT))::UUID;

        -- Only process rows whose parent is a level-1 task
        CONTINUE WHEN _parent_id IS NULL;

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
            _default_priority_id, _project_id, _user_id, _default_status_id,
            _parent_id,
            _max_sort, _max_sort, _max_sort, _max_sort, _max_sort, _max_sort,
            COALESCE((_task ->> 'total_minutes')::NUMERIC, 0)
        )
        RETURNING id INTO _task_id_new;

        INSERT INTO task_activity_logs (task_id, team_id, attribute_type, user_id, log_type, old_value, new_value, project_id)
        VALUES (_task_id_new, _team_id, 'status', _user_id, 'update', NULL, _default_status_id, _project_id);

        _l2_map := _l2_map || JSONB_BUILD_OBJECT(TRIM((_task ->> 'name')::TEXT), _task_id_new::TEXT);
    END LOOP;

    -- -------------------------------------------------------
    -- Pass 3: Level-3 tasks (parent_task_name matches an L2 name)
    -- -------------------------------------------------------
    FOR _task IN
        SELECT * FROM JSON_ARRAY_ELEMENTS(_tasks)
        WHERE (value ->> 'parent_task_name') IS NOT NULL
    LOOP
        _parent_id := (_l2_map ->> TRIM((_task ->> 'parent_task_name')::TEXT))::UUID;

        -- Only process rows whose parent is a level-2 task
        CONTINUE WHEN _parent_id IS NULL;

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
            _default_priority_id, _project_id, _user_id, _default_status_id,
            _parent_id,
            _max_sort, _max_sort, _max_sort, _max_sort, _max_sort, _max_sort,
            COALESCE((_task ->> 'total_minutes')::NUMERIC, 0)
        )
        RETURNING id INTO _task_id_new;

        INSERT INTO task_activity_logs (task_id, team_id, attribute_type, user_id, log_type, old_value, new_value, project_id)
        VALUES (_task_id_new, _team_id, 'status', _user_id, 'update', NULL, _default_status_id, _project_id);
    END LOOP;

    RETURN JSON_BUILD_OBJECT('id', _project_id);
END;
$$;

COMMIT;
