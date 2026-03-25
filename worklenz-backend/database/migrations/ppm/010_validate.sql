-- PPM Phase 2 Migration Validation
-- Run after 000_run_all.sql to verify all tables, indexes, triggers, and policies exist.

\echo '=== PPM Migration Validation ==='

-- Check all PPM tables exist
\echo 'Tables:'
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'ppm_%'
ORDER BY table_name;

-- Check all PPM views exist
\echo 'Views:'
SELECT table_name
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name LIKE 'ppm_%'
ORDER BY table_name;

-- Check RLS is enabled
\echo 'RLS-enabled tables:'
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname LIKE 'ppm_%' AND relrowsecurity = TRUE;

-- Check RLS policies
\echo 'RLS policies:'
SELECT pol.polname, cls.relname AS table_name
FROM pg_policy pol
JOIN pg_class cls ON pol.polrelid = cls.oid
WHERE cls.relname LIKE 'ppm_%';

-- Check triggers
\echo 'Triggers:'
SELECT tgname, relname AS table_name
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
WHERE c.relname LIKE 'ppm_%'
  AND NOT tgisinternal;

-- Check PPM functions
\echo 'Functions:'
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE 'ppm_%'
ORDER BY routine_name;

-- Check dropdown seed data
\echo 'Dropdown options by category:'
SELECT category, COUNT(*) AS count
FROM ppm_dropdown_options
GROUP BY category
ORDER BY category;

-- Check ppm_client_role exists
\echo 'Client role:'
SELECT rolname FROM pg_roles WHERE rolname = 'ppm_client_role';

-- Quick smoke test: insert + verify triggers fire
\echo 'Smoke test: insert client + deliverable...'
INSERT INTO ppm_clients (id, name) VALUES ('bbbbbbbb-0000-0000-0000-000000000001', 'Validation Client');

INSERT INTO ppm_deliverables (id, title, client_id, status)
VALUES ('cccccccc-0000-0000-0000-000000000001', 'Validation Deliverable',
        'bbbbbbbb-0000-0000-0000-000000000001', 'queued');

-- Verify audit log entry was created by trigger
SELECT entity_type, action, details->>'title' AS title
FROM ppm_audit_log
WHERE entity_id = 'cccccccc-0000-0000-0000-000000000001';

-- Test status change → routing log + notify
UPDATE ppm_deliverables SET status = 'client_review'
WHERE id = 'cccccccc-0000-0000-0000-000000000001';

SELECT source_entity, action, status
FROM ppm_routing_log
WHERE source_id = 'cccccccc-0000-0000-0000-000000000001';

-- Test month_completed auto-set on approval
UPDATE ppm_deliverables SET status = 'approved'
WHERE id = 'cccccccc-0000-0000-0000-000000000001';

SELECT title, status, month_completed
FROM ppm_deliverables
WHERE id = 'cccccccc-0000-0000-0000-000000000001';

-- Cleanup smoke test data
DELETE FROM ppm_routing_log WHERE source_id = 'cccccccc-0000-0000-0000-000000000001';
DELETE FROM ppm_audit_log WHERE entity_id = 'cccccccc-0000-0000-0000-000000000001';
DELETE FROM ppm_deliverables WHERE id = 'cccccccc-0000-0000-0000-000000000001';
DELETE FROM ppm_clients WHERE id = 'bbbbbbbb-0000-0000-0000-000000000001';

\echo '=== Validation complete ==='
