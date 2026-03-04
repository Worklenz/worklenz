'use strict';
// Converted from: database/migrations/release-v2.5/20260202000001-fix-project-date-timezone-handling-v2.sql

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Migration: Fix project date timezone handling (v2)
-- Description: Updates project creation and update functions to handle dates consistently with tasks
--              by using direct TIMESTAMPTZ casting like tasks do, avoiding complex CASE statements
--              that can cause timezone interpretation issues

-- Update create_project function to handle dates consistently
CREATE OR REPLACE FUNCTION create_project(_body json) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _user_id        UUID;
    _team_id        UUID;
    _client_id      UUID;
    _project_id     UUID;
    _client_name    TEXT;
    _project_name   TEXT;
    _team_member_id UUID;
BEGIN
    -- need a test, can be throw errors
    _client_name = TRIM((_body ->> 'client_name')::TEXT);
    _project_name = TRIM((_body ->> 'name')::TEXT);

    -- add inside the controller
    _user_id = (_body ->> 'user_id')::UUID;
    _team_id = (_body ->> 'team_id')::UUID;

    -- cache exists client if exists
    SELECT id FROM clients WHERE LOWER(name) = LOWER(_client_name) AND team_id = _team_id INTO _client_id;
    SELECT id FROM team_members WHERE team_id = _team_id AND user_id = _user_id INTO _team_member_id;

    -- check whether the project name is already in
    IF EXISTS(SELECT name
              FROM projects
              WHERE LOWER(name) = LOWER(_project_name)
                AND team_id = _team_id)
    THEN
        RAISE 'PROJECT_EXISTS_ERROR:%', _project_name;
    END IF;

    -- insert client if not exists
    IF is_null_or_empty(_client_id) IS TRUE AND is_null_or_empty(_client_name) IS FALSE
    THEN
        INSERT INTO clients (name, team_id) VALUES (_client_name, _team_id) RETURNING id INTO _client_id;
    END IF;

    -- insert project with simple date handling like tasks
    INSERT INTO projects (name, key, notes, color_code, team_id, client_id, owner_id, status_id, health_id, start_date,
                          end_date,
                          folder_id, category_id, estimated_working_days, estimated_man_days, hours_per_day,
                          use_manual_progress, use_weighted_progress, use_time_progress)
    VALUES (_project_name, (_body ->> 'key')::TEXT, (_body ->> 'notes')::TEXT, (_body ->> 'color_code')::TEXT, _team_id,
            _client_id,
            _user_id, (_body ->> 'status_id')::UUID, (_body ->> 'health_id')::UUID,
            (_body ->> 'start_date')::TIMESTAMPTZ,
            (_body ->> 'end_date')::TIMESTAMPTZ,
            (_body ->> 'folder_id')::UUID, (_body ->> 'category_id')::UUID,
            (_body ->> 'working_days')::INTEGER, (_body ->> 'man_days')::INTEGER, (_body ->> 'hours_per_day')::INTEGER,
            (_body ->> 'use_manual_progress')::BOOLEAN, (_body ->> 'use_weighted_progress')::BOOLEAN, (_body ->> 'use_time_progress')::BOOLEAN)
    RETURNING id INTO _project_id;

    -- log record
    INSERT INTO project_logs (team_id, project_id, description)
    VALUES (_team_id, _project_id,
            REPLACE((_body ->> 'project_created_log')::TEXT, '@user',
                    (SELECT name FROM users WHERE id = _user_id)));

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

    -- insert default columns for task list
    PERFORM insert_task_list_columns(_project_id);

    RETURN JSON_BUILD_OBJECT(
            'id', _project_id,
            'name', (_body ->> 'name')::TEXT
           );
END;
$$;

-- Update update_project function to handle dates consistently
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

    -- update the project with simple date handling like tasks
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
        hours_per_day          = (_body ->> 'hours_per_day')::INTEGER
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

-- Note: Socket-based project date updates now use direct assignment like tasks:
-- UPDATE projects SET start_date = $2 WHERE id = $1
-- This matches the task behavior exactly and avoids timezone interpretation issues
DROP VIEW IF EXISTS project_view CASCADE;
DROP VIEW IF EXISTS client_portal_projects_view CASCADE;

alter table projects
    alter column start_date type date using start_date::date;

alter table projects
    alter column end_date type date using end_date::date;


create view project_view
            (id, name, team_id, start_date, end_date, last_updated_at, project_status, project_health, project_info) as
