'use strict';

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/**
 * Self-hosted signups must be licensed as SELF_HOSTED / active.
 *
 * 1769754554000 redefined the register_* functions to create organizations as
 * 'trialing' with license key 'TRIAL' (register_user) or the misspelled 'TRAIL'
 * (google/apple, which resolves to NULL), so every new organization was subject
 * to the 10-member TRIAL_MEMBER_LIMIT. This restores SELF_HOSTED / active, stops
 * auto-starting a Business plan trial, and repairs organizations created since.
 * It also makes create_team_member skip emails that are already in the team.
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = async (pgm) => {
  // This migration replaces shared signup functions and repairs organization
  // licenses. Require an explicit mode rather than the application's default:
  // a missing cloud configuration must never apply self-hosted licensing.
  const deploymentMode = process.env.WORKLENZ_DEPLOYMENT_MODE?.trim().toLowerCase();
  if (deploymentMode !== 'cloud' && deploymentMode !== 'self_hosted') {
    throw new Error(
      'Set WORKLENZ_DEPLOYMENT_MODE explicitly to cloud or self_hosted before running the self-hosted license migration.'
    );
  }

  if (deploymentMode === 'self_hosted') {
    pgm.sql(`
-- Register user
CREATE OR REPLACE FUNCTION register_user(_body json) returns json
    language plpgsql
as
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
    VALUES (_user_id, COALESCE(TRIM((_body ->> 'team_name')::TEXT), _trimmed_name), NULL, NULL, TRUE, CURRENT_DATE + INTERVAL '9999 days',
            'active', (SELECT id FROM sys_license_types WHERE key = 'SELF_HOSTED'))
    RETURNING id INTO _organization_id;

    -- Insert default organization working days if not exists
    IF NOT EXISTS(SELECT 1 FROM organization_working_days WHERE organization_id = _organization_id) THEN
        INSERT INTO organization_working_days (organization_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday)
        VALUES (_organization_id, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE);
    END IF;

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

    -- Self-hosted deployments are licensed at the deployment level; no plan trial is started.

    RETURN JSON_BUILD_OBJECT(
            'id', _user_id,
            'name', _trimmed_name,
            'email', _trimmed_email,
            'team_id', _team_id,
            'trial_id', _trial_id
           );
END;
$$;

comment on function register_user(json) is 'Registers a new user under the SELF_HOSTED license';

-- Google Register user
CREATE OR REPLACE FUNCTION register_google_user(_body json) returns json
    language plpgsql
as
$$
DECLARE
    _user_id UUID;
    _organization_id UUID;
    _team_id UUID;
    _role_id UUID;
    _name TEXT;
    _email TEXT;
    _google_id TEXT;
    _business_plan_id UUID;
    _trial_id UUID;
BEGIN
    _name = (_body ->> 'displayName')::TEXT;
    _email = LOWER(TRIM((_body ->> 'email')::TEXT));
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

    -- Insert default organization working days if not exists
    IF NOT EXISTS(SELECT 1 FROM organization_working_days WHERE organization_id = _organization_id) THEN
        INSERT INTO organization_working_days (organization_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday)
        VALUES (_organization_id, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE);
    END IF;

    INSERT INTO teams (name, user_id, organization_id)
    VALUES (COALESCE(TRIM((_body ->> 'team_name')::TEXT), _name), _user_id, _organization_id)
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

            UPDATE users SET active_team = (_body ->> 'team')::UUID WHERE id = _user_id;
        END IF;
    END IF;

    -- Self-hosted deployments are licensed at the deployment level; no plan trial is started.

    RETURN JSON_BUILD_OBJECT(
            'id', _user_id,
            'email', _email,
            'google_id', _google_id,
            'trial_id', _trial_id
           );
END
$$;

comment on function register_google_user(json) is 'Registers a new Google OAuth user under the SELF_HOSTED license';

-- Apple Register user
CREATE OR REPLACE FUNCTION register_apple_user(_body json) returns json
    language plpgsql
as
$$
DECLARE
    _user_id UUID;
    _organization_id UUID;
    _team_id UUID;
    _role_id UUID;
    _name TEXT;
    _email TEXT;
    _apple_id TEXT;
    _business_plan_id UUID;
    _trial_id UUID;
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

    -- Insert default organization working days if not exists
    IF NOT EXISTS(SELECT 1 FROM organization_working_days WHERE organization_id = _organization_id) THEN
        INSERT INTO organization_working_days (organization_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday)
        VALUES (_organization_id, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE);
    END IF;

    -- Insert default team
    INSERT INTO teams (name, user_id, organization_id)
    VALUES (COALESCE(TRIM((_body ->> 'team_name')::TEXT), _name), _user_id, _organization_id)
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

    -- Self-hosted deployments are licensed at the deployment level; no plan trial is started.

    -- Return user data as JSON
    RETURN JSON_BUILD_OBJECT(
            'id', _user_id,
            'email', _email,
            'apple_id', _apple_id,
            'name', _name,
            'active_team', (SELECT active_team FROM users WHERE id = _user_id),
            'trial_id', _trial_id
           );
END
$$;

comment on function register_apple_user(json) is 'Registers a new Apple Sign-In OAuth user under the SELF_HOSTED license';

    `);
  }

  pgm.sql(`
-- Never create a second team member row for an email already in the team.
CREATE OR REPLACE FUNCTION create_team_member(_body json) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _team_id        UUID;
    _user_id        UUID;
    _job_title_id   UUID;
    _team_member_id UUID;
    _role_id        UUID;
    _email          TEXT;
    _output         JSON;
BEGIN
    _team_id = (_body ->> 'team_id')::UUID;

    -- Check if role_name is provided, otherwise fall back to is_admin flag
    IF is_null_or_empty((_body ->> 'role_name')) IS FALSE
    THEN
        SELECT id FROM roles WHERE name = (_body ->> 'role_name')::TEXT AND team_id = _team_id INTO _role_id;
    ELSIF ((_body ->> 'is_admin')::BOOLEAN IS TRUE)
    THEN
        SELECT id FROM roles WHERE team_id = _team_id AND admin_role IS TRUE AND name = 'Admin' INTO _role_id;
    ELSE
        SELECT id FROM roles WHERE team_id = _team_id AND default_role IS TRUE INTO _role_id;
    END IF;

    IF is_null_or_empty((_body ->> 'job_title')) IS FALSE
    THEN
        SELECT insert_job_title((_body ->> 'job_title')::TEXT, _team_id) INTO _job_title_id;
    ELSE
        _job_title_id = NULL;
    END IF;

    CREATE TEMPORARY TABLE temp_new_team_members (
        name                TEXT,
        email               TEXT,
        is_new              BOOLEAN,
        team_member_id      UUID,
        team_member_user_id UUID
    );

    FOR _email IN SELECT * FROM JSON_ARRAY_ELEMENTS((_body ->> 'emails')::JSON)
        LOOP

            _email = LOWER(TRIM('"' FROM _email)::TEXT);

            -- Skip addresses that already belong to (or are invited to) this team
            CONTINUE WHEN EXISTS(SELECT 1
                                 FROM team_member_info_view
                                 WHERE team_id = _team_id
                                   AND LOWER(email) = _email);

            SELECT id FROM users WHERE email = _email INTO _user_id;

            INSERT INTO team_members (job_title_id, user_id, team_id, role_id)
            VALUES (_job_title_id, _user_id, _team_id, _role_id)
            RETURNING id INTO _team_member_id;

            IF EXISTS(SELECT id
                      FROM email_invitations
                      WHERE email = _email
                        AND team_id = _team_id)
            THEN
                --                 DELETE
--                 FROM team_members
--                 WHERE id = (SELECT team_member_id
--                             FROM email_invitations
--                             WHERE email = _email
--                               AND team_id = _team_id);
--                 DELETE FROM email_invitations WHERE team_id = _team_id AND email = _email;

                DELETE FROM email_invitations WHERE email = _email AND team_id = _team_id;

--                 RAISE 'ERROR_EMAIL_INVITATION_EXISTS:%', _email;
            END IF;

            INSERT INTO email_invitations(team_id, team_member_id, email, name)
            VALUES (_team_id, _team_member_id, _email, SPLIT_PART(_email, '@', 1));

            INSERT INTO temp_new_team_members (is_new, team_member_id, team_member_user_id, name, email)
            VALUES ((is_null_or_empty(_user_id)), _team_member_id, _user_id,
                    (SELECT name FROM users WHERE id = _user_id), _email);
        END LOOP;

    SELECT ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec)))
    FROM (SELECT * FROM temp_new_team_members) rec
    INTO _output;

    DROP TABLE IF EXISTS temp_new_team_members;

    RETURN _output;
END;
$$;

  `);

  if (deploymentMode === 'self_hosted') {
    pgm.sql(`
-- Repair organizations created with the trial license and no real subscription.
UPDATE organizations o
SET license_type_id     = (SELECT id FROM sys_license_types WHERE key = 'SELF_HOSTED'),
    subscription_status = 'active'
WHERE (o.license_type_id IS NULL
       OR o.license_type_id IN (SELECT id FROM sys_license_types WHERE key IN ('TRIAL', 'TRAIL')))
  AND o.subscription_status = 'trialing'
  AND NOT EXISTS(SELECT 1 FROM licensing_user_subscriptions lus WHERE lus.user_id = o.user_id)
  AND NOT EXISTS(SELECT 1 FROM licensing_coupon_codes lcc WHERE lcc.redeemed_by = o.user_id)
  AND NOT EXISTS(SELECT 1 FROM licensing_custom_subs lcs WHERE lcs.user_id = o.user_id)
  AND NOT EXISTS(SELECT 1 FROM licensing_credit_subs lcs WHERE lcs.user_id = o.user_id);
    `);
  }
};

/** @param {import('node-pg-migrate').MigrationBuilder} _pgm */
exports.down = async (_pgm) => {
  // Data/function repair: no automatic rollback is available.
};
