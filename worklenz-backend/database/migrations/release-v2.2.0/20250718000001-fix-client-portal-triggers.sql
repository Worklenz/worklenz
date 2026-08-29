-- Fix client portal triggers to avoid project_id constraint violation
-- This fixes the issue where client portal activities try to insert NULL project_id into project_logs

-- Drop and recreate the trigger function without project_logs insertion
DROP FUNCTION IF EXISTS trigger_log_client_portal_activity() CASCADE;

CREATE OR REPLACE FUNCTION trigger_log_client_portal_activity()
RETURNS TRIGGER AS $$
DECLARE
    activity_description TEXT;
BEGIN
    -- Client portal activities don't need to be logged in project_logs
    -- since they are not associated with specific projects.
    -- The activities are already tracked in their respective tables with audit fields.
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Only recreate triggers for tables that actually exist
-- Based on the existing tables: client_portal_services, client_portal_requests, client_portal_invoices

CREATE TRIGGER trigger_log_client_portal_services_activity
    AFTER INSERT OR UPDATE OR DELETE ON client_portal_services
    FOR EACH ROW EXECUTE FUNCTION trigger_log_client_portal_activity();

CREATE TRIGGER trigger_log_client_portal_requests_activity
    AFTER INSERT OR UPDATE OR DELETE ON client_portal_requests
    FOR EACH ROW EXECUTE FUNCTION trigger_log_client_portal_activity();

CREATE TRIGGER trigger_log_client_portal_invoices_activity
    AFTER INSERT OR UPDATE OR DELETE ON client_portal_invoices
    FOR EACH ROW EXECUTE FUNCTION trigger_log_client_portal_activity();