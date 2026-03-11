-- Migration: Fix quick task sort order in phase/status/priority/member grouped views
-- Date: 2026-02-17
-- Problem: create_quick_task() only writes sort_order and roadmap_sort_order.
--          status_sort_order, priority_sort_order, phase_sort_order, and member_sort_order
--          default to 0, so all tasks share the same rank when grouped — ordering is arbitrary
--          on reload.
-- Solution (Part A): Replace create_quick_task() with a version that:
--   1. Calculates a single _next_sort_order using GREATEST() across all six sort columns.
--   2. Writes that value to all six columns on INSERT.
--   3. Carries forward schedule_id + description support (from 20260210000000-fix-recurring-tasks).
--   4. Carries forward auto-assign task creator (from release-v2.5/20260203000000-add-auto-assign-task-creator).
-- Solution (Part B): Data migration — back-fill existing tasks whose group sort orders are 0
--   but whose base sort_order is already set.

BEGIN;

-- ─── Part A: Replace create_quick_task() ────────────────────────────────────

CREATE OR REPLACE FUNCTION create_quick_task(_body json) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _task_id                  UUID;
    _parent_task              UUID;
    _status_id                UUID;
    _priority_id              UUID;
    _start_date               TIMESTAMP;
    _end_date                 TIMESTAMP;
    _schedule_id              UUID;
    _description              TEXT;
    _next_sort_order          INTEGER;
    _auto_assign_task_creator BOOLEAN;
    _reporter_id              UUID;
    _project_id               UUID;
    _team_id                  UUID;
    _team_member_id           UUID;
    _is_admin                 BOOLEAN;
BEGIN
    _reporter_id = (_body ->> 'reporter_id')::UUID;
    _project_id  = (_body ->> 'project_id')::UUID;
    _parent_task = (_body ->> 'parent_task_id')::UUID;
    _schedule_id = (_body ->> 'schedule_id')::UUID;
    _description = (_body ->> 'description')::TEXT;

    _status_id = COALESCE(
        (_body ->> 'status_id')::UUID,
        (SELECT id
         FROM task_statuses
         WHERE project_id = _project_id
           AND category_id IN (SELECT id FROM sys_task_status_categories WHERE is_todo IS TRUE)
         LIMIT 1)
    );
    _priority_id = COALESCE((_body ->> 'priority_id')::UUID, (SELECT id FROM task_priorities WHERE value = 1));
    _start_date  = (_body ->> 'start_date')::TIMESTAMP;
    _end_date    = (_body ->> 'end_date')::TIMESTAMP;

    -- Calculate the next sort order value once and apply it to every sort column.
    -- Using GREATEST() across all six columns guarantees the new task lands at the
    -- bottom regardless of which column had the highest current value.
    SELECT COALESCE(MAX(GREATEST(
        COALESCE(sort_order, 0),
        COALESCE(roadmap_sort_order, 0),
        COALESCE(status_sort_order, 0),
        COALESCE(priority_sort_order, 0),
        COALESCE(phase_sort_order, 0),
        COALESCE(member_sort_order, 0)
    )) + 1, 0)
    INTO _next_sort_order
    FROM tasks
    WHERE project_id = _project_id;

    INSERT INTO tasks (
        name,
        priority_id,
        project_id,
        reporter_id,
        status_id,
        parent_task_id,
        sort_order,
        roadmap_sort_order,
        status_sort_order,
        priority_sort_order,
        phase_sort_order,
        member_sort_order,
        start_date,
        end_date,
        schedule_id,
        description
    )
    VALUES (
        TRIM((_body ->> 'name')::TEXT),
        _priority_id,
        _project_id,
        _reporter_id,
        _status_id,
        _parent_task,
        _next_sort_order,
        _next_sort_order,
        _next_sort_order,
        _next_sort_order,
        _next_sort_order,
        _next_sort_order,
        _start_date,
        _end_date,
        _schedule_id,
        _description
    )
    RETURNING id INTO _task_id;

    PERFORM handle_on_task_phase_change(_task_id, (_body ->> 'phase_id')::UUID);

    -- Check if auto-assign is enabled for this project
    SELECT auto_assign_task_creator, team_id
    INTO _auto_assign_task_creator, _team_id
    FROM projects
    WHERE id = _project_id;

    -- If auto-assign is enabled, assign the task creator
    IF _auto_assign_task_creator IS TRUE THEN
        -- Get the team_member_id and check if their role is admin or owner
        SELECT tm.id, (r.admin_role OR r.owner)
        INTO _team_member_id, _is_admin
        FROM team_members tm
        INNER JOIN roles r ON tm.role_id = r.id
        WHERE tm.user_id = _reporter_id
          AND tm.team_id = _team_id;

        IF _team_member_id IS NOT NULL THEN
            -- Check if user is already a project member
            IF NOT EXISTS (
                SELECT 1 FROM project_members
                WHERE project_id = _project_id
                  AND team_member_id = _team_member_id
            ) THEN
                -- Only auto-add and assign if user is admin or owner
                IF _is_admin IS TRUE THEN
                    PERFORM create_task_assignee(_team_member_id, _project_id, _task_id, _reporter_id);
                END IF;
            ELSE
                -- User is already a project member, assign them to the task
                PERFORM create_task_assignee(_team_member_id, _project_id, _task_id, _reporter_id);
            END IF;
        END IF;
    END IF;

    RETURN get_single_task(_task_id);
END;
$$;

-- ─── Part B: Back-fill existing tasks ───────────────────────────────────────
-- Condition: sort_order > 0 (task was explicitly ordered) AND all group-specific
-- sort orders are still 0 (they were never set — not legitimately the first task).
-- Safe: does NOT touch tasks where any group sort order is already non-zero.

UPDATE tasks
SET
    status_sort_order   = sort_order,
    priority_sort_order = sort_order,
    phase_sort_order    = sort_order,
    member_sort_order   = sort_order
WHERE
    sort_order          > 0
    AND status_sort_order   = 0
    AND priority_sort_order = 0
    AND phase_sort_order    = 0
    AND member_sort_order   = 0;

COMMIT;
