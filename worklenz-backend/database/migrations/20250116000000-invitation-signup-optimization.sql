-- Migration: Optimize invitation signup process to skip organization/team creation for invited users
-- Release: v2.1.1
-- Date: 2025-01-16

-- Drop and recreate register_user function with invitation optimization
DROP FUNCTION IF EXISTS register_user(_body json);
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
    _invited_team_id   UUID;
    _team_member_id    UUID;
    _is_invitation     BOOLEAN DEFAULT FALSE;
BEGIN

    _trimmed_email = LOWER(TRIM((_body ->> 'email')));
    _trimmed_name = TRIM((_body ->> 'name'));
    _trimmed_team_name = TRIM((_body ->> 'team_name'));
    _team_member_id = (_body ->> 'team_member_id')::UUID;

    -- check user exists
    IF EXISTS(SELECT email FROM users WHERE email = _trimmed_email)
    THEN
        RAISE 'EMAIL_EXISTS_ERROR:%', (_body ->> 'email');
    END IF;

    -- insert user
    INSERT INTO users (name, email, password, timezone_id)
    VALUES (_trimmed_name, _trimmed_email, (_body ->> 'password'),
            COALESCE((SELECT id FROM timezones WHERE name = (_body ->> 'timezone')),
                     (SELECT id FROM timezones WHERE name = 'UTC')))
    RETURNING id INTO _user_id;

    -- Check if this is an invitation signup
    IF _team_member_id IS NOT NULL THEN
        -- Verify the invitation exists and get the team_id
        SELECT team_id INTO _invited_team_id
        FROM email_invitations
        WHERE email = _trimmed_email
          AND team_member_id = _team_member_id;

        IF _invited_team_id IS NOT NULL THEN
            _is_invitation = TRUE;
        END IF;
    END IF;

    -- Handle invitation signup (skip organization/team creation)
    IF _is_invitation THEN
        -- Set user's active team to the invited team
        UPDATE users SET active_team = _invited_team_id WHERE id = _user_id;

        -- Update the existing team_members record with the new user_id
        UPDATE team_members 
        SET user_id = _user_id 
        WHERE id = _team_member_id 
          AND team_id = _invited_team_id;

        -- Delete the email invitation record
        DELETE FROM email_invitations
        WHERE email = _trimmed_email
          AND team_member_id = _team_member_id;

        RETURN JSON_BUILD_OBJECT(
                'id', _user_id,
                'name', _trimmed_name,
                'email', _trimmed_email,
                'team_id', _invited_team_id,
                'invitation_accepted', TRUE
               );
    END IF;

    -- Handle regular signup (create organization/team)
    --insert organization data
    INSERT INTO organizations (user_id, organization_name, contact_number, contact_number_secondary, trial_in_progress,
                               trial_expire_date, subscription_status, license_type_id)
    VALUES (_user_id, _trimmed_team_name, NULL, NULL, TRUE, CURRENT_DATE + INTERVAL '9999 days',
            'active', (SELECT id FROM sys_license_types WHERE key = 'SELF_HOSTED'))
    RETURNING id INTO _organization_id;

    -- insert team
    INSERT INTO teams (name, user_id, organization_id)
    VALUES (_trimmed_team_name, _user_id, _organization_id)
    RETURNING id INTO _team_id;

    -- Set user's active team to their new team
    UPDATE users SET active_team = _team_id WHERE id = _user_id;

    -- insert default roles
    INSERT INTO roles (name, team_id, default_role) VALUES ('Member', _team_id, TRUE);
    INSERT INTO roles (name, team_id, admin_role) VALUES ('Admin', _team_id, TRUE);
    INSERT INTO roles (name, team_id, owner) VALUES ('Owner', _team_id, TRUE) RETURNING id INTO _role_id;

    -- insert team member
    INSERT INTO team_members (user_id, team_id, role_id)
    VALUES (_user_id, _team_id, _role_id);

    RETURN JSON_BUILD_OBJECT(
            'id', _user_id,
            'name', _trimmed_name,
            'email', _trimmed_email,
            'team_id', _team_id,
            'invitation_accepted', FALSE
           );
END
$$;

-- Drop and recreate register_google_user function with invitation optimization
DROP FUNCTION IF EXISTS register_google_user(_body json);
CREATE OR REPLACE FUNCTION register_google_user(_body json) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _user_id           UUID;
    _organization_id   UUID;
    _team_id           UUID;
    _role_id           UUID;
    _name              TEXT;
    _email             TEXT;
    _google_id         TEXT;
    _team_name         TEXT;
    _team_member_id    UUID;
    _invited_team_id   UUID;
    _is_invitation     BOOLEAN DEFAULT FALSE;
