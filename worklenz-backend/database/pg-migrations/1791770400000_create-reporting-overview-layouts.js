'use strict';
// Reports > Overview: each user's customised widget layout (position, size, visibility), stored
// per user and team so it follows them across browsers and devices.
//
//   reporting_overview_layouts   one row per (team, user). No row means the user never customised:
//                                the app renders its default layout. The layout is a display
//                                preference only; what data a widget can show is still decided per
//                                request by the reporting endpoints' own permission checks.
//
// The JSON document is validated by the API on every save (known widget keys, no duplicates,
// geometry inside the 12-column grid), so it is deliberately not constrained further here beyond
// "is a JSON object". `version` lets the app discard a layout shape it can no longer read.

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    CREATE TABLE IF NOT EXISTS reporting_overview_layouts (
      id         UUID                     NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
      team_id    UUID                     NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
      user_id    UUID                     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      layout     JSONB                    NOT NULL,
      version    INTEGER                  NOT NULL DEFAULT 1,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT reporting_overview_layouts_team_user_key UNIQUE (team_id, user_id),
      CONSTRAINT reporting_overview_layouts_layout_is_object CHECK (jsonb_typeof(layout) = 'object')
    );

    -- The unique constraint above serves (team_id, user_id) lookups; this one serves the
    -- ON DELETE CASCADE from users, which filters on user_id alone.
    CREATE INDEX IF NOT EXISTS idx_reporting_overview_layouts_user_id
      ON reporting_overview_layouts (user_id);

    COMMENT ON TABLE reporting_overview_layouts IS
      'Per user and team: customised Reports > Overview widget layout (positions, sizes, visibility). No row = default layout. Display preference only; never grants access.';
    COMMENT ON COLUMN reporting_overview_layouts.layout IS
      'JSON object { version: 1, widgets: [{ key, x, y, w, h, hidden }] } on a 12-column grid. Shape is validated by the API.';
    COMMENT ON COLUMN reporting_overview_layouts.version IS
      'Layout schema version; a layout written by a newer version is ignored by older code rather than guessed at.';
  `);
};

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_reporting_overview_layouts_user_id;
    DROP TABLE IF EXISTS reporting_overview_layouts;
  `);
};
