BEGIN;

-- Add manual progress fields to tasks table
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS manual_progress BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS progress_value INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS weight INTEGER DEFAULT NULL;

-- Add progress-related fields to projects table
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS use_manual_progress BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS use_weighted_progress BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS use_time_progress BOOLEAN DEFAULT FALSE;

-- Update function to consider manual progress
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
    -- Check if manual progress is set
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
$$;

-- Update project functions to handle progress-related fields
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
$$;

CREATE OR REPLACE FUNCTION create_project(_body json) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _project_id                     UUID;
    _user_id                        UUID;
    _team_id                        UUID;
    _team_member_id                 UUID;
    _client_id                      UUID;
    _client_name                    TEXT;
    _project_name                   TEXT;
    _project_created_log            TEXT;
    _project_member_added_log       TEXT;
    _project_created_log_id         UUID;
    _project_manager_team_member_id UUID;
    _project_key                    TEXT;
BEGIN
    _client_name = TRIM((_body ->> 'client_name')::TEXT);
    _project_name = TRIM((_body ->> 'name')::TEXT);
    _project_key = TRIM((_body ->> 'key')::TEXT);
    _project_created_log = (_body ->> 'project_created_log')::TEXT;
    _project_member_added_log = (_body ->> 'project_member_added_log')::TEXT;
    _user_id = (_body ->> 'user_id')::UUID;
    _team_id = (_body ->> 'team_id')::UUID;
    _project_manager_team_member_id = (_body ->> 'project_manager_id')::UUID;

    SELECT id FROM team_members WHERE user_id = _user_id AND team_id = _team_id INTO _team_member_id;

    -- cache exists client if exists
    SELECT id FROM clients WHERE LOWER(name) = LOWER(_client_name) AND team_id = _team_id INTO _client_id;

    -- insert client if not exists
    IF is_null_or_empty(_client_id) IS TRUE AND is_null_or_empty(_client_name) IS FALSE
    THEN
        INSERT INTO clients (name, team_id) VALUES (_client_name, _team_id) RETURNING id INTO _client_id;
    END IF;

    -- check whether the project name is already in
    IF EXISTS(SELECT name FROM projects WHERE LOWER(name) = LOWER(_project_name) AND team_id = _team_id)
    THEN
        RAISE 'PROJECT_EXISTS_ERROR:%', _project_name;
    END IF;

    -- create the project
    INSERT
    INTO projects (name, key, color_code, start_date, end_date, team_id, notes, owner_id, status_id, health_id, folder_id,
                   category_id, estimated_working_days, estimated_man_days, hours_per_day, 
                   use_manual_progress, use_weighted_progress, use_time_progress, client_id)
    VALUES (_project_name,
            UPPER(_project_key),
            (_body ->> 'color_code')::TEXT,
            (_body ->> 'start_date')::TIMESTAMPTZ,
            (_body ->> 'end_date')::TIMESTAMPTZ,
            _team_id,
            (_body ->> 'notes')::TEXT,
            _user_id,
            (_body ->> 'status_id')::UUID,
            (_body ->> 'health_id')::UUID,
            (_body ->> 'folder_id')::UUID,
            (_body ->> 'category_id')::UUID,
            (_body ->> 'working_days')::INTEGER,
            (_body ->> 'man_days')::INTEGER,
            (_body ->> 'hours_per_day')::INTEGER,
            COALESCE((_body ->> 'use_manual_progress')::BOOLEAN, FALSE),
            COALESCE((_body ->> 'use_weighted_progress')::BOOLEAN, FALSE),
            COALESCE((_body ->> 'use_time_progress')::BOOLEAN, FALSE),
            _client_id)
    RETURNING id INTO _project_id;

    -- register the project log
    INSERT INTO project_logs (project_id, team_id, description)
    VALUES (_project_id, _team_id, _project_created_log)
    RETURNING id INTO _project_created_log_id;

    -- insert the project creator as a project member
    INSERT INTO project_members (team_member_id, project_access_level_id, project_id, role_id)
    VALUES (_team_member_id, (SELECT id FROM project_access_levels WHERE key = 'ADMIN'),
            _project_id,
            (SELECT id FROM roles WHERE team_id = _team_id AND default_role IS TRUE));

    -- insert statuses
    INSERT INTO task_statuses (name, project_id, team_id, category_id, sort_order)
    VALUES ('To Do', _project_id, _team_id, (SELECT id FROM sys_task_status_categories WHERE is_todo IS TRUE), 0);
    INSERT INTO task_statuses (name, project_id, team_id, category_id, sort_order)
    VALUES ('Doing', _project_id, _team_id, (SELECT id FROM sys_task_status_categories WHERE is_doing IS TRUE), 1);
    INSERT INTO task_statuses (name, project_id, team_id, category_id, sort_order)
    VALUES ('Done', _project_id, _team_id, (SELECT id FROM sys_task_status_categories WHERE is_done IS TRUE), 2);

    -- insert default project columns
    PERFORM insert_task_list_columns(_project_id);

    -- add project manager role if exists
    IF NOT is_null_or_empty(_project_manager_team_member_id) THEN
        PERFORM update_project_manager(_project_manager_team_member_id, _project_id);
    END IF;

    RETURN JSON_BUILD_OBJECT(
            'id', _project_id,
            'name', _project_name,
            'project_created_log_id', _project_created_log_id
        );
