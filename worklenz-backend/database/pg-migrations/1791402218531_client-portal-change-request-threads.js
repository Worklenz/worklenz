'use strict';
// Client Portal v2 discussions: change requests become a fifth thread context, so a change request's
// responses and replies show up in the Discussions inbox next to project, task, file and approval threads.
//
// A thread for a change request is client-visible by nature (the request is always visible to the client
// who raised it), so there is no "hidden from client" state for it. One thread per change request.
//
// Change requests that already have messages get a thread with those messages copied in, so existing
// conversations appear in Discussions too. A team message becomes an internal-side, client-visible message.

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    ALTER TABLE client_portal_threads
        ADD COLUMN IF NOT EXISTS context_change_request_id UUID
            REFERENCES client_portal_change_requests (id) ON DELETE CASCADE;

    ALTER TABLE client_portal_threads DROP CONSTRAINT IF EXISTS client_portal_threads_context_type_check;
    ALTER TABLE client_portal_threads DROP CONSTRAINT IF EXISTS client_portal_threads_context_target_check;

    ALTER TABLE client_portal_threads
        ADD CONSTRAINT client_portal_threads_context_type_check
            CHECK (context_type IN ('project', 'task', 'file', 'approval', 'change_request')),
        ADD CONSTRAINT client_portal_threads_context_target_check
            CHECK (
                (context_type = 'project'        AND context_task_id IS NULL     AND context_file_id IS NULL     AND context_approval_id IS NULL     AND context_change_request_id IS NULL)
             OR (context_type = 'task'           AND context_task_id IS NOT NULL AND context_file_id IS NULL     AND context_approval_id IS NULL     AND context_change_request_id IS NULL)
             OR (context_type = 'file'           AND context_task_id IS NULL     AND context_file_id IS NOT NULL AND context_approval_id IS NULL     AND context_change_request_id IS NULL)
             OR (context_type = 'approval'       AND context_task_id IS NULL     AND context_file_id IS NULL     AND context_approval_id IS NOT NULL AND context_change_request_id IS NULL)
             OR (context_type = 'change_request' AND context_task_id IS NULL     AND context_file_id IS NULL     AND context_approval_id IS NULL     AND context_change_request_id IS NOT NULL)
            );

    -- One thread per change request.
    CREATE UNIQUE INDEX IF NOT EXISTS client_portal_threads_change_request_uindex
        ON client_portal_threads (context_change_request_id) WHERE context_change_request_id IS NOT NULL;

    -- Threads for change requests that already have a conversation.
    INSERT INTO client_portal_threads
        (organization_team_id, client_id, project_id, context_type, context_change_request_id, last_message_at, created_at)
    SELECT r.organization_team_id, r.client_id, r.project_id, 'change_request', r.id, MAX(m.created_at), MIN(m.created_at)
      FROM client_portal_change_requests r
      JOIN client_portal_change_request_messages m ON m.change_request_id = r.id
     WHERE NOT EXISTS (SELECT 1 FROM client_portal_threads t WHERE t.context_change_request_id = r.id)
     GROUP BY r.id
     ORDER BY MIN(m.created_at);

    INSERT INTO client_portal_thread_messages
        (thread_id, visibility, author_side, author_user_id, author_contact_id, author_name, body, created_at)
    SELECT t.id, 'client', CASE m.from_side WHEN 'team' THEN 'internal' ELSE 'client' END,
           m.author_user_id, m.author_contact_id, m.author_name, m.body, m.created_at
      FROM client_portal_change_request_messages m
      JOIN client_portal_threads t ON t.context_change_request_id = m.change_request_id
     WHERE NOT EXISTS (SELECT 1 FROM client_portal_thread_messages x WHERE x.thread_id = t.id)
     ORDER BY m.created_at;

    -- History is not news: mark the copied conversations read for current staff so the unread badge
    -- does not jump by every old client reply.
    INSERT INTO client_portal_thread_reads (thread_id, user_id)
    SELECT DISTINCT t.id, tm.user_id
      FROM client_portal_threads t
      JOIN team_members tm ON tm.team_id = t.organization_team_id
     WHERE t.context_type = 'change_request' AND tm.user_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM client_portal_thread_reads r WHERE r.thread_id = t.id)
    ON CONFLICT DO NOTHING;

    COMMENT ON COLUMN client_portal_threads.context_change_request_id IS
      'Set when context_type = change_request: the change request this thread mirrors.';
  `);
};

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
    DELETE FROM client_portal_threads WHERE context_type = 'change_request';

    DROP INDEX IF EXISTS client_portal_threads_change_request_uindex;
    ALTER TABLE client_portal_threads DROP CONSTRAINT IF EXISTS client_portal_threads_context_target_check;
    ALTER TABLE client_portal_threads DROP CONSTRAINT IF EXISTS client_portal_threads_context_type_check;
    ALTER TABLE client_portal_threads DROP COLUMN IF EXISTS context_change_request_id;

    ALTER TABLE client_portal_threads
        ADD CONSTRAINT client_portal_threads_context_type_check
            CHECK (context_type IN ('project', 'task', 'file', 'approval')),
        ADD CONSTRAINT client_portal_threads_context_target_check
            CHECK (
                (context_type = 'project'  AND context_task_id IS NULL     AND context_file_id IS NULL     AND context_approval_id IS NULL)
             OR (context_type = 'task'     AND context_task_id IS NOT NULL AND context_file_id IS NULL     AND context_approval_id IS NULL)
             OR (context_type = 'file'     AND context_task_id IS NULL     AND context_file_id IS NOT NULL AND context_approval_id IS NULL)
             OR (context_type = 'approval' AND context_task_id IS NULL     AND context_file_id IS NULL     AND context_approval_id IS NOT NULL)
            );
  `);
};
