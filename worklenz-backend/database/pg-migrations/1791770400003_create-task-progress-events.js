'use strict';
// Reporting & Analytics: Burnup / Burndown widgets (spec: Worklenz/worklenz-business#2558).
//
//   task_progress_events   append-only ledger of how a project's (or sprint's) scope and completed
//                          work changed over time. Each row stores SIGNED DELTAS, so a burnup or
//                          burndown chart is just a running sum over days.
//
// Why a ledger instead of rebuilding history from the tasks table: tasks only know their CURRENT
// state (a reopened task has lost its earlier completed_at, an edited estimate rewrites the past,
// story point edits are not logged anywhere). Triggers below record every change as it happens.
//
//   phase_id IS NULL      -> project-level rows (used by project/team charts)
//   phase_id = <sprint>   -> the same changes as seen from one sprint (used by sprint charts)
//   is_subtask            -> lets the widget include or exclude sub-tasks (Jira excludes them)
//
// Counted work: tasks that are not archived. "Done" = the task's status category is_done.
// No FKs on project_id / phase_id / task_id on purpose: rows must survive task deletion (history)
// and must not block cascaded deletes. Task and project deletes are handled in the trigger.
//
// History before this migration is backfilled approximately from created_at / completed_at
// (source = 'backfill'). Exact history starts when the triggers are installed.

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    CREATE TABLE IF NOT EXISTS task_progress_events (
      id              UUID                     NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
      project_id      UUID                     NOT NULL,
      phase_id        UUID,
      task_id         UUID,
      is_subtask      BOOLEAN                  NOT NULL DEFAULT FALSE,
      occurred_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
      d_scope_points  DOUBLE PRECISION         NOT NULL DEFAULT 0,
      d_scope_issues  INTEGER                  NOT NULL DEFAULT 0,
      d_scope_minutes NUMERIC                  NOT NULL DEFAULT 0,
      d_done_points   DOUBLE PRECISION         NOT NULL DEFAULT 0,
      d_done_issues   INTEGER                  NOT NULL DEFAULT 0,
      d_done_minutes  NUMERIC                  NOT NULL DEFAULT 0,
      source          TEXT                     NOT NULL DEFAULT 'trigger',
      CONSTRAINT task_progress_events_source_check CHECK (source IN ('trigger', 'backfill'))
    );

    -- Project/team charts: sum project-level rows over a time window.
    CREATE INDEX IF NOT EXISTS idx_task_progress_events_project_time
      ON task_progress_events (project_id, occurred_at)
      WHERE phase_id IS NULL;

    -- Sprint charts.
    CREATE INDEX IF NOT EXISTS idx_task_progress_events_phase_time
      ON task_progress_events (phase_id, occurred_at)
      WHERE phase_id IS NOT NULL;

    COMMENT ON TABLE task_progress_events IS
      'Append-only ledger of signed scope/completed deltas per project (phase_id NULL) and per sprint (phase_id set). Source of the burnup/burndown widgets.';

    -- -----------------------------------------------------------------------------------------
    -- Helper: one ledger row for a task's contribution (sign = 1 adds it, -1 removes it).
    -- -----------------------------------------------------------------------------------------
    CREATE OR REPLACE FUNCTION task_progress_emit(
      _project_id UUID,
      _phase_id   UUID,
      _task_id    UUID,
      _is_subtask BOOLEAN,
      _sign       INTEGER,
      _points     DOUBLE PRECISION,
      _minutes    NUMERIC,
      _is_done    BOOLEAN
    ) RETURNS VOID
        LANGUAGE plpgsql
    AS
    $$
    BEGIN
      IF _sign = 0 THEN
        RETURN;
      END IF;
      INSERT INTO task_progress_events (project_id, phase_id, task_id, is_subtask,
                                        d_scope_points, d_scope_issues, d_scope_minutes,
                                        d_done_points, d_done_issues, d_done_minutes)
      VALUES (_project_id, _phase_id, _task_id, _is_subtask,
              _sign * _points, _sign, _sign * _minutes,
              CASE WHEN _is_done THEN _sign * _points ELSE 0 END,
              CASE WHEN _is_done THEN _sign ELSE 0 END,
              CASE WHEN _is_done THEN _sign * _minutes ELSE 0 END);
    END
    $$;

    -- -----------------------------------------------------------------------------------------
    -- tasks trigger: record the change between the OLD and NEW contribution of a task.
    -- -----------------------------------------------------------------------------------------
    CREATE OR REPLACE FUNCTION task_progress_events_fn() RETURNS TRIGGER
        LANGUAGE plpgsql
    AS
    $$
    DECLARE
      o_counts  BOOLEAN := FALSE;
      n_counts  BOOLEAN := FALSE;
      o_done    BOOLEAN := FALSE;
      n_done    BOOLEAN := FALSE;
      o_points  DOUBLE PRECISION := 0;
      n_points  DOUBLE PRECISION := 0;
      o_minutes NUMERIC := 0;
      n_minutes NUMERIC := 0;
      o_sub     BOOLEAN := FALSE;
      n_sub     BOOLEAN := FALSE;
      _phase_id UUID;
    BEGIN
      IF TG_OP IN ('UPDATE', 'DELETE') THEN
        o_counts  := NOT OLD.archived;
        o_points  := COALESCE(OLD.story_points, 0);
        o_minutes := COALESCE(OLD.total_minutes, 0);
        o_sub     := OLD.parent_task_id IS NOT NULL;
        o_done    := o_counts AND EXISTS(SELECT 1
                                         FROM task_statuses ts
                                                JOIN sys_task_status_categories c ON c.id = ts.category_id
                                         WHERE ts.id = OLD.status_id
                                           AND c.is_done IS TRUE);
      END IF;

      IF TG_OP IN ('INSERT', 'UPDATE') THEN
        n_counts  := NOT NEW.archived;
        n_points  := COALESCE(NEW.story_points, 0);
        n_minutes := COALESCE(NEW.total_minutes, 0);
        n_sub     := NEW.parent_task_id IS NOT NULL;
        n_done    := n_counts AND EXISTS(SELECT 1
                                         FROM task_statuses ts
                                                JOIN sys_task_status_categories c ON c.id = ts.category_id
                                         WHERE ts.id = NEW.status_id
                                           AND c.is_done IS TRUE);
      END IF;

      -- A cascaded delete (project removed) must not write history for a project that is gone.
      IF TG_OP = 'DELETE' AND NOT EXISTS(SELECT 1 FROM projects WHERE id = OLD.project_id) THEN
        RETURN OLD;
      END IF;

      -- Remove the old contribution (project-level, then each sprint the task is in) ...
      IF o_counts THEN
        PERFORM task_progress_emit(OLD.project_id, NULL, OLD.id, o_sub, -1, o_points, o_minutes, o_done);
        FOR _phase_id IN SELECT phase_id FROM task_phase WHERE task_id = OLD.id
          LOOP
            PERFORM task_progress_emit(OLD.project_id, _phase_id, OLD.id, o_sub, -1, o_points, o_minutes, o_done);
          END LOOP;
      END IF;

      -- ... and add the new one. Unchanged-but-recomputed pairs cancel out in sums; skip the noise.
      IF n_counts THEN
        PERFORM task_progress_emit(NEW.project_id, NULL, NEW.id, n_sub, 1, n_points, n_minutes, n_done);
        FOR _phase_id IN SELECT phase_id FROM task_phase WHERE task_id = NEW.id
          LOOP
            PERFORM task_progress_emit(NEW.project_id, _phase_id, NEW.id, n_sub, 1, n_points, n_minutes, n_done);
          END LOOP;
      END IF;

      IF TG_OP = 'DELETE' THEN
        RETURN OLD;
      END IF;
      RETURN NEW;
    END
    $$;

    DROP TRIGGER IF EXISTS task_progress_events_insert_delete ON tasks;
    CREATE TRIGGER task_progress_events_insert_delete
      AFTER INSERT OR DELETE
      ON tasks
      FOR EACH ROW
    EXECUTE FUNCTION task_progress_events_fn();

    DROP TRIGGER IF EXISTS task_progress_events_update ON tasks;
    CREATE TRIGGER task_progress_events_update
      AFTER UPDATE OF status_id, story_points, total_minutes, archived, parent_task_id, project_id
      ON tasks
      FOR EACH ROW
      WHEN (OLD.status_id IS DISTINCT FROM NEW.status_id
        OR OLD.story_points IS DISTINCT FROM NEW.story_points
        OR OLD.total_minutes IS DISTINCT FROM NEW.total_minutes
        OR OLD.archived IS DISTINCT FROM NEW.archived
        OR OLD.parent_task_id IS DISTINCT FROM NEW.parent_task_id
        OR OLD.project_id IS DISTINCT FROM NEW.project_id)
    EXECUTE FUNCTION task_progress_events_fn();

    -- -----------------------------------------------------------------------------------------
    -- task_phase trigger: a task entering / leaving a sprint changes that sprint's scope.
    -- -----------------------------------------------------------------------------------------
    CREATE OR REPLACE FUNCTION task_progress_events_phase_fn() RETURNS TRIGGER
        LANGUAGE plpgsql
    AS
    $$
    DECLARE
      _task    RECORD;
      _is_done BOOLEAN;
      _sign    INTEGER;
      _task_id UUID;
      _phase   UUID;
    BEGIN
      IF TG_OP = 'INSERT' THEN
        _task_id := NEW.task_id;
        _phase   := NEW.phase_id;
        _sign    := 1;
      ELSE
        _task_id := OLD.task_id;
        _phase   := OLD.phase_id;
        _sign    := -1;
      END IF;

      SELECT t.id, t.project_id, t.archived, t.story_points, t.total_minutes, t.parent_task_id, t.status_id
      INTO _task
      FROM tasks t
      WHERE t.id = _task_id;

      -- Task already gone (cascaded delete) or archived: nothing counted for it.
      IF NOT FOUND OR _task.archived THEN
        RETURN NULL;
      END IF;

      SELECT EXISTS(SELECT 1
                    FROM task_statuses ts
                           JOIN sys_task_status_categories c ON c.id = ts.category_id
                    WHERE ts.id = _task.status_id
                      AND c.is_done IS TRUE)
      INTO _is_done;

      PERFORM task_progress_emit(_task.project_id, _phase, _task.id, _task.parent_task_id IS NOT NULL, _sign,
                                 COALESCE(_task.story_points, 0), COALESCE(_task.total_minutes, 0), _is_done);
      RETURN NULL;
    END
    $$;

    DROP TRIGGER IF EXISTS task_progress_events_phase ON task_phase;
    CREATE TRIGGER task_progress_events_phase
      AFTER INSERT OR DELETE
      ON task_phase
      FOR EACH ROW
    EXECUTE FUNCTION task_progress_events_phase_fn();

    -- -----------------------------------------------------------------------------------------
    -- Backfill (only when the ledger is empty, so re-running is harmless): approximate history
    -- from created_at / completed_at of tasks that currently exist and are not archived.
    -- -----------------------------------------------------------------------------------------
    DO
    $$
    BEGIN
      IF EXISTS(SELECT 1 FROM task_progress_events LIMIT 1) THEN
        RETURN;
      END IF;

      CREATE TEMP TABLE tpe_backfill_tasks ON COMMIT DROP AS
      SELECT t.id,
             t.project_id,
             t.created_at,
             t.parent_task_id IS NOT NULL                                           AS is_subtask,
             COALESCE(t.story_points, 0)                                            AS points,
             COALESCE(t.total_minutes, 0)                                           AS minutes,
             CASE
               WHEN c.is_done IS TRUE THEN GREATEST(COALESCE(t.completed_at, t.updated_at), t.created_at)
               END                                                                  AS done_at
      FROM tasks t
             LEFT JOIN task_statuses ts ON ts.id = t.status_id
             LEFT JOIN sys_task_status_categories c ON c.id = ts.category_id
      WHERE t.archived IS FALSE;

      -- Project-level: scope when created ...
      INSERT INTO task_progress_events (project_id, phase_id, task_id, is_subtask, occurred_at,
                                        d_scope_points, d_scope_issues, d_scope_minutes, source)
      SELECT project_id, NULL, id, is_subtask, created_at, points, 1, minutes, 'backfill'
      FROM tpe_backfill_tasks;

      -- ... and completion when currently done.
      INSERT INTO task_progress_events (project_id, phase_id, task_id, is_subtask, occurred_at,
                                        d_done_points, d_done_issues, d_done_minutes, source)
      SELECT project_id, NULL, id, is_subtask, done_at, points, 1, minutes, 'backfill'
      FROM tpe_backfill_tasks
      WHERE done_at IS NOT NULL;

      -- Sprint-level: scope when the task joined the sprint (best guess: later of task / sprint creation).
      INSERT INTO task_progress_events (project_id, phase_id, task_id, is_subtask, occurred_at,
                                        d_scope_points, d_scope_issues, d_scope_minutes, source)
      SELECT b.project_id, tp.phase_id, b.id, b.is_subtask, GREATEST(b.created_at, pp.created_at),
             b.points, 1, b.minutes, 'backfill'
      FROM tpe_backfill_tasks b
             JOIN task_phase tp ON tp.task_id = b.id
             JOIN project_phases pp ON pp.id = tp.phase_id;

      INSERT INTO task_progress_events (project_id, phase_id, task_id, is_subtask, occurred_at,
                                        d_done_points, d_done_issues, d_done_minutes, source)
      SELECT b.project_id, tp.phase_id, b.id, b.is_subtask, GREATEST(b.done_at, pp.created_at),
             b.points, 1, b.minutes, 'backfill'
      FROM tpe_backfill_tasks b
             JOIN task_phase tp ON tp.task_id = b.id
             JOIN project_phases pp ON pp.id = tp.phase_id
      WHERE b.done_at IS NOT NULL;
    END
    $$;
  `);
};

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
exports.down = (pgm) => {
  pgm.sql(`
    DROP TRIGGER IF EXISTS task_progress_events_phase ON task_phase;
    DROP TRIGGER IF EXISTS task_progress_events_update ON tasks;
    DROP TRIGGER IF EXISTS task_progress_events_insert_delete ON tasks;
    DROP FUNCTION IF EXISTS task_progress_events_phase_fn();
    DROP FUNCTION IF EXISTS task_progress_events_fn();
    DROP FUNCTION IF EXISTS task_progress_emit(UUID, UUID, UUID, BOOLEAN, INTEGER, DOUBLE PRECISION, NUMERIC, BOOLEAN);
    DROP INDEX IF EXISTS idx_task_progress_events_phase_time;
    DROP INDEX IF EXISTS idx_task_progress_events_project_time;
    DROP TABLE IF EXISTS task_progress_events;
  `);
};
