'use strict';
// Client Portal v2 (#2510 Portal Projects).
//
// Portal fields live in their own table keyed by project (the spec's recommendation), not as
// columns on projects: the portal switch, the client-facing status / phase / progress / dates /
// contact / summary, private internal notes, and the per-project upload setting. A project with
// no row is simply "portal off" with defaults, so existing projects need no backfill to keep
// working.
//
// Also adds project_client_updates: short free-text "Latest update" posts every client user on
// the project sees.
//
// Cutover continuity (plan assumption A3). Without it every existing portal customer would open
// an empty portal on day one:
//   - projects already linked to a portal-enabled client get portal_enabled = TRUE
//   - contacts that had no project rows used to see every project of their client (the v1 client
//     API scoped by company), so they are assigned to all of those projects
//   - NO task, file or milestone is shared: items are Internal Only until staff share them

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS project_client_settings (
        project_id                UUID                     PRIMARY KEY REFERENCES projects (id) ON DELETE CASCADE,
        team_id                   UUID                     NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
        portal_enabled            BOOLEAN                  NOT NULL DEFAULT FALSE,
        client_status             TEXT                     NOT NULL DEFAULT 'on_track',
        current_phase             TEXT,
        progress_source           TEXT                     NOT NULL DEFAULT 'worklenz',
        manual_progress           SMALLINT,
        start_date                DATE,
        expected_completion       DATE,
        primary_contact_member_id UUID                     REFERENCES team_members (id) ON DELETE SET NULL,
        client_summary            TEXT                     NOT NULL DEFAULT '',
        internal_notes            TEXT                     NOT NULL DEFAULT '',
        allow_client_uploads      BOOLEAN                  NOT NULL DEFAULT TRUE,
        created_at                TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at                TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT project_client_settings_status_check
            CHECK (client_status IN ('on_track', 'at_risk', 'on_hold', 'completed')),
        CONSTRAINT project_client_settings_phase_check
            CHECK (current_phase IS NULL OR current_phase IN ('Discovery', 'Design', 'Development', 'UAT', 'Deployment')),
        CONSTRAINT project_client_settings_progress_source_check
            CHECK (progress_source IN ('worklenz', 'manual')),
        CONSTRAINT project_client_settings_manual_progress_check
            CHECK (
                (progress_source = 'worklenz' AND manual_progress IS NULL)
                OR (progress_source = 'manual' AND manual_progress BETWEEN 0 AND 100)
            )
    );

    CREATE INDEX IF NOT EXISTS idx_project_client_settings_team_portal
        ON project_client_settings (team_id, portal_enabled);

    CREATE TABLE IF NOT EXISTS project_client_updates (
        id              UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
        project_id      UUID                     NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
        team_id         UUID                     NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
        author_user_id  UUID                     REFERENCES users (id) ON DELETE SET NULL,
        author_name     TEXT                     NOT NULL,
        body            TEXT                     NOT NULL,
        published_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT project_client_updates_body_check CHECK (char_length(body) BETWEEN 1 AND 2000)
    );

    CREATE INDEX IF NOT EXISTS idx_project_client_updates_project
        ON project_client_updates (project_id, published_at DESC);

    COMMENT ON TABLE project_client_settings IS
      'Client Portal v2 per-project portal fields. No row = portal off with defaults. internal_notes is never part of any client payload.';
    COMMENT ON TABLE project_client_updates IS
      'Short "Latest update" posts published to every client user on the project. Not editable or retractable in v1.';

    -- Cutover continuity (A3): keep projects that are already visible to a portal-enabled client on.
    INSERT INTO project_client_settings (
        project_id, team_id, portal_enabled, client_status, progress_source,
        start_date, expected_completion, allow_client_uploads
    )
    SELECT p.id, p.team_id, TRUE, 'on_track', 'worklenz',
           p.start_date::date, p.end_date::date, TRUE
      FROM projects p
      JOIN clients c ON c.id = p.client_id
     WHERE c.client_portal_enabled IS TRUE
       AND c.deleted_at IS NULL
    ON CONFLICT (project_id) DO NOTHING;

    -- Contacts with no project rows used to see all of their client's projects (company-wide scope).
    -- Assign them to those projects so they keep seeing them; nothing inside is shared.
    INSERT INTO client_contact_project_access (client_contact_id, project_id, permission_level)
    SELECT cc.id, p.id, NULL
      FROM client_contacts cc
      JOIN projects p
        ON p.client_id = cc.client_id
       AND p.team_id = cc.team_id
      JOIN project_client_settings pcs
        ON pcs.project_id = p.id
       AND pcs.portal_enabled
     WHERE NOT EXISTS (
             SELECT 1 FROM client_contact_project_access a WHERE a.client_contact_id = cc.id
           )
    ON CONFLICT (client_contact_id, project_id) DO NOTHING;
  `);
};

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  // Project assignments are left in place: they are valid v1 data too, and the down of
  // 1791298000000 turns their null permission_level back into 'view' before restoring NOT NULL.
  pgm.sql(`
    DROP TABLE IF EXISTS project_client_updates;
    DROP TABLE IF EXISTS project_client_settings;
  `);
};
