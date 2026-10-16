'use strict';

/**
 * Migration: Add Software project type scaffolding
 * Date: 2026-09-25
 * Description: Adds projects.project_type and auto_archive_on_sprint_complete.
 *              Updates create_project() to seed software defaults (Sprint label,
 *              software statuses) when project_type = 'software'.
 */

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    ALTER TABLE projects
      ADD COLUMN IF NOT EXISTS project_type TEXT NOT NULL DEFAULT 'general',
      ADD COLUMN IF NOT EXISTS auto_archive_on_sprint_complete BOOLEAN NOT NULL DEFAULT TRUE;

    ALTER TABLE projects
      DROP CONSTRAINT IF EXISTS projects_project_type_check;

    ALTER TABLE projects
      ADD CONSTRAINT projects_project_type_check
        CHECK (project_type IN ('general', 'software'));

    COMMENT ON COLUMN projects.project_type IS
      'Project delivery mode: general (default PM) or software (issue/sprint/backlog UX)';
    COMMENT ON COLUMN projects.auto_archive_on_sprint_complete IS
      'When true (software projects), completed/Done issues are archived when a sprint is completed';

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
        _project_type   TEXT;
        _is_software    BOOLEAN;
    BEGIN
        _client_name = TRIM((_body ->> 'client_name')::TEXT);
        _project_name = TRIM((_body ->> 'name')::TEXT);
        _user_id = (_body ->> 'user_id')::UUID;
        _team_id = (_body ->> 'team_id')::UUID;
        _project_type = LOWER(COALESCE(NULLIF(TRIM((_body ->> 'project_type')::TEXT), ''), 'general'));
        IF _project_type NOT IN ('general', 'software') THEN
            _project_type = 'general';
        END IF;
        _is_software = (_project_type = 'software');

        SELECT id FROM clients WHERE LOWER(name) = LOWER(_client_name) AND team_id = _team_id INTO _client_id;
        SELECT id FROM team_members WHERE team_id = _team_id AND user_id = _user_id INTO _team_member_id;

        IF EXISTS(SELECT name FROM projects WHERE LOWER(name) = LOWER(_project_name) AND team_id = _team_id)
        THEN
            RAISE 'PROJECT_EXISTS_ERROR:%', _project_name;
        END IF;

        IF is_null_or_empty(_client_id) IS TRUE AND is_null_or_empty(_client_name) IS FALSE
        THEN
            INSERT INTO clients (name, team_id) VALUES (_client_name, _team_id) RETURNING id INTO _client_id;
        END IF;

        INSERT INTO projects (name, key, notes, color_code, team_id, client_id, owner_id, status_id, health_id, priority_id, start_date,
                              end_date, folder_id, category_id, estimated_working_days, estimated_man_days, hours_per_day,
                              use_manual_progress, use_weighted_progress, use_time_progress, auto_assign_task_creator,
                              restrict_task_creation, phase_assignees_enabled, auto_assign_subtask_phase, restrict_tasks_to_assignee,
                              project_type, phase_label, auto_archive_on_sprint_complete)
        VALUES (_project_name, (_body ->> 'key')::TEXT, (_body ->> 'notes')::TEXT, (_body ->> 'color_code')::TEXT, _team_id,
                _client_id, _user_id, (_body ->> 'status_id')::UUID, (_body ->> 'health_id')::UUID,
                COALESCE((_body ->> 'priority_id')::UUID, (SELECT id FROM sys_project_priorities WHERE name = 'Medium' LIMIT 1)),
                (_body ->> 'start_date')::TIMESTAMPTZ, (_body ->> 'end_date')::TIMESTAMPTZ,
                (_body ->> 'folder_id')::UUID, (_body ->> 'category_id')::UUID,
                (_body ->> 'working_days')::INTEGER, (_body ->> 'man_days')::INTEGER, (_body ->> 'hours_per_day')::INTEGER,
                COALESCE((_body ->> 'use_manual_progress')::BOOLEAN, FALSE),
                COALESCE((_body ->> 'use_weighted_progress')::BOOLEAN, FALSE),
                COALESCE((_body ->> 'use_time_progress')::BOOLEAN, FALSE),
                COALESCE((_body ->> 'auto_assign_task_creator')::BOOLEAN, FALSE),
                COALESCE((_body ->> 'restrict_task_creation')::BOOLEAN, FALSE),
                COALESCE((_body ->> 'phase_assignees_enabled')::BOOLEAN, FALSE),
                COALESCE((_body ->> 'auto_assign_subtask_phase')::BOOLEAN, FALSE),
                COALESCE((_body ->> 'restrict_tasks_to_assignee')::BOOLEAN, FALSE),
                _project_type,
                CASE WHEN _is_software THEN 'Sprint' ELSE COALESCE((_body ->> 'phase_label')::TEXT, 'Phase') END,
                CASE
                    WHEN _is_software THEN COALESCE((_body ->> 'auto_archive_on_sprint_complete')::BOOLEAN, TRUE)
                    ELSE COALESCE((_body ->> 'auto_archive_on_sprint_complete')::BOOLEAN, TRUE)
                END)
        RETURNING id INTO _project_id;

        INSERT INTO project_logs (team_id, project_id, description)
        VALUES (_team_id, _project_id,
                REPLACE((_body ->> 'project_created_log')::TEXT, '@user',
                        (SELECT name FROM users WHERE id = _user_id)));

        INSERT INTO project_members (team_member_id, project_access_level_id, project_id, role_id, task_list_group_by, board_group_by)
        VALUES (_team_member_id, (SELECT id FROM project_access_levels WHERE key = 'ADMIN'),
                _project_id,
                (SELECT id FROM roles WHERE team_id = _team_id AND default_role IS TRUE),
                'status',
                'status');

        IF _is_software THEN
            INSERT INTO task_statuses (name, project_id, team_id, category_id, sort_order)
            VALUES ('Backlog', _project_id, _team_id, (SELECT id FROM sys_task_status_categories WHERE is_todo IS TRUE LIMIT 1), 0);
            INSERT INTO task_statuses (name, project_id, team_id, category_id, sort_order)
            VALUES ('Todo', _project_id, _team_id, (SELECT id FROM sys_task_status_categories WHERE is_todo IS TRUE LIMIT 1), 1);
            INSERT INTO task_statuses (name, project_id, team_id, category_id, sort_order)
            VALUES ('In Progress', _project_id, _team_id, (SELECT id FROM sys_task_status_categories WHERE is_doing IS TRUE LIMIT 1), 2);
            INSERT INTO task_statuses (name, project_id, team_id, category_id, sort_order)
            VALUES ('In Review', _project_id, _team_id, (SELECT id FROM sys_task_status_categories WHERE is_doing IS TRUE LIMIT 1), 3);
            INSERT INTO task_statuses (name, project_id, team_id, category_id, sort_order)
            VALUES ('Done', _project_id, _team_id, (SELECT id FROM sys_task_status_categories WHERE is_done IS TRUE LIMIT 1), 4);
            INSERT INTO task_statuses (name, project_id, team_id, category_id, sort_order)
            VALUES ('Blocked', _project_id, _team_id, (SELECT id FROM sys_task_status_categories WHERE is_doing IS TRUE LIMIT 1), 5);
        ELSE
            INSERT INTO task_statuses (name, project_id, team_id, category_id, sort_order)
            VALUES ('To Do', _project_id, _team_id, (SELECT id FROM sys_task_status_categories WHERE is_todo IS TRUE LIMIT 1), 0);
            INSERT INTO task_statuses (name, project_id, team_id, category_id, sort_order)
            VALUES ('Doing', _project_id, _team_id, (SELECT id FROM sys_task_status_categories WHERE is_doing IS TRUE LIMIT 1), 1);
            INSERT INTO task_statuses (name, project_id, team_id, category_id, sort_order)
            VALUES ('Done', _project_id, _team_id, (SELECT id FROM sys_task_status_categories WHERE is_done IS TRUE LIMIT 1), 2);
        END IF;

        PERFORM insert_task_list_columns(_project_id);

        RETURN JSON_BUILD_OBJECT(
            'id', _project_id,
            'name', (_body ->> 'name')::TEXT,
            'project_type', _project_type
        );
    END;
    $$;
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
    -- Restore prior create_project (general-only statuses) from 20260918120000
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
        _client_name = TRIM((_body ->> 'client_name')::TEXT);
        _project_name = TRIM((_body ->> 'name')::TEXT);
        _user_id = (_body ->> 'user_id')::UUID;
        _team_id = (_body ->> 'team_id')::UUID;

        SELECT id FROM clients WHERE LOWER(name) = LOWER(_client_name) AND team_id = _team_id INTO _client_id;
        SELECT id FROM team_members WHERE team_id = _team_id AND user_id = _user_id INTO _team_member_id;

        IF EXISTS(SELECT name FROM projects WHERE LOWER(name) = LOWER(_project_name) AND team_id = _team_id)
        THEN
            RAISE 'PROJECT_EXISTS_ERROR:%', _project_name;
        END IF;

        IF is_null_or_empty(_client_id) IS TRUE AND is_null_or_empty(_client_name) IS FALSE
        THEN
            INSERT INTO clients (name, team_id) VALUES (_client_name, _team_id) RETURNING id INTO _client_id;
        END IF;

        INSERT INTO projects (name, key, notes, color_code, team_id, client_id, owner_id, status_id, health_id, priority_id, start_date,
                              end_date, folder_id, category_id, estimated_working_days, estimated_man_days, hours_per_day,
                              use_manual_progress, use_weighted_progress, use_time_progress, auto_assign_task_creator,
                              restrict_task_creation, phase_assignees_enabled, auto_assign_subtask_phase, restrict_tasks_to_assignee)
        VALUES (_project_name, (_body ->> 'key')::TEXT, (_body ->> 'notes')::TEXT, (_body ->> 'color_code')::TEXT, _team_id,
                _client_id, _user_id, (_body ->> 'status_id')::UUID, (_body ->> 'health_id')::UUID,
                COALESCE((_body ->> 'priority_id')::UUID, (SELECT id FROM sys_project_priorities WHERE name = 'Medium' LIMIT 1)),
                (_body ->> 'start_date')::TIMESTAMPTZ, (_body ->> 'end_date')::TIMESTAMPTZ,
                (_body ->> 'folder_id')::UUID, (_body ->> 'category_id')::UUID,
                (_body ->> 'working_days')::INTEGER, (_body ->> 'man_days')::INTEGER, (_body ->> 'hours_per_day')::INTEGER,
                COALESCE((_body ->> 'use_manual_progress')::BOOLEAN, FALSE),
                COALESCE((_body ->> 'use_weighted_progress')::BOOLEAN, FALSE),
                COALESCE((_body ->> 'use_time_progress')::BOOLEAN, FALSE),
                COALESCE((_body ->> 'auto_assign_task_creator')::BOOLEAN, FALSE),
                COALESCE((_body ->> 'restrict_task_creation')::BOOLEAN, FALSE),
                COALESCE((_body ->> 'phase_assignees_enabled')::BOOLEAN, FALSE),
                COALESCE((_body ->> 'auto_assign_subtask_phase')::BOOLEAN, FALSE),
                COALESCE((_body ->> 'restrict_tasks_to_assignee')::BOOLEAN, FALSE))
        RETURNING id INTO _project_id;

        INSERT INTO project_logs (team_id, project_id, description)
        VALUES (_team_id, _project_id,
                REPLACE((_body ->> 'project_created_log')::TEXT, '@user',
                        (SELECT name FROM users WHERE id = _user_id)));

        INSERT INTO project_members (team_member_id, project_access_level_id, project_id, role_id)
        VALUES (_team_member_id, (SELECT id FROM project_access_levels WHERE key = 'ADMIN'),
                _project_id,
                (SELECT id FROM roles WHERE team_id = _team_id AND default_role IS TRUE));

        INSERT INTO task_statuses (name, project_id, team_id, category_id, sort_order)
        VALUES ('To Do', _project_id, _team_id, (SELECT id FROM sys_task_status_categories WHERE is_todo IS TRUE), 0);
        INSERT INTO task_statuses (name, project_id, team_id, category_id, sort_order)
        VALUES ('Doing', _project_id, _team_id, (SELECT id FROM sys_task_status_categories WHERE is_doing IS TRUE), 1);
        INSERT INTO task_statuses (name, project_id, team_id, category_id, sort_order)
        VALUES ('Done', _project_id, _team_id, (SELECT id FROM sys_task_status_categories WHERE is_done IS TRUE), 2);

        PERFORM insert_task_list_columns(_project_id);

        RETURN JSON_BUILD_OBJECT('id', _project_id, 'name', (_body ->> 'name')::TEXT);
    END;
    $$;

    ALTER TABLE projects
      DROP CONSTRAINT IF EXISTS projects_project_type_check;

    ALTER TABLE projects
      DROP COLUMN IF EXISTS auto_archive_on_sprint_complete,
      DROP COLUMN IF EXISTS project_type;
  `);
};
