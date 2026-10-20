'use strict';
// Admin-side support-ticket queue for the Client Portal (client-facing submission ships in a
// later phase). A ticket's status can be one of the 3 built-in workflow states, or one of the
// team-defined custom statuses below — the same built-ins-UNION-custom-table relationship
// client_portal_request_custom_statuses has to client_portal_requests.status.

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS client_portal_tickets (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        ticket_no TEXT NOT NULL UNIQUE, -- Auto-generated ticket number (see generate_ticket_number below)
        organization_team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        client_id UUID NOT NULL REFERENCES clients(id),
        subject TEXT NOT NULL,
        description TEXT,
        priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
        status TEXT NOT NULL DEFAULT 'open',
        converted_task_id UUID REFERENCES tasks(id),
        resolved_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_client_portal_tickets_org_team_id ON client_portal_tickets(organization_team_id);
    CREATE INDEX IF NOT EXISTS idx_client_portal_tickets_client_id ON client_portal_tickets(client_id);

    CREATE TABLE IF NOT EXISTS client_portal_ticket_comments (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        ticket_id UUID NOT NULL REFERENCES client_portal_tickets(id) ON DELETE CASCADE,
        organization_team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        comment TEXT NOT NULL,
        sender_type TEXT NOT NULL CHECK (sender_type IN ('client', 'team_member')),
        sender_id UUID NOT NULL,
        sender_name TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_client_portal_ticket_comments_ticket_id ON client_portal_ticket_comments(ticket_id);
    CREATE INDEX IF NOT EXISTS idx_client_portal_ticket_comments_org_team_id ON client_portal_ticket_comments(organization_team_id);
    CREATE INDEX IF NOT EXISTS idx_client_portal_ticket_comments_created_at ON client_portal_ticket_comments(created_at DESC);

    CREATE TABLE IF NOT EXISTS client_portal_ticket_custom_statuses (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        organization_team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        color TEXT NOT NULL DEFAULT 'default',
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- A plain table-level UNIQUE constraint can't reference an expression like LOWER(name), only
    -- column names — a unique index is the correct way to get case-insensitive uniqueness here.
    CREATE UNIQUE INDEX IF NOT EXISTS idx_client_portal_ticket_custom_statuses_unique
        ON client_portal_ticket_custom_statuses(organization_team_id, LOWER(name));

    CREATE INDEX IF NOT EXISTS idx_client_portal_ticket_custom_statuses_org_team_id
        ON client_portal_ticket_custom_statuses(organization_team_id);

    CREATE TABLE IF NOT EXISTS client_portal_ticket_attachments (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        ticket_id UUID NOT NULL REFERENCES client_portal_tickets(id) ON DELETE CASCADE,
        organization_team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        file_name TEXT NOT NULL,
        file_url TEXT NOT NULL,
        storage_key TEXT NOT NULL, -- kept so delete can call deleteObject() directly, without reverse-engineering the key from file_url
        file_size BIGINT,
        file_type TEXT,
        uploaded_by_type TEXT NOT NULL CHECK (uploaded_by_type IN ('client', 'team_member')),
        uploaded_by_id UUID,
        uploaded_by_name TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_client_portal_ticket_attachments_ticket_id ON client_portal_ticket_attachments(ticket_id);

    -- Function to generate unique ticket numbers, mirroring generate_request_number()
    CREATE OR REPLACE FUNCTION generate_ticket_number(team_id UUID)
    RETURNS TEXT AS $$
    DECLARE
        next_number INTEGER;
        ticket_number TEXT;
    BEGIN
        SELECT COALESCE(MAX(CAST(SUBSTRING(ticket_no FROM '[0-9]+$') AS INTEGER)), 0) + 1
        INTO next_number
        FROM client_portal_tickets
        WHERE organization_team_id = team_id;

        ticket_number := 'TCK-' || SUBSTRING(team_id::TEXT FROM 1 FOR 8) || '-' || LPAD(next_number::TEXT, 6, '0');

        RETURN ticket_number;
    END;
    $$ LANGUAGE plpgsql;

    CREATE OR REPLACE FUNCTION trigger_generate_ticket_number()
    RETURNS TRIGGER AS $$
    BEGIN
        IF NEW.ticket_no IS NULL THEN
            NEW.ticket_no := generate_ticket_number(NEW.organization_team_id);
        END IF;
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trigger_client_portal_tickets_number ON client_portal_tickets;
    CREATE TRIGGER trigger_client_portal_tickets_number
        BEFORE INSERT ON client_portal_tickets
        FOR EACH ROW
        EXECUTE FUNCTION trigger_generate_ticket_number();

    -- trigger_update_updated_at() is defined for the other client portal tables elsewhere, but
    -- that migration isn't applied on every environment this ships to — CREATE OR REPLACE here
    -- makes this migration self-sufficient regardless, and is a no-op if that generic function
    -- already exists with the same body.
    CREATE OR REPLACE FUNCTION trigger_update_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trigger_client_portal_tickets_updated_at ON client_portal_tickets;
    CREATE TRIGGER trigger_client_portal_tickets_updated_at
        BEFORE UPDATE ON client_portal_tickets
        FOR EACH ROW
        EXECUTE FUNCTION trigger_update_updated_at();

    DROP TRIGGER IF EXISTS trigger_client_portal_ticket_comments_updated_at ON client_portal_ticket_comments;
    CREATE TRIGGER trigger_client_portal_ticket_comments_updated_at
        BEFORE UPDATE ON client_portal_ticket_comments
        FOR EACH ROW
        EXECUTE FUNCTION trigger_update_updated_at();

    DROP TRIGGER IF EXISTS trigger_client_portal_ticket_custom_statuses_updated_at ON client_portal_ticket_custom_statuses;
    CREATE TRIGGER trigger_client_portal_ticket_custom_statuses_updated_at
        BEFORE UPDATE ON client_portal_ticket_custom_statuses
        FOR EACH ROW
        EXECUTE FUNCTION trigger_update_updated_at();
  `);
};

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  // trigger_update_updated_at() is intentionally not dropped: it may be shared with other
  // client portal tables (see the note in exports.up).
  pgm.sql(`
    DROP TRIGGER IF EXISTS trigger_client_portal_ticket_custom_statuses_updated_at ON client_portal_ticket_custom_statuses;
    DROP TRIGGER IF EXISTS trigger_client_portal_ticket_comments_updated_at ON client_portal_ticket_comments;
    DROP TRIGGER IF EXISTS trigger_client_portal_tickets_updated_at ON client_portal_tickets;
    DROP TRIGGER IF EXISTS trigger_client_portal_tickets_number ON client_portal_tickets;
    DROP FUNCTION IF EXISTS trigger_generate_ticket_number();
    DROP FUNCTION IF EXISTS generate_ticket_number(UUID);
    DROP TABLE IF EXISTS client_portal_ticket_attachments;
    DROP TABLE IF EXISTS client_portal_ticket_custom_statuses;
    DROP TABLE IF EXISTS client_portal_ticket_comments;
    DROP TABLE IF EXISTS client_portal_tickets;
  `);
};
