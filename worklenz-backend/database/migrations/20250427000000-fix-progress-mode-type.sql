-- Migration: Fix progress_mode_type ENUM and casting issues
-- Date: 2025-04-27
-- Version: 1.0.0

BEGIN;

-- First, let's ensure the ENUM type exists with the correct values
DO $$
BEGIN
    -- Check if the type exists
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'progress_mode_type') THEN
        CREATE TYPE progress_mode_type AS ENUM ('manual', 'weighted', 'time', 'default');
    ELSE
        -- Add any missing values to the existing ENUM
        BEGIN
            ALTER TYPE progress_mode_type ADD VALUE IF NOT EXISTS 'manual';
            ALTER TYPE progress_mode_type ADD VALUE IF NOT EXISTS 'weighted';
            ALTER TYPE progress_mode_type ADD VALUE IF NOT EXISTS 'time';
            ALTER TYPE progress_mode_type ADD VALUE IF NOT EXISTS 'default';
        EXCEPTION
            WHEN duplicate_object THEN
                -- Ignore if values already exist
                NULL;
        END;
    END IF;
END $$;

-- Update functions to use proper type casting
CREATE OR REPLACE FUNCTION on_update_task_progress(_body json) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _task_id UUID;
    _progress_value INTEGER;
    _parent_task_id UUID;
    _project_id UUID;
    _current_mode progress_mode_type;
BEGIN
    _task_id = (_body ->> 'task_id')::UUID;
    _progress_value = (_body ->> 'progress_value')::INTEGER;
    _parent_task_id = (_body ->> 'parent_task_id')::UUID;
    
    -- Get the project ID and determine the current progress mode
    SELECT project_id INTO _project_id FROM tasks WHERE id = _task_id;
    
    IF _project_id IS NOT NULL THEN
        SELECT 
            CASE
                WHEN use_manual_progress IS TRUE THEN 'manual'::progress_mode_type
                WHEN use_weighted_progress IS TRUE THEN 'weighted'::progress_mode_type
                WHEN use_time_progress IS TRUE THEN 'time'::progress_mode_type
                ELSE 'default'::progress_mode_type
            END
        INTO _current_mode
        FROM projects
        WHERE id = _project_id;
    ELSE
        _current_mode := 'default'::progress_mode_type;
    END IF;
    
    -- Update the task with progress value and set the progress mode
    UPDATE tasks
    SET progress_value = _progress_value,
        manual_progress = TRUE,
        progress_mode = _current_mode,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = _task_id;

    -- Return the updated task info
    RETURN JSON_BUILD_OBJECT(
        'task_id', _task_id,
        'progress_value', _progress_value,
        'progress_mode', _current_mode
    );
END;
$$;

-- Update the on_update_task_weight function to use proper type casting
CREATE OR REPLACE FUNCTION on_update_task_weight(_body json) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _task_id UUID;
    _weight INTEGER;
    _parent_task_id UUID;
    _project_id UUID;
BEGIN
    _task_id = (_body ->> 'task_id')::UUID;
    _weight = (_body ->> 'weight')::INTEGER;
    _parent_task_id = (_body ->> 'parent_task_id')::UUID;
    
    -- Get the project ID
    SELECT project_id INTO _project_id FROM tasks WHERE id = _task_id;
    
    -- Update the task with weight value and set progress_mode to 'weighted'
    UPDATE tasks
    SET weight = _weight,
        progress_mode = 'weighted'::progress_mode_type,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = _task_id;

    -- Return the updated task info
    RETURN JSON_BUILD_OBJECT(
        'task_id', _task_id,
        'weight', _weight
    );
END;
$$;

-- Update the reset_project_progress_values function to use proper type casting
CREATE OR REPLACE FUNCTION reset_project_progress_values() RETURNS TRIGGER
    LANGUAGE plpgsql
AS
$$
DECLARE
    _old_mode progress_mode_type;
    _new_mode progress_mode_type;
    _project_id UUID;
BEGIN
    _project_id := NEW.id;
    
    -- Determine old and new modes with proper type casting
    _old_mode := 
        CASE
            WHEN OLD.use_manual_progress IS TRUE THEN 'manual'::progress_mode_type
            WHEN OLD.use_weighted_progress IS TRUE THEN 'weighted'::progress_mode_type
            WHEN OLD.use_time_progress IS TRUE THEN 'time'::progress_mode_type
            ELSE 'default'::progress_mode_type
        END;
    
    _new_mode := 
        CASE
            WHEN NEW.use_manual_progress IS TRUE THEN 'manual'::progress_mode_type
            WHEN NEW.use_weighted_progress IS TRUE THEN 'weighted'::progress_mode_type
            WHEN NEW.use_time_progress IS TRUE THEN 'time'::progress_mode_type
            ELSE 'default'::progress_mode_type
        END;
    
    -- If mode has changed, reset progress values for tasks with the old mode
    IF _old_mode <> _new_mode THEN
        -- Reset progress values for tasks that were set in the old mode
        UPDATE tasks
        SET progress_value = NULL,
            progress_mode = NULL
        WHERE project_id = _project_id
        AND progress_mode::text::progress_mode_type = _old_mode;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Update the tasks table to ensure proper type casting for existing values
UPDATE tasks
SET progress_mode = progress_mode::text::progress_mode_type
WHERE progress_mode IS NOT NULL;

COMMIT; 