-- Migration: Create Client Portal Database Views
-- Description: Creates database views for client portal data access
-- Date: 2025-07-16
-- Version: 2.2.0

-- View for client portal services with organization details
CREATE OR REPLACE VIEW client_portal_services_view AS
SELECT 
    cps.id,
    cps.name,
    cps.description,
    cps.status,
    cps.team_id,
    cps.organization_team_id,
    cps.created_by,
    cps.service_data,
    cps.is_public,
    cps.allowed_client_ids,
    cps.created_at,
    cps.updated_at,
    u.name as created_by_name,
    t.name as team_name,
    ot.name as organization_name,
    (SELECT COUNT(*) FROM client_portal_requests WHERE service_id = cps.id) as request_count,
    (SELECT COUNT(*) FROM client_portal_requests WHERE service_id = cps.id AND status = 'pending') as pending_request_count
FROM client_portal_services cps
LEFT JOIN users u ON cps.created_by = u.id
LEFT JOIN teams t ON cps.team_id = t.id
LEFT JOIN teams ot ON cps.organization_team_id = ot.id;

-- View for client portal requests with full details
CREATE OR REPLACE VIEW client_portal_requests_view AS
SELECT 
    cpr.id,
    cpr.req_no,
    cpr.service_id,
    cpr.client_id,
    cpr.organization_team_id,
    cpr.submitted_by_user_id,
    cpr.client_relationship_id,
    cpr.status,
    cpr.request_data,
    cpr.notes,
    cpr.created_at,
    cpr.updated_at,
    cpr.completed_at,
    cps.name as service_name,
    c.name as client_name,
    u.name as submitted_by_name,
    ot.name as organization_name,
    cr.access_level as client_access_level,
    (SELECT COUNT(*) FROM client_portal_chat_messages WHERE client_id = cpr.client_id) as message_count,
    (SELECT MAX(created_at) FROM client_portal_chat_messages WHERE client_id = cpr.client_id) as last_message_at
FROM client_portal_requests cpr
LEFT JOIN client_portal_services cps ON cpr.service_id = cps.id
LEFT JOIN clients c ON cpr.client_id = c.id
LEFT JOIN users u ON cpr.submitted_by_user_id = u.id
LEFT JOIN teams ot ON cpr.organization_team_id = ot.id
LEFT JOIN client_relationships cr ON cpr.client_relationship_id = cr.id;

-- View for client portal invoices with full details
CREATE OR REPLACE VIEW client_portal_invoices_view AS
SELECT 
    cpi.id,
    cpi.invoice_no,
    cpi.client_id,
    cpi.organization_team_id,
    cpi.request_id,
    cpi.created_by_user_id,
    cpi.amount,
    cpi.currency,
    cpi.status,
    cpi.due_date,
    cpi.sent_at,
    cpi.paid_at,
    cpi.created_at,
    cpi.updated_at,
    c.name as client_name,
    u.name as created_by_name,
    ot.name as organization_name,
    cpr.req_no as request_number,
    cps.name as service_name,
    CASE 
        WHEN cpi.due_date < CURRENT_DATE AND cpi.status IN ('sent', 'overdue') THEN 'overdue'
        WHEN cpi.due_date = CURRENT_DATE AND cpi.status = 'sent' THEN 'due_today'
        WHEN cpi.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days' AND cpi.status = 'sent' THEN 'due_soon'
        ELSE 'normal'
    END as payment_status
FROM client_portal_invoices cpi
LEFT JOIN clients c ON cpi.client_id = c.id
LEFT JOIN users u ON cpi.created_by_user_id = u.id
LEFT JOIN teams ot ON cpi.organization_team_id = ot.id
LEFT JOIN client_portal_requests cpr ON cpi.request_id = cpr.id
LEFT JOIN client_portal_services cps ON cpr.service_id = cps.id;

-- View for client relationships with user and client details
CREATE OR REPLACE VIEW client_relationships_view AS
SELECT 
    cr.id,
    cr.user_id,
    cr.client_id,
    cr.organization_team_id,
    cr.access_level,
    cr.is_active,
    cr.invited_by,
    cr.invited_at,
    cr.accepted_at,
    cr.last_access_at,
    cr.created_at,
    cr.updated_at,
    u.name as user_name,
    u.email as user_email,
    c.name as client_name,
    ot.name as organization_name,
    inv.name as invited_by_name,
    (SELECT COUNT(*) FROM client_portal_requests WHERE client_relationship_id = cr.id) as request_count,
    (SELECT COUNT(*) FROM client_portal_requests WHERE client_relationship_id = cr.id AND status = 'pending') as pending_request_count,
    (SELECT COUNT(*) FROM project_client_access WHERE client_relationship_id = cr.id) as accessible_project_count
FROM client_relationships cr
LEFT JOIN users u ON cr.user_id = u.id
LEFT JOIN clients c ON cr.client_id = c.id
LEFT JOIN teams ot ON cr.organization_team_id = ot.id
LEFT JOIN users inv ON cr.invited_by = inv.id;

-- View for client portal chat messages with sender details
CREATE OR REPLACE VIEW client_portal_chat_messages_view AS
SELECT 
    cpcm.id,
    cpcm.client_id,
    cpcm.organization_team_id,
    cpcm.client_relationship_id,
    cpcm.sender_type,
    cpcm.sender_id,
    cpcm.message,
    cpcm.message_type,
    cpcm.file_url,
    cpcm.read_at,
    cpcm.created_at,
    c.name as client_name,
    ot.name as organization_name,
    CASE 
        WHEN cpcm.sender_type = 'team_member' THEN u.name
        ELSE COALESCE(c.contact_person, c.name)
    END as sender_name,
    CASE 
        WHEN cpcm.sender_type = 'team_member' THEN u.avatar_url
        ELSE NULL
    END as sender_avatar
