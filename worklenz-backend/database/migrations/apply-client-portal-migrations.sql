-- Apply Client Portal Migrations
-- This script applies all necessary migrations for the Client Portal feature
-- Run this with: psql -U postgres -d worklenz_db -f database/migrations/apply-client-portal-migrations.sql

\echo 'Starting Client Portal Migrations...'
\echo ''

-- Migration 1: Create client invitations and users tables
\echo 'Applying: 003-create-client-invitations.sql'
\i database/migrations/release-v2.2.0/003-create-client-invitations.sql

-- Migration 2: Create full client portal tables
\echo 'Applying: 20250101000001-create-client-portal-tables.sql'
\i database/migrations/release-v2.2.0/20250101000001-create-client-portal-tables.sql

-- Migration 3: Enhance existing tables
\echo 'Applying: 20250101000002-enhance-existing-tables.sql'
\i database/migrations/release-v2.2.0/20250101000002-enhance-existing-tables.sql

-- Migration 4: Create client portal functions
\echo 'Applying: 20250101000003-create-client-portal-functions.sql'
\i database/migrations/release-v2.2.0/20250101000003-create-client-portal-functions.sql

-- Migration 5: Create client portal triggers
\echo 'Applying: 20250101000004-create-client-portal-triggers.sql'
\i database/migrations/release-v2.2.0/20250101000004-create-client-portal-triggers.sql

-- Migration 6: Create client portal views
\echo 'Applying: 20250101000005-create-client-portal-views.sql'
\i database/migrations/release-v2.2.0/20250101000005-create-client-portal-views.sql

-- Migration 7: Seed client portal data
\echo 'Applying: 20250101000006-seed-client-portal-data.sql'
\i database/migrations/release-v2.2.0/20250101000006-seed-client-portal-data.sql

-- Migration 8: Create message reads table
\echo 'Applying: 20250101000007-create-message-reads-table.sql'
\i database/migrations/release-v2.2.0/20250101000007-create-message-reads-table.sql

-- Migration 9: Fix client portal triggers
\echo 'Applying: 20250718000001-fix-client-portal-triggers.sql'
\i database/migrations/release-v2.2.0/20250718000001-fix-client-portal-triggers.sql

-- Migration 10: Add organization invitations
\echo 'Applying: 005-create-organization-invitations.sql'
\i database/migrations/release-v2.2.0/005-create-organization-invitations.sql


\echo ''
\echo 'Client Portal Migrations Completed Successfully!'
\echo 'You can now use the client portal forgot password feature.'
