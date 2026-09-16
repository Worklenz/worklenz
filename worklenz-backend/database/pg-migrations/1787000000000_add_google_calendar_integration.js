'use strict';

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS google_calendar_refresh_token TEXT,
      ADD COLUMN IF NOT EXISTS google_calendar_connected_at TIMESTAMP WITH TIME ZONE;

    CREATE TABLE IF NOT EXISTS google_calendar_task_links (
      id UUID DEFAULT uuid_generate_v4() NOT NULL PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      google_event_id TEXT NOT NULL,
      calendar_id TEXT NOT NULL DEFAULT 'primary',
      last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
      UNIQUE (user_id, task_id),
      UNIQUE (user_id, google_event_id)
    );


    CREATE INDEX IF NOT EXISTS google_calendar_task_links_user_id_idx
      ON google_calendar_task_links(user_id);
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS google_calendar_task_links;
    ALTER TABLE users
      DROP COLUMN IF EXISTS google_calendar_refresh_token,
      DROP COLUMN IF EXISTS google_calendar_connected_at;
  `);
};
