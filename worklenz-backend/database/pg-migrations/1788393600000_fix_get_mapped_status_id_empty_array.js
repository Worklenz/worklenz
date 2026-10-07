'use strict';
// Fix: PostgreSQL cannot infer the type of an untyped empty array in a CASE
// expression (42P18 indeterminate_datatype). Custom statuses like "Review" hit
// the ELSE branch and crash cross-project task copy. Cast to text[] explicitly.

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

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // Intentional no-op: the pre-fix function body used `ELSE ARRAY[]` without a
  // cast, which raises PostgreSQL 42P18 (indeterminate_datatype) for custom
  // status names. Rolling back would restore a known-broken definition.
};
