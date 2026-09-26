'use strict';
// Converted from database/migrations/20260430000000-add-multiple-reaction-types.sql

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Migration: Add multiple reaction types for task comments
-- Date: 2026-04-30
-- Description: Extends REACTION_TYPES enum to support emoji reactions beyond just 'like'

-- Add new reaction types to the enum
ALTER TYPE REACTION_TYPES ADD VALUE IF NOT EXISTS 'love';
ALTER TYPE REACTION_TYPES ADD VALUE IF NOT EXISTS 'celebrate';
ALTER TYPE REACTION_TYPES ADD VALUE IF NOT EXISTS 'support';
ALTER TYPE REACTION_TYPES ADD VALUE IF NOT EXISTS 'insightful';
ALTER TYPE REACTION_TYPES ADD VALUE IF NOT EXISTS 'curious';

-- Deduplicate existing reactions so unique constraint creation succeeds
DELETE FROM task_comment_reactions a USING task_comment_reactions b
WHERE a.ctid < b.ctid
  AND a.comment_id = b.comment_id
  AND a.team_member_id = b.team_member_id;

-- Add a unique constraint to prevent duplicate reactions from the same user
-- A user can only have one reaction type per comment
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'task_comment_reactions_unique_user_comment') THEN
    ALTER TABLE task_comment_reactions ADD CONSTRAINT task_comment_reactions_unique_user_comment UNIQUE (comment_id, team_member_id);
  END IF;
END $$;

-- Create an index for faster reaction queries
CREATE INDEX IF NOT EXISTS idx_task_comment_reactions_comment_type
    ON task_comment_reactions (comment_id, reaction_type);

  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // Review manually before running migrate:down.
};
