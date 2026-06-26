-- Migration: Add DUE_TIME to task list columns
-- This allows users to show/hide the due time column and saves their preference

BEGIN;

-- Step 1: Add DUE_TIME to the WL_TASK_LIST_COL_KEY enum
-- Note: We add it after DUE_DATE to keep related fields together
ALTER TYPE WL_TASK_LIST_COL_KEY ADD VALUE IF NOT EXISTS 'DUE_TIME' AFTER 'DUE_DATE';

COMMIT;

BEGIN;
-- Step 2: Add DUE_TIME column to all existing projects
-- Insert DUE_TIME column for each project that doesn't already have it
-- Default: pinned = false (hidden by default, users can enable it)
-- Index: 13 (after DUE_DATE which is typically index 12)
INSERT INTO project_task_list_cols (name, key, index, pinned, project_id, custom_column)
SELECT 
    'Due Time' AS name,
    'DUE_TIME'::WL_TASK_LIST_COL_KEY AS key,
    13 AS index,
    false AS pinned,
    p.id AS project_id,
    false AS custom_column
FROM projects p
WHERE NOT EXISTS (
    SELECT 1 
    FROM project_task_list_cols ptlc 
    WHERE ptlc.project_id = p.id 
    AND ptlc.key = 'DUE_TIME'
);
COMMIT;

BEGIN;
CREATE OR REPLACE FUNCTION insert_task_list_columns(_project_id uuid) RETURNS void
    LANGUAGE plpgsql
AS
$$
DECLARE
BEGIN
    INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
    VALUES (_project_id, 'Key', 'KEY', 0, FALSE);
    INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
    VALUES (_project_id, 'Description', 'DESCRIPTION', 2, FALSE);
    INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
    VALUES (_project_id, 'Progress', 'PROGRESS', 3, TRUE);
    INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
    VALUES (_project_id, 'Status', 'STATUS', 4, TRUE);
    INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
    VALUES (_project_id, 'Members', 'ASSIGNEES', 5, TRUE);
    INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
    VALUES (_project_id, 'Labels', 'LABELS', 6, TRUE);
    INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
    VALUES (_project_id, 'Phase', 'PHASE', 7, TRUE);
    INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
    VALUES (_project_id, 'Priority', 'PRIORITY', 8, TRUE);
    INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
    VALUES (_project_id, 'Time Tracking', 'TIME_TRACKING', 9, TRUE);
    INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
    VALUES (_project_id, 'Estimation', 'ESTIMATION', 10, FALSE);
    INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
    VALUES (_project_id, 'Start Date', 'START_DATE', 11, FALSE);
    INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
    VALUES (_project_id, 'Due Date', 'DUE_DATE', 12, TRUE);
    INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
    VALUES (_project_id, 'Due Time', 'DUE_TIME', 13, FALSE);
    INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
    VALUES (_project_id, 'Completed Date', 'COMPLETED_DATE', 14, FALSE);
    INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
    VALUES (_project_id, 'Created Date', 'CREATED_DATE', 15, FALSE);
    INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
    VALUES (_project_id, 'Last Updated', 'LAST_UPDATED', 16, FALSE);
    INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
    VALUES (_project_id, 'Reporter', 'REPORTER', 17, FALSE);
END
$$;
COMMIT;