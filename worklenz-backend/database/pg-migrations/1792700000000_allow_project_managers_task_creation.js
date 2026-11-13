'use strict';

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Migration: Allow Project Managers to create tasks when restrict_task_creation is active
-- Description: Project Managers must be able to create/assign tasks regardless of their
--              team role (Owner/Admin/Team Lead/Member). Previously only team-level
--              Admin/Owner/Team Lead roles were exempt from the restriction.

CREATE OR REPLACE FUNCTION is_task_creation_restricted(_user_id UUID, _project_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  _team_id              UUID;
  _project_restricted   BOOLEAN := FALSE;
  _org_restricted       BOOLEAN := FALSE;
  _effective_restricted BOOLEAN := FALSE;
  _is_admin_or_lead     BOOLEAN := FALSE;
  _is_project_manager   BOOLEAN := FALSE;
BEGIN
  -- Get the team that owns this project
  SELECT team_id INTO _team_id FROM projects WHERE id = _project_id;
  IF _team_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Read project-level flag
  SELECT COALESCE(restrict_task_creation, FALSE)
    INTO _project_restricted
    FROM projects
   WHERE id = _project_id;

  -- Read org-level flag (via the team owner's organization)
  SELECT COALESCE(o.restrict_task_creation, FALSE)
    INTO _org_restricted
    FROM organizations o
    JOIN teams t ON t.user_id = o.user_id
   WHERE t.id = _team_id
   LIMIT 1;

  -- Effective rule: project TRUE → restricted; else fall back to org flag.
  IF _project_restricted IS TRUE THEN
    _effective_restricted := TRUE;
  ELSE
    _effective_restricted := _org_restricted;
  END IF;

  IF NOT _effective_restricted THEN
    RETURN FALSE;
  END IF;

  -- Check if the user is an Admin/Owner (team-level) or has admin_role (Team Lead)
  SELECT (r.admin_role OR r.owner)
    INTO _is_admin_or_lead
    FROM team_members tm
    JOIN roles r ON tm.role_id = r.id
   WHERE tm.user_id = _user_id
     AND tm.team_id = _team_id
   LIMIT 1;

  IF COALESCE(_is_admin_or_lead, FALSE) IS TRUE THEN
    RETURN FALSE;
  END IF;

  -- Project Managers may create tasks regardless of team role (e.g. Member)
  SELECT EXISTS (
    SELECT 1
      FROM project_members pm
      JOIN team_members tm ON tm.id = pm.team_member_id
      JOIN project_access_levels pal ON pal.id = pm.project_access_level_id
     WHERE pm.project_id = _project_id
       AND tm.user_id = _user_id
       AND tm.team_id = _team_id
       AND UPPER(pal.key) = 'PROJECT_MANAGER'
  ) INTO _is_project_manager;

  IF COALESCE(_is_project_manager, FALSE) IS TRUE THEN
    RETURN FALSE;
  END IF;

  -- Restriction is active and user is neither privileged team role nor Project Manager
  RETURN TRUE;
END;
$$;
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  // Revert to the previous definition that only exempted Admin/Owner/Team Lead.
  pgm.sql(`
CREATE OR REPLACE FUNCTION is_task_creation_restricted(_user_id UUID, _project_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  _team_id              UUID;
  _project_restricted   BOOLEAN := FALSE;
  _org_restricted       BOOLEAN := FALSE;
  _effective_restricted BOOLEAN := FALSE;
  _is_admin_or_lead     BOOLEAN := FALSE;
BEGIN
  SELECT team_id INTO _team_id FROM projects WHERE id = _project_id;
  IF _team_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT COALESCE(restrict_task_creation, FALSE)
    INTO _project_restricted
    FROM projects
   WHERE id = _project_id;

  SELECT COALESCE(o.restrict_task_creation, FALSE)
    INTO _org_restricted
    FROM organizations o
    JOIN teams t ON t.user_id = o.user_id
   WHERE t.id = _team_id
   LIMIT 1;

  IF _project_restricted IS TRUE THEN
    _effective_restricted := TRUE;
  ELSE
    _effective_restricted := _org_restricted;
  END IF;

  IF NOT _effective_restricted THEN
    RETURN FALSE;
  END IF;

  SELECT (r.admin_role OR r.owner)
    INTO _is_admin_or_lead
    FROM team_members tm
    JOIN roles r ON tm.role_id = r.id
   WHERE tm.user_id = _user_id
     AND tm.team_id = _team_id
   LIMIT 1;

  IF COALESCE(_is_admin_or_lead, FALSE) IS TRUE THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$;
  `);
};
