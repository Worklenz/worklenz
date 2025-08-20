/* eslint-disable camelcase */

exports.shorthands = undefined;
exports.noTransaction = true;

exports.up = pgm => {
  // Add progress-related columns to projects table if they don't exist
  pgm.sql(`
    ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS use_manual_progress BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS use_weighted_progress BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS use_time_progress BOOLEAN DEFAULT FALSE
  `);

  // Update get_task_complete_ratio function to consider subtask manual progress
  pgm.sql(`
    CREATE OR REPLACE FUNCTION get_task_complete_ratio(_task_id uuid) RETURNS json
        LANGUAGE plpgsql
    AS
    $$
    DECLARE
        _parent_task_done FLOAT = 0;
        _sub_tasks_done   FLOAT = 0;
        _sub_tasks_count  FLOAT = 0;
        _total_completed  FLOAT = 0;
        _total_tasks      FLOAT = 0;
        _ratio            FLOAT = 0;
        _is_manual        BOOLEAN = FALSE;
        _manual_value     INTEGER = NULL;
        _project_id       UUID;
        _use_manual_progress BOOLEAN = FALSE;
        _use_weighted_progress BOOLEAN = FALSE;
        _use_time_progress BOOLEAN = FALSE;
    BEGIN
        -- Check if manual progress is set for this task
        SELECT manual_progress, progress_value, project_id
        FROM tasks 
        WHERE id = _task_id
        INTO _is_manual, _manual_value, _project_id;
        
        -- Check if the project uses manual progress
        IF _project_id IS NOT NULL THEN
            SELECT COALESCE(use_manual_progress, FALSE),
                   COALESCE(use_weighted_progress, FALSE),
                   COALESCE(use_time_progress, FALSE)
            FROM projects
            WHERE id = _project_id
            INTO _use_manual_progress, _use_weighted_progress, _use_time_progress;
        END IF;
        
        -- Get all subtasks
        SELECT COUNT(*) 
        FROM tasks 
        WHERE parent_task_id = _task_id AND archived IS FALSE 
        INTO _sub_tasks_count;
        
        -- If manual progress is enabled and has a value AND there are no subtasks, use it directly
        IF _is_manual IS TRUE AND _manual_value IS NOT NULL AND _sub_tasks_count = 0 THEN
            RETURN JSON_BUILD_OBJECT(
                'ratio', _manual_value,
                'total_completed', 0,
                'total_tasks', 0,
                'is_manual', TRUE
            );
        END IF;
        
        -- If there are no subtasks, just use the parent task's status
        IF _sub_tasks_count = 0 THEN
            SELECT (CASE
                        WHEN EXISTS(SELECT 1
                                    FROM tasks_with_status_view
                                    WHERE tasks_with_status_view.task_id = _task_id
                                      AND is_done IS TRUE) THEN 1
                        ELSE 0 END)
            INTO _parent_task_done;
            
            _ratio = _parent_task_done * 100;
        ELSE
            -- If project uses manual progress, calculate based on subtask manual progress values
            IF _use_manual_progress IS TRUE THEN
                WITH subtask_progress AS (
                    SELECT 
                        CASE 
                            -- If subtask has manual progress, use that value
                            WHEN manual_progress IS TRUE AND progress_value IS NOT NULL THEN 
                                progress_value
                            -- Otherwise use completion status (0 or 100)
                            ELSE
                                CASE 
                                    WHEN EXISTS(
                                        SELECT 1
                                        FROM tasks_with_status_view
                                        WHERE tasks_with_status_view.task_id = t.id
                                        AND is_done IS TRUE
                                    ) THEN 100
                                    ELSE 0
                                END
                        END AS progress_value
                    FROM tasks t
                    WHERE t.parent_task_id = _task_id
                    AND t.archived IS FALSE
                )
                SELECT COALESCE(AVG(progress_value), 0)
                FROM subtask_progress
                INTO _ratio;
            -- If project uses weighted progress, calculate based on subtask weights
            ELSIF _use_weighted_progress IS TRUE THEN
                WITH subtask_progress AS (
                    SELECT 
                        CASE 
                            -- If subtask has manual progress, use that value
                            WHEN manual_progress IS TRUE AND progress_value IS NOT NULL THEN 
                                progress_value
                            -- Otherwise use completion status (0 or 100)
                            ELSE
                                CASE 
                                    WHEN EXISTS(
                                        SELECT 1
                                        FROM tasks_with_status_view
                                        WHERE tasks_with_status_view.task_id = t.id
                                        AND is_done IS TRUE
                                    ) THEN 100
                                    ELSE 0
                                END
                        END AS progress_value,
                        COALESCE(weight, 100) AS weight
                    FROM tasks t
                    WHERE t.parent_task_id = _task_id
                    AND t.archived IS FALSE
                )
                SELECT COALESCE(
                    SUM(progress_value * weight) / NULLIF(SUM(weight), 0),
                    0
                )
                FROM subtask_progress
                INTO _ratio;
            -- If project uses time-based progress, calculate based on estimated time
            ELSIF _use_time_progress IS TRUE THEN
                WITH subtask_progress AS (
                    SELECT 
                        CASE 
                            -- If subtask has manual progress, use that value
                            WHEN manual_progress IS TRUE AND progress_value IS NOT NULL THEN 
                                progress_value
                            -- Otherwise use completion status (0 or 100)
                            ELSE
                                CASE 
                                    WHEN EXISTS(
                                        SELECT 1
                                        FROM tasks_with_status_view
                                        WHERE tasks_with_status_view.task_id = t.id
                                        AND is_done IS TRUE
                                    ) THEN 100
                                    ELSE 0
                                END
                        END AS progress_value,
                        COALESCE(total_minutes, 0) AS estimated_minutes
                    FROM tasks t
                    WHERE t.parent_task_id = _task_id
                    AND t.archived IS FALSE
                )
                SELECT COALESCE(
                    SUM(progress_value * estimated_minutes) / NULLIF(SUM(estimated_minutes), 0),
                    0
                )
                FROM subtask_progress
                INTO _ratio;
            ELSE
                -- Traditional calculation based on completion status
                SELECT (CASE
                            WHEN EXISTS(SELECT 1
                                        FROM tasks_with_status_view
                                        WHERE tasks_with_status_view.task_id = _task_id
                                          AND is_done IS TRUE) THEN 1
                            ELSE 0 END)
                INTO _parent_task_done;
                
                SELECT COUNT(*)
                FROM tasks_with_status_view
                WHERE parent_task_id = _task_id
                  AND is_done IS TRUE
                INTO _sub_tasks_done;
                
                _total_completed = _parent_task_done + _sub_tasks_done;
                _total_tasks = _sub_tasks_count + 1; -- +1 for the parent task
                
                IF _total_tasks = 0 THEN
                    _ratio = 0;
                ELSE
                    _ratio = (_total_completed / _total_tasks) * 100;
                END IF;
            END IF;
        END IF;
        
        -- Ensure ratio is between 0 and 100
        IF _ratio < 0 THEN
            _ratio = 0;
        ELSIF _ratio > 100 THEN
            _ratio = 100;
        END IF;

        RETURN JSON_BUILD_OBJECT(
            'ratio', _ratio,
            'total_completed', _total_completed,
            'total_tasks', _total_tasks,
            'is_manual', _is_manual
        );
    END
    $$
  `);

  // Update update_project function to handle new progress fields
  pgm.sql(`
    CREATE OR REPLACE FUNCTION update_project(_body json) RETURNS json
        LANGUAGE plpgsql
    AS
    $$
    DECLARE
        _user_id                        UUID;
        _team_id                        UUID;
        _client_id                      UUID;
        _project_id                     UUID;
        _project_manager_team_member_id UUID;
        _client_name                    TEXT;
        _project_name                   TEXT;
    BEGIN
        -- need a test, can be throw errors
        _client_name = TRIM((_body ->> 'client_name')::TEXT);
        _project_name = TRIM((_body ->> 'name')::TEXT);

        -- add inside the controller
        _user_id = (_body ->> 'user_id')::UUID;
        _team_id = (_body ->> 'team_id')::UUID;
        _project_manager_team_member_id = (_body ->> 'team_member_id')::UUID;

        -- cache exists client if exists
        SELECT id FROM clients WHERE LOWER(name) = LOWER(_client_name) AND team_id = _team_id INTO _client_id;

        -- insert client if not exists
        IF is_null_or_empty(_client_id) IS TRUE AND is_null_or_empty(_client_name) IS FALSE
        THEN
            INSERT INTO clients (name, team_id) VALUES (_client_name, _team_id) RETURNING id INTO _client_id;
        END IF;

        -- check whether the project name is already in
        IF EXISTS(
            SELECT name FROM projects WHERE LOWER(name) = LOWER(_project_name)
                                        AND team_id = _team_id AND id != (_body ->> 'id')::UUID
        )
        THEN
            RAISE 'PROJECT_EXISTS_ERROR:%', _project_name;
        END IF;

        -- update the project
        UPDATE projects
        SET name                   = _project_name,
            notes                  = (_body ->> 'notes')::TEXT,
            color_code             = (_body ->> 'color_code')::TEXT,
            status_id              = (_body ->> 'status_id')::UUID,
            health_id              = (_body ->> 'health_id')::UUID,
            key                    = (_body ->> 'key')::TEXT,
            start_date             = (_body ->> 'start_date')::TIMESTAMPTZ,
            end_date               = (_body ->> 'end_date')::TIMESTAMPTZ,
            client_id              = _client_id,
            folder_id              = (_body ->> 'folder_id')::UUID,
            category_id            = (_body ->> 'category_id')::UUID,
            updated_at             = CURRENT_TIMESTAMP,
            estimated_working_days = (_body ->> 'working_days')::INTEGER,
            estimated_man_days     = (_body ->> 'man_days')::INTEGER,
            hours_per_day          = (_body ->> 'hours_per_day')::INTEGER,
            use_manual_progress    = COALESCE((_body ->> 'use_manual_progress')::BOOLEAN, FALSE),
            use_weighted_progress  = COALESCE((_body ->> 'use_weighted_progress')::BOOLEAN, FALSE),
            use_time_progress      = COALESCE((_body ->> 'use_time_progress')::BOOLEAN, FALSE)
        WHERE id = (_body ->> 'id')::UUID
          AND team_id = _team_id
        RETURNING id INTO _project_id;

        UPDATE project_members SET project_access_level_id = (SELECT id FROM project_access_levels WHERE key = 'MEMBER') WHERE project_id = _project_id;

        IF NOT (_project_manager_team_member_id IS NULL)
        THEN
            PERFORM update_project_manager(_project_manager_team_member_id, _project_id::UUID);
        END IF;

        RETURN JSON_BUILD_OBJECT(
                'id', _project_id,
                'name', (_body ->> 'name')::TEXT,
                'project_manager_id', _project_manager_team_member_id::UUID
            );
    END;
    $$
  `);

  // Create trigger function to reset parent task manual progress when subtasks are added
  pgm.sql(`
    CREATE OR REPLACE FUNCTION reset_parent_task_manual_progress() RETURNS TRIGGER AS
    $$
    BEGIN
        -- When a task gets a new subtask (parent_task_id is set), reset the parent's manual_progress flag
        IF NEW.parent_task_id IS NOT NULL THEN
            UPDATE tasks 
            SET manual_progress = false
            WHERE id = NEW.parent_task_id 
            AND manual_progress = true;
        END IF;
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `);

  // Create the trigger on the tasks table
  pgm.sql(`DROP TRIGGER IF EXISTS reset_parent_manual_progress_trigger ON tasks`);
  pgm.sql(`
    CREATE TRIGGER reset_parent_manual_progress_trigger
    AFTER INSERT OR UPDATE OF parent_task_id ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION reset_parent_task_manual_progress()
  `);
};

