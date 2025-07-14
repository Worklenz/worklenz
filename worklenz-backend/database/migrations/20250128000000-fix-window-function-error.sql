-- Fix window function error in task sort optimized functions
-- Error: window functions are not allowed in UPDATE

-- Replace the optimized sort functions to avoid CTE usage in UPDATE statements
CREATE OR REPLACE FUNCTION handle_task_list_sort_between_groups_optimized(_from_index integer, _to_index integer, _task_id uuid, _project_id uuid, _batch_size integer DEFAULT 100) RETURNS void
    LANGUAGE plpgsql
AS
$$
DECLARE
    _offset INT := 0;
    _affected_rows INT;
BEGIN
    -- PERFORMANCE OPTIMIZATION: Use direct updates without CTE in UPDATE
    IF (_to_index = -1)
    THEN
        _to_index = COALESCE((SELECT MAX(sort_order) + 1 FROM tasks WHERE project_id = _project_id), 0);
    END IF;

    -- PERFORMANCE OPTIMIZATION: Batch updates for large datasets
    IF _to_index > _from_index
    THEN
        LOOP
            UPDATE tasks
            SET sort_order = sort_order - 1
            WHERE project_id = _project_id
              AND sort_order > _from_index
              AND sort_order < _to_index
              AND sort_order > _offset
              AND sort_order <= _offset + _batch_size;
            
            GET DIAGNOSTICS _affected_rows = ROW_COUNT;
            EXIT WHEN _affected_rows = 0;
            _offset := _offset + _batch_size;
        END LOOP;

        UPDATE tasks SET sort_order = _to_index - 1 WHERE id = _task_id AND project_id = _project_id;
    END IF;

    IF _to_index < _from_index
    THEN
        _offset := 0;
        LOOP
            UPDATE tasks
            SET sort_order = sort_order + 1
            WHERE project_id = _project_id
              AND sort_order > _to_index
              AND sort_order < _from_index
              AND sort_order > _offset
              AND sort_order <= _offset + _batch_size;
            
            GET DIAGNOSTICS _affected_rows = ROW_COUNT;
            EXIT WHEN _affected_rows = 0;
            _offset := _offset + _batch_size;
        END LOOP;

        UPDATE tasks SET sort_order = _to_index + 1 WHERE id = _task_id AND project_id = _project_id;
    END IF;
END
$$;

-- Replace the second optimized sort function
CREATE OR REPLACE FUNCTION handle_task_list_sort_inside_group_optimized(_from_index integer, _to_index integer, _task_id uuid, _project_id uuid, _batch_size integer DEFAULT 100) RETURNS void
    LANGUAGE plpgsql
AS
$$
DECLARE
    _offset INT := 0;
    _affected_rows INT;
BEGIN
    -- PERFORMANCE OPTIMIZATION: Batch updates for large datasets without CTE in UPDATE
    IF _to_index > _from_index
    THEN
        LOOP
            UPDATE tasks
            SET sort_order = sort_order - 1
            WHERE project_id = _project_id
              AND sort_order > _from_index
              AND sort_order <= _to_index
              AND sort_order > _offset
              AND sort_order <= _offset + _batch_size;
            
            GET DIAGNOSTICS _affected_rows = ROW_COUNT;
            EXIT WHEN _affected_rows = 0;
            _offset := _offset + _batch_size;
        END LOOP;
    END IF;

    IF _to_index < _from_index
    THEN
        _offset := 0;
        LOOP
            UPDATE tasks
            SET sort_order = sort_order + 1
            WHERE project_id = _project_id
              AND sort_order >= _to_index
              AND sort_order < _from_index
              AND sort_order > _offset
              AND sort_order <= _offset + _batch_size;
            
            GET DIAGNOSTICS _affected_rows = ROW_COUNT;
            EXIT WHEN _affected_rows = 0;
            _offset := _offset + _batch_size;
        END LOOP;
    END IF;

    UPDATE tasks SET sort_order = _to_index WHERE id = _task_id AND project_id = _project_id;
END
$$;

-- Add simple bulk update function as alternative
CREATE OR REPLACE FUNCTION update_task_sort_orders_bulk(_updates json) RETURNS void
    LANGUAGE plpgsql
AS
$$
DECLARE
    _update_record RECORD;
BEGIN
    -- Simple approach: update each task's sort_order from the provided array
    FOR _update_record IN 
        SELECT 
            (item->>'task_id')::uuid as task_id,
            (item->>'sort_order')::int as sort_order,
            (item->>'status_id')::uuid as status_id,
            (item->>'priority_id')::uuid as priority_id,
            (item->>'phase_id')::uuid as phase_id
        FROM json_array_elements(_updates) as item
    LOOP
        UPDATE tasks 
        SET 
            sort_order = _update_record.sort_order,
            status_id = COALESCE(_update_record.status_id, status_id),
            priority_id = COALESCE(_update_record.priority_id, priority_id)
        WHERE id = _update_record.task_id;
        
        -- Handle phase updates separately since it's in a different table
        IF _update_record.phase_id IS NOT NULL THEN
            INSERT INTO task_phase (task_id, phase_id)
            VALUES (_update_record.task_id, _update_record.phase_id)
            ON CONFLICT (task_id) DO UPDATE SET phase_id = _update_record.phase_id;
        END IF;
    END LOOP;
END
$$; 