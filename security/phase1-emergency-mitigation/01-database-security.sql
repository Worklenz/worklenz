-- ============================================================================
-- PHASE 1: DATABASE SECURITY HARDENING
-- ============================================================================
-- This script implements emergency database security measures
-- Run this on your Azure PostgreSQL server immediately
-- ============================================================================

-- ============================================================================
-- 1. ENABLE QUERY LOGGING (Critical for detecting attacks)
-- ============================================================================

-- Enable logging of all statements (temporary - for attack detection)
ALTER SYSTEM SET log_statement = 'all';

-- Log queries taking longer than 0ms (all queries)
ALTER SYSTEM SET log_min_duration_statement = 0;

-- Log connections and disconnections
ALTER SYSTEM SET log_connections = 'on';
ALTER SYSTEM SET log_disconnections = 'on';

-- Log failed authentication attempts
ALTER SYSTEM SET log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h ';

-- Reload configuration
SELECT pg_reload_conf();

-- ============================================================================
-- 2. CREATE RESTRICTED APPLICATION USER
-- ============================================================================

-- Create new application user with limited privileges
-- IMPORTANT: Replace '<STRONG_PASSWORD_HERE>' with a strong password (32+ characters)
-- Generate using: openssl rand -base64 32

DO $$
BEGIN
    -- Drop user if exists (for re-running script)
    IF EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'worklenz_app') THEN
        RAISE NOTICE 'User worklenz_app already exists, dropping...';
        REASSIGN OWNED BY worklenz_app TO postgres;
        DROP OWNED BY worklenz_app;
        DROP USER worklenz_app;
    END IF;
    
    -- Create new user
    CREATE USER worklenz_app WITH PASSWORD '<STRONG_PASSWORD_HERE>';
    RAISE NOTICE 'Created user: worklenz_app';
END $$;

-- Grant connection to database
GRANT CONNECT ON DATABASE worklenz_db TO worklenz_app;

-- Grant schema usage
GRANT USAGE ON SCHEMA public TO worklenz_app;

-- Grant SELECT, INSERT, UPDATE, DELETE on all existing tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO worklenz_app;

-- Grant usage on sequences (for auto-increment columns)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO worklenz_app;

-- Grant execute on functions (needed for stored procedures)
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO worklenz_app;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO worklenz_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO worklenz_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO worklenz_app;

-- CRITICAL: Revoke dangerous privileges
REVOKE CREATE ON SCHEMA public FROM worklenz_app;
REVOKE DROP ON ALL TABLES IN SCHEMA public FROM worklenz_app;
REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM worklenz_app;
REVOKE REFERENCES ON ALL TABLES IN SCHEMA public FROM worklenz_app;
REVOKE TRIGGER ON ALL TABLES IN SCHEMA public FROM worklenz_app;

-- ============================================================================
-- SYSTEM TABLES: READ-ONLY RESTRICTIONS
-- ============================================================================
-- These tables should only allow SELECT operations (matching existing setup)

REVOKE ALL PRIVILEGES ON task_priorities FROM worklenz_app;
GRANT SELECT ON task_priorities TO worklenz_app;

REVOKE ALL PRIVILEGES ON project_access_levels FROM worklenz_app;
GRANT SELECT ON project_access_levels TO worklenz_app;

REVOKE ALL PRIVILEGES ON timezones FROM worklenz_app;
GRANT SELECT ON timezones TO worklenz_app;

REVOKE ALL PRIVILEGES ON worklenz_alerts FROM worklenz_app;
GRANT SELECT ON worklenz_alerts TO worklenz_app;

REVOKE ALL PRIVILEGES ON sys_task_status_categories FROM worklenz_app;
GRANT SELECT ON sys_task_status_categories TO worklenz_app;

REVOKE ALL PRIVILEGES ON sys_project_statuses FROM worklenz_app;
GRANT SELECT ON sys_project_statuses TO worklenz_app;

REVOKE ALL PRIVILEGES ON sys_project_healths FROM worklenz_app;
GRANT SELECT ON sys_project_healths TO worklenz_app;

-- ============================================================================
-- 3. CREATE READ-ONLY USER FOR REPORTING
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'worklenz_readonly') THEN
        RAISE NOTICE 'User worklenz_readonly already exists, dropping...';
        REASSIGN OWNED BY worklenz_readonly TO postgres;
        DROP OWNED BY worklenz_readonly;
        DROP USER worklenz_readonly;
    END IF;
    
    CREATE USER worklenz_readonly WITH PASSWORD '<STRONG_PASSWORD_HERE>';
    RAISE NOTICE 'Created user: worklenz_readonly';
END $$;

-- Grant connection and schema usage
GRANT CONNECT ON DATABASE worklenz_db TO worklenz_readonly;
GRANT USAGE ON SCHEMA public TO worklenz_readonly;

-- Grant SELECT only on all tables
GRANT SELECT ON ALL TABLES IN SCHEMA public TO worklenz_readonly;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO worklenz_readonly;

-- ============================================================================
-- 4. AUDIT CURRENT PERMISSIONS
-- ============================================================================

-- Show all users and their privileges
SELECT 
    grantee,
    table_schema,
    table_name,
    privilege_type
FROM information_schema.table_privileges
WHERE grantee IN ('worklenz_app', 'worklenz_readonly', 'postgres')
    AND table_schema = 'public'
ORDER BY grantee, table_name, privilege_type;

-- ============================================================================
-- 5. ENABLE CONNECTION LIMITS
-- ============================================================================

-- Limit connections for application user
ALTER USER worklenz_app CONNECTION LIMIT 50;
ALTER USER worklenz_readonly CONNECTION LIMIT 10;

-- ============================================================================
-- 6. CREATE AUDIT LOG TABLE (Optional but recommended)
-- ============================================================================

CREATE TABLE IF NOT EXISTS security_audit_log (
    id SERIAL PRIMARY KEY,
    event_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_name TEXT,
    database_name TEXT,
    client_address INET,
    query_text TEXT,
    event_type TEXT,
    success BOOLEAN
);

-- Grant insert to application user for logging
GRANT INSERT ON security_audit_log TO worklenz_app;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_security_audit_log_event_time ON security_audit_log(event_time DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_log_user_name ON security_audit_log(user_name);

-- ============================================================================
-- 7. VERIFY CONFIGURATION
-- ============================================================================

-- Check current settings
SELECT name, setting, source 
FROM pg_settings 
WHERE name IN (
    'log_statement',
    'log_min_duration_statement',
    'log_connections',
    'log_disconnections'
);

-- List all database users
SELECT 
    usename as username,
    usesuper as is_superuser,
    usecreatedb as can_create_db,
    useconnlimit as connection_limit,
    valuntil as password_expiry
FROM pg_user
ORDER BY usename;

-- ============================================================================
-- IMPORTANT NOTES:
-- ============================================================================
-- 1. Replace '<STRONG_PASSWORD_HERE>' with actual strong passwords
-- 2. Store passwords in Azure Key Vault, not in code
-- 3. Update application connection string to use 'worklenz_app' user
-- 4. Monitor logs for suspicious activity
-- 5. Review audit logs daily during incident response
-- ============================================================================

-- ============================================================================
-- ROLLBACK INSTRUCTIONS (if needed):
-- ============================================================================
-- To revert changes:
-- ALTER SYSTEM RESET log_statement;
-- ALTER SYSTEM RESET log_min_duration_statement;
-- SELECT pg_reload_conf();
-- DROP USER IF EXISTS worklenz_app;
-- DROP USER IF EXISTS worklenz_readonly;
-- ============================================================================
