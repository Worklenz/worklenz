-- Migration script to add sort order columns to cpt_tasks table
-- These columns preserve the original sort order from the project when creating templates

-- Add status_sort_order column
ALTER TABLE cpt_tasks
    ADD COLUMN IF NOT EXISTS status_sort_order INTEGER DEFAULT 0;

-- Add priority_sort_order column
ALTER TABLE cpt_tasks
    ADD COLUMN IF NOT EXISTS priority_sort_order INTEGER DEFAULT 0;

-- Add phase_sort_order column
ALTER TABLE cpt_tasks
    ADD COLUMN IF NOT EXISTS phase_sort_order INTEGER DEFAULT 0;

-- Create index for better query performance on sort order columns
CREATE INDEX IF NOT EXISTS idx_cpt_tasks_status_sort_order ON cpt_tasks(status_sort_order);
CREATE INDEX IF NOT EXISTS idx_cpt_tasks_priority_sort_order ON cpt_tasks(priority_sort_order);
CREATE INDEX IF NOT EXISTS idx_cpt_tasks_phase_sort_order ON cpt_tasks(phase_sort_order);
