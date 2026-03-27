-- PPM Migration 015: Seed PPM statuses for linked projects
--
-- For each project linked in ppm_client_projects, ensure the full set of
-- PPM statuses exists in task_statuses and ppm_status_mapping is populated.
--
-- PPM status set: Incoming, Queued, In Progress, Internal Review,
--                 Client Review, Revision, Approved, Done
--
-- This migration seeds statuses for EXISTING linked projects.
-- New projects linked via the admin API will have statuses seeded at link time.

BEGIN;

DO $$
DECLARE
    r RECORD;
    v_todo_cat_id UUID;
    v_doing_cat_id UUID;
    v_done_cat_id UUID;
    v_status_id UUID;
    v_incoming_id UUID;
    v_team_id UUID;
BEGIN
    -- Look up category IDs
    SELECT id INTO v_todo_cat_id  FROM sys_task_status_categories WHERE is_todo IS TRUE;
    SELECT id INTO v_doing_cat_id FROM sys_task_status_categories WHERE is_doing IS TRUE;
    SELECT id INTO v_done_cat_id  FROM sys_task_status_categories WHERE is_done IS TRUE;

    -- Process each linked project
    FOR r IN
        SELECT cp.id AS link_id, cp.project_id, p.team_id
        FROM ppm_client_projects cp
        JOIN projects p ON p.id = cp.project_id
    LOOP
        v_team_id := r.team_id;

        -- Seed each PPM status (idempotent: skip if name already exists for project)
        -- status_name, category, sort_order
        -- Incoming (To do, 0), Queued (To do, 1), In Progress (Doing, 2),
        -- Internal Review (Doing, 3), Client Review (Doing, 4),
        -- Revision (Doing, 5), Approved (Done, 6), Done (Done, 7)

        v_incoming_id := NULL;

        -- Incoming
        SELECT id INTO v_status_id FROM task_statuses
            WHERE project_id = r.project_id AND name = 'Incoming' LIMIT 1;
        IF v_status_id IS NULL THEN
            INSERT INTO task_statuses (name, project_id, team_id, category_id, sort_order)
            VALUES ('Incoming', r.project_id, v_team_id, v_todo_cat_id, 0)
            RETURNING id INTO v_status_id;
        END IF;
        v_incoming_id := v_status_id;
        INSERT INTO ppm_status_mapping (project_id, task_status_id, ppm_status)
        VALUES (r.project_id, v_status_id, 'incoming')
        ON CONFLICT (project_id, task_status_id) DO NOTHING;

        -- Queued
        SELECT id INTO v_status_id FROM task_statuses
            WHERE project_id = r.project_id AND name = 'Queued' LIMIT 1;
        IF v_status_id IS NULL THEN
            INSERT INTO task_statuses (name, project_id, team_id, category_id, sort_order)
            VALUES ('Queued', r.project_id, v_team_id, v_todo_cat_id, 1)
            RETURNING id INTO v_status_id;
        END IF;
        INSERT INTO ppm_status_mapping (project_id, task_status_id, ppm_status)
        VALUES (r.project_id, v_status_id, 'queued')
        ON CONFLICT (project_id, task_status_id) DO NOTHING;

        -- In Progress
        SELECT id INTO v_status_id FROM task_statuses
            WHERE project_id = r.project_id AND name = 'In Progress' LIMIT 1;
        IF v_status_id IS NULL THEN
            INSERT INTO task_statuses (name, project_id, team_id, category_id, sort_order)
            VALUES ('In Progress', r.project_id, v_team_id, v_doing_cat_id, 2)
            RETURNING id INTO v_status_id;
        END IF;
        INSERT INTO ppm_status_mapping (project_id, task_status_id, ppm_status)
        VALUES (r.project_id, v_status_id, 'in_progress')
        ON CONFLICT (project_id, task_status_id) DO NOTHING;

        -- Internal Review
        SELECT id INTO v_status_id FROM task_statuses
            WHERE project_id = r.project_id AND name = 'Internal Review' LIMIT 1;
        IF v_status_id IS NULL THEN
            INSERT INTO task_statuses (name, project_id, team_id, category_id, sort_order)
            VALUES ('Internal Review', r.project_id, v_team_id, v_doing_cat_id, 3)
            RETURNING id INTO v_status_id;
        END IF;
        INSERT INTO ppm_status_mapping (project_id, task_status_id, ppm_status)
        VALUES (r.project_id, v_status_id, 'internal_review')
        ON CONFLICT (project_id, task_status_id) DO NOTHING;

        -- Client Review
        SELECT id INTO v_status_id FROM task_statuses
            WHERE project_id = r.project_id AND name = 'Client Review' LIMIT 1;
        IF v_status_id IS NULL THEN
            INSERT INTO task_statuses (name, project_id, team_id, category_id, sort_order)
            VALUES ('Client Review', r.project_id, v_team_id, v_doing_cat_id, 4)
            RETURNING id INTO v_status_id;
        END IF;
        INSERT INTO ppm_status_mapping (project_id, task_status_id, ppm_status)
        VALUES (r.project_id, v_status_id, 'client_review')
        ON CONFLICT (project_id, task_status_id) DO NOTHING;

        -- Revision
        SELECT id INTO v_status_id FROM task_statuses
            WHERE project_id = r.project_id AND name = 'Revision' LIMIT 1;
        IF v_status_id IS NULL THEN
            INSERT INTO task_statuses (name, project_id, team_id, category_id, sort_order)
            VALUES ('Revision', r.project_id, v_team_id, v_doing_cat_id, 5)
            RETURNING id INTO v_status_id;
        END IF;
        INSERT INTO ppm_status_mapping (project_id, task_status_id, ppm_status)
        VALUES (r.project_id, v_status_id, 'revision')
        ON CONFLICT (project_id, task_status_id) DO NOTHING;

        -- Approved
        SELECT id INTO v_status_id FROM task_statuses
            WHERE project_id = r.project_id AND name = 'Approved' LIMIT 1;
        IF v_status_id IS NULL THEN
            INSERT INTO task_statuses (name, project_id, team_id, category_id, sort_order)
            VALUES ('Approved', r.project_id, v_team_id, v_done_cat_id, 6)
            RETURNING id INTO v_status_id;
        END IF;
        INSERT INTO ppm_status_mapping (project_id, task_status_id, ppm_status)
        VALUES (r.project_id, v_status_id, 'approved')
        ON CONFLICT (project_id, task_status_id) DO NOTHING;

        -- Done
        SELECT id INTO v_status_id FROM task_statuses
            WHERE project_id = r.project_id AND name = 'Done' LIMIT 1;
        IF v_status_id IS NULL THEN
            INSERT INTO task_statuses (name, project_id, team_id, category_id, sort_order)
            VALUES ('Done', r.project_id, v_team_id, v_done_cat_id, 7)
            RETURNING id INTO v_status_id;
        END IF;
        INSERT INTO ppm_status_mapping (project_id, task_status_id, ppm_status)
        VALUES (r.project_id, v_status_id, 'done')
        ON CONFLICT (project_id, task_status_id) DO NOTHING;

        -- Store incoming_status_id on the project link
        UPDATE ppm_client_projects
        SET incoming_status_id = v_incoming_id
        WHERE id = r.link_id;

        RAISE NOTICE 'Seeded PPM statuses for project % (incoming_status_id=%)', r.project_id, v_incoming_id;
    END LOOP;

    -- Also map any existing "To do"/"Doing" Worklenz default statuses if present
    -- (These won't be in the PPM mapping — they map to 'queued'/'in_progress' as fallback)
    FOR r IN
        SELECT cp.project_id, ts.id AS status_id, ts.name
        FROM ppm_client_projects cp
        JOIN task_statuses ts ON ts.project_id = cp.project_id
        WHERE ts.name IN ('To do', 'To Do')
        AND NOT EXISTS (
            SELECT 1 FROM ppm_status_mapping sm
            WHERE sm.project_id = cp.project_id AND sm.task_status_id = ts.id
        )
    LOOP
        INSERT INTO ppm_status_mapping (project_id, task_status_id, ppm_status)
        VALUES (r.project_id, r.status_id, 'queued')
        ON CONFLICT (project_id, task_status_id) DO NOTHING;
    END LOOP;

    FOR r IN
        SELECT cp.project_id, ts.id AS status_id, ts.name
        FROM ppm_client_projects cp
        JOIN task_statuses ts ON ts.project_id = cp.project_id
        WHERE ts.name = 'Doing'
        AND NOT EXISTS (
            SELECT 1 FROM ppm_status_mapping sm
            WHERE sm.project_id = cp.project_id AND sm.task_status_id = ts.id
        )
    LOOP
        INSERT INTO ppm_status_mapping (project_id, task_status_id, ppm_status)
        VALUES (r.project_id, r.status_id, 'in_progress')
        ON CONFLICT (project_id, task_status_id) DO NOTHING;
    END LOOP;
END;
$$;

COMMIT;
