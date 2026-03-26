-- PPM Phase 2 Migrations — Run All
-- Execute in order against a PostgreSQL database with Worklenz schema already loaded.
-- Usage: psql -d worklenz -f 000_run_all.sql

\echo '=== PPM Phase 2 Migrations ==='

\echo '[1/12] ppm_clients...'
\i 001_ppm_clients.sql

\echo '[2/12] ppm_dropdown_options...'
\i 002_ppm_dropdown_options.sql

\echo '[3/12] ppm_deliverables...'
\i 003_ppm_deliverables.sql

\echo '[4/12] ppm_client_users...'
\i 004_ppm_client_users.sql

\echo '[5/12] ppm_retainers...'
\i 005_ppm_retainers.sql

\echo '[6/12] ppm_audit_log...'
\i 006_ppm_audit_log.sql

\echo '[7/12] ppm_routing_log...'
\i 007_ppm_routing_log.sql

\echo '[8/12] ppm_notify_trigger...'
\i 008_ppm_notify_trigger.sql

\echo '[9/12] ppm_rls_client_role...'
\i 009_ppm_rls_client_role.sql

\echo '[10/12] ppm_fix_magic_link_rls...'
\i 010_ppm_fix_magic_link_rls.sql

\echo '[11/12] ppm_status_change_notify...'
\i 011_ppm_status_change_notify.sql

\echo '[12/12] ppm_code_review_fixes...'
\i 012_ppm_code_review_fixes.sql

\echo '=== All PPM migrations complete ==='
