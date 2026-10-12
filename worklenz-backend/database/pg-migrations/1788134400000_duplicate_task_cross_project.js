'use strict';

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Cross-project task duplication enhancements
-- Adds support for copying tasks across projects with intelligent status mapping

-- Helper function to intelligently map task status from source to destination project
CREATE OR REPLACE FUNCTION get_mapped_status_id(
  p_source_status_id uuid,
  p_source_project_id uuid,
  p_destination_project_id uuid,
  p_override_status_id uuid DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  result_status_id uuid;
  source_status_name text;
  mapped_statuses text[];
BEGIN
  -- If override is provided, use it
  IF p_override_status_id IS NOT NULL THEN
    RETURN p_override_status_id;
  END IF;

  -- Get the source status name
  SELECT name INTO source_status_name
  FROM task_statuses
  WHERE id = p_source_status_id;

  IF source_status_name IS NULL THEN
    -- Fallback if source status doesn't exist
    SELECT id INTO result_status_id
    FROM task_statuses
    WHERE project_id = p_destination_project_id
    ORDER BY sort_order ASC
    LIMIT 1;
    RETURN result_status_id;
  END IF;

  -- 1. Try exact name match first
  SELECT id INTO result_status_id
  FROM task_statuses
  WHERE project_id = p_destination_project_id
    AND LOWER(TRIM(name)) = LOWER(TRIM(source_status_name))
  LIMIT 1;

  IF result_status_id IS NOT NULL THEN
    RETURN result_status_id;
  END IF;

  -- 2. Try semantic mapping - map by status meaning
  -- Build array of semantically equivalent status names
  mapped_statuses := CASE LOWER(TRIM(source_status_name))
    WHEN 'todo' THEN ARRAY['to do', 'to-do', 'backlog', 'new', 'pending']
    WHEN 'to do' THEN ARRAY['to-do', 'backlog', 'new', 'pending', 'todo']
    WHEN 'to-do' THEN ARRAY['to do', 'backlog', 'new', 'pending', 'todo']
    WHEN 'backlog' THEN ARRAY['to do', 'to-do', 'new', 'pending', 'todo']
    WHEN 'new' THEN ARRAY['to do', 'to-do', 'backlog', 'pending', 'todo']
    WHEN 'pending' THEN ARRAY['to do', 'to-do', 'backlog', 'new', 'todo']
    
    WHEN 'doing' THEN ARRAY['in progress', 'in-progress', 'in_progress', 'working', 'active', 'started']
    WHEN 'in progress' THEN ARRAY['in-progress', 'in_progress', 'working', 'active', 'started', 'doing']
    WHEN 'in-progress' THEN ARRAY['in progress', 'in_progress', 'working', 'active', 'started', 'doing']
    WHEN 'in_progress' THEN ARRAY['in progress', 'in-progress', 'working', 'active', 'started', 'doing']
    WHEN 'working' THEN ARRAY['in progress', 'in-progress', 'in_progress', 'active', 'started', 'doing']
    WHEN 'active' THEN ARRAY['in progress', 'in-progress', 'in_progress', 'working', 'started', 'doing']
    WHEN 'started' THEN ARRAY['in progress', 'in-progress', 'in_progress', 'working', 'active', 'doing']
    
    WHEN 'done' THEN ARRAY['completed', 'complete', 'finished', 'closed', 'done']
    WHEN 'completed' THEN ARRAY['complete', 'done', 'finished', 'closed']
    WHEN 'complete' THEN ARRAY['done', 'completed', 'finished', 'closed']
    WHEN 'finished' THEN ARRAY['done', 'completed', 'complete', 'closed']
    WHEN 'closed' THEN ARRAY['done', 'completed', 'complete', 'finished']
    ELSE ARRAY[]::text[]
  END;

  -- Search for first semantic match
  SELECT id INTO result_status_id
  FROM task_statuses
  WHERE project_id = p_destination_project_id
    AND LOWER(TRIM(name)) = ANY(mapped_statuses)
  ORDER BY ARRAY_POSITION(mapped_statuses, LOWER(TRIM(name))) ASC
  LIMIT 1;

  IF result_status_id IS NOT NULL THEN
    RETURN result_status_id;
  END IF;

  -- 3. Fallback to first/default status in destination project
  SELECT id INTO result_status_id
  FROM task_statuses
  WHERE project_id = p_destination_project_id
  ORDER BY sort_order ASC
  LIMIT 1;

  RETURN result_status_id;
END;
$$ LANGUAGE plpgsql;

-- Updated task duplication function with cross-project support
-- The 5-parameter signature supports status mapping across projects,
-- but project_id assignment is handled by the calling TS code with a post-hoc UPDATE.
-- This keeps project assignment as a single source of truth.
CREATE OR REPLACE FUNCTION duplicate_task_shallow(
  p_original_task_id uuid,
  p_new_parent_task_id uuid DEFAULT NULL,
  p_options jsonb DEFAULT '{}',
  p_destination_project_id uuid DEFAULT NULL,
  p_destination_status_id uuid DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  new_task_id uuid;
  original_task tasks%ROWTYPE;
  source_project_id uuid;
  mapped_status_id uuid;

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

  source_project_id := original_task.project_id;

  -- Map status intelligently if destination project is provided
  IF p_destination_project_id IS NOT NULL AND p_destination_project_id <> source_project_id THEN
    mapped_status_id := get_mapped_status_id(
      original_task.status_id,
      source_project_id,
      p_destination_project_id,
      p_destination_status_id
    );
  ELSE
    -- For same-project copies, use source status or override
    mapped_status_id := COALESCE(p_destination_status_id, original_task.status_id);
  END IF;

  -- Insert the duplicated task
  -- NOTE: task stays in source_project for now; calling code handles project reassignment
  INSERT INTO tasks (
    name, done, start_date, end_date, priority_id, project_id, reporter_id,
    description, total_minutes, parent_task_id, status_id, archived,
    sort_order, roadmap_sort_order, billable, schedule_id,
    manual_progress, progress_value, weight, progress_mode, fixed_cost,
    status_sort_order, priority_sort_order, phase_sort_order, member_sort_order
  )
  VALUES (
    LEFT(copy_prefix || original_task.name, 255),
    false,
    CASE WHEN include_dates THEN original_task.start_date ELSE NULL END,
    CASE WHEN include_dates THEN original_task.end_date ELSE NULL END,
    original_task.priority_id,
    source_project_id,
    original_task.reporter_id,
    original_task.description,
    original_task.total_minutes,
    COALESCE(p_new_parent_task_id, original_task.parent_task_id),
    mapped_status_id,
    false,
    (SELECT COALESCE(MAX(sort_order), 0) + 1000 FROM tasks WHERE project_id = source_project_id),
    original_task.roadmap_sort_order,
    original_task.billable,
    NULL,
    false,
    0,
    original_task.weight,
    original_task.progress_mode,
    original_task.fixed_cost,
    0, 0, 0, 0
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

  -- Copy subscribers
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
      -- Recursively duplicate each subtask with the same options and destination project
      -- Each subtask will use its own status mapping if cross-project
      PERFORM duplicate_task_shallow(
        subtask_record.id,
        new_task_id,
        p_options,
        p_destination_project_id,
        NULL  -- NULL so each task uses its own status mapping
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
  // Historical SQL migration: no automatic rollback is available.
};
