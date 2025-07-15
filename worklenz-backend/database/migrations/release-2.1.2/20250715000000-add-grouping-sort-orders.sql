-- Migration: Add separate sort order columns for different grouping types
-- This allows users to maintain different task orders when switching between grouping views

-- Add new sort order columns
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS status_sort_order INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority_sort_order INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS phase_sort_order INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS member_sort_order INTEGER DEFAULT 0;

-- Initialize new columns with current sort_order values
UPDATE tasks SET 
  status_sort_order = sort_order,
  priority_sort_order = sort_order,
  phase_sort_order = sort_order,
  member_sort_order = sort_order
WHERE status_sort_order = 0 
   OR priority_sort_order = 0 
   OR phase_sort_order = 0 
   OR member_sort_order = 0;

-- Add constraints to ensure non-negative values
ALTER TABLE tasks ADD CONSTRAINT tasks_status_sort_order_check CHECK (status_sort_order >= 0);
ALTER TABLE tasks ADD CONSTRAINT tasks_priority_sort_order_check CHECK (priority_sort_order >= 0);
ALTER TABLE tasks ADD CONSTRAINT tasks_phase_sort_order_check CHECK (phase_sort_order >= 0);
ALTER TABLE tasks ADD CONSTRAINT tasks_member_sort_order_check CHECK (member_sort_order >= 0);

-- Add indexes for performance (since these will be used for ordering)
CREATE INDEX IF NOT EXISTS idx_tasks_status_sort_order ON tasks(project_id, status_sort_order);
CREATE INDEX IF NOT EXISTS idx_tasks_priority_sort_order ON tasks(project_id, priority_sort_order);
CREATE INDEX IF NOT EXISTS idx_tasks_phase_sort_order ON tasks(project_id, phase_sort_order);
CREATE INDEX IF NOT EXISTS idx_tasks_member_sort_order ON tasks(project_id, member_sort_order);

-- Update comments for documentation
COMMENT ON COLUMN tasks.status_sort_order IS 'Sort order when grouped by status';
COMMENT ON COLUMN tasks.priority_sort_order IS 'Sort order when grouped by priority';
COMMENT ON COLUMN tasks.phase_sort_order IS 'Sort order when grouped by phase';
COMMENT ON COLUMN tasks.member_sort_order IS 'Sort order when grouped by members/assignees';