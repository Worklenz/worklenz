// Separate project priorities from task priorities.
// Creates sys_project_priorities, seeds the same set (Low/Medium/High/Critical),
// migrates existing projects by matching priority name, re-points the
// projects.priority_id FK, and updates create_project/update_project to default
// from the new table.

exports.up = async function (db) {
    // 1. New table mirroring task_priorities
    await db.query(`
        CREATE TABLE IF NOT EXISTS sys_project_priorities (
            id              UUID    DEFAULT uuid_generate_v4() NOT NULL,
            name            TEXT                               NOT NULL,
            value           INTEGER DEFAULT 0                  NOT NULL,
            color_code      WL_HEX_COLOR                       NOT NULL,
            color_code_dark WL_HEX_COLOR,
            CONSTRAINT sys_project_priorities_pk PRIMARY KEY (id)
        );
    `);

    // 2. Seed (idempotent) - same values/colors as task priorities today
    await db.query(`
        INSERT INTO sys_project_priorities (name, value, color_code, color_code_dark)
        SELECT v.name, v.value, v.color_code, v.color_code_dark
        FROM (VALUES
            ('Low', 0, '#75c997', '#46D980'),
            ('Medium', 1, '#fbc84c', '#FFC227'),
            ('High', 2, '#f37070', '#FF4141'),
            ('Critical', 3, '#8B1A1A', '#B22222')
        ) AS v(name, value, color_code, color_code_dark)
        WHERE NOT EXISTS (SELECT 1 FROM sys_project_priorities spp WHERE spp.name = v.name);
    `);

    // 3. Migrate existing projects by name (their priority_id still points at task_priorities here)
    await db.query(`
        UPDATE projects p
        SET priority_id = COALESCE(
            (SELECT spp.id
             FROM sys_project_priorities spp
             JOIN task_priorities tp ON tp.name = spp.name
             WHERE tp.id = p.priority_id),
            (SELECT id FROM sys_project_priorities WHERE name = 'Medium' LIMIT 1)
        )
        WHERE p.priority_id IS NOT NULL;
    `);

    // 4. Re-point the FK from task_priorities to sys_project_priorities.
    //    Migration-built DBs auto-named the original FK projects_priority_id_fkey
    //    (inline REFERENCES), while the canonical SQL names it projects_priority_id_fk.
    //    Drop both so this works regardless of how the schema was created.
    await db.query(`
        ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_priority_id_fkey;
        ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_priority_id_fk;
        ALTER TABLE projects
            ADD CONSTRAINT projects_priority_id_fk
                FOREIGN KEY (priority_id) REFERENCES sys_project_priorities (id) ON DELETE SET NULL;
    `);

    // 5. Default the priority lookup from the new table; also include restrict_task_creation
    await db.query(`
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

            IF EXISTS(SELECT name
                      FROM projects
                      WHERE LOWER(name) = LOWER(_project_name)
                        AND team_id = _team_id)
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
                    (_body ->> 'start_date')::TIMESTAMPTZ,
                    (_body ->> 'end_date')::TIMESTAMPTZ, (_body ->> 'folder_id')::UUID, (_body ->> 'category_id')::UUID,
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

            RETURN JSON_BUILD_OBJECT(
                    'id', _project_id,
                    'name', (_body ->> 'name')::TEXT
                   );
        END;
        $$;
    `);

    await db.query(`
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
    `);
};

exports.down = async function (db) {
    // Re-point projects' priority_id back to the matching task_priorities row by name
    await db.query(`
        UPDATE projects p
        SET priority_id = (
            SELECT tp.id
            FROM task_priorities tp
            JOIN sys_project_priorities spp ON spp.name = tp.name
            WHERE spp.id = p.priority_id
        )
        WHERE p.priority_id IS NOT NULL;
    `);

    await db.query(`
        ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_priority_id_fk;
        ALTER TABLE projects
            ADD CONSTRAINT projects_priority_id_fk
                FOREIGN KEY (priority_id) REFERENCES task_priorities (id) ON DELETE SET NULL;
    `);

    // Restore the Medium default to task_priorities in both functions
    await db.query(`
        UPDATE pg_proc SET prosrc = REPLACE(prosrc,
            'sys_project_priorities WHERE name = ''Medium''',
            'task_priorities WHERE name = ''Medium''')
        WHERE proname IN ('create_project', 'update_project');
    `);

    await db.query(`DROP TABLE IF EXISTS sys_project_priorities;`);
};
