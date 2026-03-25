-- PPM Phase 2 Migration 005: ppm_retainers
-- Tracks client retainer periods with budgeted hours/amount.
-- Replaces Monday's Client Master Board mirror + formula columns for hours rollup.

CREATE TABLE IF NOT EXISTS ppm_retainers (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id       UUID        NOT NULL REFERENCES ppm_clients(id) ON DELETE CASCADE,
    period_start    DATE        NOT NULL,
    period_end      DATE        NOT NULL,
    budgeted_hours  NUMERIC(8,2) NOT NULL,
    budgeted_amount NUMERIC(10,2),
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ppm_retainers_period_valid CHECK (period_end > period_start)
);

CREATE INDEX idx_ppm_retainers_client ON ppm_retainers (client_id);
CREATE INDEX idx_ppm_retainers_period ON ppm_retainers (client_id, period_start, period_end);

CREATE TRIGGER ppm_retainers_updated_at
    BEFORE UPDATE ON ppm_retainers
    FOR EACH ROW EXECUTE FUNCTION ppm_set_updated_at();

-- Retainer utilization rollup view
-- Sums actual_hours from ppm_deliverables within each retainer period
CREATE OR REPLACE VIEW ppm_retainer_utilization AS
SELECT
    r.id                AS retainer_id,
    r.client_id,
    r.period_start,
    r.period_end,
    r.budgeted_hours,
    r.budgeted_amount,
    COALESCE(SUM(d.actual_hours), 0)          AS used_hours,
    r.budgeted_hours - COALESCE(SUM(d.actual_hours), 0) AS remaining_hours,
    CASE
        WHEN r.budgeted_hours > 0
        THEN ROUND(COALESCE(SUM(d.actual_hours), 0) / r.budgeted_hours * 100, 1)
        ELSE 0
    END AS utilization_pct
FROM ppm_retainers r
LEFT JOIN ppm_deliverables d
    ON d.client_id = r.client_id
    AND d.status != 'queued'
    AND (d.created_at::DATE BETWEEN r.period_start AND r.period_end
         OR d.month_completed IS NOT NULL)
GROUP BY r.id, r.client_id, r.period_start, r.period_end,
         r.budgeted_hours, r.budgeted_amount;

COMMENT ON TABLE ppm_retainers IS 'PPM client retainer periods — budgeted hours/amount per period.';
COMMENT ON VIEW ppm_retainer_utilization IS 'Rollup of actual hours vs budgeted for each retainer period.';
