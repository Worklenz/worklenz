-- PPM Phase 2 Migration 002: ppm_dropdown_options
-- Admin-managed dropdown values for priority, channel, and type fields.
-- Replaces Monday's status columns with DB-backed, UI-editable options.

CREATE TABLE IF NOT EXISTS ppm_dropdown_options (
    id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    category   TEXT    NOT NULL CHECK (category IN ('priority', 'channel', 'type')),
    label      TEXT    NOT NULL,
    color      TEXT,  -- hex color for UI badges
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ppm_dropdown_category_active ON ppm_dropdown_options (category, is_active, sort_order);

-- Seed default values from Monday.com audit
INSERT INTO ppm_dropdown_options (category, label, color, sort_order) VALUES
    -- Priority
    ('priority', 'Urgent',  '#e74c3c', 1),
    ('priority', 'High',    '#f39c12', 2),
    ('priority', 'Medium',  '#3498db', 3),
    ('priority', 'Low',     '#95a5a6', 4),
    -- Channel (maps to Monday's channel status column)
    ('channel', 'Email',           '#9b59b6', 1),
    ('channel', 'Social Media',    '#2ecc71', 2),
    ('channel', 'Website',         '#3498db', 3),
    ('channel', 'Print',           '#e67e22', 4),
    ('channel', 'Video',           '#e74c3c', 5),
    ('channel', 'Digital Ad',      '#1abc9c', 6),
    -- Type (maps to Monday's type status column)
    ('type', 'Ad Campaign',        '#e74c3c', 1),
    ('type', 'Social Post',        '#2ecc71', 2),
    ('type', 'Brand Asset',        '#9b59b6', 3),
    ('type', 'Website Update',     '#3498db', 4),
    ('type', 'Email Campaign',     '#f39c12', 5),
    ('type', 'Video Production',   '#e67e22', 6),
    ('type', 'Print Material',     '#1abc9c', 7),
    ('type', 'General',            '#95a5a6', 8);

COMMENT ON TABLE ppm_dropdown_options IS 'Admin-managed dropdown values for deliverable priority, channel, and type.';
