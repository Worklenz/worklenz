'use strict';
// Converted from: database/migrations/20260210000000-fix-recurring-tasks.sql

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Migration: Fix recurring tasks system
-- Date: 2026-02-10
-- Fixes: missing columns, missing unique constraint, create_quick_task not saving schedule_id

BEGIN;

-- 1. Add missing columns to task_recurring_schedules
ALTER TABLE task_recurring_schedules
ADD COLUMN IF NOT EXISTS date_of_month INTEGER,
ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_created_task_end_date DATE,
ADD COLUMN IF NOT EXISTS max_occurrences INTEGER,
ADD COLUMN IF NOT EXISTS occurrence_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- 2. Add reporter_id and status_id to task_recurring_templates (currently missing, cron needs them)
ALTER TABLE task_recurring_templates
ADD COLUMN IF NOT EXISTS reporter_id UUID,
ADD COLUMN IF NOT EXISTS status_id UUID;

-- 3. Add unique constraint to prevent duplicate recurring tasks for the same date
-- Using a partial unique index since schedule_id can be NULL for non-recurring tasks
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_schedule_end_date_unique
ON tasks (schedule_id, ((end_date AT TIME ZONE 'UTC')::DATE))
WHERE schedule_id IS NOT NULL AND end_date IS NOT NULL;

-- 4. Update create_quick_task to accept and save schedule_id + description
CREATE OR REPLACE FUNCTION create_quick_task(_body json) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _task_id     UUID;
    _parent_task UUID;
    _status_id   UUID;
    _priority_id UUID;
    _start_date  TIMESTAMP;
    _end_date    TIMESTAMP;
    _schedule_id UUID;
    _description TEXT;
BEGIN

    _parent_task = (_body ->> 'parent_task_id')::UUID;
    _status_id = COALESCE(
        (_body ->> 'status_id')::UUID,
        (SELECT id
         FROM task_statuses
         WHERE project_id = (_body ->> 'project_id')::UUID
           AND category_id IN (SELECT id FROM sys_task_status_categories WHERE is_todo IS TRUE)
         LIMIT 1)
        );
    _priority_id = COALESCE((_body ->> 'priority_id')::UUID, (SELECT id FROM task_priorities WHERE value = 1));
    _start_date = (_body ->> 'start_date')::TIMESTAMP;
    _end_date = (_body ->> 'end_date')::TIMESTAMP;
    _schedule_id = (_body ->> 'schedule_id')::UUID;
    _description = (_body ->> 'description')::TEXT;

    INSERT INTO tasks (name, priority_id, project_id, reporter_id, status_id, parent_task_id, sort_order, roadmap_sort_order, start_date, end_date, schedule_id, description)
    VALUES (TRIM((_body ->> 'name')::TEXT),
            _priority_id,
            (_body ->> 'project_id')::UUID,
            (_body ->> 'reporter_id')::UUID,
            _status_id, _parent_task,
            COALESCE((SELECT MAX(COALESCE(sort_order, roadmap_sort_order, 0)) + 1 FROM tasks WHERE project_id = (_body ->> 'project_id')::UUID), 0),
            COALESCE((SELECT MAX(COALESCE(roadmap_sort_order, sort_order, 0)) + 1 FROM tasks WHERE project_id = (_body ->> 'project_id')::UUID), 0),
            (_body ->> 'start_date')::TIMESTAMP,
            (_body ->> 'end_date')::TIMESTAMP,
            _schedule_id,
            _description)
    RETURNING id INTO _task_id;

    PERFORM handle_on_task_phase_change(_task_id, (_body ->> 'phase_id')::UUID);

    RETURN get_single_task(_task_id);
END;
$$;

-- 5. Update create_recurring_task_template to also capture reporter_id, status_id, and duration_days
CREATE OR REPLACE FUNCTION create_recurring_task_template(p_task_id uuid, p_schedule_id uuid) RETURNS uuid
    LANGUAGE plpgsql
AS
$$
DECLARE
    v_new_id UUID;
BEGIN
    INSERT INTO task_recurring_templates (
        id,
        task_id,
        schedule_id,
        name,
        description,
        end_date,
        priority_id,
        project_id,
        reporter_id,
        status_id,
        assignees,
        labels,
        duration_days
    )
    SELECT
        uuid_generate_v4(),
        t.id AS task_id,
        p_schedule_id,
        t.name,
        t.description,
        t.end_date,
        t.priority_id,
        t.project_id,
        t.reporter_id,
        t.status_id,
        COALESCE(
            (SELECT JSONB_AGG(JSONB_BUILD_OBJECT('project_member_id', tas.project_member_id, 'team_member_id', tas.team_member_id))
             FROM tasks_assignees tas
             WHERE tas.task_id = t.id),
            '[]'::JSONB
        ) AS assignees,
        COALESCE(
            (SELECT JSONB_AGG(JSONB_BUILD_OBJECT('label_id', tla.label_id))
             FROM task_labels tla
             WHERE tla.task_id = t.id),
            '[]'::JSONB
        ) AS labels,
        CASE 
            WHEN t.start_date IS NOT NULL AND t.end_date IS NOT NULL 
            THEN (t.end_date::DATE - t.start_date::DATE)
            ELSE NULL
        END AS duration_days
    FROM tasks t
    WHERE t.id = p_task_id
    RETURNING id INTO v_new_id;

    RETURN v_new_id;
END;
$$;

COMMIT;

  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // This migration is a DDL/function change — no automatic rollback defined.
  // Review manually before running migrate:down.
};
