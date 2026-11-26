/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
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
        SELECT team_id INTO _team_id FROM projects WHERE id = _project_id;

        IF _team_id IS NULL THEN
            RAISE EXCEPTION 'Project not found';
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM team_members tm
            WHERE tm.team_id = _team_id
              AND tm.user_id = _user_id
              AND tm.active IS TRUE
              AND (
                  tm.is_guest IS FALSE
                  OR EXISTS (
                      SELECT 1 FROM project_members pm
                      WHERE pm.project_id = _project_id
                        AND pm.user_id = _user_id
                  )
              )
        ) THEN
            RAISE EXCEPTION 'Access denied: user does not have permission to import tasks into this project';
        END IF;

        SELECT COALESCE((SELECT MAX(sort_order) FROM tasks WHERE project_id = _project_id), 0)
        INTO _max_sort;

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
