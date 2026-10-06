'use strict';
// Part of the What's New Modal feature (issue #1351 / spec #1361).
// Lets a What's New release surface as a real, independent row in
// user_notifications (see whats-new.service.ts's ensureNotificationsForEligibleReleases),
// decoupled from the nav tag's own user_release_dismissals-backed dismissal.

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
ALTER TABLE user_notifications
  ADD COLUMN IF NOT EXISTS release_id VARCHAR(255) DEFAULT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_notifications_user_release_unique
  ON user_notifications(user_id, release_id)
  WHERE release_id IS NOT NULL;

COMMENT ON COLUMN user_notifications.release_id IS
    'Set only for auto-generated What''s New notifications (see whats-new.service.ts). A release filename slug, not a foreign key -- releases are files, not rows. NULL for every regular notification.';
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
DROP INDEX IF EXISTS idx_user_notifications_user_release_unique;
ALTER TABLE user_notifications DROP COLUMN IF EXISTS release_id;
  `);
};
