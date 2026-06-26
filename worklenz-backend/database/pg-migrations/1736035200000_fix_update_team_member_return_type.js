'use strict';
// Converted from: database/migrations/fix-update-team-member-return-type.sql

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Migration to fix update_team_member function return type
-- Changes return type from void to TEXT to return the team member ID

CREATE OR REPLACE FUNCTION update_team_member(_body json) RETURNS TEXT
    LANGUAGE plpgsql
AS
$$
DECLARE
    _team_id      UUID;
    _job_title_id UUID;
    _role_id      UUID;
    _team_member_id UUID;
BEGIN
    _team_id = (_body ->> 'team_id')::UUID;
    _team_member_id = (_body ->> 'id')::UUID;

    -- Check if role_name is provided, otherwise fall back to is_admin flag
    IF is_null_or_empty((_body ->> 'role_name')) IS FALSE
    THEN
        SELECT id FROM roles WHERE name = (_body ->> 'role_name')::TEXT AND team_id = _team_id INTO _role_id;
        
        -- If specified role not found, fall back to default role
        IF _role_id IS NULL THEN
            SELECT id FROM roles WHERE team_id = _team_id AND default_role IS TRUE INTO _role_id;
        END IF;
    ELSIF ((_body ->> 'is_admin')::BOOLEAN IS TRUE)
    THEN
        SELECT id FROM roles WHERE team_id = _team_id AND admin_role IS TRUE AND name = 'Admin' INTO _role_id;
        
        -- If Admin role not found, fall back to default role
        IF _role_id IS NULL THEN
            SELECT id FROM roles WHERE team_id = _team_id AND default_role IS TRUE INTO _role_id;
        END IF;
    ELSE
        SELECT id FROM roles WHERE team_id = _team_id AND default_role IS TRUE INTO _role_id;
    END IF;
    
    -- Ensure role_id is not null
    IF _role_id IS NULL THEN
        RAISE EXCEPTION 'No valid role found for team %', _team_id;
    END IF;

    IF is_null_or_empty((_body ->> 'job_title')) IS FALSE
    THEN
        SELECT insert_job_title((_body ->> 'job_title')::TEXT, _team_id) INTO _job_title_id;
    ELSE
        _job_title_id = NULL;
    END IF;

    UPDATE team_members
    SET job_title_id = _job_title_id,
        role_id      = _role_id,
        updated_at   = CURRENT_TIMESTAMP
    WHERE id = _team_member_id
      AND team_id = _team_id;

    -- Return the team member ID to confirm update
    RETURN _team_member_id::TEXT;
END;
$$;

  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // This migration is a DDL/function change — no automatic rollback defined.
  // Review manually before running migrate:down.
};
