-- Migration: Fix quick task sort order issue
-- Problem: When creating a task via quick task, status_sort_order, priority_sort_order, 
-- and phase_sort_order are not set, defaulting to 0, causing new tasks to appear at the top
-- Solution: Update create_quick_task function to set all sort order columns

CREATE OR REPLACE FUNCTION create_quick_task(_body json) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _task_id     UUID;
    _parent_task UUID;
    _status_id   UUID;
    _priority_id UUID;
    _start_date  TIMESTAMP;
    _end_date    TIMESTAMP;
    _project_id  UUID;
    _next_sort_order INTEGER;
BEGIN
    _project_id = (_body ->> 'project_id')::UUID;
    _parent_task = (_body ->> 'parent_task_id')::UUID;
    _status_id = COALESCE(
        (_body ->> 'status_id')::UUID,
        (SELECT id
         FROM task_statuses
         WHERE project_id = _project_id
           AND category_id IN (SELECT id FROM sys_task_status_categories WHERE is_todo IS TRUE)
         LIMIT 1)
        );
    _priority_id = COALESCE((_body ->> 'priority_id')::UUID, (SELECT id FROM task_priorities WHERE value = 1));
    _start_date = (_body ->> 'start_date')::TIMESTAMP;
    _end_date = (_body ->> 'end_date')::TIMESTAMP;

    -- Calculate the next sort order value once and use it for all sort columns
    -- This ensures new tasks appear at the bottom of all groupings
    SELECT COALESCE(MAX(GREATEST(
        COALESCE(sort_order, 0),
        COALESCE(roadmap_sort_order, 0),
        COALESCE(status_sort_order, 0),
        COALESCE(priority_sort_order, 0),
        COALESCE(phase_sort_order, 0)
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
        start_date, 
        end_date
    )
    VALUES (
        TRIM((_body ->> 'name')::TEXT),
        _priority_id,
        _project_id,
        (_body ->> 'reporter_id')::UUID,
        _status_id, 
        _parent_task,
        _next_sort_order,
        _next_sort_order,
        _next_sort_order,
        _next_sort_order,
        _next_sort_order,
        _start_date,
        _end_date
    )
    RETURNING id INTO _task_id;

    PERFORM handle_on_task_phase_change(_task_id, (_body ->> 'phase_id')::UUID);

    RETURN get_single_task(_task_id);
END;
$$;
