-- Migration: Auto-start Business plan trial on signup
-- Description: Automatically activates 14-day Business plan trial for new user signups
-- Date: 2025-01-09

-- Update the trial duration for Business plan to 14 days
UPDATE licensing_plan_tiers
SET trial_duration_days = 14,
    trial_enabled = TRUE,
    updated_at = NOW()
WHERE tier_name = 'BUSINESS_LARGE';

-- Modify register_user function to automatically start business plan trial
CREATE OR REPLACE FUNCTION register_user(_body json) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _user_id           UUID;
    _organization_id   UUID;
    _team_id           UUID;
    _role_id           UUID;
    _trimmed_email     TEXT;
    _trimmed_name      TEXT;
    _trimmed_team_name TEXT;
    _business_plan_id  UUID;
    _trial_id          UUID;
BEGIN

    _trimmed_email = LOWER(TRIM((_body ->> 'email')));
    _trimmed_name = TRIM((_body ->> 'name'));
    _trimmed_team_name = TRIM((_body ->> 'team_name'));

    -- check user exists (case-insensitive)
    IF EXISTS(SELECT email FROM users WHERE LOWER(email) = _trimmed_email)
    THEN
        RAISE 'EMAIL_EXISTS_ERROR:%', (_body ->> 'email');
    END IF;

    -- insert user
    INSERT INTO users (name, email, password, timezone_id)
    VALUES (_trimmed_name, _trimmed_email, (_body ->> 'password'),
            COALESCE((SELECT id FROM timezones WHERE name = (_body ->> 'timezone')),
                     (SELECT id FROM timezones WHERE name = 'UTC')))
    RETURNING id INTO _user_id;

    --insert organization data
    INSERT INTO organizations (user_id, organization_name, contact_number, contact_number_secondary, trial_in_progress,
                               trial_expire_date, subscription_status, license_type_id)
    VALUES (_user_id, TRIM((_body ->> 'team_name')::TEXT), NULL, NULL, TRUE, CURRENT_DATE + INTERVAL '9999 days',
            'active', (SELECT id FROM sys_license_types WHERE key = 'SELF_HOSTED'))
    RETURNING id INTO _organization_id;


    -- insert team
    INSERT INTO teams (name, user_id, organization_id)
    VALUES (_trimmed_team_name, _user_id, _organization_id)
    RETURNING id INTO _team_id;

    IF (is_null_or_empty((_body ->> 'invited_team_id')))
    THEN
        UPDATE users SET active_team = _team_id WHERE id = _user_id;
    ELSE
        IF NOT EXISTS(SELECT id
                      FROM email_invitations
                      WHERE team_id = (_body ->> 'invited_team_id')::UUID
                        AND LOWER(email) = _trimmed_email)
        THEN
            RAISE 'ERROR_INVALID_JOINING_EMAIL';
        END IF;
        UPDATE users SET active_team = (_body ->> 'invited_team_id')::UUID WHERE id = _user_id;
    END IF;

    -- insert default roles
    INSERT INTO roles (name, team_id, default_role) VALUES ('Member', _team_id, TRUE);
    INSERT INTO roles (name, team_id, admin_role) VALUES ('Admin', _team_id, TRUE);
    INSERT INTO roles (name, team_id, admin_role) VALUES ('Team Lead', _team_id, TRUE);
    INSERT INTO roles (name, team_id, owner) VALUES ('Owner', _team_id, TRUE) RETURNING id INTO _role_id;

    -- insert team member
    INSERT INTO team_members (user_id, team_id, role_id)
    VALUES (_user_id, _team_id, _role_id);

    -- update team member table with user id
    IF (_body ->> 'team_member_id') IS NOT NULL
    THEN
        UPDATE team_members SET user_id = (_user_id)::UUID WHERE id = (_body ->> 'team_member_id')::UUID;
        DELETE
        FROM email_invitations
        WHERE LOWER(email) = _trimmed_email
          AND team_member_id = (_body ->> 'team_member_id')::UUID;
    END IF;

    -- AUTO-START BUSINESS PLAN TRIAL FOR NEW SIGNUPS
    -- Get the Business plan tier ID
    SELECT id INTO _business_plan_id
    FROM licensing_plan_tiers
    WHERE tier_name = 'BUSINESS_LARGE'
      AND trial_enabled = TRUE;

    -- Start the business plan trial automatically if plan exists and trial is enabled
    IF _business_plan_id IS NOT NULL THEN
        BEGIN
            -- Call the start_plan_trial function to activate the trial
            SELECT start_plan_trial(_user_id, _organization_id, _business_plan_id) INTO _trial_id;
            
            -- Log successful trial activation (optional, for debugging)
            RAISE NOTICE 'Business plan trial automatically started for user % with trial_id %', _user_id, _trial_id;
        EXCEPTION
            WHEN OTHERS THEN
                -- Log error but don't fail the registration
                RAISE WARNING 'Failed to auto-start business trial for user %: %', _user_id, SQLERRM;
        END;
    END IF;

    RETURN JSON_BUILD_OBJECT(
            'id', _user_id,
            'name', _trimmed_name,
            'email', _trimmed_email,
            'team_id', _team_id,
            'trial_id', _trial_id
           );
END;
$$;

-- Add comment to document the change
COMMENT ON FUNCTION register_user IS 'Registers a new user and automatically starts a 14-day Business plan trial';
