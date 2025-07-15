-- Migration: Update database functions to handle grouping-specific sort orders

-- Function to get the appropriate sort column name based on grouping type
CREATE OR REPLACE FUNCTION get_sort_column_name(_group_by TEXT) RETURNS TEXT
    LANGUAGE plpgsql
AS
$$
BEGIN
    CASE _group_by
        WHEN 'status' THEN RETURN 'status_sort_order';
        WHEN 'priority' THEN RETURN 'priority_sort_order';
        WHEN 'phase' THEN RETURN 'phase_sort_order';
        WHEN 'members' THEN RETURN 'member_sort_order';
        ELSE RETURN 'sort_order'; -- fallback to general sort_order
    END CASE;
END;
$$;

-- Updated bulk sort order function to handle different sort columns
CREATE OR REPLACE FUNCTION update_task_sort_orders_bulk(_updates json, _group_by text DEFAULT 'status') RETURNS void
    LANGUAGE plpgsql
AS
$$
DECLARE
    _update_record RECORD;
    _sort_column TEXT;
    _sql TEXT;
BEGIN
    -- Get the appropriate sort column based on grouping
    _sort_column := get_sort_column_name(_group_by);
    
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
        -- Update the appropriate sort column and other fields using dynamic SQL
        -- Only update sort_order if we're using the default sorting
        IF _sort_column = 'sort_order' THEN
            UPDATE tasks SET 
                sort_order = _update_record.sort_order,
                status_id = COALESCE(_update_record.status_id, status_id),
                priority_id = COALESCE(_update_record.priority_id, priority_id)
            WHERE id = _update_record.task_id;
        ELSE
            -- Update only the grouping-specific sort column, not the main sort_order
            _sql := 'UPDATE tasks SET ' || _sort_column || ' = $1, ' ||
                    'status_id = COALESCE($2, status_id), ' ||
                    'priority_id = COALESCE($3, priority_id) ' ||
                    'WHERE id = $4';
            
            EXECUTE _sql USING 
                _update_record.sort_order,
                _update_record.status_id,
                _update_record.priority_id,
                _update_record.task_id;
        END IF;
        
        -- Handle phase updates separately since it's in a different table
        IF _update_record.phase_id IS NOT NULL THEN
            INSERT INTO task_phase (task_id, phase_id)
            VALUES (_update_record.task_id, _update_record.phase_id)
            ON CONFLICT (task_id) DO UPDATE SET phase_id = _update_record.phase_id;
        END IF;
    END LOOP;
END;
$$;

-- Updated main sort order change handler
CREATE OR REPLACE FUNCTION handle_task_list_sort_order_change(_body json) RETURNS void
    LANGUAGE plpgsql
AS
$$
DECLARE
    _from_index INT;
    _to_index   INT;
    _task_id    UUID;
    _project_id UUID;
    _from_group UUID;
    _to_group   UUID;
    _group_by   TEXT;
    _batch_size INT := 100;
    _sort_column TEXT;
    _sql TEXT;
BEGIN
    _project_id = (_body ->> 'project_id')::UUID;
    _task_id = (_body ->> 'task_id')::UUID;
    _from_index = (_body ->> 'from_index')::INT;
    _to_index = (_body ->> 'to_index')::INT;
    _from_group = (_body ->> 'from_group')::UUID;
    _to_group = (_body ->> 'to_group')::UUID;
    _group_by = (_body ->> 'group_by')::TEXT;
    
    -- Get the appropriate sort column
    _sort_column := get_sort_column_name(_group_by);
    
    -- Handle group changes
    IF (_from_group <> _to_group OR (_from_group <> _to_group) IS NULL) THEN
        IF (_group_by = 'status') THEN
            UPDATE tasks 
            SET status_id = _to_group 
            WHERE id = _task_id 
              AND status_id = _from_group
              AND project_id = _project_id;
        END IF;
        
        IF (_group_by = 'priority') THEN
            UPDATE tasks 
            SET priority_id = _to_group 
            WHERE id = _task_id 
              AND priority_id = _from_group
              AND project_id = _project_id;
        END IF;
        
        IF (_group_by = 'phase') THEN
            IF (is_null_or_empty(_to_group) IS FALSE) THEN
                INSERT INTO task_phase (task_id, phase_id)
                VALUES (_task_id, _to_group)
                ON CONFLICT (task_id) DO UPDATE SET phase_id = _to_group;
            ELSE
                DELETE FROM task_phase WHERE task_id = _task_id;
            END IF;
        END IF;
    END IF;

    -- Handle sort order changes using dynamic SQL
    IF (_from_index <> _to_index) THEN
        -- For the main sort_order column, we need to be careful about unique constraints
        IF _sort_column = 'sort_order' THEN
            -- Use a transaction-safe approach for the main sort_order column
            IF (_to_index > _from_index) THEN
                -- Moving down: decrease sort_order for items between old and new position
                UPDATE tasks SET sort_order = sort_order - 1 
                WHERE project_id = _project_id 
                  AND sort_order > _from_index 
                  AND sort_order <= _to_index;
            ELSE
                -- Moving up: increase sort_order for items between new and old position  
                UPDATE tasks SET sort_order = sort_order + 1 
                WHERE project_id = _project_id 
                  AND sort_order >= _to_index 
                  AND sort_order < _from_index;
            END IF;
            
            -- Set the new sort_order for the moved task
            UPDATE tasks SET sort_order = _to_index WHERE id = _task_id;
        ELSE
            -- For grouping-specific columns, use dynamic SQL since there's no unique constraint
            IF (_to_index > _from_index) THEN
                -- Moving down: decrease sort_order for items between old and new position
                _sql := 'UPDATE tasks SET ' || _sort_column || ' = ' || _sort_column || ' - 1 ' ||
                       'WHERE project_id = $1 AND ' || _sort_column || ' > $2 AND ' || _sort_column || ' <= $3';
                EXECUTE _sql USING _project_id, _from_index, _to_index;
            ELSE
                -- Moving up: increase sort_order for items between new and old position  
                _sql := 'UPDATE tasks SET ' || _sort_column || ' = ' || _sort_column || ' + 1 ' ||
                       'WHERE project_id = $1 AND ' || _sort_column || ' >= $2 AND ' || _sort_column || ' < $3';
                EXECUTE _sql USING _project_id, _to_index, _from_index;
            END IF;
            
            -- Set the new sort_order for the moved task
            _sql := 'UPDATE tasks SET ' || _sort_column || ' = $1 WHERE id = $2';
            EXECUTE _sql USING _to_index, _task_id;
        END IF;
    END IF;
END;
$$;