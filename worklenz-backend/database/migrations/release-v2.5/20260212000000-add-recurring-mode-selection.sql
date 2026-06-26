-- Migration: Add recurring mode selection feature
-- Date: 2026-02-12
-- Description: Adds ability to choose between creating new tasks or changing task status for recurring tasks

-- Add recurring_mode enum type
DO $$ BEGIN
    CREATE TYPE recurring_mode AS ENUM ('create_task', 'change_status');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add new columns to task_recurring_schedules table
ALTER TABLE task_recurring_schedules
    ADD COLUMN IF NOT EXISTS recurring_mode recurring_mode DEFAULT 'create_task' NOT NULL,
    ADD COLUMN IF NOT EXISTS target_status_id UUID REFERENCES task_statuses(id) ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_task_recurring_schedules_recurring_mode
    ON task_recurring_schedules (recurring_mode)
    WHERE recurring_mode = 'change_status';

-- Add comment for documentation
COMMENT ON COLUMN task_recurring_schedules.recurring_mode IS 'Determines behavior: create_task (creates new task copy) or change_status (updates existing task status)';
COMMENT ON COLUMN task_recurring_schedules.target_status_id IS 'Target status to set when recurring_mode is change_status. Defaults to Todo category status if null.';
