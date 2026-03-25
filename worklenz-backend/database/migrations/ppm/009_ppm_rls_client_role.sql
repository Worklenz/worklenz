-- PPM Phase 2 Migration 009: RLS client role setup
-- Creates the ppm_client_role used by client portal connections.
-- Internal Worklenz backend (table owner) bypasses RLS by default.

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ppm_client_role') THEN
        CREATE ROLE ppm_client_role LOGIN;
    END IF;
END$$;

-- Grant read access to client-facing tables
GRANT SELECT ON ppm_deliverables TO ppm_client_role;
GRANT SELECT ON ppm_client_users TO ppm_client_role;
GRANT SELECT ON ppm_clients TO ppm_client_role;
GRANT SELECT ON ppm_dropdown_options TO ppm_client_role;
GRANT SELECT ON ppm_retainer_utilization TO ppm_client_role;

-- Client users can update their own deliverable status (approve/reject)
GRANT UPDATE (status) ON ppm_deliverables TO ppm_client_role;

-- Client users can insert audit log entries (feedback)
GRANT INSERT ON ppm_audit_log TO ppm_client_role;
