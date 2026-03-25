-- PPM Phase 2 Migrations — Run All
-- Execute in order against a PostgreSQL database with Worklenz schema already loaded.
-- Usage: psql -d worklenz -f 000_run_all.sql

\echo '=== PPM Phase 2 Migrations ==='

\echo '[1/9] ppm_clients...'
\i 001_ppm_clients.sql

\echo '[2/9] ppm_dropdown_options...'
\i 002_ppm_dropdown_options.sql

\echo '[3/9] ppm_deliverables...'
\i 003_ppm_deliverables.sql

\echo '[4/9] ppm_client_users...'
\i 004_ppm_client_users.sql

\echo '[5/9] ppm_retainers...'
\i 005_ppm_retainers.sql

\echo '[6/9] ppm_audit_log...'
\i 006_ppm_audit_log.sql

\echo '[7/9] ppm_routing_log...'
\i 007_ppm_routing_log.sql

\echo '[8/9] ppm_notify_trigger...'
\i 008_ppm_notify_trigger.sql

\echo '[9/9] ppm_rls_client_role...'
\i 009_ppm_rls_client_role.sql

\echo '=== All PPM migrations complete ==='
