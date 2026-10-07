'use strict';
// When a custom status (e.g. "new todo") is missing in the destination project,
// map to the first/main status in the same category (To do / Doing / Done)
// before falling back to any status by sort_order.

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
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
  source_category_id uuid;
  mapped_statuses text[];
BEGIN
  IF p_override_status_id IS NOT NULL THEN
    RETURN p_override_status_id;
  END IF;

  SELECT name, category_id INTO source_status_name, source_category_id
  FROM task_statuses
  WHERE id = p_source_status_id;

  IF source_status_name IS NULL THEN
    SELECT id INTO result_status_id
    FROM task_statuses
    WHERE project_id = p_destination_project_id
    ORDER BY sort_order ASC
    LIMIT 1;
    RETURN result_status_id;
  END IF;

  -- 1. Exact name match
  SELECT id INTO result_status_id
  FROM task_statuses
  WHERE project_id = p_destination_project_id
    AND LOWER(TRIM(name)) = LOWER(TRIM(source_status_name))
  LIMIT 1;

  IF result_status_id IS NOT NULL THEN
    RETURN result_status_id;
  END IF;

  -- 2. Semantic synonym mapping for common main status names
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

  SELECT id INTO result_status_id
  FROM task_statuses
  WHERE project_id = p_destination_project_id
    AND LOWER(TRIM(name)) = ANY(mapped_statuses)
  ORDER BY ARRAY_POSITION(mapped_statuses, LOWER(TRIM(name))) ASC
  LIMIT 1;

  IF result_status_id IS NOT NULL THEN
    RETURN result_status_id;
  END IF;

  -- 3. Same category fallback (custom statuses like "new todo" → main "To do")
  IF source_category_id IS NOT NULL THEN
    SELECT id INTO result_status_id
    FROM task_statuses
    WHERE project_id = p_destination_project_id
      AND category_id = source_category_id
    ORDER BY sort_order ASC
    LIMIT 1;

    IF result_status_id IS NOT NULL THEN
      RETURN result_status_id;
    END IF;
  END IF;

  -- 4. Last resort: first status in destination project
  SELECT id INTO result_status_id
  FROM task_statuses
  WHERE project_id = p_destination_project_id
  ORDER BY sort_order ASC
  LIMIT 1;

  RETURN result_status_id;
END;
$$ LANGUAGE plpgsql;
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  // Restore previous version (exact + semantic + global sort_order fallback only)
  pgm.sql(`
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
  IF p_override_status_id IS NOT NULL THEN
    RETURN p_override_status_id;
  END IF;

  SELECT name INTO source_status_name
  FROM task_statuses
  WHERE id = p_source_status_id;

  IF source_status_name IS NULL THEN
    SELECT id INTO result_status_id
    FROM task_statuses
    WHERE project_id = p_destination_project_id
    ORDER BY sort_order ASC
    LIMIT 1;
    RETURN result_status_id;
  END IF;

  SELECT id INTO result_status_id
  FROM task_statuses
  WHERE project_id = p_destination_project_id
    AND LOWER(TRIM(name)) = LOWER(TRIM(source_status_name))
  LIMIT 1;

  IF result_status_id IS NOT NULL THEN
    RETURN result_status_id;
  END IF;

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

  SELECT id INTO result_status_id
  FROM task_statuses
  WHERE project_id = p_destination_project_id
    AND LOWER(TRIM(name)) = ANY(mapped_statuses)
  ORDER BY ARRAY_POSITION(mapped_statuses, LOWER(TRIM(name))) ASC
  LIMIT 1;

  IF result_status_id IS NOT NULL THEN
    RETURN result_status_id;
  END IF;

  SELECT id INTO result_status_id
  FROM task_statuses
  WHERE project_id = p_destination_project_id
  ORDER BY sort_order ASC
  LIMIT 1;

  RETURN result_status_id;
END;
$$ LANGUAGE plpgsql;
  `);
};
