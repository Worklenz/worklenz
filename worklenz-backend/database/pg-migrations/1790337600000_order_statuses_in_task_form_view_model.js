'use strict';
/**
 * Fix: Task drawer status dropdown showed statuses in arbitrary DB order.
 * get_task_form_view_model selected task_statuses without ORDER BY sort_order,
 * while Manage Statuses and GET /statuses correctly use sort_order.
 *
 * Patches the live function body in place so we do not overwrite unrelated
 * changes that may exist on the deployed function definition.
 */

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async pgm => {
  pgm.sql(`
DO $$
DECLARE
  src text;
  updated text;
BEGIN
  SELECT pg_get_functiondef('get_task_form_view_model(uuid,uuid,uuid,uuid)'::regprocedure)
  INTO src;

  IF src IS NULL THEN
    RAISE EXCEPTION 'get_task_form_view_model(uuid,uuid,uuid,uuid) not found';
  END IF;

  -- Already ordered
  IF src ~ 'task_statuses WHERE project_id = _project_id ORDER BY sort_order' THEN
    RAISE NOTICE 'get_task_form_view_model statuses already ordered by sort_order';
    RETURN;
  END IF;

  updated := regexp_replace(
    src,
    'FROM \\(SELECT id, name FROM task_statuses WHERE project_id = _project_id\\) rec;',
    'FROM (SELECT id, name FROM task_statuses WHERE project_id = _project_id ORDER BY sort_order) rec;',
    'g'
  );

  IF updated = src THEN
    RAISE EXCEPTION 'Failed to patch get_task_form_view_model: statuses subquery not found';
  END IF;

  EXECUTE updated;
END $$;
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async pgm => {
  pgm.sql(`
DO $$
DECLARE
  src text;
  updated text;
BEGIN
  SELECT pg_get_functiondef('get_task_form_view_model(uuid,uuid,uuid,uuid)'::regprocedure)
  INTO src;

  IF src IS NULL THEN
    RETURN;
  END IF;

  updated := regexp_replace(
    src,
    'FROM \\(SELECT id, name FROM task_statuses WHERE project_id = _project_id ORDER BY sort_order\\) rec;',
    'FROM (SELECT id, name FROM task_statuses WHERE project_id = _project_id) rec;',
    'g'
  );

  IF updated = src THEN
    RETURN;
  END IF;

  EXECUTE updated;
END $$;
  `);
};
