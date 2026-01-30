-- Fix create_project_comment function to use correct variable name
-- Run this script: psql -U your_user -d your_database -f fix-project-comment-function.sql

-- Ensure escape_html function exists
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

-- Fix create_project_comment function
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

SELECT 'Function fixed successfully!' AS status;
