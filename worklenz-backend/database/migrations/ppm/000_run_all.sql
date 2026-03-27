-- PPM Phase 2 Migrations — Run All
-- Execute in order against a PostgreSQL database with Worklenz schema already loaded.
-- Usage: psql -d worklenz -f 000_run_all.sql

\echo '=== PPM Phase 2 Migrations ==='

\echo '[1/19] ppm_clients...'
\i 001_ppm_clients.sql

\echo '[2/19] ppm_dropdown_options...'
\i 002_ppm_dropdown_options.sql

\echo '[3/19] ppm_deliverables...'
\i 003_ppm_deliverables.sql

\echo '[4/19] ppm_client_users...'
\i 004_ppm_client_users.sql

\echo '[5/19] ppm_retainers...'
\i 005_ppm_retainers.sql

\echo '[6/19] ppm_audit_log...'
\i 006_ppm_audit_log.sql

\echo '[7/19] ppm_routing_log...'
\i 007_ppm_routing_log.sql

\echo '[8/19] ppm_notify_trigger...'
\i 008_ppm_notify_trigger.sql

\echo '[9/19] ppm_rls_client_role...'
\i 009_ppm_rls_client_role.sql

\echo '[10/19] ppm_fix_magic_link_rls...'
\i 010_ppm_fix_magic_link_rls.sql

\echo '[11/19] ppm_status_change_notify...'
\i 011_ppm_status_change_notify.sql

\echo '[12/19] ppm_code_review_fixes...'
\i 012_ppm_code_review_fixes.sql

\echo '[13/19] ppm_phase2_tables...'
\i 013_ppm_phase2_tables.sql

\echo '[14/19] ppm_system_user...'
\i 014_ppm_system_user.sql

\echo '[15/19] ppm_incoming_status...'
\i 015_ppm_incoming_status.sql

\echo '[16/19] ppm_status_sync_trigger...'
\i 016_ppm_status_sync_trigger.sql

\echo '[17/19] ppm_task_created_notify...'
\i 017_ppm_task_created_notify.sql

\echo '[18/19] ppm_feedback_reasons_seed...'
\i 018_ppm_feedback_reasons_seed.sql

\echo '[19/19] ppm_migrate_comments...'
\i 019_ppm_migrate_comments.sql

\echo '=== All PPM migrations complete ==='
