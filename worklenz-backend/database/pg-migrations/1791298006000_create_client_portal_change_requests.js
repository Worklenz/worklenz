'use strict';
// Client Portal v2 (#2502 Change Requests, #2515 Quotes & Invoices link).
//
// Formal scope or feature changes a client asks for inside a project, replacing the v1 service
// catalog "Requests" queue. Submitting never creates a task (spec section 12); an approved
// request is converted to work explicitly, either by creating a task or linking an existing one.
//
//   estimate_hours / estimate_cost are NULLABLE: a blank stays blank and the client never sees 0
//   unless staff enter 0.
//   internal_assessment and assignee are never part of any client payload.
//   The unique partial index on linked_task_id means an existing task links to ONE change request.
//
// Quotes and invoices used to point at a v1 service request. They keep that legacy column (read-only
// history) and gain change_request_id; both are nullable, and no automatic remap of old rows is
// attempted because the spec defines none.

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS client_portal_change_request_sequences (
        organization_team_id UUID                     PRIMARY KEY REFERENCES teams (id) ON DELETE CASCADE,
        last_number          INTEGER                  NOT NULL DEFAULT 0,
        updated_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS client_portal_change_requests (
        id                      UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
        cr_no                   TEXT                     NOT NULL,
        organization_team_id    UUID                     NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
        client_id               UUID                     NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
        project_id              UUID                     NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
        title                   TEXT                     NOT NULL,
        description             TEXT                     NOT NULL,
        notes                   TEXT                     NOT NULL DEFAULT '',
        priority                TEXT                     NOT NULL DEFAULT 'medium',
        requester_contact_id    UUID                     REFERENCES client_contacts (id) ON DELETE SET NULL,
        requester_name          TEXT                     NOT NULL,
        status                  TEXT                     NOT NULL DEFAULT 'submitted',
        assignee_team_member_id UUID                     REFERENCES team_members (id) ON DELETE SET NULL,
        estimate_hours          NUMERIC(8, 2),
        estimate_cost           NUMERIC(12, 2),
        response                TEXT                     NOT NULL DEFAULT '',
        internal_assessment     TEXT                     NOT NULL DEFAULT '',
        linked_task_id          UUID                     REFERENCES tasks (id) ON DELETE SET NULL,
        linked_task_key         TEXT,
        linked_task_mode        TEXT,
        submitted_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        closed_at               TIMESTAMP WITH TIME ZONE,
        created_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT client_portal_change_requests_org_cr_no_key UNIQUE (organization_team_id, cr_no),
        CONSTRAINT client_portal_change_requests_title_check CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),
        CONSTRAINT client_portal_change_requests_priority_check CHECK (priority IN ('low', 'medium', 'high')),
        CONSTRAINT client_portal_change_requests_status_check
            CHECK (status IN ('submitted', 'under_review', 'more_info', 'approved', 'rejected',
                              'in_progress', 'completed', 'cancelled')),
        CONSTRAINT client_portal_change_requests_estimate_hours_check
            CHECK (estimate_hours IS NULL OR estimate_hours >= 0),
        CONSTRAINT client_portal_change_requests_estimate_cost_check
            CHECK (estimate_cost IS NULL OR estimate_cost >= 0),
        CONSTRAINT client_portal_change_requests_linked_task_mode_check
            CHECK (linked_task_mode IS NULL OR linked_task_mode IN ('created', 'linked'))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS client_portal_change_requests_linked_task_uindex
        ON client_portal_change_requests (linked_task_id) WHERE linked_task_id IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_client_portal_change_requests_org_status
        ON client_portal_change_requests (organization_team_id, status);

    CREATE INDEX IF NOT EXISTS idx_client_portal_change_requests_client
        ON client_portal_change_requests (client_id, submitted_at DESC);

    CREATE INDEX IF NOT EXISTS idx_client_portal_change_requests_project
        ON client_portal_change_requests (project_id);

    CREATE TABLE IF NOT EXISTS client_portal_change_request_messages (
        id                UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
        change_request_id UUID                     NOT NULL REFERENCES client_portal_change_requests (id) ON DELETE CASCADE,
        from_side         TEXT                     NOT NULL,
        author_user_id    UUID                     REFERENCES users (id) ON DELETE SET NULL,
        author_contact_id UUID                     REFERENCES client_contacts (id) ON DELETE SET NULL,
        author_name       TEXT                     NOT NULL,
        body              TEXT                     NOT NULL,
        created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT client_portal_change_request_messages_side_check CHECK (from_side IN ('client', 'team')),
        CONSTRAINT client_portal_change_request_messages_body_check CHECK (char_length(body) BETWEEN 1 AND 5000)
    );

    CREATE INDEX IF NOT EXISTS idx_client_portal_change_request_messages_cr
        ON client_portal_change_request_messages (change_request_id, created_at);

    CREATE TABLE IF NOT EXISTS client_portal_change_request_events (
        id                UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
        change_request_id UUID                     NOT NULL REFERENCES client_portal_change_requests (id) ON DELETE CASCADE,
        actor_side        TEXT                     NOT NULL,
        actor_name        TEXT                     NOT NULL,
        text              TEXT                     NOT NULL,
        created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT client_portal_change_request_events_side_check CHECK (actor_side IN ('client', 'internal'))
    );

    CREATE INDEX IF NOT EXISTS idx_client_portal_change_request_events_cr
        ON client_portal_change_request_events (change_request_id, created_at);

    CREATE TABLE IF NOT EXISTS client_portal_change_request_attachments (
        id                UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
        change_request_id UUID                     NOT NULL REFERENCES client_portal_change_requests (id) ON DELETE CASCADE,
        file_name         TEXT                     NOT NULL,
        storage_key       TEXT,
        size              BIGINT                   NOT NULL DEFAULT 0,
        created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_client_portal_change_request_attachments_cr
        ON client_portal_change_request_attachments (change_request_id);

    -- Quotes and invoices link to a change request instead of a v1 service request.
    ALTER TABLE client_portal_quotes
        ADD COLUMN IF NOT EXISTS change_request_id UUID
            REFERENCES client_portal_change_requests (id) ON DELETE SET NULL;

    ALTER TABLE client_portal_invoices
        ADD COLUMN IF NOT EXISTS change_request_id UUID
            REFERENCES client_portal_change_requests (id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_client_portal_quotes_change_request
        ON client_portal_quotes (change_request_id) WHERE change_request_id IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_client_portal_invoices_change_request
        ON client_portal_invoices (change_request_id) WHERE change_request_id IS NOT NULL;

    COMMENT ON COLUMN client_portal_quotes.request_id IS
      'Legacy v1 service request. Read-only history; v2 documents link change_request_id instead.';
    COMMENT ON COLUMN client_portal_invoices.request_id IS
      'Legacy v1 service request. Read-only history; v2 documents link change_request_id instead.';
    COMMENT ON TABLE client_portal_change_requests IS
      'Client Portal v2 change requests. Submitting never creates a task. estimate_* are nullable; internal_assessment and the assignee never reach a client.';
  `);
};

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_client_portal_invoices_change_request;
    DROP INDEX IF EXISTS idx_client_portal_quotes_change_request;

    ALTER TABLE client_portal_invoices DROP COLUMN IF EXISTS change_request_id;
    ALTER TABLE client_portal_quotes DROP COLUMN IF EXISTS change_request_id;

    COMMENT ON COLUMN client_portal_invoices.request_id IS NULL;
    COMMENT ON COLUMN client_portal_quotes.request_id IS NULL;

    DROP TABLE IF EXISTS client_portal_change_request_attachments;
    DROP TABLE IF EXISTS client_portal_change_request_events;
    DROP TABLE IF EXISTS client_portal_change_request_messages;
    DROP TABLE IF EXISTS client_portal_change_requests;
    DROP TABLE IF EXISTS client_portal_change_request_sequences;
  `);
};
