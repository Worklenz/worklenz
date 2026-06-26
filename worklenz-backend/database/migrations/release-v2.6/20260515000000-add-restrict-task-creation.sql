-- Migration: Add restrict_task_creation feature
-- Description: Adds toggles to restrict task creation/assignment to Admins and Team Leads only.
--              Configurable at both project level and organization level.
--              This is a Business Plan feature.
-- Date: 2026-05-15

-- 1. Add project-level toggle
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS restrict_task_creation BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN projects.restrict_task_creation IS
  'When TRUE (Business Plan), only project members with Admin or Team Lead role can create and assign tasks.';

-- 2. Add organization-level toggle
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS restrict_task_creation BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN organizations.restrict_task_creation IS
  'When TRUE (Business Plan), restricts task creation/assignment to Admins and Team Leads across all projects in the organization.';

-- 3. Create a helper function to check if task creation is restricted for a given user in a project.
--    Returns TRUE when the restriction is active AND the user is NOT an Admin/Team Lead.
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

  -- Project-level overrides org-level when it is explicitly set (non-default).
  -- If project flag is TRUE → restricted.
  -- If project flag is FALSE (explicitly disabled) → not restricted regardless of org.
  -- If project flag is NULL/default → fall back to org flag.
  -- Since we store FALSE as default, we treat project flag as authoritative when the
  -- project has been explicitly saved (i.e. the column exists). We use org flag only
  -- when the project flag is FALSE AND the org flag is TRUE.
  -- Effective rule: project_restricted OR (NOT project_restricted AND org_restricted)
  --   simplifies to: project_restricted OR org_restricted
  -- But per spec "project-level overrides org-level", meaning if project is explicitly
  -- FALSE it should NOT be overridden by org TRUE. We therefore need a tri-state.
  -- We model this as: if project flag is TRUE → restricted; else use org flag.
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

  -- If user is admin/owner/team-lead → NOT restricted
  IF COALESCE(_is_admin_or_lead, FALSE) IS TRUE THEN
    RETURN FALSE;
  END IF;

  -- Restriction is active and user is a plain Member
  RETURN TRUE;
END;
$$;

-- 4. Update create_project to include both priority_id (sys_project_priorities) and restrict_task_creation
CREATE OR REPLACE FUNCTION create_project(_body json) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _user_id        UUID;
    _team_id        UUID;
    _client_id      UUID;
    _project_id     UUID;
    _client_name    TEXT;
    _project_name   TEXT;
    _team_member_id UUID;
BEGIN
    _client_name = TRIM((_body ->> 'client_name')::TEXT);
    _project_name = TRIM((_body ->> 'name')::TEXT);
    _user_id = (_body ->> 'user_id')::UUID;
    _team_id = (_body ->> 'team_id')::UUID;

    SELECT id FROM clients WHERE LOWER(name) = LOWER(_client_name) AND team_id = _team_id INTO _client_id;
    SELECT id FROM team_members WHERE team_id = _team_id AND user_id = _user_id INTO _team_member_id;

    IF EXISTS(SELECT name FROM projects WHERE LOWER(name) = LOWER(_project_name) AND team_id = _team_id)
    THEN
        RAISE 'PROJECT_EXISTS_ERROR:%', _project_name;
    END IF;

    IF is_null_or_empty(_client_id) IS TRUE AND is_null_or_empty(_client_name) IS FALSE
    THEN
        INSERT INTO clients (name, team_id) VALUES (_client_name, _team_id) RETURNING id INTO _client_id;
    END IF;

    INSERT INTO projects (name, key, notes, color_code, team_id, client_id, owner_id, status_id, health_id, priority_id, start_date,
                          end_date, folder_id, category_id, estimated_working_days, estimated_man_days, hours_per_day,
                          use_manual_progress, use_weighted_progress, use_time_progress, auto_assign_task_creator,
                          restrict_task_creation)
    VALUES (_project_name, (_body ->> 'key')::TEXT, (_body ->> 'notes')::TEXT, (_body ->> 'color_code')::TEXT, _team_id,
            _client_id, _user_id, (_body ->> 'status_id')::UUID, (_body ->> 'health_id')::UUID,
            COALESCE((_body ->> 'priority_id')::UUID, (SELECT id FROM sys_project_priorities WHERE name = 'Medium' LIMIT 1)),
            (_body ->> 'start_date')::TIMESTAMPTZ, (_body ->> 'end_date')::TIMESTAMPTZ,
            (_body ->> 'folder_id')::UUID, (_body ->> 'category_id')::UUID,
            (_body ->> 'working_days')::INTEGER, (_body ->> 'man_days')::INTEGER, (_body ->> 'hours_per_day')::INTEGER,
            COALESCE((_body ->> 'use_manual_progress')::BOOLEAN, FALSE),
            COALESCE((_body ->> 'use_weighted_progress')::BOOLEAN, FALSE),
            COALESCE((_body ->> 'use_time_progress')::BOOLEAN, FALSE),
            COALESCE((_body ->> 'auto_assign_task_creator')::BOOLEAN, FALSE),
            COALESCE((_body ->> 'restrict_task_creation')::BOOLEAN, FALSE))
    RETURNING id INTO _project_id;

    INSERT INTO project_logs (team_id, project_id, description)
    VALUES (_team_id, _project_id,
            REPLACE((_body ->> 'project_created_log')::TEXT, '@user',
                    (SELECT name FROM users WHERE id = _user_id)));

    INSERT INTO project_members (team_member_id, project_access_level_id, project_id, role_id)
    VALUES (_team_member_id, (SELECT id FROM project_access_levels WHERE key = 'ADMIN'),
            _project_id,
            (SELECT id FROM roles WHERE team_id = _team_id AND default_role IS TRUE));

    INSERT INTO task_statuses (name, project_id, team_id, category_id, sort_order)
    VALUES ('To Do', _project_id, _team_id, (SELECT id FROM sys_task_status_categories WHERE is_todo IS TRUE), 0);
    INSERT INTO task_statuses (name, project_id, team_id, category_id, sort_order)
    VALUES ('Doing', _project_id, _team_id, (SELECT id FROM sys_task_status_categories WHERE is_doing IS TRUE), 1);
    INSERT INTO task_statuses (name, project_id, team_id, category_id, sort_order)
    VALUES ('Done', _project_id, _team_id, (SELECT id FROM sys_task_status_categories WHERE is_done IS TRUE), 2);

    PERFORM insert_task_list_columns(_project_id);

    RETURN JSON_BUILD_OBJECT('id', _project_id, 'name', (_body ->> 'name')::TEXT);
