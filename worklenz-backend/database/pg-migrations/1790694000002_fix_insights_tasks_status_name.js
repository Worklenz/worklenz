/**
 * Migration: Fix status and status_name in insights overview functions
 * Date: 2026-10-08
 * Description: Updates get_last_updated_tasks_by_project and get_project_deadline_tasks
 *              to return both status and status_name with proper category and custom status colors.
 */

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
CREATE OR REPLACE FUNCTION get_last_updated_tasks_by_project(_project_id uuid, _limit integer, _offset integer, _archived boolean) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _tasks JSON;
BEGIN
    SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
    INTO _tasks
    FROM (SELECT id,
                 name,
                 (SELECT name FROM task_statuses WHERE id = tasks.status_id) AS status,
                 (SELECT name FROM task_statuses WHERE id = tasks.status_id) AS status_name,
                 status_id,
                 end_date,
                 priority_id AS priority,
                 updated_at,
                 (SELECT COALESCE(task_statuses.color_code, sys_task_status_categories.color_code)
                  FROM task_statuses
                  INNER JOIN sys_task_status_categories ON sys_task_status_categories.id = task_statuses.category_id
                  WHERE task_statuses.id = tasks.status_id) AS status_color
          FROM tasks
          WHERE project_id = _project_id
            AND CASE
                    WHEN (_archived IS TRUE) THEN project_id IS NOT NULL
                    ELSE archived IS FALSE END
          ORDER BY updated_at DESC
          LIMIT _limit OFFSET _offset) rec;
    RETURN _tasks;
END
$$;

CREATE OR REPLACE FUNCTION get_project_deadline_tasks(_project_id uuid, _archived boolean) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _result JSON;

BEGIN
    SELECT COALESCE(ROW_TO_JSON(rec), '[]'::JSON)
    INTO _result
    FROM (SELECT (SELECT COUNT(*)
                  FROM tasks
                  WHERE project_id = _project_id
                    AND CASE
                            WHEN (_archived IS TRUE) THEN project_id IS NOT NULL
                            ELSE archived IS FALSE END
                    AND end_date::DATE > (SELECT end_date
                                          FROM projects
                                          WHERE id = _project_id)::DATE) AS deadline_tasks_count,
                 (SELECT SUM(twl.time_spent)
                  FROM tasks t
                           CROSS JOIN task_work_log twl
                  WHERE twl.task_id = t.id
                    AND t.project_id = _project_id
                    AND twl.created_at::DATE > (SELECT end_date
                                                FROM projects
                                                WHERE id = _project_id)::DATE
                    AND CASE
                            WHEN (_archived IS TRUE) THEN t.project_id IS NOT NULL
                            ELSE t.archived IS FALSE END) AS deadline_logged_hours,
                 (SELECT end_date FROM projects WHERE id = _project_id) AS project_end_date,
                 (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(r))), '[]'::JSON) AS tasks
                  FROM (SELECT id,
                               name,
                               status_id,
                               start_date,
                               end_date,
                               (SELECT name FROM task_statuses WHERE id = tasks.status_id) AS status,
                               (SELECT name FROM task_statuses WHERE id = tasks.status_id) AS status_name,
                               (SELECT COALESCE(task_statuses.color_code, sys_task_status_categories.color_code)
                                FROM task_statuses
                                INNER JOIN sys_task_status_categories ON sys_task_status_categories.id = task_statuses.category_id
                                WHERE task_statuses.id = tasks.status_id) AS status_color

                        FROM tasks
                        WHERE project_id = _project_id
                          AND CASE
                                  WHEN (_archived IS TRUE) THEN project_id IS NOT NULL
                                  ELSE archived IS FALSE END
                          AND end_date::DATE > (SELECT end_date
                                                FROM projects
                                                WHERE id = _project_id)::DATE) r)) rec;
    RETURN _result;

END;
$$;
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
CREATE OR REPLACE FUNCTION get_last_updated_tasks_by_project(_project_id uuid, _limit integer, _offset integer, _archived boolean) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _tasks JSON;
BEGIN
    SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
    INTO _tasks
    FROM (SELECT id,
                 name,
                 (SELECT name FROM task_statuses WHERE status_id = task_statuses.id) AS status,
                 status_id,
                 end_date,
                 priority_id AS priority,
                 updated_at,
                 (SELECT color_code
                  FROM sys_task_status_categories
                  WHERE id = (SELECT category_id FROM task_statuses WHERE id = status_id)) AS status_color
          FROM tasks
          WHERE project_id = _project_id
            AND CASE
                    WHEN (_archived IS TRUE) THEN project_id IS NOT NULL
                    ELSE archived IS FALSE END
          ORDER BY updated_at DESC
          LIMIT _limit OFFSET _offset) rec;
    RETURN _tasks;
END
$$;

CREATE OR REPLACE FUNCTION get_project_deadline_tasks(_project_id uuid, _archived boolean) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _result JSON;

BEGIN
    SELECT COALESCE(ROW_TO_JSON(rec), '[]'::JSON)
    INTO _result
    FROM (SELECT (SELECT COUNT(*)
                  FROM tasks
                  WHERE project_id = _project_id
                    AND CASE
                            WHEN (_archived IS TRUE) THEN project_id IS NOT NULL
                            ELSE archived IS FALSE END
                    AND end_date::DATE > (SELECT end_date
                                          FROM projects
                                          WHERE id = _project_id)::DATE) AS deadline_tasks_count,
                 (SELECT SUM(twl.time_spent)
                  FROM tasks t
                           CROSS JOIN task_work_log twl
                  WHERE twl.task_id = t.id
                    AND t.project_id = _project_id
                    AND twl.created_at::DATE > (SELECT end_date
                                                FROM projects
                                                WHERE id = _project_id)::DATE
                    AND CASE
                            WHEN (_archived IS TRUE) THEN t.project_id IS NOT NULL
                            ELSE t.archived IS FALSE END) AS deadline_logged_hours,
                 (SELECT end_date FROM projects WHERE id = _project_id) AS project_end_date,
                 (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(r))), '[]'::JSON) AS tasks
                  FROM (SELECT id,
                               name,
                               status_id,
                               start_date,
                               end_date,
                               (SELECT name FROM task_statuses WHERE id = tasks.status_id) AS status,
                               (SELECT color_code
                                FROM sys_task_status_categories
                                WHERE id = (SELECT category_id FROM task_statuses WHERE id = status_id)) AS status_color

                        FROM tasks
                        WHERE project_id = _project_id
                          AND CASE
                                  WHEN (_archived IS TRUE) THEN project_id IS NOT NULL
                                  ELSE archived IS FALSE END
                          AND end_date::DATE > (SELECT end_date
                                                FROM projects
                                                WHERE id = _project_id)::DATE) r)) rec;
    RETURN _result;

END;
$$;
  `);
};
