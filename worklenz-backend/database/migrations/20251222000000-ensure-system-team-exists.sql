-- Migration: Ensure system admin team exists
-- Date: 2025-12-22
-- Description: Creates the system admin team if it doesn't exist to prevent foreign key constraint violations

-- Create system user if it doesn't exist
INSERT INTO users (id, name, email, setup_completed, account_status)
VALUES (
    '00000000-0000-0000-0000-000000000000',
    'System Administrator',
    COALESCE((SELECT value FROM sys_config WHERE key = 'ADMIN_EMAIL'), 'admin@system.local'),
    true,
    'approved'
)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    email = EXCLUDED.email,
    setup_completed = EXCLUDED.setup_completed,
    account_status = EXCLUDED.account_status;

-- Create system team if it doesn't exist
INSERT INTO teams (id, name, user_id)
VALUES (
    '00000000-0000-0000-0000-000000000000',
    'System Administration Team',
    '00000000-0000-0000-0000-000000000000'
)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    user_id = EXCLUDED.user_id;

-- Create team member entry for system admin if it doesn't exist
INSERT INTO team_members (user_id, team_id, active)
SELECT
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000000',
    true
WHERE NOT EXISTS (
    SELECT 1 FROM team_members
    WHERE user_id = '00000000-0000-0000-0000-000000000000'
    AND team_id = '00000000-0000-0000-0000-000000000000'
);

-- Record this migration
INSERT INTO schema_migrations (migration_name, applied_at)
VALUES ('20251222000000-ensure-system-team-exists.sql', NOW())
ON CONFLICT (migration_name) DO NOTHING;
