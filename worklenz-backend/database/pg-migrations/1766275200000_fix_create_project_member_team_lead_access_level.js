'use strict';
// Converted from: database/migrations/20251216000000-fix-create-project-member-team-lead-access-level.sql

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Migration: Fix create_project_member function to handle TEAM-LEAD access level
-- Date: 2025-12-16
-- Description: Maps TEAM-LEAD access level to PROJECT_MANAGER since Team Lead is a team-wide role, not a project access level.
--              Also adds fallback to MEMBER for NULL or invalid access levels to prevent constraint violations.

CREATE OR REPLACE FUNCTION create_project_member(_body json) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _id             UUID;
    _team_member_id UUID;
    _team_id        UUID;
    _project_id     UUID;
    _user_id        UUID;
    _member_user_id UUID;
    _notification   TEXT;
    _access_level   TEXT;
BEGIN
    _team_member_id = (_body ->> 'team_member_id')::UUID;
    _team_id = (_body ->> 'team_id')::UUID;
    _project_id = (_body ->> 'project_id')::UUID;
    _user_id = (_body ->> 'user_id')::UUID;
    _access_level = COALESCE(NULLIF(TRIM((_body ->> 'access_level')::TEXT), ''), 'MEMBER');

    -- Map team-lead access level to PROJECT_MANAGER since Team Lead is a role, not a project access level
    IF UPPER(_access_level) IN ('TEAM-LEAD', 'TEAM_LEAD') THEN
        _access_level = 'PROJECT_MANAGER';
    END IF;

    SELECT user_id FROM team_members WHERE id = _team_member_id INTO _member_user_id;

    INSERT INTO project_members (team_member_id, project_access_level_id, project_id, role_id)
    VALUES (_team_member_id, COALESCE(
            (SELECT id FROM project_access_levels WHERE key = _access_level),
            (SELECT id FROM project_access_levels WHERE key = 'MEMBER')
        )::UUID,
            _project_id,
            (SELECT id FROM roles WHERE team_id = _team_id AND default_role IS TRUE))
    RETURNING id INTO _id;

    IF (_member_user_id != _user_id)
    THEN
        _notification = CONCAT('You have been added to the <b>',
                               (SELECT name FROM projects WHERE id = _project_id),
                               '</b> by <b>',
                               (SELECT name FROM users WHERE id = _user_id), '</b>');
        PERFORM create_notification(
                (SELECT user_id FROM team_members WHERE id = _team_member_id),
                _team_id,
                NULL,
                _project_id,
                _notification
            );
    END IF;

    RETURN JSON_BUILD_OBJECT(
            'id', _id,
            'notification', _notification,
            'socket_id', (SELECT socket_id FROM users WHERE id = _member_user_id),
            'project', (SELECT name FROM projects WHERE id = _project_id),
            'project_id', _project_id,
            'project_color', (SELECT color_code FROM projects WHERE id = _project_id),
            'team', (SELECT name FROM teams WHERE id = _team_id),
            'member_user_id', _member_user_id
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
