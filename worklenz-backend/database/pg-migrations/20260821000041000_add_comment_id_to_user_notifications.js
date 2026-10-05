'use strict';
// Converted from database/migrations/20260709000001-add-comment-id-to-user-notifications.sql

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Add comment_id to user_notifications to support deep-linking to the exact
-- comment that triggered a notification. When a comment notification is created,
-- the comment's ID is stored so the frontend can scroll directly to it.
--
-- Rollback: ALTER TABLE user_notifications DROP COLUMN IF EXISTS comment_id;
--2026/07/09

ALTER TABLE user_notifications
  ADD COLUMN IF NOT EXISTS comment_id UUID REFERENCES task_comments(id) ON DELETE SET NULL;

  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // Review manually before running migrate:down.
};
