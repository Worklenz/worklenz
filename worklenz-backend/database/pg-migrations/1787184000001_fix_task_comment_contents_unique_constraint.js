'use strict';

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Migration: Add missing unique constraint on task_comment_contents.comment_id
-- Date: 2026-08-20
-- Description: Editing a task comment fails with "Unknown error has occurred." because
--              TaskCommentsController.update() upserts via ON CONFLICT (comment_id), which
--              requires a unique/exclusion constraint that was never created (issue #2110).

-- Defensive cleanup: collapse any duplicate content rows per comment_id, in case
-- the pre-2026-07-13 check-then-insert code ever raced and produced duplicates.
DELETE FROM task_comment_contents a
USING task_comment_contents b
WHERE a.comment_id = b.comment_id
  AND a.ctid < b.ctid;

ALTER TABLE task_comment_contents
    DROP CONSTRAINT IF EXISTS task_comment_contents_comment_id_uk;

ALTER TABLE task_comment_contents
    ADD CONSTRAINT task_comment_contents_comment_id_uk UNIQUE (comment_id);

  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // Historical SQL migration: no automatic rollback is available.
};
