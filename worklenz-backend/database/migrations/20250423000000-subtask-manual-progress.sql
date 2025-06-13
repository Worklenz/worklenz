-- Migration: Enhance manual task progress with subtask support
-- Date: 2025-04-23
-- Version: 1.0.0

BEGIN;

-- Update function to consider subtask manual progress when calculating parent task progress
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
$$;

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

-- 3. Also modify the create_project function to handle the new fields during project creation
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

-- 4. Update the getById function to include the new fields in the response
CREATE OR REPLACE FUNCTION getProjectById(_project_id UUID, _team_id UUID) RETURNS JSON
    LANGUAGE plpgsql
AS
$$
DECLARE
    _result JSON;
BEGIN
    SELECT ROW_TO_JSON(rec) INTO _result
    FROM (SELECT p.id,
                 p.name,
                 p.key,
                 p.color_code,
                 p.start_date,
                 p.end_date,
                 c.name                                                              AS client_name,
                 c.id                                                                AS client_id,
                 p.notes,
                 p.created_at,
                 p.updated_at,
                 ts.name                                                             AS status,
                 ts.color_code                                                       AS status_color,
                 ts.icon                                                             AS status_icon,
                 ts.id                                                               AS status_id,
                 h.name                                                              AS health,
                 h.color_code                                                        AS health_color,
                 h.icon                                                              AS health_icon,
                 h.id                                                                AS health_id,
                 pc.name                                                             AS category_name,
                 pc.color_code                                                       AS category_color,
                 pc.id                                                               AS category_id,
                 p.phase_label,
                 p.estimated_man_days                                                AS man_days,
                 p.estimated_working_days                                            AS working_days,
                 p.hours_per_day,
                 p.use_manual_progress,
                 p.use_weighted_progress,
                 -- Additional fields
                 COALESCE((SELECT ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(t)))
                          FROM (SELECT pm.id,
                                       pm.project_id,
                                       tm.id                                         AS team_member_id,
                                       tm.user_id,
                                       u.name,
                                       u.email,
                                       u.avatar_url,
                                       u.phone_number,
                                       pal.name                                      AS access_level,
                                       pal.key                                       AS access_level_key,
                                       pal.id                                        AS access_level_id,
                                       EXISTS(SELECT 1
                                              FROM project_members
                                                       INNER JOIN project_access_levels ON
                                                  project_members.project_access_level_id = project_access_levels.id
                                              WHERE project_id = p.id
                                                AND project_access_levels.key = 'PROJECT_MANAGER'
                                                AND team_member_id = tm.id)          AS is_project_manager
                                FROM project_members pm
                                         INNER JOIN team_members tm ON pm.team_member_id = tm.id
                                         INNER JOIN users u ON tm.user_id = u.id
                                         INNER JOIN project_access_levels pal ON pm.project_access_level_id = pal.id
                                WHERE pm.project_id = p.id) t), '[]'::JSON)          AS members,
                 (SELECT COUNT(DISTINCT (id))
                  FROM tasks
                  WHERE archived IS FALSE
                    AND project_id = p.id)                                           AS task_count,
                 (SELECT ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(t)))
                  FROM (SELECT project_members.id,
                               project_members.project_id,
                               team_members.id                                       AS team_member_id,
                               team_members.user_id,
                               users.name,
                               users.email,
                               users.avatar_url,
                               project_access_levels.name                            AS access_level,
                               project_access_levels.key                             AS access_level_key,
                               project_access_levels.id                              AS access_level_id
                        FROM project_members
                                 INNER JOIN team_members ON project_members.team_member_id = team_members.id
                                 INNER JOIN users ON team_members.user_id = users.id
                                 INNER JOIN project_access_levels
                                            ON project_members.project_access_level_id = project_access_levels.id
                        WHERE project_id = p.id
                          AND project_access_levels.key = 'PROJECT_MANAGER'
                        LIMIT 1) t)                                                  AS project_manager,

                 (SELECT EXISTS(SELECT 1
                                FROM project_subscribers
                                WHERE project_id = p.id
                                  AND user_id = (SELECT user_id
                                                 FROM project_members
                                                 WHERE team_member_id = (SELECT id
                                                                         FROM team_members
                                                                         WHERE user_id IN
                                                                               (SELECT user_id FROM is_member_of_project_cte))
                                                   AND project_id = p.id)))          AS subscribed,
                 (SELECT name
                  FROM users
                  WHERE id =
                        (SELECT owner_id FROM projects WHERE id = p.id))             AS project_owner,
                 (SELECT default_view
                  FROM project_members
                  WHERE project_id = p.id
                    AND team_member_id IN (SELECT id FROM is_member_of_project_cte)) AS team_member_default_view,
                 (SELECT EXISTS(SELECT user_id
                                FROM archived_projects
                                WHERE user_id IN (SELECT user_id FROM is_member_of_project_cte)
                                  AND project_id = p.id))                            AS archived,

                 (SELECT EXISTS(SELECT user_id
                                FROM favorite_projects
                                WHERE user_id IN (SELECT user_id FROM is_member_of_project_cte)
                                  AND project_id = p.id))                            AS favorite

          FROM projects p
                   LEFT JOIN sys_project_statuses ts ON p.status_id = ts.id
                   LEFT JOIN sys_project_healths h ON p.health_id = h.id
                   LEFT JOIN project_categories pc ON p.category_id = pc.id
                   LEFT JOIN clients c ON p.client_id = c.id,
               LATERAL (SELECT id, user_id
                        FROM team_members
                        WHERE id = (SELECT team_member_id
                                    FROM project_members
                                    WHERE project_id = p.id
                                      AND team_member_id IN (SELECT id
                                                             FROM team_members
                                                             WHERE team_id = _team_id)
                                    LIMIT 1)) is_member_of_project_cte

          WHERE p.id = _project_id
            AND p.team_id = _team_id) rec;

    RETURN _result;
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

-- Add use_manual_progress, use_weighted_progress, and use_time_progress to projects table if they don't exist
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS use_manual_progress BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS use_weighted_progress BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS use_time_progress BOOLEAN DEFAULT FALSE;

-- Add a trigger to reset manual progress when a task gets a new subtask
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
$$ LANGUAGE plpgsql;

-- Create the trigger on the tasks table
DROP TRIGGER IF EXISTS reset_parent_manual_progress_trigger ON tasks;
CREATE TRIGGER reset_parent_manual_progress_trigger
AFTER INSERT OR UPDATE OF parent_task_id ON tasks
FOR EACH ROW
EXECUTE FUNCTION reset_parent_task_manual_progress();

COMMIT; 