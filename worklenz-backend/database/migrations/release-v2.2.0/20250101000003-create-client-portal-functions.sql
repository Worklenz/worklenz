-- Migration: Create Client Portal Database Functions
-- Description: Creates database functions for client portal operations
-- Date: 2025-07-16
-- Version: 2.2.0

-- Function to generate unique request numbers
CREATE OR REPLACE FUNCTION generate_request_number(team_id UUID)
RETURNS TEXT AS $$
DECLARE
    next_number INTEGER;
    request_number TEXT;
BEGIN
    -- Get the next number for this team
    SELECT COALESCE(MAX(CAST(SUBSTRING(req_no FROM 2) AS INTEGER)), 0) + 1
    INTO next_number
    FROM client_portal_requests
    WHERE organization_team_id = team_id;
    
    -- Format: R-{team_id_short}-{number}
    request_number := 'R-' || SUBSTRING(team_id::TEXT FROM 1 FOR 8) || '-' || LPAD(next_number::TEXT, 6, '0');
    
    RETURN request_number;
END;
$$ LANGUAGE plpgsql;

-- Function to generate unique invoice numbers
CREATE OR REPLACE FUNCTION generate_invoice_number(team_id UUID)
RETURNS TEXT AS $$
DECLARE
    next_number INTEGER;
    invoice_number TEXT;
BEGIN
    -- Get the next number for this team
    SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_no FROM 2) AS INTEGER)), 0) + 1
    INTO next_number
    FROM client_portal_invoices
    WHERE organization_team_id = team_id;
    
    -- Format: INV-{team_id_short}-{number}
    invoice_number := 'INV-' || SUBSTRING(team_id::TEXT FROM 1 FOR 8) || '-' || LPAD(next_number::TEXT, 6, '0');
    
    RETURN invoice_number;
END;
$$ LANGUAGE plpgsql;

-- Function to create client relationship
CREATE OR REPLACE FUNCTION create_client_relationship(
    p_user_id UUID,
    p_client_id UUID,
    p_organization_team_id UUID,
    p_invited_by UUID,
    p_access_level TEXT DEFAULT 'view'
)
RETURNS UUID AS $$
DECLARE
    relationship_id UUID;
BEGIN
    -- Check if relationship already exists
    SELECT id INTO relationship_id
    FROM client_relationships
    WHERE user_id = p_user_id 
      AND client_id = p_client_id 
      AND organization_team_id = p_organization_team_id;
    
    IF relationship_id IS NOT NULL THEN
        RETURN relationship_id;
    END IF;
    
    -- Create new relationship
    INSERT INTO client_relationships (
        user_id, 
        client_id, 
        organization_team_id, 
        invited_by, 
        access_level
    ) VALUES (
        p_user_id, 
        p_client_id, 
        p_organization_team_id, 
        p_invited_by, 
        p_access_level
    ) RETURNING id INTO relationship_id;
    
    -- Create default permissions
    INSERT INTO client_portal_permissions (client_relationship_id, permission_key)
    VALUES 
        (relationship_id, 'view_services'),
        (relationship_id, 'submit_requests'),
        (relationship_id, 'view_projects'),
        (relationship_id, 'view_invoices'),
        (relationship_id, 'send_messages');
    
    RETURN relationship_id;
END;
$$ LANGUAGE plpgsql;

-- Function to check client portal permissions
CREATE OR REPLACE FUNCTION check_client_permission(
    p_client_relationship_id UUID,
    p_permission_key TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    has_permission BOOLEAN;
BEGIN
    SELECT is_granted INTO has_permission
    FROM client_portal_permissions
    WHERE client_relationship_id = p_client_relationship_id
      AND permission_key = p_permission_key;
    
    RETURN COALESCE(has_permission, FALSE);
END;
$$ LANGUAGE plpgsql;

-- Function to get client portal accessible projects
CREATE OR REPLACE FUNCTION get_client_accessible_projects(
    p_client_relationship_id UUID
)
RETURNS TABLE (
    project_id UUID,
    project_name TEXT,
    access_level TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.name,
        COALESCE(pca.access_level, p.client_portal_access_level) as access_level
    FROM projects p
    LEFT JOIN project_client_access pca ON p.id = pca.project_id 
        AND pca.client_relationship_id = p_client_relationship_id
    WHERE p.client_portal_visible = TRUE
      AND p.client_id = (
          SELECT client_id 
          FROM client_relationships 
          WHERE id = p_client_relationship_id
      );
END;
$$ LANGUAGE plpgsql;

-- Function to update client portal session
CREATE OR REPLACE FUNCTION update_client_session(
    p_session_token TEXT,
    p_user_id UUID,
    p_client_relationship_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    session_exists BOOLEAN;
BEGIN
    -- Check if session exists
    SELECT EXISTS(
        SELECT 1 FROM client_portal_sessions 
        WHERE session_token = p_session_token
    ) INTO session_exists;
    
    IF session_exists THEN
        -- Update existing session
        UPDATE client_portal_sessions
        SET expires_at = NOW() + INTERVAL '24 hours',
            updated_at = NOW()
        WHERE session_token = p_session_token;
    ELSE
        -- Create new session
        INSERT INTO client_portal_sessions (
            user_id,
            client_relationship_id,
            session_token,
            expires_at
        ) VALUES (
            p_user_id,
            p_client_relationship_id,
            p_session_token,
            NOW() + INTERVAL '24 hours'
        );
    END IF;
    
    -- Update last access time
    UPDATE client_relationships
    SET last_access_at = NOW()
    WHERE id = p_client_relationship_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to clean expired sessions
CREATE OR REPLACE FUNCTION clean_expired_client_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM client_portal_sessions
    WHERE expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get client portal statistics
CREATE OR REPLACE FUNCTION get_client_portal_stats(
    p_organization_team_id UUID
)
RETURNS TABLE (
    total_services INTEGER,
    active_services INTEGER,
    total_requests INTEGER,
    pending_requests INTEGER,
    total_invoices INTEGER,
    unpaid_invoices INTEGER,
    total_clients INTEGER,
    active_clients INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*) FROM client_portal_services WHERE organization_team_id = p_organization_team_id)::INTEGER,
        (SELECT COUNT(*) FROM client_portal_services WHERE organization_team_id = p_organization_team_id AND status = 'active')::INTEGER,
        (SELECT COUNT(*) FROM client_portal_requests WHERE organization_team_id = p_organization_team_id)::INTEGER,
        (SELECT COUNT(*) FROM client_portal_requests WHERE organization_team_id = p_organization_team_id AND status = 'pending')::INTEGER,
        (SELECT COUNT(*) FROM client_portal_invoices WHERE organization_team_id = p_organization_team_id)::INTEGER,
        (SELECT COUNT(*) FROM client_portal_invoices WHERE organization_team_id = p_organization_team_id AND status IN ('sent', 'overdue'))::INTEGER,
        (SELECT COUNT(*) FROM clients WHERE team_id = p_organization_team_id AND client_portal_enabled = TRUE)::INTEGER,
        (SELECT COUNT(*) FROM client_relationships WHERE organization_team_id = p_organization_team_id AND is_active = TRUE)::INTEGER;
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to clean expired sessions (if using pg_cron)
-- SELECT cron.schedule('clean-expired-client-sessions', '0 2 * * *', 'SELECT clean_expired_client_sessions();'); 