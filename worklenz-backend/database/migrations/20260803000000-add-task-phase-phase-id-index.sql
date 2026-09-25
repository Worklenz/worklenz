-- Index for task_phase lookups by phase_id
-- Migration: 20260803000000-add-task-phase-phase-id-index.sql
--
-- GanttController.getProjectPhases (gantt-controller.ts) joins
-- task_phase -> tasks -> task_statuses -> sys_task_status_categories and
-- filters/joins on tp.phase_id to compute per-phase task counts for the
-- Roadmap tab. The only existing index on task_phase is
-- idx_task_phase_task_phase(task_id, phase_id), which can't be used for an
-- index seek on phase_id since it's the trailing column. Runs on every
-- Roadmap tab load.

CREATE INDEX IF NOT EXISTS idx_task_phase_phase_id
ON task_phase(phase_id, task_id);
