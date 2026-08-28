/**
 * Home > Inbox — project chat enhancements.
 *
 * - Soft delete for project comments (deleted_at/deleted_by); delete becomes
 *   an UPDATE so other members see a "message deleted" placeholder.
 * - Reply threading (reply_to_id, one level deep).
 * - Pinned messages (pinned_at/pinned_by, shared per-conversation state).
 * - Per-user unread watermark (project_comment_reads).
 * - create_project_comment() learns reply_to_id.
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = async (pgm) => {
  pgm.sql(`
    ALTER TABLE project_comments
      ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS deleted_by  UUID REFERENCES users(id),
      ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES project_comments(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS pinned_at   TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS pinned_by   UUID REFERENCES users(id);

    CREATE INDEX IF NOT EXISTS idx_project_comments_project_created
      ON project_comments (project_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_project_comments_pinned
      ON project_comments (project_id, pinned_at DESC) WHERE pinned_at IS NOT NULL;

    CREATE TABLE IF NOT EXISTS project_comment_reads (
      user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, project_id)
    );

    CREATE OR REPLACE FUNCTION create_project_comment(_body json) RETURNS json
        LANGUAGE plpgsql
    AS
    $$
    DECLARE
        _project_id    UUID;
        _created_by    UUID;
        _comment_id    UUID;
        _team_id       UUID;
        _reply_to_id   UUID;
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
        _reply_to_id = NULLIF((_body ->> 'reply_to_id'), '')::UUID;

        IF _reply_to_id IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM project_comments
            WHERE id = _reply_to_id AND project_id = _project_id
        ) THEN
            _reply_to_id := NULL;
        END IF;

        SELECT name FROM users WHERE id = _created_by LIMIT 1 INTO _user_name;
        SELECT name FROM projects WHERE id = _project_id INTO _project_name;

        INSERT INTO project_comments (content, created_by, project_id, reply_to_id)
        VALUES (_content, _created_by, _project_id, _reply_to_id)
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
                'reply_to_id', (_reply_to_id)::UUID,
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
  `);
};

exports.down = async (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS project_comment_reads;
    DROP INDEX IF EXISTS idx_project_comments_pinned;
    DROP INDEX IF EXISTS idx_project_comments_project_created;

    ALTER TABLE project_comments
      DROP COLUMN IF EXISTS pinned_by,
      DROP COLUMN IF EXISTS pinned_at,
      DROP COLUMN IF EXISTS reply_to_id,
      DROP COLUMN IF EXISTS deleted_by,
      DROP COLUMN IF EXISTS deleted_at;

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
  `);
};
