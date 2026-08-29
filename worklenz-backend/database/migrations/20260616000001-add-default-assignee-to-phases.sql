-- Migration: Add default_assignee_id to project_phases
-- Description: Adds a default assignee (team member) to each project phase.
--              When a task enters this phase and phase_assignees_enabled is ON for the project,
--              the task is automatically assigned to this team member.
-- Date: 2026-06-16

ALTER TABLE project_phases
  ADD COLUMN IF NOT EXISTS default_assignee_id UUID REFERENCES team_members(id) ON DELETE SET NULL;

COMMENT ON COLUMN project_phases.default_assignee_id IS
  'The team member automatically assigned to tasks when they enter this phase (requires project.phase_assignees_enabled = TRUE).';
