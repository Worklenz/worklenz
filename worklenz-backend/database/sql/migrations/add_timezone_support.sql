-- Add timezone support to recurring tasks

-- Add timezone column to task_recurring_schedules
ALTER TABLE task_recurring_schedules 
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'UTC';

-- Add timezone column to task_recurring_templates
ALTER TABLE task_recurring_templates
ADD COLUMN IF NOT EXISTS reporter_timezone VARCHAR(50);

-- Add date_of_month column if not exists (for monthly schedules)
ALTER TABLE task_recurring_schedules
ADD COLUMN IF NOT EXISTS date_of_month INTEGER;

-- Add last_checked_at and last_created_task_end_date columns for tracking
ALTER TABLE task_recurring_schedules
ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_created_task_end_date TIMESTAMP WITH TIME ZONE;

-- Add end_date and excluded_dates columns for schedule control
ALTER TABLE task_recurring_schedules
ADD COLUMN IF NOT EXISTS end_date DATE,
ADD COLUMN IF NOT EXISTS excluded_dates TEXT[];

-- Create index on timezone for better query performance
CREATE INDEX IF NOT EXISTS idx_task_recurring_schedules_timezone 
ON task_recurring_schedules(timezone);

-- Update existing records to use user's timezone if available
UPDATE task_recurring_schedules trs
SET timezone = COALESCE(
    (SELECT u.timezone 
     FROM task_recurring_templates trt
     JOIN tasks t ON trt.task_id = t.id
     JOIN users u ON t.reporter_id = u.id
     WHERE trt.schedule_id = trs.id
     LIMIT 1),
    'UTC'
)
WHERE trs.timezone IS NULL OR trs.timezone = 'UTC';

-- Add comment to explain timezone field
COMMENT ON COLUMN task_recurring_schedules.timezone IS 'IANA timezone identifier for schedule calculations';
COMMENT ON COLUMN task_recurring_templates.reporter_timezone IS 'Original reporter timezone for reference';