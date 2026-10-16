'use strict';
// Client Portal v2 Overview: each admin's customised widget layout (order, size, visibility), stored
// per user and workspace so it follows them across browsers and devices. The layout is a small JSON
// document validated by the API; a missing row means "use the default layout".
//
// Also indexes staff mentions so the Overview "Mentions of me" widget does not scan every message.

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    CREATE TABLE IF NOT EXISTS client_portal_overview_layouts (
        id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        team_id    UUID NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
        user_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        layout     JSONB NOT NULL,
        version    INTEGER NOT NULL DEFAULT 1,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT client_portal_overview_layouts_user_team_uindex UNIQUE (team_id, user_id)
    );

    COMMENT ON TABLE client_portal_overview_layouts IS
      'Per-user widget layout of the Client Portal admin Overview: [{ key, size: s|m|l, visible }] in display order.';

    CREATE INDEX IF NOT EXISTS client_portal_thread_messages_mentioned_users_idx
        ON client_portal_thread_messages USING GIN (mentioned_user_ids);
  `);
};

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS client_portal_thread_messages_mentioned_users_idx;
    DROP TABLE IF EXISTS client_portal_overview_layouts;
  `);
};
