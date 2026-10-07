'use strict';

/**
 * Phase 1 — Project-scoped PM elevation foundation.
 *
 * - project_members.finance_access: separable finance rights for PROJECT_MANAGER rows.
 *   Existing PM rows stay FALSE (Phase 0 D7). New Admin assign path sets TRUE via
 *   update_project_manager (template-creator path will force FALSE in Phase 5).
 * - team_members.can_create_projects_from_templates: per-member Owner/Admin toggle (D4).
 */

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    ALTER TABLE project_members
      ADD COLUMN IF NOT EXISTS finance_access BOOLEAN DEFAULT FALSE NOT NULL;

    COMMENT ON COLUMN project_members.finance_access IS
      'When TRUE and access level is PROJECT_MANAGER, the member may view/edit project financial data. Ignored for other access levels. Existing PMs migrate FALSE; Owner/Admin assignment defaults TRUE.';

    ALTER TABLE team_members
      ADD COLUMN IF NOT EXISTS can_create_projects_from_templates BOOLEAN DEFAULT FALSE NOT NULL;

    COMMENT ON COLUMN team_members.can_create_projects_from_templates IS
      'When TRUE, this team member may create projects from templates (not blank projects). Granted by Owner/Admin only.';

    -- Ensure new Admin/Owner PM assignments default finance on (Phase 0 D7).
    CREATE OR REPLACE FUNCTION update_project_manager(_team_member_id uuid, _project_id uuid) RETURNS json
        LANGUAGE plpgsql
    AS
    $$
    DECLARE
        _project_member_id UUID;
        _team_id           UUID;
        _user_id           UUID;
        _project_member    JSON;
    BEGIN
        SELECT id
        FROM project_members
        WHERE team_member_id = _team_member_id
          AND project_id = _project_id
        INTO _project_member_id;

        SELECT team_id FROM team_members WHERE id = _team_member_id INTO _team_id;
        SELECT user_id FROM team_members WHERE id = _team_member_id INTO _user_id;

        IF is_null_or_empty(_project_member_id)
        THEN
            SELECT create_project_member(JSON_BUILD_OBJECT(
                    'team_member_id', _team_member_id,
                    'team_id', _team_id,
                    'project_id', _project_id,
                    'user_id', _user_id,
                    'access_level', 'PROJECT_MANAGER'::TEXT
                ))
            INTO _project_member;

            SELECT id
            FROM project_members
            WHERE team_member_id = _team_member_id
              AND project_id = _project_id
            INTO _project_member_id;
        END IF;

        UPDATE project_members
        SET project_access_level_id = (SELECT id FROM project_access_levels WHERE key = 'PROJECT_MANAGER'),
            finance_access = TRUE
        WHERE id = _project_member_id
          AND project_id = _project_id;

        RETURN JSON_BUILD_OBJECT(
                'project_member_id', _project_member_id,
                'team_member_id', _team_member_id,
                'team_id', _team_id,
                'user_id', _user_id
            );
    END
    $$;
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
    -- Restore prior update_project_manager (no finance_access column).
    CREATE OR REPLACE FUNCTION update_project_manager(_team_member_id uuid, _project_id uuid) RETURNS json
        LANGUAGE plpgsql
    AS
    $$
    DECLARE
        _project_member_id UUID;
        _team_id           UUID;
        _user_id           UUID;
        _project_member    JSON;
    BEGIN
        SELECT id
        FROM project_members
        WHERE team_member_id = _team_member_id
          AND project_id = _project_id
        INTO _project_member_id;

        SELECT team_id FROM team_members WHERE id = _team_member_id INTO _team_id;
        SELECT user_id FROM team_members WHERE id = _team_member_id INTO _user_id;

        IF is_null_or_empty(_project_member_id)
        THEN
            SELECT create_project_member(JSON_BUILD_OBJECT(
                    'team_member_id', _team_member_id,
                    'team_id', _team_id,
                    'project_id', _project_id,
                    'user_id', _user_id,
                    'access_level', 'PROJECT_MANAGER'::TEXT
                ))
            INTO _project_member;
        END IF;

        UPDATE project_members
        SET project_access_level_id = (SELECT id FROM project_access_levels WHERE key = 'PROJECT_MANAGER')
        WHERE id = _project_member_id
          AND project_id = _project_id;

        RETURN JSON_BUILD_OBJECT(
                'project_member_id', _project_member_id,
                'team_member_id', _team_member_id,
                'team_id', _team_id,
                'user_id', _user_id
            );
    END
    $$;

    ALTER TABLE team_members
      DROP COLUMN IF EXISTS can_create_projects_from_templates;

    ALTER TABLE project_members
      DROP COLUMN IF EXISTS finance_access;
  `);
};
