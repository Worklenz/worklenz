'use strict';

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    -- Ensure escape_html helper exists
    CREATE OR REPLACE FUNCTION escape_html(_text text) RETURNS text
        LANGUAGE plpgsql IMMUTABLE
    AS $$
    BEGIN
        IF _text IS NULL THEN
            RETURN '';
        END IF;
        
        RETURN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
            _text,
            '&', '&amp;'),
            '<', '&lt;'),
            '>', '&gt;'),
            '"', '&quot;'),
            '''', '&#39;');
    END;
    $$;

    -- 1. Fix create_project_member to pass JSONB message_params
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
        _existing_access_level TEXT;
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

        -- Enforce guest uniqueness across the team: a user cannot have both GUEST and non-GUEST access levels
        -- Check 1: If adding as GUEST, ensure they don't have a non-GUEST role in the team
        IF UPPER(_access_level) = 'GUEST' THEN
            SELECT DISTINCT pal.key
            INTO _existing_access_level
            FROM project_members pm
            JOIN project_access_levels pal ON pm.project_access_level_id = pal.id
            JOIN projects p ON pm.project_id = p.id
            WHERE pm.team_member_id = _team_member_id
              AND p.team_id = _team_id
              AND pal.key != 'GUEST'
            LIMIT 1;

            IF _existing_access_level IS NOT NULL THEN
                RAISE 'MEMBER_DIFFERENT_ACCESS_LEVEL:%', _existing_access_level;
            END IF;
        END IF;

        -- Check 2: If adding as non-GUEST, ensure they don't have a GUEST role in the team
        IF UPPER(_access_level) != 'GUEST' THEN
            SELECT DISTINCT pal.key
            INTO _existing_access_level
            FROM project_members pm
            JOIN project_access_levels pal ON pm.project_access_level_id = pal.id
            JOIN projects p ON pm.project_id = p.id
            WHERE pm.team_member_id = _team_member_id
              AND p.team_id = _team_id
              AND pal.key = 'GUEST'
            LIMIT 1;

            IF _existing_access_level IS NOT NULL THEN
                RAISE 'MEMBER_DIFFERENT_ACCESS_LEVEL:GUEST';
            END IF;
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
                                   escape_html((SELECT name FROM projects WHERE id = _project_id)),
                                   '</b> by <b>',
                                   escape_html((SELECT name FROM users WHERE id = _user_id)), '</b>');
            PERFORM create_notification(
                    (SELECT user_id FROM team_members WHERE id = _team_member_id),
                    _team_id,
                    NULL,
                    _project_id,
                    _notification,
                    'notifications.addedToProject',
                    JSONB_BUILD_OBJECT(
                        'project', (SELECT name FROM projects WHERE id = _project_id),
                        'user', (SELECT name FROM users WHERE id = _user_id)
                    ),
                    'PROJECT_MEMBER_ADDED'
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

    -- 2. Fix create_project_comment to pass JSONB message_params
    CREATE OR REPLACE FUNCTION create_project_comment(_body json) RETURNS json
        LANGUAGE plpgsql
    AS
    $$
    DECLARE
        _project_id    UUID;
        _created_by    UUID;
        _comment_id    UUID;
        _team_id       UUID;
        _reply_to_id   UUID;
        _user_name     TEXT;
        _project_name  TEXT;
        _content       TEXT;
        _mention_index INT := 0;
        _mention       JSON;
    BEGIN
        _project_id = (_body ->> 'project_id');
        _created_by = (_body ->> 'created_by');
        _content = (_body ->> 'content');
        _team_id = (_body ->> 'team_id');
        _reply_to_id = NULLIF((_body ->> 'reply_to_id'), '')::UUID;

        SELECT name FROM users WHERE id = _created_by LIMIT 1 INTO _user_name;
        SELECT name FROM projects WHERE id = _project_id INTO _project_name;

        INSERT INTO project_comments (content, created_by, project_id, reply_to_id)
        VALUES (_content, _created_by, _project_id, _reply_to_id)
        RETURNING id INTO _comment_id;

        FOR _mention IN SELECT * FROM JSON_ARRAY_ELEMENTS((_body ->> 'mentions')::JSON)
            LOOP
                INSERT INTO project_comment_mentions (comment_id, mentioned_index, mentioned_by, informed_by)
                VALUES (_comment_id, _mention_index, _created_by, (_mention ->> 'id')::UUID);

                PERFORM create_notification(
                        (SELECT id FROM users WHERE id = (_mention ->> 'id')::UUID),
                        (_team_id)::UUID,
                        null,
                        (_project_id)::UUID,
                        CONCAT('<b>', escape_html(_user_name), '</b> has mentioned you in a comment on <b>', escape_html(_project_name), '</b>'),
                        'notifications.mentionedInProjectComment',
                        JSONB_BUILD_OBJECT('user', _user_name, 'project', _project_name),
                        'PROJECT_COMMENT_MENTION'
                    );
                _mention_index := _mention_index + 1;

            END LOOP;

        RETURN JSON_BUILD_OBJECT(
                'id', (_comment_id)::UUID,
                'content', (_content)::TEXT,
                'user_id', (_created_by)::UUID,
                'created_by', (_user_name)::TEXT,
                'avatar_url', (SELECT avatar_url FROM users WHERE id = _created_by),
                'created_at', (SELECT created_at FROM project_comments WHERE id = _comment_id),
                'updated_at', (SELECT updated_at FROM project_comments WHERE id = _comment_id),
                'reply_to_id', (_reply_to_id)::UUID,
                'mentions', (SELECT COALESCE(JSON_AGG(rec), '[]'::JSON)
                            FROM (SELECT u.name  AS user_name,
                                         u.email AS user_email
                                  FROM project_comment_mentions pcm
                                        LEFT JOIN users u ON pcm.informed_by = u.id
                                  WHERE pcm.comment_id = _comment_id) rec),
                'project_name', (_project_name)::TEXT,
                'team_name', (SELECT name FROM teams WHERE id = (_team_id)::UUID)
            );
    END
    $$;

    -- 3. Fix create_task_comment to pass JSONB message_params
    CREATE OR REPLACE FUNCTION create_task_comment(_body json) RETURNS json
        LANGUAGE plpgsql
    AS
    $$
    DECLARE
        _task_id        UUID;
        _user_id        UUID;
        _team_member_id UUID;
        _comment_id     UUID;
        _user_name      TEXT;
        _task_name      TEXT;
        _mention_index  INT := 0;
        _mention        JSON;
    BEGIN
        _task_id = (_body ->> 'task_id')::UUID;
        _user_id = (_body ->> 'user_id')::UUID;

        SELECT name FROM users WHERE id = _user_id INTO _user_name;
        SELECT name FROM tasks WHERE id = _task_id INTO _task_name;

        SELECT id
        FROM team_members
        WHERE user_id = _user_id
          AND team_id = (_body ->> 'team_id')::UUID
        INTO _team_member_id;

        INSERT INTO task_comments (user_id, team_member_id, task_id)
        VALUES (_user_id, _team_member_id, _task_id)
        RETURNING id INTO _comment_id;

        INSERT INTO task_comment_contents (index, comment_id, text_content)
        VALUES (0, _comment_id, (_body ->> 'content')::TEXT);

        -- notify mentions
        FOR _mention IN SELECT * FROM JSON_ARRAY_ELEMENTS((_body ->> 'mentions')::JSON)
            LOOP
                INSERT INTO task_comment_mentions (comment_id, mentioned_index, mentioned_by, informed_by)
                    VALUES (_comment_id, _mention_index, _user_id, (_mention ->> 'team_member_id')::UUID);
                PERFORM create_notification(
                    (SELECT user_id FROM team_members WHERE id = TRIM(BOTH '"' FROM (_mention ->> 'team_member_id'))::UUID),
                    (_body ->> 'team_id')::UUID,
                    _task_id,
                    (SELECT project_id FROM tasks WHERE id = _task_id),
                    CONCAT('<b>', escape_html(_user_name), '</b> has mentioned you in a comment on <b>', escape_html(_task_name), '</b>'),
                    'notifications.mentionedInComment',
                    JSONB_BUILD_OBJECT('user', _user_name, 'task', _task_name),
                    'TASK_COMMENT_MENTION'
                    );
                _mention_index := _mention_index + 1;
            END LOOP;

        RETURN JSON_BUILD_OBJECT(
            'id', _comment_id,
            'content', (_body ->> 'content')::TEXT,
            'task_name', _task_name,
            'project_id', (SELECT project_id FROM tasks WHERE id = _task_id),
            'project_name', (SELECT name FROM projects WHERE id = (SELECT project_id FROM tasks WHERE id = _task_id)),
            'team_name', (SELECT name FROM teams WHERE id = (_body ->> 'team_id')::UUID)
            );
    END
    $$;

    -- 4. Fix remove_project_member to pass JSONB message_params
    CREATE OR REPLACE FUNCTION remove_project_member(_id uuid, _user_id uuid, _team_id uuid) RETURNS json
        LANGUAGE plpgsql
    AS
    $$
    DECLARE
        _team_member_id UUID;
        _project_id     UUID;
        _member_user_id UUID;
        _notification   TEXT;
    BEGIN
        SELECT project_id FROM project_members WHERE id = _id INTO _project_id;
        SELECT team_member_id FROM project_members WHERE id = _id INTO _team_member_id;
        SELECT user_id FROM team_members WHERE id = _team_member_id INTO _member_user_id;
        DELETE FROM project_members WHERE id = _id;
        DELETE FROM project_member_allocations WHERE project_id = _project_id AND team_member_id = _team_member_id;

        IF (_member_user_id != _user_id)
        THEN
            _notification =
                CONCAT('You have been removed from the <b>', (SELECT name FROM projects WHERE id = _project_id),
                       '</b> by <b>',
                       (SELECT name FROM users WHERE id = _user_id), '</b>');
            PERFORM create_notification(
                (SELECT user_id FROM team_members WHERE id = _team_member_id),
                _team_id,
                NULL,
                _project_id,
                _notification,
                'notifications.removedFromProject',
                JSONB_BUILD_OBJECT(
                    'project', (SELECT name FROM projects WHERE id = _project_id),
                    'user', (SELECT name FROM users WHERE id = _user_id)
                ),
                'PROJECT_MEMBER_REMOVED'
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
    END;
    $$;

    -- 5. Fix transfer_team_ownership to pass JSONB message_params
    CREATE OR REPLACE FUNCTION transfer_team_ownership(_team_id uuid, _new_owner_id uuid) RETURNS json
        LANGUAGE plpgsql
    AS
    $$
    DECLARE
        _old_owner_id UUID;
        _owner_role_id UUID;
        _admin_role_id UUID;
        _old_org_id UUID;
        _new_org_id UUID;
        _old_owner_role_id UUID;
        _new_owner_role_id UUID;
        _has_active_coupon BOOLEAN;
        _other_teams_count INTEGER;
        _has_valid_license BOOLEAN;
        _old_org_name TEXT;
        _new_org_name TEXT;
        _all_teams_in_old_org INTEGER;
        _all_teams_in_new_org INTEGER;
        _temp_uuid UUID := 'a27351a4-94d2-4d0a-9062-6ded6633f274'::UUID; -- Temporary user for swap operation
    BEGIN
        -- Get the current owner's ID and organization
        SELECT t.user_id, t.organization_id
        INTO _old_owner_id, _old_org_id
        FROM teams t
        WHERE t.id = _team_id;

        IF _old_owner_id IS NULL THEN
            RAISE EXCEPTION 'Team not found';
        END IF;

        -- Get the old organization name
        SELECT organization_name INTO _old_org_name
        FROM organizations
        WHERE id = _old_org_id;

        IF _old_org_id IS NULL THEN
            RAISE EXCEPTION 'Organization not found';
        END IF;

        -- Get the new owner's organization (MUST exist)
        SELECT id, organization_name INTO _new_org_id, _new_org_name
        FROM organizations
        WHERE user_id = _new_owner_id;

        IF _new_org_id IS NULL THEN
            RAISE EXCEPTION 'New owner must have an organization. Please create an organization for user % first.', _new_owner_id;
        END IF;

        -- Check if at least one of them has a valid license (since licenses will be swapped)
        SELECT EXISTS (
            SELECT 1
            FROM (
                -- Check regular subscriptions for BOTH users
                SELECT lus.user_id, lus.status, lus.active
                FROM licensing_user_subscriptions lus
                WHERE lus.user_id IN (_old_owner_id, _new_owner_id)
                AND lus.active = TRUE
                AND lus.status IN ('active', 'trialing')

                UNION ALL

                -- Check custom subscriptions for BOTH users
                SELECT lcs.user_id, 'active' as status, TRUE as active
                FROM licensing_custom_subs lcs
                WHERE lcs.user_id IN (_old_owner_id, _new_owner_id)
                AND lcs.active = TRUE

                UNION ALL

                -- Check active trials for BOTH users
                SELECT lpt.user_id, 'trialing' as status, TRUE as active
                FROM licensing_plan_trials lpt
                WHERE lpt.user_id IN (_old_owner_id, _new_owner_id)
                AND lpt.trial_ends_at > NOW()
            ) all_licenses
        ) INTO _has_valid_license;

        -- Lifetime (AppSumo) licenses live in an optional table that only exists when the
        -- AppSumo extension is installed.
        IF NOT _has_valid_license AND to_regclass('licensing_sumo_licenses') IS NOT NULL THEN
            EXECUTE 'SELECT EXISTS (SELECT 1 FROM licensing_sumo_licenses WHERE user_id IN ($1, $2))'
            INTO _has_valid_license
            USING _old_owner_id, _new_owner_id;
        END IF;

        IF NOT _has_valid_license THEN
            RAISE EXCEPTION 'At least one user must have a valid license to perform team transfer';
        END IF;

        -- Check if either user has active coupon
        SELECT EXISTS (
            SELECT 1
            FROM licensing_active_coupons
            WHERE user_id IN (_old_owner_id, _new_owner_id)
        ) INTO _has_active_coupon;

        -- Get count of all teams in old organization
        SELECT COUNT(*) INTO _all_teams_in_old_org
        FROM teams
        WHERE organization_id = _old_org_id;

        -- Get count of all teams in new organization
        SELECT COUNT(*) INTO _all_teams_in_new_org
        FROM teams
        WHERE organization_id = _new_org_id;

        -- ============================================================
        -- SWAP LICENSES: Swap all licenses between old and new owner
        -- ============================================================

        -- Step 1: Swap regular subscriptions
        UPDATE licensing_user_subscriptions
        SET user_id = CASE
            WHEN user_id = _old_owner_id THEN _new_owner_id
            WHEN user_id = _new_owner_id THEN _old_owner_id
            ELSE user_id
        END
        WHERE user_id IN (_old_owner_id, _new_owner_id);

        -- Step 2: Swap custom subscriptions
        UPDATE licensing_custom_subs
        SET user_id = CASE
            WHEN user_id = _old_owner_id THEN _new_owner_id
            WHEN user_id = _new_owner_id THEN _old_owner_id
            ELSE user_id
        END
        WHERE user_id IN (_old_owner_id, _new_owner_id);

        -- Step 3: Swap AppSumo licenses
        IF to_regclass('licensing_sumo_licenses') IS NOT NULL THEN
            EXECUTE 'UPDATE licensing_sumo_licenses
                     SET user_id = CASE
                         WHEN user_id = $1 THEN $2
                         WHEN user_id = $2 THEN $1
                         ELSE user_id
                     END
                     WHERE user_id IN ($1, $2)'
            USING _old_owner_id, _new_owner_id;
        END IF;

        -- Step 4: Swap plan trials
        UPDATE licensing_plan_trials
        SET user_id = CASE
            WHEN user_id = _old_owner_id THEN _new_owner_id
            WHEN user_id = _new_owner_id THEN _old_owner_id
            ELSE user_id
        END
        WHERE user_id IN (_old_owner_id, _new_owner_id);

        -- ============================================================
        -- SWAP ORGANIZATIONS: Temporarily drop unique constraint for swap
        -- ============================================================

        -- Drop the unique constraint temporarily
        ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_user_id_key;
        ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_pk_2;

        -- Step 5a: Temporarily set old owner's org to temp UUID
        UPDATE organizations
        SET user_id = _temp_uuid
        WHERE id = _old_org_id;

        -- Step 5b: Set new owner's org to old owner
        UPDATE organizations
        SET user_id = _old_owner_id
        WHERE id = _new_org_id;

        -- Step 5c: Set old owner's org (currently temp) to new owner
        UPDATE organizations
        SET user_id = _new_owner_id
        WHERE id = _old_org_id;

        -- Re-add the unique constraint
        ALTER TABLE organizations ADD CONSTRAINT organizations_user_id_key UNIQUE (user_id);

        -- ============================================================
        -- SWAP TEAMS: Update all teams in both organizations
        -- ============================================================

        -- Step 6: Swap ALL teams in both organizations
        UPDATE teams
        SET user_id = CASE
            WHEN organization_id = _old_org_id THEN _new_owner_id
            WHEN organization_id = _new_org_id THEN _old_owner_id
            ELSE user_id
        END
        WHERE organization_id IN (_old_org_id, _new_org_id);

        -- ============================================================
        -- UPDATE TEAM ROLES: Update roles for the specific team
        -- ============================================================

        -- Get the owner and admin role IDs for the specific team
        SELECT id INTO _owner_role_id FROM roles WHERE team_id = _team_id AND owner = TRUE;
        SELECT id INTO _admin_role_id FROM roles WHERE team_id = _team_id AND admin_role = TRUE;

        -- Get current role IDs for both users in the specific team
        SELECT role_id INTO _old_owner_role_id
        FROM team_members
        WHERE team_id = _team_id AND user_id = _old_owner_id;

        SELECT role_id INTO _new_owner_role_id
        FROM team_members
        WHERE team_id = _team_id AND user_id = _new_owner_id;

        -- Update the old owner's role to admin if they are a member of this team
        IF _old_owner_role_id IS NOT NULL THEN
            UPDATE team_members
            SET role_id = _admin_role_id
            WHERE team_id = _team_id AND user_id = _old_owner_id;
        END IF;

        -- Update the new owner's role to owner
        IF _new_owner_role_id IS NOT NULL THEN
            UPDATE team_members
            SET role_id = _owner_role_id
            WHERE team_id = _team_id AND user_id = _new_owner_id;
        ELSE
            -- If new owner is not a team member yet, add them as owner
            INSERT INTO team_members (user_id, team_id, role_id)
            VALUES (_new_owner_id, _team_id, _owner_role_id);
        END IF;

        -- ============================================================
        -- NOTIFICATIONS: Notify both users about the swap
        -- ============================================================

        -- Notify old owner about organization swap
        PERFORM create_notification(
            _old_owner_id,
            _team_id,
            NULL,
            NULL,
            CONCAT('Your organization <b>', _old_org_name, '</b> has been swapped with <b>', _new_org_name, '</b>. You are now the owner of <b>', _new_org_name, '</b> with all its teams, projects, and licenses.'),
            'notifications.orgSwapped',
            JSONB_BUILD_OBJECT('previousOrganization', _old_org_name, 'organization', _new_org_name),
            'ORGANIZATION_SWAPPED'
        );

        -- Notify new owner about organization swap
        PERFORM create_notification(
            _new_owner_id,
            _team_id,
            NULL,
            NULL,
            CONCAT('Your organization <b>', _new_org_name, '</b> has been swapped with <b>', _old_org_name, '</b>. You are now the owner of <b>', _old_org_name, '</b> with all its teams, projects, and licenses.'),
            'notifications.orgSwapped',
            JSONB_BUILD_OBJECT('previousOrganization', _new_org_name, 'organization', _old_org_name),
            'ORGANIZATION_SWAPPED'
        );

        -- Notify old owner about specific team ownership change
        PERFORM create_notification(
            _old_owner_id,
            _team_id,
            NULL,
            NULL,
            CONCAT('You are no longer the owner of team <b>', (SELECT name FROM teams WHERE id = _team_id), '</b>'),
            'notifications.teamOwnershipChanged',
            JSONB_BUILD_OBJECT('team', (SELECT name FROM teams WHERE id = _team_id), 'isOwner', FALSE),
            'TEAM_OWNERSHIP_CHANGED'
        );

        -- Notify new owner about specific team ownership change
        PERFORM create_notification(
            _new_owner_id,
            _team_id,
            NULL,
            NULL,
            CONCAT('You are now the owner of team <b>', (SELECT name FROM teams WHERE id = _team_id), '</b>'),
            'notifications.teamOwnershipChanged',
            JSONB_BUILD_OBJECT('team', (SELECT name FROM teams WHERE id = _team_id), 'isOwner', TRUE),
            'TEAM_OWNERSHIP_CHANGED'
        );

        -- Return detailed information about the swap
        RETURN json_build_object(
            'success', TRUE,
            'old_owner_id', _old_owner_id,
            'new_owner_id', _new_owner_id,
            'team_id', _team_id,
            'old_organization_id', _old_org_id,
            'old_organization_name', _old_org_name,
            'new_organization_id', _new_org_id,
            'new_organization_name', _new_org_name,
            'old_owner_now_owns_org', _new_org_name,
            'new_owner_now_owns_org', _old_org_name,
            'teams_in_old_org', _all_teams_in_old_org,
            'teams_in_new_org', _all_teams_in_new_org,
            'organizations_swapped', TRUE,
            'licenses_swapped', TRUE,
            'has_valid_license', _has_valid_license,
            'has_active_coupon', _has_active_coupon
        );
    END;
    $$;

    -- 6. Update notify_task_assignment_update to use JSONB_BUILD_OBJECT
    CREATE OR REPLACE FUNCTION notify_task_assignment_update(
        _type text,
        _reporter_id uuid,
        _task_id uuid,
        _user_id uuid,
        _team_id uuid
    ) RETURNS JSON
        LANGUAGE plpgsql
    AS
    $$
    DECLARE
        _message               TEXT;
        _reporter_name         TEXT;
        _task_name             TEXT;
        _project_id            UUID;
        _message_key           TEXT;
        _message_params        JSONB;
        _notification_type_key TEXT;
    BEGIN
        IF (_reporter_id IS NOT NULL AND _task_id IS NOT NULL AND _user_id IS NOT NULL)
        THEN
            SELECT project_id FROM tasks WHERE id = _task_id INTO _project_id;
            SELECT team_id FROM projects WHERE id = _project_id INTO _team_id;

            INSERT INTO task_updates (type, reporter_id, task_id, user_id, team_id, project_id)
            VALUES (_type, _reporter_id, _task_id, _user_id, _team_id, (SELECT project_id FROM tasks WHERE id = _task_id));

            SELECT name FROM users WHERE id = _reporter_id INTO _reporter_name;
            SELECT name FROM tasks WHERE id = _task_id INTO _task_name;

            IF (_type = 'ASSIGN')
            THEN
                _message = CONCAT('<b>', _reporter_name, '</b> has assigned you in <b>', _task_name, '</b>');
                _message_key = 'notifications.taskAssigned';
                _notification_type_key = 'TASK_ASSIGNMENT';
            ELSE
                _message = CONCAT('<b>', _reporter_name, '</b> has removed you from <b>', _task_name, '</b>');
                _message_key = 'notifications.taskRemoved';
                _notification_type_key = 'TASK_UNASSIGN';
            END IF;

            _message_params = JSONB_BUILD_OBJECT(
                'reporter', _reporter_name,
                'task', _task_name
            );

            PERFORM create_notification(
                _user_id,
                _team_id,
                _task_id,
                _project_id,
                _message,
                _message_key,
                _message_params,
                _notification_type_key
            );

            RETURN JSON_BUILD_OBJECT(
                'receiver_socket_id', (SELECT socket_id FROM users WHERE id = _user_id),
                'team', (SELECT name FROM teams WHERE id = _team_id),
                'team_id', _team_id,
                'project', (SELECT name FROM projects WHERE id = _project_id),
                'project_color', (SELECT color_code FROM projects WHERE id = _project_id),
                'project_id', _project_id,
                'task_id', _task_id,
                'message', _message,
                'message_key', _message_key,
                'message_params', _message_params,
                'notification_type_key', _notification_type_key
            );
        END IF;

        RETURN NULL;
    END
    $$;

    -- 7. Update remove_team_member to use JSONB_BUILD_OBJECT
    CREATE OR REPLACE FUNCTION remove_team_member(_id uuid, _user_id uuid, _team_id uuid) RETURNS JSON
        LANGUAGE plpgsql
    AS
    $$
    DECLARE
        _removed_user_id   UUID;
        _removed_team_name TEXT;
        _message           TEXT;
        _message_key       TEXT;
        _message_params    JSONB;
    BEGIN
        SELECT user_id FROM team_members WHERE id = _id INTO _removed_user_id;
        SELECT name FROM teams WHERE id = _team_id INTO _removed_team_name;

        UPDATE users
        SET active_team = (SELECT id FROM teams WHERE user_id = _removed_user_id LIMIT 1)
        WHERE active_team = _team_id
          AND id = _removed_user_id;

        _message = CONCAT('You have been removed from <b>', (SELECT name FROM teams WHERE id = _team_id), '</b> by <b>',
                   (SELECT name FROM users WHERE id = _user_id), '</b>');
        _message_key = 'notifications.removedFromTeam';
        _message_params = JSONB_BUILD_OBJECT(
            'team', (SELECT name FROM teams WHERE id = _team_id),
            'user', (SELECT name FROM users WHERE id = _user_id)
        );

        PERFORM create_notification(
            _removed_user_id,
            _team_id,
            NULL,
            NULL,
            _message,
            _message_key,
            _message_params,
            'TEAM_MEMBER_REMOVED'
        );

        RETURN JSON_BUILD_OBJECT(
            'user_id', _removed_user_id
        );
    END
    $$;
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
    -- Revert create_project_member to JSON_BUILD_OBJECT
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
        _existing_access_level TEXT;
    BEGIN
        _team_member_id = (_body ->> 'team_member_id')::UUID;
        _team_id = (_body ->> 'team_id')::UUID;
        _project_id = (_body ->> 'project_id')::UUID;
        _user_id = (_body ->> 'user_id')::UUID;
        _access_level = COALESCE(NULLIF(TRIM((_body ->> 'access_level')::TEXT), ''), 'MEMBER');

        IF UPPER(_access_level) IN ('TEAM-LEAD', 'TEAM_LEAD') THEN
            _access_level = 'PROJECT_MANAGER';
        END IF;

        IF UPPER(_access_level) = 'GUEST' THEN
            SELECT DISTINCT pal.key
            INTO _existing_access_level
            FROM project_members pm
            JOIN project_access_levels pal ON pm.project_access_level_id = pal.id
            JOIN projects p ON pm.project_id = p.id
            WHERE pm.team_member_id = _team_member_id
              AND p.team_id = _team_id
              AND pal.key != 'GUEST'
            LIMIT 1;

            IF _existing_access_level IS NOT NULL THEN
                RAISE 'MEMBER_DIFFERENT_ACCESS_LEVEL:%', _existing_access_level;
            END IF;
        END IF;

        IF UPPER(_access_level) != 'GUEST' THEN
            SELECT DISTINCT pal.key
            INTO _existing_access_level
            FROM project_members pm
            JOIN project_access_levels pal ON pm.project_access_level_id = pal.id
            JOIN projects p ON pm.project_id = p.id
            WHERE pm.team_member_id = _team_member_id
              AND p.team_id = _team_id
              AND pal.key = 'GUEST'
            LIMIT 1;

            IF _existing_access_level IS NOT NULL THEN
                RAISE 'MEMBER_DIFFERENT_ACCESS_LEVEL:GUEST';
            END IF;
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
                                   escape_html((SELECT name FROM projects WHERE id = _project_id)),
                                   '</b> by <b>',
                                   escape_html((SELECT name FROM users WHERE id = _user_id)), '</b>');
            PERFORM create_notification(
                    (SELECT user_id FROM team_members WHERE id = _team_member_id),
                    _team_id,
                    NULL,
                    _project_id,
                    _notification,
                    'notifications.addedToProject',
                    JSON_BUILD_OBJECT(
                        'project', (SELECT name FROM projects WHERE id = _project_id),
                        'user', (SELECT name FROM users WHERE id = _user_id)
                    ),
                    'PROJECT_MEMBER_ADDED'
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