BEGIN
    _name = (_body ->> 'displayName')::TEXT;
    _email = (_body ->> 'email')::TEXT;
    _google_id = (_body ->> 'id');
    _team_name = (_body ->> 'team_name')::TEXT;
    _team_member_id = (_body ->> 'member_id')::UUID;
    _invited_team_id = (_body ->> 'team')::UUID;

    INSERT INTO users (name, email, google_id, timezone_id)
    VALUES (_name, _email, _google_id, COALESCE((SELECT id FROM timezones WHERE name = (_body ->> 'timezone')),
                                                (SELECT id FROM timezones WHERE name = 'UTC')))
    RETURNING id INTO _user_id;

    -- Check if this is an invitation signup
    IF _team_member_id IS NOT NULL AND _invited_team_id IS NOT NULL THEN
        -- Verify the team member exists in the invited team
        IF EXISTS(SELECT id
                  FROM team_members
                  WHERE id = _team_member_id
                    AND team_id = _invited_team_id) THEN
            _is_invitation = TRUE;
        END IF;
    END IF;

    -- Handle invitation signup (skip organization/team creation)
    IF _is_invitation THEN
        -- Set user's active team to the invited team
        UPDATE users SET active_team = _invited_team_id WHERE id = _user_id;

        -- Update the existing team_members record with the new user_id
        UPDATE team_members
        SET user_id = _user_id
        WHERE id = _team_member_id
          AND team_id = _invited_team_id;

        -- Delete the email invitation record
        DELETE FROM email_invitations
        WHERE team_id = _invited_team_id
          AND team_member_id = _team_member_id;

        RETURN JSON_BUILD_OBJECT(
                'id', _user_id,
                'email', _email,
                'google_id', _google_id,
                'team_id', _invited_team_id,
                'invitation_accepted', TRUE
               );
    END IF;

    -- Handle regular signup (create organization/team)
    --insert organization data
    INSERT INTO organizations (user_id, organization_name, contact_number, contact_number_secondary, trial_in_progress,
                               trial_expire_date, subscription_status, license_type_id)
    VALUES (_user_id, COALESCE(_team_name, _name), NULL, NULL, TRUE, CURRENT_DATE + INTERVAL '9999 days',
            'active', (SELECT id FROM sys_license_types WHERE key = 'SELF_HOSTED'))
    RETURNING id INTO _organization_id;

    INSERT INTO teams (name, user_id, organization_id)
    VALUES (COALESCE(_team_name, _name), _user_id, _organization_id)
    RETURNING id INTO _team_id;

    -- Set user's active team to their new team
    UPDATE users SET active_team = _team_id WHERE id = _user_id;

    -- insert default roles
    INSERT INTO roles (name, team_id, default_role) VALUES ('Member', _team_id, TRUE);
    INSERT INTO roles (name, team_id, admin_role) VALUES ('Admin', _team_id, TRUE);
    INSERT INTO roles (name, team_id, owner) VALUES ('Owner', _team_id, TRUE) RETURNING id INTO _role_id;

    INSERT INTO team_members (user_id, team_id, role_id)
    VALUES (_user_id, _team_id, _role_id);

    RETURN JSON_BUILD_OBJECT(
            'id', _user_id,
            'email', _email,
            'google_id', _google_id,
            'team_id', _team_id,
            'invitation_accepted', FALSE
           );
END
$$;

-- Update deserialize_user function to include invitation_accepted flag
DROP FUNCTION IF EXISTS deserialize_user(_id uuid);
CREATE OR REPLACE FUNCTION deserialize_user(_id uuid) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _result  JSON;
    _team_id UUID;
BEGIN

    SELECT active_team FROM users WHERE id = _id INTO _team_id;
    IF NOT EXISTS(SELECT 1 FROM notification_settings WHERE team_id = _team_id AND user_id = _id)
    THEN
        INSERT INTO notification_settings (popup_notifications_enabled, show_unread_items_count, user_id, team_id)
        VALUES (TRUE, TRUE, _id, _team_id);
    END IF;

    SELECT ROW_TO_JSON(rec)
    INTO _result
    FROM (SELECT users.id,
                 users.name,
                 users.email,
                 users.timezone_id AS timezone,
                 (SELECT name FROM timezones WHERE id = users.timezone_id) AS timezone_name,
                 users.avatar_url,
                 users.user_no,
                 users.socket_id,
                 users.created_at AS joined_date,
                 users.updated_at AS last_updated,

                 (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                  FROM (SELECT description, type FROM worklenz_alerts WHERE active is TRUE) rec) AS alerts,

                 (SELECT email_notifications_enabled
                  FROM notification_settings
                  WHERE user_id = users.id
                    AND team_id = t.id) AS email_notifications_enabled,
                 (CASE
                      WHEN is_owner(users.id, users.active_team) THEN users.setup_completed
                      ELSE TRUE END) AS setup_completed,
                 users.setup_completed AS my_setup_completed,
                 (is_null_or_empty(users.google_id) IS FALSE) AS is_google,
                 t.name AS team_name,
                 t.id AS team_id,
                 (SELECT id
                  FROM team_members
                  WHERE team_members.user_id = _id
                    AND team_id = users.active_team
                    AND active IS TRUE) AS team_member_id,
                 is_owner(users.id, users.active_team) AS owner,
                 is_admin(users.id, users.active_team) AS is_admin,
                 t.user_id AS owner_id,
                 -- invitation_accepted is true if user is not the owner of their active team
                 (NOT is_owner(users.id, users.active_team)) AS invitation_accepted,
                 ud.subscription_status,
                 (SELECT CASE
                             WHEN (ud.subscription_status) = 'trialing'
                                 THEN (trial_expire_date)::DATE
                             WHEN (EXISTS(SELECT id FROM licensing_custom_subs WHERE user_id = t.user_id))
                                 THEN (SELECT end_date FROM licensing_custom_subs lcs WHERE lcs.user_id = t.user_id)::DATE
                             WHEN EXISTS (SELECT 1
                                          FROM licensing_user_subscriptions
                                          WHERE user_id = t.user_id AND active IS TRUE)
                                 THEN (SELECT (next_bill_date)::DATE - INTERVAL '1 day'
                                       FROM licensing_user_subscriptions
                                       WHERE user_id = t.user_id)::DATE
                             END) AS valid_till_date
          FROM users
                   INNER JOIN teams t
                              ON t.id = COALESCE(users.active_team,
                                                 (SELECT id FROM teams WHERE teams.user_id = users.id LIMIT 1))
                   LEFT JOIN organizations ud ON ud.user_id = t.user_id
          WHERE users.id = _id) rec;

    RETURN _result;
END
$$; 