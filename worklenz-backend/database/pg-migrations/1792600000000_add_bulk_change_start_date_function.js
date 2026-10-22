'use strict';
// Converted from: database/migrations/20260423000000-add-bulk-change-start-date-function.sql

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Migration: Add bulk_change_tasks_start_date function
-- Description: Allows bulk updating of task start dates with activity logging

CREATE OR REPLACE FUNCTION bulk_change_tasks_start_date(_body json, _userid uuid) 
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
    _task            JSON;
    _previous_date   TIMESTAMP;
    _new_date        TIMESTAMP;
    _updated_count   INTEGER := 0;
BEGIN
    -- Parse the new start_date from the body (can be null to clear start date)
    _new_date := CASE 
        WHEN (_body ->> 'start_date') IS NULL OR (_body ->> 'start_date') = '' THEN NULL
        ELSE (_body ->> 'start_date')::TIMESTAMP
    END;

    FOR _task IN SELECT * FROM JSON_ARRAY_ELEMENTS((_body ->> 'tasks')::JSON)
    LOOP
        -- Get the previous start_date
        _previous_date := (SELECT start_date FROM tasks WHERE id = (_task ->> 'id')::UUID);

        -- Update the task's start_date
        UPDATE tasks 
        SET start_date = _new_date,
            updated_at = NOW()
        WHERE id = (_task ->> 'id')::UUID;

        -- Log the activity if the date actually changed
        IF (_previous_date IS DISTINCT FROM _new_date)
        THEN
            INSERT INTO task_activity_logs (
                task_id, 
                team_id, 
                attribute_type, 
                user_id, 
                log_type, 
                old_value,
                new_value, 
                project_id
            )
            VALUES (
                (_task ->> 'id')::UUID,
                (SELECT team_id FROM projects WHERE id = (SELECT project_id FROM tasks WHERE id = (_task ->> 'id')::UUID)),
                'start_date',
                _userid,
                'update',
                _previous_date::TEXT,
                _new_date::TEXT,
                (SELECT project_id FROM tasks WHERE id = (_task ->> 'id')::UUID)
            );
            
            _updated_count := _updated_count + 1;
        END IF;
    END LOOP;

    RETURN json_build_object('updated_count', _updated_count);
END
$$;

-- Add comment for documentation
COMMENT ON FUNCTION bulk_change_tasks_start_date(json, uuid) IS 'Bulk update task start dates with activity logging';

  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // This migration is a DDL/function change — no automatic rollback defined.
  // Review manually before running migrate:down.
};
