-- PPM Migration 018: Seed structured feedback reasons
--
-- Used by the approval queue when a partner returns a task to the client.
-- Stored in ppm_dropdown_options with category='feedback_reason'.
-- First, ALTER the category CHECK to include 'feedback_reason'.

BEGIN;

-- Expand category CHECK to include feedback_reason
ALTER TABLE ppm_dropdown_options DROP CONSTRAINT IF EXISTS ppm_dropdown_options_category_check;
ALTER TABLE ppm_dropdown_options ADD CONSTRAINT ppm_dropdown_options_category_check
    CHECK (category IN ('priority', 'channel', 'type', 'feedback_reason'));

-- Seed feedback reasons
INSERT INTO ppm_dropdown_options (category, label, color, sort_order, is_active)
VALUES
    ('feedback_reason', 'Missing Items',      '#f5222d', 0, true),
    ('feedback_reason', 'Unclear Scope',      '#fa8c16', 1, true),
    ('feedback_reason', 'Wrong Channel/Type', '#faad14', 2, true),
    ('feedback_reason', 'Duplicate',          '#a0a0a0', 3, true),
    ('feedback_reason', 'Out of Scope',       '#722ed1', 4, true),
    ('feedback_reason', 'Budget Exceeded',    '#eb2f96', 5, true),
    ('feedback_reason', 'Needs Assets',       '#1890ff', 6, true),
    ('feedback_reason', 'Other',              '#8c8c8c', 7, true)
ON CONFLICT DO NOTHING;

COMMIT;