END;
$$;

COMMIT;

BEGIN;

-- Update function to use time-based progress for all tasks
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
    _task_complete    BOOLEAN = FALSE;
BEGIN
    -- Check if manual progress is set for this task
    SELECT manual_progress, progress_value, project_id,
           EXISTS(
               SELECT 1
               FROM tasks_with_status_view
               WHERE tasks_with_status_view.task_id = tasks.id
               AND is_done IS TRUE
           ) AS is_complete
    FROM tasks 
    WHERE id = _task_id
    INTO _is_manual, _manual_value, _project_id, _task_complete;
    
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
    
    -- If task is complete, always return 100%
    IF _task_complete IS TRUE THEN
        RETURN JSON_BUILD_OBJECT(
            'ratio', 100,
            'total_completed', 1,
            'total_tasks', 1,
            'is_manual', FALSE
        );
    END IF;
    
    -- Use manual progress value in two cases:
    -- 1. When task has manual_progress = TRUE and progress_value is set
    -- 2. When project has use_manual_progress = TRUE and progress_value is set
    IF (_is_manual IS TRUE AND _manual_value IS NOT NULL) OR 
       (_use_manual_progress IS TRUE AND _manual_value IS NOT NULL) THEN
        RETURN JSON_BUILD_OBJECT(
            'ratio', _manual_value,
            'total_completed', 0,
            'total_tasks', 0,
            'is_manual', TRUE
        );
    END IF;
    
    -- If there are no subtasks, just use the parent task's status (unless in time-based mode)
    IF _sub_tasks_count = 0 THEN
        -- Use time-based estimation for tasks without subtasks if enabled
        IF _use_time_progress IS TRUE THEN
            -- For time-based tasks without subtasks, we still need some progress calculation
            -- If the task is completed, return 100%
            -- Otherwise, use the progress value if set manually, or 0
            SELECT 
                CASE 
                    WHEN _task_complete IS TRUE THEN 100
                    ELSE COALESCE(_manual_value, 0)
                END
            INTO _ratio;
        ELSE
            -- Traditional calculation for non-time-based tasks
            SELECT (CASE WHEN _task_complete IS TRUE THEN 1 ELSE 0 END)
            INTO _parent_task_done;
            
            _ratio = _parent_task_done * 100;
        END IF;
    ELSE
        -- If project uses manual progress, calculate based on subtask manual progress values
        IF _use_manual_progress IS TRUE THEN
            WITH subtask_progress AS (
                SELECT 
                    t.id,
                    t.manual_progress,
                    t.progress_value,
                    EXISTS(
                        SELECT 1
                        FROM tasks_with_status_view
                        WHERE tasks_with_status_view.task_id = t.id
                        AND is_done IS TRUE
                    ) AS is_complete
                FROM tasks t
                WHERE t.parent_task_id = _task_id
                AND t.archived IS FALSE
            ),
            subtask_with_values AS (
                SELECT 
                    CASE 
                        -- For completed tasks, always use 100%
                        WHEN is_complete IS TRUE THEN 100
                        -- For tasks with progress value set, use it regardless of manual_progress flag
                        WHEN progress_value IS NOT NULL THEN progress_value
                        -- Default to 0 for incomplete tasks with no progress value
                        ELSE 0
                    END AS progress_value
                FROM subtask_progress
            )
            SELECT COALESCE(AVG(progress_value), 0)
            FROM subtask_with_values
            INTO _ratio;
        -- If project uses weighted progress, calculate based on subtask weights
        ELSIF _use_weighted_progress IS TRUE THEN
            WITH subtask_progress AS (
                SELECT 
                    t.id,
                    t.manual_progress,
                    t.progress_value,
                    EXISTS(
                        SELECT 1
                        FROM tasks_with_status_view
                        WHERE tasks_with_status_view.task_id = t.id
                        AND is_done IS TRUE
                    ) AS is_complete,
                    COALESCE(t.weight, 100) AS weight
                FROM tasks t
                WHERE t.parent_task_id = _task_id
                AND t.archived IS FALSE
            ),
            subtask_with_values AS (
                SELECT 
                    CASE 
                        -- For completed tasks, always use 100%
                        WHEN is_complete IS TRUE THEN 100
                        -- For tasks with progress value set, use it regardless of manual_progress flag
                        WHEN progress_value IS NOT NULL THEN progress_value
                        -- Default to 0 for incomplete tasks with no progress value
                        ELSE 0
                    END AS progress_value,
                    weight
                FROM subtask_progress
            )
            SELECT COALESCE(
                SUM(progress_value * weight) / NULLIF(SUM(weight), 0),
                0
            )
            FROM subtask_with_values
            INTO _ratio;
        -- If project uses time-based progress, calculate based on estimated time
        ELSIF _use_time_progress IS TRUE THEN
            WITH subtask_progress AS (
                SELECT 
                    t.id,
                    t.manual_progress,
                    t.progress_value,
                    EXISTS(
                        SELECT 1
                        FROM tasks_with_status_view
                        WHERE tasks_with_status_view.task_id = t.id
                        AND is_done IS TRUE
                    ) AS is_complete,
                    COALESCE(t.total_minutes, 0) AS estimated_minutes
                FROM tasks t
                WHERE t.parent_task_id = _task_id
                AND t.archived IS FALSE
            ),
            subtask_with_values AS (
                SELECT 
                    CASE 
                        -- For completed tasks, always use 100%
                        WHEN is_complete IS TRUE THEN 100
                        -- For tasks with progress value set, use it regardless of manual_progress flag
                        WHEN progress_value IS NOT NULL THEN progress_value
                        -- Default to 0 for incomplete tasks with no progress value
                        ELSE 0
                    END AS progress_value,
                    estimated_minutes
                FROM subtask_progress
            )
            SELECT COALESCE(
                SUM(progress_value * estimated_minutes) / NULLIF(SUM(estimated_minutes), 0),
                0
            )
            FROM subtask_with_values
            INTO _ratio;
        ELSE
            -- Traditional calculation based on completion status
            SELECT (CASE WHEN _task_complete IS TRUE THEN 1 ELSE 0 END)
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
$$;

