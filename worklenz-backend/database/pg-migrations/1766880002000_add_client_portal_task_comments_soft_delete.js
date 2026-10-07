'use strict';

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/**
 * client_portal_task_comments.deleted_at exists in released databases but was never added by a
 * public migration. Idempotent: a no-op where it already exists.
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = async (pgm) => {
  pgm.sql(`
ALTER TABLE client_portal_task_comments ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;
CREATE INDEX IF NOT EXISTS idx_client_portal_task_comments_deleted_at ON client_portal_task_comments USING btree (deleted_at);
  `);
};

exports.down = async (_pgm) => {};
