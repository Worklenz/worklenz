-- Migration: Add recursive task estimation functionality
-- This migration adds a function to calculate recursive task estimation including all subtasks
-- and modifies the get_task_form_view_model function to include this data

BEGIN;

-- Function to calculate recursive task estimation (including all subtasks)
CREATE OR REPLACE FUNCTION get_task_recursive_estimation(_task_id UUID) RETURNS JSON
    LANGUAGE plpgsql
AS
$$
DECLARE
    _result JSON;
    _has_subtasks BOOLEAN;
BEGIN
    -- First check if this task has any subtasks
    SELECT EXISTS(
        SELECT 1 FROM tasks 
        WHERE parent_task_id = _task_id 
        AND archived = false
    ) INTO _has_subtasks;

    -- If task has subtasks, calculate recursive estimation excluding parent's own estimation
    IF _has_subtasks THEN
        WITH RECURSIVE task_tree AS (
            -- Start with direct subtasks only (exclude the parent task itself)
            SELECT 
                id,
                parent_task_id,
                COALESCE(total_minutes, 0) as total_minutes,
                1 as level  -- Start at level 1 (subtasks)
            FROM tasks
            WHERE parent_task_id = _task_id
            AND archived = false

            UNION ALL

            -- Recursive case: Get all descendant tasks
            SELECT 
                t.id,
                t.parent_task_id,
                COALESCE(t.total_minutes, 0) as total_minutes,
                tt.level + 1 as level
            FROM tasks t
            INNER JOIN task_tree tt ON t.parent_task_id = tt.id
            WHERE t.archived = false
        ),
        task_counts AS (
            SELECT 
                COUNT(*) as sub_tasks_count,
                SUM(total_minutes) as subtasks_total_minutes  -- Sum all subtask estimations
            FROM task_tree
        )
        SELECT JSON_BUILD_OBJECT(
            'sub_tasks_count', COALESCE(tc.sub_tasks_count, 0),
            'own_total_minutes', 0,  -- Always 0 for parent tasks
            'subtasks_total_minutes', COALESCE(tc.subtasks_total_minutes, 0),
            'recursive_total_minutes', COALESCE(tc.subtasks_total_minutes, 0),  -- Only subtasks total
            'recursive_total_hours', FLOOR(COALESCE(tc.subtasks_total_minutes, 0) / 60),
            'recursive_remaining_minutes', COALESCE(tc.subtasks_total_minutes, 0) % 60
        )
        INTO _result
        FROM task_counts tc;
    ELSE
        -- If task has no subtasks, use its own estimation
        SELECT JSON_BUILD_OBJECT(
            'sub_tasks_count', 0,
            'own_total_minutes', COALESCE(total_minutes, 0),
            'subtasks_total_minutes', 0,
            'recursive_total_minutes', COALESCE(total_minutes, 0),  -- Use own estimation
            'recursive_total_hours', FLOOR(COALESCE(total_minutes, 0) / 60),
            'recursive_remaining_minutes', COALESCE(total_minutes, 0) % 60
        )
        INTO _result
        FROM tasks
        WHERE id = _task_id;
    END IF;

    RETURN COALESCE(_result, JSON_BUILD_OBJECT(
        'sub_tasks_count', 0,
        'own_total_minutes', 0,
        'subtasks_total_minutes', 0,
        'recursive_total_minutes', 0,
        'recursive_total_hours', 0,
        'recursive_remaining_minutes', 0
    ));
END;
$$;

-- Update the get_task_form_view_model function to include recursive estimation
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
                 (SELECT MAX(level) FROM task_hierarchy)                                         AS task_level,
                 (SELECT get_task_recursive_estimation(tasks.id))                               AS recursive_estimation
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