exports.down = pgm => {
  // Drop trigger and function
  pgm.sql('DROP TRIGGER IF EXISTS reset_parent_manual_progress_trigger ON tasks');
  pgm.sql('DROP FUNCTION IF EXISTS reset_parent_task_manual_progress()');
  
  // Remove progress-related columns from projects table
  pgm.sql(`
    ALTER TABLE projects 
    DROP COLUMN IF EXISTS use_time_progress,
    DROP COLUMN IF EXISTS use_weighted_progress,
    DROP COLUMN IF EXISTS use_manual_progress
  `);

  // Revert get_task_complete_ratio function to previous version (simplified)
  pgm.sql(`
    CREATE OR REPLACE FUNCTION get_task_complete_ratio(_task_id uuid) RETURNS json
        LANGUAGE plpgsql
    AS
    $$
    DECLARE
        _parent_task_done FLOAT = 0;
        _sub_tasks_done   FLOAT = 0;
        _sub_tasks_count  FLOAT = 0;
        _total_completed  FLOAT = 0;
        _total_tasks      FLOAT = 0;
        _ratio            FLOAT = 0;
        _is_manual        BOOLEAN = FALSE;
        _manual_value     INTEGER = NULL;
    BEGIN
        -- Check if manual progress is set
        SELECT manual_progress, progress_value
        FROM tasks
        WHERE id = _task_id
        INTO _is_manual, _manual_value;

        -- If manual progress is enabled and has a value, use it directly
        IF _is_manual IS TRUE AND _manual_value IS NOT NULL THEN
            RETURN JSON_BUILD_OBJECT(
                'ratio', _manual_value,
                'total_completed', 0,
                'total_tasks', 0,
                'is_manual', TRUE
            );
        END IF;

        -- Otherwise calculate automatically as before
        SELECT (CASE
                    WHEN EXISTS(SELECT 1
                                FROM tasks_with_status_view
                                WHERE tasks_with_status_view.task_id = _task_id
                                  AND is_done IS TRUE) THEN 1
                    ELSE 0 END)
        INTO _parent_task_done;
        SELECT COUNT(*) FROM tasks WHERE parent_task_id = _task_id AND archived IS FALSE INTO _sub_tasks_count;

        SELECT COUNT(*)
        FROM tasks_with_status_view
        WHERE parent_task_id = _task_id
          AND is_done IS TRUE
        INTO _sub_tasks_done;

        _total_completed = _parent_task_done + _sub_tasks_done;
        _total_tasks = _sub_tasks_count; -- +1 for the parent task

        IF _total_tasks > 0 THEN
            _ratio = (_total_completed / _total_tasks) * 100;
        ELSE
            _ratio = _parent_task_done * 100;
        END IF;

        RETURN JSON_BUILD_OBJECT(
            'ratio', _ratio,
            'total_completed', _total_completed,
            'total_tasks', _total_tasks,
            'is_manual', FALSE
        );
    END
    $$
  `);
};

exports.__migration = {
  transaction: false,
};