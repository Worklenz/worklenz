'use strict';
// Converted from: database/migrations/20260129000001-add-comment-reactions-and-edit-audit.sql

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Migration: Add comment reactions and edit audit trails
-- Date: 2026-01-29
-- Description: Adds support for emoji reactions on comments and tracks edit history with audit trail

-- Create reactions table
CREATE TABLE IF NOT EXISTS project_comment_reactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    comment_id UUID NOT NULL REFERENCES project_comments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji VARCHAR(10) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT unique_user_emoji_per_comment UNIQUE(comment_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_comment_reactions_comment_id ON project_comment_reactions(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_reactions_user_id ON project_comment_reactions(user_id);

-- Create edit audit trail table
CREATE TABLE IF NOT EXISTS project_comment_edit_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    comment_id UUID NOT NULL REFERENCES project_comments(id) ON DELETE CASCADE,
    previous_content TEXT NOT NULL,
    new_content TEXT NOT NULL,
    edited_by UUID NOT NULL REFERENCES users(id),
    edited_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comment_edit_history_comment_id ON project_comment_edit_history(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_edit_history_edited_at ON project_comment_edit_history(edited_at DESC);

-- Add edit tracking columns to project_comments
ALTER TABLE project_comments
ADD COLUMN IF NOT EXISTS edited BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS edit_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS last_edited_by UUID REFERENCES users(id);

-- Function to get reactions for a comment
CREATE OR REPLACE FUNCTION get_comment_reactions(_comment_id UUID)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
    _reactions JSON;
BEGIN
    SELECT COALESCE(JSON_AGG(reaction_data), '[]'::JSON)
    INTO _reactions
    FROM (
        SELECT 
            emoji,
            COUNT(*)::INTEGER AS count,
            JSON_AGG(JSON_BUILD_OBJECT(
                'user_id', user_id,
                'user_name', (SELECT name FROM users WHERE id = user_id)
            )) AS users
        FROM project_comment_reactions
        WHERE comment_id = _comment_id
        GROUP BY emoji
        ORDER BY COUNT(*) DESC, emoji
    ) AS reaction_data;
    
    RETURN _reactions;
END;
$$;

-- Function to get edit history for a comment
CREATE OR REPLACE FUNCTION get_comment_edit_history(_comment_id UUID)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
    _history JSON;
BEGIN
    SELECT COALESCE(JSON_AGG(edit_data ORDER BY edited_at DESC), '[]'::JSON)
    INTO _history
    FROM (
        SELECT 
            id,
            previous_content,
            new_content,
            edited_by,
            (SELECT name FROM users WHERE id = edited_by) AS edited_by_name,
            edited_at
        FROM project_comment_edit_history
        WHERE comment_id = _comment_id
    ) AS edit_data;
    
    RETURN _history;
END;
$$;

-- Function to add a reaction
CREATE OR REPLACE FUNCTION add_comment_reaction(_comment_id UUID, _user_id UUID, _emoji VARCHAR)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
    _reaction_id UUID;
BEGIN
    -- Insert or do nothing if already exists
    INSERT INTO project_comment_reactions (comment_id, user_id, emoji)
    VALUES (_comment_id, _user_id, _emoji)
    ON CONFLICT (comment_id, user_id, emoji) DO NOTHING
    RETURNING id INTO _reaction_id;
    
    -- Return updated reactions
    RETURN get_comment_reactions(_comment_id);
END;
$$;

-- Function to remove a reaction
CREATE OR REPLACE FUNCTION remove_comment_reaction(_comment_id UUID, _user_id UUID, _emoji VARCHAR)
RETURNS JSON
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM project_comment_reactions
    WHERE comment_id = _comment_id
    AND user_id = _user_id
    AND emoji = _emoji;
    
    -- Return updated reactions
    RETURN get_comment_reactions(_comment_id);
END;
$$;

-- Function to edit a comment with audit trail
CREATE OR REPLACE FUNCTION edit_project_comment(_comment_id UUID, _user_id UUID, _new_content TEXT)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
    _previous_content TEXT;
    _comment_owner UUID;
    _result JSON;
BEGIN
    -- Get current content and owner
    SELECT content, created_by
    INTO _previous_content, _comment_owner
    FROM project_comments
    WHERE id = _comment_id;
    
    -- Check if user is the owner
    IF _comment_owner != _user_id THEN
        RAISE EXCEPTION 'Only the comment owner can edit this comment';
    END IF;
    
    -- Save to edit history
    INSERT INTO project_comment_edit_history (comment_id, previous_content, new_content, edited_by)
    VALUES (_comment_id, _previous_content, _new_content, _user_id);
    
    -- Update the comment
    UPDATE project_comments
    SET 
        content = _new_content,
        edited = TRUE,
        edit_count = COALESCE(edit_count, 0) + 1,
        last_edited_at = NOW(),
        last_edited_by = _user_id,
        updated_at = NOW()
    WHERE id = _comment_id;
    
    -- Return updated comment data
    SELECT JSON_BUILD_OBJECT(
        'id', id,
        'content', content,
        'edited', edited,
        'edit_count', edit_count,
        'last_edited_at', last_edited_at,
        'last_edited_by', last_edited_by,
        'last_edited_by_name', (SELECT name FROM users WHERE id = last_edited_by)
    )
    INTO _result
    FROM project_comments
    WHERE id = _comment_id;
    
    RETURN _result;
END;
$$;

-- Update the existing getByProjectId query to include reactions
-- This will be handled in the controller, but we create a helper function
CREATE OR REPLACE FUNCTION get_project_comments_with_reactions(_project_id UUID)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
    _comments JSON;
BEGIN
    SELECT COALESCE(JSON_AGG(comment_data ORDER BY created_at), '[]'::JSON)
    INTO _comments
    FROM (
        SELECT 
            pc.id,
            pc.content,
            pc.created_by AS user_id,
            u.name AS created_by,
            u.avatar_url,
            pc.created_at,
            pc.updated_at,
            pc.edited,
            pc.edit_count,
            pc.last_edited_at,
            pc.last_edited_by,
            (SELECT name FROM users WHERE id = pc.last_edited_by) AS last_edited_by_name,
            get_comment_reactions(pc.id) AS reactions,
            (SELECT COALESCE(JSON_AGG(rec), '[]'::JSON)
             FROM (SELECT u2.name AS user_name, u2.email AS user_email
                   FROM project_comment_mentions pcm
                   LEFT JOIN users u2 ON pcm.informed_by = u2.id
                   WHERE pcm.comment_id = pc.id) rec) AS mentions
        FROM project_comments pc
        LEFT JOIN users u ON pc.created_by = u.id
        WHERE pc.project_id = _project_id
    ) AS comment_data;
    
    RETURN _comments;
END;
$$;

  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // This migration is a DDL/function change — no automatic rollback defined.
  // Review manually before running migrate:down.
};
