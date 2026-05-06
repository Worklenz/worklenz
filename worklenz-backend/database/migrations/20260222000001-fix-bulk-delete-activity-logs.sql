-- Migration: Fix bulk_delete_tasks to create activity logs before deletion
-- Date: 2026-02-22
-- Description: Updates the bulk_delete_tasks stored procedure to insert activity logs
--              before deleting tasks, so Last Activity updates correctly

-- Drop the existing function
DROP FUNCTION IF EXISTS bulk_delete_tasks(json);

-- Recreate the function with activity log support
CREATE OR REPLACE FUNCTION bulk_delete_tasks(_body json) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _task        JSON;
    _output      JSON;
    _task_id     UUID;
    _user_id     UUID;
    _project_id  UUID;
    _team_id     UUID;
BEGIN
    -- Extract user_id from body
    _user_id := (_body ->> 'user_id')::UUID;

    -- Loop through each task to delete
    FOR _task IN SELECT * FROM JSON_ARRAY_ELEMENTS((_body ->> 'tasks')::JSON)
        LOOP
            _task_id := (_task ->> 'id')::UUID;

            -- Fetch task details before deletion
            SELECT t.project_id, p.team_id
            INTO _project_id, _team_id
            FROM tasks t
                     JOIN projects p ON p.id = t.project_id
            WHERE t.id = _task_id;

            -- Insert activity log BEFORE deletion
            IF _project_id IS NOT NULL AND _user_id IS NOT NULL THEN
                INSERT INTO task_activity_logs (task_id, team_id, project_id, user_id, log_type, attribute_type, created_at)
                VALUES (_task_id, _team_id, _project_id, _user_id, 'delete', 'task', NOW());
            END IF;

            -- Delete the task (CASCADE will set task_id to NULL in activity log due to previous migration)
            DELETE FROM tasks WHERE id = _task_id;
        END LOOP;

    RETURN _output;
END;
$$;
