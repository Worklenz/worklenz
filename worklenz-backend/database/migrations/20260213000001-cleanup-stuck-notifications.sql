-- Cleanup script for stuck task_updates that were caught in the email loop
-- This will reset notifications that failed to send properly

-- Option 1: Delete all old notifications that are stuck (recommended for immediate fix)
-- Uncomment this if you want to clear all pending notifications
-- DELETE FROM task_updates WHERE is_sent = FALSE AND created_at < NOW() - INTERVAL '1 hour';

-- Option 2: Reset notifications to allow them to be retried
-- This keeps the notifications but ensures they can be sent again
UPDATE task_updates
SET is_sent = FALSE
WHERE is_sent = TRUE
  AND created_at < NOW() - INTERVAL '1 hour'
  AND id NOT IN (
    -- Keep only the most recent batch
    SELECT id FROM task_updates
    ORDER BY created_at DESC
    LIMIT 100
  );

-- Add an index to improve performance of the cron job
CREATE INDEX IF NOT EXISTS idx_task_updates_is_sent_created_at
ON task_updates(is_sent, created_at)
WHERE is_sent = FALSE;
