-- ============================================================================
-- Project Comments Improvements Migration
-- ============================================================================
-- This migration includes all improvements for the project comments feature:
-- 1. Add edit tracking columns to project_comments table
-- 2. Create reactions and edit history tables
-- 3. Add escape_html function for XSS prevention
-- 4. Fix create_project_comment function to return proper mentions data
-- 
-- Run this script: psql -U your_user -d your_database -f project-comments-improvements.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- STEP 1: Add edit tracking columns to project_comments table
-- ----------------------------------------------------------------------------
DO $$ 
BEGIN
    -- Add edit tracking columns to project_comments if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='project_comments' AND column_name='edited') THEN
        ALTER TABLE project_comments ADD COLUMN edited BOOLEAN DEFAULT FALSE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='project_comments' AND column_name='edit_count') THEN
        ALTER TABLE project_comments ADD COLUMN edit_count INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='project_comments' AND column_name='last_edited_at') THEN
        ALTER TABLE project_comments ADD COLUMN last_edited_at TIMESTAMP;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='project_comments' AND column_name='last_edited_by') THEN
        ALTER TABLE project_comments ADD COLUMN last_edited_by UUID REFERENCES users(id);
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- STEP 2: Create reactions table
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- STEP 3: Create edit audit trail table
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- STEP 4: Create helper function to get reactions for a comment
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- STEP 5: Create escape_html function for XSS prevention
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION escape_html(_text text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
AS $$
BEGIN
    IF _text IS NULL THEN
        RETURN '';
    END IF;
    
    -- Escape HTML special characters to prevent XSS attacks
    RETURN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
        _text,
        '&', '&amp;'),
        '<', '&lt;'),
        '>', '&gt;'),
        '"', '&quot;'),
        '''', '&#x27;');
END;
$$;

-- ----------------------------------------------------------------------------
-- STEP 6: Fix create_project_comment function
-- ----------------------------------------------------------------------------
-- This function now:
-- - Uses correct variable name (_project_name instead of _task_name)
-- - Returns actual mentions data instead of empty array for real-time updates
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_project_comment(_body json) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _project_id    UUID;
    _created_by    UUID;
    _comment_id    UUID;
    _team_id       UUID;
    _user_name     TEXT;
    _project_name  TEXT;
    _content       TEXT;
    _mention_index INT := 0;
    _mention       JSON;
BEGIN
    _project_id = (_body ->> 'project_id');
    _created_by = (_body ->> 'created_by');
    _content = (_body ->> 'content');
    _team_id = (_body ->> 'team_id');

    SELECT name FROM users WHERE id = _created_by LIMIT 1 INTO _user_name;
    SELECT name FROM projects WHERE id = _project_id INTO _project_name;

    INSERT INTO project_comments (content, created_by, project_id)
    VALUES (_content, _created_by, _project_id)
    RETURNING id INTO _comment_id;

    FOR _mention IN SELECT * FROM JSON_ARRAY_ELEMENTS((_body ->> 'mentions')::JSON)
        LOOP
            INSERT INTO project_comment_mentions (comment_id, mentioned_index, mentioned_by, informed_by)
            VALUES (_comment_id, _mention_index, _created_by, (_mention ->> 'id')::UUID);

            PERFORM create_notification(
                    (SELECT id FROM users WHERE id = (_mention ->> 'id')::UUID),
                    (_team_id)::UUID,
                    null,
                    (_project_id)::UUID,
                    CONCAT('<b>', escape_html(_user_name), '</b> has mentioned you in a comment on <b>', escape_html(_project_name), '</b>')
                );
            _mention_index := _mention_index + 1;

        END LOOP;

    RETURN JSON_BUILD_OBJECT(
            'id', (_comment_id)::UUID,
            'content', (_content)::TEXT,
            'user_id', (_created_by)::UUID,
            'created_by', (_user_name)::TEXT,
            'avatar_url', (SELECT avatar_url FROM users WHERE id = _created_by),
            'created_at', (SELECT created_at FROM project_comments WHERE id = _comment_id),
            'updated_at', (SELECT updated_at FROM project_comments WHERE id = _comment_id),
            'mentions', (SELECT COALESCE(JSON_AGG(rec), '[]'::JSON)
                        FROM (SELECT u.name  AS user_name,
                                     u.email AS user_email
                              FROM project_comment_mentions pcm
                                    LEFT JOIN users u ON pcm.informed_by = u.id
                              WHERE pcm.comment_id = _comment_id) rec),
            'project_name', (_project_name)::TEXT,
            'team_name', (SELECT name FROM teams WHERE id = (_team_id)::UUID)
        );
END
$$;

-- ----------------------------------------------------------------------------
-- Migration Complete
-- ----------------------------------------------------------------------------
SELECT 'Project comments improvements migration applied successfully!' AS status;
