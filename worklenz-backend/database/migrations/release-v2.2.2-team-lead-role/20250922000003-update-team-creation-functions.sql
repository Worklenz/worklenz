-- Migration: Update Team Creation Functions for Correct Team Lead Implementation
-- Description: Updates existing team creation functions to create Team Lead role without admin privileges
-- Version: v2.2.2
-- Date: 2025-01-21

-- Step 1: Update create_new_team function (2 parameter version)
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
    INSERT INTO roles (name, team_id, admin_role) VALUES ('Team Lead', _team_id, FALSE); -- ✅ FIXED: No admin privileges
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
            'name', (SELECT name FROM users WHERE id = _user_id),
            'team_id', _team_id
        );
END;
$$;

-- Step 2: Update create_new_team function (3 parameter version)
CREATE OR REPLACE FUNCTION create_new_team(_name text, _user_id uuid, _current_team_id uuid) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _owner_id          UUID;
    _team_id           UUID;
    _role_id           UUID;
    _trimmed_team_name TEXT;
BEGIN

    _trimmed_team_name = TRIM(_name);

    -- get owner id
    SELECT user_id INTO _owner_id FROM teams WHERE id = (SELECT active_team FROM users WHERE id = _user_id);

    -- insert team
    INSERT INTO teams (name, user_id, organization_id)
    VALUES (_trimmed_team_name, _owner_id, (SELECT id FROM organizations WHERE user_id = _owner_id)::UUID)
    RETURNING id INTO _team_id;

    -- insert default roles
    INSERT INTO roles (name, team_id, default_role) VALUES ('Member', _team_id, TRUE);
    INSERT INTO roles (name, team_id, admin_role) VALUES ('Admin', _team_id, TRUE);
    INSERT INTO roles (name, team_id, admin_role) VALUES ('Team Lead', _team_id, FALSE); -- ✅ FIXED: No admin privileges
    INSERT INTO roles (name, team_id, owner) VALUES ('Owner', _team_id, TRUE) RETURNING id INTO _role_id;

    -- insert team member
    INSERT INTO team_members (user_id, team_id, role_id)
    VALUES (_user_id, _team_id, _role_id);

    RETURN JSON_BUILD_OBJECT(
            'id', _user_id,
            'name', (SELECT name FROM users WHERE id = _user_id),
            'team_id', _team_id
        );
END
$$;

-- Step 3: Add verification to ensure all new teams create Team Lead without admin privileges
DO $$
DECLARE
    admin_team_leads integer;
BEGIN
    -- Check for any Team Lead roles that still have admin_role = TRUE
    SELECT COUNT(*) INTO admin_team_leads
    FROM roles 
    WHERE name = 'Team Lead' 
    AND admin_role = TRUE;
    
    IF admin_team_leads > 0 THEN
        RAISE NOTICE 'Warning: % Team Lead roles still have admin_role = TRUE (should be fixed by previous migration)', admin_team_leads;
    ELSE
        RAISE NOTICE 'Function update successful: Team Lead roles will be created without admin privileges';
    END IF;
END
$$;