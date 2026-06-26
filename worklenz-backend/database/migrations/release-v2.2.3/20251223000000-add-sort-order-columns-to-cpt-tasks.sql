-- Migration script for adding sort order columns to cpt_tasks table
-- This script adds status_sort_order, priority_sort_order, and phase_sort_order columns
-- to preserve task ordering when creating and importing custom project templates

-- 1. Add sort order columns to cpt_tasks table
ALTER TABLE cpt_tasks
    ADD COLUMN IF NOT EXISTS status_sort_order INTEGER DEFAULT 0 NOT NULL,
    ADD COLUMN IF NOT EXISTS priority_sort_order INTEGER DEFAULT 0 NOT NULL,
    ADD COLUMN IF NOT EXISTS phase_sort_order INTEGER DEFAULT 0 NOT NULL;

-- 2. Add column comments for documentation
COMMENT ON COLUMN cpt_tasks.status_sort_order IS 'Sort order when tasks are grouped by status';
COMMENT ON COLUMN cpt_tasks.priority_sort_order IS 'Sort order when tasks are grouped by priority';
COMMENT ON COLUMN cpt_tasks.phase_sort_order IS 'Sort order when tasks are grouped by phase';

-- 3. Add CHECK constraints to ensure non-negative values
ALTER TABLE cpt_tasks
    ADD CONSTRAINT cpt_tasks_status_sort_order_check
        CHECK (status_sort_order >= 0);

ALTER TABLE cpt_tasks
    ADD CONSTRAINT cpt_tasks_priority_sort_order_check
        CHECK (priority_sort_order >= 0);

ALTER TABLE cpt_tasks
    ADD CONSTRAINT cpt_tasks_phase_sort_order_check
        CHECK (phase_sort_order >= 0);

-- 4. Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_cpt_tasks_status_sort_order
    ON cpt_tasks(template_id, status_sort_order);

CREATE INDEX IF NOT EXISTS idx_cpt_tasks_priority_sort_order
    ON cpt_tasks(template_id, priority_sort_order);

CREATE INDEX IF NOT EXISTS idx_cpt_tasks_phase_sort_order
    ON cpt_tasks(template_id, phase_sort_order);
