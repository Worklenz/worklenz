-- PPM Phase 2 Migration 006: ppm_audit_log
-- Immutable audit trail for all PPM entity changes.
-- Tracks who did what, when, and with what details.

CREATE TABLE IF NOT EXISTS ppm_audit_log (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT        NOT NULL,  -- 'deliverable', 'client', 'retainer', etc.
    entity_id   UUID        NOT NULL,
    action      TEXT        NOT NULL,  -- 'status_change', 'created', 'feedback_submitted', etc.
    actor_id    UUID,                  -- user or client_user who performed the action
    actor_type  TEXT        NOT NULL DEFAULT 'system'
        CHECK (actor_type IN ('internal_user', 'client_user', 'system')),
    details     JSONB       DEFAULT '{}'::JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Append-only: no UPDATE or DELETE policies
CREATE INDEX idx_ppm_audit_entity   ON ppm_audit_log (entity_type, entity_id, created_at DESC);
CREATE INDEX idx_ppm_audit_actor    ON ppm_audit_log (actor_id, created_at DESC);
CREATE INDEX idx_ppm_audit_created  ON ppm_audit_log (created_at DESC);

COMMENT ON TABLE ppm_audit_log IS 'Immutable audit trail for PPM entity changes.';
