-- PPM Migration 014: Seed PPM Portal System user
--
-- Portal-created tasks need a reporter_id (NOT NULL on tasks table).
-- Portal users have no Worklenz accounts, so we seed a system user
-- as the reporter for all portal-created tasks.
-- Actual creator is tracked in ppm_audit_log (actor_type='client_user').

BEGIN;

DO $$
DECLARE
    v_timezone_id UUID;
    v_team_id     UUID;
    v_user_id     UUID;
BEGIN
    -- Find a timezone (prefer UTC, fall back to first available)
    SELECT id INTO v_timezone_id
    FROM timezones
    WHERE abbrev = 'UTC' OR name ILIKE '%UTC%'
    LIMIT 1;

    IF v_timezone_id IS NULL THEN
        SELECT id INTO v_timezone_id FROM timezones LIMIT 1;
    END IF;

    IF v_timezone_id IS NULL THEN
        RAISE EXCEPTION 'No timezones found — run Worklenz seed data first';
    END IF;

    -- Find the first team (self-hosted, typically one team)
    SELECT id INTO v_team_id FROM teams LIMIT 1;

    IF v_team_id IS NULL THEN
        RAISE EXCEPTION 'No teams found — run Worklenz seed data first';
    END IF;

    -- Idempotent: skip if system user already exists
    SELECT id INTO v_user_id FROM users WHERE email = 'system@ppm-portal.internal';

    IF v_user_id IS NOT NULL THEN
        RAISE NOTICE 'PPM Portal System user already exists: %', v_user_id;
        RETURN;
    END IF;

    -- Insert the system user
    INSERT INTO users (name, email, password, active_team, timezone_id, setup_completed)
    VALUES (
        'PPM Portal',
        'system@ppm-portal.internal',
        NULL,  -- no password, cannot login
        v_team_id,
        v_timezone_id,
        true
    )
    RETURNING id INTO v_user_id;

    RAISE NOTICE 'Created PPM Portal System user: %', v_user_id;
END;
$$;

COMMIT;
