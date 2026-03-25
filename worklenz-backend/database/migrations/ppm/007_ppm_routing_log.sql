-- PPM Phase 2 Migration 007: ppm_routing_log
-- Tracks LISTEN/NOTIFY routing events for the 3-layer handoff model.
-- Each status change that crosses a visibility boundary gets logged here.

CREATE SEQUENCE IF NOT EXISTS ppm_routing_log_seq;

CREATE TABLE IF NOT EXISTS ppm_routing_log (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    source_entity   TEXT        NOT NULL,  -- 'ppm_deliverables'
    source_id       UUID        NOT NULL,
    action          TEXT        NOT NULL,  -- 'status_change:in_progress->client_review'
    target_entity   TEXT,                  -- 'socket_io', 'email', etc.
    target_id       UUID,                  -- recipient user/client_user id
    status          TEXT        NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'completed', 'failed')),
    error_details   TEXT,
    sequence_number BIGINT      NOT NULL DEFAULT nextval('ppm_routing_log_seq'),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);

CREATE INDEX idx_ppm_routing_source    ON ppm_routing_log (source_entity, source_id, sequence_number);
CREATE INDEX idx_ppm_routing_status    ON ppm_routing_log (status) WHERE status = 'pending';
CREATE INDEX idx_ppm_routing_created   ON ppm_routing_log (created_at DESC);

COMMENT ON TABLE ppm_routing_log IS 'Tracks LISTEN/NOTIFY routing events for 3-layer status handoffs.';
