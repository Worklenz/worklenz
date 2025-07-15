-- Migration: Fix sort order constraint violations

-- First, let's ensure all existing tasks have unique sort_order values within each project
-- This is a one-time fix to ensure data consistency

DO $$
DECLARE
    _project RECORD;
    _task RECORD;
    _counter INTEGER;
BEGIN
    -- For each project, reassign sort_order values to ensure uniqueness
    FOR _project IN 
        SELECT DISTINCT project_id 
        FROM tasks 
        WHERE project_id IS NOT NULL
    LOOP
        _counter := 0;
        
        -- Reassign sort_order values sequentially for this project
        FOR _task IN 
            SELECT id 
            FROM tasks 
            WHERE project_id = _project.project_id 
            ORDER BY sort_order, created_at
        LOOP
            UPDATE tasks 
            SET sort_order = _counter 
            WHERE id = _task.id;
            
            _counter := _counter + 1;
        END LOOP;
    END LOOP;
END
$$;

-- Now create a better version of our functions that properly handles the constraints

-- Updated bulk sort order function that avoids sort_order conflicts
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
    
    -- Process each update record
    FOR _update_record IN 
        SELECT 
            (item->>'task_id')::uuid as task_id,
            (item->>'sort_order')::int as sort_order,
            (item->>'status_id')::uuid as status_id,
            (item->>'priority_id')::uuid as priority_id,
            (item->>'phase_id')::uuid as phase_id
        FROM json_array_elements(_updates) as item
    LOOP
        -- Update the grouping-specific sort column and other fields
        _sql := 'UPDATE tasks SET ' || _sort_column || ' = $1, ' ||
                'status_id = COALESCE($2, status_id), ' ||
                'priority_id = COALESCE($3, priority_id), ' ||
                'updated_at = CURRENT_TIMESTAMP ' ||
                'WHERE id = $4';
        
        EXECUTE _sql USING 
            _update_record.sort_order,
            _update_record.status_id,
            _update_record.priority_id,
            _update_record.task_id;
        
        -- Handle phase updates separately since it's in a different table
        IF _update_record.phase_id IS NOT NULL THEN
            INSERT INTO task_phase (task_id, phase_id)
            VALUES (_update_record.task_id, _update_record.phase_id)
            ON CONFLICT (task_id) DO UPDATE SET phase_id = _update_record.phase_id;
        END IF;
    END LOOP;
END;
$$;

-- Also update the helper function to be more explicit
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
        -- For backward compatibility, still support general sort_order but be explicit
        WHEN 'general' THEN RETURN 'sort_order';
        ELSE RETURN 'status_sort_order'; -- Default to status sorting
    END CASE;
END;
$$;

-- Updated main sort order change handler that avoids conflicts
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
    
    -- Handle group changes first
    IF (_from_group <> _to_group OR (_from_group <> _to_group) IS NULL) THEN
        IF (_group_by = 'status') THEN
            UPDATE tasks 
            SET status_id = _to_group, updated_at = CURRENT_TIMESTAMP
            WHERE id = _task_id 
              AND project_id = _project_id;
        END IF;
        
        IF (_group_by = 'priority') THEN
            UPDATE tasks 
            SET priority_id = _to_group, updated_at = CURRENT_TIMESTAMP
            WHERE id = _task_id 
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

    -- Handle sort order changes for the grouping-specific column only
    IF (_from_index <> _to_index) THEN
        -- Update the grouping-specific sort order (no unique constraint issues)
        IF (_to_index > _from_index) THEN
            -- Moving down: decrease sort order for items between old and new position
            _sql := 'UPDATE tasks SET ' || _sort_column || ' = ' || _sort_column || ' - 1, ' ||
                   'updated_at = CURRENT_TIMESTAMP ' ||
                   'WHERE project_id = $1 AND ' || _sort_column || ' > $2 AND ' || _sort_column || ' <= $3';
            EXECUTE _sql USING _project_id, _from_index, _to_index;
        ELSE
            -- Moving up: increase sort order for items between new and old position  
            _sql := 'UPDATE tasks SET ' || _sort_column || ' = ' || _sort_column || ' + 1, ' ||
                   'updated_at = CURRENT_TIMESTAMP ' ||
                   'WHERE project_id = $1 AND ' || _sort_column || ' >= $2 AND ' || _sort_column || ' < $3';
            EXECUTE _sql USING _project_id, _to_index, _from_index;
        END IF;
        
        -- Set the new sort order for the moved task
        _sql := 'UPDATE tasks SET ' || _sort_column || ' = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2';
        EXECUTE _sql USING _to_index, _task_id;
    END IF;
END;
$$;