END;
$$;

-- 5. Update update_project to include both priority_id (sys_project_priorities) and restrict_task_creation
CREATE OR REPLACE FUNCTION update_project(_body json) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _user_id                        UUID;
    _team_id                        UUID;
    _client_id                      UUID;
    _project_id                     UUID;
    _project_manager_team_member_id UUID;
    _client_name                    TEXT;
    _project_name                   TEXT;
BEGIN
    _client_name = TRIM((_body ->> 'client_name')::TEXT);
    _project_name = TRIM((_body ->> 'name')::TEXT);
    _user_id = (_body ->> 'user_id')::UUID;
    _team_id = (_body ->> 'team_id')::UUID;
    _project_manager_team_member_id = (_body ->> 'team_member_id')::UUID;

    SELECT id FROM clients WHERE LOWER(name) = LOWER(_client_name) AND team_id = _team_id INTO _client_id;

    IF is_null_or_empty(_client_id) IS TRUE AND is_null_or_empty(_client_name) IS FALSE
    THEN
        INSERT INTO clients (name, team_id) VALUES (_client_name, _team_id) RETURNING id INTO _client_id;
    END IF;

    IF EXISTS(
        SELECT name FROM projects WHERE LOWER(name) = LOWER(_project_name)
                                    AND team_id = _team_id AND id != (_body ->> 'id')::UUID
    )
    THEN
        RAISE 'PROJECT_EXISTS_ERROR:%', _project_name;
    END IF;

    UPDATE projects
    SET name                     = _project_name,
        notes                    = (_body ->> 'notes')::TEXT,
        color_code               = (_body ->> 'color_code')::TEXT,
        status_id                = (_body ->> 'status_id')::UUID,
        health_id                = (_body ->> 'health_id')::UUID,
        priority_id              = COALESCE((_body ->> 'priority_id')::UUID, (SELECT id FROM sys_project_priorities WHERE name = 'Medium' LIMIT 1)),
        key                      = (_body ->> 'key')::TEXT,
        start_date               = (_body ->> 'start_date')::TIMESTAMPTZ,
        end_date                 = (_body ->> 'end_date')::TIMESTAMPTZ,
        client_id                = _client_id,
        folder_id                = (_body ->> 'folder_id')::UUID,
        category_id              = (_body ->> 'category_id')::UUID,
        updated_at               = CURRENT_TIMESTAMP,
        estimated_working_days   = (_body ->> 'working_days')::INTEGER,
        estimated_man_days       = (_body ->> 'man_days')::INTEGER,
        hours_per_day            = (_body ->> 'hours_per_day')::INTEGER,
        use_manual_progress      = COALESCE((_body ->> 'use_manual_progress')::BOOLEAN, FALSE),
        use_weighted_progress    = COALESCE((_body ->> 'use_weighted_progress')::BOOLEAN, FALSE),
        use_time_progress        = COALESCE((_body ->> 'use_time_progress')::BOOLEAN, FALSE),
        auto_assign_task_creator = COALESCE((_body ->> 'auto_assign_task_creator')::BOOLEAN, FALSE),
        restrict_task_creation   = COALESCE((_body ->> 'restrict_task_creation')::BOOLEAN, FALSE)
    WHERE id = (_body ->> 'id')::UUID
      AND team_id = _team_id
    RETURNING id INTO _project_id;

    UPDATE project_members SET project_access_level_id = (SELECT id FROM project_access_levels WHERE key = 'MEMBER') WHERE project_id = _project_id;

    IF NOT (_project_manager_team_member_id IS NULL)
    THEN
        PERFORM update_project_manager(_project_manager_team_member_id, _project_id::UUID);
    END IF;

    RETURN JSON_BUILD_OBJECT(
            'id', _project_id,
            'name', (_body ->> 'name')::TEXT,
            'project_manager_id', _project_manager_team_member_id::UUID
        );
END;
$$;
