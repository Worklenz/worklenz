-- Migration: Add multiple reaction types for task comments
-- Date: 2026-04-30
-- Description: Extends REACTION_TYPES enum to support emoji reactions beyond just 'like'

-- Add new reaction types to the enum
ALTER TYPE REACTION_TYPES ADD VALUE IF NOT EXISTS 'love';
ALTER TYPE REACTION_TYPES ADD VALUE IF NOT EXISTS 'celebrate';
ALTER TYPE REACTION_TYPES ADD VALUE IF NOT EXISTS 'support';
ALTER TYPE REACTION_TYPES ADD VALUE IF NOT EXISTS 'insightful';
ALTER TYPE REACTION_TYPES ADD VALUE IF NOT EXISTS 'curious';

-- Add a unique constraint to prevent duplicate reactions from the same user
-- A user can only have one reaction type per comment
ALTER TABLE task_comment_reactions
    DROP CONSTRAINT IF EXISTS task_comment_reactions_unique_user_comment;

ALTER TABLE task_comment_reactions
    ADD CONSTRAINT task_comment_reactions_unique_user_comment
        UNIQUE (comment_id, team_member_id);

-- Create an index for faster reaction queries
CREATE INDEX IF NOT EXISTS idx_task_comment_reactions_comment_type
    ON task_comment_reactions (comment_id, reaction_type);
