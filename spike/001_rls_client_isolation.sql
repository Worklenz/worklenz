-- Kill-Shot Spike 1b: RLS Row-Level Security for Client Isolation
-- Proves: client_user can only see their own client's data at the DB level

-- PPM clients table
CREATE TABLE IF NOT EXISTS ppm_clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PPM client users table (portal users)
CREATE TABLE IF NOT EXISTS ppm_client_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    client_id UUID NOT NULL REFERENCES ppm_clients(id),
    role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer', 'reviewer', 'admin')),
    magic_link_token TEXT,
    magic_link_expires_at TIMESTAMPTZ,
    password_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    deactivated_at TIMESTAMPTZ
);

-- PPM deliverables table (extends Worklenz tasks via FK)
CREATE TABLE IF NOT EXISTS ppm_deliverables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worklenz_task_id UUID, -- FK to tasks table (nullable for spike)
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued','in_progress','internal_review','client_review','revision','approved','done')),
    visibility TEXT NOT NULL DEFAULT 'internal_only'
        CHECK (visibility IN ('internal_only','client_visible')),
    client_id UUID NOT NULL REFERENCES ppm_clients(id),
    estimated_hours NUMERIC(8,2),
    actual_hours NUMERIC(8,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on client-facing tables
ALTER TABLE ppm_deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE ppm_client_users ENABLE ROW LEVEL SECURITY;

-- RLS Policy: client users can only see deliverables for their client
-- Uses session variable set at connection time
CREATE POLICY ppm_deliverables_client_isolation ON ppm_deliverables
    FOR ALL
    USING (client_id = current_setting('ppm.current_client_id')::UUID);

CREATE POLICY ppm_client_users_client_isolation ON ppm_client_users
    FOR ALL
    USING (client_id = current_setting('ppm.current_client_id')::UUID);

-- Superuser/internal bypass: allow internal users (table owner) to see all rows
-- RLS policies don't apply to table owners by default, which is what we want

-- Seed test data
INSERT INTO ppm_clients (id, name) VALUES
    ('aaaaaaaa-0000-0000-0000-000000000001', 'Acme Corp'),
    ('aaaaaaaa-0000-0000-0000-000000000002', 'Beta LLC');

INSERT INTO ppm_deliverables (title, status, visibility, client_id) VALUES
    ('Acme Ad Campaign', 'client_review', 'client_visible', 'aaaaaaaa-0000-0000-0000-000000000001'),
    ('Acme Logo Refresh', 'in_progress', 'internal_only', 'aaaaaaaa-0000-0000-0000-000000000001'),
    ('Beta Social Posts', 'client_review', 'client_visible', 'aaaaaaaa-0000-0000-0000-000000000002'),
    ('Beta Website Redesign', 'approved', 'client_visible', 'aaaaaaaa-0000-0000-0000-000000000002');

INSERT INTO ppm_client_users (email, client_id, role) VALUES
    ('client@acme.com', 'aaaaaaaa-0000-0000-0000-000000000001', 'reviewer'),
    ('client@beta.com', 'aaaaaaaa-0000-0000-0000-000000000002', 'reviewer');

-- Create a non-superuser role for testing RLS
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ppm_client_role') THEN
        CREATE ROLE ppm_client_role LOGIN;
    END IF;
END$$;

GRANT SELECT ON ppm_deliverables TO ppm_client_role;
GRANT SELECT ON ppm_client_users TO ppm_client_role;
