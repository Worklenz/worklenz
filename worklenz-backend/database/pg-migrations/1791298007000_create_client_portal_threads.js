'use strict';
// Client Portal v2 (#2505 Discussions).
//
// Project communication attached to the thing it is about: the project in general, a Client
// Visible task, a Client Visible file, or an approval. Each thread mixes client-visible replies and
// internal comments, strictly separated per message:
//   - an internal comment is never returned by any client-facing API
//   - a mention exists only on a client-visible message (enforced here by a CHECK as well as in
//     the service), and only for client users on the project
//   - a client user can only write client-visible messages
//
// "Hidden from the client" is NOT stored: it is derived at read time from the linked task / file's
// visibility, so switching the item back to Client Visible restores the thread.
//
// Unread is tracked per staff user (client_portal_thread_reads) rather than per thread, so each
// staff member has their own read state.

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS client_portal_threads (
        id                   UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_team_id UUID                     NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
        client_id            UUID                     NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
        project_id           UUID                     NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
        context_type         TEXT                     NOT NULL,
        context_task_id      UUID                     REFERENCES tasks (id) ON DELETE CASCADE,
        context_file_id      UUID                     REFERENCES project_files (id) ON DELETE CASCADE,
        context_approval_id  UUID                     REFERENCES client_portal_approvals (id) ON DELETE CASCADE,
        created_by_user_id   UUID                     REFERENCES users (id) ON DELETE SET NULL,
        created_by_contact_id UUID                    REFERENCES client_contacts (id) ON DELETE SET NULL,
        last_message_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT client_portal_threads_context_type_check
            CHECK (context_type IN ('project', 'task', 'file', 'approval')),
        CONSTRAINT client_portal_threads_context_target_check
            CHECK (
                (context_type = 'project'  AND context_task_id IS NULL     AND context_file_id IS NULL     AND context_approval_id IS NULL)
             OR (context_type = 'task'     AND context_task_id IS NOT NULL AND context_file_id IS NULL     AND context_approval_id IS NULL)
             OR (context_type = 'file'     AND context_task_id IS NULL     AND context_file_id IS NOT NULL AND context_approval_id IS NULL)
             OR (context_type = 'approval' AND context_task_id IS NULL     AND context_file_id IS NULL     AND context_approval_id IS NOT NULL)
            )
    );

    -- One thread per context.
    CREATE UNIQUE INDEX IF NOT EXISTS client_portal_threads_project_uindex
        ON client_portal_threads (project_id) WHERE context_type = 'project';
    CREATE UNIQUE INDEX IF NOT EXISTS client_portal_threads_task_uindex
        ON client_portal_threads (context_task_id) WHERE context_task_id IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS client_portal_threads_file_uindex
        ON client_portal_threads (context_file_id) WHERE context_file_id IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS client_portal_threads_approval_uindex
        ON client_portal_threads (context_approval_id) WHERE context_approval_id IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_client_portal_threads_org_last_message
        ON client_portal_threads (organization_team_id, last_message_at DESC);
    CREATE INDEX IF NOT EXISTS idx_client_portal_threads_project
        ON client_portal_threads (project_id, last_message_at DESC);

    CREATE TABLE IF NOT EXISTS client_portal_thread_messages (
        id                    UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
        thread_id             UUID                     NOT NULL REFERENCES client_portal_threads (id) ON DELETE CASCADE,
        visibility            TEXT                     NOT NULL,
        author_side           TEXT                     NOT NULL,
        author_user_id        UUID                     REFERENCES users (id) ON DELETE SET NULL,
        author_contact_id     UUID                     REFERENCES client_contacts (id) ON DELETE SET NULL,
        author_name           TEXT                     NOT NULL,
        body                  TEXT                     NOT NULL,
        mentioned_contact_ids UUID[]                   NOT NULL DEFAULT '{}',
        created_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT client_portal_thread_messages_visibility_check CHECK (visibility IN ('client', 'internal')),
        CONSTRAINT client_portal_thread_messages_side_check CHECK (author_side IN ('client', 'internal')),
        CONSTRAINT client_portal_thread_messages_body_check CHECK (char_length(body) BETWEEN 1 AND 5000),
        -- A mention exists only on a client-visible message.
        CONSTRAINT client_portal_thread_messages_mention_check
            CHECK (visibility = 'client' OR cardinality(mentioned_contact_ids) = 0),
        -- A client user can only write client-visible messages.
        CONSTRAINT client_portal_thread_messages_client_author_check
            CHECK (author_side = 'internal' OR visibility = 'client')
    );

    CREATE INDEX IF NOT EXISTS idx_client_portal_thread_messages_thread
        ON client_portal_thread_messages (thread_id, created_at);

    CREATE TABLE IF NOT EXISTS client_portal_thread_reads (
        thread_id    UUID                     NOT NULL REFERENCES client_portal_threads (id) ON DELETE CASCADE,
        user_id      UUID                     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        last_read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (thread_id, user_id)
    );

    COMMENT ON TABLE client_portal_threads IS
      'Client Portal v2 discussion threads, one per context (project, task, file or approval). Hidden-from-client is derived, not stored.';
    COMMENT ON TABLE client_portal_thread_messages IS
      'Messages. visibility=internal rows are never returned by any client-facing API and cannot carry mentions.';
  `);
};

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS client_portal_thread_reads;
    DROP TABLE IF EXISTS client_portal_thread_messages;
    DROP TABLE IF EXISTS client_portal_threads;
  `);
};
