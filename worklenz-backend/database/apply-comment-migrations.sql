-- Apply missing migrations for project comments
-- Run this script manually: psql -U your_user -d your_database -f apply-comment-migrations.sql

-- Check if columns already exist before adding
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

-- Create reactions table if it doesn't exist
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

-- Create edit audit trail table if it doesn't exist
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

SELECT 'Migration applied successfully!' AS status;
