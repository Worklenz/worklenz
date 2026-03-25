-- PPM Phase 2 Migration 003: ppm_deliverables
-- Core deliverable table — extends Worklenz tasks with PPM's 3-layer visibility model.
-- One deliverable = one client-facing work item. Links to Worklenz task via FK.

CREATE TABLE IF NOT EXISTS ppm_deliverables (
    id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    worklenz_task_id   UUID        REFERENCES tasks(id) ON DELETE SET NULL,
    title              TEXT        NOT NULL,
    description        TEXT,
    status             TEXT        NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'in_progress', 'internal_review',
                          'client_review', 'revision', 'approved', 'done')),
    visibility         TEXT        NOT NULL DEFAULT 'internal_only'
        CHECK (visibility IN ('internal_only', 'client_visible')),
    client_id          UUID        NOT NULL REFERENCES ppm_clients(id) ON DELETE CASCADE,
    assignee_id        UUID        REFERENCES users(id) ON DELETE SET NULL,
    type_id            UUID        REFERENCES ppm_dropdown_options(id) ON DELETE SET NULL,
    channel_id         UUID        REFERENCES ppm_dropdown_options(id) ON DELETE SET NULL,
    priority_id        UUID        REFERENCES ppm_dropdown_options(id) ON DELETE SET NULL,
    submission_date    DATE,
    revisions_deadline DATE,
    send_date          DATE,
    due_date           TIMESTAMPTZ,
    asset_review_link  TEXT,
    estimated_hours    NUMERIC(8,2),
    actual_hours       NUMERIC(8,2) DEFAULT 0,
    month_completed    TEXT,  -- auto-set to "March 2026" format on client approval
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX idx_ppm_deliverables_client      ON ppm_deliverables (client_id);
CREATE INDEX idx_ppm_deliverables_status      ON ppm_deliverables (status);
CREATE INDEX idx_ppm_deliverables_assignee    ON ppm_deliverables (assignee_id);
CREATE INDEX idx_ppm_deliverables_send_date   ON ppm_deliverables (send_date);
CREATE INDEX idx_ppm_deliverables_task        ON ppm_deliverables (worklenz_task_id);
CREATE INDEX idx_ppm_deliverables_visibility  ON ppm_deliverables (client_id, visibility)
    WHERE visibility = 'client_visible';

-- Enable RLS for client isolation (proven in spike 001)
ALTER TABLE ppm_deliverables ENABLE ROW LEVEL SECURITY;

CREATE POLICY ppm_deliverables_client_isolation ON ppm_deliverables
    FOR ALL
    USING (client_id = current_setting('ppm.current_client_id')::UUID);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION ppm_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ppm_deliverables_updated_at
    BEFORE UPDATE ON ppm_deliverables
    FOR EACH ROW EXECUTE FUNCTION ppm_set_updated_at();

-- Auto-set month_completed on approval
CREATE OR REPLACE FUNCTION ppm_set_month_completed()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
        NEW.month_completed = TO_CHAR(NOW(), 'FMMonth YYYY');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ppm_deliverables_month_completed
    BEFORE UPDATE ON ppm_deliverables
    FOR EACH ROW EXECUTE FUNCTION ppm_set_month_completed();

COMMENT ON TABLE ppm_deliverables IS 'PPM deliverables — extends Worklenz tasks with 3-layer visibility and client routing.';
