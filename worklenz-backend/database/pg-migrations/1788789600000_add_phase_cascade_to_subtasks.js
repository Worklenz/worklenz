/**
 * Migration: Add phase cascade to subtasks
 * Date: 2026-09-07
 * Description: When auto_assign_subtask_phase is enabled for a project,
 *              changes to a parent task's phase automatically cascade to all subtasks.
 *              
 *              This implements:
 *              - Task 10: Parent phase change → update all subtasks (BATCHED)
 *              - Task 11: Parent phase cleared/deleted → clear all subtask phases (BATCHED)
 *              - Task 12: Re-parenting a task → inherit new parent's phase
 *              
 *              Cascade behavior:
 *              - Setting ON + Parent phase changes → All subtasks update in single query
 *              - Setting ON + Parent phase cleared → All subtasks cleared in single DELETE
 *              - Setting ON + Task re-parented → Task inherits new parent's phase
 *              - Setting OFF → No cascade, subtasks unchanged
 *              
 *              Performance optimization:
 *              - Uses ARRAY_AGG + UPDATE WHERE task_id = ANY(array) for batched updates
 *              - Single DELETE/UPDATE/INSERT per parent (not N queries for N subtasks)
 *              - Recursive cascade for nested subtasks
 */

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  // Create function to cascade phase changes from parent to subtasks
  // OPTIMIZED: Single batched UPDATE instead of N individual calls
  pgm.sql(`
CREATE OR REPLACE FUNCTION cascade_phase_to_subtasks(_parent_task_id UUID, _new_phase_id UUID) RETURNS TABLE(changed_task_id UUID, changed_phase_id UUID, changed_phase_name TEXT, changed_phase_color TEXT)
    LANGUAGE plpgsql
AS
$$
DECLARE
    _project_id                UUID;
    _auto_assign_subtask_phase BOOLEAN;
    _subtask_ids               UUID[];
    _phase_name                TEXT;
    _phase_color               TEXT;
BEGIN
    -- Get the parent task's project and check if cascade is enabled
    SELECT t.project_id, p.auto_assign_subtask_phase
    INTO _project_id, _auto_assign_subtask_phase
    FROM tasks t
    INNER JOIN projects p ON p.id = t.project_id
    WHERE t.id = _parent_task_id;

    -- Only cascade if setting is enabled
    IF _auto_assign_subtask_phase IS TRUE THEN
        -- Get all direct subtask IDs for potential recursive cascade
        SELECT ARRAY_AGG(id) INTO _subtask_ids
        FROM tasks 
        WHERE parent_task_id = _parent_task_id;

        -- Skip if no subtasks
        IF _subtask_ids IS NULL OR array_length(_subtask_ids, 1) IS NULL THEN
            RETURN;
        END IF;

        -- Get phase details for socket emit
        IF _new_phase_id IS NOT NULL THEN
            SELECT name, color_code INTO _phase_name, _phase_color
            FROM project_phases
            WHERE id = _new_phase_id;
        END IF;

        -- BATCHED UPDATE: Handle phase assignment in single query
        IF _new_phase_id IS NULL THEN
            -- Phase cleared: Delete all subtask phase mappings in one query
            DELETE FROM task_phase 
            WHERE task_id = ANY(_subtask_ids);
        ELSE
            -- Phase set: UPSERT all subtask phases in one query
            -- First, update existing mappings
            UPDATE task_phase 
            SET phase_id = _new_phase_id
            WHERE task_id = ANY(_subtask_ids);

            -- Then, insert missing mappings for subtasks not yet in task_phase
            INSERT INTO task_phase (task_id, phase_id)
            SELECT id, _new_phase_id
            FROM tasks
            WHERE parent_task_id = _parent_task_id
              AND NOT EXISTS (SELECT 1 FROM task_phase tp WHERE tp.task_id = tasks.id);
        END IF;

        -- Return all changed subtasks with phase details for socket emit
        RETURN QUERY
        SELECT 
            subtask_id,
            _new_phase_id,
            _phase_name,
            _phase_color
        FROM unnest(_subtask_ids) AS subtask_id;

        -- RECURSIVE: Cascade to each subtask's subtasks (if they have any)
        RETURN QUERY
        SELECT c.changed_task_id, c.changed_phase_id, c.changed_phase_name, c.changed_phase_color
        FROM unnest(_subtask_ids) AS subtask_id
        CROSS JOIN LATERAL cascade_phase_to_subtasks(subtask_id, _new_phase_id) AS c;
    END IF;
END;
$$;
  `);

  pgm.sql(`
    COMMENT ON FUNCTION cascade_phase_to_subtasks(UUID, UUID) IS 
    'Cascades a parent task''s phase change to all its subtasks when auto_assign_subtask_phase is enabled. OPTIMIZED: Uses single batched UPDATE/INSERT/DELETE for all direct subtasks, not per-subtask queries. Recursively cascades to nested subtasks. RETURNS table of (changed_task_id, changed_phase_id, changed_phase_name, changed_phase_color) for socket emit.';
  `);

  // Update handle_on_task_phase_change to trigger cascade and return cascaded IDs
  pgm.sql(`
CREATE OR REPLACE FUNCTION handle_on_task_phase_change(_task_id uuid, _phase_id uuid) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _name TEXT;
    _color_code TEXT;
    _cascaded_subtasks JSON;
BEGIN
    -- Update this task's phase in task_phase table (existing logic)
    IF NOT EXISTS(SELECT task_id FROM task_phase WHERE task_id = _task_id)
    THEN
        IF (is_null_or_empty(_phase_id) IS FALSE)
        THEN
            INSERT INTO task_phase (task_id, phase_id) VALUES (_task_id, _phase_id);
        END IF;
    ELSE
        IF (is_null_or_empty(_phase_id) IS TRUE)
        THEN
            DELETE FROM task_phase WHERE task_id = _task_id;
        ELSE
            UPDATE task_phase SET phase_id = _phase_id WHERE task_id = _task_id;
        END IF;
    END IF;

    -- NEW: Cascade to subtasks and collect changed task IDs for socket emit
    SELECT JSON_AGG(
        JSON_BUILD_OBJECT(
            'task_id', changed_task_id,
            'phase_id', changed_phase_id,
            'phase_name', changed_phase_name,
            'phase_color', changed_phase_color
        )
    ) INTO _cascaded_subtasks
    FROM cascade_phase_to_subtasks(_task_id, _phase_id);

    -- Return phase info (existing logic)
    IF (is_null_or_empty(_phase_id) IS FALSE)
    THEN
        SELECT name FROM project_phases WHERE id = _phase_id INTO _name;
        SELECT color_code FROM project_phases WHERE id = _phase_id INTO _color_code;
    END IF;

    RETURN JSON_BUILD_OBJECT(
        'name', _name, 
        'color_code', _color_code,
        'cascaded_subtasks', COALESCE(_cascaded_subtasks, '[]'::json)
    );
END
$$;
  `);

  pgm.sql(`
    COMMENT ON FUNCTION handle_on_task_phase_change(UUID, UUID) IS 
    'Updates a task''s phase in the task_phase junction table and cascades the change to all subtasks if auto_assign_subtask_phase is enabled for the project. RETURNS JSON with name, color_code, and cascaded_subtasks array for real-time socket emit.';
  `);

  // Create trigger function for re-parenting (Task 12)
  pgm.sql(`
CREATE OR REPLACE FUNCTION handle_task_reparent() RETURNS TRIGGER
    LANGUAGE plpgsql
AS
$$
DECLARE
    _new_parent_phase_id       UUID;
    _auto_assign_subtask_phase BOOLEAN;
BEGIN
    -- Only process if parent_task_id changed
    IF (OLD.parent_task_id IS DISTINCT FROM NEW.parent_task_id) AND (NEW.parent_task_id IS NOT NULL) THEN
        
        -- Get new parent's phase and project setting
        SELECT p.auto_assign_subtask_phase, tp.phase_id
        INTO _auto_assign_subtask_phase, _new_parent_phase_id
        FROM tasks t
        INNER JOIN projects p ON p.id = t.project_id
        LEFT JOIN task_phase tp ON tp.task_id = t.id
        WHERE t.id = NEW.parent_task_id;

        -- If setting is ON, inherit new parent's phase
        IF _auto_assign_subtask_phase IS TRUE THEN
            PERFORM handle_on_task_phase_change(NEW.id, _new_parent_phase_id);
        END IF;
    END IF;

    RETURN NEW;
END;
$$;
  `);

  pgm.sql(`
    COMMENT ON FUNCTION handle_task_reparent() IS 
    'Trigger function that runs when a task''s parent_task_id changes. If auto_assign_subtask_phase is enabled, the task inherits its new parent''s phase.';
  `);

  // Create trigger on tasks table for re-parenting
  pgm.sql(`
    DROP TRIGGER IF EXISTS trigger_task_reparent ON tasks;
    
    CREATE TRIGGER trigger_task_reparent
        AFTER UPDATE OF parent_task_id ON tasks
        FOR EACH ROW
        EXECUTE FUNCTION handle_task_reparent();
  `);

  pgm.sql(`
    COMMENT ON TRIGGER trigger_task_reparent ON tasks IS 
    'Automatically updates a task''s phase when it is re-parented (parent_task_id changes) and auto_assign_subtask_phase is enabled.';
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  // Drop trigger and trigger function
  pgm.sql(`
    DROP TRIGGER IF EXISTS trigger_task_reparent ON tasks;
  `);

  pgm.sql(`
    DROP FUNCTION IF EXISTS handle_task_reparent();
  `);

  pgm.sql(`
    DROP FUNCTION IF EXISTS cascade_phase_to_subtasks(UUID, UUID);
  `);

  // Restore original handle_on_task_phase_change without cascade
  pgm.sql(`
CREATE OR REPLACE FUNCTION handle_on_task_phase_change(_task_id uuid, _phase_id uuid) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _name TEXT;
    _color_code TEXT;
BEGIN
    IF NOT EXISTS(SELECT 1 FROM task_phase WHERE task_id = _task_id)
    THEN
        IF (is_null_or_empty(_phase_id) IS FALSE)
        THEN
            INSERT INTO task_phase (task_id, phase_id) VALUES (_task_id, _phase_id);
        END IF;
    ELSE
        IF (is_null_or_empty(_phase_id) IS TRUE)
        THEN
            DELETE FROM task_phase WHERE task_id = _task_id;
        ELSE
            UPDATE task_phase SET phase_id = _phase_id WHERE task_id = _task_id;
        END IF;
    END IF;

    IF (is_null_or_empty(_phase_id) IS FALSE)
    THEN
        SELECT name FROM project_phases WHERE id = _phase_id INTO _name;
        SELECT color_code FROM project_phases WHERE id = _phase_id INTO _color_code;
    END IF;

    RETURN JSON_BUILD_OBJECT('name', _name, 'color_code', _color_code);
END
$$;
  `);
};
