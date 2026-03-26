-- PPM Migration 012: Code review fixes
--
-- 1. Fix magic link function: return NULL (not dummy token) for unknown emails
--    so the application layer can distinguish real vs non-existent users and
--    avoid sending branded emails to arbitrary addresses (spam vector).
--    Anti-enumeration is handled at the HTTP layer (same response regardless).
--
-- 2. Fix trigger function name collision: migration 008 and 011 both defined
--    ppm_notify_status_change(). Rename the task-level trigger function to
--    ppm_notify_task_status_change() so both deliverable and task triggers coexist.

-- ============================================================
-- 1. Fix magic link: NULL for unknown emails
-- ============================================================

CREATE OR REPLACE FUNCTION ppm_generate_magic_link(p_email TEXT, p_expires_in INTERVAL DEFAULT '30 minutes')
RETURNS TEXT AS $$
DECLARE
    v_token TEXT;
    v_client_id UUID;
BEGIN
    v_token := encode(gen_random_bytes(32), 'hex');

    -- Look up the client_id for this email.
    -- Runs as function owner (SECURITY DEFINER) so bypasses RLS.
    SELECT client_id INTO v_client_id
    FROM ppm_client_users
    WHERE email = p_email
      AND deactivated_at IS NULL;

    IF v_client_id IS NULL THEN
        -- Email not found — return NULL so the app layer knows not to send email.
        -- Anti-enumeration is handled by the HTTP response (same message either way).
        RETURN NULL;
    END IF;

    -- Set the RLS context so the policy check passes on UPDATE.
    PERFORM set_config('ppm.current_client_id', v_client_id::TEXT, true);

    UPDATE ppm_client_users
    SET magic_link_token = v_token,
        magic_link_expires_at = NOW() + p_expires_in
    WHERE email = p_email
      AND deactivated_at IS NULL;

    IF NOT FOUND THEN
        -- Should not happen after the SELECT above, but be safe.
        RETURN NULL;
    END IF;

    RETURN v_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Re-apply permission grants
REVOKE ALL ON FUNCTION ppm_generate_magic_link(TEXT, INTERVAL) FROM PUBLIC;

-- ============================================================
-- 2. Fix trigger function name collision (008 vs 011)
-- ============================================================

-- Drop the task-level trigger that uses the wrong function name
DROP TRIGGER IF EXISTS ppm_task_status_change_trigger ON tasks;

-- Create the correctly-named function for task status changes
CREATE OR REPLACE FUNCTION ppm_notify_task_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status_id IS DISTINCT FROM NEW.status_id THEN
    PERFORM pg_notify(
      'ppm_task_status_change',
      json_build_object(
        'task_id', NEW.id,
        'project_id', NEW.project_id,
        'old_status_id', OLD.status_id,
        'new_status_id', NEW.status_id,
        'updated_at', NOW()
      )::text
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ppm_task_status_change_trigger
  AFTER UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION ppm_notify_task_status_change();

-- Restore the deliverable-level function from migration 008 (which 011 overwrote)
CREATE OR REPLACE FUNCTION ppm_notify_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        -- Log to routing_log
        INSERT INTO ppm_routing_log (source_entity, source_id, action)
        VALUES (
            'ppm_deliverables',
            NEW.id,
            'status_change:' || OLD.status || '->' || NEW.status
        );

        -- Fire NOTIFY for real-time routing
        PERFORM pg_notify('ppm_status_change', json_build_object(
            'deliverable_id', NEW.id,
            'old_status', OLD.status,
            'new_status', NEW.status,
            'client_id', NEW.client_id,
            'visibility', NEW.visibility,
            'timestamp', NOW()
        )::TEXT);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION ppm_notify_task_status_change IS 'Fires PG NOTIFY on ppm_task_status_change channel when a Worklenz task status_id changes.';
COMMENT ON FUNCTION ppm_notify_status_change IS 'Fires PG NOTIFY on ppm_status_change + logs to ppm_routing_log on deliverable status changes.';
