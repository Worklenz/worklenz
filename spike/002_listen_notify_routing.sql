-- Kill-Shot Spike 1c: LISTEN/NOTIFY for Real-Time Routing
-- Proves: status changes can trigger routing without PG triggers on Worklenz tables

-- PPM routing log
CREATE TABLE IF NOT EXISTS ppm_routing_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_entity TEXT NOT NULL,
    source_id UUID NOT NULL,
    action TEXT NOT NULL,
    target_entity TEXT,
    target_id UUID,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','failed')),
    error_details TEXT,
    sequence_number BIGSERIAL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Function to notify on deliverable status change
-- Called by application code (NOT a trigger on Worklenz tables)
CREATE OR REPLACE FUNCTION ppm_notify_status_change(
    p_deliverable_id UUID,
    p_old_status TEXT,
    p_new_status TEXT,
    p_client_id UUID
) RETURNS void AS $$
BEGIN
    -- Log the routing event
    INSERT INTO ppm_routing_log (source_entity, source_id, action, status)
    VALUES ('ppm_deliverables', p_deliverable_id,
            'status_change:' || p_old_status || '->' || p_new_status,
            'pending');

    -- Fire NOTIFY with JSON payload
    PERFORM pg_notify('ppm_status_change', json_build_object(
        'deliverable_id', p_deliverable_id,
        'old_status', p_old_status,
        'new_status', p_new_status,
        'client_id', p_client_id,
        'timestamp', NOW()
    )::text);
END;
$$ LANGUAGE plpgsql;

-- Optional: trigger on ppm_deliverables (our OWN table, not Worklenz core)
CREATE OR REPLACE FUNCTION ppm_deliverables_status_trigger() RETURNS trigger AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        PERFORM ppm_notify_status_change(NEW.id, OLD.status, NEW.status, NEW.client_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ppm_deliverables_status_change ON ppm_deliverables;
CREATE TRIGGER ppm_deliverables_status_change
    AFTER UPDATE ON ppm_deliverables
    FOR EACH ROW
    EXECUTE FUNCTION ppm_deliverables_status_trigger();
