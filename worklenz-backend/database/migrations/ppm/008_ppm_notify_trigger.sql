-- PPM Phase 2 Migration 008: LISTEN/NOTIFY trigger on ppm_deliverables
-- Fires PG NOTIFY on status changes — proven in spike 002.
-- The Node.js listener (wired into app.ts) picks these up and routes to Socket.IO.

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

CREATE TRIGGER ppm_deliverables_status_change
    AFTER UPDATE ON ppm_deliverables
    FOR EACH ROW EXECUTE FUNCTION ppm_notify_status_change();

-- Also log new deliverable creation
CREATE OR REPLACE FUNCTION ppm_notify_deliverable_created()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO ppm_audit_log (entity_type, entity_id, action, actor_type, details)
    VALUES (
        'deliverable',
        NEW.id,
        'created',
        'system',
        json_build_object(
            'title', NEW.title,
            'client_id', NEW.client_id,
            'status', NEW.status
        )::JSONB
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ppm_deliverables_created
    AFTER INSERT ON ppm_deliverables
    FOR EACH ROW EXECUTE FUNCTION ppm_notify_deliverable_created();

COMMENT ON FUNCTION ppm_notify_status_change IS 'Fires PG NOTIFY + logs to routing_log on deliverable status changes.';
