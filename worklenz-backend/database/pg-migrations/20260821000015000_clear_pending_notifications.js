'use strict';
// Converted from database/migrations/20260213000003-clear-pending-notifications.sql

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Clear all pending task_updates before deploying the fix
-- This prevents users from receiving a flood of old notifications when the system restarts

-- Option 1: Delete all pending notifications (RECOMMENDED - clean slate)
-- Use this to completely clear the queue
DELETE FROM task_updates WHERE is_sent = FALSE;

-- Option 2: Mark all as sent (alternative - keeps records but won't send)
-- Uncomment this instead if you want to keep the records for audit purposes
-- UPDATE task_updates SET is_sent = TRUE WHERE is_sent = FALSE;

-- Verify cleanup
DO $$
DECLARE
    pending_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO pending_count FROM task_updates WHERE is_sent = FALSE;
    RAISE NOTICE 'Remaining pending notifications: %', pending_count;
END $$;

  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // Review manually before running migrate:down.
};
