'use strict';
// Converted from: database/migrations/release-v2.3.0/003-fix-google-oauth-invite-setup-completed.sql

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Fix Google OAuth signup with invite link to skip account setup
-- When users sign up via Google OAuth using an invite link, they should skip account setup
-- This matches the behavior of email/password signup with invite links

CREATE OR REPLACE FUNCTION register_google_user(_body json) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _user_id         UUID;
    _organization_id UUID;
    _team_id         UUID;
    _role_id         UUID;

    _name            TEXT;
    _email           TEXT;
    _google_id       TEXT;
BEGIN
    _name = (_body ->> 'displayName')::TEXT;
    _email = (_body ->> 'email')::TEXT;
    _google_id = (_body ->> 'id');

    INSERT INTO users (name, email, google_id, timezone_id)
    VALUES (_name, _email, _google_id, COALESCE((SELECT id FROM timezones WHERE name = (_body ->> 'timezone')),
                                                (SELECT id FROM timezones WHERE name = 'UTC')))
    RETURNING id INTO _user_id;

    --insert organization data
    INSERT INTO organizations (user_id, organization_name, contact_number, contact_number_secondary, trial_in_progress,
                               trial_expire_date, subscription_status, license_type_id)
    VALUES (_user_id, COALESCE(TRIM((_body ->> 'team_name')::TEXT), _name), NULL, NULL, TRUE, CURRENT_DATE + INTERVAL '9999 days',
            'active', (SELECT id FROM sys_license_types WHERE key = 'SELF_HOSTED'))
    RETURNING id INTO _organization_id;

    INSERT INTO teams (name, user_id, organization_id)
    VALUES (_name, _user_id, _organization_id)
    RETURNING id INTO _team_id;

    -- insert default roles
    INSERT INTO roles (name, team_id, default_role) VALUES ('Member', _team_id, TRUE);
    INSERT INTO roles (name, team_id, admin_role) VALUES ('Admin', _team_id, TRUE);
    INSERT INTO roles (name, team_id, admin_role) VALUES ('Team Lead', _team_id, TRUE);
    INSERT INTO roles (name, team_id, owner) VALUES ('Owner', _team_id, TRUE) RETURNING id INTO _role_id;

    INSERT INTO team_members (user_id, team_id, role_id)
    VALUES (_user_id, _team_id, _role_id);

    IF (is_null_or_empty(_body ->> 'team') OR is_null_or_empty(_body ->> 'member_id'))
    THEN
        UPDATE users SET active_team = _team_id WHERE id = _user_id;
    ELSE
        -- Verify team member
        IF EXISTS(SELECT id
                  FROM team_members
                  WHERE id = (_body ->> 'member_id')::UUID
                    AND team_id = (_body ->> 'team')::UUID)
        THEN
            UPDATE team_members
            SET user_id = _user_id
            WHERE id = (_body ->> 'member_id')::UUID
              AND team_id = (_body ->> 'team')::UUID;

            DELETE
            FROM email_invitations
            WHERE team_id = (_body ->> 'team')::UUID
              AND team_member_id = (_body ->> 'member_id')::UUID;

            -- Set active_team to invited team and mark setup as completed (user is joining existing team)
            UPDATE users SET active_team = (_body ->> 'team')::UUID, setup_completed = TRUE WHERE id = _user_id;
        END IF;
    END IF;

    RETURN JSON_BUILD_OBJECT(
            'id', _user_id,
            'email', _email,
            'google_id', _google_id
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
