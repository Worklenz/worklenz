'use strict';
// Converted from: database/migrations/fix-create-task-assignee-duplicate.sql

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Migration to fix duplicate key violation in create_task_assignee function
-- Adds ON CONFLICT DO NOTHING to prevent unique constraint violations

CREATE OR REPLACE FUNCTION create_task_assignee(_team_member_id uuid, _project_id uuid, _task_id uuid, _reporter_user_id uuid) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _project_member    JSON;
    _project_member_id UUID;
    _team_id           UUID;
    _user_id           UUID;
BEGIN
    SELECT id
    FROM project_members
    WHERE team_member_id = _team_member_id
      AND project_id = _project_id
    INTO _project_member_id;

    SELECT team_id FROM team_members WHERE id = _team_member_id INTO _team_id;
    SELECT user_id FROM team_members WHERE id = _team_member_id INTO _user_id;

    IF is_null_or_empty(_project_member_id)
    THEN
        SELECT create_project_member(JSON_BUILD_OBJECT(
            'team_member_id', _team_member_id,
            'team_id', _team_id,
            'project_id', _project_id,
            'user_id', _reporter_user_id,
            'access_level', 'MEMBER'::TEXT
            ))
        INTO _project_member;
        _project_member_id = (_project_member ->> 'id')::UUID;
    END IF;

    -- Add ON CONFLICT to handle duplicate assignments gracefully
    INSERT INTO tasks_assignees (task_id, project_member_id, team_member_id, assigned_by)
    VALUES (_task_id, _project_member_id, _team_member_id, _reporter_user_id)
    ON CONFLICT ON CONSTRAINT tasks_assignees_pk DO NOTHING;

    RETURN JSON_BUILD_OBJECT(
        'task_id', _task_id,
        'project_member_id', _project_member_id,
        'team_member_id', _team_member_id,
        'team_id', _team_id,
        'user_id', _user_id
        );
END
$$;

  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // This migration is a DDL/function change — no automatic rollback defined.
  // Review manually before running migrate:down.
};
