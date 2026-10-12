'use strict';
// Part of the What's New Modal feature (issue #1351 / spec #1361).
// Backs whats-new.service.ts's real dismissal tracking against this table.

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
CREATE TABLE IF NOT EXISTS user_release_dismissals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    release_id VARCHAR(255) NOT NULL,
    dismissed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, release_id)
);

CREATE INDEX IF NOT EXISTS idx_user_release_dismissals_user ON user_release_dismissals(user_id);

COMMENT ON TABLE user_release_dismissals IS
    'Tracks which What''s New release note a user has dismissed. release_id is the release filename slug (see worklenz-backend/release-notes/), not a foreign key, since releases are stored as files rather than database rows.';
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // Not run as part of the initial implementation — review manually before running migrate:down.
};
