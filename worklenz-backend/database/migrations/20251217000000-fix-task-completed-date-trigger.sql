-- Migration: Fix task completed date trigger
-- Date: 2024-12-17
-- Description: Fix the task_status_change_trigger to properly update completed_at when task status changes to Done
-- This fixes issue #140 where completed_at was not being updated when tasks are marked as Done

-- Drop the existing trigger
DROP TRIGGER IF EXISTS tasks_status_id_change ON tasks;

-- Recreate the trigger function to modify NEW row directly instead of issuing another UPDATE
CREATE OR REPLACE FUNCTION task_status_change_trigger_fn() RETURNS TRIGGER AS
$$
DECLARE
BEGIN
    IF EXISTS(SELECT 1
              FROM sys_task_status_categories
              WHERE id = (SELECT category_id FROM task_statuses WHERE id = NEW.status_id)
                AND is_done IS TRUE)
    THEN
        NEW.completed_at = CURRENT_TIMESTAMP;
    ELSE
        NEW.completed_at = NULL;
    END IF;

    RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- Recreate the trigger as BEFORE UPDATE instead of AFTER UPDATE
-- This ensures completed_at is set in the same UPDATE statement
CREATE TRIGGER tasks_status_id_change
    BEFORE UPDATE OF status_id
    ON tasks
    FOR EACH ROW
    WHEN (OLD.status_id IS DISTINCT FROM new.status_id)
EXECUTE FUNCTION task_status_change_trigger_fn();

-- Update the handle_on_task_status_change function to set completed_at directly in the UPDATE
CREATE OR REPLACE FUNCTION handle_on_task_status_change(_user_id uuid, _task_id uuid, _status_id uuid) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _updater_name         TEXT;
    _task_name            TEXT;
    _previous_status_name TEXT;
    _new_status_name      TEXT;
    _message              TEXT;
    _task_info            JSON;
    _status_category      JSON;
    _schedule_id          JSON;
    _task_completed_at    TIMESTAMPTZ;
BEGIN
    SELECT COALESCE(name, '') FROM tasks WHERE id = _task_id INTO _task_name;

    SELECT COALESCE(name, '')
    FROM task_statuses
    WHERE id = (SELECT status_id FROM tasks WHERE id = _task_id)
    INTO _previous_status_name;

    SELECT COALESCE(name, '') FROM task_statuses WHERE id = _status_id INTO _new_status_name;

    IF (_previous_status_name != _new_status_name)
    THEN
        -- Update status_id and completed_at in a single statement
        -- Set completed_at based on whether the new status is "done"
        UPDATE tasks 
        SET status_id = _status_id,
            completed_at = CASE 
                WHEN EXISTS(SELECT 1 
                           FROM sys_task_status_categories 
                           WHERE id = (SELECT category_id FROM task_statuses WHERE id = _status_id) 
                           AND is_done IS TRUE) 
                THEN CURRENT_TIMESTAMP 
                ELSE NULL 
            END
        WHERE id = _task_id;

        SELECT get_task_complete_info(_task_id, _status_id) INTO _task_info;

        SELECT COALESCE(name, '') FROM users WHERE id = _user_id INTO _updater_name;

        _message = CONCAT(_updater_name, ' transitioned "', _task_name, '" from ', _previous_status_name, ' ⟶ ',
                          _new_status_name);
    END IF;

    SELECT completed_at FROM tasks WHERE id = _task_id INTO _task_completed_at;
    
    -- Handle schedule_id properly for recurring tasks
    SELECT CASE 
        WHEN schedule_id IS NULL THEN 'null'::json
        ELSE json_build_object('id', schedule_id)
    END
    FROM tasks 
    WHERE id = _task_id 
    INTO _schedule_id;

    SELECT COALESCE(ROW_TO_JSON(r), '{}'::JSON)
    FROM (SELECT is_done, is_doing, is_todo
          FROM sys_task_status_categories
          WHERE id = (SELECT category_id FROM task_statuses WHERE id = _status_id)) r
    INTO _status_category;

    RETURN JSON_BUILD_OBJECT(
            'message', COALESCE(_message, ''),
            'project_id', (SELECT project_id FROM tasks WHERE id = _task_id),
            'parent_done', (CASE
                                WHEN EXISTS(SELECT 1
                                            FROM tasks_with_status_view
                                            WHERE tasks_with_status_view.task_id = _task_id
                                              AND is_done IS TRUE) THEN 1
                                ELSE 0 END),
            'color_code', COALESCE((_task_info ->> 'color_code')::TEXT, ''),
            'color_code_dark', COALESCE((_task_info ->> 'color_code_dark')::TEXT, ''),
            'total_tasks', COALESCE((_task_info ->> 'total_tasks')::INT, 0),
            'total_completed', COALESCE((_task_info ->> 'total_completed')::INT, 0),
            'members', COALESCE((_task_info ->> 'members')::JSON, '[]'::JSON),
            'completed_at', _task_completed_at,
            'status_category', COALESCE(_status_category, '{}'::JSON),
            'schedule_id', COALESCE(_schedule_id, 'null'::JSON)
           );
END
$$;

-- Backfill completed_at for tasks that are currently in Done status but don't have a completed_at date
UPDATE tasks
SET completed_at = updated_at
WHERE completed_at IS NULL
  AND status_id IN (
      SELECT ts.id
      FROM task_statuses ts
      INNER JOIN sys_task_status_categories cat ON ts.category_id = cat.id
      WHERE cat.is_done = TRUE
  );
