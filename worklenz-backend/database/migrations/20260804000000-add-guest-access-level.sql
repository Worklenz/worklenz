-- Migration: Add Guest access level to projects
-- Date: 2026-08-04
-- Description: Add GUEST as a new project access level for external collaborators with limited permissions

-- Insert GUEST access level
INSERT INTO project_access_levels (name, key)
VALUES ('Guest', 'GUEST')
ON CONFLICT (key) DO NOTHING;

-- Create rollback script (comment this out in production)
-- DELETE FROM project_access_levels WHERE key = 'GUEST';
