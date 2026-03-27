-- PPM Migration 019: Migrate Phase 1 audit_log comments to ppm_comments
--
-- Phase 1 stored comments as ppm_audit_log rows with action='comment'.
-- Phase 2 uses a dedicated ppm_comments table with author_type tracking.
-- This migrates existing comments, preserving timestamps and authorship.

BEGIN;

-- Migrate comments from audit_log to ppm_comments
-- audit_log schema: entity_type, entity_id, action, actor_id, actor_type, details, created_at
-- We only migrate rows where action = 'comment' and entity_type = 'deliverable'
INSERT INTO ppm_comments (task_id, deliverable_id, author_id, author_type, author_name, body, created_at)
SELECT
    d.worklenz_task_id,
    al.entity_id,
    al.actor_id,
    CASE al.actor_type
        WHEN 'client_user' THEN 'client'
        WHEN 'internal_user' THEN 'partner'  -- default to partner; can't distinguish partner vs employee from audit_log
        ELSE 'partner'
    END,
    COALESCE(
        -- Try to get name from users table (internal)
        (SELECT u.name FROM users u WHERE u.id = al.actor_id),
        -- Try to get name from ppm_client_users (client)
        (SELECT COALESCE(cu.display_name, cu.email) FROM ppm_client_users cu WHERE cu.id = al.actor_id),
        'Unknown'
    ),
    COALESCE(al.details->>'body', al.details->>'comment', al.details->>'text', ''),
    al.created_at
FROM ppm_audit_log al
JOIN ppm_deliverables d ON d.id = al.entity_id
WHERE al.action = 'comment'
  AND al.entity_type = 'deliverable'
  AND d.worklenz_task_id IS NOT NULL  -- only migrate comments for tasks that have Worklenz links
  AND NOT EXISTS (
      -- Idempotent: skip if already migrated (match on deliverable + author + timestamp)
      SELECT 1 FROM ppm_comments pc
      WHERE pc.deliverable_id = al.entity_id
        AND pc.author_id = al.actor_id
        AND pc.created_at = al.created_at
  );

-- Log how many were migrated
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count FROM ppm_comments;
    RAISE NOTICE 'ppm_comments now has % rows after migration', v_count;
END;
$$;

COMMIT;
