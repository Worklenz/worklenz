-- Migration: Create Client Portal Database Triggers
-- Description: Creates database triggers for client portal operations
-- Date: 2025-07-16
-- Version: 2.2.0

-- Trigger function to automatically generate request numbers
CREATE OR REPLACE FUNCTION trigger_generate_request_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.req_no IS NULL THEN
        NEW.req_no := generate_request_number(NEW.organization_team_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to automatically generate invoice numbers
CREATE OR REPLACE FUNCTION trigger_generate_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.invoice_no IS NULL THEN
        NEW.invoice_no := generate_invoice_number(NEW.organization_team_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to update updated_at timestamp
CREATE OR REPLACE FUNCTION trigger_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to log client portal activities
CREATE OR REPLACE FUNCTION trigger_log_client_portal_activity()
RETURNS TRIGGER AS $$
DECLARE
    activity_description TEXT;
    activity_type TEXT;
BEGIN
    -- Determine activity type and description based on operation
    IF TG_OP = 'INSERT' THEN
        activity_type := 'created';
        CASE TG_TABLE_NAME
            WHEN 'client_portal_requests' THEN
                activity_description := 'New service request created: ' || NEW.req_no;
            WHEN 'client_portal_invoices' THEN
                activity_description := 'New invoice created: ' || NEW.invoice_no;
            WHEN 'client_portal_services' THEN
                activity_description := 'New service created: ' || NEW.name;
            WHEN 'client_relationships' THEN
                activity_description := 'Client relationship established';
            ELSE
                activity_description := 'New ' || TG_TABLE_NAME || ' record created';
        END CASE;
    ELSIF TG_OP = 'UPDATE' THEN
        activity_type := 'updated';
        CASE TG_TABLE_NAME
            WHEN 'client_portal_requests' THEN
                activity_description := 'Service request updated: ' || NEW.req_no;
            WHEN 'client_portal_invoices' THEN
                activity_description := 'Invoice updated: ' || NEW.invoice_no;
            WHEN 'client_portal_services' THEN
                activity_description := 'Service updated: ' || NEW.name;
            ELSE
                activity_description := TG_TABLE_NAME || ' record updated';
        END CASE;
    ELSIF TG_OP = 'DELETE' THEN
        activity_type := 'deleted';
        CASE TG_TABLE_NAME
            WHEN 'client_portal_requests' THEN
                activity_description := 'Service request deleted: ' || OLD.req_no;
            WHEN 'client_portal_invoices' THEN
                activity_description := 'Invoice deleted: ' || OLD.invoice_no;
            WHEN 'client_portal_services' THEN
                activity_description := 'Service deleted: ' || OLD.name;
            ELSE
                activity_description := TG_TABLE_NAME || ' record deleted';
        END CASE;
    END IF;

    -- Skip project logs for client portal activities since they don't have an associated project
    -- Client portal activities are logged in their respective tables with audit fields
    -- TODO: Consider creating a separate client_portal_activity_logs table if detailed logging is needed

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger function to validate client portal data
CREATE OR REPLACE FUNCTION trigger_validate_client_portal_data()
RETURNS TRIGGER AS $$
BEGIN
    -- Validate request data
    IF TG_TABLE_NAME = 'client_portal_requests' THEN
        -- Ensure request belongs to a valid service
        IF NOT EXISTS (
            SELECT 1 FROM client_portal_services 
            WHERE id = NEW.service_id 
              AND organization_team_id = NEW.organization_team_id
        ) THEN
            RAISE EXCEPTION 'Invalid service_id for this organization';
        END IF;

        -- Ensure request belongs to a valid client
        IF NOT EXISTS (
            SELECT 1 FROM clients 
            WHERE id = NEW.client_id 
              AND team_id = NEW.organization_team_id
        ) THEN
            RAISE EXCEPTION 'Invalid client_id for this organization';
        END IF;
    END IF;

    -- Validate invoice data
    IF TG_TABLE_NAME = 'client_portal_invoices' THEN
        -- Ensure invoice belongs to a valid client
        IF NOT EXISTS (
            SELECT 1 FROM clients 
            WHERE id = NEW.client_id 
              AND team_id = NEW.organization_team_id
        ) THEN
            RAISE EXCEPTION 'Invalid client_id for this organization';
        END IF;

        -- Validate amount
        IF NEW.amount <= 0 THEN
            RAISE EXCEPTION 'Invoice amount must be greater than 0';
        END IF;
    END IF;

    -- Validate service data
    IF TG_TABLE_NAME = 'client_portal_services' THEN
        -- Ensure service name is not empty
        IF NEW.name IS NULL OR TRIM(NEW.name) = '' THEN
            RAISE EXCEPTION 'Service name cannot be empty';
        END IF;

        -- Ensure service belongs to the correct organization
        IF NEW.team_id != NEW.organization_team_id THEN
            RAISE EXCEPTION 'Service team_id must match organization_team_id';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to handle client relationship changes
CREATE OR REPLACE FUNCTION trigger_handle_client_relationship_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- When a client relationship is created, update client portal enabled status
    IF TG_OP = 'INSERT' THEN
        UPDATE clients 
        SET client_portal_enabled = TRUE
        WHERE id = NEW.client_id;
        
        -- Update user's client portal enabled status
        UPDATE users 
        SET is_client_portal_enabled = TRUE
        WHERE id = NEW.user_id;
    END IF;

    -- When a client relationship is deactivated, check if client should be disabled
    IF TG_OP = 'UPDATE' AND OLD.is_active = TRUE AND NEW.is_active = FALSE THEN
        -- Check if this was the last active relationship for this client
        IF NOT EXISTS (
            SELECT 1 FROM client_relationships 
            WHERE client_id = NEW.client_id 
              AND is_active = TRUE
        ) THEN
            UPDATE clients 
            SET client_portal_enabled = FALSE
            WHERE id = NEW.client_id;
        END IF;

        -- Check if this was the last active relationship for this user
        IF NOT EXISTS (
            SELECT 1 FROM client_relationships 
            WHERE user_id = NEW.user_id 
              AND is_active = TRUE
        ) THEN
            UPDATE users 
            SET is_client_portal_enabled = FALSE
            WHERE id = NEW.user_id;
        END IF;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers

-- Request number generation trigger
CREATE TRIGGER trigger_client_portal_requests_number
    BEFORE INSERT ON client_portal_requests
    FOR EACH ROW
    EXECUTE FUNCTION trigger_generate_request_number();

-- Invoice number generation trigger
CREATE TRIGGER trigger_client_portal_invoices_number
    BEFORE INSERT ON client_portal_invoices
    FOR EACH ROW
    EXECUTE FUNCTION trigger_generate_invoice_number();

-- Updated timestamp triggers
CREATE TRIGGER trigger_client_portal_services_updated_at
    BEFORE UPDATE ON client_portal_services
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_updated_at();

CREATE TRIGGER trigger_client_portal_requests_updated_at
    BEFORE UPDATE ON client_portal_requests
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_updated_at();

CREATE TRIGGER trigger_client_portal_invoices_updated_at
    BEFORE UPDATE ON client_portal_invoices
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_updated_at();

CREATE TRIGGER trigger_client_portal_settings_updated_at
    BEFORE UPDATE ON client_portal_settings
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_updated_at();

CREATE TRIGGER trigger_client_relationships_updated_at
    BEFORE UPDATE ON client_relationships
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_updated_at();

-- Activity logging triggers
CREATE TRIGGER trigger_log_client_portal_services_activity
    AFTER INSERT OR UPDATE OR DELETE ON client_portal_services
    FOR EACH ROW
    EXECUTE FUNCTION trigger_log_client_portal_activity();

CREATE TRIGGER trigger_log_client_portal_requests_activity
    AFTER INSERT OR UPDATE OR DELETE ON client_portal_requests
    FOR EACH ROW
    EXECUTE FUNCTION trigger_log_client_portal_activity();

CREATE TRIGGER trigger_log_client_portal_invoices_activity
    AFTER INSERT OR UPDATE OR DELETE ON client_portal_invoices
    FOR EACH ROW
    EXECUTE FUNCTION trigger_log_client_portal_activity();

CREATE TRIGGER trigger_log_client_relationships_activity
    AFTER INSERT OR UPDATE OR DELETE ON client_relationships
    FOR EACH ROW
    EXECUTE FUNCTION trigger_log_client_portal_activity();

-- Data validation triggers
CREATE TRIGGER trigger_validate_client_portal_requests
    BEFORE INSERT OR UPDATE ON client_portal_requests
    FOR EACH ROW
    EXECUTE FUNCTION trigger_validate_client_portal_data();

CREATE TRIGGER trigger_validate_client_portal_invoices
    BEFORE INSERT OR UPDATE ON client_portal_invoices
    FOR EACH ROW
    EXECUTE FUNCTION trigger_validate_client_portal_data();

CREATE TRIGGER trigger_validate_client_portal_services
    BEFORE INSERT OR UPDATE ON client_portal_services
    FOR EACH ROW
    EXECUTE FUNCTION trigger_validate_client_portal_data();

-- Client relationship management triggers
CREATE TRIGGER trigger_handle_client_relationships
    AFTER INSERT OR UPDATE ON client_relationships
    FOR EACH ROW
    EXECUTE FUNCTION trigger_handle_client_relationship_changes(); 