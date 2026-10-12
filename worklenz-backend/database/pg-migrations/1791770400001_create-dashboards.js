'use strict';
// Reporting & Analytics > Custom Dashboards (spec: Worklenz/worklenz-business#2558).
//
//   dashboards   one row per user-created dashboard: name, owner, who can see it, and the
//                dashboard-level filters (project scope, date range, auto-refresh interval) that
//                cascade as defaults to every gadget on it. The gadgets themselves live in
//                dashboard_gadgets (next migration), which is also the layout, so there is no
//                separate layout column here.
//
// Visibility tiers (spec): private (default) | workspace | role | link.
//   - role requires at least one entry in visible_roles.
//   - link requires a share_token; opening a link still requires a signed-in member of the same
//     team, so the token is a pointer, not a credential for anonymous access.
// What a viewer can see inside a dashboard is never decided by this table: every gadget query is
// scoped server-side to the projects the requesting user can access.

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    CREATE TABLE IF NOT EXISTS dashboards (
      id            UUID                     NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
      team_id       UUID                     NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
      owner_id      UUID                     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      name          TEXT                     NOT NULL,
      description   TEXT,
      visibility    TEXT                     NOT NULL DEFAULT 'private',
      -- Role names are validated by the API against the roles that exist, not here, so adding a
      -- role does not need a migration.
      visible_roles TEXT[]                   NOT NULL DEFAULT '{}',
      share_token   TEXT,
      filters       JSONB                    NOT NULL DEFAULT '{}'::jsonb,
      created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT dashboards_name_length_check
        CHECK (CHAR_LENGTH(TRIM(name)) BETWEEN 1 AND 100),
      CONSTRAINT dashboards_visibility_check
        CHECK (visibility IN ('private', 'workspace', 'role', 'link')),
      CONSTRAINT dashboards_role_visibility_check
        CHECK (visibility <> 'role' OR CARDINALITY(visible_roles) > 0),
      CONSTRAINT dashboards_link_visibility_check
        CHECK (visibility <> 'link' OR share_token IS NOT NULL),
      CONSTRAINT dashboards_filters_is_object CHECK (jsonb_typeof(filters) = 'object'),
      CONSTRAINT dashboards_share_token_key UNIQUE (share_token)
    );

    -- "My dashboards" and the ON DELETE CASCADE from users.
    CREATE INDEX IF NOT EXISTS idx_dashboards_owner_id
      ON dashboards (owner_id);

    -- Listing what a team member can see: their own plus the shared ones in the team.
    CREATE INDEX IF NOT EXISTS idx_dashboards_team_visibility
      ON dashboards (team_id, visibility);

    COMMENT ON TABLE dashboards IS
      'Reporting & Analytics custom dashboards. Gadgets (and therefore layout) are in dashboard_gadgets.';
    COMMENT ON COLUMN dashboards.visibility IS
      'private (owner only) | workspace (whole team, read-only) | role (listed roles, read-only) | link (anyone signed in to the team who has the link, read-only).';
    COMMENT ON COLUMN dashboards.filters IS
      'Dashboard-level defaults cascaded to gadgets: project scope, date range, auto-refresh interval. Shape is validated by the API.';
  `);
};

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_dashboards_team_visibility;
    DROP INDEX IF EXISTS idx_dashboards_owner_id;
    DROP TABLE IF EXISTS dashboards;
  `);
};
