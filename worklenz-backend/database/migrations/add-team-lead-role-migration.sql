-- Migration to add Team Lead role to existing teams
-- This migration adds the Team Lead role to all existing teams that don't already have it

DO $$
DECLARE
    team_record RECORD;
BEGIN
    -- Loop through all teams and add Team Lead role if it doesn't exist
    FOR team_record IN 
        SELECT id FROM teams 
    LOOP
        -- Check if Team Lead role already exists for this team
        IF NOT EXISTS (
            SELECT 1 FROM roles 
            WHERE team_id = team_record.id 
            AND name = 'Team Lead' 
            AND admin_role = TRUE
        ) THEN
            -- Insert Team Lead role for this team
            INSERT INTO roles (name, team_id, admin_role) 
            VALUES ('Team Lead', team_record.id, TRUE);
            
            RAISE NOTICE 'Added Team Lead role to team: %', team_record.id;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Team Lead role migration completed successfully';
END
$$;

CREATE OR REPLACE FUNCTION create_new_team(_name text, _user_id uuid) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _owner_id          UUID;
    _team_id           UUID;
    _organization_id           UUID;
    _admin_role_id     UUID;
    _owner_role_id     UUID;
    _trimmed_name      TEXT;
    _trimmed_team_name TEXT;
BEGIN

    _trimmed_team_name = TRIM(_name);
    -- get owner id
    SELECT user_id INTO _owner_id FROM teams WHERE id = (SELECT active_team FROM users WHERE id = _user_id);
    SELECT id INTO _organization_id FROM organizations WHERE user_id = _user_id;

    -- insert team
    INSERT INTO teams (name, user_id, organization_id)
    VALUES (_trimmed_team_name, _owner_id, _organization_id)
    RETURNING id INTO _team_id;

    -- insert default roles
    INSERT INTO roles (name, team_id, default_role) VALUES ('Member', _team_id, TRUE);
    INSERT INTO roles (name, team_id, admin_role) VALUES ('Admin', _team_id, TRUE) RETURNING id INTO _admin_role_id;
    INSERT INTO roles (name, team_id, admin_role) VALUES ('Team Lead', _team_id, TRUE);
    INSERT INTO roles (name, team_id, owner) VALUES ('Owner', _team_id, TRUE) RETURNING id INTO _owner_role_id;

    -- insert team member
    INSERT INTO team_members (user_id, team_id, role_id)
    VALUES (_owner_id, _team_id, _owner_role_id);

    IF (_user_id <> _owner_id)
    THEN
        INSERT INTO team_members (user_id, team_id, role_id)
        VALUES (_user_id, _team_id, _admin_role_id);
    END IF;

    RETURN JSON_BUILD_OBJECT(
            'id', _user_id,
            'name', _trimmed_name,
            'team_id', _team_id
        );
END;
$$;

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

    DROP TABLE temp_new_team_members;

    RETURN _output;
END;
$$;

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
BEGIN

    _trimmed_email = LOWER(TRIM((_body ->> 'email')));
    _trimmed_name = TRIM((_body ->> 'name'));
    _trimmed_team_name = TRIM((_body ->> 'team_name'));

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
                        AND email = _trimmed_email)
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
        WHERE email = _trimmed_email
          AND team_member_id = (_body ->> 'team_member_id')::UUID;
    END IF;

    RETURN JSON_BUILD_OBJECT(
            'id', _user_id,
            'name', _trimmed_name,
            'email', _trimmed_email,
            'team_id', _team_id
           );
END;
$$;

CREATE OR REPLACE FUNCTION update_team_member(_body json) RETURNS void
    LANGUAGE plpgsql
AS
$$
DECLARE
    _team_id      UUID;
    _job_title_id UUID;
    _role_id      UUID;
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

    UPDATE team_members
    SET job_title_id = _job_title_id,
        role_id      = _role_id,
        updated_at   = CURRENT_TIMESTAMP
    WHERE id = (_body ->> 'id')::UUID
      AND team_id = _team_id;
END;
$$;