FROM client_portal_chat_messages cpcm
LEFT JOIN clients c ON cpcm.client_id = c.id
LEFT JOIN teams ot ON cpcm.organization_team_id = ot.id
LEFT JOIN users u ON cpcm.sender_type = 'team_member' AND cpcm.sender_id = u.id;

-- View for client portal accessible projects
CREATE OR REPLACE VIEW client_portal_projects_view AS
SELECT 
    p.id as project_id,
    p.name as project_name,
    p.key as project_key,
    p.color_code,
    p.notes,
    p.start_date,
    p.end_date,
    p.status_id,
    p.health_id,
    COALESCE(p.client_portal_visible, FALSE) as client_portal_visible,
    COALESCE(p.client_portal_access_level, 'view') as client_portal_access_level,
    p.created_at,
    p.updated_at,
    c.id as client_id,
    c.name as client_name,
    cr.id as client_relationship_id,
    cr.user_id,
    cr.access_level as relationship_access_level,
    COALESCE(pca.access_level, COALESCE(p.client_portal_access_level, 'view')) as effective_access_level,
    sps.name as status_name,
    sph.name as health_name,
    (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND archived = FALSE) as total_tasks,
    (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND archived = FALSE AND done = TRUE) as completed_tasks,
    (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) as member_count
FROM projects p
LEFT JOIN clients c ON p.client_id = c.id
LEFT JOIN client_relationships cr ON c.id = cr.client_id
LEFT JOIN project_client_access pca ON p.id = pca.project_id AND cr.id = pca.client_relationship_id
LEFT JOIN sys_project_statuses sps ON p.status_id = sps.id
LEFT JOIN sys_project_healths sph ON p.health_id = sph.id
WHERE COALESCE(p.client_portal_visible, FALSE) = TRUE;

-- View for client portal statistics
CREATE OR REPLACE VIEW client_portal_stats_view AS
SELECT 
    organization_team_id,
    (SELECT COUNT(*) FROM client_portal_services WHERE organization_team_id = cps.organization_team_id) as total_services,
    (SELECT COUNT(*) FROM client_portal_services WHERE organization_team_id = cps.organization_team_id AND status = 'active') as active_services,
    (SELECT COUNT(*) FROM client_portal_requests WHERE organization_team_id = cps.organization_team_id) as total_requests,
    (SELECT COUNT(*) FROM client_portal_requests WHERE organization_team_id = cps.organization_team_id AND status = 'pending') as pending_requests,
    (SELECT COUNT(*) FROM client_portal_requests WHERE organization_team_id = cps.organization_team_id AND status = 'in_progress') as in_progress_requests,
    (SELECT COUNT(*) FROM client_portal_requests WHERE organization_team_id = cps.organization_team_id AND status = 'completed') as completed_requests,
    (SELECT COUNT(*) FROM client_portal_invoices WHERE organization_team_id = cps.organization_team_id) as total_invoices,
    (SELECT COUNT(*) FROM client_portal_invoices WHERE organization_team_id = cps.organization_team_id AND status IN ('sent', 'overdue')) as unpaid_invoices,
    (SELECT COUNT(*) FROM client_portal_invoices WHERE organization_team_id = cps.organization_team_id AND status = 'paid') as paid_invoices,
    (SELECT COUNT(*) FROM clients WHERE team_id = cps.organization_team_id AND COALESCE(client_portal_enabled, FALSE) = TRUE) as total_clients,
    (SELECT COUNT(*) FROM client_relationships WHERE organization_team_id = cps.organization_team_id AND is_active = TRUE) as active_clients,
    (SELECT COUNT(*) FROM client_portal_chat_messages WHERE organization_team_id = cps.organization_team_id AND created_at >= CURRENT_DATE - INTERVAL '7 days') as messages_last_7_days
FROM client_portal_services cps
GROUP BY organization_team_id;

-- View for client portal permissions summary
CREATE OR REPLACE VIEW client_portal_permissions_view AS
SELECT 
    cr.id as client_relationship_id,
    cr.user_id,
    cr.client_id,
    cr.organization_team_id,
    cr.access_level as relationship_access_level,
    cr.is_active,
    u.name as user_name,
    c.name as client_name,
    ot.name as organization_name,
    jsonb_object_agg(cpp.permission_key, cpp.is_granted) as permissions
FROM client_relationships cr
LEFT JOIN users u ON cr.user_id = u.id
LEFT JOIN clients c ON cr.client_id = c.id
LEFT JOIN teams ot ON cr.organization_team_id = ot.id
LEFT JOIN client_portal_permissions cpp ON cr.id = cpp.client_relationship_id
GROUP BY cr.id, cr.user_id, cr.client_id, cr.organization_team_id, cr.access_level, cr.is_active, u.name, c.name, ot.name;

-- Grant permissions to worklenz_client role
GRANT SELECT ON client_portal_services_view TO worklenz_client;
GRANT SELECT ON client_portal_requests_view TO worklenz_client;
GRANT SELECT ON client_portal_invoices_view TO worklenz_client;
GRANT SELECT ON client_relationships_view TO worklenz_client;
GRANT SELECT ON client_portal_chat_messages_view TO worklenz_client;
GRANT SELECT ON client_portal_projects_view TO worklenz_client;
GRANT SELECT ON client_portal_stats_view TO worklenz_client;
GRANT SELECT ON client_portal_permissions_view TO worklenz_client; 