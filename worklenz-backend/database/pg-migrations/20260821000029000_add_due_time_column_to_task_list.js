'use strict';
// Converted from database/migrations/20260427000002-add-due-time-column-to-task-list.sql

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Migration: Add DUE_TIME to task list columns
-- This allows users to show/hide the due time column and saves their preference
-- Note: We add it after DUE_DATE to keep related fields together
-- Insert DUE_TIME column for each project that doesn't already have it
-- Default: pinned = false (hidden by default, users can enable it)
-- Index: 13 (after DUE_DATE which is typically index 12)
INSERT INTO project_task_list_cols (name, key, index, pinned, project_id)
SELECT 
    'Due Time' AS name,
    'DUE_TIME'::WL_TASK_LIST_COL_KEY AS key,
    13 AS index,
    false AS pinned,
    p.id AS project_id
FROM projects p
WHERE NOT EXISTS (
    SELECT 1 
    FROM project_task_list_cols ptlc 
    WHERE ptlc.project_id = p.id 
    AND ptlc.key = 'DUE_TIME'
);
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

  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // Review manually before running migrate:down.
};
