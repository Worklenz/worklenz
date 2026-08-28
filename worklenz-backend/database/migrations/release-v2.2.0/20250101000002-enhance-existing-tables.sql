-- Migration: Enhance Existing Tables for Client Portal
-- Description: Adds client portal related fields to existing tables
-- Date: 2025-07-16
-- Version: 2.2.0

-- Add client portal related columns to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS contact_person TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS email WL_EMAIL;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS client_portal_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS client_portal_access_code TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending'));

-- Add client portal related columns to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS client_portal_visible BOOLEAN DEFAULT FALSE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS client_portal_access_level TEXT DEFAULT 'view' CHECK (client_portal_access_level IN ('view', 'comment', 'full'));

-- Add client portal related columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_client_portal_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS client_portal_role TEXT DEFAULT 'team_member' CHECK (client_portal_role IN ('team_member', 'client', 'admin'));

-- Add indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_clients_portal_enabled ON clients(client_portal_enabled);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_projects_portal_visible ON projects(client_portal_visible);
CREATE INDEX IF NOT EXISTS idx_users_portal_enabled ON users(is_client_portal_enabled);

-- Client Portal Services
CREATE TABLE IF NOT EXISTS client_portal_services (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'draft')),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    organization_team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users(id),
    service_data JSONB, -- For flexible form configurations
    is_public BOOLEAN DEFAULT FALSE,
    allowed_client_ids UUID[], -- Specific clients who can see this service
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Client Relationships (for dual actor support)
CREATE TABLE IF NOT EXISTS client_relationships (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    organization_team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    access_level TEXT DEFAULT 'view' CHECK (access_level IN ('view', 'comment', 'full')),
    is_active BOOLEAN DEFAULT TRUE,
    invited_by UUID REFERENCES users(id),
    invited_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    accepted_at TIMESTAMP WITH TIME ZONE,
    last_access_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, client_id, organization_team_id)
);

-- Client Portal Service Requests
CREATE TABLE IF NOT EXISTS client_portal_requests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    req_no TEXT NOT NULL UNIQUE, -- Auto-generated request number
    service_id UUID NOT NULL REFERENCES client_portal_services(id),
    client_id UUID NOT NULL REFERENCES clients(id),
    organization_team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    submitted_by_user_id UUID REFERENCES users(id),
    client_relationship_id UUID REFERENCES client_relationships(id),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'in_progress', 'completed', 'rejected')),
    request_data JSONB, -- Form responses
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Client Portal Invoices
CREATE TABLE IF NOT EXISTS client_portal_invoices (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    invoice_no TEXT NOT NULL UNIQUE,
    client_id UUID NOT NULL REFERENCES clients(id),
    organization_team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    request_id UUID REFERENCES client_portal_requests(id),
    created_by_user_id UUID REFERENCES users(id),
    amount NUMERIC(10,2) NOT NULL,
    currency TEXT DEFAULT 'USD',
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
    due_date DATE,
    sent_at TIMESTAMP WITH TIME ZONE,
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Client Portal Chat Messages
CREATE TABLE IF NOT EXISTS client_portal_chat_messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES clients(id),
    organization_team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    client_relationship_id UUID REFERENCES client_relationships(id),
    sender_type TEXT NOT NULL CHECK (sender_type IN ('client', 'team_member')),
    sender_id UUID NOT NULL, -- Can be user_id or client_contact_id
    message TEXT NOT NULL,
    message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'file', 'image')),
    file_url TEXT,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Client Portal Settings
CREATE TABLE IF NOT EXISTS client_portal_settings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    organization_team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    logo_url TEXT,
    primary_color TEXT DEFAULT '#3b7ad4',
    welcome_message TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    terms_of_service TEXT,
    privacy_policy TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Client Portal Access (for client authentication)
CREATE TABLE IF NOT EXISTS client_portal_access (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    email WL_EMAIL NOT NULL,
    password_hash TEXT NOT NULL,
    access_token TEXT,
    token_expires_at TIMESTAMP WITH TIME ZONE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Client Portal Sessions for separate authentication
CREATE TABLE IF NOT EXISTS client_portal_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_relationship_id UUID NOT NULL REFERENCES client_relationships(id) ON DELETE CASCADE,
    session_token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Client Portal Permissions
CREATE TABLE IF NOT EXISTS client_portal_permissions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    client_relationship_id UUID NOT NULL REFERENCES client_relationships(id) ON DELETE CASCADE,
    permission_key TEXT NOT NULL,
    is_granted BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(client_relationship_id, permission_key)
);

-- Project Client Access Mapping
CREATE TABLE IF NOT EXISTS project_client_access (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    client_relationship_id UUID NOT NULL REFERENCES client_relationships(id) ON DELETE CASCADE,
    access_level TEXT DEFAULT 'view' CHECK (access_level IN ('view', 'comment', 'full')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, client_relationship_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_client_portal_services_team_id ON client_portal_services(team_id);
CREATE INDEX IF NOT EXISTS idx_client_portal_services_org_team_id ON client_portal_services(organization_team_id);
CREATE INDEX IF NOT EXISTS idx_client_portal_services_status ON client_portal_services(status);

CREATE INDEX IF NOT EXISTS idx_client_portal_requests_client_id ON client_portal_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_client_portal_requests_org_team_id ON client_portal_requests(organization_team_id);
CREATE INDEX IF NOT EXISTS idx_client_portal_requests_status ON client_portal_requests(status);
CREATE INDEX IF NOT EXISTS idx_client_portal_requests_service_id ON client_portal_requests(service_id);

CREATE INDEX IF NOT EXISTS idx_client_portal_invoices_client_id ON client_portal_invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_client_portal_invoices_org_team_id ON client_portal_invoices(organization_team_id);
CREATE INDEX IF NOT EXISTS idx_client_portal_invoices_status ON client_portal_invoices(status);

CREATE INDEX IF NOT EXISTS idx_client_portal_chat_messages_client_id ON client_portal_chat_messages(client_id);
CREATE INDEX IF NOT EXISTS idx_client_portal_chat_messages_org_team_id ON client_portal_chat_messages(organization_team_id);
CREATE INDEX IF NOT EXISTS idx_client_portal_chat_messages_created_at ON client_portal_chat_messages(created_at);

CREATE INDEX IF NOT EXISTS idx_client_relationships_user_id ON client_relationships(user_id);
CREATE INDEX IF NOT EXISTS idx_client_relationships_client_id ON client_relationships(client_id);
CREATE INDEX IF NOT EXISTS idx_client_relationships_org_team_id ON client_relationships(organization_team_id);

CREATE INDEX IF NOT EXISTS idx_client_portal_sessions_token ON client_portal_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_client_portal_sessions_expires_at ON client_portal_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_project_client_access_project_id ON project_client_access(project_id);
CREATE INDEX IF NOT EXISTS idx_project_client_access_relationship_id ON project_client_access(client_relationship_id); 