CREATE OR REPLACE FUNCTION public.get_task_form_view_model(_user_id UUID, _team_id UUID, _task_id UUID, _project_id UUID) RETURNS JSON
    LANGUAGE plpgsql
AS
$$
DECLARE
    _task         JSON;
    _priorities   JSON;
    _projects     JSON;
    _statuses     JSON;
    _team_members JSON;
    _assignees    JSON;
    _phases       JSON;
BEGIN

    -- Select task info
    SELECT COALESCE(ROW_TO_JSON(rec), '{}'::JSON)
    INTO _task
    FROM (WITH RECURSIVE task_hierarchy AS (
        -- Base case: Start with the given task
        SELECT id,
               parent_task_id,
               0 AS level
        FROM tasks
        WHERE id = _task_id

        UNION ALL

        -- Recursive case: Traverse up to parent tasks
        SELECT t.id,
               t.parent_task_id,
               th.level + 1 AS level
        FROM tasks t
                 INNER JOIN task_hierarchy th ON t.id = th.parent_task_id
        WHERE th.parent_task_id IS NOT NULL)
          SELECT id,
                 name,
                 description,
                 start_date,
                 end_date,
                 done,
                 total_minutes,
                 priority_id,
                 project_id,
                 created_at,
                 updated_at,
                 status_id,
                 parent_task_id,
                 sort_order,
                 (SELECT phase_id FROM task_phase WHERE task_id = tasks.id)                      AS phase_id,
                 CONCAT((SELECT key FROM projects WHERE id = tasks.project_id), '-', task_no)    AS task_key,
                 (SELECT start_time
                  FROM task_timers
                  WHERE task_id = tasks.id
                    AND user_id = _user_id)                                                      AS timer_start_time,
                 parent_task_id IS NOT NULL                                                      AS is_sub_task,
                 (SELECT COUNT('*')
                  FROM tasks
                  WHERE parent_task_id = tasks.id
                    AND archived IS FALSE)                                                       AS sub_tasks_count,
                 (SELECT COUNT(*)
                  FROM tasks_with_status_view tt
                  WHERE (tt.parent_task_id = tasks.id OR tt.task_id = tasks.id)
                    AND tt.is_done IS TRUE)
                                                                                                 AS completed_count,
                 (SELECT COUNT(*) FROM task_attachments WHERE task_id = tasks.id)                AS attachments_count,
                 (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(r))), '[]'::JSON)
                  FROM (SELECT task_labels.label_id AS id,
                               (SELECT name FROM team_labels WHERE id = task_labels.label_id),
                               (SELECT color_code FROM team_labels WHERE id = task_labels.label_id)
                        FROM task_labels
                        WHERE task_id = tasks.id
                        ORDER BY name) r)                                                        AS labels,
                 (SELECT color_code
                  FROM sys_task_status_categories
                  WHERE id = (SELECT category_id FROM task_statuses WHERE id = tasks.status_id)) AS status_color,
                 (SELECT COUNT(*) FROM tasks WHERE parent_task_id = _task_id)                    AS sub_tasks_count,
                 (SELECT name FROM users WHERE id = tasks.reporter_id)                           AS reporter,
                 (SELECT get_task_assignees(tasks.id))                                           AS assignees,
                 (SELECT id FROM team_members WHERE user_id = _user_id AND team_id = _team_id)   AS team_member_id,
                 billable,
                 schedule_id,
                 progress_value,
                 weight,
                 (SELECT MAX(level) FROM task_hierarchy)                                         AS task_level
          FROM tasks
          WHERE id = _task_id) rec;

    SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
    INTO _priorities
    FROM (SELECT id, name FROM task_priorities ORDER BY value) rec;

    SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
    INTO _phases
    FROM (SELECT id, name FROM project_phases WHERE project_id = _project_id ORDER BY name) rec;

    SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
    INTO _projects
    FROM (SELECT id, name
          FROM projects
          WHERE team_id = _team_id
            AND (CASE
                     WHEN (is_owner(_user_id, _team_id) OR is_admin(_user_id, _team_id) IS TRUE) THEN TRUE
                     ELSE is_member_of_project(projects.id, _user_id, _team_id) END)
          ORDER BY name) rec;

    SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
    INTO _statuses
    FROM (SELECT id, name FROM task_statuses WHERE project_id = _project_id) rec;

    SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
    INTO _team_members
    FROM (SELECT team_members.id,
                 (SELECT name FROM team_member_info_view WHERE team_member_info_view.team_member_id = team_members.id),
                 (SELECT email FROM team_member_info_view WHERE team_member_info_view.team_member_id = team_members.id),
                 (SELECT avatar_url
                  FROM team_member_info_view
                  WHERE team_member_info_view.team_member_id = team_members.id)
          FROM team_members
                   LEFT JOIN users u ON team_members.user_id = u.id
          WHERE team_id = _team_id
            AND team_members.active IS TRUE) rec;

    SELECT get_task_assignees(_task_id) INTO _assignees;

    RETURN JSON_BUILD_OBJECT(
            'task', _task,
            'priorities', _priorities,
            'projects', _projects,
            'statuses', _statuses,
            'team_members', _team_members,
            'assignees', _assignees,
            'phases', _phases
           );
END;
$$;

COMMIT;


