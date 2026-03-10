'use strict';
// Converted from: database/migrations/20251211-duplicate-task.sql

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
CREATE OR REPLACE FUNCTION duplicate_task_shallow(
  p_original_task_id uuid,
  p_new_parent_task_id uuid DEFAULT NULL,
  p_options jsonb DEFAULT '{}'
)
RETURNS uuid AS $$
DECLARE
  new_task_id uuid;
  original_task tasks%ROWTYPE;

  -- Extract options with updated defaults to match TypeScript logic
  include_assignees    boolean := COALESCE((p_options->>'assignees')::boolean, true);
  include_labels       boolean := COALESCE((p_options->>'labels')::boolean, true);
  include_dependencies boolean := COALESCE((p_options->>'dependencies')::boolean, true);
  include_attachments  boolean := COALESCE((p_options->>'attachments')::boolean, false);
  include_customfields boolean := COALESCE((p_options->>'customFields')::boolean, true);
  include_subscribers  boolean := COALESCE((p_options->>'subscribers')::boolean, false);
  include_dates        boolean := COALESCE((p_options->>'dates')::boolean, false);
  include_subtasks     boolean := COALESCE((p_options->>'subtasks')::boolean, false);
  copy_prefix          text    := COALESCE(p_options->>'copyNamePrefix', 'Copy - ');
  
  -- For recursive subtask duplication
  subtask_record RECORD;
BEGIN

  -- Fetch the original task
  SELECT * INTO original_task
  FROM tasks
  WHERE id = p_original_task_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task with id % not found', p_original_task_id;
  END IF;

  -- Insert the duplicated task, overriding specific fields
  INSERT INTO tasks (
    name, done, start_date, end_date, priority_id, project_id, reporter_id,
    description, total_minutes, parent_task_id, status_id, archived,
    sort_order, roadmap_sort_order, billable, schedule_id,
    manual_progress, progress_value, weight, progress_mode, fixed_cost,
    status_sort_order, priority_sort_order, phase_sort_order, member_sort_order
  )
  VALUES (
    LEFT(copy_prefix || original_task.name, 255),  -- assuming name is varchar(255) or similar
    false,
    CASE WHEN include_dates THEN original_task.start_date ELSE NULL END,
    CASE WHEN include_dates THEN original_task.end_date ELSE NULL END,
    original_task.priority_id,
    original_task.project_id,
    original_task.reporter_id,
    original_task.description,
    original_task.total_minutes,
    COALESCE(p_new_parent_task_id, original_task.parent_task_id),
    original_task.status_id,
    false,
    (SELECT COALESCE(MAX(sort_order), 0) + 1000 FROM tasks WHERE project_id = original_task.project_id),
    original_task.roadmap_sort_order,
    original_task.billable,
    NULL,  -- never copy schedule_id
    false,
    0,
    original_task.weight,
    original_task.progress_mode,
    original_task.fixed_cost,
    0, 0, 0, 0  -- reset grouping sort orders
  )
  RETURNING id INTO new_task_id;

  -- Copy assignees
  IF include_assignees THEN
    INSERT INTO tasks_assignees (task_id, team_member_id, project_member_id, assigned_by)
    SELECT new_task_id, team_member_id, project_member_id, assigned_by
    FROM tasks_assignees
    WHERE task_id = p_original_task_id;
  END IF;

  -- Copy labels
  IF include_labels THEN
    INSERT INTO task_labels (task_id, label_id)
    SELECT new_task_id, label_id
    FROM task_labels
    WHERE task_id = p_original_task_id
    ON CONFLICT (task_id, label_id) DO NOTHING;
  END IF;

  -- Copy dependencies
  IF include_dependencies THEN
    INSERT INTO task_dependencies (task_id, related_task_id, dependency_type)
    SELECT new_task_id, related_task_id, dependency_type
    FROM task_dependencies
    WHERE task_id = p_original_task_id
    ON CONFLICT (task_id, related_task_id, dependency_type) DO NOTHING;
  END IF;

  -- Copy subscribers (added to match TS code)
  IF include_subscribers THEN
    INSERT INTO task_subscribers (user_id, task_id, team_member_id, action)
    SELECT user_id, new_task_id, team_member_id, action
    FROM task_subscribers
    WHERE task_id = p_original_task_id
    ON CONFLICT (user_id, task_id, team_member_id) DO NOTHING;
  END IF;

  -- Copy custom fields
  IF include_customfields THEN
    INSERT INTO cc_column_values (task_id, column_id, text_value, number_value, date_value, boolean_value, json_value)
    SELECT new_task_id, column_id, text_value, number_value, date_value, boolean_value, json_value
    FROM cc_column_values
    WHERE task_id = p_original_task_id
    ON CONFLICT (task_id, column_id) DO NOTHING;
  END IF;

  -- Copy attachments
  IF include_attachments THEN
    INSERT INTO task_attachments (name, size, type, task_id, team_id, project_id, uploaded_by)
    SELECT name, size, type, new_task_id, team_id, project_id, uploaded_by
    FROM task_attachments
    WHERE task_id = p_original_task_id;
  END IF;

  -- Recursively copy subtasks if enabled
  IF include_subtasks THEN
    FOR subtask_record IN
      SELECT id FROM tasks 
      WHERE parent_task_id = p_original_task_id 
        AND archived = false 
      ORDER BY sort_order
    LOOP
      -- Recursively duplicate each subtask with the same options
      PERFORM duplicate_task_shallow(
        subtask_record.id,
        new_task_id,
        p_options
      );
    END LOOP;
  END IF;

  RETURN new_task_id;
END;
$$ LANGUAGE plpgsql;
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // This migration is a DDL/function change — no automatic rollback defined.
  // Review manually before running migrate:down.
};
