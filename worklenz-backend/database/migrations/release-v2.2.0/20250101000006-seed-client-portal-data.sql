-- Migration: Seed Client Portal Initial Data
-- Description: Seeds initial data for client portal features
-- Date: 2025-07-16
-- Version: 2.2.0

-- Insert default client portal permissions
INSERT INTO client_portal_permissions (client_relationship_id, permission_key, is_granted) 
SELECT 
    cr.id,
    permission_key,
    TRUE
FROM client_relationships cr
CROSS JOIN (
    VALUES 
        ('view_services'),
        ('submit_requests'),
        ('view_projects'),
        ('view_invoices'),
        ('send_messages'),
        ('download_files'),
        ('view_reports')
) AS permissions(permission_key)
ON CONFLICT (client_relationship_id, permission_key) DO NOTHING;

-- Insert default client portal settings for existing teams
INSERT INTO client_portal_settings (
    team_id,
    organization_team_id,
    logo_url,
    primary_color,
    welcome_message,
    contact_email,
    contact_phone,
    terms_of_service,
    privacy_policy
)
SELECT 
    t.id,
    t.id,
    NULL,
    '#3b7ad4',
    'Welcome to our client portal! Here you can view your projects, submit requests, and communicate with our team.',
    NULL,
    NULL,
    'By using this client portal, you agree to our terms of service.',
    'Your privacy is important to us. Please review our privacy policy.'
FROM teams t
WHERE NOT EXISTS (
    SELECT 1 FROM client_portal_settings WHERE team_id = t.id
);

-- Create sample client portal services for existing teams (optional)
-- This can be commented out if you don't want sample data
/*
INSERT INTO client_portal_services (
    name,
    description,
    status,
    team_id,
    organization_team_id,
    created_by,
    service_data,
    is_public
)
SELECT 
    'Website Development',
    'Complete website development services including design, development, and deployment.',
    'active',
    t.id,
    t.id,
    t.user_id,
    '{"description": "Professional website development services", "request_form": [{"type": "text", "question": "Project Description", "answer": null}, {"type": "text", "question": "Budget Range", "answer": null}]}'::jsonb,
    TRUE
FROM teams t
WHERE EXISTS (
    SELECT 1 FROM clients WHERE team_id = t.id
)
AND NOT EXISTS (
    SELECT 1 FROM client_portal_services WHERE organization_team_id = t.id
)
LIMIT 1;

INSERT INTO client_portal_services (
    name,
    description,
    status,
    team_id,
    organization_team_id,
    created_by,
    service_data,
    is_public
)
SELECT 
    'Mobile App Development',
    'Custom mobile application development for iOS and Android platforms.',
    'active',
    t.id,
    t.id,
    t.user_id,
    '{"description": "Custom mobile app development", "request_form": [{"type": "text", "question": "Platform Preference", "answer": null}, {"type": "multipleChoice", "question": "App Type", "answer": ["Business", "E-commerce", "Social", "Utility"]}]}'::jsonb,
    TRUE
FROM teams t
WHERE EXISTS (
    SELECT 1 FROM clients WHERE team_id = t.id
)
AND NOT EXISTS (
    SELECT 1 FROM client_portal_services WHERE organization_team_id = t.id AND name = 'Mobile App Development'
)
LIMIT 1;
*/

-- Update existing clients to enable client portal (optional)
-- This can be commented out if you don't want to automatically enable for existing clients
/*
UPDATE clients 
SET client_portal_enabled = TRUE,
    client_portal_access_code = 'CP-' || SUBSTRING(id::TEXT FROM 1 FOR 8) || '-' || SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6)
WHERE client_portal_enabled IS NULL;
*/

-- Create indexes for better performance on seeded data
CREATE INDEX IF NOT EXISTS idx_client_portal_permissions_relationship_key ON client_portal_permissions(client_relationship_id, permission_key);
CREATE INDEX IF NOT EXISTS idx_client_portal_settings_team_id ON client_portal_settings(team_id);

-- Add comments for documentation
COMMENT ON TABLE client_portal_permissions IS 'Stores permissions for client portal access';
COMMENT ON TABLE client_portal_settings IS 'Stores organization-specific client portal settings';
COMMENT ON TABLE client_portal_services IS 'Stores services offered through the client portal';
COMMENT ON TABLE client_portal_requests IS 'Stores service requests submitted by clients';
COMMENT ON TABLE client_portal_invoices IS 'Stores invoices generated for client services';
COMMENT ON TABLE client_portal_chat_messages IS 'Stores chat messages between clients and organization';
COMMENT ON TABLE client_relationships IS 'Stores relationships between users and clients for portal access';
COMMENT ON TABLE client_portal_sessions IS 'Stores client portal authentication sessions';
COMMENT ON TABLE client_portal_access IS 'Stores client portal access credentials';
COMMENT ON TABLE project_client_access IS 'Stores project access permissions for clients'; 