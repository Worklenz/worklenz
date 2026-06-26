BEGIN;

-- Fix import_tasks_from_template() to write all 6 sort columns
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

-- Fix create_quick_pt_task() to write all sort columns for cpt_tasks
CREATE OR REPLACE FUNCTION create_quick_pt_task(_body json) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _task_id     UUID;
    _parent_task UUID;
    _status_id   UUID;
    _priority_id UUID;
    _next_sort   INTEGER;
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

    -- Calculate next sort order across all sort columns
    SELECT COALESCE(MAX(GREATEST(
        COALESCE(sort_order, 0),
        COALESCE(status_sort_order, 0),
        COALESCE(priority_sort_order, 0),
        COALESCE(phase_sort_order, 0)
    )) + 1, 0)
    INTO _next_sort
    FROM cpt_tasks
    WHERE template_id = (_body ->> 'template_id')::UUID;

    INSERT INTO cpt_tasks(name, priority_id, template_id, status_id, parent_task_id,
                          sort_order, status_sort_order, priority_sort_order, phase_sort_order,
                          task_no)
    VALUES (TRIM((_body ->> 'name')::TEXT),
            _priority_id,
            (_body ->> 'template_id')::UUID,

               -- This should be came from client side later
            _status_id, _parent_task,
            _next_sort, _next_sort, _next_sort, _next_sort,
            ((SELECT COUNT(*) FROM cpt_tasks WHERE template_id = (_body ->> 'template_id')::UUID) + 1))
    RETURNING id INTO _task_id;

    PERFORM handle_on_pt_task_phase_change(_task_id, (_body ->> 'phase_id')::UUID);

    RETURN get_single_pt_task(_task_id);
END;
$$;

COMMIT;
