CREATE OR REPLACE FUNCTION duplicate_task_shallow(
  p_original_task_id uuid,
  p_new_parent_task_id uuid DEFAULT NULL,
  p_options jsonb DEFAULT '{}'
) 
RETURNS uuid AS $$
DECLARE
  new_task_id uuid;
  -- Extract options
  include_assignees    boolean := COALESCE((p_options->>'assignees')::boolean, true);
  include_labels       boolean := COALESCE((p_options->>'labels')::boolean, true);
  include_deps         boolean := COALESCE((p_options->>'dependencies')::boolean, true);
  include_attachments  boolean := COALESCE((p_options->>'attachments')::boolean, false);
  include_customfields boolean := COALESCE((p_options->>'customFields')::boolean, true);
  include_dates        boolean := COALESCE((p_options->>'dates')::boolean, false);
  copy_prefix          text    := COALESCE(p_options->>'copyNamePrefix', 'Copy - ');
BEGIN

  -- Insert the duplicated task (same logic as your TS code)
  INSERT INTO tasks (
    name, done, start_date, end_date, priority_id, project_id, reporter_id,
    description, total_minutes, parent_task_id, status_id, archived,
    sort_order, roadmap_sort_order, billable, schedule_id,
    manual_progress, progress_value, weight, progress_mode, fixed_cost,
    status_sort_order, priority_sort_order, phase_sort_order, member_sort_order,
    team_id
  )
  SELECT 
    copy_prefix || LEFT(name, 200 - LENGTH(copy_prefix)),
    false,  -- done
    CASE WHEN include_dates THEN start_date ELSE NULL END,
    CASE WHEN include_dates THEN end_date ELSE NULL END,
    priority_id, project_id, reporter_id,
    description, total_minutes,
    COALESCE(p_new_parent_task_id, parent_task_id),
    status_id, false,  -- archived
    (SELECT COALESCE(MAX(sort_order),0) + 1000 FROM tasks WHERE project_id = t.project_id),
    roadmap_sort_order, billable, NULL,  -- never copy schedule_id
    false, 0, weight, progress_mode, fixed_cost,
    0,0,0,0,  -- reset grouping sort orders
    team_id
  FROM tasks t
  WHERE id = p_original_task_id
  RETURNING id INTO new_task_id;

  -- Then copy relations exactly like your TS code
  IF include_assignees THEN
    INSERT INTO task_assignees (task_id, team_member_id, project_member_id, role, assigned_by)
    SELECT new_task_id, team_member_id, project_member_id, role, assigned_by
    FROM task_assignees WHERE task_id = p_original_task_id;
  END IF;

  IF include_labels THEN
    INSERT INTO task_labels (task_id, label_id)
    SELECT new_task_id, label_id
    FROM task_labels WHERE task_id = p_original_task_id
    ON CONFLICT DO NOTHING;
  END IF;

  -- ... same for dependencies, custom fields, attachments, etc.

  RETURN new_task_id;
END;
$$ LANGUAGE plpgsql;