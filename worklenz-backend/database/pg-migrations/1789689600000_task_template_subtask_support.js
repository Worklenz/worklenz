'use strict';

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    -- 1. Ensure parent_task_name column exists on task_templates_tasks
    ALTER TABLE task_templates_tasks
      ADD COLUMN IF NOT EXISTS parent_task_name TEXT DEFAULT NULL;

    -- 2. Create or replace create_task_template with 3-level subtask support and safe total_minutes
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
                    CASE WHEN (_task ->> 'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                         THEN (SELECT t.total_minutes FROM tasks t
                               JOIN projects p ON p.id = t.project_id
                               WHERE t.id = (_task ->> 'id')::UUID AND p.team_id = _team_id)
                         ELSE NULL END,
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
                            CASE WHEN (_subtask ->> 'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                                 THEN (SELECT t.total_minutes FROM tasks t
                                       JOIN projects p ON p.id = t.project_id
                                       WHERE t.id = (_subtask ->> 'id')::UUID AND p.team_id = _team_id)
                                 ELSE NULL END,
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
                                    CASE WHEN (_grandchild ->> 'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                                         THEN (SELECT t.total_minutes FROM tasks t
                                               JOIN projects p ON p.id = t.project_id
                                               WHERE t.id = (_grandchild ->> 'id')::UUID AND p.team_id = _team_id)
                                         ELSE NULL END,
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

    -- 3. Create or replace update_task_template with 3-level nesting support
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

    -- 4. Create or replace import_tasks_from_template with 3-level nesting support.
    --    Walks the nested JSON tree (task -> sub_tasks -> sub_tasks) directly, so
    --    parent/child linkage comes from JSON nesting rather than name matching --
    --    this avoids misattaching/duplicating tasks when names collide across
    --    branches or nesting levels.
    CREATE OR REPLACE FUNCTION import_tasks_from_template(_project_id uuid, _user_id uuid, _tasks json)
        RETURNS json
        LANGUAGE plpgsql
    AS
    $$
    DECLARE
        _task                JSON;
        _subtask             JSON;
        _grandchild          JSON;
        _max_sort            INT;
        _task_id_new         UUID;
        _subtask_id_new      UUID;
        _grandchild_id_new   UUID;
        _default_status_id   UUID;
        _default_priority_id UUID;
        _team_id             UUID;
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

        FOR _task IN SELECT * FROM JSON_ARRAY_ELEMENTS(_tasks)
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

            IF (_task -> 'sub_tasks') IS NOT NULL AND JSON_ARRAY_LENGTH(_task -> 'sub_tasks') > 0 THEN
                FOR _subtask IN SELECT * FROM JSON_ARRAY_ELEMENTS(_task -> 'sub_tasks')
                LOOP
                    _max_sort := _max_sort + 1;

                    INSERT INTO tasks (
                        name, priority_id, project_id, reporter_id, status_id,
                        parent_task_id,
                        sort_order, roadmap_sort_order,
                        status_sort_order, priority_sort_order, phase_sort_order, member_sort_order,
                        total_minutes
                    )
                    VALUES (
                        TRIM((_subtask ->> 'name')::TEXT),
                        _default_priority_id, _project_id, _user_id, _default_status_id,
                        _task_id_new,
                        _max_sort, _max_sort, _max_sort, _max_sort, _max_sort, _max_sort,
                        COALESCE((_subtask ->> 'total_minutes')::NUMERIC, 0)
                    )
                    RETURNING id INTO _subtask_id_new;

                    INSERT INTO task_activity_logs (task_id, team_id, attribute_type, user_id, log_type, old_value, new_value, project_id)
                    VALUES (_subtask_id_new, _team_id, 'status', _user_id, 'update', NULL, _default_status_id, _project_id);

                    IF (_subtask -> 'sub_tasks') IS NOT NULL AND JSON_ARRAY_LENGTH(_subtask -> 'sub_tasks') > 0 THEN
                        FOR _grandchild IN SELECT * FROM JSON_ARRAY_ELEMENTS(_subtask -> 'sub_tasks')
                        LOOP
                            _max_sort := _max_sort + 1;

                            INSERT INTO tasks (
                                name, priority_id, project_id, reporter_id, status_id,
                                parent_task_id,
                                sort_order, roadmap_sort_order,
                                status_sort_order, priority_sort_order, phase_sort_order, member_sort_order,
                                total_minutes
                            )
                            VALUES (
                                TRIM((_grandchild ->> 'name')::TEXT),
                                _default_priority_id, _project_id, _user_id, _default_status_id,
                                _subtask_id_new,
                                _max_sort, _max_sort, _max_sort, _max_sort, _max_sort, _max_sort,
                                COALESCE((_grandchild ->> 'total_minutes')::NUMERIC, 0)
                            )
                            RETURNING id INTO _grandchild_id_new;

                            INSERT INTO task_activity_logs (task_id, team_id, attribute_type, user_id, log_type, old_value, new_value, project_id)
                            VALUES (_grandchild_id_new, _team_id, 'status', _user_id, 'update', NULL, _default_status_id, _project_id);
                        END LOOP;
                    END IF;
                END LOOP;
            END IF;
        END LOOP;

        RETURN JSON_BUILD_OBJECT('id', _project_id);
    END;
    $$;
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
    -- Restore create_task_template to its pre-3-level-nesting form
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

    -- Restore update_task_template (4-arg overload) to its pre-3-level-nesting form
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

    -- Restore import_tasks_from_template to its pre-3-level-nesting form
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
                INSERT INTO tasks (name, priority_id, project_id, reporter_id, status_id,
                                   sort_order, roadmap_sort_order,
                                   status_sort_order, priority_sort_order, phase_sort_order, member_sort_order,
                                   total_minutes)
                VALUES (TRIM((_task ->> 'name')::TEXT),
                        (SELECT id FROM task_priorities WHERE value = 1),
                        _project_id,
                        _user_id,

                           -- This should be came from client side later
                        (SELECT id
                         FROM task_statuses
                         WHERE project_id = _project_id::UUID
                           AND category_id IN (SELECT id FROM sys_task_status_categories WHERE is_todo IS TRUE)
                         LIMIT 1),
                        _max_sort, _max_sort,
                        _max_sort, _max_sort, _max_sort, _max_sort,
                        (_task ->> 'total_minutes')::NUMERIC) RETURNING id INTO _task_id_new;

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

    ALTER TABLE task_templates_tasks
      DROP COLUMN IF EXISTS parent_task_name;
  `);
};
