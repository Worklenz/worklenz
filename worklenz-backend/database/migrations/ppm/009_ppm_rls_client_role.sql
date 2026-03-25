-- PPM Phase 2 Migration 009: RLS client role setup
-- Creates the ppm_client_role used by client portal connections.
-- Internal Worklenz backend (table owner) bypasses RLS by default.
--
-- SECURITY: All client-facing tables MUST have RLS enabled before granting
-- access to ppm_client_role. The application layer MUST set
-- ppm.current_client_id via SET LOCAL within a transaction before
-- executing any query as ppm_client_role.

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ppm_client_role') THEN
        CREATE ROLE ppm_client_role NOLOGIN;  -- NOLOGIN: only usable via SET ROLE from app
    END IF;
END$$;

-- ============================================================
-- Enable RLS on tables that were missing it
-- ============================================================

-- ppm_clients: client role must only see their own client record
ALTER TABLE ppm_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY ppm_clients_client_isolation ON ppm_clients
    FOR SELECT
    USING (id = current_setting('ppm.current_client_id')::UUID);

-- ppm_retainers: client role must only see retainers for their client
ALTER TABLE ppm_retainers ENABLE ROW LEVEL SECURITY;
CREATE POLICY ppm_retainers_client_isolation ON ppm_retainers
    FOR SELECT
    USING (client_id = current_setting('ppm.current_client_id')::UUID);

-- ppm_audit_log: add client_id column for RLS, client can only INSERT for their own client
ALTER TABLE ppm_audit_log ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES ppm_clients(id);
ALTER TABLE ppm_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY ppm_audit_log_client_insert ON ppm_audit_log
    FOR INSERT
    WITH CHECK (client_id = current_setting('ppm.current_client_id')::UUID);
CREATE POLICY ppm_audit_log_client_select ON ppm_audit_log
    FOR SELECT
    USING (client_id = current_setting('ppm.current_client_id')::UUID);

-- ppm_routing_log: no client access needed — do NOT grant to ppm_client_role
ALTER TABLE ppm_routing_log ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Fix existing RLS policies: add visibility filter + WITH CHECK
-- ============================================================

-- Drop and recreate deliverables policy with visibility filter
DROP POLICY IF EXISTS ppm_deliverables_client_isolation ON ppm_deliverables;
CREATE POLICY ppm_deliverables_client_select ON ppm_deliverables
    FOR SELECT
    USING (
        client_id = current_setting('ppm.current_client_id')::UUID
        AND visibility = 'client_visible'
    );
CREATE POLICY ppm_deliverables_client_update ON ppm_deliverables
    FOR UPDATE
    USING (
        client_id = current_setting('ppm.current_client_id')::UUID
        AND visibility = 'client_visible'
    )
    WITH CHECK (
        client_id = current_setting('ppm.current_client_id')::UUID
        AND visibility = 'client_visible'
    );

-- ============================================================
-- Grant minimal permissions
-- ============================================================
GRANT SELECT ON ppm_deliverables TO ppm_client_role;
GRANT SELECT ON ppm_client_users TO ppm_client_role;
GRANT SELECT ON ppm_clients TO ppm_client_role;
GRANT SELECT ON ppm_dropdown_options TO ppm_client_role;  -- shared reference data, no RLS needed
GRANT SELECT ON ppm_retainers TO ppm_client_role;
GRANT SELECT ON ppm_retainer_utilization TO ppm_client_role;

-- Client users can update status on client_visible deliverables only (RLS enforced above)
GRANT UPDATE (status) ON ppm_deliverables TO ppm_client_role;

-- Client users can insert audit log entries (feedback) — RLS enforces client_id match
GRANT INSERT ON ppm_audit_log TO ppm_client_role;
GRANT SELECT ON ppm_audit_log TO ppm_client_role;

-- ============================================================
-- Revoke public access to SECURITY DEFINER functions
-- ============================================================
REVOKE ALL ON FUNCTION ppm_generate_magic_link(TEXT, INTERVAL) FROM PUBLIC;
REVOKE ALL ON FUNCTION ppm_validate_magic_link(TEXT) FROM PUBLIC;
-- Only the application role (table owner) should call these
-- ppm_client_role gets validate only (for login flow)
GRANT EXECUTE ON FUNCTION ppm_validate_magic_link(TEXT) TO ppm_client_role;