SELECT id,
       name,
       team_id,
       start_date::TEXT                                        AS start_date,
       end_date::TEXT                                          AS end_date,
       updated_at::TEXT                                        AS last_updated_at,
       (SELECT ps.name
        FROM sys_project_statuses ps
        WHERE ps.id = p.status_id)                                                    AS project_status,
       (SELECT ph.name
        FROM sys_project_healths ph
        WHERE ph.id = p.health_id)                                                    AS project_health,
       json_build_object('completed_task', (SELECT json_agg(tasks.name) AS json_agg
                                            FROM tasks
                                            WHERE tasks.project_id = p.id
                                              AND is_completed(tasks.status_id, tasks.project_id) IS TRUE),
                         'incompleted_task', (SELECT json_agg(tasks.name) AS json_agg
                                              FROM tasks
                                              WHERE tasks.project_id = p.id
                                                AND is_completed(tasks.status_id, tasks.project_id) IS FALSE),
                         'overdue_task', (SELECT json_agg(tasks.name) AS json_agg
                                          FROM tasks
                                          WHERE tasks.project_id = p.id
                                            AND is_overdue(tasks.id)), 'total_allocated_hours_tasks',
                         (SELECT round(sum(tasks.total_minutes) / 3600.0, 1) AS round
                          FROM tasks
                          WHERE tasks.project_id = p.id), 'total_logged_hours_tasks',
                         (SELECT round(sum(logged.time_spent) / 3600.0, 1) AS round
                          FROM tasks
                                   LEFT JOIN (SELECT task_work_log.task_id,
                                                     sum(task_work_log.time_spent) AS time_spent
                                              FROM task_work_log
                                              GROUP BY task_work_log.task_id) logged ON tasks.id = logged.task_id
                          WHERE tasks.project_id = p.id), 'project_members_data',
                         (SELECT json_agg(json_build_object('name', team_member_data.name, 'tasks_count',
                                                            team_member_data.tasks_count, 'completed',
                                                            team_member_data.completed, 'incompleted',
                                                            team_member_data.incompleted, 'overdue',
                                                            team_member_data.overdue, 'time_logged_hours',
                                                            round(team_member_data.time_logged / 3600.0, 1))) AS json_agg
                          FROM (SELECT pm.id,
                                       pm.team_member_id,
                                       (SELECT team_member_info_view.name
                                        FROM team_member_info_view
                                        WHERE team_member_info_view.team_member_id = pm.team_member_id)  AS name,
                                       count(ta.task_id)                                                 AS tasks_count,
                                       count(
                                               CASE
                                                   WHEN is_completed(t.status_id, t.project_id) IS TRUE THEN 1
                                                   ELSE NULL::integer
                                                   END)                                                  AS completed,
                                       count(
                                               CASE
                                                   WHEN is_completed(t.status_id, t.project_id) IS FALSE THEN 1
                                                   ELSE NULL::integer
                                                   END)                                                  AS incompleted,
                                       count(
                                               CASE
                                                   WHEN is_overdue(t.id) THEN 1
                                                   ELSE NULL::integer
                                                   END)                                                  AS overdue,
                                       (SELECT sum(twl.time_spent) AS sum
                                        FROM task_work_log twl
                                        WHERE twl.user_id = ((SELECT team_member_info_view.user_id
                                                              FROM team_member_info_view
                                                              WHERE team_member_info_view.team_member_id = pm.team_member_id))
                                          AND (twl.task_id IN (SELECT tasks.id
                                                               FROM tasks
                                                               WHERE tasks.project_id = pm.project_id))) AS time_logged
                                FROM project_members pm
                                         LEFT JOIN tasks_assignees ta
                                                   ON pm.id = ta.project_member_id AND ta.team_member_id = pm.team_member_id
                                         LEFT JOIN tasks t ON ta.task_id = t.id
                                WHERE pm.project_id = p.id
                                GROUP BY pm.id, pm.team_member_id) team_member_data)) AS project_info
FROM projects p;


-- View for client portal accessible projects
CREATE OR REPLACE VIEW client_portal_projects_view AS
SELECT 
    p.id as project_id,
    p.name as project_name,
    p.key as project_key,
    p.color_code,
    p.notes,
    p.start_date,
    p.end_date,
    p.status_id,
    p.health_id,
    COALESCE(p.client_portal_visible, FALSE) as client_portal_visible,
    COALESCE(p.client_portal_access_level, 'view') as client_portal_access_level,
    p.created_at,
    p.updated_at,
    c.id as client_id,
    c.name as client_name,
    cr.id as client_relationship_id,
    cr.user_id,
    cr.access_level as relationship_access_level,
    COALESCE(pca.access_level, COALESCE(p.client_portal_access_level, 'view')) as effective_access_level,
    sps.name as status_name,
    sph.name as health_name,
    (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND archived = FALSE) as total_tasks,
    (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND archived = FALSE AND done = TRUE) as completed_tasks,
    (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) as member_count
FROM projects p
LEFT JOIN clients c ON p.client_id = c.id
LEFT JOIN client_relationships cr ON c.id = cr.client_id
LEFT JOIN project_client_access pca ON p.id = pca.project_id AND cr.id = pca.client_relationship_id
LEFT JOIN sys_project_statuses sps ON p.status_id = sps.id
LEFT JOIN sys_project_healths sph ON p.health_id = sph.id
WHERE COALESCE(p.client_portal_visible, FALSE) = TRUE;

GRANT SELECT ON client_portal_projects_view TO worklenz_client;
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // This migration is a DDL/function change — no automatic rollback defined.
  // Review manually before running migrate:down.
};
