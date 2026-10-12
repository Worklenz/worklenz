/**
 * Migration: Fix Guest-Member Role Duplication
 * Date: 2026-08-19
 * Description: Enforces bidirectional validation to prevent users from having both Guest and Member access levels
 *              in the same team. Previously, the system only blocked Guests from getting non-Guest roles,
 *              but allowed Members to get Guest roles. This migration adds the reverse check.
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // Update create_project_member function with bidirectional validation
  pgm.sql(`
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
                    _notification
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

exports.down = (pgm) => {
  // This migration updates an existing function. The down migration would be to restore
  // the previous version, but since this is a bugfix, we don't provide a down migration.
  // If needed, restore from the previous migration: 20251216000000-fix-create-project-member-team-lead-access-level.sql
};
