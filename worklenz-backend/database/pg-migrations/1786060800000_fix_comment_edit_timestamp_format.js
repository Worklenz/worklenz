'use strict';
// Converted from: database/migrations/20260810000001-fix-comment-edit-timestamp-format.sql

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
    pgm.sql(`
-- Migration: Fix timestamp format in edit_project_comment function
-- Date: 2026-08-10
-- Description: Fixes the timestamp format returned by edit_project_comment to ensure
--              proper JavaScript Date parsing. This resolves the bug where edited comments
--              showed incorrect relative time (e.g., "Edited 6 hours ago" immediately after editing).

-- Fix: Add ::TEXT cast to last_edited_at in the function return value
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
    
    -- Return updated comment data with properly formatted timestamp
    SELECT JSON_BUILD_OBJECT(
        'id', id,
        'content', content,
        'edited', edited,
        'edit_count', edit_count,
        'last_edited_at', last_edited_at::TEXT,  -- FIX: Cast to TEXT for proper JS parsing
        'last_edited_by', last_edited_by,
        'last_edited_by_name', (SELECT name FROM users WHERE id = last_edited_by)
    )
    INTO _result
    FROM project_comments
    WHERE id = _comment_id;
    
    RETURN _result;
END;
$$;
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
    // This migration is a DDL/function change — no automatic rollback defined.
    // Review manually before running migrate:down.
};
