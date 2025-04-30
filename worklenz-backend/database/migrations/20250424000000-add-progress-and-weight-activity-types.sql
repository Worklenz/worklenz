-- Migration: Add progress and weight activity types support
-- Date: 2025-04-24
-- Version: 1.0.0

BEGIN;

-- Update the get_activity_logs_by_task function to handle progress and weight attribute types
CREATE OR REPLACE FUNCTION get_activity_logs_by_task(_task_id uuid) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _result JSON;
BEGIN
    SELECT ROW_TO_JSON(rec)
    INTO _result
    FROM (SELECT (SELECT tasks.created_at FROM tasks WHERE tasks.id = _task_id),
                 (SELECT name
                  FROM users
                  WHERE id = (SELECT reporter_id FROM tasks WHERE id = _task_id)),
                 (SELECT avatar_url
                  FROM users
                  WHERE id = (SELECT reporter_id FROM tasks WHERE id = _task_id)),
                 (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec2))), '[]'::JSON)
                  FROM (SELECT task_id,
                               created_at,
                               attribute_type,
                               log_type,

                               -- Case for previous value
                               (CASE
                                    WHEN (attribute_type = 'status')
                                        THEN (SELECT name FROM task_statuses WHERE id = old_value::UUID)
                                    WHEN (attribute_type = 'priority')
                                        THEN (SELECT name FROM task_priorities WHERE id = old_value::UUID)
                                    WHEN (attribute_type = 'phase' AND old_value <> 'Unmapped')
                                        THEN (SELECT name FROM project_phases WHERE id = old_value::UUID)
                                    WHEN (attribute_type = 'progress' OR attribute_type = 'weight')
                                        THEN old_value
                                    ELSE (old_value) END) AS previous,

                               -- Case for current value
                               (CASE
                                    WHEN (attribute_type = 'assignee')
                                        THEN (SELECT name FROM users WHERE id = new_value::UUID)
                                    WHEN (attribute_type = 'label')
                                        THEN (SELECT name FROM team_labels WHERE id = new_value::UUID)
                                    WHEN (attribute_type = 'status')
                                        THEN (SELECT name FROM task_statuses WHERE id = new_value::UUID)
                                    WHEN (attribute_type = 'priority')
                                        THEN (SELECT name FROM task_priorities WHERE id = new_value::UUID)
                                    WHEN (attribute_type = 'phase' AND new_value <> 'Unmapped')
                                        THEN (SELECT name FROM project_phases WHERE id = new_value::UUID)
                                    WHEN (attribute_type = 'progress' OR attribute_type = 'weight')
                                        THEN new_value
                                    ELSE (new_value) END) AS current,

                               -- Case for assigned user
                               (CASE
                                    WHEN (attribute_type = 'assignee')
                                        THEN (SELECT ROW_TO_JSON(rec)
                                              FROM (SELECT (CASE
                                                                WHEN (new_value IS NOT NULL)
                                                                    THEN (SELECT name FROM users WHERE users.id = new_value::UUID)
                                                                ELSE (next_string) END) AS name,
                                                           (SELECT avatar_url FROM users WHERE users.id = new_value::UUID)) rec)
                                    ELSE (NULL) END) AS assigned_user,

                               -- Case for label data
                               (CASE
                                    WHEN (attribute_type = 'label')
                                        THEN (SELECT ROW_TO_JSON(rec)
                                              FROM (SELECT (SELECT name FROM team_labels WHERE id = new_value::UUID),
                                                           (SELECT color_code FROM team_labels WHERE id = new_value::UUID)) rec)
                                    ELSE (NULL) END) AS label_data,

                               -- Case for previous status
                               (CASE
                                    WHEN (attribute_type = 'status')
                                        THEN (SELECT ROW_TO_JSON(rec)
                                              FROM (SELECT (SELECT name FROM task_statuses WHERE id = old_value::UUID),
                                                           (SELECT color_code
                                                            FROM sys_task_status_categories
                                                            WHERE id = (SELECT category_id FROM task_statuses WHERE id = old_value::UUID)),
                                                           (SELECT color_code_dark
                                                            FROM sys_task_status_categories
                                                            WHERE id = (SELECT category_id FROM task_statuses WHERE id = old_value::UUID))) rec)
                                    ELSE (NULL) END) AS previous_status,

                               -- Case for next status
                               (CASE
                                    WHEN (attribute_type = 'status')
                                        THEN (SELECT ROW_TO_JSON(rec)
                                              FROM (SELECT (SELECT name FROM task_statuses WHERE id = new_value::UUID),
                                                           (SELECT color_code
                                                            FROM sys_task_status_categories
                                                            WHERE id = (SELECT category_id FROM task_statuses WHERE id = new_value::UUID)),
                                                           (SELECT color_code_dark
                                                            FROM sys_task_status_categories
                                                            WHERE id = (SELECT category_id FROM task_statuses WHERE id = new_value::UUID))) rec)
                                    ELSE (NULL) END) AS next_status,

                               -- Case for previous priority
                               (CASE
                                    WHEN (attribute_type = 'priority')
                                        THEN (SELECT ROW_TO_JSON(rec)
                                              FROM (SELECT (SELECT name FROM task_priorities WHERE id = old_value::UUID),
                                                           (SELECT color_code FROM task_priorities WHERE id = old_value::UUID)) rec)
                                    ELSE (NULL) END) AS previous_priority,

                               -- Case for next priority
                               (CASE
                                    WHEN (attribute_type = 'priority')
                                        THEN (SELECT ROW_TO_JSON(rec)
                                              FROM (SELECT (SELECT name FROM task_priorities WHERE id = new_value::UUID),
                                                           (SELECT color_code FROM task_priorities WHERE id = new_value::UUID)) rec)
                                    ELSE (NULL) END) AS next_priority,

                               -- Case for previous phase
                               (CASE
                                    WHEN (attribute_type = 'phase' AND old_value <> 'Unmapped')
                                        THEN (SELECT ROW_TO_JSON(rec)
                                              FROM (SELECT (SELECT name FROM project_phases WHERE id = old_value::UUID),
                                                           (SELECT color_code FROM project_phases WHERE id = old_value::UUID)) rec)
                                    ELSE (NULL) END) AS previous_phase,

                               -- Case for next phase
                               (CASE
                                    WHEN (attribute_type = 'phase' AND new_value <> 'Unmapped')
                                        THEN (SELECT ROW_TO_JSON(rec)
                                              FROM (SELECT (SELECT name FROM project_phases WHERE id = new_value::UUID),
                                                           (SELECT color_code FROM project_phases WHERE id = new_value::UUID)) rec)
                                    ELSE (NULL) END) AS next_phase,

                               -- Case for done by
                               (SELECT ROW_TO_JSON(rec)
                                FROM (SELECT (SELECT name FROM users WHERE users.id = tal.user_id),
                                             (SELECT avatar_url FROM users WHERE users.id = tal.user_id)) rec) AS done_by,
                                             
                               -- Add log text for progress and weight
                               (CASE
                                    WHEN (attribute_type = 'progress')
                                        THEN 'updated the progress of'
                                    WHEN (attribute_type = 'weight')
                                        THEN 'updated the weight of'
                                    ELSE ''
                               END) AS log_text


                        FROM task_activity_logs tal
                        WHERE task_id = _task_id
                        ORDER BY created_at DESC) rec2) AS logs) rec;
    RETURN _result;
END;
$$;

COMMIT; 