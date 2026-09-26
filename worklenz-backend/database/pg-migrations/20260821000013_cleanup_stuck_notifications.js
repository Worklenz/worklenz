'use strict';
// Converted from database/migrations/20260213000001-cleanup-stuck-notifications.sql

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Cleanup script for stuck task_updates that were caught in the email loop
-- This will reset notifications that failed to send properly

-- Add an index to improve performance of the cron job
CREATE INDEX IF NOT EXISTS idx_task_updates_is_sent_created_at
ON task_updates(is_sent, created_at)
WHERE is_sent = FALSE;

  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // Review manually before running migrate:down.
};
