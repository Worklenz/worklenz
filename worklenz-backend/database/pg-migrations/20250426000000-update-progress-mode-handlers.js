/* eslint-disable camelcase */

exports.shorthands = undefined;
exports.noTransaction = false;

exports.up = pgm => {
  // Create the enum type first
  pgm.sql("CREATE TYPE progress_mode_type AS ENUM ('manual', 'weighted', 'time', 'default');");

  // Add the progress_mode column if it doesn't exist
  pgm.sql(`
    ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS progress_mode progress_mode_type;
  `);

  // If the column already existed as a different type, convert it
  pgm.sql(`
    DO $$
    BEGIN
        -- Check if column exists and is not the correct type
        IF EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'tasks' 
            AND column_name = 'progress_mode'
            AND data_type != 'USER-DEFINED'
        ) THEN
            -- Column exists but is wrong type, convert it
            ALTER TABLE tasks
            ALTER COLUMN progress_mode TYPE progress_mode_type
            USING CASE 
                WHEN progress_mode::text = 'manual' THEN 'manual'::progress_mode_type
                WHEN progress_mode::text = 'weighted' THEN 'weighted'::progress_mode_type  
                WHEN progress_mode::text = 'time' THEN 'time'::progress_mode_type
                ELSE 'default'::progress_mode_type
            END;
        END IF;
    END $$;
  `);

  pgm.sql(`
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
                    WHEN use_manual_progress IS TRUE THEN 'manual'
                    WHEN use_weighted_progress IS TRUE THEN 'weighted'
                    WHEN use_time_progress IS TRUE THEN 'time'
                    ELSE 'default'
                END
            INTO _current_mode
            FROM projects
            WHERE id = _project_id;
        ELSE
            _current_mode := 'default';
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
  `);

  pgm.sql(`
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
            progress_mode = 'weighted',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = _task_id;

        -- Return the updated task info
        RETURN JSON_BUILD_OBJECT(
            'task_id', _task_id,
            'weight', _weight
        );
    END;
    $$;
  `);

  pgm.sql(`
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
        
        -- Determine old and new modes
        _old_mode := 
            CASE
                WHEN OLD.use_manual_progress IS TRUE THEN 'manual'
                WHEN OLD.use_weighted_progress IS TRUE THEN 'weighted'
                WHEN OLD.use_time_progress IS TRUE THEN 'time'
                ELSE 'default'
            END;
        
        _new_mode := 
            CASE
                WHEN NEW.use_manual_progress IS TRUE THEN 'manual'
                WHEN NEW.use_weighted_progress IS TRUE THEN 'weighted'
                WHEN NEW.use_time_progress IS TRUE THEN 'time'
                ELSE 'default'
            END;
        
        -- If mode has changed, reset progress values for tasks with the old mode
        IF _old_mode <> _new_mode THEN
            -- Reset progress values for tasks that were set in the old mode
            UPDATE tasks
            SET progress_value = NULL,
                progress_mode = NULL
            WHERE project_id = _project_id
            AND progress_mode = _old_mode;
        END IF;
        
        RETURN NEW;
    END;
    $$;
  `);

  pgm.sql(`
    DROP TRIGGER IF EXISTS reset_progress_on_mode_change ON projects;
    CREATE TRIGGER reset_progress_on_mode_change
        AFTER UPDATE OF use_manual_progress, use_weighted_progress, use_time_progress
        ON projects
        FOR EACH ROW
        EXECUTE FUNCTION reset_project_progress_values();
  `);
};

exports.down = pgm => {
  pgm.sql('DROP TRIGGER IF EXISTS reset_progress_on_mode_change ON projects;');
  pgm.sql('DROP FUNCTION IF EXISTS reset_project_progress_values();');
  pgm.sql('DROP FUNCTION IF EXISTS on_update_task_weight(json);');
  pgm.sql('DROP FUNCTION IF EXISTS on_update_task_progress(json);');
  pgm.sql('ALTER TABLE tasks DROP COLUMN IF EXISTS progress_mode;');
  pgm.sql('DROP TYPE IF EXISTS progress_mode_type;');
};