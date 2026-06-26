'use strict';
// Converted from: database/migrations/20251112000002-add-register-apple-user-function.sql

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- =====================================================
-- Migration: Add register_apple_user Database Function
-- Date: 2025-11-12
-- Description: Creates database function for registering new users via Apple Sign-In
-- Author: Worklenz Development Team
-- =====================================================

-- Drop existing function if it exists (for idempotency)
DROP FUNCTION IF EXISTS register_apple_user(json);

-- Create register_apple_user function
-- This function handles the complete user registration flow for Apple Sign-In
CREATE OR REPLACE FUNCTION register_apple_user(_body json) RETURNS json
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
    _apple_id        TEXT;
BEGIN
    -- Extract data from JSON body
    _name = COALESCE((_body ->> 'displayName')::TEXT, 'Apple User');
    _email = (_body ->> 'email')::TEXT;
    _apple_id = (_body ->> 'id')::TEXT;

    -- Validate required fields
    IF _apple_id IS NULL THEN
        RAISE EXCEPTION 'Apple ID (sub) is required for user registration';
    END IF;

    -- Insert new user with Apple ID
    INSERT INTO users (name, email, apple_id, timezone_id)
    VALUES (
        _name, 
        _email, 
        _apple_id, 
        COALESCE(
            (SELECT id FROM timezones WHERE name = (_body ->> 'timezone')),
            (SELECT id FROM timezones WHERE name = 'UTC')
        )
    )
    RETURNING id INTO _user_id;

    -- Insert organization data
    INSERT INTO organizations (
        user_id, 
        organization_name, 
        contact_number, 
        contact_number_secondary, 
        trial_in_progress,
        trial_expire_date, 
        subscription_status, 
        license_type_id
    )
    VALUES (
        _user_id, 
        COALESCE(TRIM((_body ->> 'team_name')::TEXT), _name), 
        NULL, 
        NULL, 
        TRUE, 
        CURRENT_DATE + INTERVAL '9999 days',
        'active', 
        (SELECT id FROM sys_license_types WHERE key = 'SELF_HOSTED')
    )
    RETURNING id INTO _organization_id;

    -- Insert default team
    INSERT INTO teams (name, user_id, organization_id)
    VALUES (_name, _user_id, _organization_id)
    RETURNING id INTO _team_id;

    -- Insert default roles
    INSERT INTO roles (name, team_id, default_role) 
    VALUES ('Member', _team_id, TRUE);
    
    INSERT INTO roles (name, team_id, admin_role) 
    VALUES ('Admin', _team_id, TRUE);
    
    INSERT INTO roles (name, team_id, admin_role) 
    VALUES ('Team Lead', _team_id, TRUE);
    
    INSERT INTO roles (name, team_id, owner) 
    VALUES ('Owner', _team_id, TRUE) 
    RETURNING id INTO _role_id;

    -- Add user to team with owner role
    INSERT INTO team_members (user_id, team_id, role_id)
    VALUES (_user_id, _team_id, _role_id);

    -- Handle team invitations (if applicable)
    IF (is_null_or_empty(_body ->> 'team') OR is_null_or_empty(_body ->> 'member_id'))
    THEN
        -- Set active team for new user
        UPDATE users SET active_team = _team_id WHERE id = _user_id;
    ELSE
        -- Verify team member invitation exists
        IF EXISTS(
            SELECT id
            FROM team_members
            WHERE id = (_body ->> 'member_id')::UUID
              AND team_id = (_body ->> 'team')::UUID
        )
        THEN
            -- Link user to existing team member record
            UPDATE team_members
            SET user_id = _user_id
            WHERE id = (_body ->> 'member_id')::UUID
              AND team_id = (_body ->> 'team')::UUID;

            -- Remove email invitation
            DELETE FROM email_invitations
            WHERE team_id = (_body ->> 'team')::UUID
              AND team_member_id = (_body ->> 'member_id')::UUID;

            -- Set active team to invited team
            UPDATE users SET active_team = (_body ->> 'team')::UUID WHERE id = _user_id;
        END IF;
    END IF;

    -- Return user data as JSON
    RETURN JSON_BUILD_OBJECT(
        'id', _user_id,
        'email', _email,
        'apple_id', _apple_id,
        'name', _name,
        'active_team', (SELECT active_team FROM users WHERE id = _user_id)
    );
END
$$;

-- Add comment for documentation
COMMENT ON FUNCTION register_apple_user(json) IS 'Registers a new user via Apple Sign-In OAuth. Creates user, organization, team, and default roles.';

-- Verify the function was created successfully
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM pg_proc 
        WHERE proname = 'register_apple_user'
    ) THEN
        RAISE NOTICE '✓ Function register_apple_user successfully created';
    ELSE
        RAISE EXCEPTION '✗ Failed to create function register_apple_user';
    END IF;
END $$;

-- =====================================================
-- Rollback Instructions (if needed):
-- =====================================================
-- To rollback this migration, run:
-- DROP FUNCTION IF EXISTS register_apple_user(json);
-- =====================================================

  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // This migration is a DDL/function change — no automatic rollback defined.
  // Review manually before running migrate:down.
};
