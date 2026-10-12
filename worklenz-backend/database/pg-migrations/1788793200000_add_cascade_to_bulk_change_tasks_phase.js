'use strict';

module.exports.up = async (pgm) => {
  const migrationName = '20260907150000_add_cascade_to_bulk_change_tasks_phase';

  try {
    pgm.sql(`
      CREATE OR REPLACE FUNCTION bulk_change_tasks_phase(_body json, _userid uuid) RETURNS json
          LANGUAGE plpgsql
      AS $$
      DECLARE
          _task              JSON;
          _output            JSON;
          _previous_phase    UUID;
          _new_phase_id      UUID := (_body ->> 'phase_id')::UUID;
          _task_id           UUID;
          _project_id        UUID;
          _auto_assign       BOOLEAN;
      BEGIN
          FOR _task IN SELECT * FROM JSON_ARRAY_ELEMENTS((_body ->> 'tasks')::JSON)
              LOOP
                  _task_id := (_task ->> 'id')::UUID;
                  _previous_phase := (SELECT phase_id FROM task_phase WHERE task_id = _task_id);

                  -- Get project and auto_assign setting
                  SELECT p.id, p.auto_assign_subtask_phase
                  INTO _project_id, _auto_assign
                  FROM tasks t
                  JOIN projects p ON t.project_id = p.id
                  WHERE t.id = _task_id;

                  -- Update task phase
                  IF NOT EXISTS(SELECT 1 FROM task_phase WHERE task_id = _task_id)
                  THEN
                      INSERT INTO task_phase (task_id, phase_id) VALUES (_task_id, _new_phase_id);
                  ELSE
                      UPDATE task_phase SET phase_id = _new_phase_id WHERE task_id = _task_id;
                  END IF;

                  -- Cascade to subtasks if enabled and phase changed
                  IF _auto_assign AND (_previous_phase IS DISTINCT FROM _new_phase_id)
                  THEN
                      PERFORM cascade_phase_to_subtasks(_task_id, _new_phase_id);
                  END IF;

                  -- Activity logging
                  IF (_previous_phase IS DISTINCT FROM _new_phase_id)
                      THEN
                          INSERT INTO task_activity_logs (task_id, team_id, attribute_type, user_id, log_type, old_value, new_value, project_id)
                          VALUES (
                              _task_id,
                              (SELECT team_id FROM projects WHERE id = _project_id),
                              'phase',
                              _userid,
                              'update',
                              _previous_phase,
                              _new_phase_id,
                              _project_id
                          );
                  END IF;

              END LOOP;
          RETURN _output;
      END;
      $$;
    `);

    console.log(`✓ Migration ${migrationName} completed`);
  } catch (error) {
    console.error(`✗ Migration ${migrationName} failed:`, error);
    throw error;
  }
};

module.exports.down = async (pgm) => {
  const migrationName = '20260907150000_add_cascade_to_bulk_change_tasks_phase';

  try {
    pgm.sql(`
      CREATE OR REPLACE FUNCTION bulk_change_tasks_phase(_body json, _userid uuid) RETURNS json
          LANGUAGE plpgsql
      AS $$
      DECLARE
          _task   JSON;
          _output JSON;
          _previous_phase UUID;
      BEGIN
          FOR _task IN SELECT * FROM JSON_ARRAY_ELEMENTS((_body ->> 'tasks')::JSON)
              LOOP
                  _previous_phase = (SELECT phase_id FROM task_phase WHERE task_id = (_task ->> 'id')::UUID);

                  IF NOT EXISTS(SELECT 1 FROM task_phase WHERE task_id = (_task ->> 'id')::UUID)
                  THEN
                      INSERT INTO task_phase (task_id, phase_id) VALUES ((_task ->> 'id')::UUID, (_body ->> 'phase_id')::UUID);
                  ELSE
                      UPDATE task_phase SET phase_id = (_body ->> 'phase_id')::UUID WHERE task_id = (_task ->> 'id')::UUID;
                  END IF;

                  IF (_previous_phase IS DISTINCT FROM (_body ->> 'phase_id')::UUID)
                      THEN
                          INSERT INTO task_activity_logs (task_id, team_id, attribute_type, user_id, log_type, old_value, new_value, project_id)
                          VALUES (
                                  (_task ->> 'id')::UUID,
                                  (SELECT team_id FROM projects WHERE id = (SELECT project_id FROM tasks WHERE id = (_task ->> 'id')::UUID)),
                                  'phase',
                                  _userid,
                                  'update',
                                  _previous_phase,
                                  (_body ->> 'phase_id')::UUID,
                                  (SELECT project_id FROM tasks WHERE id = (_task ->> 'id')::UUID)
                                  );
                  END IF;

              END LOOP;
          RETURN _output;
      END;
      $$;
    `);

    console.log(`✓ Migration ${migrationName} rolled back`);
  } catch (error) {
    console.error(`✗ Migration ${migrationName} rollback failed:`, error);
    throw error;
  }
};
