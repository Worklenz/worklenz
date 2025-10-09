--
-- PostgreSQL database dump
--

\restrict cXaFq3P6LqDQRplv9T04T96QuvXAyRIIeibBaOfW4nr2uu2faDsGHAz4sa2vtbK

-- Dumped from database version 15.14 (Debian 15.14-1.pgdg13+1)
-- Dumped by pg_dump version 15.14 (Debian 15.14-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: unaccent; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;


--
-- Name: EXTENSION unaccent; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION unaccent IS 'text search dictionary that removes accents';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: dependency_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.dependency_type AS ENUM (
    'blocked_by'
);


ALTER TYPE public.dependency_type OWNER TO postgres;

--
-- Name: language_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.language_type AS ENUM (
    'en',
    'es',
    'pt',
    'alb',
    'de',
    'zh_cn',
    'ko'
);


ALTER TYPE public.language_type OWNER TO postgres;

--
-- Name: progress_mode_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.progress_mode_type AS ENUM (
    'manual',
    'weighted',
    'time',
    'default'
);


ALTER TYPE public.progress_mode_type OWNER TO postgres;

--
-- Name: reaction_types; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.reaction_types AS ENUM (
    'like'
);


ALTER TYPE public.reaction_types OWNER TO postgres;

--
-- Name: schedule_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.schedule_type AS ENUM (
    'daily',
    'weekly',
    'yearly',
    'monthly',
    'every_x_days',
    'every_x_weeks',
    'every_x_months'
);


ALTER TYPE public.schedule_type OWNER TO postgres;

--
-- Name: wl_email; Type: DOMAIN; Schema: public; Owner: postgres
--

CREATE DOMAIN public.wl_email AS text
	CONSTRAINT wl_email_check CHECK ((VALUE ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::text));


ALTER DOMAIN public.wl_email OWNER TO postgres;

--
-- Name: wl_hex_color; Type: DOMAIN; Schema: public; Owner: postgres
--

CREATE DOMAIN public.wl_hex_color AS text
	CONSTRAINT wl_hex_color_check CHECK ((VALUE ~* '^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$'::text));


ALTER DOMAIN public.wl_hex_color OWNER TO postgres;

--
-- Name: wl_task_list_col_key; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.wl_task_list_col_key AS ENUM (
    'ASSIGNEES',
    'COMPLETED_DATE',
    'CREATED_DATE',
    'DESCRIPTION',
    'DUE_DATE',
    'ESTIMATION',
    'KEY',
    'LABELS',
    'LAST_UPDATED',
    'NAME',
    'PRIORITY',
    'PROGRESS',
    'START_DATE',
    'STATUS',
    'TIME_TRACKING',
    'REPORTER',
    'PHASE'
);


ALTER TYPE public.wl_task_list_col_key OWNER TO postgres;

--
-- Name: accept_invitation(text, uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.accept_invitation(_email text, _team_member_id uuid, _user_id uuid) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
BEGIN
    IF _team_member_id IS NOT NULL
    THEN
        UPDATE team_members SET user_id = _user_id WHERE id = _team_member_id;
        DELETE FROM email_invitations WHERE email = _email AND team_member_id = _team_member_id;
    END IF;

    RETURN JSON_BUILD_OBJECT(
        'email', _email,
        'id', (SELECT id FROM teams WHERE id = (SELECT team_id FROM team_members WHERE id = _team_member_id))
        );
END;
$$;


ALTER FUNCTION public.accept_invitation(_email text, _team_member_id uuid, _user_id uuid) OWNER TO postgres;

--
-- Name: activate_team(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.activate_team(_team_id uuid, _user_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
BEGIN
    UPDATE users
    SET active_team =_team_id
    WHERE id = _user_id
      AND EXISTS(SELECT id FROM team_members WHERE team_id = _team_id AND user_id = _user_id);

    DELETE
    FROM email_invitations
    WHERE team_id = _team_id
      AND team_member_id =
          (SELECT id FROM team_members WHERE user_id = _user_id AND team_members.team_id = _team_id);
END
$$;


ALTER FUNCTION public.activate_team(_team_id uuid, _user_id uuid) OWNER TO postgres;

--
-- Name: add_or_remove_pt_task_label(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.add_or_remove_pt_task_label(_task_id uuid, _label_id uuid) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _result JSON;
BEGIN
    IF EXISTS(SELECT task_id FROM cpt_task_labels WHERE task_id = _task_id AND label_id = _label_id)
    THEN
        DELETE FROM cpt_task_labels WHERE task_id = _task_id AND label_id = _label_id;
    ELSE
        INSERT INTO cpt_task_labels (task_id, label_id) VALUES (_task_id, _label_id);
    END IF;

    SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
    INTO _result
    FROM (SELECT cpt_task_labels.label_id AS id,
                 (SELECT name FROM team_labels WHERE id = cpt_task_labels.label_id) AS name,
                 (SELECT color_code FROM team_labels WHERE id = cpt_task_labels.label_id)
          FROM cpt_task_labels
          WHERE task_id = _task_id
          ORDER BY name) rec;

    RETURN _result;
END
$$;


ALTER FUNCTION public.add_or_remove_pt_task_label(_task_id uuid, _label_id uuid) OWNER TO postgres;

--
-- Name: add_or_remove_task_label(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.add_or_remove_task_label(_task_id uuid, _label_id uuid) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _result JSON;
BEGIN
    IF EXISTS(SELECT task_id FROM task_labels WHERE task_id = _task_id AND label_id = _label_id)
    THEN
        DELETE FROM task_labels WHERE task_id = _task_id AND label_id = _label_id;
    ELSE
        INSERT INTO task_labels (task_id, label_id) VALUES (_task_id, _label_id);
    END IF;

    SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
    INTO _result
    FROM (SELECT task_labels.label_id AS id,
                 (SELECT name FROM team_labels WHERE id = task_labels.label_id) AS name,
                 (SELECT color_code FROM team_labels WHERE id = task_labels.label_id)
          FROM task_labels
          WHERE task_id = _task_id
          ORDER BY name) rec;

    RETURN _result;
END
$$;


ALTER FUNCTION public.add_or_remove_task_label(_task_id uuid, _label_id uuid) OWNER TO postgres;

--
-- Name: assign_or_create_label(uuid, uuid, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.assign_or_create_label(_team_id uuid, _task_id uuid, _name text, _color_code text) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _label_id UUID;
    _is_new   BOOLEAN;
BEGIN
    SELECT id FROM team_labels WHERE team_id = _team_id AND LOWER(name) = TRIM(LOWER(_name)) INTO _label_id;

    IF (is_null_or_empty(_label_id) IS TRUE)
    THEN
        INSERT INTO team_labels (name, team_id, color_code)
        VALUES (TRIM(_name), _team_id, _color_code)
        RETURNING id INTO _label_id;
        _is_new = TRUE;
    END IF;

    INSERT INTO task_labels (task_id, label_id) VALUES (_task_id, _label_id);

    RETURN JSON_BUILD_OBJECT('id', _label_id, 'is_new', _is_new);
END;
$$;


ALTER FUNCTION public.assign_or_create_label(_team_id uuid, _task_id uuid, _name text, _color_code text) OWNER TO postgres;

--
-- Name: assign_or_create_pt_label(uuid, uuid, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.assign_or_create_pt_label(_team_id uuid, _task_id uuid, _name text, _color_code text) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _label_id UUID;
    _is_new   BOOLEAN;
BEGIN
    SELECT id FROM team_labels WHERE team_id = _team_id AND LOWER(name) = TRIM(LOWER(_name)) INTO _label_id;

    IF (is_null_or_empty(_label_id) IS TRUE)
    THEN
        INSERT INTO team_labels (name, team_id, color_code)
        VALUES (TRIM(_name), _team_id, _color_code)
        RETURNING id INTO _label_id;
        _is_new = TRUE;
    END IF;

    INSERT INTO cpt_task_labels (task_id, label_id) VALUES (_task_id, _label_id);

    RETURN JSON_BUILD_OBJECT('id', _label_id, 'is_new', _is_new);
END;
$$;


ALTER FUNCTION public.assign_or_create_pt_label(_team_id uuid, _task_id uuid, _name text, _color_code text) OWNER TO postgres;

--
-- Name: bulk_archive_tasks(json); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.bulk_archive_tasks(_body json) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _task   JSON;
    _output JSON;
BEGIN
    FOR _task IN SELECT * FROM JSON_ARRAY_ELEMENTS((_body ->> 'tasks')::JSON)
        LOOP
            -- Archive the parent task
            UPDATE tasks
            SET archived = ((_body ->> 'type')::TEXT = 'archive')
            WHERE id = (_task ->> 'id')::UUID
              AND parent_task_id IS NULL;
            -- Prevent archiving subtasks

            -- Archive its sub-tasks
            UPDATE tasks
            SET archived = ((_body ->> 'type')::TEXT = 'archive')
            WHERE parent_task_id = (_task ->> 'id')::UUID;
        END LOOP;

    RETURN _output;
END;
$$;


ALTER FUNCTION public.bulk_archive_tasks(_body json) OWNER TO postgres;

--
-- Name: bulk_assign_label(json); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.bulk_assign_label(_body json) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _task   JSON;
    _label  JSON;
    _output JSON;
BEGIN
    FOR _task IN SELECT * FROM JSON_ARRAY_ELEMENTS((_body ->> 'tasks')::JSON)
        LOOP
            FOR _label IN SELECT * FROM JSON_ARRAY_ELEMENTS((_body ->> 'labels')::JSON)
                LOOP
                    DELETE
                    FROM task_labels
                    WHERE task_id = (_task ->> 'id')::UUID
                      AND label_id = (_label ->> 'id')::UUID;
                    INSERT INTO task_labels (task_id, label_id)
                    VALUES ((_task ->> 'id')::UUID, (_label ->> 'id')::UUID);
                END LOOP;
        END LOOP;

    RETURN _output;
END;
$$;


ALTER FUNCTION public.bulk_assign_label(_body json) OWNER TO postgres;

--
-- Name: bulk_assign_label(json, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.bulk_assign_label(_body json, _user_id uuid) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _task   JSON;
    _label  JSON;
    _output JSON;
BEGIN
    FOR _task IN SELECT * FROM JSON_ARRAY_ELEMENTS((_body ->> 'tasks')::JSON)
        LOOP
            FOR _label IN SELECT * FROM JSON_ARRAY_ELEMENTS((_body ->> 'labels')::JSON)
                LOOP

                    DELETE FROM task_labels WHERE task_id = (_task ->> 'id')::UUID AND label_id = (_label ->> 'id')::UUID;

                    INSERT INTO task_labels (task_id, label_id) VALUES ((_task ->> 'id')::UUID, (_label ->> 'id')::UUID);

                    INSERT INTO task_activity_logs
                        (task_id, team_id, attribute_type, user_id, log_type, old_value, new_value, next_string, project_id)
                    VALUES
                        (
                            (_task ->> 'id')::UUID,
                            (SELECT team_id FROM projects WHERE id = (SELECT project_id FROM tasks WHERE tasks.id = (_task ->> 'id')::UUID)),
                            'label',
                            _user_id::UUID,
                            'create',
                            NULL,
                            (_label ->> 'id')::UUID,
                            NULL,
                            (SELECT project_id FROM tasks WHERE tasks.id = (_task ->> 'id')::UUID)
                        );

                END LOOP;
        END LOOP;

    RETURN _output;
END;
$$;


ALTER FUNCTION public.bulk_assign_label(_body json, _user_id uuid) OWNER TO postgres;

--
-- Name: bulk_assign_or_create_label(json); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.bulk_assign_or_create_label(_body json) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _task   JSON;
    _output JSON;
BEGIN
    FOR _task IN SELECT * FROM JSON_ARRAY_ELEMENTS((_body ->> 'tasks')::JSON)
        LOOP
            PERFORM assign_or_create_label((_body ->> 'team_id')::UUID, (_task ->> 'id')::UUID,
                                           (_body ->> 'text')::TEXT, (_body ->> 'color')::TEXT);
        END LOOP;
    RETURN _output;
END;
$$;


ALTER FUNCTION public.bulk_assign_or_create_label(_body json) OWNER TO postgres;

--
-- Name: bulk_assign_to_me(json); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.bulk_assign_to_me(_body json) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _task              JSON;
    _output            JSON;
    _project_member    JSON;
    _team_member_id    UUID;
    _project_member_id UUID;
BEGIN
    SELECT id
    FROM team_members
    WHERE team_id = (_body ->> 'team_id')::UUID
      AND user_id = (_body ->> 'user_id')::UUID
    INTO _team_member_id;

    FOR _task IN SELECT * FROM JSON_ARRAY_ELEMENTS((_body ->> 'tasks')::JSON)
        LOOP

            SELECT id
            FROM project_members
            WHERE project_id = (_body ->> 'project_id')::UUID
              AND project_members.team_member_id = _team_member_id
            INTO _project_member_id;

            IF is_null_or_empty(_project_member_id)
            THEN
                SELECT create_project_member(JSON_BUILD_OBJECT(
                    'team_member_id', _team_member_id,
                    'team_id', (_body ->> 'team_id')::UUID,
                    'project_id', (_body ->> 'project_id')::UUID,
                    'user_id', (_body ->> 'user_id')::UUID,
                    'access_level', 'MEMBER'::TEXT
                    ))
                INTO _project_member;
                _project_member_id = (_project_member ->> 'id')::UUID;
            END IF;

            IF NOT EXISTS(SELECT task_id
                          FROM tasks_assignees
                          WHERE task_id = (_task ->> 'id')::UUID
                            AND project_member_id = _project_member_id
                            AND team_member_id = _team_member_id)
            THEN
                INSERT INTO tasks_assignees (task_id, project_member_id, team_member_id, assigned_by)
                VALUES ((_task ->> 'id')::UUID, _project_member_id, _team_member_id, (_body ->> 'user_id')::UUID);
            END IF;
        END LOOP;

    RETURN _output;
END;
$$;


ALTER FUNCTION public.bulk_assign_to_me(_body json) OWNER TO postgres;

--
-- Name: bulk_change_tasks_phase(json, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.bulk_change_tasks_phase(_body json, _userid uuid) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _task   JSON;
    _output JSON;
    _previous_phase UUID;
BEGIN
    FOR _task IN SELECT * FROM JSON_ARRAY_ELEMENTS((_body ->> 'tasks')::JSON)
        LOOP
            _previous_phase = (SELECT phase_id FROM task_phase WHERE task_id = (_task ->> 'id')::UUID);

            IF NOT EXISTS(SELECT 1 FROM task_phase WHERE task_id = (_task ->> 'id')::UUID)
            THEN
                INSERT INTO task_phase (task_id, phase_id) VALUES ((_task ->> 'id')::UUID, (_body ->> 'phase_id')::UUID);
            ELSE
                UPDATE task_phase SET phase_id = (_body ->> 'phase_id')::UUID WHERE task_id = (_task ->> 'id')::UUID;
            END IF;

            IF (_previous_phase IS DISTINCT FROM (_body ->> 'phase_id')::UUID)
                THEN
                    INSERT INTO task_activity_logs (task_id, team_id, attribute_type, user_id, log_type, old_value, new_value, project_id)
                    VALUES (
                            (_task ->> 'id')::UUID,
                            (SELECT team_id FROM projects WHERE id = (SELECT project_id FROM tasks WHERE id = (_task ->> 'id')::UUID)),
                            'phase',
                            _userId,
                            'update',
                            _previous_phase,
                            (_body ->> 'phase_id')::UUID,
                            (SELECT project_id FROM tasks WHERE id = (_task ->> 'id')::UUID)
                            );
            END IF;


        END LOOP;
    RETURN _output;
END;
$$;


ALTER FUNCTION public.bulk_change_tasks_phase(_body json, _userid uuid) OWNER TO postgres;

--
-- Name: bulk_change_tasks_priority(json, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.bulk_change_tasks_priority(_body json, _userid uuid) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _task   JSON;
    _output JSON;
    _previous_priority UUID;
BEGIN
    FOR _task IN SELECT * FROM JSON_ARRAY_ELEMENTS((_body ->> 'tasks')::JSON)
        LOOP
            _previous_priority = (SELECT priority_id FROM tasks WHERE id = (_task ->> 'id')::UUID);

            UPDATE tasks SET priority_id = (_body ->> 'priority_id')::UUID WHERE id = (_task ->> 'id')::UUID;

            IF (_previous_priority IS DISTINCT FROM (_body ->> 'priority_id')::UUID)
                THEN
                    INSERT INTO task_activity_logs (task_id, team_id, attribute_type, user_id, log_type, old_value, new_value, project_id)
                    VALUES (
                            (_task ->> 'id')::UUID,
                            (SELECT team_id FROM projects WHERE id = (SELECT project_id FROM tasks WHERE id = (_task ->> 'id')::UUID)),
                            'priority',
                            _userId,
                            'update',
                            _previous_priority,
                            (_body ->> 'priority_id')::UUID,
                            (SELECT project_id FROM tasks WHERE id = (_task ->> 'id')::UUID)
                            );
            END IF;
        END LOOP;
    RETURN _output;
END;
$$;


ALTER FUNCTION public.bulk_change_tasks_priority(_body json, _userid uuid) OWNER TO postgres;

--
-- Name: bulk_change_tasks_status(json); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.bulk_change_tasks_status(_body json) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _task   JSON;
    _output JSON;
BEGIN
    FOR _task IN SELECT * FROM JSON_ARRAY_ELEMENTS((_body ->> 'tasks')::JSON)
        LOOP
            UPDATE tasks SET status_id = (_body ->> 'status_id')::UUID WHERE id = (_task ->> 'id')::UUID;
        END LOOP;

    RETURN _output;
END;
$$;


ALTER FUNCTION public.bulk_change_tasks_status(_body json) OWNER TO postgres;

--
-- Name: bulk_change_tasks_status(json, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.bulk_change_tasks_status(_body json, _userid uuid) RETURNS uuid[]
    LANGUAGE plpgsql
    AS $$
DECLARE
    _task            JSON;
    _output          JSON;
    _previous_status UUID;
    _failed_tasks    UUID[];
BEGIN

    FOR _task IN SELECT * FROM JSON_ARRAY_ELEMENTS((_body ->> 'tasks')::JSON)
        LOOP
            IF can_update_task((_task ->> 'id')::UUID, (_body ->> 'status_id')::UUID)
            THEN
                -- Proceed with the update if the task is eligible for update
                _previous_status = (SELECT status_id FROM tasks WHERE id = (_task ->> 'id')::UUID);

                UPDATE tasks SET status_id = (_body ->> 'status_id')::UUID WHERE id = (_task ->> 'id')::UUID;

                IF (_previous_status IS DISTINCT FROM (_body ->> 'status_id')::UUID)
                THEN
                    INSERT INTO task_activity_logs (task_id, team_id, attribute_type, user_id, log_type, old_value,
                                                    new_value, project_id)
                    VALUES ((_task ->> 'id')::UUID,
                            (SELECT team_id
                             FROM projects
                             WHERE id = (SELECT project_id FROM tasks WHERE id = (_task ->> 'id')::UUID)),
                            'status',
                            _userId,
                            'update',
                            _previous_status,
                            (_body ->> 'status_id')::UUID,
                            (SELECT project_id FROM tasks WHERE id = (_task ->> 'id')::UUID));
                END IF;
            ELSE
                -- Add failed task IDs to the array
                _failed_tasks := ARRAY_APPEND(_failed_tasks, (_task ->> 'id')::UUID);
            END IF;

        END LOOP;
    RETURN _failed_tasks;
END
$$;


ALTER FUNCTION public.bulk_change_tasks_status(_body json, _userid uuid) OWNER TO postgres;

--
-- Name: bulk_delete_pt_tasks(json); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.bulk_delete_pt_tasks(_body json) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _task   JSON;
    _output JSON;
BEGIN
    FOR _task IN SELECT * FROM JSON_ARRAY_ELEMENTS((_body ->> 'tasks')::JSON)
        LOOP
            DELETE FROM cpt_tasks WHERE id = (_task ->> 'id')::UUID;
        END LOOP;

    RETURN _output;
END;
$$;


ALTER FUNCTION public.bulk_delete_pt_tasks(_body json) OWNER TO postgres;

--
-- Name: bulk_delete_tasks(json); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.bulk_delete_tasks(_body json) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _task   JSON;
    _output JSON;
BEGIN
    FOR _task IN SELECT * FROM JSON_ARRAY_ELEMENTS((_body ->> 'tasks')::JSON)
        LOOP
            DELETE FROM tasks WHERE id = (_task ->> 'id')::UUID;
        END LOOP;

    RETURN _output;
END;
$$;


ALTER FUNCTION public.bulk_delete_tasks(_body json) OWNER TO postgres;

--
-- Name: can_update_task(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.can_update_task(_task_id uuid, _status_id uuid) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
    -- Declare a variable to store whether the update can continue
    can_continue BOOLEAN;
BEGIN
    -- First, check if the status is not in the "done" category
    SELECT EXISTS (
        SELECT 1
        FROM task_statuses ts
        WHERE ts.id = _status_id
          AND ts.project_id = (SELECT project_id FROM tasks WHERE id = _task_id)
          AND ts.category_id IN (
              SELECT id FROM sys_task_status_categories WHERE is_done IS FALSE
          )
    ) INTO can_continue;

    -- If the status is not "done", continue the process
    IF can_continue THEN
        RETURN TRUE;
    END IF;

    -- If the status is "done", check if any dependent tasks are not completed
    SELECT NOT EXISTS (
        SELECT 1
        FROM task_dependencies td
        LEFT JOIN tasks t ON t.id = td.related_task_id
        WHERE td.task_id = _task_id
          AND t.status_id NOT IN (
              SELECT id
              FROM task_statuses ts
              WHERE t.project_id = ts.project_id
                AND ts.category_id IN (
                    SELECT id FROM sys_task_status_categories WHERE is_done IS TRUE
                )
          )
    ) INTO can_continue;

    -- Return whether the update can continue based on the dependent task completion check
    RETURN can_continue;
END;
$$;


ALTER FUNCTION public.can_update_task(_task_id uuid, _status_id uuid) OWNER TO postgres;

--
-- Name: complete_account_setup(uuid, uuid, json); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.complete_account_setup(_user_id uuid, _team_id uuid, _body json) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _project_id        UUID;
    _default_status_id UUID;
    _task_id           UUID;
    _task              TEXT;
    _members           JSON;
    _sort_order        INT;
    _team_member_id    UUID;
    _project_member_id UUID;
BEGIN

    -- Update team name
    UPDATE teams SET name = TRIM((_body ->> 'team_name')::TEXT) WHERE id = _team_id AND user_id = _user_id;

    -- Create the project
    INSERT INTO projects (name, team_id, owner_id, color_code, status_id, key)
    VALUES ((_body ->> 'project_name')::TEXT, _team_id, _user_id, '#3b7ad4',
            (SELECT id FROM sys_project_statuses WHERE is_default IS TRUE), (_body ->> 'key')::TEXT)
    RETURNING id INTO _project_id;

    -- Insert task's statuses
    INSERT INTO task_statuses (name, project_id, team_id, category_id)
    VALUES ('To do', _project_id, _team_id, (SELECT id FROM sys_task_status_categories WHERE is_todo IS TRUE))
    RETURNING id INTO _default_status_id;

    INSERT INTO task_statuses (name, project_id, team_id, category_id)
    VALUES ('Doing', _project_id, _team_id, (SELECT id FROM sys_task_status_categories WHERE is_doing IS TRUE));

    INSERT INTO task_statuses (name, project_id, team_id, category_id)
    VALUES ('Done', _project_id, _team_id, (SELECT id FROM sys_task_status_categories WHERE is_done IS TRUE));

    SELECT id FROM team_members WHERE user_id = _user_id AND team_id = _team_id INTO _team_member_id;

    INSERT INTO project_members (team_member_id, project_access_level_id, project_id, role_id)
    VALUES (_team_member_id, (SELECT id FROM project_access_levels WHERE key = 'PROJECT_MANAGER'),
            _project_id,
            (SELECT id FROM roles WHERE team_id = _team_id AND default_role IS TRUE))
    RETURNING id INTO _project_member_id;

    -- Insert tasks
    _sort_order = 1;
    FOR _task IN SELECT * FROM JSON_ARRAY_ELEMENTS((_body ->> 'tasks')::JSON)
        LOOP
            INSERT INTO tasks (name, priority_id, project_id, reporter_id, status_id, sort_order)
            VALUES (TRIM('"' FROM _task)::TEXT, (SELECT id FROM task_priorities WHERE value = 1), _project_id, _user_id,
                    _default_status_id, _sort_order)
            RETURNING id INTO _task_id;
            _sort_order = _sort_order + 1;

            INSERT INTO tasks_assignees (task_id, project_member_id, team_member_id, assigned_by)
            VALUES (_task_id, _project_member_id, _team_member_id, _user_id);
        END LOOP;

    -- Insert team members if available
    IF is_null_or_empty((_body ->> 'team_members')) IS FALSE
    THEN
        SELECT create_team_member(JSON_BUILD_OBJECT('team_id', _team_id, 'emails', (_body ->> 'team_members')))
        INTO _members;
    END IF;

    -- insert default columns for task list
    PERFORM insert_task_list_columns(_project_id);

    UPDATE users SET setup_completed = TRUE WHERE id = _user_id;

    -- Update organization name
    UPDATE organizations SET organization_name = TRIM((_body ->> 'team_name')::TEXT) WHERE user_id = _user_id;

    --insert user data
    INSERT INTO users_data (user_id, organization_name, contact_number, contact_number_secondary, trial_in_progress,
                            trial_expire_date, subscription_status)
    VALUES (_user_id, TRIM((_body ->> 'team_name')::TEXT), NULL, NULL, TRUE, CURRENT_DATE + INTERVAL '14 days',
            'trialing')
    ON CONFLICT (user_id) DO UPDATE SET organization_name = TRIM((_body ->> 'team_name')::TEXT);

    RETURN JSON_BUILD_OBJECT('id', _project_id, 'members', _members);
END;
$$;


ALTER FUNCTION public.complete_account_setup(_user_id uuid, _team_id uuid, _body json) OWNER TO postgres;

--
-- Name: create_bulk_task_assignees(uuid, uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.create_bulk_task_assignees(_team_member_id uuid, _project_id uuid, _task_id uuid, _reporter_user_id uuid) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _project_member    JSON;
    _project_member_id UUID;
    _team_id           UUID;
    _user_id           UUID;
BEGIN
    SELECT id
    FROM project_members
    WHERE team_member_id = _team_member_id
      AND project_id = _project_id
    INTO _project_member_id;

    SELECT team_id FROM team_members WHERE id = _team_member_id INTO _team_id;
    SELECT user_id FROM team_members WHERE id = _team_member_id INTO _user_id;

    IF is_null_or_empty(_project_member_id)
    THEN
        SELECT create_project_member(JSON_BUILD_OBJECT(
            'team_member_id', _team_member_id,
            'team_id', _team_id,
            'project_id', _project_id,
            'user_id', _reporter_user_id,
            'access_level', 'MEMBER'::TEXT
            ))
        INTO _project_member;
        _project_member_id = (_project_member ->> 'id')::UUID;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM tasks_assignees WHERE task_id = _task_id AND project_member_id = _project_member_id)
    THEN
        INSERT INTO tasks_assignees (task_id, project_member_id, team_member_id, assigned_by)
        VALUES (_task_id, _project_member_id, _team_member_id, _reporter_user_id);

        INSERT INTO task_activity_logs (task_id, team_id, attribute_type, user_id, log_type, old_value, new_value, project_id)
        VALUES (
                _task_id,
                (SELECT team_id FROM projects WHERE id = (SELECT project_id FROM tasks WHERE id = _task_id)),
                'assignee',
                _reporter_user_id,
                'assign',
                NULL,
                _user_id,
                (SELECT project_id FROM tasks WHERE id = _task_id)
                );

    END IF;

    RETURN JSON_BUILD_OBJECT(
        'task_id', _task_id,
        'project_member_id', _project_member_id,
        'team_member_id', _team_member_id,
        'team_id', _team_id,
        'user_id', _user_id
        );
END
$$;


ALTER FUNCTION public.create_bulk_task_assignees(_team_member_id uuid, _project_id uuid, _task_id uuid, _reporter_user_id uuid) OWNER TO postgres;

--
-- Name: create_home_task(json); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.create_home_task(_body json) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _task_id UUID;
BEGIN

    INSERT INTO tasks (name, end_date, priority_id, project_id, reporter_id, status_id, sort_order)
    VALUES (TRIM((_body ->> 'name')::TEXT),
            (_body ->> 'end_date')::TIMESTAMP,
            (SELECT id FROM task_priorities WHERE value = 1),
            (_body ->> 'project_id')::UUID,
            (_body ->> 'reporter_id')::UUID,

               -- This should be came from client side later
            (SELECT id
             FROM task_statuses
             WHERE project_id = (_body ->> 'project_id')::UUID
               AND category_id IN (SELECT id FROM sys_task_status_categories WHERE is_todo IS TRUE)
             LIMIT 1),
            COALESCE((SELECT MAX(sort_order) + 1 FROM tasks WHERE project_id = (_body ->> 'project_id')::UUID), 0))
    RETURNING id INTO _task_id;

    -- RETURN(SELECT id FROM team_members WHERE user_id=(_body ->> 'reporter_id')::UUID AND team_id=(_body ->> 'team_id')::UUID);

    RETURN home_task_form_view_model((_body ->> 'reporter_id')::UUID, (_body ->> 'team_id')::UUID, _task_id,
                                     (_body ->> 'project_id')::UUID);
END;
$$;


ALTER FUNCTION public.create_home_task(_body json) OWNER TO postgres;

--
-- Name: create_new_team(text, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.create_new_team(_name text, _user_id uuid) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _owner_id          UUID;
    _team_id           UUID;
    _organization_id           UUID;
    _admin_role_id     UUID;
    _owner_role_id     UUID;
    _trimmed_name      TEXT;
    _trimmed_team_name TEXT;
BEGIN

    _trimmed_team_name = TRIM(_name);
    -- get owner id
    SELECT user_id INTO _owner_id FROM teams WHERE id = (SELECT active_team FROM users WHERE id = _user_id);
    SELECT id INTO _organization_id FROM organizations WHERE user_id = _user_id;

    -- insert team
    INSERT INTO teams (name, user_id, organization_id)
    VALUES (_trimmed_team_name, _owner_id, _organization_id)
    RETURNING id INTO _team_id;

    -- insert default roles
    INSERT INTO roles (name, team_id, default_role) VALUES ('Member', _team_id, TRUE);
    INSERT INTO roles (name, team_id, admin_role) VALUES ('Admin', _team_id, TRUE) RETURNING id INTO _admin_role_id;
    INSERT INTO roles (name, team_id, owner) VALUES ('Owner', _team_id, TRUE) RETURNING id INTO _owner_role_id;

    -- insert team member
    INSERT INTO team_members (user_id, team_id, role_id)
    VALUES (_owner_id, _team_id, _owner_role_id);

    IF (_user_id <> _owner_id)
    THEN
        INSERT INTO team_members (user_id, team_id, role_id)
        VALUES (_user_id, _team_id, _admin_role_id);
    END IF;

    RETURN JSON_BUILD_OBJECT(
            'id', _user_id,
            'name', _trimmed_name,
            'team_id', _team_id
        );
END;
$$;


ALTER FUNCTION public.create_new_team(_name text, _user_id uuid) OWNER TO postgres;

--
-- Name: create_new_team(text, uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.create_new_team(_name text, _user_id uuid, _current_team_id uuid) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _owner_id          UUID;
    _team_id           UUID;
    _role_id           UUID;
    _trimmed_team_name TEXT;
BEGIN

    _trimmed_team_name = TRIM(_name);

    -- get owner id
    SELECT user_id INTO _owner_id FROM teams WHERE id = (SELECT active_team FROM users WHERE id = _user_id);

    -- insert team
    INSERT INTO teams (name, user_id, organization_id)
    VALUES (_trimmed_team_name, _owner_id, (SELECT id FROM organizations WHERE user_id = _owner_id)::UUID)
    RETURNING id INTO _team_id;

    -- insert default roles
    INSERT INTO roles (name, team_id, default_role) VALUES ('Member', _team_id, TRUE);
    INSERT INTO roles (name, team_id, admin_role) VALUES ('Admin', _team_id, TRUE);
    INSERT INTO roles (name, team_id, owner) VALUES ('Owner', _team_id, TRUE) RETURNING id INTO _role_id;

    -- insert team member
    INSERT INTO team_members (user_id, team_id, role_id)
    VALUES (_user_id, _team_id, _role_id);

    RETURN JSON_BUILD_OBJECT(
            'id', _user_id,
            'name', _trimmed_team_name,
            'team_id', _team_id
        );
END;
$$;


ALTER FUNCTION public.create_new_team(_name text, _user_id uuid, _current_team_id uuid) OWNER TO postgres;

--
-- Name: create_notification(uuid, uuid, uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.create_notification(_user_id uuid, _team_id uuid, _task_id uuid, _project_id uuid, _message text) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
BEGIN
    IF (_user_id IS NOT NULL AND _team_id IS NOT NULL AND is_null_or_empty(_message) IS FALSE)
    THEN
        INSERT INTO user_notifications (message, user_id, team_id, task_id, project_id)
        VALUES (TRIM(_message), _user_id, _team_id, _task_id, _project_id);
    END IF;

    RETURN JSON_BUILD_OBJECT(
        'project', (SELECT name FROM projects WHERE id = _project_id),
        'project_color', (SELECT color_code FROM projects WHERE id = _project_id),
        'team', (SELECT name FROM teams WHERE id = _team_id)
        );
END
$$;


ALTER FUNCTION public.create_notification(_user_id uuid, _team_id uuid, _task_id uuid, _project_id uuid, _message text) OWNER TO postgres;

--
-- Name: create_project(json); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.create_project(_body json) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _project_id                     UUID;
    _user_id                        UUID;
    _team_id                        UUID;
    _team_member_id                 UUID;
    _client_id                      UUID;
    _client_name                    TEXT;
    _project_name                   TEXT;
    _project_created_log            TEXT;
    _project_member_added_log       TEXT;
    _project_created_log_id         UUID;
    _project_manager_team_member_id UUID;
    _project_key                    TEXT;
BEGIN
    _client_name = TRIM((_body ->> 'client_name')::TEXT);
    _project_name = TRIM((_body ->> 'name')::TEXT);
    _project_key = TRIM((_body ->> 'key')::TEXT);
    _project_created_log = (_body ->> 'project_created_log')::TEXT;
    _project_member_added_log = (_body ->> 'project_member_added_log')::TEXT;
    _user_id = (_body ->> 'user_id')::UUID;
    _team_id = (_body ->> 'team_id')::UUID;
    _project_manager_team_member_id = (_body ->> 'project_manager_id')::UUID;

    SELECT id FROM team_members WHERE user_id = _user_id AND team_id = _team_id INTO _team_member_id;

    -- cache exists client if exists
    SELECT id FROM clients WHERE LOWER(name) = LOWER(_client_name) AND team_id = _team_id INTO _client_id;

    -- insert client if not exists
    IF is_null_or_empty(_client_id) IS TRUE AND is_null_or_empty(_client_name) IS FALSE
    THEN
        INSERT INTO clients (name, team_id) VALUES (_client_name, _team_id) RETURNING id INTO _client_id;
    END IF;

    -- check whether the project name is already in
    IF EXISTS(SELECT name FROM projects WHERE LOWER(name) = LOWER(_project_name) AND team_id = _team_id)
    THEN
        RAISE 'PROJECT_EXISTS_ERROR:%', _project_name;
    END IF;

    -- create the project
    INSERT
    INTO projects (name, key, color_code, start_date, end_date, team_id, notes, owner_id, status_id, health_id, folder_id,
                   category_id, estimated_working_days, estimated_man_days, hours_per_day, 
                   use_manual_progress, use_weighted_progress, use_time_progress, client_id)
    VALUES (_project_name,
            UPPER(_project_key),
            (_body ->> 'color_code')::TEXT,
            (_body ->> 'start_date')::TIMESTAMPTZ,
            (_body ->> 'end_date')::TIMESTAMPTZ,
            _team_id,
            (_body ->> 'notes')::TEXT,
            _user_id,
            (_body ->> 'status_id')::UUID,
            (_body ->> 'health_id')::UUID,
            (_body ->> 'folder_id')::UUID,
            (_body ->> 'category_id')::UUID,
            (_body ->> 'working_days')::INTEGER,
            (_body ->> 'man_days')::INTEGER,
            (_body ->> 'hours_per_day')::INTEGER,
            COALESCE((_body ->> 'use_manual_progress')::BOOLEAN, FALSE),
            COALESCE((_body ->> 'use_weighted_progress')::BOOLEAN, FALSE),
            COALESCE((_body ->> 'use_time_progress')::BOOLEAN, FALSE),
            _client_id)
    RETURNING id INTO _project_id;

    -- register the project log
    INSERT INTO project_logs (project_id, team_id, description)
    VALUES (_project_id, _team_id, _project_created_log)
    RETURNING id INTO _project_created_log_id;

    -- insert the project creator as a project member
    INSERT INTO project_members (team_member_id, project_access_level_id, project_id, role_id)
    VALUES (_team_member_id, (SELECT id FROM project_access_levels WHERE key = 'ADMIN'),
            _project_id,
            (SELECT id FROM roles WHERE team_id = _team_id AND default_role IS TRUE));

    -- insert statuses
    INSERT INTO task_statuses (name, project_id, team_id, category_id, sort_order)
    VALUES ('To Do', _project_id, _team_id, (SELECT id FROM sys_task_status_categories WHERE is_todo IS TRUE), 0);
    INSERT INTO task_statuses (name, project_id, team_id, category_id, sort_order)
    VALUES ('Doing', _project_id, _team_id, (SELECT id FROM sys_task_status_categories WHERE is_doing IS TRUE), 1);
    INSERT INTO task_statuses (name, project_id, team_id, category_id, sort_order)
    VALUES ('Done', _project_id, _team_id, (SELECT id FROM sys_task_status_categories WHERE is_done IS TRUE), 2);

    -- insert default project columns
    PERFORM insert_task_list_columns(_project_id);

    -- add project manager role if exists
    IF NOT is_null_or_empty(_project_manager_team_member_id) THEN
        PERFORM update_project_manager(_project_manager_team_member_id, _project_id);
    END IF;

    RETURN JSON_BUILD_OBJECT(
            'id', _project_id,
            'name', _project_name,
            'project_created_log_id', _project_created_log_id
        );
END;
$$;


ALTER FUNCTION public.create_project(_body json) OWNER TO postgres;

--
-- Name: create_project_comment(json); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.create_project_comment(_body json) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _project_id    UUID;
    _created_by    UUID;
    _comment_id    UUID;
    _team_id       UUID;
    _user_name     TEXT;
    _project_name  TEXT;
    _content       TEXT;
    _mention_index INT := 0;
    _mention       JSON;
BEGIN
    _project_id = (_body ->> 'project_id');
    _created_by = (_body ->> 'created_by');
    _content = (_body ->> 'content');
    _team_id = (_body ->> 'team_id');

    SELECT name FROM users WHERE id = _created_by LIMIT 1 INTO _user_name;
    SELECT name FROM projects WHERE id = _project_id INTO _project_name;

    INSERT INTO project_comments (content, created_by, project_id)
    VALUES (_content, _created_by, _project_id)
    RETURNING id INTO _comment_id;

    FOR _mention IN SELECT * FROM JSON_ARRAY_ELEMENTS((_body ->> 'mentions')::JSON)
        LOOP

            INSERT INTO project_comment_mentions (comment_id, mentioned_index, mentioned_by, informed_by)
            VALUES (_comment_id, _mention_index, _created_by, (_mention ->> 'id')::UUID);

            PERFORM create_notification(
                    (SELECT id FROM users WHERE id = (_mention ->> 'id')::UUID),
                    (_team_id)::UUID,
                    null,
                    (_project_id)::UUID,
                    CONCAT('<b>', _user_name, '</b> has mentioned you in a comment on <b>', _project_name, '</b>')
                );
            _mention_index := _mention_index + 1;

        END LOOP;

    RETURN JSON_BUILD_OBJECT(
            'id', (_comment_id)::UUID,
            'content', (_content)::TEXT,
            'project_name', (_project_name)::TEXT,
            'team_name', (SELECT name FROM teams WHERE id = (_team_id)::UUID)
        );
END
$$;


ALTER FUNCTION public.create_project_comment(_body json) OWNER TO postgres;

--
-- Name: create_project_member(json); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.create_project_member(_body json) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _id             UUID;
    _team_member_id UUID;
    _team_id        UUID;
    _project_id     UUID;
    _user_id        UUID;
    _member_user_id UUID;
    _notification   TEXT;
    _access_level   TEXT;
BEGIN
    _team_member_id = (_body ->> 'team_member_id')::UUID;
    _team_id = (_body ->> 'team_id')::UUID;
    _project_id = (_body ->> 'project_id')::UUID;
    _user_id = (_body ->> 'user_id')::UUID;
    _access_level = (_body ->> 'access_level')::TEXT;

    SELECT user_id FROM team_members WHERE id = _team_member_id INTO _member_user_id;

    INSERT INTO project_members (team_member_id, project_access_level_id, project_id, role_id)
    VALUES (_team_member_id, (SELECT id FROM project_access_levels WHERE key = _access_level)::UUID,
            _project_id,
            (SELECT id FROM roles WHERE team_id = _team_id AND default_role IS TRUE))
    RETURNING id INTO _id;

    IF (_member_user_id != _user_id)
    THEN
        _notification = CONCAT('You have been added to the <b>',
                               (SELECT name FROM projects WHERE id = _project_id),
                               '</b> by <b>',
                               (SELECT name FROM users WHERE id = _user_id), '</b>');
        PERFORM create_notification(
                (SELECT user_id FROM team_members WHERE id = _team_member_id),
                _team_id,
                NULL,
                _project_id,
                _notification
            );
    END IF;

    RETURN JSON_BUILD_OBJECT(
            'id', _id,
            'notification', _notification,
            'socket_id', (SELECT socket_id FROM users WHERE id = _member_user_id),
            'project', (SELECT name FROM projects WHERE id = _project_id),
            'project_id', _project_id,
            'project_color', (SELECT color_code FROM projects WHERE id = _project_id),
            'team', (SELECT name FROM teams WHERE id = _team_id),
            'member_user_id', _member_user_id
        );
END
$$;


ALTER FUNCTION public.create_project_member(_body json) OWNER TO postgres;

--
-- Name: create_project_template(json); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.create_project_template(_body json) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _template_id UUID;
BEGIN
    -- check whether the project name is already in
    IF EXISTS(SELECT name
              FROM custom_project_templates
              WHERE LOWER(name) = LOWER((_body ->> 'name')::TEXT)
                AND team_id = (_body ->> 'team_id')::uuid)
    THEN
        RAISE 'TEMPLATE_EXISTS_ERROR:%', (_body ->> 'name')::TEXT;
    END IF;

    -- insert client if not exists
    INSERT INTO custom_project_templates(name, phase_label, color_code, notes, team_id)
    VALUES ((_body ->> 'name')::TEXT, (_body ->> 'phase_label')::TEXT, (_body ->> 'color_code')::TEXT,
            (_body ->> 'notes')::TEXT,
            (_body ->> 'team_id')::uuid)
    RETURNING id INTO _template_id;

    RETURN JSON_BUILD_OBJECT('id', _template_id);
END;
$$;


ALTER FUNCTION public.create_project_template(_body json) OWNER TO postgres;

--
-- Name: create_pt_task_status(json, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.create_pt_task_status(_body json, _team_id uuid) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _status_id    UUID;
    _group_status JSON;
BEGIN
    INSERT INTO cpt_task_statuses (name, template_id, team_id, category_id, sort_order)
    VALUES (TRIM((_body ->> 'name')::TEXT),
            (_body ->> 'template_id')::UUID,
            _team_id,
            (_body ->> 'category_id')::UUID,
            COALESCE((SELECT MAX(sort_order) + 1
                      FROM cpt_task_statuses
                      WHERE template_id = (_body ->> 'template_id') ::UUID),
                         0)) RETURNING id INTO _status_id;
    SELECT ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec)))
    FROM (SELECT id,
                 name,
                 template_id,
                 team_id,
                 category_id,
                 sort_order,
                 (SELECT color_code
                  FROM sys_task_status_categories
                  WHERE id =
                        (SELECT category_id FROM cpt_task_statuses WHERE id = _status_id)) AS color_code
          FROM cpt_task_statuses
          WHERE id = _status_id) rec INTO _group_status;
    RETURN _group_status;
END;
$$;


ALTER FUNCTION public.create_pt_task_status(_body json, _team_id uuid) OWNER TO postgres;

--
-- Name: create_quick_pt_task(json); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.create_quick_pt_task(_body json) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _task_id     UUID;
    _parent_task UUID;
    _status_id   UUID;
    _priority_id UUID;
BEGIN

    _parent_task = (_body ->> 'parent_task_id')::UUID;
    _status_id = COALESCE(
            (_body ->> 'status_id')::UUID,
            (SELECT id
             FROM cpt_task_statuses
             WHERE template_id = (_body ->> 'template_id')::UUID
               AND category_id IN (SELECT id FROM sys_task_status_categories WHERE is_todo IS TRUE)
             LIMIT 1)
        );
    _priority_id = COALESCE((_body ->> 'priority_id')::UUID, (SELECT id FROM task_priorities WHERE value = 1));

    INSERT INTO cpt_tasks(name, priority_id, template_id, status_id, parent_task_id, sort_order, task_no)
    VALUES (TRIM((_body ->> 'name')::TEXT),
            _priority_id,
            (_body ->> 'template_id')::UUID,

               -- This should be came from client side later
            _status_id, _parent_task,
            COALESCE((SELECT MAX(sort_order) + 1 FROM cpt_tasks WHERE template_id = (_body ->> 'template_id')::UUID),
                     0), ((SELECT COUNT(*) FROM cpt_tasks WHERE template_id = (_body ->> 'template_id')::UUID) + 1))
    RETURNING id INTO _task_id;

    PERFORM handle_on_pt_task_phase_change(_task_id, (_body ->> 'phase_id')::UUID);

    RETURN get_single_pt_task(_task_id);
END;
$$;


ALTER FUNCTION public.create_quick_pt_task(_body json) OWNER TO postgres;

--
-- Name: create_quick_task(json); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.create_quick_task(_body json) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _task_id     UUID;
    _parent_task UUID;
    _status_id   UUID;
    _priority_id UUID;
    _start_date  TIMESTAMP;
    _end_date    TIMESTAMP;
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

    INSERT INTO tasks (name, priority_id, project_id, reporter_id, status_id, parent_task_id, sort_order, start_date, end_date)
    VALUES (TRIM((_body ->> 'name')::TEXT),
            _priority_id,
            (_body ->> 'project_id')::UUID,
            (_body ->> 'reporter_id')::UUID,

               -- This should be came from client side later
            _status_id, _parent_task,
            COALESCE((SELECT MAX(sort_order) + 1 FROM tasks WHERE project_id = (_body ->> 'project_id')::UUID), 0),
            (_body ->> 'start_date')::TIMESTAMP,
            (_body ->> 'end_date')::TIMESTAMP)
    RETURNING id INTO _task_id;

    PERFORM handle_on_task_phase_change(_task_id, (_body ->> 'phase_id')::UUID);

    RETURN get_single_task(_task_id);
END;
$$;


ALTER FUNCTION public.create_quick_task(_body json) OWNER TO postgres;

--
-- Name: create_recurring_task_template(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.create_recurring_task_template(p_task_id uuid, p_schedule_id uuid) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
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
        assignees,
        labels
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
        ) AS labels
    FROM tasks t
    WHERE t.id = p_task_id
    RETURNING id INTO v_new_id;

    RETURN v_new_id;
END;
$$;


ALTER FUNCTION public.create_recurring_task_template(p_task_id uuid, p_schedule_id uuid) OWNER TO postgres;

--
-- Name: create_task(json); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.create_task(_body json) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _assignee      TEXT;
    _attachment_id TEXT;
    _assignee_id   UUID;
    _task_id       UUID;
    _label         JSON;
BEGIN
    INSERT INTO tasks (name, done, priority_id, project_id, reporter_id, start_date, end_date, total_minutes,
                       description, parent_task_id, status_id, sort_order)
    VALUES (TRIM((_body ->> 'name')::TEXT), (FALSE),
            COALESCE((_body ->> 'priority_id')::UUID, (SELECT id FROM task_priorities WHERE value = 1)),
            (_body ->> 'project_id')::UUID,
            (_body ->> 'reporter_id')::UUID,
            (_body ->> 'start')::TIMESTAMPTZ,
            (_body ->> 'end')::TIMESTAMPTZ,
            (_body ->> 'total_minutes')::NUMERIC,
            (_body ->> 'description')::TEXT,
            (_body ->> 'parent_task_id')::UUID,
            (_body ->> 'status_id')::UUID,
            COALESCE((SELECT MAX(sort_order) + 1 FROM tasks WHERE project_id = (_body ->> 'project_id')::UUID), 0))
    RETURNING id INTO _task_id;

    -- insert task assignees
    FOR _assignee IN SELECT * FROM JSON_ARRAY_ELEMENTS((_body ->> 'assignees')::JSON)
        LOOP
            _assignee_id = TRIM('"' FROM _assignee)::UUID;
            PERFORM create_task_assignee(_assignee_id, (_body ->> 'project_id')::UUID, _task_id,
                                         (_body ->> 'reporter_id')::UUID);
        END LOOP;

    FOR _attachment_id IN SELECT * FROM JSON_ARRAY_ELEMENTS((_body ->> 'attachments')::JSON)
        LOOP
            UPDATE task_attachments SET task_id = _task_id WHERE id = TRIM('"' FROM _attachment_id)::UUID;
        END LOOP;

    FOR _label IN SELECT * FROM JSON_ARRAY_ELEMENTS((_body ->> 'labels')::JSON)
        LOOP
            PERFORM assign_or_create_label((_body ->> 'team_id')::UUID, _task_id, (_label ->> 'name')::TEXT,
                                           (_label ->> 'color')::TEXT);
        END LOOP;

    RETURN get_task_form_view_model((_body ->> 'reporter_id')::UUID, (_body ->> 'team_id')::UUID, _task_id,
                                    (_body ->> 'project_id')::UUID);
END;
$$;


ALTER FUNCTION public.create_task(_body json) OWNER TO postgres;

--
-- Name: create_task_assignee(uuid, uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.create_task_assignee(_team_member_id uuid, _project_id uuid, _task_id uuid, _reporter_user_id uuid) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _project_member    JSON;
    _project_member_id UUID;
    _team_id           UUID;
    _user_id           UUID;
BEGIN
    SELECT id
    FROM project_members
    WHERE team_member_id = _team_member_id
      AND project_id = _project_id
    INTO _project_member_id;

    SELECT team_id FROM team_members WHERE id = _team_member_id INTO _team_id;
    SELECT user_id FROM team_members WHERE id = _team_member_id INTO _user_id;

    IF is_null_or_empty(_project_member_id)
    THEN
        SELECT create_project_member(JSON_BUILD_OBJECT(
            'team_member_id', _team_member_id,
            'team_id', _team_id,
            'project_id', _project_id,
            'user_id', _reporter_user_id,
            'access_level', 'MEMBER'::TEXT
            ))
        INTO _project_member;
        _project_member_id = (_project_member ->> 'id')::UUID;
    END IF;

    INSERT INTO tasks_assignees (task_id, project_member_id, team_member_id, assigned_by)
    VALUES (_task_id, _project_member_id, _team_member_id, _reporter_user_id);

    RETURN JSON_BUILD_OBJECT(
        'task_id', _task_id,
        'project_member_id', _project_member_id,
        'team_member_id', _team_member_id,
        'team_id', _team_id,
        'user_id', _user_id
        );
END
$$;


ALTER FUNCTION public.create_task_assignee(_team_member_id uuid, _project_id uuid, _task_id uuid, _reporter_user_id uuid) OWNER TO postgres;

--
-- Name: create_task_comment(json); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.create_task_comment(_body json) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _task_id             UUID;
    _user_id             UUID;
    _comment_id          UUID;
    _team_member_id      UUID;
    _mentioned_member_id TEXT;
    _user_name           TEXT;
    _task_name           TEXT;
    _mention_index INT := 0;
    _mention       JSON;
BEGIN

    _task_id = (_body ->> 'task_id')::UUID;
    _user_id = (_body ->> 'user_id')::UUID;

    SELECT name FROM users WHERE id = _user_id LIMIT 1 INTO _user_name;
    SELECT name FROM tasks WHERE id = _task_id INTO _task_name;

    SELECT id
    FROM team_members
    WHERE user_id = _user_id
      AND team_id = (_body ->> 'team_id')::UUID
    INTO _team_member_id;

    INSERT INTO task_comments (user_id, team_member_id, task_id)
    VALUES (_user_id, _team_member_id, _task_id)
    RETURNING id INTO _comment_id;

    INSERT INTO task_comment_contents (index, comment_id, text_content)
    VALUES (0, _comment_id, (_body ->> 'content')::TEXT);

    -- notify mentions
    FOR _mention IN SELECT * FROM JSON_ARRAY_ELEMENTS((_body ->> 'mentions')::JSON)
        LOOP
            INSERT INTO task_comment_mentions (comment_id, mentioned_index, mentioned_by, informed_by)
                VALUES (_comment_id, _mention_index, _user_id, (_mention ->> 'team_member_id')::UUID);
            PERFORM create_notification(
                (SELECT user_id FROM team_members WHERE id = TRIM(BOTH '"' FROM (_mention ->> 'team_member_id'))::UUID),
                (_body ->> 'team_id')::UUID,
                _task_id,
                (SELECT project_id FROM tasks WHERE id = _task_id),
                CONCAT('<b>', _user_name, '</b> has mentioned you in a comment on <b>', _task_name, '</b>')
                );
            _mention_index := _mention_index + 1;
        END LOOP;

    RETURN JSON_BUILD_OBJECT(
        'id', _comment_id,
        'content', (_body ->> 'content')::TEXT,
        'task_name', _task_name,
        'project_id', (SELECT project_id FROM tasks WHERE id = _task_id),
        'project_name', (SELECT name FROM projects WHERE id = (SELECT project_id FROM tasks WHERE id = _task_id)),
        'team_name', (SELECT name FROM teams WHERE id = (_body ->> 'team_id')::UUID)
        );
END
$$;


ALTER FUNCTION public.create_task_comment(_body json) OWNER TO postgres;

--
-- Name: create_task_status(json, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.create_task_status(_body json, _team_id uuid) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _status_id    UUID;
    _group_status JSON;
BEGIN

    INSERT INTO task_statuses (name, project_id, team_id, category_id, sort_order)
    VALUES (TRIM((_body ->> 'name')::TEXT),
            (_body ->> 'project_id')::UUID,
            _team_id,
            (_body ->> 'category_id')::UUID,
            COALESCE((SELECT MAX(sort_order) + 1 FROM task_statuses WHERE project_id = (_body ->> 'project_id')::UUID),
                     0))
    RETURNING id INTO _status_id;

    SELECT ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec)))
    FROM (SELECT id,
                 name,
                 project_id,
                 team_id,
                 category_id,
                 sort_order,
                 (SELECT color_code
                  FROM sys_task_status_categories
                  WHERE id =
                        (SELECT category_id FROM task_statuses WHERE id = _status_id)) AS color_code
          FROM task_statuses
          WHERE id = _status_id) rec
    INTO _group_status;

    RETURN _group_status;

END;
$$;


ALTER FUNCTION public.create_task_status(_body json, _team_id uuid) OWNER TO postgres;

--
-- Name: create_task_template(text, uuid, json); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.create_task_template(_name text, _team_id uuid, _tasks json) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _template_id UUID;
    _task        JSON;
BEGIN

    -- check whether the project name is already in
    IF EXISTS(
        SELECT name FROM task_templates WHERE LOWER(name) = LOWER(_name)
                                    AND team_id = _team_id
    )
    THEN
        RAISE 'TASK_TEMPLATE_EXISTS_ERROR:%', _name;
    END IF;

    INSERT INTO task_templates (name, team_id) VALUES (_name, _team_id) RETURNING id INTO _template_id;

    -- insert tasks for task templates
    FOR _task IN SELECT * FROM JSON_ARRAY_ELEMENTS(_tasks)
        LOOP
            INSERT INTO task_templates_tasks (template_id, name, total_minutes) VALUES (_template_id, (_task ->> 'name')::TEXT, (SELECT total_minutes FROM tasks WHERE id = (_task ->> 'id')::UUID)::NUMERIC);
        END LOOP;

    RETURN JSON_BUILD_OBJECT(
        'id', _template_id,
        'template_name', _name
        );
END
$$;


ALTER FUNCTION public.create_task_template(_name text, _team_id uuid, _tasks json) OWNER TO postgres;

--
-- Name: create_team_member(json); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.create_team_member(_body json) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _team_id        UUID;
    _user_id        UUID;
    _job_title_id   UUID;
    _team_member_id UUID;
    _role_id        UUID;
    _email          TEXT;
    _output         JSON;
BEGIN
    _team_id = (_body ->> 'team_id')::UUID;

    IF ((_body ->> 'is_admin')::BOOLEAN IS TRUE)
    THEN
        SELECT id FROM roles WHERE team_id = _team_id AND admin_role IS TRUE INTO _role_id;
    ELSE
        SELECT id FROM roles WHERE team_id = _team_id AND default_role IS TRUE INTO _role_id;
    END IF;

    IF is_null_or_empty((_body ->> 'job_title')) IS FALSE
    THEN
        SELECT insert_job_title((_body ->> 'job_title')::TEXT, _team_id) INTO _job_title_id;
    ELSE
        _job_title_id = NULL;
    END IF;

    CREATE TEMPORARY TABLE temp_new_team_members (
        name                TEXT,
        email               TEXT,
        is_new              BOOLEAN,
        team_member_id      UUID,
        team_member_user_id UUID
    );

    FOR _email IN SELECT * FROM JSON_ARRAY_ELEMENTS((_body ->> 'emails')::JSON)
        LOOP

            _email = LOWER(TRIM('"' FROM _email)::TEXT);

            SELECT id FROM users WHERE email = _email INTO _user_id;

            INSERT INTO team_members (job_title_id, user_id, team_id, role_id)
            VALUES (_job_title_id, _user_id, _team_id, _role_id)
            RETURNING id INTO _team_member_id;

            IF EXISTS(SELECT id
                      FROM email_invitations
                      WHERE email = _email
                        AND team_id = _team_id)
            THEN
                --                 DELETE
--                 FROM team_members
--                 WHERE id = (SELECT team_member_id
--                             FROM email_invitations
--                             WHERE email = _email
--                               AND team_id = _team_id);
--                 DELETE FROM email_invitations WHERE team_id = _team_id AND email = _email;

                DELETE FROM email_invitations WHERE email = _email AND team_id = _team_id;

--                 RAISE 'ERROR_EMAIL_INVITATION_EXISTS:%', _email;
            END IF;

            INSERT INTO email_invitations(team_id, team_member_id, email, name)
            VALUES (_team_id, _team_member_id, _email, SPLIT_PART(_email, '@', 1));

            INSERT INTO temp_new_team_members (is_new, team_member_id, team_member_user_id, name, email)
            VALUES ((is_null_or_empty(_user_id)), _team_member_id, _user_id,
                    (SELECT name FROM users WHERE id = _user_id), _email);
        END LOOP;

    SELECT ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec)))
    FROM (SELECT * FROM temp_new_team_members) rec
    INTO _output;

    DROP TABLE temp_new_team_members;

    RETURN _output;
END;
$$;


ALTER FUNCTION public.create_team_member(_body json) OWNER TO postgres;

--
-- Name: delete_user(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.delete_user(_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
BEGIN
--     SET SESSION_REPLICATION_ROLE = replica;

    UPDATE users SET active_team = NULL WHERE id = _id;
    DELETE FROM notification_settings WHERE user_id = _id;
    DELETE FROM teams WHERE user_id = _id;
    DELETE FROM roles WHERE team_id IN (SELECT id FROM teams WHERE user_id = _id);
    DELETE
    FROM tasks_assignees
    WHERE project_member_id IN
          (SELECT id FROM project_members WHERE team_member_id IN (SELECT id FROM team_members WHERE user_id = _id));
    DELETE FROM project_members WHERE team_member_id IN (SELECT id FROM team_members WHERE user_id = _id);
    DELETE FROM team_members WHERE user_id = _id;
    DELETE FROM job_titles WHERE team_id = (SELECT id FROM teams WHERE user_id = _id);
    DELETE
    FROM tasks
    WHERE project_id IN (SELECT id FROM projects WHERE team_id = (SELECT id FROM teams WHERE user_id = _id));
    DELETE FROM projects WHERE team_id = (SELECT id FROM teams WHERE user_id = _id);
    DELETE FROM clients WHERE team_id = (SELECT id FROM teams WHERE user_id = _id);
    DELETE FROM teams WHERE user_id = _id;
    DELETE FROM personal_todo_list WHERE user_id = _id;
    DELETE FROM user_notifications WHERE user_id = _id;
    UPDATE users SET active_team = NULL WHERE id = _id;
    DELETE FROM users WHERE id = _id;

--     SET SESSION_REPLICATION_ROLE = default;
END;
$$;


ALTER FUNCTION public.delete_user(_id uuid) OWNER TO postgres;

--
-- Name: deserialize_user(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.deserialize_user(_id uuid) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _result JSON;
BEGIN
    -- Optimized version using CTEs for better performance and maintainability
    WITH user_team_data AS (
        SELECT
            u.id,
            u.name,
            u.email,
            u.timezone_id AS timezone,
            u.avatar_url,
            u.user_no,
            u.socket_id,
            u.created_at AS joined_date,
            u.updated_at AS last_updated,
            u.setup_completed AS my_setup_completed,
            (is_null_or_empty(u.google_id) IS FALSE) AS is_google,
            COALESCE(u.active_team, (SELECT id FROM teams WHERE user_id = u.id LIMIT 1)) AS team_id,
            u.active_team
        FROM users u
        WHERE u.id = _id
    ),
    team_org_data AS (
        SELECT
            utd.*,
            t.name AS team_name,
            t.user_id AS owner_id,
            o.subscription_status,
            o.license_type_id,
            o.trial_expire_date
        FROM user_team_data utd
        INNER JOIN teams t ON t.id = utd.team_id
        LEFT JOIN organizations o ON o.user_id = t.user_id
    ),
    notification_data AS (
        SELECT
            tod.*,
            COALESCE(ns.email_notifications_enabled, TRUE) AS email_notifications_enabled
        FROM team_org_data tod
        LEFT JOIN notification_settings ns ON (ns.user_id = tod.id AND ns.team_id = tod.team_id)
    ),
    alerts_data AS (
        SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(alert_rec))), '[]'::JSON) AS alerts
        FROM (SELECT description, type FROM worklenz_alerts WHERE active IS TRUE) alert_rec
    ),
    complete_user_data AS (
        SELECT
            nd.*,
            tz.name AS timezone_name,
            slt.key AS subscription_type,
            tm.id AS team_member_id,
            ad.alerts,
            CASE
                WHEN nd.subscription_status = 'trialing' THEN nd.trial_expire_date::DATE
                WHEN EXISTS(SELECT 1 FROM licensing_custom_subs WHERE user_id = nd.owner_id)
                    THEN (SELECT end_date FROM licensing_custom_subs WHERE user_id = nd.owner_id LIMIT 1)::DATE
                WHEN EXISTS(SELECT 1 FROM licensing_user_subscriptions WHERE user_id = nd.owner_id AND active IS TRUE)
                    THEN (SELECT (next_bill_date)::DATE - INTERVAL '1 day'
                          FROM licensing_user_subscriptions
                          WHERE user_id = nd.owner_id AND active IS TRUE
                          LIMIT 1)::DATE
                ELSE NULL
            END AS valid_till_date,
            CASE
                WHEN is_owner(nd.id, nd.active_team) THEN nd.my_setup_completed
                ELSE TRUE
            END AS setup_completed,
            is_owner(nd.id, nd.active_team) AS owner,
            is_admin(nd.id, nd.active_team) AS is_admin
        FROM notification_data nd
        CROSS JOIN alerts_data ad
        LEFT JOIN timezones tz ON tz.id = nd.timezone
        LEFT JOIN sys_license_types slt ON slt.id = nd.license_type_id
        LEFT JOIN team_members tm ON (tm.user_id = nd.id AND tm.team_id = nd.team_id AND tm.active IS TRUE)
    )
    SELECT ROW_TO_JSON(complete_user_data.*) INTO _result FROM complete_user_data;

    -- Ensure notification settings exist using INSERT...ON CONFLICT for better concurrency
    INSERT INTO notification_settings (user_id, team_id, email_notifications_enabled, popup_notifications_enabled, show_unread_items_count)
    SELECT _id,
           COALESCE((SELECT active_team FROM users WHERE id = _id),
                   (SELECT id FROM teams WHERE user_id = _id LIMIT 1)),
           TRUE, TRUE, TRUE
    ON CONFLICT (user_id, team_id) DO NOTHING;

    RETURN _result;
END
$$;


ALTER FUNCTION public.deserialize_user(_id uuid) OWNER TO postgres;

--
-- Name: ensure_parent_task_without_manual_progress(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.ensure_parent_task_without_manual_progress() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- If this is a new subtask being created or a task is being converted to a subtask
    IF NEW.parent_task_id IS NOT NULL THEN
        -- Force the parent task to NOT use manual progress
        UPDATE tasks
        SET manual_progress = FALSE
        WHERE id = NEW.parent_task_id;
        
        -- Log that we've reset manual progress for a parent task
        RAISE NOTICE 'Reset manual progress for parent task % because it has subtasks', NEW.parent_task_id;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.ensure_parent_task_without_manual_progress() OWNER TO postgres;

--
-- Name: fix_all_duplicate_sort_orders(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fix_all_duplicate_sort_orders() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    RAISE NOTICE 'Starting sort order cleanup for all columns...';
    
    PERFORM fix_sort_order_duplicates();
    PERFORM fix_status_sort_order_duplicates();
    PERFORM fix_priority_sort_order_duplicates();
    PERFORM fix_phase_sort_order_duplicates();
    
    RAISE NOTICE 'Completed sort order cleanup for all columns';
END
$$;


ALTER FUNCTION public.fix_all_duplicate_sort_orders() OWNER TO postgres;

--
-- Name: fix_phase_sort_order_duplicates(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fix_phase_sort_order_duplicates() RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    _project RECORD;
    _task RECORD;
    _counter INTEGER;
BEGIN
    FOR _project IN 
        SELECT DISTINCT project_id 
        FROM tasks 
        WHERE project_id IS NOT NULL
    LOOP
        _counter := 0;
        
        FOR _task IN 
            SELECT id 
            FROM tasks 
            WHERE project_id = _project.project_id 
            ORDER BY phase_sort_order, created_at
        LOOP
            UPDATE tasks 
            SET phase_sort_order = _counter 
            WHERE id = _task.id;
            
            _counter := _counter + 1;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE 'Fixed phase_sort_order duplicates for all projects';
END
$$;


ALTER FUNCTION public.fix_phase_sort_order_duplicates() OWNER TO postgres;

--
-- Name: fix_priority_sort_order_duplicates(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fix_priority_sort_order_duplicates() RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    _project RECORD;
    _task RECORD;
    _counter INTEGER;
BEGIN
    FOR _project IN 
        SELECT DISTINCT project_id 
        FROM tasks 
        WHERE project_id IS NOT NULL
    LOOP
        _counter := 0;
        
        FOR _task IN 
            SELECT id 
            FROM tasks 
            WHERE project_id = _project.project_id 
            ORDER BY priority_sort_order, created_at
        LOOP
            UPDATE tasks 
            SET priority_sort_order = _counter 
            WHERE id = _task.id;
            
            _counter := _counter + 1;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE 'Fixed priority_sort_order duplicates for all projects';
END
$$;


ALTER FUNCTION public.fix_priority_sort_order_duplicates() OWNER TO postgres;

--
-- Name: fix_sort_order_duplicates(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fix_sort_order_duplicates() RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    _project RECORD;
    _task RECORD;
    _counter INTEGER;
BEGIN
    -- For each project, reassign sort_order values to ensure uniqueness
    FOR _project IN 
        SELECT DISTINCT project_id 
        FROM tasks 
        WHERE project_id IS NOT NULL
    LOOP
        _counter := 0;
        
        -- Reassign sort_order values sequentially for this project
        FOR _task IN 
            SELECT id 
            FROM tasks 
            WHERE project_id = _project.project_id 
            ORDER BY sort_order, created_at
        LOOP
            UPDATE tasks 
            SET sort_order = _counter 
            WHERE id = _task.id;
            
            _counter := _counter + 1;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE 'Fixed sort_order duplicates for all projects';
END
$$;


ALTER FUNCTION public.fix_sort_order_duplicates() OWNER TO postgres;

--
-- Name: fix_status_sort_order_duplicates(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fix_status_sort_order_duplicates() RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    _project RECORD;
    _task RECORD;
    _counter INTEGER;
BEGIN
    FOR _project IN 
        SELECT DISTINCT project_id 
        FROM tasks 
        WHERE project_id IS NOT NULL
    LOOP
        _counter := 0;
        
        FOR _task IN 
            SELECT id 
            FROM tasks 
            WHERE project_id = _project.project_id 
            ORDER BY status_sort_order, created_at
        LOOP
            UPDATE tasks 
            SET status_sort_order = _counter 
            WHERE id = _task.id;
            
            _counter := _counter + 1;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE 'Fixed status_sort_order duplicates for all projects';
END
$$;


ALTER FUNCTION public.fix_status_sort_order_duplicates() OWNER TO postgres;

--
-- Name: get_activity_logs_by_task(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_activity_logs_by_task(_task_id uuid) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _result JSON;
BEGIN
    SELECT ROW_TO_JSON(rec)
    INTO _result
    FROM (SELECT (SELECT tasks.created_at FROM tasks WHERE tasks.id = _task_id),
                 (SELECT name
                  FROM users
                  WHERE id = (SELECT reporter_id FROM tasks WHERE id = _task_id)),
                 (SELECT avatar_url
                  FROM users
                  WHERE id = (SELECT reporter_id FROM tasks WHERE id = _task_id)),
                 (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec2))), '[]'::JSON)
                  FROM (SELECT task_id,
                               created_at,
                               attribute_type,
                               log_type,

                               -- Case for previous value
                               (CASE
                                    WHEN (attribute_type = 'status')
                                        THEN (SELECT name FROM task_statuses WHERE id = old_value::UUID)
                                    WHEN (attribute_type = 'priority')
                                        THEN (SELECT name FROM task_priorities WHERE id = old_value::UUID)
                                    WHEN (attribute_type = 'phase' AND old_value <> 'Unmapped')
                                        THEN (SELECT name FROM project_phases WHERE id = old_value::UUID)
                                    WHEN (attribute_type = 'progress' OR attribute_type = 'weight')
                                        THEN old_value
                                    ELSE (old_value) END) AS previous,

                               -- Case for current value
                               (CASE
                                    WHEN (attribute_type = 'assignee')
                                        THEN (SELECT name FROM users WHERE id = new_value::UUID)
                                    WHEN (attribute_type = 'label')
                                        THEN (SELECT name FROM team_labels WHERE id = new_value::UUID)
                                    WHEN (attribute_type = 'status')
                                        THEN (SELECT name FROM task_statuses WHERE id = new_value::UUID)
                                    WHEN (attribute_type = 'priority')
                                        THEN (SELECT name FROM task_priorities WHERE id = new_value::UUID)
                                    WHEN (attribute_type = 'phase' AND new_value <> 'Unmapped')
                                        THEN (SELECT name FROM project_phases WHERE id = new_value::UUID)
                                    WHEN (attribute_type = 'progress' OR attribute_type = 'weight')
                                        THEN new_value
                                    ELSE (new_value) END) AS current,

                               -- Case for assigned user
                               (CASE
                                    WHEN (attribute_type = 'assignee')
                                        THEN (SELECT ROW_TO_JSON(rec)
                                              FROM (SELECT (CASE
                                                                WHEN (new_value IS NOT NULL)
                                                                    THEN (SELECT name FROM users WHERE users.id = new_value::UUID)
                                                                ELSE (next_string) END) AS name,
                                                           (SELECT avatar_url FROM users WHERE users.id = new_value::UUID)) rec)
                                    ELSE (NULL) END) AS assigned_user,

                               -- Case for label data
                               (CASE
                                    WHEN (attribute_type = 'label')
                                        THEN (SELECT ROW_TO_JSON(rec)
                                              FROM (SELECT (SELECT name FROM team_labels WHERE id = new_value::UUID),
                                                           (SELECT color_code FROM team_labels WHERE id = new_value::UUID)) rec)
                                    ELSE (NULL) END) AS label_data,

                               -- Case for previous status
                               (CASE
                                    WHEN (attribute_type = 'status')
                                        THEN (SELECT ROW_TO_JSON(rec)
                                              FROM (SELECT (SELECT name FROM task_statuses WHERE id = old_value::UUID),
                                                           (SELECT color_code
                                                            FROM sys_task_status_categories
                                                            WHERE id = (SELECT category_id FROM task_statuses WHERE id = old_value::UUID)),
                                                           (SELECT color_code_dark
                                                            FROM sys_task_status_categories
                                                            WHERE id = (SELECT category_id FROM task_statuses WHERE id = old_value::UUID))) rec)
                                    ELSE (NULL) END) AS previous_status,

                               -- Case for next status
                               (CASE
                                    WHEN (attribute_type = 'status')
                                        THEN (SELECT ROW_TO_JSON(rec)
                                              FROM (SELECT (SELECT name FROM task_statuses WHERE id = new_value::UUID),
                                                           (SELECT color_code
                                                            FROM sys_task_status_categories
                                                            WHERE id = (SELECT category_id FROM task_statuses WHERE id = new_value::UUID)),
                                                           (SELECT color_code_dark
                                                            FROM sys_task_status_categories
                                                            WHERE id = (SELECT category_id FROM task_statuses WHERE id = new_value::UUID))) rec)
                                    ELSE (NULL) END) AS next_status,

                               -- Case for previous priority
                               (CASE
                                    WHEN (attribute_type = 'priority')
                                        THEN (SELECT ROW_TO_JSON(rec)
                                              FROM (SELECT (SELECT name FROM task_priorities WHERE id = old_value::UUID),
                                                           (SELECT color_code FROM task_priorities WHERE id = old_value::UUID)) rec)
                                    ELSE (NULL) END) AS previous_priority,

                               -- Case for next priority
                               (CASE
                                    WHEN (attribute_type = 'priority')
                                        THEN (SELECT ROW_TO_JSON(rec)
                                              FROM (SELECT (SELECT name FROM task_priorities WHERE id = new_value::UUID),
                                                           (SELECT color_code FROM task_priorities WHERE id = new_value::UUID)) rec)
                                    ELSE (NULL) END) AS next_priority,

                               -- Case for previous phase
                               (CASE
                                    WHEN (attribute_type = 'phase' AND old_value <> 'Unmapped')
                                        THEN (SELECT ROW_TO_JSON(rec)
                                              FROM (SELECT (SELECT name FROM project_phases WHERE id = old_value::UUID),
                                                           (SELECT color_code FROM project_phases WHERE id = old_value::UUID)) rec)
                                    ELSE (NULL) END) AS previous_phase,

                               -- Case for next phase
                               (CASE
                                    WHEN (attribute_type = 'phase' AND new_value <> 'Unmapped')
                                        THEN (SELECT ROW_TO_JSON(rec)
                                              FROM (SELECT (SELECT name FROM project_phases WHERE id = new_value::UUID),
                                                           (SELECT color_code FROM project_phases WHERE id = new_value::UUID)) rec)
                                    ELSE (NULL) END) AS next_phase,

                               -- Case for done by
                               (SELECT ROW_TO_JSON(rec)
                                FROM (SELECT (SELECT name FROM users WHERE users.id = tal.user_id),
                                             (SELECT avatar_url FROM users WHERE users.id = tal.user_id)) rec) AS done_by,
                                             
                               -- Add log text for progress and weight
                               (CASE
                                    WHEN (attribute_type = 'progress')
                                        THEN 'updated the progress of'
                                    WHEN (attribute_type = 'weight')
                                        THEN 'updated the weight of'
                                    ELSE ''
                               END) AS log_text


                        FROM task_activity_logs tal
                        WHERE task_id = _task_id
                        ORDER BY created_at DESC) rec2) AS logs) rec;
    RETURN _result;
END;
$$;


ALTER FUNCTION public.get_activity_logs_by_task(_task_id uuid) OWNER TO postgres;

--
-- Name: get_billing_info(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_billing_info(_user_id uuid) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _is_custom BOOLEAN := FALSE;
    _is_ltd    BOOLEAN := FALSE;
    _result    JSON;
BEGIN
    SELECT EXISTS(SELECT id FROM licensing_custom_subs WHERE user_id = _user_id) INTO _is_custom;
    SELECT EXISTS(SELECT 1 FROM licensing_coupon_codes WHERE redeemed_by = _user_id) INTO _is_ltd;

    SELECT ROW_TO_JSON(rec)
    INTO _result
    FROM (SELECT (SELECT name FROM users WHERE ud.user_id = users.id),
                 (SELECT email FROM users WHERE ud.user_id = users.id),
                 contact_number,
                 contact_number_secondary,
                 trial_in_progress,
                 trial_expire_date,
                 unit_price::NUMERIC,
                 cancel_url,
                 subscription_status AS status,
                 lus.cancellation_effective_date,
                 lus.paused_at,
                 lus.paused_from::DATE,
                 lus.paused_reason,
                 _is_custom AS is_custom,
                 _is_ltd AS is_ltd_user,
                 (SELECT SUM(team_members_limit) FROM licensing_coupon_codes WHERE redeemed_by = _user_id) AS ltd_users,
                 (CASE
                      WHEN (_is_custom) THEN 'Custom Plan'
                      WHEN (_is_ltd) THEN 'Life Time Deal'
                      ELSE
                              (SELECT name FROM licensing_pricing_plans WHERE id = lus.plan_id) END) AS plan_name,
                 (SELECT key FROM sys_license_types WHERE id = ud.license_type_id) AS subscription_type,
                 (SELECT id AS plan_id FROM licensing_pricing_plans WHERE id = lus.plan_id),
                 (SELECT default_currency AS default_currency FROM licensing_pricing_plans WHERE id = lus.plan_id),
                 (SELECT billing_type FROM licensing_pricing_plans WHERE id = lus.plan_id),
                 (CASE
                      WHEN ud.subscription_status = 'trialing' THEN ud.trial_expire_date::DATE
                      WHEN EXISTS (SELECT 1 FROM licensing_custom_subs lcs WHERE lcs.user_id = ud.user_id) THEN
                          (SELECT end_date FROM licensing_custom_subs lcs WHERE lcs.user_id = ud.user_id)::DATE
                      WHEN EXISTS (SELECT 1 FROM licensing_user_subscriptions lus WHERE lus.user_id = ud.user_id) THEN
                          (SELECT next_bill_date::DATE - INTERVAL '1 day'
                           FROM licensing_user_subscriptions lus
                           WHERE lus.user_id = ud.user_id)::DATE
                     END) AS valid_till_date,
                 is_lkr_billing
          FROM organizations ud
                   LEFT JOIN licensing_user_subscriptions lus ON ud.user_id = lus.user_id
          WHERE ud.user_id = _user_id) rec;
    RETURN _result;
END;
$$;


ALTER FUNCTION public.get_billing_info(_user_id uuid) OWNER TO postgres;

--
-- Name: get_daily_digest(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_daily_digest() RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _result JSON;
BEGIN
    SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
    INTO _result
    FROM (
             --
             SELECT name,
                    email,
                    (SELECT get_daily_digest_recently_assigned(u.id)) AS recently_assigned,
                    (SELECT get_daily_digest_overdue(u.id)) AS overdue,
                    (SELECT get_daily_digest_recently_completed(u.id)) AS recently_completed
             FROM users u
             --
         ) rec;
    RETURN _result;
END;
$$;


ALTER FUNCTION public.get_daily_digest() OWNER TO postgres;

--
-- Name: get_daily_digest_overdue(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_daily_digest_overdue(_user_id uuid) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _result JSON;
BEGIN
    SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
    INTO _result
    FROM (
             --
             SELECT id,
                    name,
                    (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(r))), '[]'::JSON) AS projects
                     FROM (
                              --
                              SELECT id,
                                     name,
                                     (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(r))), '[]'::JSON) AS tasks
                                      FROM (
                                               --
                                               SELECT t.id,
                                                      t.name,
                                                      (SELECT STRING_AGG(DISTINCT
                                                                         (SELECT name
                                                                          FROM team_member_info_view
                                                                          WHERE team_member_id = tasks_assignees.team_member_id),
                                                                         ', ')
                                                       FROM tasks_assignees
                                                       WHERE task_id = t.id) AS members
                                               FROM tasks_assignees
                                                        INNER JOIN tasks t ON tasks_assignees.task_id = t.id
                                                        INNER JOIN team_members tm ON tasks_assignees.team_member_id = tm.id
                                               WHERE tm.user_id = _user_id
                                                 AND t.project_id = projects.id
                                                 AND t.end_date IS NOT NULL
                                                 AND t.end_date < CURRENT_DATE
                                                 AND EXISTS(SELECT id
                                                            FROM task_statuses
                                                            WHERE id = t.status_id
                                                              AND category_id IN
                                                                  (SELECT id FROM sys_task_status_categories WHERE is_done IS FALSE))
                                               LIMIT 10
                                               --
                                           ) r)
                              FROM projects
                              WHERE projects.team_id IN
                                    (SELECT team_id
                                     FROM team_members
                                     WHERE user_id = _user_id
                                       AND team_members.team_id = teams.id)
                              --
                          ) r)
             FROM teams
             WHERE (SELECT daily_digest_enabled
                    FROM notification_settings
                    WHERE team_id = teams.id
                      AND user_id = _user_id) IS TRUE
               AND EXISTS(SELECT 1
                          FROM team_members
                          WHERE team_id = teams.id
                            AND team_members.user_id = _user_id)
             --
         ) rec;

    RETURN _result;
END
$$;


ALTER FUNCTION public.get_daily_digest_overdue(_user_id uuid) OWNER TO postgres;

--
-- Name: get_daily_digest_recently_assigned(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_daily_digest_recently_assigned(_user_id uuid) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _result JSON;
BEGIN
    SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
    INTO _result
    FROM (
             --

             --
             SELECT id,
                    name,
                    (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(r))), '[]'::JSON) AS projects
                     FROM (
                              --
                              SELECT id,
                                     name,
                                     (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(r))), '[]'::JSON) AS tasks
                                      FROM (
                                               --
                                               SELECT t.id,
                                                      t.name,
                                                      (SELECT STRING_AGG(DISTINCT
                                                                         (SELECT name
                                                                          FROM team_member_info_view
                                                                          WHERE team_member_id = tasks_assignees.team_member_id),
                                                                         ', ')
                                                       FROM tasks_assignees
                                                       WHERE task_id = t.id) AS members
                                               FROM tasks_assignees
                                                        INNER JOIN tasks t ON tasks_assignees.task_id = t.id
                                                        INNER JOIN team_members tm ON tasks_assignees.team_member_id = tm.id
                                               WHERE tm.user_id = _user_id
                                                 AND t.project_id = projects.id
                                                 AND TO_CHAR(tasks_assignees.created_at, 'yyyy-mm-dd') =
                                                     TO_CHAR(CURRENT_DATE, 'yyyy-mm-dd')
                                               --
                                           ) r)
                              FROM projects
                              WHERE projects.team_id IN
                                    (SELECT team_id
                                     FROM team_members
                                     WHERE user_id = _user_id
                                       AND team_members.team_id = teams.id)
                              --
                          ) r)
             FROM teams
             WHERE (SELECT daily_digest_enabled
                    FROM notification_settings
                    WHERE team_id = teams.id
                      AND user_id = _user_id) IS TRUE
               AND EXISTS(SELECT 1
                          FROM team_members
                          WHERE team_id = teams.id
                            AND team_members.user_id = _user_id)
             --
         ) rec;

    RETURN _result;
END
$$;


ALTER FUNCTION public.get_daily_digest_recently_assigned(_user_id uuid) OWNER TO postgres;

--
-- Name: get_daily_digest_recently_completed(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_daily_digest_recently_completed(_user_id uuid) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _result JSON;
BEGIN
    SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
    INTO _result
    FROM (
             --
             SELECT id,
                    name,
                    (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(r))), '[]'::JSON) AS projects
                     FROM (
                              --
                              SELECT name,
                                     (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(r))), '[]'::JSON) AS tasks
                                      FROM (
                                               --
                                               SELECT t.id,
                                                      t.name,
                                                      (SELECT STRING_AGG(DISTINCT
                                                                         (SELECT name
                                                                          FROM team_member_info_view
                                                                          WHERE team_member_id = tasks_assignees.team_member_id),
                                                                         ', ')
                                                       FROM tasks_assignees
                                                       WHERE task_id = t.id) AS members
                                               FROM tasks_assignees
                                                        INNER JOIN tasks t ON tasks_assignees.task_id = t.id
                                                        INNER JOIN team_members tm ON tasks_assignees.team_member_id = tm.id
                                               WHERE tm.user_id = _user_id
                                                 AND t.project_id = projects.id
                                                 AND t.completed_at IS NOT NULL
                                                 AND TO_CHAR(t.completed_at, 'yyyy-mm-dd') =
                                                     TO_CHAR(CURRENT_DATE, 'yyyy-mm-dd')
                                               LIMIT 10
                                               --
                                           ) r)
                              FROM projects
                              WHERE projects.team_id IN
                                    (SELECT team_id
                                     FROM team_members
                                     WHERE user_id = _user_id
                                       AND team_members.team_id = teams.id)
                              --
                          ) r)
             FROM teams
             WHERE (SELECT daily_digest_enabled
                    FROM notification_settings
                    WHERE team_id = teams.id
                      AND user_id = _user_id) IS TRUE
               AND EXISTS(SELECT 1
                          FROM team_members
                          WHERE team_id = teams.id
                            AND team_members.user_id = _user_id)
             --
         ) rec;

    RETURN _result;
END
$$;


ALTER FUNCTION public.get_daily_digest_recently_completed(_user_id uuid) OWNER TO postgres;

--
-- Name: get_last_updated_tasks_by_project(uuid, integer, integer, boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_last_updated_tasks_by_project(_project_id uuid, _limit integer, _offset integer, _archived boolean) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _tasks JSON;
BEGIN
    SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
    INTO _tasks
    FROM (SELECT id,
                 name,
                 (SELECT name FROM task_statuses WHERE status_id = task_statuses.id) AS status,
                 status_id,
                 end_date,
                 priority_id AS priority,
                 updated_at,
                 (SELECT color_code
                  FROM sys_task_status_categories
                  WHERE id = (SELECT category_id FROM task_statuses WHERE id = status_id)) AS status_color
          FROM tasks
          WHERE project_id = _project_id
            AND CASE
                    WHEN (_archived IS TRUE) THEN project_id IS NOT NULL
                    ELSE archived IS FALSE END
          ORDER BY updated_at DESC
          LIMIT _limit OFFSET _offset) rec;
    RETURN _tasks;
END
$$;


ALTER FUNCTION public.get_last_updated_tasks_by_project(_project_id uuid, _limit integer, _offset integer, _archived boolean) OWNER TO postgres;

--
-- Name: get_my_tasks(uuid, uuid, numeric, numeric, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_my_tasks(_team_id uuid, _user_id uuid, _size numeric, _offset numeric, _filter text) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _result JSON;
BEGIN
    -- _filter = '0' is tasks due today
    IF _filter = '0'
    THEN
        SELECT ROW_TO_JSON(rec)
        INTO _result
        FROM (SELECT COUNT(*) AS total,
                     (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                      FROM (SELECT t.id,
                                   t.name,
                                   t.project_id,
                                   t.status_id,
                                   t.start_date,
                                   t.end_date,
                                   t.created_at,
                                   p.team_id,
                                   p.name AS project_name,
                                   p.color_code AS project_color,
                                   (SELECT name FROM task_statuses WHERE id = t.status_id) AS status,
                                   (SELECT color_code
                                    FROM sys_task_status_categories
                                    WHERE id = (SELECT category_id FROM task_statuses WHERE id = t.status_id)) AS status_color,
                                   TRUE AS is_task
                            FROM tasks t
                                     CROSS JOIN projects p
                            WHERE t.project_id = p.id
                              AND t.archived IS FALSE
                              AND t.end_date::DATE = CURRENT_DATE::DATE
                              AND t.status_id NOT IN (SELECT id
                                                      FROM task_statuses
                                                      WHERE category_id NOT IN
                                                            (SELECT id FROM sys_task_status_categories WHERE is_done IS FALSE))
                              AND t.id IN
                                  (SELECT task_id
                                   FROM tasks_assignees
                                   WHERE team_member_id = (SELECT id
                                                           FROM team_members
                                                           WHERE user_id = _user_id
                                                             AND team_id = _team_id))
                            ORDER BY p.updated_at, created_at
                            LIMIT _size OFFSET _offset) rec) AS data
              FROM tasks t
                       CROSS JOIN projects p
              WHERE t.project_id = p.id
                AND t.archived IS FALSE
                AND t.end_date::DATE = CURRENT_DATE::DATE
                AND t.status_id NOT IN (SELECT id
                                        FROM task_statuses
                                        WHERE category_id NOT IN
                                              (SELECT id FROM sys_task_status_categories WHERE is_done IS FALSE))
                AND t.id IN
                    (SELECT task_id
                     FROM tasks_assignees
                     WHERE team_member_id = (SELECT id
                                             FROM team_members
                                             WHERE user_id = _user_id
                                               AND team_id = _team_id))) rec;
        RETURN _result;
    END IF;

    -- _filter = '1' is upcoming tasks
    IF _filter = '1'
    THEN
        SELECT ROW_TO_JSON(rec)
        INTO _result
        FROM (SELECT COUNT(*) AS total,
                     (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                      FROM (SELECT t.id,
                                   t.name,
                                   t.project_id,
                                   t.status_id,
                                   t.start_date,
                                   t.end_date,
                                   t.created_at,
                                   p.team_id,
                                   p.name AS project_name,
                                   p.color_code AS project_color,
                                   (SELECT name FROM task_statuses WHERE id = t.status_id) AS status,
                                   (SELECT color_code
                                    FROM sys_task_status_categories
                                    WHERE id = (SELECT category_id FROM task_statuses WHERE id = t.status_id)) AS status_color,
                                   TRUE AS is_task
                            FROM tasks t
                                     CROSS JOIN projects p
                            WHERE t.project_id = p.id
                              AND t.archived IS FALSE
                              AND t.end_date::DATE > CURRENT_DATE::DATE
                              AND t.status_id NOT IN (SELECT id
                                                      FROM task_statuses
                                                      WHERE category_id NOT IN
                                                            (SELECT id FROM sys_task_status_categories WHERE is_done IS FALSE))
                              AND t.id IN
                                  (SELECT task_id
                                   FROM tasks_assignees
                                   WHERE team_member_id = (SELECT id
                                                           FROM team_members
                                                           WHERE user_id = _user_id
                                                             AND team_id = _team_id))
                            ORDER BY p.updated_at, created_at
                            LIMIT _size OFFSET _offset) rec) AS data
              FROM tasks t
                       CROSS JOIN projects p
              WHERE t.project_id = p.id
                AND t.archived IS FALSE
                AND t.end_date::DATE > CURRENT_DATE::DATE
                AND t.status_id NOT IN (SELECT id
                                        FROM task_statuses
                                        WHERE category_id NOT IN
                                              (SELECT id FROM sys_task_status_categories WHERE is_done IS FALSE))
                AND t.id IN
                    (SELECT task_id
                     FROM tasks_assignees
                     WHERE team_member_id = (SELECT id
                                             FROM team_members
                                             WHERE user_id = _user_id
                                               AND team_id = _team_id))) rec;
        RETURN _result;
    END IF;

    -- _filter = '2' is overdue tasks
    IF _filter = '2'
    THEN
        SELECT ROW_TO_JSON(rec)
        INTO _result
        FROM (SELECT COUNT(*) AS total,
                     (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                      FROM (SELECT t.id,
                                   t.name,
                                   t.project_id,
                                   t.status_id,
                                   t.start_date,
                                   t.end_date,
                                   t.created_at,
                                   p.team_id,
                                   p.name AS project_name,
                                   p.color_code AS project_color,
                                   (SELECT name FROM task_statuses WHERE id = t.status_id) AS status,
                                   (SELECT color_code
                                    FROM sys_task_status_categories
                                    WHERE id = (SELECT category_id FROM task_statuses WHERE id = t.status_id)) AS status_color,
                                   TRUE AS is_task
                            FROM tasks t
                                     CROSS JOIN projects p
                            WHERE t.project_id = p.id
                              AND t.archived IS FALSE
                              AND t.end_date::DATE < CURRENT_DATE::DATE
                              AND t.status_id NOT IN (SELECT id
                                                      FROM task_statuses
                                                      WHERE category_id NOT IN
                                                            (SELECT id FROM sys_task_status_categories WHERE is_done IS FALSE))
                              AND t.id IN
                                  (SELECT task_id
                                   FROM tasks_assignees
                                   WHERE team_member_id = (SELECT id
                                                           FROM team_members
                                                           WHERE user_id = _user_id
                                                             AND team_id = _team_id))
                            ORDER BY p.updated_at, created_at
                            LIMIT _size OFFSET _offset) rec) AS data
              FROM tasks t
                       CROSS JOIN projects p
              WHERE t.project_id = p.id
                AND t.archived IS FALSE
                AND t.end_date::DATE < CURRENT_DATE::DATE
                AND t.status_id NOT IN (SELECT id
                                        FROM task_statuses
                                        WHERE category_id NOT IN
                                              (SELECT id FROM sys_task_status_categories WHERE is_done IS FALSE))
                AND t.id IN
                    (SELECT task_id
                     FROM tasks_assignees
                     WHERE team_member_id = (SELECT id
                                             FROM team_members
                                             WHERE user_id = _user_id
                                               AND team_id = _team_id))) rec;
        RETURN _result;
    END IF;

    -- _filter = '3' is todo list
    IF _filter = '3'
    THEN
        SELECT ROW_TO_JSON(rec)
        INTO _result
        FROM (SELECT COUNT(*) AS total,
                     (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                      FROM (SELECT id, name, created_at, color_code, done
                            FROM personal_todo_list
                            WHERE user_id = _user_id
                            ORDER BY updated_at, created_at
                            LIMIT _size OFFSET _offset) rec) AS data) rec;
        RETURN _result;
    END IF;

END;
$$;


ALTER FUNCTION public.get_my_tasks(_team_id uuid, _user_id uuid, _size numeric, _offset numeric, _filter text) OWNER TO postgres;

--
-- Name: get_project_daily_digest(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_project_daily_digest() RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _result JSON;
BEGIN

    SELECT COALESCE(JSON_AGG(rec), '[]'::JSON)
    INTO _result
    FROM (SELECT id,
                 name,
                 (SELECT name FROM teams WHERE id = projects.team_id) AS team_name,

                 (SELECT COALESCE(JSON_AGG(rec), '[]'::JSON)
                  FROM (SELECT id,
                               name,
                               (SELECT STRING_AGG(DISTINCT
                                                  (SELECT name
                                                   FROM team_member_info_view
                                                   WHERE team_member_id = tasks_assignees.team_member_id),
                                                  ', ')
                                FROM tasks_assignees
                                WHERE task_id = tasks.id) AS members
                        FROM tasks
                        WHERE project_id = projects.id
                          AND TO_CHAR(tasks.completed_at, 'yyyy-mm-dd') =
                              TO_CHAR(CURRENT_DATE, 'yyyy-mm-dd')) rec) AS today_completed,

                 (SELECT COALESCE(JSON_AGG(rec), '[]'::JSON)
                  FROM (SELECT id,
                               name,
                               (SELECT STRING_AGG(DISTINCT
                                                  (SELECT name
                                                   FROM team_member_info_view
                                                   WHERE team_member_id = tasks_assignees.team_member_id),
                                                  ', ')
                                FROM tasks_assignees
                                WHERE task_id = tasks.id) AS members
                        FROM tasks
                        WHERE project_id = projects.id
                          AND TO_CHAR(tasks.created_at, 'yyyy-mm-dd') =
                              TO_CHAR(CURRENT_DATE, 'yyyy-mm-dd')) rec) AS today_new,

                 (SELECT COALESCE(JSON_AGG(rec), '[]'::JSON)
                  FROM (SELECT id,
                               name,
                               (SELECT STRING_AGG(DISTINCT
                                                  (SELECT name
                                                   FROM team_member_info_view
                                                   WHERE team_member_id = tasks_assignees.team_member_id),
                                                  ', ')
                                FROM tasks_assignees
                                WHERE task_id = tasks.id) AS members
                        FROM tasks
                        WHERE project_id = projects.id
                          AND TO_CHAR(tasks.end_date, 'yyyy-mm-dd') =
                              TO_CHAR(CURRENT_DATE + INTERVAL '1 day', 'yyyy-mm-dd')) rec) AS due_tomorrow,

                 (SELECT COALESCE(JSON_AGG(rec), '[]'::JSON)
                  FROM (SELECT name, email
                        FROM users
                        WHERE id = (SELECT user_id
                                    FROM project_subscribers
                                    WHERE project_id = projects.id
                                      AND user_id = users.id)) rec) AS subscribers

          FROM projects
          WHERE EXISTS(SELECT 1 FROM project_subscribers WHERE project_id = projects.id)
          ORDER BY team_id, name) rec;

    RETURN _result;
END
$$;


ALTER FUNCTION public.get_project_daily_digest() OWNER TO postgres;

--
-- Name: get_project_deadline_tasks(uuid, boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_project_deadline_tasks(_project_id uuid, _archived boolean) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _result JSON;

BEGIN
    SELECT COALESCE(ROW_TO_JSON(rec), '[]'::JSON)
    INTO _result
    FROM (SELECT (SELECT COUNT(*)
                  FROM tasks
                  WHERE project_id = _project_id
                    AND CASE
                            WHEN (_archived IS TRUE) THEN project_id IS NOT NULL
                            ELSE archived IS FALSE END
                    AND end_date::DATE > (SELECT end_date
                                          FROM projects
                                          WHERE id = _project_id)::DATE) AS deadline_tasks_count,
                 (SELECT SUM(twl.time_spent)
                  FROM tasks t
                           CROSS JOIN task_work_log twl
                  WHERE twl.task_id = t.id
                    AND t.project_id = _project_id
                    AND twl.created_at::DATE > (SELECT end_date
                                                FROM projects
                                                WHERE id = _project_id)::DATE
                    AND CASE
                            WHEN (_archived IS TRUE) THEN t.project_id IS NOT NULL
                            ELSE t.archived IS FALSE END) AS deadline_logged_hours,
                 (SELECT end_date FROM projects WHERE id = _project_id) AS project_end_date,
                 (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(r))), '[]'::JSON) AS tasks
                  FROM (SELECT id,
                               name,
                               status_id,
                               start_date,
                               end_date,
                               (SELECT name FROM task_statuses WHERE id = tasks.status_id) AS status,
                               (SELECT color_code
                                FROM sys_task_status_categories
                                WHERE id = (SELECT category_id FROM task_statuses WHERE id = status_id)) AS status_color

                        FROM tasks
                        WHERE project_id = _project_id
                          AND CASE
                                  WHEN (_archived IS TRUE) THEN project_id IS NOT NULL
                                  ELSE archived IS FALSE END
                          AND end_date::DATE > (SELECT end_date
                                                FROM projects
                                                WHERE id = _project_id)::DATE) r)) rec;
    RETURN _result;

END;
$$;


ALTER FUNCTION public.get_project_deadline_tasks(_project_id uuid, _archived boolean) OWNER TO postgres;

--
-- Name: get_project_gantt_tasks(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_project_gantt_tasks(_project_id uuid) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _tasks JSON;
BEGIN
    SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
    INTO _tasks
    FROM (SELECT p.id,
                 p.name,
                 0 AS level,
                 (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                  FROM (SELECT pm.id,
                               pm.team_member_id,
                               pm.project_access_level_id,
                               (SELECT name
                                FROM job_titles
                                WHERE job_titles.id = tm.job_title_id) AS job_title,
                               (SELECT name
                                FROM team_member_info_view
                                WHERE team_member_info_view.team_member_id = tm.id),
                               u.avatar_url,
                               (SELECT email
                                FROM team_member_info_view
                                WHERE team_member_info_view.team_member_id = tm.id),
                               (SELECT name
                                FROM project_access_levels
                                WHERE project_access_levels.id = pm.project_access_level_id) AS access_level,
                               (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                                FROM (SELECT t.id,
                                             t.name,
                                             t.start_date AS start,
                                             t.project_id,
                                             t.priority_id,
                                             t.done,
                                             t.end_date AS "end",
                                             (SELECT color_code
                                              FROM projects
                                              WHERE projects.id = t.project_id) AS color_code,
                                             t.status_id,
                                             (SELECT name FROM task_statuses WHERE id = t.status_id) AS status,
                                             (SELECT ARRAY_AGG(ROW_TO_JSON(rec))
                                              FROM (SELECT project_member_id AS id,
                                                           (SELECT name
                                                            FROM team_member_info_view
                                                            WHERE team_member_info_view.team_member_id = tm.id),
                                                           u2.avatar_url,
                                                           (SELECT team_member_info_view.email
                                                            FROM team_member_info_view
                                                            WHERE team_member_info_view.team_member_id = tm.id)
                                                    FROM tasks_assignees
                                                             INNER JOIN project_members pm ON pm.id = tasks_assignees.project_member_id
                                                             INNER JOIN team_members tm2 ON pm.team_member_id = tm2.id
                                                             LEFT JOIN users u2 ON tm2.user_id = u2.id
                                                    WHERE project_id = _project_id::UUID
                                                      AND project_member_id = pm.id
                                                      AND t.id = tasks_assignees.task_id
                                                    ORDER BY name) rec) AS assignees
                                      FROM tasks_assignees ta,
                                           tasks t
                                      WHERE t.archived IS FALSE
                                        AND ta.project_member_id = pm.id
                                        AND t.id = ta.task_id
                                      ORDER BY start_date) rec) AS tasks
                        FROM project_members pm
                                 INNER JOIN team_members tm ON pm.team_member_id = tm.id
                                 LEFT JOIN users u ON tm.user_id = u.id
                        WHERE project_id = p.id) rec) AS team_members
          FROM projects p
          WHERE p.id = _project_id::UUID) rec;

    RETURN _tasks;
END;
$$;


ALTER FUNCTION public.get_project_gantt_tasks(_project_id uuid) OWNER TO postgres;

--
-- Name: get_project_member_insights(uuid, boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_project_member_insights(_project_id uuid, _archived boolean) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _result JSON;

BEGIN
    SELECT COALESCE(ROW_TO_JSON(rec), '[]'::JSON)
    INTO _result
    FROM (SELECT (SELECT COUNT(*) FROM project_members WHERE project_id = _project_id) AS total_members_count,
                 (SELECT COUNT(*)
                  FROM project_members
                  WHERE project_id = _project_id
                    AND team_member_id NOT IN
                        (SELECT team_member_id
                         FROM tasks_assignees
                         WHERE task_id IN (SELECT id
                                           FROM tasks
                                           WHERE tasks.project_id = _project_id
                                             AND CASE
                                                     WHEN (_archived IS TRUE) THEN project_id IS NOT NULL
                                                     ELSE archived IS FALSE END))) AS unassigned_members,
                 (SELECT COUNT(*)
                  FROM project_members
                  WHERE project_id = _project_id
                    AND team_member_id IN
                        (SELECT team_member_id
                         FROM tasks_assignees
                         WHERE task_id IN (SELECT id
                                           FROM tasks
                                           WHERE tasks.project_id = _project_id
                                             AND CASE
                                                     WHEN (_archived IS TRUE) THEN project_id IS NOT NULL
                                                     ELSE archived IS FALSE END
                                             AND tasks.end_date::DATE < NOW()::DATE))) AS overdue_members) rec;
    RETURN _result;

END;
$$;


ALTER FUNCTION public.get_project_member_insights(_project_id uuid, _archived boolean) OWNER TO postgres;

--
-- Name: get_project_members(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_project_members(_project_id uuid) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _output JSON;
BEGIN
    SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
    FROM (
             --
             SELECT (SELECT name FROM team_member_info_view WHERE team_member_info_view.team_member_id = tm.id),
                    u.avatar_url
             FROM project_members
                      INNER JOIN team_members tm ON project_members.team_member_id = tm.id
                      LEFT JOIN users u ON tm.user_id = u.id
             WHERE project_id = _project_id
             --
         ) rec
    INTO _output;

    RETURN _output;
END;
$$;


ALTER FUNCTION public.get_project_members(_project_id uuid) OWNER TO postgres;

--
-- Name: get_project_overview_data(uuid, boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_project_overview_data(_project_id uuid, _archived boolean) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _result JSON;

BEGIN
    SELECT COALESCE(ROW_TO_JSON(rec), '[]'::JSON)
    INTO _result
    FROM (SELECT (SELECT COUNT(*) FROM tasks WHERE project_id = _project_id) AS total_tasks_count,
                 (SELECT COUNT(*)
                  FROM tasks
                  WHERE project_id = _project_id
                    AND archived IS TRUE) AS archived_tasks_count,
                 (SELECT COUNT(*)
                  FROM tasks
                  WHERE completed_at > CURRENT_DATE - INTERVAL '7 days'
                    AND project_id = _project_id
                    AND CASE
                            WHEN (_archived IS TRUE) THEN project_id IS NOT NULL
                            ELSE archived IS FALSE END) AS last_week_count,
                 (SELECT COUNT(*)
                  FROM tasks
                  WHERE project_id = _project_id
                    AND parent_task_id IS NOT NULL
                    AND CASE
                            WHEN (_archived IS TRUE) THEN project_id IS NOT NULL
                            ELSE archived IS FALSE END) AS sub_tasks_count,
                 (SELECT COUNT(*)
                  FROM tasks
                  WHERE project_id = _project_id
                    AND CASE
                            WHEN (_archived IS TRUE) THEN project_id IS NOT NULL
                            ELSE archived IS FALSE END
                    AND status_id IN (SELECT id
                                      FROM task_statuses
                                      WHERE project_id = _project_id
                                        AND category_id IN
                                            (SELECT id
                                             FROM sys_task_status_categories
                                             WHERE sys_task_status_categories.is_done IS TRUE))) AS completed_tasks_count,
                 (SELECT color_code
                  FROM sys_task_status_categories
                  WHERE sys_task_status_categories.is_done IS TRUE) AS completed_tasks_color_code,
                 (SELECT COUNT(*)
                  FROM tasks
                  WHERE project_id = _project_id
                    AND CASE
                            WHEN (_archived IS TRUE) THEN project_id IS NOT NULL
                            ELSE archived IS FALSE END
                    AND status_id IN (SELECT id
                                      FROM task_statuses
                                      WHERE project_id = _project_id
                                        AND category_id IN
                                            (SELECT id
                                             FROM sys_task_status_categories
                                             WHERE sys_task_status_categories.is_doing IS TRUE))) AS pending_tasks_count,
                 (SELECT color_code
                  FROM sys_task_status_categories
                  WHERE sys_task_status_categories.is_doing IS TRUE) AS pending_tasks_color_code,
                 (SELECT COUNT(*)
                  FROM tasks
                  WHERE project_id = _project_id
                    AND CASE
                            WHEN (_archived IS TRUE) THEN project_id IS NOT NULL
                            ELSE archived IS FALSE END
                    AND is_completed(status_id, project_id) IS FALSE) AS todo_tasks_count,
                 (SELECT color_code
                  FROM sys_task_status_categories
                  WHERE sys_task_status_categories.is_todo IS TRUE) AS todo_tasks_color_code,
                 (SELECT COUNT(*)
                  FROM tasks
                  WHERE project_id = _project_id
                    AND end_date::DATE < NOW()::DATE
                    AND CASE
                            WHEN (_archived IS TRUE) THEN project_id IS NOT NULL
                            ELSE archived IS FALSE END
                    AND status_id IN (SELECT id
                                      FROM task_statuses
                                      WHERE project_id = _project_id
                                        AND category_id IN
                                            (SELECT id
                                             FROM sys_task_status_categories
                                             WHERE sys_task_status_categories.is_done IS FALSE))) AS overdue_count,
                 (SELECT SUM(total_minutes)
                  FROM tasks
                  WHERE project_id = _project_id
                    AND CASE
                            WHEN (_archived IS TRUE) THEN project_id IS NOT NULL
                            ELSE archived IS FALSE END) AS total_minutes_sum,
                 (SELECT SUM(time_spent)
                  FROM task_work_log
                           CROSS JOIN tasks t
                  WHERE task_id = t.id
                    AND CASE
                            WHEN (_archived IS TRUE) THEN project_id IS NOT NULL
                            ELSE archived IS FALSE END
                    AND t.project_id = _project_id) AS time_spent_sum) rec;
    RETURN _result;

END;
$$;


ALTER FUNCTION public.get_project_overview_data(_project_id uuid, _archived boolean) OWNER TO postgres;

--
-- Name: get_project_wise_resources(date, date, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_project_wise_resources(_start_date date, _end_date date, _team_id uuid) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
    _projects JSON;

BEGIN
    SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
    FROM (SELECT id,
                 name,
                 color_code,
                 FALSE AS collapsed,
                 (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                  FROM (SELECT date_series,
                               project_id,
                               SUM(total_minutes / 60),
                               JSON_AGG(JSON_BUILD_OBJECT('id', tasks_.id,
                                                          'name', tasks_.name
                                   )) AS scheduled_tasks
                        FROM GENERATE_SERIES(
                                 _start_date::DATE,
                                 _end_date::DATE,
                                 '1 day'
                                 ) AS date_series
                                 CROSS JOIN (SELECT id, name, project_id, total_minutes, start_date, end_date
                                             FROM tasks) AS tasks_
                        WHERE (date_series >= tasks_.start_date::DATE AND date_series <= tasks_.end_date::DATE)
                          AND tasks_.project_id = projects.id
                        GROUP BY date_series, project_id) rec) AS schedule,
                 (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                  FROM (SELECT team_member_id,
                               (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                                FROM (SELECT date_series,
                                             project_id,
                                             SUM(total_minutes / 60),
                                             JSON_AGG(JSON_BUILD_OBJECT('id', tasks_.id,
                                                                        'name', tasks_.name
                                                 )) AS scheduled_tasks
                                      FROM GENERATE_SERIES(
                                               _start_date::DATE,
                                               _end_date::DATE,
                                               '1 day'
                                               ) AS date_series
                                               CROSS JOIN (SELECT id, name, project_id, total_minutes, start_date, end_date
                                                           FROM tasks,
                                                                tasks_assignees
                                                           WHERE task_id = tasks.id
                                                             AND tasks_assignees.team_member_id = project_members.team_member_id) AS tasks_
                                      WHERE (date_series >= tasks_.start_date::DATE AND
                                             date_series <= tasks_.end_date::DATE)
                                        AND tasks_.project_id = projects.id
                                      GROUP BY date_series, project_id) rec) AS tasks,
                               (SELECT name
                                FROM users
                                WHERE users.id =
                                      (SELECT user_id
                                       FROM team_members
                                       WHERE team_members.id = project_members.team_member_id)),
                               (SELECT email
                                FROM email_invitations
                                WHERE project_members.team_member_id = email_invitations.team_member_id) AS invitee_email,
                               (SELECT avatar_url
                                FROM users
                                WHERE users.id =
                                      (SELECT user_id
                                       FROM team_members
                                       WHERE team_members.id = project_members.team_member_id))
                        FROM project_members
                        WHERE project_id = projects.id) rec) AS project_members,
                 (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                  FROM (SELECT date_series,
                               project_id,
                               SUM(total_minutes / 60),
                               JSON_AGG(JSON_BUILD_OBJECT('id', tasks_.id,
                                                          'name', tasks_.name
                                   )) AS scheduled_tasks
                        FROM GENERATE_SERIES(
                                 _start_date::DATE,
                                 _end_date,
                                 '1 day'
                                 ) AS date_series
                                 CROSS JOIN (SELECT id, name, project_id, total_minutes, start_date, end_date
                                             FROM tasks
                                             WHERE tasks.project_id = project_id
                                               AND tasks.id NOT IN (SELECT task_id FROM tasks_assignees)) AS tasks_
                        WHERE (date_series >= tasks_.start_date::DATE AND date_series <= tasks_.end_date::DATE)
                          AND tasks_.project_id = projects.id
                        GROUP BY date_series, project_id) rec) AS unassigned_tasks
          FROM projects
          WHERE team_id = _team_id
            AND id NOT IN (SELECT project_id FROM archived_projects WHERE project_id = projects.id)
          ORDER BY updated_at DESC) rec
    INTO _projects;

    RETURN _projects;
END;
$$;


ALTER FUNCTION public.get_project_wise_resources(_start_date date, _end_date date, _team_id uuid) OWNER TO postgres;

--
-- Name: get_reporting_member_current_doing_tasks(uuid, uuid, boolean, numeric, numeric); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_reporting_member_current_doing_tasks(_team_member_id uuid, _user_id uuid, _include_archived boolean, _limit numeric, _offset numeric) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _result JSON;

BEGIN
    SELECT ROW_TO_JSON(rec)
    INTO _result
    FROM (SELECT COUNT(*) AS total,
                 (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                  FROM ((SELECT t.id,
                                t.name AS task,
                                p.name AS project,
                                p.id AS project_id,
                                (SELECT name FROM teams WHERE id = p.team_id) AS team_name,
                                (SELECT name
                                 FROM task_statuses
                                 WHERE id = t.status_id) AS status,
                                (SELECT color_code
                                 FROM sys_task_status_categories
                                 WHERE id =
                                       (SELECT category_id FROM task_statuses WHERE id = t.status_id)) AS status_color,
                                t.end_date,
                                t.updated_at AS last_updated
                         FROM tasks t
                                  LEFT JOIN tasks_assignees ta ON t.id = ta.task_id
                                  LEFT JOIN projects p ON t.project_id = p.id
                         WHERE ta.team_member_id = _team_member_id
                           AND p.team_id IN (SELECT team_id
                                             FROM team_members
                                             WHERE user_id = _user_id
                                               AND role_id IN (SELECT id
                                                               FROM roles
                                                               WHERE (admin_role IS TRUE OR owner IS TRUE)))
                           AND CASE
                                   WHEN (_include_archived IS TRUE) THEN team_id IS NOT NULL
                                   ELSE NOT EXISTS(SELECT project_id
                                                   FROM archived_projects
                                                   WHERE project_id = p.id) END
                           AND t.status_id IN
                               (SELECT id
                                FROM task_statuses
                                WHERE category_id IN
                                      (SELECT id FROM sys_task_status_categories WHERE is_done IS FALSE))
                         ORDER BY end_date DESC
                         LIMIT _limit OFFSET _offset)) rec) AS data
          FROM tasks t
                   LEFT JOIN tasks_assignees ta ON t.id = ta.task_id
                   LEFT JOIN projects p ON t.project_id = p.id
          WHERE ta.team_member_id = _team_member_id
            AND p.team_id IN (SELECT team_id
                              FROM team_members
                              WHERE user_id = _user_id
                                AND role_id IN (SELECT id
                                                FROM roles
                                                WHERE (admin_role IS TRUE OR owner IS TRUE)))
            AND CASE
                    WHEN (_include_archived IS TRUE) THEN team_id IS NOT NULL
                    ELSE NOT EXISTS(SELECT project_id
                                    FROM archived_projects
                                    WHERE project_id = p.id) END
            AND t.status_id IN
                (SELECT id
                 FROM task_statuses
                 WHERE category_id IN
                       (SELECT id FROM sys_task_status_categories WHERE is_done IS FALSE))) rec;
    RETURN _result;
END;
$$;


ALTER FUNCTION public.get_reporting_member_current_doing_tasks(_team_member_id uuid, _user_id uuid, _include_archived boolean, _limit numeric, _offset numeric) OWNER TO postgres;

--
-- Name: get_reporting_member_overdue_tasks(uuid, uuid, boolean, numeric, numeric); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_reporting_member_overdue_tasks(_team_member_id uuid, _user_id uuid, _include_archived boolean, _limit numeric, _offset numeric) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _result JSON;

BEGIN
    SELECT ROW_TO_JSON(rec)
    INTO _result
    FROM (SELECT COUNT(*) AS total,
                 (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                  FROM ((SELECT t.id,
                                t.name AS task,
                                p.name AS project,
                                p.id AS project_id,
                                (SELECT name FROM teams WHERE id = p.team_id) AS team_name,
                                (SELECT name
                                 FROM task_statuses
                                 WHERE id = t.status_id) AS status,
                                (SELECT color_code
                                 FROM sys_task_status_categories
                                 WHERE id =
                                       (SELECT category_id FROM task_statuses WHERE id = t.status_id)) AS status_color,
                                t.end_date,
                                t.updated_at AS last_updated,
                                t.end_date AS due_date
                         FROM tasks t
                                  LEFT JOIN tasks_assignees ta ON t.id = ta.task_id
                                  LEFT JOIN projects p ON t.project_id = p.id
                         WHERE ta.team_member_id = _team_member_id
                           AND p.team_id IN (SELECT team_id
                                             FROM team_members
                                             WHERE user_id = _user_id
                                               AND role_id IN (SELECT id
                                                               FROM roles
                                                               WHERE (admin_role IS TRUE OR owner IS TRUE)))
                           AND CASE
                                   WHEN (_include_archived IS TRUE) THEN team_id IS NOT NULL
                                   ELSE NOT EXISTS(SELECT project_id
                                                   FROM archived_projects
                                                   WHERE project_id = p.id) END
                           AND t.status_id IN
                               (SELECT id
                                FROM task_statuses
                                WHERE category_id IN
                                      (SELECT id FROM sys_task_status_categories WHERE is_done IS FALSE))
                           AND t.end_date::DATE < NOW()::DATE
                         ORDER BY end_date DESC
                         LIMIT _limit OFFSET _offset)) rec) AS data
          FROM tasks t
                   LEFT JOIN tasks_assignees ta ON t.id = ta.task_id
                   LEFT JOIN projects p ON t.project_id = p.id
          WHERE ta.team_member_id = _team_member_id
            AND p.team_id IN (SELECT team_id
                              FROM team_members
                              WHERE user_id = _user_id
                                AND role_id IN (SELECT id
                                                FROM roles
                                                WHERE (admin_role IS TRUE OR owner IS TRUE)))
            AND CASE
                    WHEN (_include_archived IS TRUE) THEN team_id IS NOT NULL
                    ELSE NOT EXISTS(SELECT project_id
                                    FROM archived_projects
                                    WHERE project_id = p.id) END
            AND t.status_id IN
                (SELECT id
                 FROM task_statuses
                 WHERE category_id IN
                       (SELECT id FROM sys_task_status_categories WHERE is_done IS FALSE))
            AND t.end_date::DATE < NOW()::DATE) rec;
    RETURN _result;
END;
$$;


ALTER FUNCTION public.get_reporting_member_overdue_tasks(_team_member_id uuid, _user_id uuid, _include_archived boolean, _limit numeric, _offset numeric) OWNER TO postgres;

--
-- Name: get_reporting_member_recently_logged_tasks(uuid, uuid, boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_reporting_member_recently_logged_tasks(_team_member_id uuid, _user_id uuid, _include_archived boolean) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _result JSON;

BEGIN
    SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
    INTO _result
    FROM ((SELECT DISTINCT twl.task_id AS id,
                           t.name,
                           (SELECT SUM(twl.time_spent)) AS logged_time,
                           p.name AS project_name,
                           p.id AS project_id,
                           (SELECT name FROM teams WHERE id = p.team_id) AS team_name,
                           (SELECT name
                            FROM task_statuses
                            WHERE id = (SELECT status_id FROM tasks WHERE id = twl.task_id)) AS status,
                           (SELECT color_code
                            FROM sys_task_status_categories
                            WHERE id =
                                  (SELECT category_id FROM task_statuses WHERE id = t.status_id)) AS status_color,
                           t.end_date::DATE,
                           (SELECT MAX(created_at)
                            FROM task_work_log
                            WHERE task_work_log.task_id = twl.task_id) AS logged_timestamp
           FROM task_work_log twl
                    LEFT JOIN tasks t ON twl.task_id = t.id
                    LEFT JOIN projects p ON t.project_id = p.id
           WHERE user_id = (SELECT user_id FROM team_members WHERE id = _team_member_id)

             -- check if the team is a team that the user is either an admin or owner
             AND p.team_id IN
                 (SELECT team_id
                  FROM team_members
                  WHERE user_id = _user_id
                    AND role_id IN (SELECT id
                                    FROM roles
                                    WHERE (admin_role IS TRUE OR owner IS TRUE)))

             -- check if the include_archived flag is true or false
             AND CASE
                     WHEN (_include_archived IS TRUE) THEN team_id IS NOT NULL
                     ELSE NOT EXISTS(SELECT project_id
                                     FROM archived_projects
                                     WHERE project_id = p.id) END

           GROUP BY task_id, t.name, project_id, t.end_date, p.name, p.team_id, t.status_id, p.id
           ORDER BY (SELECT MAX(created_at) FROM task_work_log WHERE task_work_log.task_id = twl.task_id) DESC
           LIMIT 10)) rec;
    RETURN _result;

END;
$$;


ALTER FUNCTION public.get_reporting_member_recently_logged_tasks(_team_member_id uuid, _user_id uuid, _include_archived boolean) OWNER TO postgres;

--
-- Name: get_reporting_members_stats(uuid, boolean, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_reporting_members_stats(_team_member_id uuid, _include_archived boolean, _user_id uuid) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _result JSON;
    _teams  UUID[];

BEGIN
    -- SELECT the team_id to select into the _teams variable so the function doesn't have to run it multiple times
    SELECT ARRAY_AGG(team_id)
    INTO _teams
    FROM team_members
    WHERE user_id = _user_id
      AND role_id IN (SELECT id
                      FROM roles
                      WHERE (admin_role IS TRUE OR owner IS TRUE));
    /*
    ##### id IN (SELECT UNNEST(_teams)) #####

    the above piece of query is added to all the queries below to ensure that the statistics that are shown are related
    to the teams that the user is either an admin or owner of the team
    */

    SELECT COALESCE(ROW_TO_JSON(rec), '[]'::JSON)
    INTO _result
    FROM ((SELECT (SELECT name FROM team_member_info_view WHERE team_member_id = _team_member_id),

                  -- get total teams that the user is added to
                  (SELECT COUNT(*)
                   FROM teams
                   WHERE id IN (SELECT team_id
                                FROM team_members
                                WHERE team_members.user_id =
                                      (SELECT user_id
                                       FROM team_members
                                       WHERE id = _team_member_id))
                     AND id IN (SELECT UNNEST(_teams))) AS total_teams,

                  -- select total projects the user is added to
                  (SELECT COUNT(*)
                   FROM project_members
                            LEFT JOIN projects p ON project_members.project_id = p.id
                   WHERE team_member_id IN (SELECT id
                                            FROM team_members
                                            WHERE user_id =
                                                  (SELECT user_id FROM team_members WHERE id = _team_member_id))

                     -- check if the team is a team that the user is either an admin or owner
                     AND p.team_id IN (SELECT UNNEST(_teams))
                     AND p.team_id IN (SELECT team_id
                                       FROM projects
                                       WHERE id IN (SELECT project_id
                                                    FROM tasks
                                                    WHERE id IN (SELECT task_id
                                                                 FROM tasks_assignees
                                                                 WHERE tasks.id = tasks_assignees.task_id
                                                                   AND team_member_id IN
                                                                       (SELECT id
                                                                        FROM team_members
                                                                        WHERE user_id = (SELECT user_id
                                                                                         FROM team_members
                                                                                         WHERE id = _team_member_id)))))
                     AND CASE
                             WHEN (_include_archived IS TRUE) THEN project_members.project_id IS NOT NULL
                             ELSE NOT EXISTS(SELECT project_id
                                             FROM archived_projects
                                             WHERE project_id = project_members.project_id) END) AS project_members,

                  -- select the total number of seconds estimated for the tasks that the user is assigned to
                  (SELECT SUM(total_minutes * 60)
                   FROM tasks
                            LEFT JOIN projects p ON tasks.project_id = p.id
                   WHERE EXISTS(SELECT 1
                                FROM tasks_assignees
                                WHERE tasks.id = tasks_assignees.task_id
                                  AND team_member_id IN
                                      (SELECT id
                                       FROM team_members
                                       WHERE user_id = _user_id))

                     -- check if the team is a team that the user is either an admin or owner
                     AND p.team_id IN (SELECT UNNEST(_teams))
                     AND CASE
                             WHEN (_include_archived IS TRUE) THEN tasks.project_id IS NOT NULL
                             ELSE NOT EXISTS(SELECT project_id
                                             FROM archived_projects
                                             WHERE project_id = tasks.project_id) END) AS total_estimated,

                  -- select the total logged time for the tasks that the user is assigned to
                  (SELECT SUM(time_spent)
                   FROM tasks
                            LEFT JOIN task_work_log twl ON tasks.id = twl.task_id
                            LEFT JOIN projects p ON tasks.project_id = p.id
                   WHERE EXISTS(SELECT 1
                                FROM tasks_assignees
                                WHERE tasks.id = tasks_assignees.task_id
                                  AND team_member_id IN
                                      (SELECT id
                                       FROM team_members
                                       WHERE user_id = _user_id))

                     -- check if the team is a team that the user is either an admin or owner
                     AND p.team_id IN (SELECT UNNEST(_teams))

                     AND CASE
                             WHEN (_include_archived IS TRUE) THEN tasks.project_id IS NOT NULL
                             ELSE NOT EXISTS(SELECT project_id
                                             FROM archived_projects
                                             WHERE project_id = tasks.project_id) END) AS total_logged,

                  -- select the total tasks that the user is assigned to
                  (SELECT COUNT(*)
                   FROM tasks
                            LEFT JOIN projects p ON tasks.project_id = p.id
                   WHERE EXISTS(SELECT 1
                                FROM tasks_assignees
                                WHERE tasks.id = tasks_assignees.task_id
                                  AND team_member_id IN
                                      (SELECT id
                                       FROM team_members
                                       WHERE user_id = _user_id))

                     -- check if the team is a team that the user is either an admin or owner
                     AND p.team_id IN (SELECT UNNEST(_teams))

                     AND CASE
                             WHEN (_include_archived IS TRUE) THEN tasks.project_id IS NOT NULL
                             ELSE NOT EXISTS(SELECT project_id
                                             FROM archived_projects
                                             WHERE project_id = tasks.project_id) END) AS total_tasks,

                  -- select the total tasks that the user has completed
                  (SELECT COUNT(*)
                   FROM tasks
                            LEFT JOIN projects p ON tasks.project_id = p.id

                   WHERE EXISTS(SELECT 1
                                FROM tasks_assignees
                                WHERE tasks.id = tasks_assignees.task_id
                                  AND team_member_id IN
                                      (SELECT id
                                       FROM team_members
                                       WHERE user_id = _user_id))

                     -- check if the team is a team that the user is either an admin or owner
                     AND p.team_id IN (SELECT UNNEST(_teams))

                     AND tasks.status_id IN
                         (SELECT id
                          FROM task_statuses
                          WHERE category_id IN
                                (SELECT id FROM sys_task_status_categories WHERE is_done IS TRUE))
                     AND CASE
                             WHEN (_include_archived IS TRUE) THEN tasks.project_id IS NOT NULL
                             ELSE NOT EXISTS(SELECT project_id
                                             FROM archived_projects
                                             WHERE project_id = tasks.project_id) END) AS total_tasks_completed,

                  -- select the total tasks that are overdue
                  (SELECT COUNT(*)
                   FROM tasks
                            LEFT JOIN projects p ON tasks.project_id = p.id

                   WHERE EXISTS(SELECT 1
                                FROM tasks_assignees
                                WHERE tasks.id = tasks_assignees.task_id
                                  AND team_member_id IN
                                      (SELECT id
                                       FROM team_members
                                       WHERE user_id = _user_id))

                     -- check if the team is a team that the user is either an admin or owner
                     AND p.team_id IN (SELECT UNNEST(_teams))

                     AND tasks.end_date::DATE < NOW()::DATE
                     AND tasks.status_id IN
                         (SELECT id
                          FROM task_statuses
                          WHERE category_id IN
                                (SELECT id FROM sys_task_status_categories WHERE is_done IS FALSE))
                     AND CASE
                             WHEN (_include_archived IS TRUE) THEN tasks.project_id IS NOT NULL
                             ELSE NOT EXISTS(SELECT project_id
                                             FROM archived_projects
                                             WHERE project_id = tasks.project_id) END) AS overdue_tasks)) rec;
    RETURN _result;

END;
$$;


ALTER FUNCTION public.get_reporting_members_stats(_team_member_id uuid, _include_archived boolean, _user_id uuid) OWNER TO postgres;

--
-- Name: get_reporting_overview_stats(uuid, boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_reporting_overview_stats(_user_id uuid, _include_archived boolean) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _result JSON;

BEGIN
    SELECT COALESCE(ROW_TO_JSON(rec), '[]'::JSON)
    INTO _result
    FROM ((SELECT (SELECT COUNT(*)
                   FROM team_members
                   WHERE user_id = _user_id
                     AND role_id IN (SELECT id
                                     FROM roles
                                     WHERE (admin_role IS TRUE OR owner IS TRUE))) AS total_teams,
                  (SELECT COUNT(*)
                   FROM projects
                   WHERE team_id IN
                         (SELECT team_id
                          FROM team_members
                          WHERE user_id = _user_id
                            AND role_id IN (SELECT id
                                            FROM roles
                                            WHERE (admin_role IS TRUE OR owner IS TRUE)))
                     AND CASE
                             WHEN (_include_archived IS TRUE) THEN team_id IS NOT NULL
                             ELSE NOT EXISTS(SELECT project_id
                                             FROM archived_projects
                                             WHERE project_id = projects.id) END) AS total_projects,
                  (SELECT COUNT(*)
                   FROM projects
                   WHERE team_id IN
                         (SELECT team_id
                          FROM team_members
                          WHERE user_id = _user_id
                            AND role_id IN (SELECT id
                                            FROM roles
                                            WHERE (admin_role IS TRUE OR owner IS TRUE)))
                     AND CASE
                             WHEN (_include_archived IS TRUE) THEN team_id IS NOT NULL
                             ELSE NOT EXISTS(SELECT project_id
                                             FROM archived_projects
                                             WHERE project_id = projects.id) END
                     AND status_id IN (SELECT ID
                                       FROM sys_project_statuses
                                       WHERE sys_project_statuses.name NOT IN ('Completed', 'Cancelled'))) AS active_projects,
                  (SELECT COUNT(*)
                   FROM (SELECT DISTINCT user_id
                         FROM team_members tm
                                  LEFT JOIN email_invitations ei ON tm.id = ei.team_member_id
                         WHERE tm.team_id IN (SELECT team_id
                                              FROM team_members
                                              WHERE user_id = _user_id
                                                AND role_id IN (SELECT id
                                                                FROM roles
                                                                WHERE (admin_role IS TRUE OR owner IS TRUE)))) AS members) AS total_members,
                  (SELECT COUNT(*)
                   FROM (SELECT DISTINCT user_id
                         FROM team_members tm
                                  LEFT JOIN email_invitations ei ON tm.id = ei.team_member_id
                         WHERE tm.team_id IN (SELECT team_id
                                              FROM team_members
                                              WHERE user_id = _user_id
                                                AND role_id IN (SELECT id
                                                                FROM roles
                                                                WHERE (admin_role IS TRUE OR owner IS TRUE)))
                           AND team_member_id NOT IN
                               (SELECT team_member_id
                                FROM project_members pm
                                WHERE pm.project_id IN
                                      (SELECT id FROM projects WHERE projects.team_id = tm.team_id))) AS members) AS unassigned_members,
                  (SELECT COUNT(*)
                   FROM (SELECT DISTINCT user_id
                         FROM team_members tm
                                  LEFT JOIN email_invitations ei ON tm.id = ei.team_member_id
                         WHERE tm.team_id IN (SELECT team_id
                                              FROM team_members
                                              WHERE user_id = _user_id
                                                AND role_id IN (SELECT id
                                                                FROM roles
                                                                WHERE (admin_role IS TRUE OR owner IS TRUE)))
                           AND tm.id IN (SELECT ta.team_member_id
                                         FROM tasks_assignees ta
                                                  LEFT JOIN tasks t
                                                            ON t.id = ta.task_id AND t.end_date::DATE < NOW()::DATE AND
                                                               t.status_id IN
                                                               (SELECT id
                                                                FROM task_statuses
                                                                WHERE category_id NOT IN
                                                                      (SELECT id FROM sys_task_status_categories WHERE is_done IS FALSE)))) AS members) AS overdue_task_members,
                  (SELECT COUNT(*)
                   FROM projects
                   WHERE team_id IN
                         (SELECT team_id
                          FROM team_members
                          WHERE user_id = _user_id
                            AND role_id IN (SELECT id
                                            FROM roles
                                            WHERE (admin_role IS TRUE OR owner IS TRUE)))
                     AND end_date::DATE < NOW()::DATE
                     AND CASE
                             WHEN (_include_archived IS TRUE) THEN team_id IS NOT NULL
                             ELSE NOT EXISTS(SELECT project_id
                                             FROM archived_projects
                                             WHERE project_id = projects.id) END) AS overdue_projects)) rec;
    RETURN _result;

END;
$$;


ALTER FUNCTION public.get_reporting_overview_stats(_user_id uuid, _include_archived boolean) OWNER TO postgres;

--
-- Name: get_reporting_projects_stats(uuid, boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_reporting_projects_stats(_user_id uuid, _include_archived boolean) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _result JSON;
    _teams  UUID[];

BEGIN
    -- SELECT the team_id to select into the _teams variable so the function doesn't have to run it multiple times
    SELECT ARRAY_AGG(team_id)
    INTO _teams
    FROM team_members
    WHERE user_id = _user_id
      AND role_id IN (SELECT id
                      FROM roles
                      WHERE (admin_role IS TRUE OR owner IS TRUE));

    SELECT COALESCE(ROW_TO_JSON(rec), '[]'::JSON)
    INTO _result
    FROM ((SELECT (SELECT COUNT(*)
                   FROM projects
                   WHERE team_id IN (SELECT UNNEST(_teams))
                     AND CASE
                             WHEN (_include_archived IS TRUE) THEN team_id IS NOT NULL
                             ELSE NOT EXISTS(SELECT project_id
                                             FROM archived_projects
                                             WHERE project_id = projects.id) END
                     AND status_id IN (SELECT ID
                                       FROM sys_project_statuses
                                       WHERE sys_project_statuses.name NOT IN ('Completed', 'Cancelled'))) AS active_projects,
                  (SELECT COUNT(*)
                   FROM projects
                   WHERE team_id IN (SELECT UNNEST(_teams))
                     AND end_date::DATE < NOW()::DATE
                     AND CASE
                             WHEN (_include_archived IS TRUE) THEN team_id IS NOT NULL
                             ELSE NOT EXISTS(SELECT project_id
                                             FROM archived_projects
                                             WHERE project_id = projects.id) END) AS overdue_projects,
                  (SELECT SUM(time_spent)
                   FROM task_work_log
                   WHERE task_id IN (SELECT id
                                     FROM tasks
                                     WHERE project_id IN (SELECT id
                                                          FROM projects
                                                          WHERE team_id IN (SELECT UNNEST(_teams))
                                                            AND CASE
                                                                    WHEN (_include_archived IS TRUE)
                                                                        THEN team_id IS NOT NULL
                                                                    ELSE NOT EXISTS(SELECT project_id
                                                                                    FROM archived_projects
                                                                                    WHERE project_id = projects.id
                                                                                      AND user_id = _user_id) END)))::INT AS total_logged,
                  (SELECT SUM(total_minutes * 60)
                   FROM tasks
                   WHERE project_id IN (SELECT id
                                        FROM projects
                                        WHERE team_id IN (SELECT UNNEST(_teams))
                                          AND CASE
                                                  WHEN (TRUE IS TRUE) THEN team_id IS NOT NULL
                                                  ELSE NOT EXISTS(SELECT project_id
                                                                  FROM archived_projects
                                                                  WHERE project_id = projects.id
                                                                    AND user_id = _user_id) END))::INT AS total_estimated,
                  (SELECT COUNT(*)
                   FROM tasks
                   WHERE archived IS FALSE
                     AND project_id IN (SELECT id
                                        FROM projects
                                        WHERE team_id IN (SELECT UNNEST(_teams))
                                          AND CASE
                                                  WHEN (TRUE IS TRUE) THEN team_id IS NOT NULL
                                                  ELSE NOT EXISTS(SELECT project_id
                                                                  FROM archived_projects
                                                                  WHERE project_id = projects.id
                                                                    AND user_id = _user_id) END))::INT AS all_tasks_count,
                  (SELECT COUNT(*)
                   FROM tasks
                   WHERE archived IS FALSE
                     AND project_id IN (SELECT id
                                        FROM projects
                                        WHERE team_id IN (SELECT UNNEST(_teams))
                                          AND CASE
                                                  WHEN (TRUE IS TRUE) THEN team_id IS NOT NULL
                                                  ELSE NOT EXISTS(SELECT project_id
                                                                  FROM archived_projects
                                                                  WHERE project_id = projects.id
                                                                    AND user_id = _user_id) END)
                     AND status_id IN (SELECT id
                                       FROM task_statuses
                                       WHERE project_id = tasks.project_id
                                         AND category_id IN
                                             (SELECT id FROM sys_task_status_categories WHERE is_done IS TRUE)))::INT AS completed_tasks_count)) rec;
    RETURN _result;

END;
$$;


ALTER FUNCTION public.get_reporting_projects_stats(_user_id uuid, _include_archived boolean) OWNER TO postgres;

--
-- Name: get_resource_gantt_tasks(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_resource_gantt_tasks(_user_id uuid) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _tasks   JSON;
    _team_id UUID;
BEGIN

    SELECT active_team FROM users WHERE id = _user_id::UUID INTO _team_id;

    SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
    INTO _tasks
    FROM (SELECT projects.id,
                 projects.name,
                 0 AS level,
                 FALSE AS collapsed,
                 (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                  FROM (SELECT pm.id,
                               pm.team_member_id,
                               pm.project_access_level_id,
                               FALSE AS overdue,
                               (SELECT name
                                FROM job_titles
                                WHERE job_titles.id = tm.job_title_id) AS job_title,
                               (SELECT name
                                FROM team_member_info_view
                                WHERE team_member_info_view.team_member_id = tm.id),
                               u.avatar_url,
                               (SELECT name
                                FROM project_access_levels
                                WHERE project_access_levels.id = pm.project_access_level_id) AS access_level,
                               (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                                FROM (SELECT t.id,
                                             t.id AS task_id,
                                             t.name,
                                             t.start_date AS start,
                                             t.project_id,
                                             t.priority_id,
                                             t.done,
                                             t.end_date AS "end",
                                             0 AS progress,
                                             2 AS level,
                                             TRUE AS "showOnGraph",
                                             t.status_id,
                                             (SELECT name FROM task_statuses WHERE id = t.status_id) AS status,
                                             (SELECT color_code
                                              FROM projects
                                              WHERE projects.id = t.project_id) AS color_code,
                                             (SELECT ARRAY_AGG(ROW_TO_JSON(rec))
                                              FROM (SELECT project_member_id AS id,
                                                           (SELECT name
                                                            FROM team_member_info_view
                                                            WHERE team_member_info_view.team_member_id = tm.id)
                                                    FROM tasks_assignees
                                                             INNER JOIN project_members pm ON pm.id = tasks_assignees.project_member_id
                                                             INNER JOIN team_members tm2 ON pm.team_member_id = tm2.id
                                                             LEFT JOIN users u2 ON tm2.user_id = u2.id
                                                    WHERE project_id = t.project_id
                                                      AND project_member_id = pm.id
                                                      AND t.id = tasks_assignees.task_id
                                                    ORDER BY name) rec) AS assignees
                                      FROM tasks_assignees ta,
                                           tasks t
                                      WHERE t.archived IS FALSE
                                        AND ta.project_member_id = pm.id
                                        AND t.id = ta.task_id
                                      ORDER BY start_date) rec) AS tasks
                        FROM project_members pm
                                 INNER JOIN team_members tm ON pm.team_member_id = tm.id
                                 LEFT JOIN users u ON tm.user_id = u.id
                        WHERE project_id = projects.id) rec) AS team_members
          FROM projects
          WHERE team_id = _team_id
            AND (CASE
                     WHEN (is_owner(_user_id, _team_id) OR is_admin(_user_id, _team_id)) THEN TRUE
                     ELSE is_member_of_project(projects.id, _user_id, _team_id) END)
          ORDER BY NAME) rec;

    RETURN _tasks;
END;
$$;


ALTER FUNCTION public.get_resource_gantt_tasks(_user_id uuid) OWNER TO postgres;

--
-- Name: get_selected_tasks(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_selected_tasks(_id uuid) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _tasks JSON;
BEGIN
    SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
    INTO _tasks
    FROM (SELECT t.id,
                 t.name,
                 t.start_date AS start,
                 t.end_date AS "end",
                 t.project_id,
                 (SELECT name FROM task_priorities WHERE task_priorities.id = t.priority_id) AS priority,
                 t.priority_id,
                 t.done,
                 t.created_at,
                 t.status_id,
                 (SELECT ARRAY_AGG(ROW_TO_JSON(rec))
                  FROM (SELECT project_member_id AS id,
                               u2.name AS name,
                               (SELECT avatar_url FROM users WHERE id = tm2.user_id),
                               COALESCE((u2.email), (SELECT email
                                                     FROM email_invitations
                                                     WHERE email_invitations.team_member_id = tm2.id)) AS email
                        FROM tasks_assignees
                                 INNER JOIN project_members pm ON pm.id = tasks_assignees.project_member_id
                                 INNER JOIN team_members tm2 ON pm.team_member_id = tm2.id
                                 LEFT JOIN users u2 ON tm2.user_id = u2.id
                        WHERE project_id = _id::UUID
                          AND project_member_id = pm.id
                          AND t.id = tasks_assignees.task_id
                        ORDER BY name) rec) AS assignees
          FROM tasks t
          WHERE archived IS FALSE
            AND project_id = _id::UUID
            AND (t.start_date IS NOT NULL
              OR t.end_date IS NOT NULL
              OR t.id IN (SELECT task_id FROM tasks_assignees))) rec;

    RETURN _tasks;
END;
$$;


ALTER FUNCTION public.get_selected_tasks(_id uuid) OWNER TO postgres;

--
-- Name: get_single_pt_task(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_single_pt_task(_id uuid) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _result JSON;
BEGIN
    SELECT ROW_TO_JSON(rec)
    INTO _result
    FROM (SELECT id,
                 name,
                 cpt_tasks.template_id AS template_id,
                 cpt_tasks.parent_task_id,
                 cpt_tasks.parent_task_id IS NOT NULL AS is_sub_task,
                 (SELECT name FROM cpt_tasks WHERE id = cpt_tasks.parent_task_id) AS parent_task_name,
                 (SELECT COUNT('*')
                  FROM cpt_tasks
                  WHERE parent_task_id = cpt_tasks.id) AS sub_tasks_count,
                 cpt_tasks.status_id AS status,
                 (SELECT name FROM cpt_task_statuses WHERE id = cpt_tasks.status_id) AS status_name,
                 (SELECT color_code
                  FROM sys_task_status_categories
                  WHERE id = (SELECT category_id FROM cpt_task_statuses  WHERE id = cpt_tasks.status_id)) AS status_color,
                 (SELECT COALESCE(ROW_TO_JSON(r), '{}'::JSON)
                 FROM (SELECT is_done, is_doing, is_todo
                    FROM sys_task_status_categories
                    WHERE id = (SELECT category_id FROM cpt_task_statuses WHERE id = cpt_tasks.status_id)) r) AS status_category,
                 (SELECT name
                  FROM cpt_phases
                  WHERE id = (SELECT phase_id FROM cpt_task_phases WHERE task_id = cpt_tasks.id)) AS phase_name,
                 (SELECT phase_id FROM cpt_task_phases WHERE task_id = cpt_tasks.id) AS phase_id,
                 (SELECT ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(r)))
                  FROM (SELECT cpt_task_labels.label_id AS id,
                               (SELECT name FROM team_labels WHERE id = cpt_task_labels.label_id) AS name,
                               (SELECT color_code FROM team_labels WHERE id = cpt_task_labels.label_id)
                        FROM cpt_task_labels
                        WHERE task_id = cpt_tasks.id
                        ORDER BY name) r) AS labels,
                 (SELECT id FROM task_priorities WHERE id = cpt_tasks.priority_id) AS priority,
                 (SELECT name FROM task_priorities WHERE id = cpt_tasks.priority_id) AS priority_name,
                 (SELECT value FROM task_priorities WHERE id = cpt_tasks.priority_id) AS priority_value,
                 total_minutes,
                 sort_order,
                 (SELECT ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(r)))
                  FROM (SELECT cpt_task_statuses.id AS id,
                               cpt_task_statuses.name AS name,
                               (SELECT color_code
                                FROM sys_task_status_categories
                                WHERE id = cpt_task_statuses.category_id)
                        FROM cpt_task_statuses
                        WHERE cpt_task_statuses.template_id = cpt_tasks.template_id) r) AS template_statuses
          FROM cpt_tasks
          WHERE id = _id) rec;
    RETURN _result;
END
$$;


ALTER FUNCTION public.get_single_pt_task(_id uuid) OWNER TO postgres;

--
-- Name: get_single_task(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_single_task(_id uuid) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _result JSON;
BEGIN

    SELECT ROW_TO_JSON(rec)
    INTO _result
    FROM (SELECT id,
                 name,
                 (SELECT name FROM projects WHERE project_id = projects.id) AS project_name,
                 CONCAT((SELECT key FROM projects WHERE id = project_id), '-', task_no) AS task_key,
                 tasks.project_id AS project_id,
                 tasks.parent_task_id,
                 tasks.parent_task_id IS NOT NULL AS is_sub_task,
                 (SELECT name FROM tasks WHERE id = tasks.parent_task_id) AS parent_task_name,
                 (SELECT COUNT('*')
                  FROM tasks
                  WHERE parent_task_id = tasks.id
                    AND archived IS FALSE) AS sub_tasks_count,

                 tasks.status_id AS status,
                 tasks.archived,

                 (SELECT name FROM task_statuses WHERE id = tasks.status_id) AS status_name,
                 (SELECT name FROM task_priorities WHERE id = tasks.priority_id) AS priority_name,

                 (SELECT color_code
                  FROM sys_task_status_categories
                  WHERE id = (SELECT category_id FROM task_statuses WHERE id = tasks.status_id)) AS status_color,

                 (SELECT color_code_dark
                  FROM sys_task_status_categories
                  WHERE id = (SELECT category_id FROM task_statuses WHERE id = tasks.status_id)) AS status_color_dark,

                 (SELECT get_task_assignees(tasks.id)) AS assignees,

                 (SELECT name
                  FROM project_phases
                  WHERE id = (SELECT phase_id FROM task_phase WHERE task_id = tasks.id)) AS phase_name,
                 (SELECT color_code
                  FROM project_phases
                  WHERE id = (SELECT phase_id FROM task_phase WHERE task_id = tasks.id)) AS phase_color_code,
                 (SELECT phase_id FROM task_phase WHERE task_id = tasks.id) AS phase_id,

                 (SELECT COALESCE(ROW_TO_JSON(r), '{}'::JSON)
                  FROM (SELECT is_done, is_doing, is_todo
                        FROM sys_task_status_categories
                        WHERE id = (SELECT category_id FROM task_statuses WHERE id = tasks.status_id)) r) AS status_category,

                 (SELECT ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(r)))
                  FROM (SELECT task_labels.label_id AS id,
                               (SELECT name FROM team_labels WHERE id = task_labels.label_id) AS name,
                               (SELECT color_code FROM team_labels WHERE id = task_labels.label_id)
                        FROM task_labels
                        WHERE task_id = tasks.id
                        ORDER BY name) r) AS labels,

                 (SELECT name FROM users WHERE id = reporter_id) AS reporter,
                 (SELECT id FROM task_priorities WHERE id = tasks.priority_id) AS priority,
                 (SELECT value FROM task_priorities WHERE id = tasks.priority_id) AS priority_value,
                 total_minutes,
                 (SELECT SUM(time_spent) FROM task_work_log WHERE task_id = tasks.id) AS total_minutes_spent,
                 start_date,
                 end_date,
                 sort_order,
                 (SELECT color_code FROM projects WHERE projects.id = tasks.project_id) AS project_color,
                 (SELECT ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(r)))
                  FROM (SELECT task_statuses.id AS id,
                               task_statuses.name AS name,
                               (SELECT color_code
                                FROM sys_task_status_categories
                                WHERE id = task_statuses.category_id)
                        FROM task_statuses
                        WHERE task_statuses.project_id = tasks.project_id) r) AS project_statuses
          FROM tasks
          WHERE id = _id) rec;

    RETURN _result;
END
$$;


ALTER FUNCTION public.get_single_task(_id uuid) OWNER TO postgres;

--
-- Name: get_sort_column_name(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_sort_column_name(_group_by text) RETURNS text
    LANGUAGE plpgsql
    AS $$
BEGIN
    CASE _group_by
        WHEN 'status' THEN RETURN 'status_sort_order';
        WHEN 'priority' THEN RETURN 'priority_sort_order';
        WHEN 'phase' THEN RETURN 'phase_sort_order';
        -- For backward compatibility, still support general sort_order but be explicit
        WHEN 'general' THEN RETURN 'sort_order';
        ELSE RETURN 'status_sort_order'; -- Default to status sorting
    END CASE;
END;
$$;


ALTER FUNCTION public.get_sort_column_name(_group_by text) OWNER TO postgres;

--
-- Name: get_task_assignees(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_task_assignees(_task_id uuid) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _output JSON;
BEGIN
    SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
    FROM (SELECT team_member_id,
                 project_member_id,
                 COALESCE((SELECT name FROM team_member_info_view WHERE team_member_info_view.team_member_id = tm.id), '') as name,
                 COALESCE((SELECT email_notifications_enabled
                  FROM notification_settings
                  WHERE team_id = tm.team_id
                    AND notification_settings.user_id = u.id), false) AS email_notifications_enabled,
                 COALESCE(u.avatar_url, '') as avatar_url,
                 u.id AS user_id,
                 COALESCE(u.email, '') as email,
                 COALESCE(u.socket_id, '') as socket_id,
                 tm.team_id AS team_id
          FROM tasks_assignees
                   INNER JOIN team_members tm ON tm.id = tasks_assignees.team_member_id
                   LEFT JOIN users u ON tm.user_id = u.id
          WHERE task_id = _task_id) rec
    INTO _output;

    RETURN _output;
END;
$$;


ALTER FUNCTION public.get_task_assignees(_task_id uuid) OWNER TO postgres;

--
-- Name: get_task_complete_info(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_task_complete_info(_task_id uuid, _status_id uuid) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _color_code      TEXT;
    _color_code_dark TEXT;
    _members         JSON;
BEGIN
    SELECT color_code
    FROM sys_task_status_categories
    WHERE id = (SELECT category_id FROM task_statuses WHERE id = _status_id)
    INTO _color_code;

    SELECT color_code_dark
    FROM sys_task_status_categories
    WHERE id = (SELECT category_id FROM task_statuses WHERE id = _status_id)
    INTO _color_code_dark;

    SELECT get_task_assignees(_task_id) INTO _members;

    RETURN JSON_BUILD_OBJECT(
            'color_code', _color_code,
            'color_code_dark', _color_code_dark,
            'members', _members
           );
END;
$$;


ALTER FUNCTION public.get_task_complete_info(_task_id uuid, _status_id uuid) OWNER TO postgres;

--
-- Name: get_task_complete_ratio(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_task_complete_ratio(_task_id uuid) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _parent_task_done      FLOAT       = 0;
    _sub_tasks_done        FLOAT       = 0;
    _sub_tasks_count       FLOAT       = 0;
    _total_completed       FLOAT       = 0;
    _total_tasks           FLOAT       = 0;
    _ratio                 FLOAT       = 0;
    _is_manual             BOOLEAN     = FALSE;
    _manual_value          INTEGER     = NULL;
    _project_id            UUID;
    _use_manual_progress   BOOLEAN     = FALSE;
    _use_weighted_progress BOOLEAN     = FALSE;
    _use_time_progress     BOOLEAN     = FALSE;
    _task_complete         BOOLEAN     = FALSE;
    _progress_mode         VARCHAR(20) = NULL;
BEGIN
    -- Check if manual progress is set for this task
    SELECT manual_progress,
           progress_value,
           project_id,
           progress_mode,
           EXISTS(SELECT 1
                  FROM tasks_with_status_view
                  WHERE tasks_with_status_view.task_id = tasks.id
                    AND is_done IS TRUE) AS is_complete
    FROM tasks
    WHERE id = _task_id
    INTO _is_manual, _manual_value, _project_id, _progress_mode, _task_complete;

    -- Check if the project uses manual progress
    IF _project_id IS NOT NULL
    THEN
        SELECT COALESCE(use_manual_progress, FALSE),
               COALESCE(use_weighted_progress, FALSE),
               COALESCE(use_time_progress, FALSE)
        FROM projects
        WHERE id = _project_id
        INTO _use_manual_progress, _use_weighted_progress, _use_time_progress;
    END IF;

    -- Get all subtasks
    SELECT COUNT(*)
    FROM tasks
    WHERE parent_task_id = _task_id
      AND archived IS FALSE
    INTO _sub_tasks_count;

    -- If task is complete, always return 100%
    IF _task_complete IS TRUE
    THEN
        RETURN JSON_BUILD_OBJECT(
                'ratio', 100,
                'total_completed', 1,
                'total_tasks', 1,
                'is_manual', FALSE
               );
    END IF;

    -- Determine current active mode
    DECLARE
        _current_mode VARCHAR(20) = CASE
                                        WHEN _use_manual_progress IS TRUE THEN 'manual'
                                        WHEN _use_weighted_progress IS TRUE THEN 'weighted'
                                        WHEN _use_time_progress IS TRUE THEN 'time'
                                        ELSE 'default'
            END;
    BEGIN
        -- Only use manual progress value if it was set in the current active mode
        -- or if the task is explicitly marked for manual progress
        IF (_is_manual IS TRUE AND _manual_value IS NOT NULL AND
            (_progress_mode IS NULL OR _progress_mode = _current_mode)) OR
           (_use_manual_progress IS TRUE AND _manual_value IS NOT NULL AND
            (_progress_mode IS NULL OR _progress_mode = 'manual'))
        THEN
            RETURN JSON_BUILD_OBJECT(
                    'ratio', _manual_value,
                    'total_completed', 0,
                    'total_tasks', 0,
                    'is_manual', TRUE
                   );
        END IF;
    END;

    -- If there are no subtasks, just use the parent task's status (unless in time-based mode)
    IF _sub_tasks_count = 0
    THEN
        -- Use time-based estimation for tasks without subtasks if enabled
        IF _use_time_progress IS TRUE
        THEN
            -- For time-based tasks without subtasks, we still need some progress calculation
            -- If the task is completed, return 100%
            -- Otherwise, use the progress value if set manually in the correct mode, or 0
            SELECT CASE
                       WHEN _task_complete IS TRUE THEN 100
                       WHEN _manual_value IS NOT NULL AND (_progress_mode = 'time' OR _progress_mode IS NULL)
                           THEN _manual_value
                       ELSE 0
                       END
            INTO _ratio;
        ELSE
            -- Traditional calculation for non-time-based tasks
            SELECT (CASE WHEN _task_complete IS TRUE THEN 1 ELSE 0 END)
            INTO _parent_task_done;

            _ratio = _parent_task_done * 100;
        END IF;
    ELSE
        -- If project uses manual progress, calculate based on subtask manual progress values
        IF _use_manual_progress IS TRUE
        THEN
            WITH subtask_progress AS (SELECT t.id,
                                             t.manual_progress,
                                             t.progress_value,
                                             t.progress_mode,
                                             EXISTS(SELECT 1
                                                    FROM tasks_with_status_view
                                                    WHERE tasks_with_status_view.task_id = t.id
                                                      AND is_done IS TRUE) AS is_complete
                                      FROM tasks t
                                      WHERE t.parent_task_id = _task_id
                                        AND t.archived IS FALSE),
                 subtask_with_values AS (SELECT CASE
                                                    -- For completed tasks, always use 100%
                                                    WHEN is_complete IS TRUE THEN 100
                                                    -- For tasks with progress value set in the correct mode, use it
                                                    WHEN progress_value IS NOT NULL AND
                                                         (progress_mode = 'manual' OR progress_mode IS NULL)
                                                        THEN progress_value
                                                    -- Default to 0 for incomplete tasks with no progress value or wrong mode
                                                    ELSE 0
                                                    END AS progress_value
                                         FROM subtask_progress)
            SELECT COALESCE(AVG(progress_value), 0)
            FROM subtask_with_values
            INTO _ratio;
            -- If project uses weighted progress, calculate based on subtask weights
        ELSIF _use_weighted_progress IS TRUE
        THEN
            WITH subtask_progress AS (SELECT t.id,
                                             t.manual_progress,
                                             t.progress_value,
                                             t.progress_mode,
                                             EXISTS(SELECT 1
                                                    FROM tasks_with_status_view
                                                    WHERE tasks_with_status_view.task_id = t.id
                                                      AND is_done IS TRUE) AS is_complete,
                                             COALESCE(t.weight, 100) AS weight
                                      FROM tasks t
                                      WHERE t.parent_task_id = _task_id
                                        AND t.archived IS FALSE),
                 subtask_with_values AS (SELECT CASE
                                                    -- For completed tasks, always use 100%
                                                    WHEN is_complete IS TRUE THEN 100
                                                    -- For tasks with progress value set in the correct mode, use it
                                                    WHEN progress_value IS NOT NULL AND
                                                         (progress_mode = 'weighted' OR progress_mode IS NULL)
                                                        THEN progress_value
                                                    -- Default to 0 for incomplete tasks with no progress value or wrong mode
                                                    ELSE 0
                                                    END AS progress_value,
                                                weight
                                         FROM subtask_progress)
            SELECT COALESCE(
                           SUM(progress_value * weight) / NULLIF(SUM(weight), 0),
                           0
                   )
            FROM subtask_with_values
            INTO _ratio;
            -- If project uses time-based progress, calculate based on actual logged time
        ELSIF _use_time_progress IS TRUE
        THEN
            WITH task_time_info AS (
                SELECT 
                    t.id,
                    COALESCE(t.total_minutes, 0) as estimated_minutes,
                    COALESCE((
                        SELECT SUM(time_spent)
                        FROM task_work_log
                        WHERE task_id = t.id
                    ), 0) as logged_minutes,
                    EXISTS(
                        SELECT 1
                        FROM tasks_with_status_view
                        WHERE tasks_with_status_view.task_id = t.id
                        AND is_done IS TRUE
                    ) AS is_complete
                FROM tasks t
                WHERE t.parent_task_id = _task_id
                AND t.archived IS FALSE
            )
            SELECT COALESCE(
                SUM(
                    CASE 
                        WHEN is_complete IS TRUE THEN estimated_minutes
                        ELSE LEAST(logged_minutes, estimated_minutes)
                    END
                ) / NULLIF(SUM(estimated_minutes), 0) * 100,
                0
            )
            FROM task_time_info
            INTO _ratio;
        ELSE
            -- Traditional calculation based on completion status
            SELECT (CASE WHEN _task_complete IS TRUE THEN 1 ELSE 0 END)
            INTO _parent_task_done;

            SELECT COUNT(*)
            FROM tasks_with_status_view
            WHERE parent_task_id = _task_id
              AND is_done IS TRUE
            INTO _sub_tasks_done;

            _total_completed = _parent_task_done + _sub_tasks_done;
            _total_tasks = _sub_tasks_count + 1; -- +1 for the parent task

            IF _total_tasks = 0
            THEN
                _ratio = 0;
            ELSE
                _ratio = (_total_completed / _total_tasks) * 100;
            END IF;
        END IF;
    END IF;

    -- Ensure ratio is between 0 and 100
    IF _ratio < 0
    THEN
        _ratio = 0;
    ELSIF _ratio > 100
    THEN
        _ratio = 100;
    END IF;

    RETURN JSON_BUILD_OBJECT(
            'ratio', _ratio,
            'total_completed', _total_completed,
            'total_tasks', _total_tasks,
            'is_manual', _is_manual
           );
END
$$;


ALTER FUNCTION public.get_task_complete_ratio(_task_id uuid) OWNER TO postgres;

--
-- Name: get_task_form_view_model(uuid, uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_task_form_view_model(_user_id uuid, _team_id uuid, _task_id uuid, _project_id uuid) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _task         JSON;
    _priorities   JSON;
    _projects     JSON;
    _statuses     JSON;
    _team_members JSON;
    _assignees    JSON;
    _phases       JSON;
BEGIN

    -- Select task info
    SELECT COALESCE(ROW_TO_JSON(rec), '{}'::JSON)
    INTO _task
    FROM (WITH RECURSIVE task_hierarchy AS (
        -- Base case: Start with the given task
        SELECT id,
               parent_task_id,
               0 AS level
        FROM tasks
        WHERE id = _task_id

        UNION ALL

        -- Recursive case: Traverse up to parent tasks
        SELECT t.id,
               t.parent_task_id,
               th.level + 1 AS level
        FROM tasks t
                 INNER JOIN task_hierarchy th ON t.id = th.parent_task_id
        WHERE th.parent_task_id IS NOT NULL)
          SELECT id,
                 name,
                 description,
                 start_date,
                 end_date,
                 done,
                 total_minutes,
                 priority_id,
                 project_id,
                 created_at,
                 updated_at,
                 status_id,
                 parent_task_id,
                 sort_order,
                 (SELECT phase_id FROM task_phase WHERE task_id = tasks.id) AS phase_id,
                 CONCAT((SELECT key FROM projects WHERE id = tasks.project_id), '-', task_no) AS task_key,
                 (SELECT start_time
                  FROM task_timers
                  WHERE task_id = tasks.id
                    AND user_id = _user_id) AS timer_start_time,
                 parent_task_id IS NOT NULL AS is_sub_task,
                 (SELECT COUNT('*')
                  FROM tasks
                  WHERE parent_task_id = tasks.id
                    AND archived IS FALSE) AS sub_tasks_count,
                 (SELECT COUNT(*)
                  FROM tasks_with_status_view tt
                  WHERE (tt.parent_task_id = tasks.id OR tt.task_id = tasks.id)
                    AND tt.is_done IS TRUE)
                     AS completed_count,
                 (SELECT COUNT(*) FROM task_attachments WHERE task_id = tasks.id) AS attachments_count,
                 (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(r))), '[]'::JSON)
                  FROM (SELECT task_labels.label_id AS id,
                               (SELECT name FROM team_labels WHERE id = task_labels.label_id),
                               (SELECT color_code FROM team_labels WHERE id = task_labels.label_id)
                        FROM task_labels
                        WHERE task_id = tasks.id
                        ORDER BY name) r) AS labels,
                 (SELECT color_code
                  FROM sys_task_status_categories
                  WHERE id = (SELECT category_id FROM task_statuses WHERE id = tasks.status_id)) AS status_color,
                 (SELECT COUNT(*) FROM tasks WHERE parent_task_id = _task_id) AS sub_tasks_count,
                 (SELECT name FROM users WHERE id = tasks.reporter_id) AS reporter,
                 (SELECT get_task_assignees(tasks.id)) AS assignees,
                 (SELECT id FROM team_members WHERE user_id = _user_id AND team_id = _team_id) AS team_member_id,
                 billable,
                 schedule_id,
                 progress_value,
                 weight,
                 (SELECT MAX(level) FROM task_hierarchy) AS task_level
          FROM tasks
          WHERE id = _task_id) rec;

    SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
    INTO _priorities
    FROM (SELECT id, name FROM task_priorities ORDER BY value) rec;

    SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
    INTO _phases
    FROM (SELECT id, name FROM project_phases WHERE project_id = _project_id ORDER BY name) rec;

    SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
    INTO _projects
    FROM (SELECT id, name
          FROM projects
          WHERE team_id = _team_id
            AND (CASE
                     WHEN (is_owner(_user_id, _team_id) OR is_admin(_user_id, _team_id) IS TRUE) THEN TRUE
                     ELSE is_member_of_project(projects.id, _user_id, _team_id) END)
          ORDER BY name) rec;

    SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
    INTO _statuses
    FROM (SELECT id, name FROM task_statuses WHERE project_id = _project_id) rec;

    SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
    INTO _team_members
    FROM (SELECT team_members.id,
                 (SELECT name FROM team_member_info_view WHERE team_member_info_view.team_member_id = team_members.id),
                 (SELECT email FROM team_member_info_view WHERE team_member_info_view.team_member_id = team_members.id),
                 (SELECT avatar_url
                  FROM team_member_info_view
                  WHERE team_member_info_view.team_member_id = team_members.id)
          FROM team_members
                   LEFT JOIN users u ON team_members.user_id = u.id
          WHERE team_id = _team_id
            AND team_members.active IS TRUE) rec;

    SELECT get_task_assignees(_task_id) INTO _assignees;

    RETURN JSON_BUILD_OBJECT(
            'task', _task,
            'priorities', _priorities,
            'projects', _projects,
            'statuses', _statuses,
            'team_members', _team_members,
            'assignees', _assignees,
            'phases', _phases
           );
END;
$$;


ALTER FUNCTION public.get_task_form_view_model(_user_id uuid, _team_id uuid, _task_id uuid, _project_id uuid) OWNER TO postgres;

--
-- Name: get_task_updates(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_task_updates() RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _result JSON;
BEGIN
    SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
    INTO _result
    FROM (SELECT name,
                 email,
                 (SELECT id
                  FROM team_members
                  WHERE team_id = users.active_team
                    AND user_id = users.id) AS team_member_id,
                 (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(r))), '[]'::JSON) AS teams
                  FROM (SELECT id,
                               name,
                               (SELECT team_member_id
                                FROM team_member_info_view
                                WHERE team_id = teams.id
                                  AND user_id = users.id) AS team_member_id,
                               (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(r))), '[]'::JSON) AS projects
                                FROM (SELECT id,
                                             name,
                                             (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(r))), '[]'::JSON) AS tasks
                                              FROM (SELECT t.id,
                                                           t.name AS name,
                                                           (SELECT name FROM users WHERE id = task_updates.reporter_id) AS updater_name,
                                                           (SELECT STRING_AGG(DISTINCT
                                                                              (SELECT name
                                                                               FROM team_member_info_view
                                                                               WHERE team_member_id = tasks_assignees.team_member_id),
                                                                              ', ')
                                                            FROM tasks_assignees
                                                            WHERE task_id = task_updates.task_id) AS members
                                                    FROM task_updates
                                                             INNER JOIN tasks t ON task_updates.task_id = t.id
                                                    WHERE task_updates.user_id = users.id
                                                      AND task_updates.project_id = projects.id
                                                      AND task_updates.type = 'ASSIGN'
                                                      AND is_sent IS FALSE
                                                    ORDER BY task_updates.created_at) r)
                                      FROM projects
                                      WHERE team_id = teams.id
                                        AND EXISTS(SELECT 1
                                                   FROM task_updates
                                                   WHERE project_id = projects.id
                                                     AND type = 'ASSIGN'
                                                     AND is_sent IS FALSE)) r)
                        FROM teams
                        WHERE EXISTS(SELECT 1 FROM team_members WHERE team_id = teams.id AND user_id = users.id)
                          AND (SELECT email_notifications_enabled
                               FROM notification_settings
                               WHERE team_id = teams.id
                                 AND user_id = users.id) IS TRUE) r)
          FROM users
          WHERE EXISTS(SELECT 1 FROM task_updates WHERE user_id = users.id)) rec;

    UPDATE task_updates SET is_sent = TRUE;

    RETURN _result;
END
$$;


ALTER FUNCTION public.get_task_updates() OWNER TO postgres;

--
-- Name: get_tasks_by_project_member(uuid, uuid, boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_tasks_by_project_member(_project_id uuid, _team_member_id uuid, _archived boolean) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _result JSON;
BEGIN
    SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(r))), '[]'::JSON)
    INTO _result
    FROM (SELECT id,
                 name,
                 status_id,
                 (SELECT name FROM task_statuses WHERE status_id = task_statuses.id) AS status,
                 start_date,
                 end_date,
                 completed_at,
                 total_minutes,
                 (SELECT color_code
                  FROM sys_task_status_categories
                  WHERE id = (SELECT category_id FROM task_statuses WHERE id = status_id)) AS status_color,
                 CASE
                     WHEN CURRENT_DATE::DATE > end_date::DATE
                         AND status_id NOT IN (SELECT id
                                               FROM task_statuses
                                               WHERE project_id = _project_id
                                                 AND category_id IN
                                                     (SELECT id
                                                      FROM sys_task_status_categories
                                                      WHERE sys_task_status_categories.is_done IS FALSE))
                         THEN FALSE
                     ELSE
                         CASE
                             WHEN CURRENT_DATE::DATE > end_date::DATE
                                 THEN TRUE
                             ELSE FALSE
                             END END AS is_overdue,
                 CASE
                     WHEN status_id
                         NOT IN (SELECT id
                                 FROM task_statuses
                                 WHERE project_id = _project_id
                                   AND category_id IN
                                       (SELECT id
                                        FROM sys_task_status_categories
                                        WHERE sys_task_status_categories.is_done IS FALSE))
                         THEN 0
                     ELSE
                         CASE
                             WHEN CURRENT_DATE::DATE > end_date::DATE
                                 THEN NOW()::DATE - end_date::DATE
                             ELSE 0
                             END END AS days_overdue,

                 (SELECT SUM(time_spent) FROM task_work_log WHERE task_id = tasks.id) - (total_minutes * 60) AS overlogged_time,

                 COALESCE(completed_at::DATE - end_date::DATE, 0) AS late_days
          FROM tasks
          WHERE project_id = _project_id
            AND CASE
                    WHEN (_archived IS TRUE) THEN project_id IS NOT NULL
                    ELSE archived IS FALSE END
            AND id IN
                (SELECT task_id FROM tasks_assignees WHERE team_member_id = _team_member_id)) r;
    RETURN _result;
END
$$;


ALTER FUNCTION public.get_tasks_by_project_member(_project_id uuid, _team_member_id uuid, _archived boolean) OWNER TO postgres;

--
-- Name: get_tasks_by_status(uuid, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_tasks_by_status(_id uuid, _status text) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _tasks   JSON;
    _team_id UUID;
BEGIN
    SELECT team_id FROM projects WHERE id = _id INTO _team_id;

    SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
    INTO _tasks
    FROM (SELECT id,
                 name,

                 t.parent_task_id,
                 t.parent_task_id IS NOT NULL AS is_sub_task,
                 (SELECT name FROM tasks WHERE id = t.parent_task_id) AS parent_task_name,
                 (SELECT COUNT('*') FROM tasks WHERE parent_task_id = t.id) AS sub_tasks_count,

                 status_id AS status,
                 sort_order,

                 (SELECT COUNT(*)
                  FROM tasks_with_status_view tt
                  WHERE (tt.parent_task_id = t.id OR tt.task_id = t.id)
                    AND tt.is_done IS TRUE)
                     AS completed_count,

                 (SELECT get_task_assignees(t.id)) AS assignees,

                 (SELECT ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(r)))
                  FROM (SELECT task_labels.label_id AS id,
                               (SELECT name FROM team_labels WHERE id = task_labels.label_id),
                               (SELECT color_code FROM team_labels WHERE id = task_labels.label_id)
                        FROM task_labels
                        WHERE task_id = t.id
                        ORDER BY name) r) AS labels,

                 (SELECT name FROM users WHERE id = reporter_id) AS reporter,
                 (SELECT task_priorities.name FROM task_priorities WHERE id = t.priority_id) AS priority,
                 start_date,
                 end_date
          FROM tasks t
          WHERE archived IS FALSE
            AND (project_id = _id)
            AND (t.status_id IN (SELECT id FROM task_statuses WHERE name = _status))
          ORDER BY sort_order) rec;

    RETURN _tasks;
END;
$$;


ALTER FUNCTION public.get_tasks_by_status(_id uuid, _status text) OWNER TO postgres;

--
-- Name: get_tasks_total_and_completed_counts(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_tasks_total_and_completed_counts(_task_id uuid) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _total_tasks     INT;
    _total_completed INT;
BEGIN
    SELECT COUNT(*)
    FROM tasks
    WHERE (parent_task_id = _task_id OR id = _task_id)
      AND archived IS FALSE
    INTO _total_tasks;

    SELECT COUNT(*)
    FROM tasks_with_status_view tt
    WHERE (tt.parent_task_id = _task_id
        OR tt.task_id = _task_id)
      AND tt.is_done IS TRUE
    INTO _total_completed;

    RETURN JSON_BUILD_OBJECT(
        'total_tasks', _total_tasks,
        'total_completed', _total_completed
        );
END
$$;


ALTER FUNCTION public.get_tasks_total_and_completed_counts(_task_id uuid) OWNER TO postgres;

--
-- Name: get_team_id_from_task(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_team_id_from_task(_id uuid) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
    _team_id UUID;
BEGIN
    SELECT team_id INTO _team_id FROM projects WHERE id = (SELECT project_id FROM tasks WHERE tasks.id = _id);
    RETURN _team_id;
END
$$;


ALTER FUNCTION public.get_team_id_from_task(_id uuid) OWNER TO postgres;

--
-- Name: get_team_members(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_team_members(_team_id uuid, _project_id uuid) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _result JSON;
BEGIN

    SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
    INTO _result
    FROM (
             --
             WITH mbers AS (SELECT team_members.id,
                                   tmiv.name AS name,
                                   tmiv.email,
                                   tmiv.avatar_url,
                                   team_members.user_id,
                                   EXISTS(SELECT 1
                                          FROM project_members
                                          WHERE project_id = _project_id
                                            AND project_members.team_member_id = team_members.id) AS exists_in_project,
                                   0 AS usage,
                                   (CASE
                                       WHEN EXISTS (SELECT 1
                                                    FROM email_invitations
                                                    WHERE team_member_id = team_members.id) THEN TRUE
                                       ELSE FALSE
                                       END) AS is_pending
                            FROM team_members
                                     LEFT JOIN users u ON team_members.user_id = u.id
                                     LEFT JOIN team_member_info_view tmiv ON team_members.id = tmiv.team_member_id
                            WHERE team_members.team_id = _team_id
                              AND team_members.active IS TRUE
                            ORDER BY tmiv.name)
             SELECT id, name, user_id, email, avatar_url, usage, is_pending
             FROM mbers
             ORDER BY exists_in_project DESC
             --
         ) rec;

    RETURN _result;
END;
$$;


ALTER FUNCTION public.get_team_members(_team_id uuid, _project_id uuid) OWNER TO postgres;

--
-- Name: get_team_wise_resources(date, date, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_team_wise_resources(_start_date date, _end_date date, _team_id uuid) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
    _projects JSON;

BEGIN
    SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
    FROM (SELECT id,
                 FALSE AS collapsed,
                 (SELECT name FROM users WHERE user_id = users.id),
                 (SELECT email
                  FROM email_invitations
                  WHERE team_members.id = email_invitations.team_member_id) AS invitee_email,
                 (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                  FROM (SELECT date_series,
                               SUM(total_minutes / 60),
                               JSON_AGG(JSON_BUILD_OBJECT('id', tasks_.id,
                                                          'name', tasks_.name,
                                                          'project_id', tasks_.project_id,
                                                          'project_name', (SELECT projects.name
                                                                           FROM projects
                                                                           WHERE projects.id = tasks_.project_id)
                                   )) AS scheduled_tasks
                        FROM GENERATE_SERIES(
                                 _start_date::DATE,
                                 _end_date::DATE,
                                 '1 day'
                                 ) AS date_series
                                 CROSS JOIN (SELECT id, name, project_id, total_minutes, start_date, end_date
                                             FROM tasks) AS tasks_,
                             tasks_assignees
                        WHERE (date_series BETWEEN tasks_.start_date::DATE AND tasks_.end_date::DATE)
                          AND tasks_assignees.team_member_id = team_members.id
                          AND tasks_.id = tasks_assignees.task_id
                        GROUP BY date_series) rec) AS schedule,
                 (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                  FROM (SELECT projects.id,
                               name,
                               projects.color_code,
                               (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                                FROM (SELECT date_series,
                                             project_id,
                                             SUM(total_minutes / 60),
                                             JSON_AGG(JSON_BUILD_OBJECT('id', tasks_.id,
                                                                        'name', tasks_.name
                                                 )) AS scheduled_tasks
                                      FROM GENERATE_SERIES(
                                               _start_date::DATE,
                                               _end_date::DATE,
                                               '1 day'
                                               ) AS date_series
                                               CROSS JOIN (SELECT id, name, project_id, total_minutes, start_date, end_date
                                                           FROM tasks) AS tasks_,
                                           tasks_assignees
                                      WHERE (date_series BETWEEN tasks_.start_date::DATE AND tasks_.end_date::DATE)
                                        AND tasks_assignees.team_member_id = team_members.id
                                        AND tasks_.id = tasks_assignees.task_id
                                        AND tasks_.project_id = projects.id
                                      GROUP BY date_series, project_id) rec) AS tasks
                        FROM projects,
                             project_members
                        WHERE project_id = projects.id
                          AND team_members.id IN (project_members.team_member_id)
                        ORDER BY updated_at DESC) rec) AS project_members
          FROM team_members
          WHERE team_id = _team_id
            AND user_id IS NOT NULL
          ORDER BY (SELECT name FROM users WHERE user_id = users.id)) rec
    INTO _projects;

    RETURN _projects;
END;
$$;


ALTER FUNCTION public.get_team_wise_resources(_start_date date, _end_date date, _team_id uuid) OWNER TO postgres;

--
-- Name: get_unselected_tasks(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_unselected_tasks(_id uuid) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _tasks JSON;
BEGIN
    SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
    INTO _tasks
    FROM (SELECT t.id,
                 t.name,
                 t.start_date AT TIME ZONE 'Asia/Colombo' AS start,
                 t.end_date AS "end",
                 t.project_id,
                 (SELECT name FROM task_priorities WHERE task_priorities.id = t.priority_id) AS priority,
                 t.priority_id,
                 t.done,
                 t.created_at,
                 t.status_id,
                 (SELECT ARRAY_AGG(ROW_TO_JSON(rec))
                  FROM (SELECT project_member_id AS id,
                               u2.name AS name,
                               (SELECT avatar_url FROM users WHERE id = tm2.user_id),
                               COALESCE((u2.email), (SELECT email
                                                     FROM email_invitations
                                                     WHERE email_invitations.team_member_id = tm2.id)) AS email
                        FROM tasks_assignees
                                 INNER JOIN project_members pm ON pm.id = tasks_assignees.project_member_id
                                 INNER JOIN team_members tm2 ON pm.team_member_id = tm2.id
                                 LEFT JOIN users u2 ON tm2.user_id = u2.id
                        WHERE project_id = _id::UUID
                          AND project_member_id = pm.id
                          AND t.id = tasks_assignees.task_id
                        ORDER BY name) rec) AS assignees
          FROM tasks t
          WHERE archived IS FALSE
            AND project_id = _id::UUID
            AND (t.start_date IS NULL
              OR t.end_date IS NULL
              OR t.id NOT IN (SELECT task_id FROM tasks_assignees))) rec;

    RETURN _tasks;
END;
$$;


ALTER FUNCTION public.get_unselected_tasks(_id uuid) OWNER TO postgres;

--
-- Name: getprojectbyid(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.getprojectbyid(_project_id uuid, _team_id uuid) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _result JSON;
BEGIN
    SELECT ROW_TO_JSON(rec) INTO _result
    FROM (SELECT p.id,
                 p.name,
                 p.key,
                 p.color_code,
                 p.start_date,
                 p.end_date,
                 c.name                                                              AS client_name,
                 c.id                                                                AS client_id,
                 p.notes,
                 p.created_at,
                 p.updated_at,
                 ts.name                                                             AS status,
                 ts.color_code                                                       AS status_color,
                 ts.icon                                                             AS status_icon,
                 ts.id                                                               AS status_id,
                 h.name                                                              AS health,
                 h.color_code                                                        AS health_color,
                 h.icon                                                              AS health_icon,
                 h.id                                                                AS health_id,
                 pc.name                                                             AS category_name,
                 pc.color_code                                                       AS category_color,
                 pc.id                                                               AS category_id,
                 p.phase_label,
                 p.estimated_man_days                                                AS man_days,
                 p.estimated_working_days                                            AS working_days,
                 p.hours_per_day,
                 p.use_manual_progress,
                 p.use_weighted_progress,
                 -- Additional fields
                 COALESCE((SELECT ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(t)))
                          FROM (SELECT pm.id,
                                       pm.project_id,
                                       tm.id                                         AS team_member_id,
                                       tm.user_id,
                                       u.name,
                                       u.email,
                                       u.avatar_url,
                                       u.phone_number,
                                       pal.name                                      AS access_level,
                                       pal.key                                       AS access_level_key,
                                       pal.id                                        AS access_level_id,
                                       EXISTS(SELECT 1
                                              FROM project_members
                                                       INNER JOIN project_access_levels ON
                                                  project_members.project_access_level_id = project_access_levels.id
                                              WHERE project_id = p.id
                                                AND project_access_levels.key = 'PROJECT_MANAGER'
                                                AND team_member_id = tm.id)          AS is_project_manager
                                FROM project_members pm
                                         INNER JOIN team_members tm ON pm.team_member_id = tm.id
                                         INNER JOIN users u ON tm.user_id = u.id
                                         INNER JOIN project_access_levels pal ON pm.project_access_level_id = pal.id
                                WHERE pm.project_id = p.id) t), '[]'::JSON)          AS members,
                 (SELECT COUNT(DISTINCT (id))
                  FROM tasks
                  WHERE archived IS FALSE
                    AND project_id = p.id)                                           AS task_count,
                 (SELECT ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(t)))
                  FROM (SELECT project_members.id,
                               project_members.project_id,
                               team_members.id                                       AS team_member_id,
                               team_members.user_id,
                               users.name,
                               users.email,
                               users.avatar_url,
                               project_access_levels.name                            AS access_level,
                               project_access_levels.key                             AS access_level_key,
                               project_access_levels.id                              AS access_level_id
                        FROM project_members
                                 INNER JOIN team_members ON project_members.team_member_id = team_members.id
                                 INNER JOIN users ON team_members.user_id = users.id
                                 INNER JOIN project_access_levels
                                            ON project_members.project_access_level_id = project_access_levels.id
                        WHERE project_id = p.id
                          AND project_access_levels.key = 'PROJECT_MANAGER'
                        LIMIT 1) t)                                                  AS project_manager,

                 (SELECT EXISTS(SELECT 1
                                FROM project_subscribers
                                WHERE project_id = p.id
                                  AND user_id = (SELECT user_id
                                                 FROM project_members
                                                 WHERE team_member_id = (SELECT id
                                                                         FROM team_members
                                                                         WHERE user_id IN
                                                                               (SELECT user_id FROM is_member_of_project_cte))
                                                   AND project_id = p.id)))          AS subscribed,
                 (SELECT name
                  FROM users
                  WHERE id =
                        (SELECT owner_id FROM projects WHERE id = p.id))             AS project_owner,
                 (SELECT default_view
                  FROM project_members
                  WHERE project_id = p.id
                    AND team_member_id IN (SELECT id FROM is_member_of_project_cte)) AS team_member_default_view,
                 (SELECT EXISTS(SELECT user_id
                                FROM archived_projects
                                WHERE user_id IN (SELECT user_id FROM is_member_of_project_cte)
                                  AND project_id = p.id))                            AS archived,

                 (SELECT EXISTS(SELECT user_id
                                FROM favorite_projects
                                WHERE user_id IN (SELECT user_id FROM is_member_of_project_cte)
                                  AND project_id = p.id))                            AS favorite

          FROM projects p
                   LEFT JOIN sys_project_statuses ts ON p.status_id = ts.id
                   LEFT JOIN sys_project_healths h ON p.health_id = h.id
                   LEFT JOIN project_categories pc ON p.category_id = pc.id
                   LEFT JOIN clients c ON p.client_id = c.id,
               LATERAL (SELECT id, user_id
                        FROM team_members
                        WHERE id = (SELECT team_member_id
                                    FROM project_members
                                    WHERE project_id = p.id
                                      AND team_member_id IN (SELECT id
                                                             FROM team_members
                                                             WHERE team_id = _team_id)
                                    LIMIT 1)) is_member_of_project_cte

          WHERE p.id = _project_id
            AND p.team_id = _team_id) rec;

    RETURN _result;
END
$$;


ALTER FUNCTION public.getprojectbyid(_project_id uuid, _team_id uuid) OWNER TO postgres;

--
-- Name: handle_on_pt_task_phase_change(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_on_pt_task_phase_change(_task_id uuid, _phase_id uuid) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _name TEXT;
    _color_code TEXT;
BEGIN
    IF NOT EXISTS(SELECT 1 FROM cpt_task_phases WHERE task_id = _task_id)
    THEN
        IF (is_null_or_empty(_phase_id) IS FALSE)
        THEN
            INSERT INTO cpt_task_phases (task_id, phase_id) VALUES (_task_id, _phase_id);
        END IF;
    ELSE
        IF (is_null_or_empty(_phase_id) IS TRUE)
        THEN
            DELETE FROM cpt_task_phases WHERE task_id = _task_id;
        ELSE
            UPDATE cpt_task_phases SET phase_id = _phase_id WHERE task_id = _task_id;
        END IF;
    END IF;
    IF (is_null_or_empty(_phase_id) IS FALSE)
    THEN
        SELECT name FROM cpt_phases WHERE id = _phase_id INTO _name;
        SELECT color_code FROM cpt_phases WHERE id = _phase_id INTO _color_code;
    END IF;
    RETURN JSON_BUILD_OBJECT('name', _name, 'color_code', _color_code);
END
$$;


ALTER FUNCTION public.handle_on_pt_task_phase_change(_task_id uuid, _phase_id uuid) OWNER TO postgres;

--
-- Name: handle_on_pt_task_status_change(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_on_pt_task_status_change(_task_id uuid, _status_id uuid) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _task_info            JSON;
    _status_category      JSON;
    _task_name            TEXT;
    _previous_status_name TEXT;
    _new_status_name      TEXT;
BEGIN
    SELECT name FROM cpt_tasks WHERE id = _task_id INTO _task_name;

    SELECT name
    FROM cpt_task_statuses
    WHERE id = (SELECT status_id FROM cpt_tasks WHERE id = _task_id)
    INTO _previous_status_name;

    SELECT name FROM cpt_task_statuses WHERE id = _status_id INTO _new_status_name;

    IF (_previous_status_name != _new_status_name)
    THEN
        UPDATE cpt_tasks SET status_id = _status_id WHERE id = _task_id;
    END IF;

    SELECT COALESCE(ROW_TO_JSON(r), '{}'::JSON)
    FROM (SELECT is_done, is_doing, is_todo
          FROM sys_task_status_categories
          WHERE id = (SELECT category_id FROM cpt_task_statuses WHERE id = _status_id)) r
    INTO _status_category;

    RETURN JSON_BUILD_OBJECT(
        'template_id', (SELECT template_id FROM cpt_tasks WHERE id = _task_id),
        'color_code', (SELECT color_code FROM sys_task_status_categories WHERE id = (SELECT category_id FROM cpt_task_statuses WHERE id = _status_id))::TEXT,
        'status_category', _status_category
        );
END
$$;


ALTER FUNCTION public.handle_on_pt_task_status_change(_task_id uuid, _status_id uuid) OWNER TO postgres;

--
-- Name: handle_on_task_phase_change(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_on_task_phase_change(_task_id uuid, _phase_id uuid) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _name TEXT;
    _color_code TEXT;
BEGIN
    IF NOT EXISTS(SELECT 1 FROM task_phase WHERE task_id = _task_id)
    THEN
        IF (is_null_or_empty(_phase_id) IS FALSE)
        THEN
            INSERT INTO task_phase (task_id, phase_id) VALUES (_task_id, _phase_id);
        END IF;
    ELSE
        IF (is_null_or_empty(_phase_id) IS TRUE)
        THEN
            DELETE FROM task_phase WHERE task_id = _task_id;
        ELSE
            UPDATE task_phase SET phase_id = _phase_id WHERE task_id = _task_id;
        END IF;
    END IF;

    IF (is_null_or_empty(_phase_id) IS FALSE)
    THEN
        SELECT name FROM project_phases WHERE id = _phase_id INTO _name;
        SELECT color_code FROM project_phases WHERE id = _phase_id INTO _color_code;
    END IF;

    RETURN JSON_BUILD_OBJECT('name', _name, 'color_code', _color_code);
END
$$;


ALTER FUNCTION public.handle_on_task_phase_change(_task_id uuid, _phase_id uuid) OWNER TO postgres;

--
-- Name: handle_on_task_status_change(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_on_task_status_change(_user_id uuid, _task_id uuid, _status_id uuid) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _updater_name         TEXT;
    _task_name            TEXT;
    _previous_status_name TEXT;
    _new_status_name      TEXT;
    _message              TEXT;
    _task_info            JSON;
    _status_category      JSON;
    _schedule_id          JSON;
    _task_completed_at    TIMESTAMPTZ;
BEGIN
    SELECT COALESCE(name, '') FROM tasks WHERE id = _task_id INTO _task_name;

    SELECT COALESCE(name, '')
    FROM task_statuses
    WHERE id = (SELECT status_id FROM tasks WHERE id = _task_id)
    INTO _previous_status_name;

    SELECT COALESCE(name, '') FROM task_statuses WHERE id = _status_id INTO _new_status_name;

    IF (_previous_status_name != _new_status_name)
    THEN
        UPDATE tasks SET status_id = _status_id WHERE id = _task_id;

        SELECT get_task_complete_info(_task_id, _status_id) INTO _task_info;

        SELECT COALESCE(name, '') FROM users WHERE id = _user_id INTO _updater_name;

        _message = CONCAT(_updater_name, ' transitioned "', _task_name, '" from ', _previous_status_name, ' ⟶ ',
                          _new_status_name);
    END IF;

    SELECT completed_at FROM tasks WHERE id = _task_id INTO _task_completed_at;
    
    -- Handle schedule_id properly for recurring tasks
    SELECT CASE 
        WHEN schedule_id IS NULL THEN 'null'::json
        ELSE json_build_object('id', schedule_id)
    END
    FROM tasks 
    WHERE id = _task_id 
    INTO _schedule_id;

    SELECT COALESCE(ROW_TO_JSON(r), '{}'::JSON)
    FROM (SELECT is_done, is_doing, is_todo
          FROM sys_task_status_categories
          WHERE id = (SELECT category_id FROM task_statuses WHERE id = _status_id)) r
    INTO _status_category;

    RETURN JSON_BUILD_OBJECT(
            'message', COALESCE(_message, ''),
            'project_id', (SELECT project_id FROM tasks WHERE id = _task_id),
            'parent_done', (CASE
                                WHEN EXISTS(SELECT 1
                                            FROM tasks_with_status_view
                                            WHERE tasks_with_status_view.task_id = _task_id
                                              AND is_done IS TRUE) THEN 1
                                ELSE 0 END),
            'color_code', COALESCE((_task_info ->> 'color_code')::TEXT, ''),
            'color_code_dark', COALESCE((_task_info ->> 'color_code_dark')::TEXT, ''),
            'total_tasks', COALESCE((_task_info ->> 'total_tasks')::INT, 0),
            'total_completed', COALESCE((_task_info ->> 'total_completed')::INT, 0),
            'members', COALESCE((_task_info ->> 'members')::JSON, '[]'::JSON),
            'completed_at', _task_completed_at,
            'status_category', COALESCE(_status_category, '{}'::JSON),
            'schedule_id', COALESCE(_schedule_id, 'null'::JSON)
           );
END
$$;


ALTER FUNCTION public.handle_on_task_status_change(_user_id uuid, _task_id uuid, _status_id uuid) OWNER TO postgres;

--
-- Name: handle_phase_sort_order(json); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_phase_sort_order(_body json) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    _phase      JSON;
    _sort_index INT := 0;
BEGIN

    FOR _phase IN SELECT * FROM JSON_ARRAY_ELEMENTS((_body ->> 'phases')::JSON)
        LOOP
            UPDATE project_phases SET sort_index = _sort_index::INT WHERE id = (_phase ->> 'id')::UUID AND project_id = (_body ->> 'project_id')::UUID;
            _sort_index = _sort_index + 1;
        END LOOP;
END
$$;


ALTER FUNCTION public.handle_phase_sort_order(_body json) OWNER TO postgres;

--
-- Name: handle_pt_task_list_sort_between_groups(integer, integer, uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_pt_task_list_sort_between_groups(_from_index integer, _to_index integer, _task_id uuid, _template_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
BEGIN

    IF (_to_index = -1)
    THEN
        _to_index = COALESCE((SELECT MAX(sort_order) + 1 FROM cpt_tasks WHERE template_id = _template_id), 0);
    END IF;

    IF _to_index > _from_index
    THEN
        UPDATE cpt_tasks
        SET sort_order = sort_order - 1
        WHERE template_id = _template_id
          AND sort_order > _from_index
          AND sort_order < _to_index;

        UPDATE cpt_tasks SET sort_order = _to_index - 1 WHERE id = _task_id AND template_id = _template_id;
    END IF;

    IF _to_index < _from_index
    THEN
        UPDATE cpt_tasks
        SET sort_order = sort_order + 1
        WHERE template_id = _template_id
          AND sort_order > _to_index
          AND sort_order < _from_index;

        UPDATE cpt_tasks SET sort_order = _to_index + 1 WHERE id = _task_id AND template_id = _template_id;
    END IF;
END
$$;


ALTER FUNCTION public.handle_pt_task_list_sort_between_groups(_from_index integer, _to_index integer, _task_id uuid, _template_id uuid) OWNER TO postgres;

--
-- Name: handle_pt_task_list_sort_inside_group(integer, integer, uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_pt_task_list_sort_inside_group(_from_index integer, _to_index integer, _task_id uuid, _template_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF _to_index > _from_index
    THEN
        UPDATE cpt_tasks
        SET sort_order = sort_order - 1
        WHERE template_id = _template_id
          AND sort_order > _from_index
          AND sort_order <= _to_index;
    END IF;

    IF _to_index < _from_index
    THEN
        UPDATE cpt_tasks
        SET sort_order = sort_order + 1
        WHERE template_id = _template_id
          AND sort_order >= _to_index
          AND sort_order < _from_index;
    END IF;

    UPDATE cpt_tasks SET sort_order = _to_index WHERE id = _task_id AND template_id = _template_id;
END
$$;


ALTER FUNCTION public.handle_pt_task_list_sort_inside_group(_from_index integer, _to_index integer, _task_id uuid, _template_id uuid) OWNER TO postgres;

--
-- Name: handle_pt_task_list_sort_order_change(json); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_pt_task_list_sort_order_change(_body json) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    _from_index INT;
    _to_index   INT;
    _task_id    UUID;
    _template_id UUID;
    _from_group UUID;
    _to_group   UUID;
    _group_by   TEXT;
BEGIN
    _template_id = (_body ->> 'template_id')::UUID;
    _task_id = (_body ->> 'task_id')::UUID;
    _from_index = (_body ->> 'from_index')::INT;
    _to_index = (_body ->> 'to_index')::INT;
    _from_group = (_body ->> 'from_group')::UUID;
    _to_group = (_body ->> 'to_group')::UUID;
    _group_by = (_body ->> 'group_by')::TEXT;

    IF (_from_group <> _to_group OR (_from_group <> _to_group) IS NULL)
    THEN
        IF (_group_by = 'status')
        THEN
            UPDATE cpt_tasks SET status_id = _to_group WHERE id = _task_id AND status_id = _from_group;
        END IF;

        IF (_group_by = 'priority')
        THEN
            UPDATE cpt_tasks SET priority_id = _to_group WHERE id = _task_id AND priority_id = _from_group;
        END IF;

        IF (_group_by = 'phase')
        THEN
            IF (is_null_or_empty(_to_group) IS FALSE)
            THEN
                INSERT INTO cpt_task_phases (task_id, phase_id)
                VALUES (_task_id, _to_group)
                ON CONFLICT (task_id) DO UPDATE SET phase_id = _to_group;
            END IF;
            IF (is_null_or_empty(_to_group) IS TRUE)
            THEN
                DELETE
                FROM cpt_task_phases
                WHERE task_id = _task_id;
            END IF;

        END IF;

        IF ((_body ->> 'to_last_index')::BOOLEAN IS TRUE AND _from_index < _to_index)
        THEN
            PERFORM handle_pt_task_list_sort_inside_group(_from_index, _to_index, _task_id, _template_id);
        ELSE
            PERFORM handle_pt_task_list_sort_between_groups(_from_index, _to_index, _task_id, _template_id);
        END IF;
    ELSE
        PERFORM handle_pt_task_list_sort_inside_group(_from_index, _to_index, _task_id, _template_id);
    END IF;
END
$$;


ALTER FUNCTION public.handle_pt_task_list_sort_order_change(_body json) OWNER TO postgres;

--
-- Name: handle_task_list_sort_between_groups(integer, integer, uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_task_list_sort_between_groups(_from_index integer, _to_index integer, _task_id uuid, _project_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
BEGIN

    IF (_to_index = -1)
    THEN
        _to_index = COALESCE((SELECT MAX(sort_order) + 1 FROM tasks WHERE project_id = _project_id), 0);
    END IF;

    IF _to_index > _from_index
    THEN
        UPDATE tasks
        SET sort_order = sort_order - 1
        WHERE project_id = _project_id
          AND sort_order > _from_index
          AND sort_order < _to_index;

        UPDATE tasks SET sort_order = _to_index - 1 WHERE id = _task_id AND project_id = _project_id;
    END IF;

    IF _to_index < _from_index
    THEN
        UPDATE tasks
        SET sort_order = sort_order + 1
        WHERE project_id = _project_id
          AND sort_order > _to_index
          AND sort_order < _from_index;

        UPDATE tasks SET sort_order = _to_index + 1 WHERE id = _task_id AND project_id = _project_id;
    END IF;
END
$$;


ALTER FUNCTION public.handle_task_list_sort_between_groups(_from_index integer, _to_index integer, _task_id uuid, _project_id uuid) OWNER TO postgres;

--
-- Name: handle_task_list_sort_between_groups_optimized(integer, integer, uuid, uuid, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_task_list_sort_between_groups_optimized(_from_index integer, _to_index integer, _task_id uuid, _project_id uuid, _batch_size integer DEFAULT 100) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    _offset INT := 0;
    _affected_rows INT;
BEGIN
    -- PERFORMANCE OPTIMIZATION: Use direct updates without CTE in UPDATE
    IF (_to_index = -1)
    THEN
        _to_index = COALESCE((SELECT MAX(sort_order) + 1 FROM tasks WHERE project_id = _project_id), 0);
    END IF;

    -- PERFORMANCE OPTIMIZATION: Batch updates for large datasets
    IF _to_index > _from_index
    THEN
        LOOP
            UPDATE tasks
            SET sort_order = sort_order - 1
            WHERE project_id = _project_id
              AND sort_order > _from_index
              AND sort_order < _to_index
              AND sort_order > _offset
              AND sort_order <= _offset + _batch_size;
            
            GET DIAGNOSTICS _affected_rows = ROW_COUNT;
            EXIT WHEN _affected_rows = 0;
            _offset := _offset + _batch_size;
        END LOOP;

        UPDATE tasks SET sort_order = _to_index - 1 WHERE id = _task_id AND project_id = _project_id;
    END IF;

    IF _to_index < _from_index
    THEN
        _offset := 0;
        LOOP
            UPDATE tasks
            SET sort_order = sort_order + 1
            WHERE project_id = _project_id
              AND sort_order > _to_index
              AND sort_order < _from_index
              AND sort_order > _offset
              AND sort_order <= _offset + _batch_size;
            
            GET DIAGNOSTICS _affected_rows = ROW_COUNT;
            EXIT WHEN _affected_rows = 0;
            _offset := _offset + _batch_size;
        END LOOP;

        UPDATE tasks SET sort_order = _to_index + 1 WHERE id = _task_id AND project_id = _project_id;
    END IF;
END
$$;


ALTER FUNCTION public.handle_task_list_sort_between_groups_optimized(_from_index integer, _to_index integer, _task_id uuid, _project_id uuid, _batch_size integer) OWNER TO postgres;

--
-- Name: handle_task_list_sort_inside_group(integer, integer, uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_task_list_sort_inside_group(_from_index integer, _to_index integer, _task_id uuid, _project_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF _to_index > _from_index
    THEN
        UPDATE tasks
        SET sort_order = sort_order - 1
        WHERE project_id = _project_id
          AND sort_order > _from_index
          AND sort_order <= _to_index;
    END IF;

    IF _to_index < _from_index
    THEN
        UPDATE tasks
        SET sort_order = sort_order + 1
        WHERE project_id = _project_id
          AND sort_order >= _to_index
          AND sort_order < _from_index;
    END IF;

    UPDATE tasks SET sort_order = _to_index WHERE id = _task_id AND project_id = _project_id;
END
$$;


ALTER FUNCTION public.handle_task_list_sort_inside_group(_from_index integer, _to_index integer, _task_id uuid, _project_id uuid) OWNER TO postgres;

--
-- Name: handle_task_list_sort_inside_group_optimized(integer, integer, uuid, uuid, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_task_list_sort_inside_group_optimized(_from_index integer, _to_index integer, _task_id uuid, _project_id uuid, _batch_size integer DEFAULT 100) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    _offset INT := 0;
    _affected_rows INT;
BEGIN
    -- PERFORMANCE OPTIMIZATION: Batch updates for large datasets without CTE in UPDATE
    IF _to_index > _from_index
    THEN
        LOOP
            UPDATE tasks
            SET sort_order = sort_order - 1
            WHERE project_id = _project_id
              AND sort_order > _from_index
              AND sort_order <= _to_index
              AND sort_order > _offset
              AND sort_order <= _offset + _batch_size;
            
            GET DIAGNOSTICS _affected_rows = ROW_COUNT;
            EXIT WHEN _affected_rows = 0;
            _offset := _offset + _batch_size;
        END LOOP;
    END IF;

    IF _to_index < _from_index
    THEN
        _offset := 0;
        LOOP
            UPDATE tasks
            SET sort_order = sort_order + 1
            WHERE project_id = _project_id
              AND sort_order >= _to_index
              AND sort_order < _from_index
              AND sort_order > _offset
              AND sort_order <= _offset + _batch_size;
            
            GET DIAGNOSTICS _affected_rows = ROW_COUNT;
            EXIT WHEN _affected_rows = 0;
            _offset := _offset + _batch_size;
        END LOOP;
    END IF;

    UPDATE tasks SET sort_order = _to_index WHERE id = _task_id AND project_id = _project_id;
END
$$;


ALTER FUNCTION public.handle_task_list_sort_inside_group_optimized(_from_index integer, _to_index integer, _task_id uuid, _project_id uuid, _batch_size integer) OWNER TO postgres;

--
-- Name: handle_task_list_sort_order_change(json); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_task_list_sort_order_change(_body json) RETURNS void
    LANGUAGE plpgsql
    AS $_$
DECLARE
    _from_index INT;
    _to_index   INT;
    _task_id    UUID;
    _project_id UUID;
    _from_group UUID;
    _to_group   UUID;
    _group_by   TEXT;
    _sort_column TEXT;
    _sql TEXT;
BEGIN
    _project_id = (_body ->> 'project_id')::UUID;
    _task_id = (_body ->> 'task_id')::UUID;
    _from_index = (_body ->> 'from_index')::INT;
    _to_index = (_body ->> 'to_index')::INT;
    _from_group = (_body ->> 'from_group')::UUID;
    _to_group = (_body ->> 'to_group')::UUID;
    _group_by = (_body ->> 'group_by')::TEXT;
    
    -- Get the appropriate sort column
    _sort_column := get_sort_column_name(_group_by);
    
    -- Handle group changes first
    IF (_from_group <> _to_group OR (_from_group <> _to_group) IS NULL) THEN
        IF (_group_by = 'status') THEN
            UPDATE tasks 
            SET status_id = _to_group, updated_at = CURRENT_TIMESTAMP
            WHERE id = _task_id 
              AND project_id = _project_id;
        END IF;
        
        IF (_group_by = 'priority') THEN
            UPDATE tasks 
            SET priority_id = _to_group, updated_at = CURRENT_TIMESTAMP
            WHERE id = _task_id 
              AND project_id = _project_id;
        END IF;
        
        IF (_group_by = 'phase') THEN
            IF (is_null_or_empty(_to_group) IS FALSE) THEN
                INSERT INTO task_phase (task_id, phase_id)
                VALUES (_task_id, _to_group)
                ON CONFLICT (task_id) DO UPDATE SET phase_id = _to_group;
            ELSE
                DELETE FROM task_phase WHERE task_id = _task_id;
            END IF;
        END IF;
    END IF;

    -- Handle sort order changes for the grouping-specific column only
    IF (_from_index <> _to_index) THEN
        -- Update the grouping-specific sort order (no unique constraint issues)
        IF (_to_index > _from_index) THEN
            -- Moving down: decrease sort order for items between old and new position
            _sql := 'UPDATE tasks SET ' || _sort_column || ' = ' || _sort_column || ' - 1, ' ||
                   'updated_at = CURRENT_TIMESTAMP ' ||
                   'WHERE project_id = $1 AND ' || _sort_column || ' > $2 AND ' || _sort_column || ' <= $3';
            EXECUTE _sql USING _project_id, _from_index, _to_index;
        ELSE
            -- Moving up: increase sort order for items between new and old position  
            _sql := 'UPDATE tasks SET ' || _sort_column || ' = ' || _sort_column || ' + 1, ' ||
                   'updated_at = CURRENT_TIMESTAMP ' ||
                   'WHERE project_id = $1 AND ' || _sort_column || ' >= $2 AND ' || _sort_column || ' < $3';
            EXECUTE _sql USING _project_id, _to_index, _from_index;
        END IF;
        
        -- Set the new sort order for the moved task
        _sql := 'UPDATE tasks SET ' || _sort_column || ' = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2';
        EXECUTE _sql USING _to_index, _task_id;
    END IF;
END
$_$;


ALTER FUNCTION public.handle_task_list_sort_order_change(_body json) OWNER TO postgres;

--
-- Name: handle_task_name_change(uuid, text, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_task_name_change(_task_id uuid, _task_name text, _user_id uuid) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _name          TEXT;
    _previous_name TEXT;
    _user_name     TEXT;
    _message       TEXT;
    _assignees     JSON;
BEGIN

    IF (is_null_or_empty(_task_name))
    THEN
        SELECT name FROM tasks WHERE id = _task_id INTO _name;
    ELSE
        SELECT name FROM tasks WHERE id = _task_id INTO _previous_name;
        UPDATE tasks SET name = _task_name WHERE id = _task_id RETURNING name INTO _name;
    END IF;

    IF (_name != _previous_name)
    THEN
        SELECT get_task_assignees(_task_id) INTO _assignees;

        SELECT name FROM users WHERE id = _user_id INTO _user_name;

        _message = CONCAT(_user_name, ' has renamed "', _previous_name, '" → "', _name, '"');
    END IF;

    RETURN JSON_BUILD_OBJECT(
        'name', _name,
        'previous_name', _previous_name,
        'project_id', (SELECT project_id FROM tasks WHERE id = _task_id),
        'message', _message,
        'members', _assignees
        );
END
$$;


ALTER FUNCTION public.handle_task_name_change(_task_id uuid, _task_name text, _user_id uuid) OWNER TO postgres;

--
-- Name: handle_task_roadmap_sort_order(integer, integer, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_task_roadmap_sort_order(_from_index integer, _to_index integer, _task_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    _project_id uuid;
BEGIN
    SELECT project_id INTO _project_id FROM tasks WHERE id = _task_id;

    IF _to_index > _from_index
    THEN
        UPDATE tasks
        SET roadmap_sort_order = roadmap_sort_order - 1
        WHERE project_id = _project_id
          AND roadmap_sort_order > _from_index
          AND roadmap_sort_order <= _to_index;
    END IF;

    IF _to_index < _from_index
    THEN
        UPDATE tasks
        SET roadmap_sort_order = roadmap_sort_order + 1
        WHERE project_id = _project_id
          AND roadmap_sort_order >= _to_index
          AND roadmap_sort_order < _from_index;
    END IF;

    UPDATE tasks SET roadmap_sort_order = _to_index WHERE id = _task_id AND project_id = _project_id;
END
$$;


ALTER FUNCTION public.handle_task_roadmap_sort_order(_from_index integer, _to_index integer, _task_id uuid) OWNER TO postgres;

--
-- Name: home_task_form_view_model(uuid, uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.home_task_form_view_model(_user_id uuid, _team_id uuid, _task_id uuid, _project_id uuid) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _task JSON;
BEGIN

    -- Select task info
    SELECT COALESCE(ROW_TO_JSON(rec), '{}'::JSON)
    INTO _task
    FROM (SELECT id,
                 name,
                 start_date,
                 end_date,
                 done,
                 priority_id,
                 project_id,
                 created_at,
                 updated_at,
                 status_id,
                 parent_task_id,
                 parent_task_id IS NOT NULL AS is_sub_task,
                 (SELECT COUNT(*) FROM tasks WHERE parent_task_id = _task_id) AS sub_tasks_count,
                 (SELECT name FROM users WHERE id = tasks.reporter_id) AS reporter,
                 (SELECT get_task_assignees(tasks.id)) AS assignees,
                 (SELECT id FROM team_members WHERE user_id = _user_id AND team_id = _team_id) AS team_member_id
          FROM tasks
          WHERE id = _task_id) rec;

    RETURN JSON_BUILD_OBJECT(
        'task', _task
        );
END;
$$;


ALTER FUNCTION public.home_task_form_view_model(_user_id uuid, _team_id uuid, _task_id uuid, _project_id uuid) OWNER TO postgres;

--
-- Name: import_tasks_from_template(uuid, uuid, json); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.import_tasks_from_template(_project_id uuid, _user_id uuid, _tasks json) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _task     JSON;
    _max_sort INT;
    _task_id_new UUID;
BEGIN

    SELECT COALESCE((SELECT MAX(sort_order) FROM tasks WHERE project_id = _project_id), 0) INTO _max_sort;

    -- insert tasks for task templates
    FOR _task IN SELECT * FROM JSON_ARRAY_ELEMENTS(_tasks)
        LOOP
            _max_sort = _max_sort + 1;
            INSERT INTO tasks (name, priority_id, project_id, reporter_id, status_id, sort_order, total_minutes)
            VALUES (TRIM((_task ->> 'name')::TEXT),
                    (SELECT id FROM task_priorities WHERE value = 1),
                    _project_id,
                    _user_id,

                       -- This should be came from client side later
                    (SELECT id
                     FROM task_statuses
                     WHERE project_id = _project_id::UUID
                       AND category_id IN (SELECT id FROM sys_task_status_categories WHERE is_todo IS TRUE)
                     LIMIT 1), _max_sort, (_task ->> 'total_minutes')::NUMERIC) RETURNING id INTO _task_id_new;

            INSERT INTO task_activity_logs (task_id, team_id, attribute_type, user_id, log_type, old_value, new_value, project_id)
                VALUES (
                        _task_id_new,
                        (SELECT team_id FROM projects WHERE id = _project_id),
                        'status',
                        _user_id,
                        'update',
                        NULL,
                        (SELECT id FROM task_statuses WHERE project_id = _project_id::UUID AND category_id IN (SELECT id FROM sys_task_status_categories WHERE is_todo IS TRUE)LIMIT 1),
                        _project_id
                        );

        END LOOP;

    RETURN JSON_BUILD_OBJECT('id', _project_id);
END;
$$;


ALTER FUNCTION public.import_tasks_from_template(_project_id uuid, _user_id uuid, _tasks json) OWNER TO postgres;

--
-- Name: in_organization(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.in_organization(_team_id_in uuid, _team_id uuid) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM teams t1
        JOIN teams t2 ON t1.user_id = t2.user_id
        WHERE t1.id = _team_id_in AND t2.id = _team_id
    );
END;
$$;


ALTER FUNCTION public.in_organization(_team_id_in uuid, _team_id uuid) OWNER TO postgres;

--
-- Name: insert_job_title(text, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.insert_job_title(_job_title text, _team_id uuid) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
    _job_title_id UUID;
BEGIN
    IF EXISTS(SELECT name FROM job_titles WHERE name = _job_title AND team_id = _team_id)
    THEN
        SELECT id FROM job_titles WHERE name = _job_title AND team_id = _team_id INTO _job_title_id;
    ELSE
        INSERT INTO job_titles (name, team_id)
        VALUES (_job_title, _team_id)
        RETURNING id INTO _job_title_id;
    END IF;

    RETURN _job_title_id;
END;
$$;


ALTER FUNCTION public.insert_job_title(_job_title text, _team_id uuid) OWNER TO postgres;

--
-- Name: insert_task_dependency(uuid, uuid, public.dependency_type); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.insert_task_dependency(_task_id uuid, _related_task_id uuid, _dependency_type public.dependency_type DEFAULT 'blocked_by'::public.dependency_type) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Attempt to insert into task_dependencies
    INSERT INTO task_dependencies (task_id, related_task_id, dependency_type)
    VALUES (_task_id, _related_task_id, _dependency_type)
    ON CONFLICT (task_id, related_task_id, dependency_type)
    DO NOTHING;

    -- Check if the insert was successful
    IF NOT FOUND THEN
        -- Raise an exception if a conflict was found
        RAISE EXCEPTION 'DEPENDENCY_EXISTS';
    END IF;
END;
$$;


ALTER FUNCTION public.insert_task_dependency(_task_id uuid, _related_task_id uuid, _dependency_type public.dependency_type) OWNER TO postgres;

--
-- Name: insert_task_list_columns(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.insert_task_list_columns(_project_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
BEGIN
    INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
    VALUES (_project_id, 'Key', 'KEY', 0, FALSE);
    INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
    VALUES (_project_id, 'Description', 'DESCRIPTION', 2, FALSE);
    INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
    VALUES (_project_id, 'Progress', 'PROGRESS', 3, TRUE);
    INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
    VALUES (_project_id, 'Status', 'STATUS', 4, TRUE);
    INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
    VALUES (_project_id, 'Members', 'ASSIGNEES', 5, TRUE);
    INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
    VALUES (_project_id, 'Labels', 'LABELS', 6, TRUE);
    INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
    VALUES (_project_id, 'Phase', 'PHASE', 7, TRUE);
    INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
    VALUES (_project_id, 'Priority', 'PRIORITY', 8, TRUE);
    INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
    VALUES (_project_id, 'Time Tracking', 'TIME_TRACKING', 9, TRUE);
    INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
    VALUES (_project_id, 'Estimation', 'ESTIMATION', 10, FALSE);
    INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
    VALUES (_project_id, 'Start Date', 'START_DATE', 11, FALSE);
    INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
    VALUES (_project_id, 'Due Date', 'DUE_DATE', 12, TRUE);
    INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
    VALUES (_project_id, 'Completed Date', 'COMPLETED_DATE', 13, FALSE);
    INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
    VALUES (_project_id, 'Created Date', 'CREATED_DATE', 14, FALSE);
    INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
    VALUES (_project_id, 'Last Updated', 'LAST_UPDATED', 15, FALSE);
    INSERT INTO project_task_list_cols (project_id, name, key, index, pinned)
    VALUES (_project_id, 'Reporter', 'REPORTER', 16, FALSE);
END
$$;


ALTER FUNCTION public.insert_task_list_columns(_project_id uuid) OWNER TO postgres;

--
-- Name: is_admin(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_admin(_user_id uuid, _team_id uuid) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
BEGIN
    RETURN EXISTS(SELECT 1
                  FROM team_members
                  WHERE team_id = _team_id
                    AND user_id = _user_id
                    AND role_id = (SELECT id
                                   FROM roles
                                   WHERE id = team_members.role_id
                                     AND admin_role IS TRUE));
END
$$;


ALTER FUNCTION public.is_admin(_user_id uuid, _team_id uuid) OWNER TO postgres;

--
-- Name: is_completed(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_completed(_status_id uuid, _project_id uuid) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
BEGIN
    RETURN (SELECT _status_id IN (SELECT id
                                  FROM task_statuses
                                  WHERE project_id = _project_id
                                    AND category_id =
                                        (SELECT id FROM sys_task_status_categories WHERE is_done IS TRUE)));
END
$$;


ALTER FUNCTION public.is_completed(_status_id uuid, _project_id uuid) OWNER TO postgres;

--
-- Name: is_completed_between(uuid, date, date); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_completed_between(_task_id uuid, _start_date date, _end_date date) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
    BEGIN
    RETURN EXISTS ( SELECT 1 FROM tasks WHERE id = _task_id AND completed_at::DATE >= _start_date::DATE AND completed_at::DATE <= _end_date::DATE);
END
$$;


ALTER FUNCTION public.is_completed_between(_task_id uuid, _start_date date, _end_date date) OWNER TO postgres;

--
-- Name: is_doing(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_doing(_status_id uuid, _project_id uuid) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
BEGIN
    RETURN (SELECT _status_id IN (SELECT id
                                  FROM task_statuses
                                  WHERE project_id = _project_id
                                    AND category_id =
                                        (SELECT id FROM sys_task_status_categories WHERE is_doing IS TRUE)));
END
$$;


ALTER FUNCTION public.is_doing(_status_id uuid, _project_id uuid) OWNER TO postgres;

--
-- Name: is_member_of_project(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_member_of_project(_project_id uuid, _user_id uuid, _team_id uuid) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
BEGIN
    RETURN EXISTS(SELECT 1
                  FROM project_members
                  WHERE project_id = _project_id
                    AND team_member_id = (SELECT id FROM team_members WHERE team_id = _team_id AND user_id = _user_id));
END
$$;


ALTER FUNCTION public.is_member_of_project(_project_id uuid, _user_id uuid, _team_id uuid) OWNER TO postgres;

--
-- Name: is_null_or_empty(anyelement); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_null_or_empty(_value anyelement) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN COALESCE(TRIM(_value::TEXT), '') = '';
END;
$$;


ALTER FUNCTION public.is_null_or_empty(_value anyelement) OWNER TO postgres;

--
-- Name: is_overdue(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_overdue(_task_id uuid) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
BEGIN
    RETURN EXISTS(SELECT 1
                  FROM tasks
                  WHERE id = _task_id
                    AND end_date < CURRENT_TIMESTAMP
                    AND is_completed(tasks.status_id, tasks.project_id) IS FALSE);
END
$$;


ALTER FUNCTION public.is_overdue(_task_id uuid) OWNER TO postgres;

--
-- Name: is_overdue_for_date(uuid, date); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_overdue_for_date(_task_id uuid, _end_date date) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
BEGIN
    RETURN EXISTS(SELECT 1
                  FROM tasks
                  WHERE id = _task_id
                    AND end_date < _end_date
                    AND is_completed(tasks.status_id, tasks.project_id) IS FALSE);
END
$$;


ALTER FUNCTION public.is_overdue_for_date(_task_id uuid, _end_date date) OWNER TO postgres;

--
-- Name: is_owner(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_owner(_user_id uuid, _team_id uuid) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
BEGIN
    RETURN EXISTS(SELECT 1
                  FROM teams
                  WHERE teams.user_id = _user_id
                    AND teams.id = _team_id);
END
$$;


ALTER FUNCTION public.is_owner(_user_id uuid, _team_id uuid) OWNER TO postgres;

--
-- Name: is_todo(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_todo(_status_id uuid, _project_id uuid) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
BEGIN
    RETURN (SELECT _status_id IN (SELECT id
                                  FROM task_statuses
                                  WHERE project_id = _project_id
                                    AND category_id =
                                        (SELECT id FROM sys_task_status_categories WHERE is_todo IS TRUE)));
END
$$;


ALTER FUNCTION public.is_todo(_status_id uuid, _project_id uuid) OWNER TO postgres;

--
-- Name: lower_email(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.lower_email() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
BEGIN

    IF (is_null_or_empty(NEW.email) IS FALSE)
    THEN
        NEW.email = LOWER(TRIM(NEW.email));
    END IF;

    RETURN NEW;
END
$$;


ALTER FUNCTION public.lower_email() OWNER TO postgres;

--
-- Name: mark_bulk_refunds(jsonb[]); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.mark_bulk_refunds(coupon_data jsonb[]) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    data_record JSONB;
BEGIN
    FOREACH data_record IN ARRAY coupon_data
        LOOP
            UPDATE licensing_coupon_codes
            SET is_refunded = TRUE,
                reason      = TRIM(data_record ->> 'reason'),
                feedback    = TRIM(data_record ->> 'feedback'),
                refunded_at = (data_record ->> 'refund_date')::TIMESTAMPTZ
            WHERE coupon_code = (data_record ->> 'code')::TEXT;
        END LOOP;
END;
$$;


ALTER FUNCTION public.mark_bulk_refunds(coupon_data jsonb[]) OWNER TO postgres;

--
-- Name: migrate_member_allocations(json); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.migrate_member_allocations(_body json) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _member JSON;
    _output JSON;
BEGIN
    FOR _member IN SELECT * FROM JSON_ARRAY_ELEMENTS(_body::JSON)
        LOOP
            INSERT INTO project_member_allocations(project_id, team_member_id, allocated_from, allocated_to)
            VALUES ((_member ->> 'project_id')::UUID, (_member ->> 'team_member_id')::UUID,
                    (_member ->> 'allocated_from')::DATE,
                    (_member ->> 'allocated_to')::DATE);
        END LOOP;
    RETURN _output;
END;
$$;


ALTER FUNCTION public.migrate_member_allocations(_body json) OWNER TO postgres;

--
-- Name: move_tasks_and_delete_status(json); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.move_tasks_and_delete_status(_body json) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    _status_id   UUID;
    _category_id UUID;
BEGIN
    _status_id = (_body ->> 'id')::UUID;
    SELECT category_id FROM task_statuses WHERE id = _status_id INTO _category_id;

    IF (is_null_or_empty(_body ->> 'replacing_status') IS FALSE)
    THEN
        UPDATE tasks
        SET status_id = (_body ->> 'replacing_status')::UUID
        WHERE project_id = (_body ->> 'project_id')::UUID
          AND status_id = _status_id;
    END IF;

    IF ((SELECT COUNT(*)
         FROM task_statuses
         WHERE category_id = _category_id
           AND project_id = (_body ->> 'project_id')::UUID) < 2)
    THEN
        RAISE 'ERROR_ONE_SHOULD_EXISTS';
    END IF;

    DELETE FROM task_statuses WHERE id = _status_id AND project_id = (_body ->> 'project_id')::UUID;
END
$$;


ALTER FUNCTION public.move_tasks_and_delete_status(_body json) OWNER TO postgres;

--
-- Name: notification_settings_delete_trigger_fn(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.notification_settings_delete_trigger_fn() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
BEGIN
    DELETE FROM notification_settings WHERE user_id = OLD.user_id AND team_id = OLD.team_id;
    RETURN OLD;
END
$$;


ALTER FUNCTION public.notification_settings_delete_trigger_fn() OWNER TO postgres;

--
-- Name: notification_settings_insert_trigger_fn(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.notification_settings_insert_trigger_fn() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
BEGIN

    IF (NOT EXISTS(SELECT 1 FROM notification_settings WHERE team_id = NEW.team_id AND user_id = NEW.user_id)) AND
       (is_null_or_empty(NEW.user_id) IS FALSE) AND (EXISTS(SELECT 1 FROM users WHERE id = NEW.user_id))
    THEN
        INSERT INTO notification_settings (popup_notifications_enabled, show_unread_items_count, user_id,
                                           team_id)
        VALUES (TRUE, TRUE, NEW.user_id, NEW.team_id);
    END IF;

    RETURN NEW;
END
$$;


ALTER FUNCTION public.notification_settings_insert_trigger_fn() OWNER TO postgres;

--
-- Name: notify_task_assignment_update(text, uuid, uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.notify_task_assignment_update(_type text, _reporter_id uuid, _task_id uuid, _user_id uuid, _team_id uuid) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _reporter_name TEXT;
    _task_name     TEXT;
    _message       TEXT;
    _team_id       UUID;
    _project_id    UUID;
BEGIN
    IF (is_null_or_empty(_task_id) IS FALSE)
    THEN

        SELECT project_id FROM tasks WHERE id = _task_id INTO _project_id;
        SELECT team_id FROM projects WHERE id = _project_id INTO _team_id;

        INSERT INTO task_updates (type, reporter_id, task_id, user_id, team_id, project_id)
        VALUES (_type, _reporter_id, _task_id, _user_id, _team_id, (SELECT project_id FROM tasks WHERE id = _task_id));

        SELECT name FROM users WHERE id = _reporter_id INTO _reporter_name;
        SELECT name FROM tasks WHERE id = _task_id INTO _task_name;

        IF (_type = 'ASSIGN')
        THEN
            _message = CONCAT('<b>', _reporter_name, '</b> has assigned you in <b>', _task_name, '</b>');
        ELSE
            _message = CONCAT('<b>', _reporter_name, '</b> has removed you from <b>', _task_name, '</b>');
        END IF;

        PERFORM create_notification(_user_id, _team_id, _task_id, _project_id, _message);

        RETURN JSON_BUILD_OBJECT(
            'receiver_socket_id', (SELECT socket_id FROM users WHERE id = _user_id),
            'team', (SELECT name FROM teams WHERE id = _team_id),
            'team_id', _team_id,
            'project', (SELECT name FROM projects WHERE id = _project_id),
            'project_color', (SELECT color_code FROM projects WHERE id = _project_id),
            'project_id', _project_id,
            'task_id', _task_id,
            'message', _message
            );

    END IF;

    RETURN NULL;
END
$$;


ALTER FUNCTION public.notify_task_assignment_update(_type text, _reporter_id uuid, _task_id uuid, _user_id uuid, _team_id uuid) OWNER TO postgres;

--
-- Name: on_update_task_progress(json); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.on_update_task_progress(_body json) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _task_id        UUID;
    _progress_value INTEGER;
    _parent_task_id UUID;
    _project_id     UUID;
    _current_mode   VARCHAR(20);
BEGIN
    _task_id = (_body ->> 'task_id')::UUID;
    _progress_value = (_body ->> 'progress_value')::INTEGER;
    _parent_task_id = (_body ->> 'parent_task_id')::UUID;

    -- Get the project ID and determine the current progress mode
    SELECT project_id INTO _project_id FROM tasks WHERE id = _task_id;

    IF _project_id IS NOT NULL
    THEN
        SELECT CASE
                   WHEN use_manual_progress IS TRUE THEN 'manual'
                   WHEN use_weighted_progress IS TRUE THEN 'weighted'
                   WHEN use_time_progress IS TRUE THEN 'time'
                   ELSE 'default'
                   END
        INTO _current_mode
        FROM projects
        WHERE id = _project_id;
    ELSE
        _current_mode := 'default';
    END IF;

    -- Update the task with progress value and set the progress mode
    UPDATE tasks
    SET progress_value  = _progress_value,
        manual_progress = TRUE,
        progress_mode   = _current_mode,
        updated_at      = CURRENT_TIMESTAMP
    WHERE id = _task_id;

    -- Return the updated task info
    RETURN JSON_BUILD_OBJECT(
            'task_id', _task_id,
            'progress_value', _progress_value,
            'progress_mode', _current_mode
           );
END;
$$;


ALTER FUNCTION public.on_update_task_progress(_body json) OWNER TO postgres;

--
-- Name: on_update_task_weight(json); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.on_update_task_weight(_body json) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _task_id        UUID;
    _weight         INTEGER;
    _parent_task_id UUID;
    _project_id     UUID;
BEGIN
    _task_id = (_body ->> 'task_id')::UUID;
    _weight = (_body ->> 'weight')::INTEGER;
    _parent_task_id = (_body ->> 'parent_task_id')::UUID;

    -- Get the project ID
    SELECT project_id INTO _project_id FROM tasks WHERE id = _task_id;

    -- Update the task with weight value and set progress_mode to 'weighted'
    UPDATE tasks
    SET weight        = _weight,
        progress_mode = 'weighted',
        updated_at    = CURRENT_TIMESTAMP
    WHERE id = _task_id;

    -- Return the updated task info
    RETURN JSON_BUILD_OBJECT(
            'task_id', _task_id,
            'weight', _weight
           );
END;
$$;


ALTER FUNCTION public.on_update_task_weight(_body json) OWNER TO postgres;

--
-- Name: recalculate_all_task_progress(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.recalculate_all_task_progress() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- First, reset manual_progress flag for all tasks that have subtasks
    UPDATE tasks AS t
    SET manual_progress = FALSE
    WHERE EXISTS (
        SELECT 1
        FROM tasks
        WHERE parent_task_id = t.id
        AND archived IS FALSE
    );
    
    -- Start recalculation from leaf tasks (no subtasks) and propagate upward
    -- This ensures calculations are done in the right order
    WITH RECURSIVE task_hierarchy AS (
        -- Base case: Start with all leaf tasks (no subtasks)
        SELECT 
            id,
            parent_task_id,
            0 AS level
        FROM tasks
        WHERE NOT EXISTS (
            SELECT 1 FROM tasks AS sub
            WHERE sub.parent_task_id = tasks.id
            AND sub.archived IS FALSE
        )
        AND archived IS FALSE
        
        UNION ALL
        
        -- Recursive case: Move up to parent tasks, but only after processing all their children
        SELECT 
            t.id,
            t.parent_task_id,
            th.level + 1
        FROM tasks t
        JOIN task_hierarchy th ON t.id = th.parent_task_id
        WHERE t.archived IS FALSE
    )
    -- Sort by level to ensure we calculate in the right order (leaves first, then parents)
    -- This ensures we're using already updated progress values
    UPDATE tasks
    SET progress_value = (SELECT (get_task_complete_ratio(tasks.id)->>'ratio')::FLOAT)
    FROM (
        SELECT id, level
        FROM task_hierarchy
        ORDER BY level
    ) AS ordered_tasks
    WHERE tasks.id = ordered_tasks.id
    AND (manual_progress IS FALSE OR manual_progress IS NULL);
    
    -- Log the completion of the recalculation
    RAISE NOTICE 'Finished recalculating all task progress values';
END;
$$;


ALTER FUNCTION public.recalculate_all_task_progress() OWNER TO postgres;

--
-- Name: refresh_team_member_info_mv(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.refresh_team_member_info_mv() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY team_member_info_mv;
END;
$$;


ALTER FUNCTION public.refresh_team_member_info_mv() OWNER TO postgres;

--
-- Name: register_google_user(json); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.register_google_user(_body json) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _user_id         UUID;
    _organization_id UUID;
    _team_id         UUID;
    _role_id         UUID;

    _name            TEXT;
    _email           TEXT;
    _google_id       TEXT;
BEGIN
    _name = (_body ->> 'displayName')::TEXT;
    _email = (_body ->> 'email')::TEXT;
    _google_id = (_body ->> 'id');

    INSERT INTO users (name, email, google_id, timezone_id)
    VALUES (_name, _email, _google_id, COALESCE((SELECT id FROM timezones WHERE name = (_body ->> 'timezone')),
                                                (SELECT id FROM timezones WHERE name = 'UTC')))
    RETURNING id INTO _user_id;

    --insert organization data
    INSERT INTO organizations (user_id, organization_name, contact_number, contact_number_secondary, trial_in_progress,
                               trial_expire_date, subscription_status, license_type_id)
    VALUES (_user_id, TRIM((_body ->> 'team_name')::TEXT), NULL, NULL, TRUE, CURRENT_DATE + INTERVAL '9999 days',
            'active', (SELECT id FROM sys_license_types WHERE key = 'SELF_HOSTED'))
    RETURNING id INTO _organization_id;

    INSERT INTO teams (name, user_id, organization_id)
    VALUES (_name, _user_id, _organization_id)
    RETURNING id INTO _team_id;

    -- insert default roles
    INSERT INTO roles (name, team_id, default_role) VALUES ('Member', _team_id, TRUE);
    INSERT INTO roles (name, team_id, admin_role) VALUES ('Admin', _team_id, TRUE);
    INSERT INTO roles (name, team_id, owner) VALUES ('Owner', _team_id, TRUE) RETURNING id INTO _role_id;

    INSERT INTO team_members (user_id, team_id, role_id)
    VALUES (_user_id, _team_id, _role_id);

    IF (is_null_or_empty(_body ->> 'team') OR is_null_or_empty(_body ->> 'member_id'))
    THEN
        UPDATE users SET active_team = _team_id WHERE id = _user_id;
    ELSE
        -- Verify team member
        IF EXISTS(SELECT id
                  FROM team_members
                  WHERE id = (_body ->> 'member_id')::UUID
                    AND team_id = (_body ->> 'team')::UUID)
        THEN
            UPDATE team_members
            SET user_id = _user_id
            WHERE id = (_body ->> 'member_id')::UUID
              AND team_id = (_body ->> 'team')::UUID;

            DELETE
            FROM email_invitations
            WHERE team_id = (_body ->> 'team')::UUID
              AND team_member_id = (_body ->> 'member_id')::UUID;

            UPDATE users SET active_team = (_body ->> 'team')::UUID WHERE id = _user_id;
        END IF;
    END IF;

    RETURN JSON_BUILD_OBJECT(
            'id', _user_id,
            'email', _email,
            'google_id', _google_id
           );
END
$$;


ALTER FUNCTION public.register_google_user(_body json) OWNER TO postgres;

--
-- Name: register_user(json); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.register_user(_body json) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _user_id           UUID;
    _organization_id   UUID;
    _team_id           UUID;
    _role_id           UUID;
    _trimmed_email     TEXT;
    _trimmed_name      TEXT;
    _trimmed_team_name TEXT;
BEGIN

    _trimmed_email = LOWER(TRIM((_body ->> 'email')));
    _trimmed_name = TRIM((_body ->> 'name'));
    _trimmed_team_name = TRIM((_body ->> 'team_name'));

    -- check user exists
    IF EXISTS(SELECT email FROM users WHERE email = _trimmed_email)
    THEN
        RAISE 'EMAIL_EXISTS_ERROR:%', (_body ->> 'email');
    END IF;

    -- insert user
    INSERT INTO users (name, email, password, timezone_id)
    VALUES (_trimmed_name, _trimmed_email, (_body ->> 'password'),
            COALESCE((SELECT id FROM timezones WHERE name = (_body ->> 'timezone')),
                     (SELECT id FROM timezones WHERE name = 'UTC')))
    RETURNING id INTO _user_id;

    --insert organization data
    INSERT INTO organizations (user_id, organization_name, contact_number, contact_number_secondary, trial_in_progress,
                               trial_expire_date, subscription_status, license_type_id)
    VALUES (_user_id, TRIM((_body ->> 'team_name')::TEXT), NULL, NULL, TRUE, CURRENT_DATE + INTERVAL '9999 days',
            'active', (SELECT id FROM sys_license_types WHERE key = 'SELF_HOSTED'))
    RETURNING id INTO _organization_id;


    -- insert team
    INSERT INTO teams (name, user_id, organization_id)
    VALUES (_trimmed_team_name, _user_id, _organization_id)
    RETURNING id INTO _team_id;

    IF (is_null_or_empty((_body ->> 'invited_team_id')))
    THEN
        UPDATE users SET active_team = _team_id WHERE id = _user_id;
    ELSE
        IF NOT EXISTS(SELECT id
                      FROM email_invitations
                      WHERE team_id = (_body ->> 'invited_team_id')::UUID
                        AND email = _trimmed_email)
        THEN
            RAISE 'ERROR_INVALID_JOINING_EMAIL';
        END IF;
        UPDATE users SET active_team = (_body ->> 'invited_team_id')::UUID WHERE id = _user_id;
    END IF;

    -- insert default roles
    INSERT INTO roles (name, team_id, default_role) VALUES ('Member', _team_id, TRUE);
    INSERT INTO roles (name, team_id, admin_role) VALUES ('Admin', _team_id, TRUE);
    INSERT INTO roles (name, team_id, owner) VALUES ('Owner', _team_id, TRUE) RETURNING id INTO _role_id;

    -- insert team member
    INSERT INTO team_members (user_id, team_id, role_id)
    VALUES (_user_id, _team_id, _role_id);

    -- update team member table with user id
    IF (_body ->> 'team_member_id') IS NOT NULL
    THEN
        UPDATE team_members SET user_id = (_user_id)::UUID WHERE id = (_body ->> 'team_member_id')::UUID;
        DELETE
        FROM email_invitations
        WHERE email = _trimmed_email
          AND team_member_id = (_body ->> 'team_member_id')::UUID;
    END IF;

    RETURN JSON_BUILD_OBJECT(
            'id', _user_id,
            'name', _trimmed_name,
            'email', _trimmed_email,
            'team_id', _team_id
           );
END;
$$;


ALTER FUNCTION public.register_user(_body json) OWNER TO postgres;

--
-- Name: remove_project_member(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.remove_project_member(_id uuid, _user_id uuid, _team_id uuid) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _team_member_id UUID;
    _project_id     UUID;
    _member_user_id UUID;
    _notification   TEXT;
BEGIN
    SELECT project_id FROM project_members WHERE id = _id INTO _project_id;
    SELECT team_member_id FROM project_members WHERE id = _id INTO _team_member_id;
    SELECT user_id FROM team_members WHERE id = _team_member_id INTO _member_user_id;
    DELETE FROM project_members WHERE id = _id;
    DELETE FROM project_member_allocations WHERE project_id = _project_id AND team_member_id = _team_member_id;

    IF (_member_user_id != _user_id)
    THEN
        _notification =
            CONCAT('You have been removed from the <b>', (SELECT name FROM projects WHERE id = _project_id),
                   '</b> by <b>',
                   (SELECT name FROM users WHERE id = _user_id), '</b>');
        PERFORM create_notification(
            (SELECT user_id FROM team_members WHERE id = _team_member_id),
            _team_id,
            NULL,
            _project_id,
            _notification
            );
    END IF;

    RETURN JSON_BUILD_OBJECT(
        'id', _id,
        'notification', _notification,
        'socket_id', (SELECT socket_id FROM users WHERE id = _member_user_id),
        'project', (SELECT name FROM projects WHERE id = _project_id),
        'project_id', _project_id,
        'project_color', (SELECT color_code FROM projects WHERE id = _project_id),
        'team', (SELECT name FROM teams WHERE id = _team_id),
        'member_user_id', _member_user_id
        );
END;
$$;


ALTER FUNCTION public.remove_project_member(_id uuid, _user_id uuid, _team_id uuid) OWNER TO postgres;

--
-- Name: remove_task_assignee(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.remove_task_assignee(_task_id uuid, _team_member_id uuid, _project_id uuid) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _team_id UUID;
    _user_id UUID;
BEGIN

    SELECT team_id FROM team_members WHERE id = _team_member_id INTO _team_id;
    SELECT user_id FROM team_members WHERE id = _team_member_id INTO _user_id;

    DELETE
    FROM tasks_assignees
    WHERE task_id = _task_id
      AND project_member_id =
          (SELECT id FROM project_members WHERE team_member_id = _team_member_id AND project_id = _project_id);

    RETURN JSON_BUILD_OBJECT(
        'user_id', _user_id,
        'team_id', _team_id
        );
END
$$;


ALTER FUNCTION public.remove_task_assignee(_task_id uuid, _team_member_id uuid, _project_id uuid) OWNER TO postgres;

--
-- Name: remove_team_member(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.remove_team_member(_id uuid, _user_id uuid, _team_id uuid) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _removed_user_id   UUID;
    _removed_team_name TEXT;
BEGIN
    SELECT user_id FROM team_members WHERE id = _id INTO _removed_user_id;
    SELECT name FROM teams WHERE id = _team_id INTO _removed_team_name;

    UPDATE users
    SET active_team = (SELECT id FROM teams WHERE user_id = _removed_user_id LIMIT 1)
    WHERE active_team = _team_id
      AND id = _removed_user_id;

    PERFORM create_notification(
        _removed_user_id,
        _team_id,
        NULL,
        NULL,
        CONCAT('You have been removed from <b>', (SELECT name FROM teams WHERE id = _team_id), '</b> by <b>',
               (SELECT name FROM users WHERE id = _user_id), '</b>')
        );

    DELETE FROM team_members WHERE id = _id AND team_id = _team_id;

    RETURN JSON_BUILD_OBJECT(
        'id', _removed_user_id,
        'team', _removed_team_name,
        'socket_id', (SELECT socket_id FROM users WHERE id = _user_id)
        );
END;
$$;


ALTER FUNCTION public.remove_team_member(_id uuid, _user_id uuid, _team_id uuid) OWNER TO postgres;

--
-- Name: resend_team_invitation(json); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.resend_team_invitation(_body json) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _id      UUID;
    _team_id UUID;
    _user_id UUID;
    _email   TEXT;
    _output  JSON;
BEGIN
    _team_id = (_body ->> 'team_id')::UUID;
    _id = (_body ->> 'id')::UUID;

    SELECT email FROM email_invitations WHERE team_member_id = _id AND team_id = _team_id INTO _email;
    SELECT id FROM users WHERE email = _email INTO _user_id;

    IF is_null_or_empty(_email) IS FALSE
    THEN
        DELETE FROM email_invitations WHERE team_id = _team_id AND team_member_id = _id;
    END IF;

    INSERT INTO email_invitations(team_id, team_member_id, email, name)
    VALUES (_team_id, _id, _email, SPLIT_PART(_email, '@', 1));

    SELECT JSON_BUILD_OBJECT(
               'name', (SELECT name FROM users WHERE id = _user_id),
               'email', _email,
               'is_new', is_null_or_empty(_user_id),
               'team_member_id', _id,
               'team_member_user_id', _user_id
               )
    INTO _output;

    RETURN _output;
END;
$$;


ALTER FUNCTION public.resend_team_invitation(_body json) OWNER TO postgres;

--
-- Name: reset_parent_task_manual_progress(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.reset_parent_task_manual_progress() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- When a task gets a new subtask (parent_task_id is set), reset the parent's manual_progress flag
    IF NEW.parent_task_id IS NOT NULL THEN
        UPDATE tasks 
        SET manual_progress = false
        WHERE id = NEW.parent_task_id 
        AND manual_progress = true;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.reset_parent_task_manual_progress() OWNER TO postgres;

--
-- Name: reset_project_progress_values(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.reset_project_progress_values() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    _old_mode   VARCHAR(20);
    _new_mode   VARCHAR(20);
    _project_id UUID;
BEGIN
    _project_id := NEW.id;

    -- Determine old and new modes
    _old_mode :=
            CASE
                WHEN OLD.use_manual_progress IS TRUE THEN 'manual'
                WHEN OLD.use_weighted_progress IS TRUE THEN 'weighted'
                WHEN OLD.use_time_progress IS TRUE THEN 'time'
                ELSE 'default'
                END;

    _new_mode :=
            CASE
                WHEN NEW.use_manual_progress IS TRUE THEN 'manual'
                WHEN NEW.use_weighted_progress IS TRUE THEN 'weighted'
                WHEN NEW.use_time_progress IS TRUE THEN 'time'
                ELSE 'default'
                END;

    -- If mode has changed, reset progress values for tasks with the old mode
    IF _old_mode <> _new_mode
    THEN
        -- Reset progress values for tasks that were set in the old mode
        UPDATE tasks
        SET progress_value = NULL,
            progress_mode  = NULL
        WHERE project_id = _project_id
          AND progress_mode = _old_mode;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION public.reset_project_progress_values() OWNER TO postgres;

--
-- Name: set_active_team(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_active_team(_user_id uuid, _team_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
BEGIN
    IF EXISTS(SELECT id FROM team_members WHERE team_id = _team_id AND user_id = _user_id)
    THEN
        UPDATE users SET active_team = _team_id WHERE id = _user_id;
    ELSE
        UPDATE users SET active_team = (SELECT id FROM teams WHERE user_id = users.id LIMIT 1) WHERE id = _user_id;
    END IF;
END;
$$;


ALTER FUNCTION public.set_active_team(_user_id uuid, _team_id uuid) OWNER TO postgres;

--
-- Name: set_active_team_by_member_id(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_active_team_by_member_id(_team_member_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
BEGIN
    PERFORM set_active_team(
        (SELECT user_id FROM team_members WHERE id = _team_member_id),
        (SELECT team_id FROM team_members WHERE id = _team_member_id)
        );
END;
$$;


ALTER FUNCTION public.set_active_team_by_member_id(_team_member_id uuid) OWNER TO postgres;

--
-- Name: set_task_updated_at_trigger_fn(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_task_updated_at_trigger_fn() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END
$$;


ALTER FUNCTION public.set_task_updated_at_trigger_fn() OWNER TO postgres;

--
-- Name: slugify(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.slugify(value text) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    AS $_$
    -- removes accents (diacritic signs) from a given string --
WITH "unaccented" AS (SELECT unaccent("value") AS "value"),
     -- lowercase the string
     "lowercase" AS (SELECT LOWER("value") AS "value"
                     FROM "unaccented"),
     -- replaces anything that's not a letter, number, hyphen('-'), or underscore('_') with a hyphen('-')
     "hyphenated" AS (SELECT REGEXP_REPLACE("value", '[^a-z0-9\\-_.''`"]+', '-', 'gi') AS "value"
                      FROM "lowercase"),
     -- trims hyphens('-') if they exist on the head or tail of the string
     "trimmed" AS (SELECT REGEXP_REPLACE(REGEXP_REPLACE("value", '\\-+$', ''), '^\\-', '') AS "value"
                   FROM "hyphenated")
SELECT "value"
FROM "trimmed";
$_$;


ALTER FUNCTION public.slugify(value text) OWNER TO postgres;

--
-- Name: sys_insert_project_templates(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.sys_insert_project_templates() RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    medium_priority_id UUID;
    todo_category_id UUID;
    doing_category_id UUID;
    done_category_id UUID;
BEGIN
    -- Fetch IDs to avoid repeated subqueries
    SELECT id INTO medium_priority_id FROM task_priorities WHERE name = 'Medium' LIMIT 1;
    SELECT id INTO todo_category_id FROM public.sys_task_status_categories WHERE name = 'To do' LIMIT 1;
    SELECT id INTO doing_category_id FROM public.sys_task_status_categories WHERE name = 'Doing' LIMIT 1;
    SELECT id INTO done_category_id FROM public.sys_task_status_categories WHERE name = 'Done' LIMIT 1;

    INSERT INTO public.pt_project_templates (id, name, key, description, phase_label, image_url, color_code)
    VALUES  ('39db59be-1dba-448b-87f4-3b955ea699d2', 'Bug Tracking', 'BT', 'The "Bug Tracking" project template is a versatile solution meticulously designed to streamline and enhance the bug management processes of businesses across diverse industries. This template is especially valuable for organizations that rely on software development, IT services, or digital product management. It provides a structured and efficient approach to tracking, resolving, and improving software issues.', 'Phase', 'https://worklenz.s3.amazonaws.com/project-template-gifs/bug-tracking.gif', '#3b7ad4');

    INSERT INTO public.pt_statuses (id, name, template_id, category_id)
    VALUES  ('c3242606-5a24-48aa-8320-cc90a05c2589', 'To Do', '39db59be-1dba-448b-87f4-3b955ea699d2', todo_category_id),
            ('05ed8d04-92b1-4c44-bd06-abee29641f31', 'Doing', '39db59be-1dba-448b-87f4-3b955ea699d2', doing_category_id),
            ('66e80bc8-6b29-4e72-a484-1593eb1fb44b', 'Done', '39db59be-1dba-448b-87f4-3b955ea699d2', done_category_id);

    INSERT INTO public.pt_tasks (id, name, description, total_minutes, sort_order, priority_id, template_id, parent_task_id, status_id)
    VALUES  ('a75993d9-3fb3-4d0b-a5d4-cab53b60462c', 'Testing and Verification', NULL, 0, 0, medium_priority_id, '39db59be-1dba-448b-87f4-3b955ea699d2', NULL, 'c3242606-5a24-48aa-8320-cc90a05c2589'),
            ('3fdb6801-bc09-4d71-8273-987cd3d1e0f6', 'Bug Prioritization', NULL, 0, 6, medium_priority_id, '39db59be-1dba-448b-87f4-3b955ea699d2', NULL, '05ed8d04-92b1-4c44-bd06-abee29641f31'),
            ('ca64f247-a186-4edb-affd-738f1c2a4d60', 'Bug reporting', NULL, 0, 2, medium_priority_id, '39db59be-1dba-448b-87f4-3b955ea699d2', NULL, 'c3242606-5a24-48aa-8320-cc90a05c2589'),
            ('1e493de8-38cf-4e6e-8f0b-5e1f6f3b07f4', 'Bug Assignment', NULL, 0, 5, medium_priority_id, '39db59be-1dba-448b-87f4-3b955ea699d2', NULL, '05ed8d04-92b1-4c44-bd06-abee29641f31'),
            ('67b2ab3c-53e5-428c-bbad-8bdc19dc88de', 'Bug Closure', NULL, 0, 4, medium_priority_id, '39db59be-1dba-448b-87f4-3b955ea699d2', NULL, '66e80bc8-6b29-4e72-a484-1593eb1fb44b'),
            ('9311ff84-1052-4989-8192-0fea20204fbe', 'Documentation', NULL, 0, 3, medium_priority_id, '39db59be-1dba-448b-87f4-3b955ea699d2', NULL, '66e80bc8-6b29-4e72-a484-1593eb1fb44b'),
            ('7d0697cd-868c-4b41-9f4f-f9a8c1131b24', 'Reporting', NULL, 0, 1, medium_priority_id, '39db59be-1dba-448b-87f4-3b955ea699d2', NULL, '66e80bc8-6b29-4e72-a484-1593eb1fb44b');

    INSERT INTO public.pt_task_phases (task_id, phase_id)
    VALUES  ('a75993d9-3fb3-4d0b-a5d4-cab53b60462c', '4b4a8fe0-4f35-464a-a337-848e5b432ab5'),
            ('3fdb6801-bc09-4d71-8273-987cd3d1e0f6', '557b58ca-3335-4b41-9880-fdd0f990deb9'),
            ('ca64f247-a186-4edb-affd-738f1c2a4d60', '62097027-979f-4b00-afb8-f70fba533f80'),
            ('1e493de8-38cf-4e6e-8f0b-5e1f6f3b07f4', 'e3128891-4873-4795-ad8a-880474280045'),
            ('67b2ab3c-53e5-428c-bbad-8bdc19dc88de', '77204bf3-fcb3-4e39-a843-14458b2f659d'),
            ('9311ff84-1052-4989-8192-0fea20204fbe', '62097027-979f-4b00-afb8-f70fba533f80'),
            ('7d0697cd-868c-4b41-9f4f-f9a8c1131b24', '62097027-979f-4b00-afb8-f70fba533f80');
END;
$$;


ALTER FUNCTION public.sys_insert_project_templates() OWNER TO postgres;

--
-- Name: task_status_change_trigger_fn(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.task_status_change_trigger_fn() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
BEGIN
    IF EXISTS(SELECT 1
              FROM sys_task_status_categories
              WHERE id = (SELECT category_id FROM task_statuses WHERE id = NEW.status_id)
                AND is_done IS TRUE)
    THEN
        UPDATE tasks SET completed_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    ELSE
        UPDATE tasks SET completed_at = NULL WHERE id = NEW.id;
    END IF;

    RETURN NEW;
END
$$;


ALTER FUNCTION public.task_status_change_trigger_fn() OWNER TO postgres;

--
-- Name: tasks_task_subscriber_notify_done_trigger(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.tasks_task_subscriber_notify_done_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
BEGIN
    IF (EXISTS(SELECT 1
               FROM sys_task_status_categories
               WHERE id = (SELECT category_id FROM task_statuses WHERE id = NEW.status_id)
                 AND is_done IS TRUE))
    THEN
        PERFORM pg_notify('db_task_status_changed', NEW.id::TEXT);
    END IF;

    RETURN NEW;
END
$$;


ALTER FUNCTION public.tasks_task_subscriber_notify_done_trigger() OWNER TO postgres;

--
-- Name: to_seconds(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.to_seconds(t text) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    hs INTEGER;
    ms INTEGER;
    s  INTEGER;
BEGIN
    SELECT (EXTRACT(HOUR FROM t::TIME) * 60 * 60) INTO hs;
    SELECT (EXTRACT(MINUTES FROM t::TIME) * 60) INTO ms;
    SELECT (EXTRACT(SECONDS FROM t::TIME)) INTO s;
    SELECT (hs + ms + s) INTO s;
    RETURN s;
END;
$$;


ALTER FUNCTION public.to_seconds(t text) OWNER TO postgres;

--
-- Name: toggle_archive_all_projects(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.toggle_archive_all_projects(_project_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    _user_id UUID;

BEGIN
    IF EXISTS(SELECT project_id FROM archived_projects WHERE project_id = _project_id)
    THEN
        DELETE FROM archived_projects WHERE project_id = _project_id;
    ELSE
        FOR _user_id IN
            SELECT user_id FROM team_members WHERE team_id = (SELECT team_id FROM projects WHERE id = _project_id)
            LOOP
                IF NOT (is_null_or_empty(_user_id))
                THEN
                    INSERT INTO archived_projects (user_id, project_id)
                    VALUES (_user_id, _project_id);
                END IF;
            END LOOP;
    END IF;
END
$$;


ALTER FUNCTION public.toggle_archive_all_projects(_project_id uuid) OWNER TO postgres;

--
-- Name: toggle_archive_project(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.toggle_archive_project(_user_id uuid, _project_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
BEGIN
    IF EXISTS(SELECT user_id FROM archived_projects WHERE user_id = _user_id AND project_id = _project_id)
    THEN
        DELETE FROM archived_projects WHERE user_id = _user_id AND project_id = _project_id;
    ELSE
        INSERT INTO archived_projects (user_id, project_id) VALUES (_user_id, _project_id);
    END IF;
END
$$;


ALTER FUNCTION public.toggle_archive_project(_user_id uuid, _project_id uuid) OWNER TO postgres;

--
-- Name: toggle_favorite_project(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.toggle_favorite_project(_user_id uuid, _project_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
BEGIN
    IF EXISTS(SELECT user_id FROM favorite_projects WHERE user_id = _user_id AND project_id = _project_id)
    THEN
        DELETE FROM favorite_projects WHERE user_id = _user_id AND project_id = _project_id;
    ELSE
        INSERT INTO favorite_projects (user_id, project_id) VALUES (_user_id, _project_id);
    END IF;
END
$$;


ALTER FUNCTION public.toggle_favorite_project(_user_id uuid, _project_id uuid) OWNER TO postgres;

--
-- Name: transfer_team_ownership(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.transfer_team_ownership(_team_id uuid, _new_owner_id uuid) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _old_owner_id UUID;
    _owner_role_id UUID;
    _admin_role_id UUID;
    _old_org_id UUID;
    _new_org_id UUID;
    _has_license BOOLEAN;
    _old_owner_role_id UUID;
    _new_owner_role_id UUID;
    _has_active_coupon BOOLEAN;
    _other_teams_count INTEGER;
    _new_owner_org_id UUID;
    _license_type_id UUID;
    _has_valid_license BOOLEAN;
BEGIN
    -- Get the current owner's ID and organization
    SELECT t.user_id, t.organization_id 
    INTO _old_owner_id, _old_org_id 
    FROM teams t 
    WHERE t.id = _team_id;
    
    IF _old_owner_id IS NULL THEN
        RAISE EXCEPTION 'Team not found';
    END IF;

    -- Get the new owner's organization
    SELECT organization_id INTO _new_owner_org_id
    FROM organizations
    WHERE user_id = _new_owner_id;

    -- Get the old organization
    SELECT id INTO _old_org_id
    FROM organizations
    WHERE id = _old_org_id;

    IF _old_org_id IS NULL THEN
        RAISE EXCEPTION 'Organization not found';
    END IF;

    -- Check if new owner has any valid license type
    SELECT EXISTS (
        SELECT 1 
        FROM (
            -- Check regular subscriptions
            SELECT lus.user_id, lus.status, lus.active
            FROM licensing_user_subscriptions lus
            WHERE lus.user_id = _new_owner_id 
            AND lus.active = TRUE
            AND lus.status IN ('active', 'trialing')
            
            UNION ALL
            
            -- Check custom subscriptions
            SELECT lcs.user_id, lcs.subscription_status as status, TRUE as active
            FROM licensing_custom_subs lcs
            WHERE lcs.user_id = _new_owner_id
            AND lcs.end_date > CURRENT_DATE
            
            UNION ALL
            
            -- Check trial status in organizations
            SELECT o.user_id, o.subscription_status as status, TRUE as active
            FROM organizations o
            WHERE o.user_id = _new_owner_id
            AND o.trial_in_progress = TRUE
            AND o.trial_expire_date > CURRENT_DATE
        ) valid_licenses
    ) INTO _has_valid_license;

    IF NOT _has_valid_license THEN
        RAISE EXCEPTION 'New owner does not have a valid license (subscription, custom subscription, or trial)';
    END IF;

    -- Check if new owner has any active coupon codes
    SELECT EXISTS (
        SELECT 1 
        FROM licensing_coupon_codes lcc
        WHERE lcc.redeemed_by = _new_owner_id 
        AND lcc.is_redeemed = TRUE
        AND lcc.is_refunded = FALSE
    ) INTO _has_active_coupon;

    IF _has_active_coupon THEN
        RAISE EXCEPTION 'New owner has active coupon codes that need to be handled before transfer';
    END IF;

    -- Count other teams in the organization for information purposes
    SELECT COUNT(*) INTO _other_teams_count
    FROM teams
    WHERE organization_id = _old_org_id
    AND id != _team_id;

    -- If new owner has their own organization, move the team to their organization
    IF _new_owner_org_id IS NOT NULL THEN
        -- Update the team to use the new owner's organization
        UPDATE teams 
        SET user_id = _new_owner_id,
            organization_id = _new_owner_org_id
        WHERE id = _team_id;
        
        -- Create notification about organization change
        PERFORM create_notification(
            _old_owner_id,
            _team_id,
            NULL,
            NULL,
            CONCAT('Team <b>', (SELECT name FROM teams WHERE id = _team_id), '</b> has been moved to a different organization')
        );

        PERFORM create_notification(
            _new_owner_id,
            _team_id,
            NULL,
            NULL,
            CONCAT('Team <b>', (SELECT name FROM teams WHERE id = _team_id), '</b> has been moved to your organization')
        );
    ELSE
        -- If new owner doesn't have an organization, transfer the old organization to them
        UPDATE organizations
        SET user_id = _new_owner_id
        WHERE id = _old_org_id;
        
        -- Update the team to use the same organization
        UPDATE teams 
        SET user_id = _new_owner_id,
            organization_id = _old_org_id
        WHERE id = _team_id;

        -- Notify both users about organization ownership transfer
        PERFORM create_notification(
            _old_owner_id,
            NULL,
            NULL,
            NULL,
            CONCAT('You are no longer the owner of organization <b>', (SELECT organization_name FROM organizations WHERE id = _old_org_id), '</b>')
        );

        PERFORM create_notification(
            _new_owner_id,
            NULL,
            NULL,
            NULL,
            CONCAT('You are now the owner of organization <b>', (SELECT organization_name FROM organizations WHERE id = _old_org_id), '</b>')
        );
    END IF;
    
    -- Get the owner and admin role IDs
    SELECT id INTO _owner_role_id FROM roles WHERE team_id = _team_id AND owner = TRUE;
    SELECT id INTO _admin_role_id FROM roles WHERE team_id = _team_id AND admin_role = TRUE;

    -- Get current role IDs for both users
    SELECT role_id INTO _old_owner_role_id 
    FROM team_members 
    WHERE team_id = _team_id AND user_id = _old_owner_id;

    SELECT role_id INTO _new_owner_role_id 
    FROM team_members 
    WHERE team_id = _team_id AND user_id = _new_owner_id;
    
    -- Update the old owner's role to admin if they want to stay in the team
    IF _old_owner_role_id IS NOT NULL THEN
        UPDATE team_members 
        SET role_id = _admin_role_id 
        WHERE team_id = _team_id AND user_id = _old_owner_id;
    END IF;
    
    -- Update the new owner's role to owner
    IF _new_owner_role_id IS NOT NULL THEN
        UPDATE team_members 
        SET role_id = _owner_role_id 
        WHERE team_id = _team_id AND user_id = _new_owner_id;
    ELSE
        -- If new owner is not a team member yet, add them
        INSERT INTO team_members (user_id, team_id, role_id)
        VALUES (_new_owner_id, _team_id, _owner_role_id);
    END IF;

    -- Create notification for both users about team ownership
    PERFORM create_notification(
        _old_owner_id,
        _team_id,
        NULL,
        NULL,
        CONCAT('You are no longer the owner of team <b>', (SELECT name FROM teams WHERE id = _team_id), '</b>')
    );

    PERFORM create_notification(
        _new_owner_id,
        _team_id,
        NULL,
        NULL,
        CONCAT('You are now the owner of team <b>', (SELECT name FROM teams WHERE id = _team_id), '</b>')
    );
    
    RETURN json_build_object(
        'success', TRUE,
        'old_owner_id', _old_owner_id,
        'new_owner_id', _new_owner_id,
        'team_id', _team_id,
        'old_org_id', _old_org_id,
        'new_org_id', COALESCE(_new_owner_org_id, _old_org_id),
        'old_role_id', _old_owner_role_id,
        'new_role_id', _new_owner_role_id,
        'has_valid_license', _has_valid_license,
        'has_active_coupon', _has_active_coupon,
        'other_teams_count', _other_teams_count,
        'org_ownership_transferred', _new_owner_org_id IS NULL,
        'team_moved_to_new_org', _new_owner_org_id IS NOT NULL
    );
END;
$$;


ALTER FUNCTION public.transfer_team_ownership(_team_id uuid, _new_owner_id uuid) OWNER TO postgres;

--
-- Name: update_existing_phase_colors(json); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_existing_phase_colors(_body json) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    result         JSON;
    _phase         JSON;
BEGIN

    FOR _phase IN SELECT * FROM JSON_ARRAY_ELEMENTS((_body ->> 'phases')::JSON)
        LOOP
            UPDATE project_phases SET color_code = (_phase ->> 'color_code')::WL_HEX_COLOR WHERE id = (_phase ->> 'id')::UUID;
        END LOOP;

    SELECT ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec)))
    FROM (SELECT * FROM project_phases) rec
    INTO result;

    RETURN result;
END;
$$;


ALTER FUNCTION public.update_existing_phase_colors(_body json) OWNER TO postgres;

--
-- Name: update_existing_phase_sort_order(json); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_existing_phase_sort_order(_body json) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    result         JSON;
    _phase         JSON;
BEGIN

    FOR _phase IN SELECT * FROM JSON_ARRAY_ELEMENTS((_body ->> 'phases')::JSON)
        LOOP
            UPDATE project_phases SET sort_index = (_phase ->> 'sort_number')::INT WHERE id = (_phase ->> 'id')::UUID AND project_id = (_phase ->> 'project_id')::UUID;
        END LOOP;

    SELECT ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec)))
    FROM (SELECT * FROM project_phases) rec
    INTO result;

    RETURN result;
END;
$$;


ALTER FUNCTION public.update_existing_phase_sort_order(_body json) OWNER TO postgres;

--
-- Name: update_parent_task_progress(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_parent_task_progress() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    _parent_task_id UUID;
    _project_id UUID;
    _ratio FLOAT;
BEGIN
    -- Check if this is a subtask
    IF NEW.parent_task_id IS NOT NULL THEN
        _parent_task_id := NEW.parent_task_id;
        
        -- Force any parent task with subtasks to NOT use manual progress
        UPDATE tasks
        SET manual_progress = FALSE
        WHERE id = _parent_task_id;
        
        -- Calculate and update the parent's progress value
        SELECT (get_task_complete_ratio(_parent_task_id)->>'ratio')::FLOAT INTO _ratio;
        
        -- Update the parent's progress value
        UPDATE tasks
        SET progress_value = _ratio
        WHERE id = _parent_task_id;
        
        -- Recursively propagate changes up the hierarchy by using a recursive CTE
        WITH RECURSIVE task_hierarchy AS (
            -- Base case: Start with the parent task
            SELECT 
                id,
                parent_task_id
            FROM tasks
            WHERE id = _parent_task_id
            
            UNION ALL
            
            -- Recursive case: Go up to each ancestor
            SELECT 
                t.id,
                t.parent_task_id
            FROM tasks t
            JOIN task_hierarchy th ON t.id = th.parent_task_id
            WHERE t.id IS NOT NULL
        )
        -- For each ancestor, recalculate its progress
        UPDATE tasks
        SET 
            manual_progress = FALSE,
            progress_value = (SELECT (get_task_complete_ratio(task_hierarchy.id)->>'ratio')::FLOAT)
        FROM task_hierarchy
        WHERE tasks.id = task_hierarchy.id
        AND task_hierarchy.parent_task_id IS NOT NULL;
        
        -- Log the recalculation for debugging
        RAISE NOTICE 'Updated progress for task % to %', _parent_task_id, _ratio;
    END IF;
    
    -- If this task has progress value of 100 and doesn't have subtasks, we might want to prompt the user
    -- to mark it as done. We'll annotate this in a way that the socket handler can detect.
    IF NEW.progress_value = 100 OR NEW.weight = 100 OR NEW.total_minutes > 0 THEN
        -- Check if task has status in "done" category
        SELECT project_id FROM tasks WHERE id = NEW.id INTO _project_id;
        
        -- Get the progress ratio for this task
        SELECT (get_task_complete_ratio(NEW.id)->>'ratio')::FLOAT INTO _ratio;
        
        IF _ratio >= 100 THEN
            -- Log that this task is at 100% progress
            RAISE NOTICE 'Task % progress is at 100%%, may need status update', NEW.id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_parent_task_progress() OWNER TO postgres;

--
-- Name: FUNCTION update_parent_task_progress(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.update_parent_task_progress() IS 'This function recursively updates progress values for all ancestors when a task''s progress changes.
The previous version only updated the immediate parent, which led to incorrect progress values for
higher-level parent tasks when using weighted or manual progress calculations with multi-level subtasks.';


--
-- Name: update_phase_name(uuid, text, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_phase_name(_phase_id uuid, _phase_name text, _template_id uuid) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _color_code TEXT;
BEGIN
    IF EXISTS(SELECT name
              FROM cpt_phases
              WHERE name = _phase_name
                AND template_id = _template_id)
    THEN
        RAISE 'PHASE_EXISTS_ERROR:%', _phase_name::TEXT;
    END IF;
    UPDATE cpt_phases
    SET name = _phase_name
    WHERE id = _phase_id
      AND template_id = _template_id
    RETURNING color_code INTO _color_code;

    RETURN JSON_BUILD_OBJECT(
            'color_code', _color_code,
            'id', _phase_id,
            'name', _phase_name
        );
END
$$;


ALTER FUNCTION public.update_phase_name(_phase_id uuid, _phase_name text, _template_id uuid) OWNER TO postgres;

--
-- Name: update_project(json); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_project(_body json) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _user_id                        UUID;
    _team_id                        UUID;
    _client_id                      UUID;
    _project_id                     UUID;
    _project_manager_team_member_id UUID;
    _client_name                    TEXT;
    _project_name                   TEXT;
BEGIN
    -- need a test, can be throw errors
    _client_name = TRIM((_body ->> 'client_name')::TEXT);
    _project_name = TRIM((_body ->> 'name')::TEXT);

    -- add inside the controller
    _user_id = (_body ->> 'user_id')::UUID;
    _team_id = (_body ->> 'team_id')::UUID;
    _project_manager_team_member_id = (_body ->> 'team_member_id')::UUID;

    -- cache exists client if exists
    SELECT id FROM clients WHERE LOWER(name) = LOWER(_client_name) AND team_id = _team_id INTO _client_id;

    -- insert client if not exists
    IF is_null_or_empty(_client_id) IS TRUE AND is_null_or_empty(_client_name) IS FALSE
    THEN
        INSERT INTO clients (name, team_id) VALUES (_client_name, _team_id) RETURNING id INTO _client_id;
    END IF;

    -- check whether the project name is already in
    IF EXISTS(
        SELECT name FROM projects WHERE LOWER(name) = LOWER(_project_name)
                                    AND team_id = _team_id AND id != (_body ->> 'id')::UUID
    )
    THEN
        RAISE 'PROJECT_EXISTS_ERROR:%', _project_name;
    END IF;

    -- update the project
    UPDATE projects
    SET name                   = _project_name,
        notes                  = (_body ->> 'notes')::TEXT,
        color_code             = (_body ->> 'color_code')::TEXT,
        status_id              = (_body ->> 'status_id')::UUID,
        health_id              = (_body ->> 'health_id')::UUID,
        key                    = (_body ->> 'key')::TEXT,
        start_date             = (_body ->> 'start_date')::TIMESTAMPTZ,
        end_date               = (_body ->> 'end_date')::TIMESTAMPTZ,
        client_id              = _client_id,
        folder_id              = (_body ->> 'folder_id')::UUID,
        category_id            = (_body ->> 'category_id')::UUID,
        updated_at             = CURRENT_TIMESTAMP,
        estimated_working_days = (_body ->> 'working_days')::INTEGER,
        estimated_man_days     = (_body ->> 'man_days')::INTEGER,
        hours_per_day          = (_body ->> 'hours_per_day')::INTEGER,
        use_manual_progress    = COALESCE((_body ->> 'use_manual_progress')::BOOLEAN, FALSE),
        use_weighted_progress  = COALESCE((_body ->> 'use_weighted_progress')::BOOLEAN, FALSE),
        use_time_progress      = COALESCE((_body ->> 'use_time_progress')::BOOLEAN, FALSE)
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


ALTER FUNCTION public.update_project(_body json) OWNER TO postgres;

--
-- Name: update_project_manager(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_project_manager(_team_member_id uuid, _project_id uuid) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _project_member_id UUID;
    _team_id           UUID;
    _user_id           UUID;
    _project_member    JSON;
BEGIN

    SELECT id
    FROM project_members
    WHERE team_member_id = _team_member_id
      AND project_id = _project_id
    INTO _project_member_id;

    SELECT team_id FROM team_members WHERE id = _team_member_id INTO _team_id;
    SELECT user_id FROM team_members WHERE id = _team_member_id INTO _user_id;

    IF is_null_or_empty(_project_member_id)
    THEN
        SELECT create_project_member(JSON_BUILD_OBJECT(
                'team_member_id', _team_member_id,
                'team_id', _team_id,
                'project_id', _project_id,
                'user_id', _user_id,
                'access_level', 'PROJECT_MANAGER'::TEXT
            ))
        INTO _project_member;
    END IF;

    UPDATE project_members SET project_access_level_id = (SELECT id FROM project_access_levels WHERE key = 'PROJECT_MANAGER') WHERE id = _project_member_id AND project_id = _project_id;

    RETURN JSON_BUILD_OBJECT(
            'project_member_id', _project_member_id,
            'team_member_id', _team_member_id,
            'team_id', _team_id,
            'user_id', _user_id
        );
END
$$;


ALTER FUNCTION public.update_project_manager(_team_member_id uuid, _project_id uuid) OWNER TO postgres;

--
-- Name: update_project_tasks_counter_trigger_fn(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_project_tasks_counter_trigger_fn() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
BEGIN

    UPDATE projects SET tasks_counter = (tasks_counter + 1) WHERE id = NEW.project_id;
    NEW.task_no = (SELECT tasks_counter FROM projects WHERE id = NEW.project_id);

    RETURN NEW;
END
$$;


ALTER FUNCTION public.update_project_tasks_counter_trigger_fn() OWNER TO postgres;

--
-- Name: update_status_order(json); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_status_order(_status_ids json) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    _iterator  NUMERIC := 0;
    _status_id TEXT;
    _project_id UUID;
    _base_sort_order NUMERIC;
BEGIN
    -- Get the project_id from the first status to ensure we update all statuses in the same project
    SELECT project_id INTO _project_id
    FROM task_statuses 
    WHERE id = (SELECT TRIM(BOTH '"' FROM JSON_ARRAY_ELEMENTS(_status_ids)::TEXT) LIMIT 1)::UUID;

    -- Update the sort_order for statuses in the provided order
    FOR _status_id IN SELECT * FROM JSON_ARRAY_ELEMENTS((_status_ids)::JSON)
        LOOP
            UPDATE task_statuses
            SET sort_order = _iterator
            WHERE id = (SELECT TRIM(BOTH '"' FROM _status_id))::UUID;
            _iterator := _iterator + 1;
        END LOOP;

    -- Get the base sort order for remaining statuses (simple count approach)
    SELECT COUNT(*) INTO _base_sort_order
    FROM task_statuses ts2 
    WHERE ts2.project_id = _project_id 
    AND ts2.id = ANY(SELECT (TRIM(BOTH '"' FROM JSON_ARRAY_ELEMENTS(_status_ids)::TEXT))::UUID);

    -- Update remaining statuses with simple sequential numbering
    -- Reset iterator to start from base_sort_order
    _iterator := _base_sort_order;
    
    -- Use a cursor approach to avoid window functions
    FOR _status_id IN 
        SELECT id::TEXT FROM task_statuses 
        WHERE project_id = _project_id 
        AND id NOT IN (SELECT (TRIM(BOTH '"' FROM JSON_ARRAY_ELEMENTS(_status_ids)::TEXT))::UUID)
        ORDER BY sort_order
    LOOP
        UPDATE task_statuses 
        SET sort_order = _iterator
        WHERE id = _status_id::UUID;
        _iterator := _iterator + 1;
    END LOOP;

    RETURN;
END
$$;


ALTER FUNCTION public.update_status_order(_status_ids json) OWNER TO postgres;

--
-- Name: update_task(json); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_task(_body json) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _assignee      TEXT;
    _assignee_id   UUID;
    _label         JSON;
    _old_assignees JSON;
    _new_assignees JSON;
BEGIN
    UPDATE tasks
    SET name          = TRIM((_body ->> 'name')::TEXT),
        start_date    = (_body ->> 'start')::TIMESTAMPTZ,
        end_date      = (_body ->> 'end')::TIMESTAMPTZ,
        priority_id   = (_body ->> 'priority_id')::UUID,
        description   = COALESCE(TRIM((_body ->> 'description')::TEXT), description),
        total_minutes = (_body ->> 'total_minutes')::NUMERIC,
        status_id     = (_body ->> 'status_id')::UUID
    WHERE id = (_body ->> 'id')::UUID;

    SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
    INTO _old_assignees
    FROM (
             --
             SELECT team_member_id,
                    (SELECT user_id FROM team_members WHERE id = tasks_assignees.team_member_id),
                    (SELECT team_id FROM team_members WHERE id = tasks_assignees.team_member_id)
             FROM tasks_assignees
             WHERE task_id = (_body ->> 'id')::UUID
             --
         ) rec;

    -- delete existing task assignees
    DELETE FROM tasks_assignees WHERE task_id = (_body ->> 'id')::UUID;

    -- insert task assignees
    FOR _assignee IN SELECT * FROM JSON_ARRAY_ELEMENTS((_body ->> 'assignees')::JSON)
        LOOP
            _assignee_id = TRIM('"' FROM _assignee)::UUID;
            PERFORM create_task_assignee(_assignee_id, (_body ->> 'project_id')::UUID, (_body ->> 'id')::UUID,
                                         (_body ->> 'reporter_id')::UUID);
        END LOOP;

    IF ((_body ->> 'inline')::BOOLEAN IS FALSE)
    THEN
        DELETE FROM task_labels WHERE task_id = (_body ->> 'id')::UUID;
        FOR _label IN SELECT * FROM JSON_ARRAY_ELEMENTS((_body ->> 'labels')::JSON)
            LOOP
                PERFORM assign_or_create_label((_body ->> 'team_id')::UUID, (_body ->> 'id')::UUID,
                                               (_label ->> 'name')::TEXT,
                                               (_label ->> 'color')::TEXT);
            END LOOP;
    END IF;


    SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
    INTO _new_assignees
    FROM (
             --
             SELECT team_member_id,
                    (SELECT user_id FROM team_members WHERE id = tasks_assignees.team_member_id),
                    (SELECT team_id FROM team_members WHERE id = tasks_assignees.team_member_id)
             FROM tasks_assignees
             WHERE task_id = (_body ->> 'id')::UUID
             --
         ) rec;

    RETURN JSON_BUILD_OBJECT(
        'id', (_body ->> 'id')::UUID,
        'name', (_body ->> 'name')::TEXT,
        'old_assignees', _old_assignees,
        'new_assignees', _new_assignees
        );
END;
$$;


ALTER FUNCTION public.update_task(_body json) OWNER TO postgres;

--
-- Name: update_task_sort_orders_bulk(json); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_task_sort_orders_bulk(_updates json) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    _update_record RECORD;
BEGIN
    -- Simple approach: update each task's sort_order from the provided array
    FOR _update_record IN 
        SELECT 
            (item->>'task_id')::uuid as task_id,
            (item->>'sort_order')::int as sort_order,
            (item->>'status_id')::uuid as status_id,
            (item->>'priority_id')::uuid as priority_id,
            (item->>'phase_id')::uuid as phase_id
        FROM json_array_elements(_updates) as item
    LOOP
        UPDATE tasks 
        SET 
            sort_order = _update_record.sort_order,
            status_id = COALESCE(_update_record.status_id, status_id),
            priority_id = COALESCE(_update_record.priority_id, priority_id)
        WHERE id = _update_record.task_id;
        
        -- Handle phase updates separately since it's in a different table
        IF _update_record.phase_id IS NOT NULL THEN
            INSERT INTO task_phase (task_id, phase_id)
            VALUES (_update_record.task_id, _update_record.phase_id)
            ON CONFLICT (task_id) DO UPDATE SET phase_id = _update_record.phase_id;
        END IF;
    END LOOP;
END
$$;


ALTER FUNCTION public.update_task_sort_orders_bulk(_updates json) OWNER TO postgres;

--
-- Name: update_task_sort_orders_bulk(json, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_task_sort_orders_bulk(_updates json, _group_by text DEFAULT 'status'::text) RETURNS void
    LANGUAGE plpgsql
    AS $_$
DECLARE
    _update_record RECORD;
    _sort_column TEXT;
    _sql TEXT;
BEGIN
    -- Get the appropriate sort column based on grouping
    _sort_column := get_sort_column_name(_group_by);
    
    -- Process each update record
    FOR _update_record IN 
        SELECT 
            (item->>'task_id')::uuid as task_id,
            (item->>'sort_order')::int as sort_order,
            (item->>'status_id')::uuid as status_id,
            (item->>'priority_id')::uuid as priority_id,
            (item->>'phase_id')::uuid as phase_id
        FROM json_array_elements(_updates) as item
    LOOP
        -- Update the grouping-specific sort column and other fields
        _sql := 'UPDATE tasks SET ' || _sort_column || ' = $1, ' ||
                'status_id = COALESCE($2, status_id), ' ||
                'priority_id = COALESCE($3, priority_id), ' ||
                'updated_at = CURRENT_TIMESTAMP ' ||
                'WHERE id = $4';
        
        EXECUTE _sql USING 
            _update_record.sort_order,
            _update_record.status_id,
            _update_record.priority_id,
            _update_record.task_id;
        
        -- Handle phase updates separately since it's in a different table
        IF _update_record.phase_id IS NOT NULL THEN
            INSERT INTO task_phase (task_id, phase_id)
            VALUES (_update_record.task_id, _update_record.phase_id)
            ON CONFLICT (task_id) DO UPDATE SET phase_id = _update_record.phase_id;
        END IF;
    END LOOP;
END;
$_$;


ALTER FUNCTION public.update_task_sort_orders_bulk(_updates json, _group_by text) OWNER TO postgres;

--
-- Name: update_task_status(uuid, uuid, json); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_task_status(_updated_task_id uuid, _status_id uuid, _task_ids json) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _iterator NUMERIC := 0;
    _task_id  TEXT;
BEGIN
    UPDATE tasks SET status_id = _status_id WHERE id = _updated_task_id;

    FOR _task_id IN SELECT * FROM JSON_ARRAY_ELEMENTS((_task_ids)::JSON)
        LOOP
            UPDATE tasks
            SET sort_order = _iterator
            WHERE id = (SELECT TRIM(BOTH '"' FROM _task_id))::UUID;
            _iterator := _iterator + 1;
        END LOOP;

    RETURN JSON_BUILD_OBJECT(
        'id', _updated_task_id
        );
END;
$$;


ALTER FUNCTION public.update_task_status(_updated_task_id uuid, _status_id uuid, _task_ids json) OWNER TO postgres;

--
-- Name: update_task_status(uuid, uuid, uuid, integer, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_task_status(_task_id uuid, _project_id uuid, _status_id uuid, _from_index integer, _to_index integer) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
BEGIN
    UPDATE tasks SET status_id = _status_id WHERE id = _task_id AND project_id = _project_id;

    IF (_from_index != _to_index)
    THEN
        IF _to_index > _from_index
        THEN
            UPDATE tasks
            SET sort_order = sort_order - 1
            WHERE project_id = _project_id
              AND sort_order > _from_index
              AND sort_order <= _to_index;
        END IF;

        IF _to_index < _from_index
        THEN
            UPDATE tasks
            SET sort_order = sort_order + 1
            WHERE project_id = _project_id
              AND sort_order >= _to_index
              AND sort_order < _from_index;
        END IF;

        UPDATE tasks SET sort_order = _to_index WHERE id = _task_id AND project_id = _project_id;
    END IF;

    RETURN JSON_BUILD_OBJECT(
        'id', _task_id
        );
END;
$$;


ALTER FUNCTION public.update_task_status(_task_id uuid, _project_id uuid, _status_id uuid, _from_index integer, _to_index integer) OWNER TO postgres;

--
-- Name: update_task_template(uuid, text, json); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_task_template(_id uuid, _name text, _tasks json) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _task JSON;

BEGIN
    UPDATE task_templates SET name = _name, updated_at = NOW() WHERE id = _id;

    -- delete all existing tasks for the selected template
    DELETE FROM task_templates_tasks WHERE template_id = _id;

    -- insert tasks for task templates
    FOR _task IN SELECT * FROM JSON_ARRAY_ELEMENTS(_tasks)
        LOOP
            INSERT INTO task_templates_tasks (template_id, name) VALUES (_id, (_task ->> 'name')::TEXT);
        END LOOP;

    RETURN JSON_BUILD_OBJECT(
        'id', _id,
        'template_name', _name
        );
END
$$;


ALTER FUNCTION public.update_task_template(_id uuid, _name text, _tasks json) OWNER TO postgres;

--
-- Name: update_task_template(uuid, text, json, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_task_template(_id uuid, _name text, _tasks json, _team_id uuid) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    _task JSON;

BEGIN

    -- check whether the project name is already in
    IF EXISTS(
        SELECT name FROM task_templates WHERE LOWER(name) = LOWER(_name)
                                    AND team_id = _team_id AND id != _id
    )
    THEN
        RAISE 'TASK_TEMPLATE_EXISTS_ERROR:%', _name;
    END IF;

    UPDATE task_templates SET name = _name, updated_at = NOW() WHERE id = _id;

    -- delete all existing tasks for the selected template
    DELETE FROM task_templates_tasks WHERE template_id = _id;

    -- insert tasks for task templates
    FOR _task IN SELECT * FROM JSON_ARRAY_ELEMENTS(_tasks)
        LOOP
            INSERT INTO task_templates_tasks (template_id, name) VALUES (_id, (_task ->> 'name')::TEXT);
        END LOOP;

    RETURN JSON_BUILD_OBJECT(
        'id', _id,
        'template_name', _name
        );
END
$$;


ALTER FUNCTION public.update_task_template(_id uuid, _name text, _tasks json, _team_id uuid) OWNER TO postgres;

--
-- Name: update_team_member(json); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_team_member(_body json) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    _team_id      UUID;
    _job_title_id UUID;
    _role_id      UUID;
BEGIN
    _team_id = (_body ->> 'team_id')::UUID;

    IF ((_body ->> 'is_admin')::BOOLEAN IS TRUE)
    THEN
        SELECT id FROM roles WHERE admin_role IS TRUE INTO _role_id;
    ELSE
        SELECT id FROM roles WHERE default_role IS TRUE INTO _role_id;
    END IF;

    IF is_null_or_empty((_body ->> 'job_title')) IS FALSE
    THEN
        SELECT insert_job_title((_body ->> 'job_title')::TEXT, _team_id) INTO _job_title_id;
    ELSE
        _job_title_id = NULL;
    END IF;

    UPDATE team_members
    SET job_title_id = _job_title_id,
        role_id      = _role_id,
        updated_at   = CURRENT_TIMESTAMP
    WHERE id = (_body ->> 'id')::UUID
      AND team_id = _team_id;
END;
$$;


ALTER FUNCTION public.update_team_member(_body json) OWNER TO postgres;

--
-- Name: update_team_name(json); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_team_name(_body json) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    _name TEXT;
BEGIN
    _name = (_body ->> 'name')::TEXT;

    IF ((SELECT name FROM teams WHERE id = (_body ->> 'id')::UUID) != _name)
    THEN
        UPDATE teams
        SET name       = _name,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = (_body ->> 'id')::UUID
          AND user_id = (_body ->> 'user_id')::UUID;
    END IF;
END;
$$;


ALTER FUNCTION public.update_team_name(_body json) OWNER TO postgres;

--
-- Name: verify_sort_order_integrity(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.verify_sort_order_integrity() RETURNS TABLE(column_name text, project_id uuid, duplicate_count bigint, status text)
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Check sort_order duplicates
    RETURN QUERY
    SELECT 
        'sort_order'::text as column_name,
        t.project_id,
        COUNT(*) as duplicate_count,
        CASE WHEN COUNT(*) > 1 THEN 'DUPLICATES FOUND' ELSE 'OK' END as status
    FROM tasks t
    WHERE t.project_id IS NOT NULL
    GROUP BY t.project_id, t.sort_order
    HAVING COUNT(*) > 1;
    
    -- Check status_sort_order duplicates
    RETURN QUERY
    SELECT 
        'status_sort_order'::text as column_name,
        t.project_id,
        COUNT(*) as duplicate_count,
        CASE WHEN COUNT(*) > 1 THEN 'DUPLICATES FOUND' ELSE 'OK' END as status
    FROM tasks t
    WHERE t.project_id IS NOT NULL
    GROUP BY t.project_id, t.status_sort_order
    HAVING COUNT(*) > 1;
    
    -- Check priority_sort_order duplicates
    RETURN QUERY
    SELECT 
        'priority_sort_order'::text as column_name,
        t.project_id,
        COUNT(*) as duplicate_count,
        CASE WHEN COUNT(*) > 1 THEN 'DUPLICATES FOUND' ELSE 'OK' END as status
    FROM tasks t
    WHERE t.project_id IS NOT NULL
    GROUP BY t.project_id, t.priority_sort_order
    HAVING COUNT(*) > 1;
    
    -- Check phase_sort_order duplicates
    RETURN QUERY
    SELECT 
        'phase_sort_order'::text as column_name,
        t.project_id,
        COUNT(*) as duplicate_count,
        CASE WHEN COUNT(*) > 1 THEN 'DUPLICATES FOUND' ELSE 'OK' END as status
    FROM tasks t
    WHERE t.project_id IS NOT NULL
    GROUP BY t.project_id, t.phase_sort_order
    HAVING COUNT(*) > 1;
    
    -- Note: member_sort_order verification removed - column no longer used
    
END
$$;


ALTER FUNCTION public.verify_sort_order_integrity() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: archived_projects; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.archived_projects (
    user_id uuid NOT NULL,
    project_id uuid NOT NULL
);


ALTER TABLE public.archived_projects OWNER TO postgres;

--
-- Name: bounced_emails; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bounced_emails (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    email text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.bounced_emails OWNER TO postgres;

--
-- Name: cc_column_configurations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cc_column_configurations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    column_id uuid NOT NULL,
    field_title text,
    field_type text,
    number_type text,
    decimals integer,
    label text,
    label_position text,
    preview_value text,
    expression text,
    first_numeric_column_key text,
    second_numeric_column_key text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.cc_column_configurations OWNER TO postgres;

--
-- Name: cc_column_values; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cc_column_values (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    task_id uuid NOT NULL,
    column_id uuid NOT NULL,
    text_value text,
    number_value numeric(18,6),
    date_value timestamp with time zone,
    boolean_value boolean,
    json_value jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.cc_column_values OWNER TO postgres;

--
-- Name: cc_custom_columns; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cc_custom_columns (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    project_id uuid NOT NULL,
    name text NOT NULL,
    key text NOT NULL,
    field_type text NOT NULL,
    width integer DEFAULT 150,
    is_visible boolean DEFAULT true,
    is_custom_column boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.cc_custom_columns OWNER TO postgres;

--
-- Name: cc_label_options; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cc_label_options (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    column_id uuid NOT NULL,
    label_id text NOT NULL,
    label_name text NOT NULL,
    label_color text,
    label_order integer NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.cc_label_options OWNER TO postgres;

--
-- Name: cc_selection_options; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cc_selection_options (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    column_id uuid NOT NULL,
    selection_id text NOT NULL,
    selection_name text NOT NULL,
    selection_color text,
    selection_order integer NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.cc_selection_options OWNER TO postgres;

--
-- Name: clients; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.clients (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    team_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT clients_name_check CHECK ((char_length(name) <= 60))
);


ALTER TABLE public.clients OWNER TO postgres;

--
-- Name: countries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.countries (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character(2) NOT NULL,
    name character varying(150) NOT NULL,
    phone integer NOT NULL,
    currency character varying(3) DEFAULT NULL::character varying
);


ALTER TABLE public.countries OWNER TO postgres;

--
-- Name: cpt_phases; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cpt_phases (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    color_code public.wl_hex_color NOT NULL,
    template_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.cpt_phases OWNER TO postgres;

--
-- Name: cpt_task_labels; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cpt_task_labels (
    task_id uuid NOT NULL,
    label_id uuid NOT NULL
);


ALTER TABLE public.cpt_task_labels OWNER TO postgres;

--
-- Name: cpt_task_phases; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cpt_task_phases (
    task_id uuid NOT NULL,
    phase_id uuid NOT NULL
);


ALTER TABLE public.cpt_task_phases OWNER TO postgres;

--
-- Name: cpt_task_statuses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cpt_task_statuses (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    template_id uuid NOT NULL,
    team_id uuid NOT NULL,
    category_id uuid NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.cpt_task_statuses OWNER TO postgres;

--
-- Name: cpt_tasks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cpt_tasks (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    description text,
    total_minutes numeric DEFAULT 0 NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    task_no bigint,
    original_task_id uuid,
    priority_id uuid NOT NULL,
    template_id uuid NOT NULL,
    parent_task_id uuid,
    status_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT cpt_tasks_task_order_check CHECK ((sort_order >= 0)),
    CONSTRAINT cpt_tasks_total_minutes_check CHECK (((total_minutes >= (0)::numeric) AND (total_minutes <= (999999)::numeric)))
);


ALTER TABLE public.cpt_tasks OWNER TO postgres;

--
-- Name: COLUMN cpt_tasks.original_task_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.cpt_tasks.original_task_id IS 'original_task_id from the project the template is created from';


--
-- Name: custom_project_templates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.custom_project_templates (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    phase_label text DEFAULT 'Phase'::text NOT NULL,
    team_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    color_code text NOT NULL,
    notes text
);


ALTER TABLE public.custom_project_templates OWNER TO postgres;

--
-- Name: email_invitations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.email_invitations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    email public.wl_email NOT NULL,
    team_id uuid,
    team_member_id uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.email_invitations OWNER TO postgres;

--
-- Name: email_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.email_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    email text NOT NULL,
    subject text NOT NULL,
    html text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.email_logs OWNER TO postgres;

--
-- Name: favorite_projects; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.favorite_projects (
    user_id uuid NOT NULL,
    project_id uuid NOT NULL
);


ALTER TABLE public.favorite_projects OWNER TO postgres;

--
-- Name: job_titles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.job_titles (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    team_id uuid NOT NULL,
    CONSTRAINT job_titles_name_check CHECK ((char_length(name) <= 55))
);


ALTER TABLE public.job_titles OWNER TO postgres;

--
-- Name: licensing_admin_users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.licensing_admin_users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    username text NOT NULL,
    phone_no text NOT NULL,
    otp text,
    otp_expiry timestamp with time zone,
    active boolean DEFAULT true NOT NULL
);


ALTER TABLE public.licensing_admin_users OWNER TO postgres;

--
-- Name: licensing_app_sumo_batches; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.licensing_app_sumo_batches (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    created_by uuid NOT NULL
);


ALTER TABLE public.licensing_app_sumo_batches OWNER TO postgres;

--
-- Name: licensing_coupon_codes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.licensing_coupon_codes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    coupon_code text NOT NULL,
    is_redeemed boolean DEFAULT false,
    is_app_sumo boolean DEFAULT false,
    projects_limit integer,
    team_members_limit integer DEFAULT 3,
    storage_limit integer DEFAULT 5,
    redeemed_by uuid,
    batch_id uuid,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    redeemed_at timestamp with time zone,
    is_refunded boolean DEFAULT false,
    reason text,
    feedback text,
    refunded_at timestamp with time zone
);


ALTER TABLE public.licensing_coupon_codes OWNER TO postgres;

--
-- Name: licensing_coupon_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.licensing_coupon_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    coupon_code text NOT NULL,
    redeemed_by uuid NOT NULL,
    redeemed_at timestamp with time zone NOT NULL,
    is_refunded boolean DEFAULT true NOT NULL,
    reason text,
    reverted_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    feedback text
);


ALTER TABLE public.licensing_coupon_logs OWNER TO postgres;

--
-- Name: licensing_credit_subs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.licensing_credit_subs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    next_plan_id uuid NOT NULL,
    user_id uuid NOT NULL,
    credit_given numeric NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by uuid NOT NULL,
    checkout_url text,
    credit_balance numeric DEFAULT 0
);


ALTER TABLE public.licensing_credit_subs OWNER TO postgres;

--
-- Name: licensing_custom_subs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.licensing_custom_subs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    billing_type text DEFAULT 'year'::character varying NOT NULL,
    currency text DEFAULT 'LKR'::character varying NOT NULL,
    rate numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    end_date date NOT NULL,
    user_limit integer
);


ALTER TABLE public.licensing_custom_subs OWNER TO postgres;

--
-- Name: licensing_custom_subs_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.licensing_custom_subs_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    subscription_id uuid NOT NULL,
    log_text text NOT NULL,
    description text,
    admin_user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.licensing_custom_subs_logs OWNER TO postgres;

--
-- Name: licensing_payment_details; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.licensing_payment_details (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    alert_id text NOT NULL,
    alert_name text NOT NULL,
    balance_currency text DEFAULT 'USD'::text,
    balance_earnings numeric DEFAULT 0 NOT NULL,
    balance_fee numeric DEFAULT 0 NOT NULL,
    balance_gross numeric DEFAULT 0 NOT NULL,
    balance_tax numeric DEFAULT 0 NOT NULL,
    checkout_id text NOT NULL,
    country text NOT NULL,
    coupon text NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    custom_data text,
    customer_name text NOT NULL,
    earnings numeric DEFAULT 0 NOT NULL,
    email text NOT NULL,
    event_time text NOT NULL,
    fee numeric DEFAULT 0 NOT NULL,
    initial_payment numeric DEFAULT 1 NOT NULL,
    instalments numeric DEFAULT 1 NOT NULL,
    marketing_consent integer DEFAULT 0,
    next_bill_date date NOT NULL,
    next_payment_amount numeric DEFAULT 0 NOT NULL,
    order_id text NOT NULL,
    p_signature text NOT NULL,
    passthrough text,
    payment_method text DEFAULT 'card'::text NOT NULL,
    payment_tax numeric DEFAULT 0,
    plan_name text NOT NULL,
    quantity numeric DEFAULT 0 NOT NULL,
    receipt_url text NOT NULL,
    sale_gross text DEFAULT 0 NOT NULL,
    status text NOT NULL,
    subscription_id text NOT NULL,
    subscription_payment_id text NOT NULL,
    subscription_plan_id integer,
    unit_price numeric DEFAULT 0 NOT NULL,
    paddle_user_id text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    payment_status text DEFAULT 'success'::text NOT NULL
);


ALTER TABLE public.licensing_payment_details OWNER TO postgres;

--
-- Name: licensing_pricing_plans; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.licensing_pricing_plans (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    billing_type text DEFAULT 'month'::text NOT NULL,
    billing_period integer DEFAULT 1 NOT NULL,
    default_currency text DEFAULT 'USD'::text NOT NULL,
    initial_price text DEFAULT '0'::text NOT NULL,
    recurring_price text DEFAULT '0'::text NOT NULL,
    trial_days integer DEFAULT 0 NOT NULL,
    paddle_id integer DEFAULT 0,
    active boolean DEFAULT false NOT NULL,
    is_startup_plan boolean DEFAULT false NOT NULL,
    CONSTRAINT billing_type_allowed CHECK ((billing_type = ANY (ARRAY['month'::text, 'year'::text])))
);


ALTER TABLE public.licensing_pricing_plans OWNER TO postgres;

--
-- Name: licensing_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.licensing_settings (
    default_trial_storage numeric DEFAULT 1 NOT NULL,
    default_storage numeric DEFAULT 25 NOT NULL,
    storage_addon_price numeric DEFAULT 0 NOT NULL,
    storage_addon_size numeric DEFAULT 0,
    default_monthly_plan uuid,
    default_annual_plan uuid,
    default_startup_plan uuid,
    projects_limit integer DEFAULT 5 NOT NULL,
    team_member_limit integer DEFAULT 0 NOT NULL,
    free_tier_storage integer DEFAULT 5 NOT NULL,
    trial_duration integer DEFAULT 14 NOT NULL
);


ALTER TABLE public.licensing_settings OWNER TO postgres;

--
-- Name: COLUMN licensing_settings.default_trial_storage; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.licensing_settings.default_trial_storage IS 'default storage amount for a trial in Gigabytes(GB)';


--
-- Name: COLUMN licensing_settings.default_storage; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.licensing_settings.default_storage IS 'default storage amount for a paid account in Gigabytes(GB)';


--
-- Name: licensing_user_subscription_modifiers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.licensing_user_subscription_modifiers (
    subscription_id integer NOT NULL,
    modifier_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.licensing_user_subscription_modifiers OWNER TO postgres;

--
-- Name: licensing_user_subscriptions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.licensing_user_subscriptions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    paddle_user_id integer,
    cancel_url text,
    update_url text,
    checkout_id text,
    next_bill_date text,
    quantity integer DEFAULT 1 NOT NULL,
    subscription_id integer,
    subscription_plan_id integer,
    unit_price numeric,
    plan_id uuid NOT NULL,
    status text,
    custom_value_month numeric DEFAULT 0 NOT NULL,
    custom_value_year numeric DEFAULT 0 NOT NULL,
    custom_storage_amount numeric DEFAULT 0 NOT NULL,
    custom_storage_unit text DEFAULT 'MB'::text NOT NULL,
    cancellation_effective_date date,
    currency text DEFAULT 'USD'::text NOT NULL,
    event_time text,
    paused_at text,
    paused_from text,
    paused_reason text,
    active boolean DEFAULT true,
    CONSTRAINT licensing_user_subscriptions_statuses_allowed CHECK ((status = ANY (ARRAY['active'::text, 'past_due'::text, 'trialing'::text, 'paused'::text, 'deleted'::text])))
);


ALTER TABLE public.licensing_user_subscriptions OWNER TO postgres;

--
-- Name: notification_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notification_settings (
    email_notifications_enabled boolean DEFAULT true NOT NULL,
    popup_notifications_enabled boolean DEFAULT true NOT NULL,
    show_unread_items_count boolean DEFAULT true NOT NULL,
    daily_digest_enabled boolean DEFAULT false NOT NULL,
    user_id uuid NOT NULL,
    team_id uuid NOT NULL
);


ALTER TABLE public.notification_settings OWNER TO postgres;

--
-- Name: organization_working_days; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.organization_working_days (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    monday boolean DEFAULT true NOT NULL,
    tuesday boolean DEFAULT true NOT NULL,
    wednesday boolean DEFAULT true NOT NULL,
    thursday boolean DEFAULT true NOT NULL,
    friday boolean DEFAULT true NOT NULL,
    saturday boolean DEFAULT false NOT NULL,
    sunday boolean DEFAULT false NOT NULL,
    organization_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.organization_working_days OWNER TO postgres;

--
-- Name: organizations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.organizations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_name text NOT NULL,
    contact_number text,
    contact_number_secondary text,
    address_line_1 text,
    address_line_2 text,
    country uuid,
    city text,
    state text,
    postal_code text,
    trial_in_progress boolean DEFAULT false NOT NULL,
    trial_expire_date date,
    subscription_status text DEFAULT 'active'::text NOT NULL,
    storage integer DEFAULT 1 NOT NULL,
    updating_plan boolean DEFAULT false,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    license_type_id uuid,
    is_lkr_billing boolean DEFAULT false,
    working_hours double precision DEFAULT 8 NOT NULL,
    CONSTRAINT subscription_statuses_allowed CHECK ((subscription_status = ANY (ARRAY['active'::text, 'past_due'::text, 'trialing'::text, 'paused'::text, 'deleted'::text, 'life_time_deal'::text, 'free'::text, 'custom'::text, 'credit'::text])))
);


ALTER TABLE public.organizations OWNER TO postgres;

--
-- Name: permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.permissions (
    id text NOT NULL,
    name text NOT NULL,
    description text NOT NULL
);


ALTER TABLE public.permissions OWNER TO postgres;

--
-- Name: personal_todo_list; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.personal_todo_list (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    description text,
    color_code public.wl_hex_color NOT NULL,
    done boolean DEFAULT false NOT NULL,
    index integer DEFAULT 0,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT personal_todo_list_description_check CHECK ((char_length(description) <= 200)),
    CONSTRAINT personal_todo_list_name_check CHECK ((char_length(name) <= 100))
);


ALTER TABLE public.personal_todo_list OWNER TO postgres;

--
-- Name: pg_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pg_sessions (
    sid character varying NOT NULL,
    sess json NOT NULL,
    expire timestamp(6) without time zone NOT NULL
);


ALTER TABLE public.pg_sessions OWNER TO postgres;

--
-- Name: project_access_levels; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_access_levels (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    key text NOT NULL
);


ALTER TABLE public.project_access_levels OWNER TO postgres;

--
-- Name: project_categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_categories (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    color_code public.wl_hex_color DEFAULT '#70a6f3'::text NOT NULL,
    team_id uuid NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.project_categories OWNER TO postgres;

--
-- Name: project_comment_mentions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_comment_mentions (
    comment_id uuid NOT NULL,
    mentioned_index integer NOT NULL,
    mentioned_by uuid NOT NULL,
    informed_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.project_comment_mentions OWNER TO postgres;

--
-- Name: project_comments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_comments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    content text NOT NULL,
    created_by uuid NOT NULL,
    project_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT project_comments_content_length_check CHECK ((char_length(content) <= 2000))
);


ALTER TABLE public.project_comments OWNER TO postgres;

--
-- Name: project_folders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_folders (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    key text NOT NULL,
    color_code public.wl_hex_color DEFAULT '#70a6f3'::text NOT NULL,
    created_by uuid NOT NULL,
    parent_folder_id uuid,
    team_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.project_folders OWNER TO postgres;

--
-- Name: project_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    team_id uuid NOT NULL,
    project_id uuid NOT NULL,
    description text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.project_logs OWNER TO postgres;

--
-- Name: project_member_allocations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_member_allocations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    project_id uuid NOT NULL,
    team_member_id uuid NOT NULL,
    allocated_from timestamp with time zone NOT NULL,
    allocated_to timestamp with time zone NOT NULL,
    seconds_per_day integer
);


ALTER TABLE public.project_member_allocations OWNER TO postgres;

--
-- Name: project_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_members (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    team_member_id uuid NOT NULL,
    project_access_level_id uuid NOT NULL,
    project_id uuid NOT NULL,
    role_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    default_view text DEFAULT 'TASK_LIST'::text NOT NULL
);


ALTER TABLE public.project_members OWNER TO postgres;

--
-- Name: project_phases; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_phases (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    color_code public.wl_hex_color NOT NULL,
    project_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    start_date timestamp with time zone,
    end_date timestamp with time zone,
    sort_index integer DEFAULT 0
);


ALTER TABLE public.project_phases OWNER TO postgres;

--
-- Name: project_subscribers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_subscribers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    project_id uuid NOT NULL,
    team_member_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.project_subscribers OWNER TO postgres;

--
-- Name: project_task_list_cols; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_task_list_cols (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    key public.wl_task_list_col_key NOT NULL,
    index integer DEFAULT 0 NOT NULL,
    pinned boolean DEFAULT true NOT NULL,
    project_id uuid NOT NULL,
    custom_column boolean DEFAULT false,
    custom_column_obj jsonb
);


ALTER TABLE public.project_task_list_cols OWNER TO postgres;

--
-- Name: projects; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.projects (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    key text NOT NULL,
    color_code public.wl_hex_color DEFAULT '#70a6f3'::text NOT NULL,
    notes text,
    tasks_counter bigint DEFAULT 0 NOT NULL,
    start_date timestamp with time zone,
    end_date timestamp with time zone,
    team_id uuid NOT NULL,
    client_id uuid,
    owner_id uuid NOT NULL,
    status_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    category_id uuid,
    folder_id uuid,
    phase_label text DEFAULT 'Phase'::text NOT NULL,
    estimated_man_days integer DEFAULT 0,
    hours_per_day integer DEFAULT 8,
    health_id uuid,
    estimated_working_days integer DEFAULT 0,
    use_manual_progress boolean DEFAULT false NOT NULL,
    use_weighted_progress boolean DEFAULT false NOT NULL,
    use_time_progress boolean DEFAULT false NOT NULL,
    CONSTRAINT projects_name_check CHECK ((char_length(name) <= 100)),
    CONSTRAINT projects_notes_check CHECK ((char_length(notes) <= 500))
);


ALTER TABLE public.projects OWNER TO postgres;

--
-- Name: pt_labels; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pt_labels (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    color_code text NOT NULL,
    template_id uuid
);


ALTER TABLE public.pt_labels OWNER TO postgres;

--
-- Name: pt_phases; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pt_phases (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    color_code text,
    template_id uuid NOT NULL
);


ALTER TABLE public.pt_phases OWNER TO postgres;

--
-- Name: pt_project_templates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pt_project_templates (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    key text NOT NULL,
    description text,
    phase_label text,
    image_url text,
    color_code text DEFAULT '#3b7ad4'::text NOT NULL
);


ALTER TABLE public.pt_project_templates OWNER TO postgres;

--
-- Name: pt_statuses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pt_statuses (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    template_id uuid NOT NULL,
    category_id uuid NOT NULL
);


ALTER TABLE public.pt_statuses OWNER TO postgres;

--
-- Name: pt_task_labels; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pt_task_labels (
    task_id uuid NOT NULL,
    label_id uuid NOT NULL
);


ALTER TABLE public.pt_task_labels OWNER TO postgres;

--
-- Name: pt_task_phases; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pt_task_phases (
    task_id uuid NOT NULL,
    phase_id uuid NOT NULL
);


ALTER TABLE public.pt_task_phases OWNER TO postgres;

--
-- Name: pt_task_statuses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pt_task_statuses (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    template_id uuid NOT NULL,
    team_id uuid NOT NULL,
    category_id uuid NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.pt_task_statuses OWNER TO postgres;

--
-- Name: pt_tasks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pt_tasks (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    description text,
    total_minutes numeric DEFAULT 0 NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    priority_id uuid NOT NULL,
    template_id uuid NOT NULL,
    parent_task_id uuid,
    status_id uuid NOT NULL,
    CONSTRAINT pt_tasks_task_order_check CHECK ((sort_order >= 0)),
    CONSTRAINT pt_tasks_total_minutes_check CHECK (((total_minutes >= (0)::numeric) AND (total_minutes <= (999999)::numeric)))
);


ALTER TABLE public.pt_tasks OWNER TO postgres;

--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.role_permissions (
    role_id uuid NOT NULL,
    permission_id text NOT NULL
);


ALTER TABLE public.role_permissions OWNER TO postgres;

--
-- Name: roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.roles (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    team_id uuid NOT NULL,
    default_role boolean DEFAULT false NOT NULL,
    admin_role boolean DEFAULT false NOT NULL,
    owner boolean DEFAULT false NOT NULL
);


ALTER TABLE public.roles OWNER TO postgres;

--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.schema_migrations (
    version text NOT NULL,
    applied_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.schema_migrations OWNER TO postgres;

--
-- Name: spam_emails; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.spam_emails (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    email text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.spam_emails OWNER TO postgres;

--
-- Name: survey_answers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.survey_answers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    response_id uuid NOT NULL,
    question_id uuid NOT NULL,
    answer_text text,
    answer_json jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.survey_answers OWNER TO postgres;

--
-- Name: survey_questions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.survey_questions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    survey_id uuid NOT NULL,
    question_key character varying(100) NOT NULL,
    question_type character varying(50) NOT NULL,
    is_required boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    options jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT survey_questions_sort_order_check CHECK ((sort_order >= 0)),
    CONSTRAINT survey_questions_type_check CHECK (((question_type)::text = ANY ((ARRAY['single_choice'::character varying, 'multiple_choice'::character varying, 'text'::character varying])::text[])))
);


ALTER TABLE public.survey_questions OWNER TO postgres;

--
-- Name: survey_responses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.survey_responses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    survey_id uuid NOT NULL,
    user_id uuid NOT NULL,
    is_completed boolean DEFAULT false NOT NULL,
    started_at timestamp without time zone DEFAULT now() NOT NULL,
    completed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.survey_responses OWNER TO postgres;

--
-- Name: surveys; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.surveys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    survey_type character varying(50) DEFAULT 'account_setup'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.surveys OWNER TO postgres;

--
-- Name: sys_license_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sys_license_types (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    key text NOT NULL,
    description text
);


ALTER TABLE public.sys_license_types OWNER TO postgres;

--
-- Name: sys_project_healths; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sys_project_healths (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    color_code public.wl_hex_color NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_default boolean DEFAULT false NOT NULL
);


ALTER TABLE public.sys_project_healths OWNER TO postgres;

--
-- Name: sys_project_statuses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sys_project_statuses (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    color_code public.wl_hex_color NOT NULL,
    icon text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_default boolean DEFAULT false NOT NULL
);


ALTER TABLE public.sys_project_statuses OWNER TO postgres;

--
-- Name: sys_task_status_categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sys_task_status_categories (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    color_code public.wl_hex_color NOT NULL,
    index integer DEFAULT 0 NOT NULL,
    is_todo boolean DEFAULT false NOT NULL,
    is_doing boolean DEFAULT false NOT NULL,
    is_done boolean DEFAULT false NOT NULL,
    description text,
    color_code_dark public.wl_hex_color
);


ALTER TABLE public.sys_task_status_categories OWNER TO postgres;

--
-- Name: task_activity_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_activity_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    task_id uuid NOT NULL,
    team_id uuid NOT NULL,
    attribute_type text NOT NULL,
    user_id uuid NOT NULL,
    log_type text,
    old_value text,
    new_value text,
    prev_string text,
    next_string text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    project_id uuid NOT NULL,
    CONSTRAINT task_activity_logs_log_type_check CHECK ((log_type = ANY (ARRAY['create'::text, 'update'::text, 'delete'::text, 'assign'::text, 'unassign'::text])))
);


ALTER TABLE public.task_activity_logs OWNER TO postgres;

--
-- Name: COLUMN task_activity_logs.user_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.task_activity_logs.user_id IS 'id of the user who initiated the activity';


--
-- Name: COLUMN task_activity_logs.log_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.task_activity_logs.log_type IS 'whether the log belongs to create, update, delete, assign or unassign category';


--
-- Name: task_attachments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_attachments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    size bigint DEFAULT 0 NOT NULL,
    type text NOT NULL,
    task_id uuid,
    team_id uuid NOT NULL,
    project_id uuid NOT NULL,
    uploaded_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT task_attachments_name_check CHECK ((char_length(name) <= 110))
);


ALTER TABLE public.task_attachments OWNER TO postgres;

--
-- Name: task_comment_attachments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_comment_attachments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    size bigint DEFAULT 0 NOT NULL,
    type text NOT NULL,
    task_id uuid NOT NULL,
    comment_id uuid NOT NULL,
    team_id uuid NOT NULL,
    project_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT task_comment_attachments_name_check CHECK ((char_length(name) <= 100))
);


ALTER TABLE public.task_comment_attachments OWNER TO postgres;

--
-- Name: task_comment_contents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_comment_contents (
    index integer NOT NULL,
    comment_id uuid NOT NULL,
    team_member_id uuid,
    text_content text,
    CONSTRAINT task_comment_contents_content_check CHECK ((((team_member_id IS NULL) AND (text_content IS NULL)) IS FALSE)),
    CONSTRAINT task_comment_contents_name_check CHECK ((char_length(text_content) <= 5000))
);


ALTER TABLE public.task_comment_contents OWNER TO postgres;

--
-- Name: task_comment_mentions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_comment_mentions (
    comment_id uuid NOT NULL,
    mentioned_index integer DEFAULT 0 NOT NULL,
    mentioned_by uuid NOT NULL,
    informed_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.task_comment_mentions OWNER TO postgres;

--
-- Name: task_comment_reactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_comment_reactions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    comment_id uuid NOT NULL,
    user_id uuid NOT NULL,
    team_member_id uuid NOT NULL,
    reaction_type public.reaction_types DEFAULT 'like'::public.reaction_types NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.task_comment_reactions OWNER TO postgres;

--
-- Name: task_comments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_comments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    team_member_id uuid NOT NULL,
    task_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    ses_message_id text
);


ALTER TABLE public.task_comments OWNER TO postgres;

--
-- Name: task_dependencies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_dependencies (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    task_id uuid NOT NULL,
    related_task_id uuid NOT NULL,
    dependency_type public.dependency_type DEFAULT 'blocked_by'::public.dependency_type NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.task_dependencies OWNER TO postgres;

--
-- Name: task_labels; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_labels (
    task_id uuid NOT NULL,
    label_id uuid NOT NULL
);


ALTER TABLE public.task_labels OWNER TO postgres;

--
-- Name: team_labels; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.team_labels (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    color_code public.wl_hex_color NOT NULL,
    team_id uuid NOT NULL,
    CONSTRAINT team_labels_name_check CHECK ((char_length(name) <= 40))
);


ALTER TABLE public.team_labels OWNER TO postgres;

--
-- Name: task_labels_view; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.task_labels_view AS
 SELECT ( SELECT team_labels.name
           FROM public.team_labels
          WHERE (team_labels.id = task_labels.label_id)) AS name,
    task_labels.task_id,
    task_labels.label_id
   FROM public.task_labels;


ALTER TABLE public.task_labels_view OWNER TO postgres;

--
-- Name: task_phase; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_phase (
    task_id uuid NOT NULL,
    phase_id uuid NOT NULL
);


ALTER TABLE public.task_phase OWNER TO postgres;

--
-- Name: task_priorities; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_priorities (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    value integer DEFAULT 0 NOT NULL,
    color_code public.wl_hex_color NOT NULL,
    color_code_dark public.wl_hex_color
);


ALTER TABLE public.task_priorities OWNER TO postgres;

--
-- Name: task_recurring_schedules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_recurring_schedules (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    schedule_type public.schedule_type DEFAULT 'daily'::public.schedule_type,
    days_of_week integer[],
    day_of_month integer,
    week_of_month integer,
    interval_days integer,
    interval_weeks integer,
    interval_months integer,
    start_date date,
    end_date date,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.task_recurring_schedules OWNER TO postgres;

--
-- Name: task_recurring_templates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_recurring_templates (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    task_id uuid NOT NULL,
    schedule_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    end_date timestamp with time zone,
    priority_id uuid NOT NULL,
    project_id uuid NOT NULL,
    assignees jsonb,
    labels jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.task_recurring_templates OWNER TO postgres;

--
-- Name: task_statuses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_statuses (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    project_id uuid NOT NULL,
    team_id uuid NOT NULL,
    category_id uuid NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    CONSTRAINT task_statuses_name_check CHECK ((char_length(name) <= 50))
);


ALTER TABLE public.task_statuses OWNER TO postgres;

--
-- Name: task_subscribers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_subscribers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    task_id uuid NOT NULL,
    team_member_id uuid NOT NULL,
    action text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT task_subscribers_action_check CHECK ((action = 'WHEN_DONE'::text))
);


ALTER TABLE public.task_subscribers OWNER TO postgres;

--
-- Name: task_templates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_templates (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    team_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.task_templates OWNER TO postgres;

--
-- Name: task_templates_tasks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_templates_tasks (
    name text NOT NULL,
    template_id uuid NOT NULL,
    total_minutes numeric DEFAULT 0 NOT NULL
);


ALTER TABLE public.task_templates_tasks OWNER TO postgres;

--
-- Name: task_timers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_timers (
    task_id uuid NOT NULL,
    user_id uuid NOT NULL,
    start_time timestamp with time zone
);


ALTER TABLE public.task_timers OWNER TO postgres;

--
-- Name: task_updates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_updates (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    type text NOT NULL,
    reporter_id uuid NOT NULL,
    task_id uuid NOT NULL,
    user_id uuid NOT NULL,
    team_id uuid NOT NULL,
    project_id uuid NOT NULL,
    is_sent boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    retry_count integer DEFAULT 0,
    CONSTRAINT task_updates_type_check CHECK ((type = ANY (ARRAY['ASSIGN'::text, 'UNASSIGN'::text])))
);


ALTER TABLE public.task_updates OWNER TO postgres;

--
-- Name: task_work_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_work_log (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    time_spent numeric DEFAULT 0 NOT NULL,
    description text,
    logged_by_timer boolean DEFAULT false NOT NULL,
    task_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT task_work_log_description_check CHECK ((char_length(description) <= 500)),
    CONSTRAINT task_work_log_time_spent_check CHECK ((time_spent >= (0)::numeric))
);


ALTER TABLE public.task_work_log OWNER TO postgres;

--
-- Name: tasks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tasks (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    description text,
    done boolean DEFAULT false NOT NULL,
    total_minutes numeric DEFAULT 0 NOT NULL,
    archived boolean DEFAULT false NOT NULL,
    task_no bigint NOT NULL,
    start_date timestamp with time zone,
    end_date timestamp with time zone,
    priority_id uuid NOT NULL,
    project_id uuid NOT NULL,
    reporter_id uuid NOT NULL,
    parent_task_id uuid,
    status_id uuid NOT NULL,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    roadmap_sort_order integer DEFAULT 0 NOT NULL,
    status_sort_order integer DEFAULT 0 NOT NULL,
    priority_sort_order integer DEFAULT 0 NOT NULL,
    phase_sort_order integer DEFAULT 0 NOT NULL,
    billable boolean DEFAULT true,
    schedule_id uuid,
    manual_progress boolean DEFAULT false NOT NULL,
    progress_value integer,
    progress_mode public.progress_mode_type DEFAULT 'default'::public.progress_mode_type NOT NULL,
    weight integer,
    CONSTRAINT tasks_description_check CHECK ((char_length(description) <= 500000)),
    CONSTRAINT tasks_name_check CHECK ((char_length(name) <= 500)),
    CONSTRAINT tasks_phase_sort_order_check CHECK ((phase_sort_order >= 0)),
    CONSTRAINT tasks_priority_sort_order_check CHECK ((priority_sort_order >= 0)),
    CONSTRAINT tasks_status_sort_order_check CHECK ((status_sort_order >= 0)),
    CONSTRAINT tasks_total_minutes_check CHECK (((total_minutes >= (0)::numeric) AND (total_minutes <= (999999)::numeric)))
);


ALTER TABLE public.tasks OWNER TO postgres;

--
-- Name: COLUMN tasks.status_sort_order; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tasks.status_sort_order IS 'Sort order when grouped by status';


--
-- Name: COLUMN tasks.priority_sort_order; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tasks.priority_sort_order IS 'Sort order when grouped by priority';


--
-- Name: COLUMN tasks.phase_sort_order; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tasks.phase_sort_order IS 'Sort order when grouped by phase';


--
-- Name: tasks_assignees; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tasks_assignees (
    task_id uuid NOT NULL,
    project_member_id uuid NOT NULL,
    team_member_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    assigned_by uuid NOT NULL
);


ALTER TABLE public.tasks_assignees OWNER TO postgres;

--
-- Name: tasks_with_status_view; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.tasks_with_status_view AS
 SELECT tasks.id AS task_id,
    tasks.parent_task_id,
    stsc.is_todo,
    stsc.is_doing,
    stsc.is_done
   FROM ((public.tasks
     JOIN public.task_statuses ts ON ((tasks.status_id = ts.id)))
     JOIN public.sys_task_status_categories stsc ON ((ts.category_id = stsc.id)))
  WHERE (tasks.archived IS FALSE);


ALTER TABLE public.tasks_with_status_view OWNER TO postgres;

--
-- Name: team_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.team_members (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    team_id uuid NOT NULL,
    role_id uuid NOT NULL,
    job_title_id uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    active boolean DEFAULT true
);


ALTER TABLE public.team_members OWNER TO postgres;

--
-- Name: users_user_no_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_user_no_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.users_user_no_seq OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    email public.wl_email NOT NULL,
    password text,
    active_team uuid,
    avatar_url text,
    setup_completed boolean DEFAULT false NOT NULL,
    user_no bigint DEFAULT nextval('public.users_user_no_seq'::regclass) NOT NULL,
    timezone_id uuid NOT NULL,
    google_id text,
    socket_id text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_active timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    temp_email boolean DEFAULT false,
    is_deleted boolean DEFAULT false,
    deleted_at timestamp with time zone,
    language public.language_type DEFAULT 'en'::public.language_type,
    CONSTRAINT users_email_check CHECK ((char_length((email)::text) <= 255)),
    CONSTRAINT users_name_check CHECK ((char_length(name) <= 55))
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: team_member_info_mv; Type: MATERIALIZED VIEW; Schema: public; Owner: postgres
--

CREATE MATERIALIZED VIEW public.team_member_info_mv AS
 SELECT u.avatar_url,
    COALESCE(u.email, ei.email) AS email,
    COALESCE(u.name, ei.name) AS name,
    u.id AS user_id,
    tm.id AS team_member_id,
    tm.team_id,
    tm.active,
    u.socket_id
   FROM ((public.team_members tm
     LEFT JOIN public.users u ON ((tm.user_id = u.id)))
     LEFT JOIN public.email_invitations ei ON ((ei.team_member_id = tm.id)))
  WHERE (tm.active = true)
  WITH NO DATA;


ALTER TABLE public.team_member_info_mv OWNER TO postgres;

--
-- Name: team_member_info_view; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.team_member_info_view AS
 SELECT u.avatar_url,
    COALESCE(u.email, ( SELECT email_invitations.email
           FROM public.email_invitations
          WHERE (email_invitations.team_member_id = team_members.id))) AS email,
    COALESCE(u.name, ( SELECT email_invitations.name
           FROM public.email_invitations
          WHERE (email_invitations.team_member_id = team_members.id))) AS name,
    u.id AS user_id,
    team_members.id AS team_member_id,
    team_members.team_id,
    team_members.active
   FROM (public.team_members
     LEFT JOIN public.users u ON ((team_members.user_id = u.id)));


ALTER TABLE public.team_member_info_view OWNER TO postgres;

--
-- Name: teams; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.teams (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    organization_id uuid,
    CONSTRAINT teams_name_check CHECK ((char_length(name) <= 55))
);


ALTER TABLE public.teams OWNER TO postgres;

--
-- Name: timezones; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.timezones (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    abbrev text NOT NULL,
    utc_offset interval NOT NULL
);


ALTER TABLE public.timezones OWNER TO postgres;

--
-- Name: user_deletion_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_deletion_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    email text NOT NULL,
    name text NOT NULL,
    requested_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    scheduled_deletion_date timestamp with time zone NOT NULL,
    deleted_at timestamp with time zone,
    deletion_completed boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.user_deletion_logs OWNER TO postgres;

--
-- Name: TABLE user_deletion_logs; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.user_deletion_logs IS 'Tracks user account deletion requests and their scheduled deletion dates';


--
-- Name: COLUMN user_deletion_logs.scheduled_deletion_date; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_deletion_logs.scheduled_deletion_date IS 'Date when the user data should be permanently deleted (30 days after request)';


--
-- Name: COLUMN user_deletion_logs.deletion_completed; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_deletion_logs.deletion_completed IS 'Flag to indicate if the deletion process has been completed';


--
-- Name: user_notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_notifications (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    message text NOT NULL,
    user_id uuid NOT NULL,
    team_id uuid NOT NULL,
    read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    task_id uuid,
    project_id uuid
);


ALTER TABLE public.user_notifications OWNER TO postgres;

--
-- Name: users_data; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users_data (
    user_id uuid NOT NULL,
    organization_name text NOT NULL,
    contact_number text,
    contact_number_secondary text,
    address_line_1 text,
    address_line_2 text,
    country uuid,
    city text,
    state text,
    postal_code text,
    trial_in_progress boolean DEFAULT false NOT NULL,
    trial_expire_date date,
    subscription_status text DEFAULT 'active'::text NOT NULL,
    storage integer DEFAULT 1 NOT NULL,
    updating_plan boolean DEFAULT false
);


ALTER TABLE public.users_data OWNER TO postgres;

--
-- Name: worklenz_alerts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.worklenz_alerts (
    description text NOT NULL,
    type text NOT NULL,
    active boolean DEFAULT false,
    CONSTRAINT worklenz_alerts_type_check CHECK ((type = ANY (ARRAY['success'::text, 'info'::text, 'warning'::text, 'error'::text])))
);


ALTER TABLE public.worklenz_alerts OWNER TO postgres;

--
-- Data for Name: archived_projects; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.archived_projects (user_id, project_id) FROM stdin;
\.


--
-- Data for Name: bounced_emails; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.bounced_emails (id, email, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: cc_column_configurations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.cc_column_configurations (id, column_id, field_title, field_type, number_type, decimals, label, label_position, preview_value, expression, first_numeric_column_key, second_numeric_column_key, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: cc_column_values; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.cc_column_values (id, task_id, column_id, text_value, number_value, date_value, boolean_value, json_value, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: cc_custom_columns; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.cc_custom_columns (id, project_id, name, key, field_type, width, is_visible, is_custom_column, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: cc_label_options; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.cc_label_options (id, column_id, label_id, label_name, label_color, label_order, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: cc_selection_options; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.cc_selection_options (id, column_id, selection_id, selection_name, selection_color, selection_order, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: clients; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.clients (id, name, team_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: countries; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.countries (id, code, name, phone, currency) FROM stdin;
\.


--
-- Data for Name: cpt_phases; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.cpt_phases (id, name, color_code, template_id, created_at) FROM stdin;
\.


--
-- Data for Name: cpt_task_labels; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.cpt_task_labels (task_id, label_id) FROM stdin;
\.


--
-- Data for Name: cpt_task_phases; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.cpt_task_phases (task_id, phase_id) FROM stdin;
\.


--
-- Data for Name: cpt_task_statuses; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.cpt_task_statuses (id, name, template_id, team_id, category_id, sort_order) FROM stdin;
\.


--
-- Data for Name: cpt_tasks; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.cpt_tasks (id, name, description, total_minutes, sort_order, task_no, original_task_id, priority_id, template_id, parent_task_id, status_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: custom_project_templates; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.custom_project_templates (id, name, phase_label, team_id, created_at, updated_at, color_code, notes) FROM stdin;
\.


--
-- Data for Name: email_invitations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.email_invitations (id, name, email, team_id, team_member_id, created_at, updated_at) FROM stdin;
41d00788-cd55-46f4-bc0b-41e082e23fe2	khoa	khoa@smarternutrition.com	cb828fd9-67f2-4982-b7f8-9ca34ee36d89	44b59eee-6011-4182-b6f7-47f56aced5cf	2025-10-03 20:53:31.219379+00	2025-10-03 20:53:31.219379+00
\.


--
-- Data for Name: email_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.email_logs (id, email, subject, html, created_at) FROM stdin;
\.


--
-- Data for Name: favorite_projects; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.favorite_projects (user_id, project_id) FROM stdin;
\.


--
-- Data for Name: job_titles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.job_titles (id, name, team_id) FROM stdin;
\.


--
-- Data for Name: licensing_admin_users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.licensing_admin_users (id, name, username, phone_no, otp, otp_expiry, active) FROM stdin;
\.


--
-- Data for Name: licensing_app_sumo_batches; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.licensing_app_sumo_batches (id, name, created_at, created_by) FROM stdin;
\.


--
-- Data for Name: licensing_coupon_codes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.licensing_coupon_codes (id, coupon_code, is_redeemed, is_app_sumo, projects_limit, team_members_limit, storage_limit, redeemed_by, batch_id, created_by, created_at, redeemed_at, is_refunded, reason, feedback, refunded_at) FROM stdin;
\.


--
-- Data for Name: licensing_coupon_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.licensing_coupon_logs (id, coupon_code, redeemed_by, redeemed_at, is_refunded, reason, reverted_at, feedback) FROM stdin;
\.


--
-- Data for Name: licensing_credit_subs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.licensing_credit_subs (id, next_plan_id, user_id, credit_given, created_at, created_by, checkout_url, credit_balance) FROM stdin;
\.


--
-- Data for Name: licensing_custom_subs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.licensing_custom_subs (id, user_id, billing_type, currency, rate, created_at, end_date, user_limit) FROM stdin;
\.


--
-- Data for Name: licensing_custom_subs_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.licensing_custom_subs_logs (id, subscription_id, log_text, description, admin_user_id, created_at) FROM stdin;
\.


--
-- Data for Name: licensing_payment_details; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.licensing_payment_details (id, user_id, alert_id, alert_name, balance_currency, balance_earnings, balance_fee, balance_gross, balance_tax, checkout_id, country, coupon, currency, custom_data, customer_name, earnings, email, event_time, fee, initial_payment, instalments, marketing_consent, next_bill_date, next_payment_amount, order_id, p_signature, passthrough, payment_method, payment_tax, plan_name, quantity, receipt_url, sale_gross, status, subscription_id, subscription_payment_id, subscription_plan_id, unit_price, paddle_user_id, created_at, payment_status) FROM stdin;
\.


--
-- Data for Name: licensing_pricing_plans; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.licensing_pricing_plans (id, name, billing_type, billing_period, default_currency, initial_price, recurring_price, trial_days, paddle_id, active, is_startup_plan) FROM stdin;
\.


--
-- Data for Name: licensing_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.licensing_settings (default_trial_storage, default_storage, storage_addon_price, storage_addon_size, default_monthly_plan, default_annual_plan, default_startup_plan, projects_limit, team_member_limit, free_tier_storage, trial_duration) FROM stdin;
\.


--
-- Data for Name: licensing_user_subscription_modifiers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.licensing_user_subscription_modifiers (subscription_id, modifier_id, created_at) FROM stdin;
\.


--
-- Data for Name: licensing_user_subscriptions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.licensing_user_subscriptions (id, user_id, paddle_user_id, cancel_url, update_url, checkout_id, next_bill_date, quantity, subscription_id, subscription_plan_id, unit_price, plan_id, status, custom_value_month, custom_value_year, custom_storage_amount, custom_storage_unit, cancellation_effective_date, currency, event_time, paused_at, paused_from, paused_reason, active) FROM stdin;
\.


--
-- Data for Name: notification_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.notification_settings (email_notifications_enabled, popup_notifications_enabled, show_unread_items_count, daily_digest_enabled, user_id, team_id) FROM stdin;
t	t	t	f	6f5e7931-2674-409a-9b5f-b51d4c5377fe	cb828fd9-67f2-4982-b7f8-9ca34ee36d89
t	t	t	f	bea2b5c0-3b6e-4550-b136-022ea9bb386e	4481edd2-c821-44c6-b358-5d728efd4544
t	t	t	f	bea2b5c0-3b6e-4550-b136-022ea9bb386e	cb828fd9-67f2-4982-b7f8-9ca34ee36d89
\.


--
-- Data for Name: organization_working_days; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.organization_working_days (id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, organization_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: organizations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.organizations (id, organization_name, contact_number, contact_number_secondary, address_line_1, address_line_2, country, city, state, postal_code, trial_in_progress, trial_expire_date, subscription_status, storage, updating_plan, user_id, created_at, updated_at, license_type_id, is_lkr_billing, working_hours) FROM stdin;
b05df0ba-e2cc-4908-a92a-71f7bc1d5599	Awaken Services	\N	\N	\N	\N	\N	\N	\N	\N	t	2053-02-17	active	1	f	6f5e7931-2674-409a-9b5f-b51d4c5377fe	2025-10-03 19:50:26.41415+00	2025-10-03 19:50:26.41415+00	008196cf-6443-41f7-8182-7875ab7ee176	f	8
311edbbc-b42b-42b5-807a-41d172815e9e	Naturewise	\N	\N	\N	\N	\N	\N	\N	\N	t	2053-02-17	active	1	f	bea2b5c0-3b6e-4550-b136-022ea9bb386e	2025-10-03 19:53:46.50038+00	2025-10-03 19:53:46.50038+00	008196cf-6443-41f7-8182-7875ab7ee176	f	8
\.


--
-- Data for Name: permissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.permissions (id, name, description) FROM stdin;
\.


--
-- Data for Name: personal_todo_list; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.personal_todo_list (id, name, description, color_code, done, index, user_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: pg_sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.pg_sessions (sid, sess, expire) FROM stdin;
rNa2HjV5pzQ6zfwnVmiuiva4pQl0sx7B	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-11-02T20:10:51.030Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"csrfToken":"9e2db6589893b599953c35b2fe108137abd04596f4ed8e513245c691d4ea0a5d572550d6c88c25433b766a36f80f53a8319ebf0d297261eb0a2634189ba7a0c89c502b89f582b4d2e8bd2f391899168d862ae19064caa668703c458dc37d51ecd086a4214b5ff5925f4d092f7767418105ad4a3a1acc11d6ccd0e663e59e9f7d","flash":{}}	2025-11-02 20:10:52
JdwPTaBVTqJvcZuH4gceft4jzT_4hF54	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-11-02T20:16:06.914Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"csrfToken":"3295c3019169becbd29ad32cbba8e111ddeaf99d2ada19235957ba795ef241bc0b9556decaee0842137aa742b131578c4aee2c35d73f2fb40a3b53ce36d6a1d82d03c897fa0139e1720aa09843442f990c6dbe44d5f9d231790747f2d306e18710be7727dd5c1e57806f5d86547baff414bad0f551f4a88703f38e55fd044af4"}	2025-11-02 20:16:07
aJl_cH9QYCvK55M4rKlbHCDrxlzVDXb7	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-11-02T20:16:07.079Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"flash":{}}	2025-11-02 20:16:08
F01PalY-X0BjIOZxlWL3vgWx9UaMs9aD	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-11-02T20:16:27.598Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"}}	2025-11-02 20:16:28
0RDKzA4ITq0-8jSGMbTMu-RdxgkmiZPM	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-11-02T20:16:27.657Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"flash":{"error":["Worklenz account already exists for email khoang@awakenservices.net."]}}	2025-11-02 20:16:28
IB-rTw3oQ6VbUIQckCD8-KlZpSfo8cW2	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-11-02T20:16:27.669Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"flash":{}}	2025-11-02 20:16:28
nR6SO1wbEdNQ9I8yZb4XKMGIwpOpqqjo	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-11-02T20:16:27.684Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"flash":{}}	2025-11-02 20:16:28
YUhyhdGh4NpaBcE0NzBPdznXHN9SNoAA	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-11-02T20:16:28.912Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"}}	2025-11-02 20:16:29
Nb5c-cDM6MOIzI9H7DaIHRZJHgsa2ojV	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-11-02T20:16:28.965Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"flash":{"error":["Worklenz account already exists for email khoang@awakenservices.net."]}}	2025-11-02 20:16:29
EeJIy15xAmmc05Et6amCh8ZWOrSnNMU3	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-11-02T20:16:28.973Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"flash":{}}	2025-11-02 20:16:29
4kytt9FS9vaf5nyg3eKH_VGLARg_qsii	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-11-02T20:16:28.990Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"flash":{}}	2025-11-02 20:16:29
Sv-nk3hvK-jjeVFo7035FZeSF5wf3uLm	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-11-02T20:16:29.377Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"}}	2025-11-02 20:16:30
2CQ41yJRoBgikzraPkpYVLQZ_Cakrwsk	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-11-02T20:16:29.436Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"flash":{"error":["Worklenz account already exists for email khoang@awakenservices.net."]}}	2025-11-02 20:16:30
t3d8ia0KUuu1guFvoYK-E-e5i9q7K2YX	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-11-02T20:16:29.444Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"flash":{}}	2025-11-02 20:16:30
xf-V47CkEf_ztdiza1b4H41Jguze9bzX	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-11-02T20:16:29.452Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"flash":{}}	2025-11-02 20:16:30
gVAG46RkQDZbuOquAqaaA1OL-Rs0gPGE	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-11-02T20:16:29.582Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"}}	2025-11-02 20:16:30
bHtl4m4O4e-7tZu_a_k5eLkzCFS-UxhT	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-11-02T20:16:29.637Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"flash":{"error":["Worklenz account already exists for email khoang@awakenservices.net."]}}	2025-11-02 20:16:30
coAMIm5CF0Z3-HA8ejZKHqq8TVB84HuG	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-11-02T20:16:29.643Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"flash":{}}	2025-11-02 20:16:30
O16JmoWa9xr66kpvIv7TJt0sU4yK7omM	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-11-02T20:16:29.655Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"flash":{}}	2025-11-02 20:16:30
jlHVg4Ui14Ep8ULbU1QNG1Wn8VbJB7wR	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-11-02T20:16:29.800Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"}}	2025-11-02 20:16:30
AhRw8ESUOV7e8poNGHR51zCDb4-XIgmA	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-11-02T20:16:29.855Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"flash":{"error":["Worklenz account already exists for email khoang@awakenservices.net."]}}	2025-11-02 20:16:30
FbuMx1oScbZQyFzTQT51GzcRPtM19ogn	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-11-02T20:16:29.863Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"flash":{}}	2025-11-02 20:16:30
7OuDvzGPLy7qGUJEbPS-tTIuGZSApz7B	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-11-02T20:16:29.871Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"flash":{}}	2025-11-02 20:16:30
KYuSFIZOYGFFL6TkS8KRGbo7RGSVKGsj	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-11-02T20:16:29.985Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"}}	2025-11-02 20:16:30
k8J46NduwFcdDJecvjuUfGgdepRlJGDG	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-11-02T20:16:30.036Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"flash":{"error":["Worklenz account already exists for email khoang@awakenservices.net."]}}	2025-11-02 20:16:31
m33aTl8Tth-A6_j36PZ3z1SQPJfuTFO4	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-11-02T20:16:30.042Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"flash":{}}	2025-11-02 20:16:31
KgawwVpbssfZ7cRwl0q2rFoOHiOPdRaT	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-11-02T20:16:30.056Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"flash":{}}	2025-11-02 20:16:31
coijJRR-tWuO12eZb8wiyYQeGJQE6N8L	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-11-02T20:16:30.175Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"}}	2025-11-02 20:16:31
Vv1OBxT64CMf-v5Myir17AFE3pnq3AnA	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-11-02T20:16:30.227Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"flash":{"error":["Worklenz account already exists for email khoang@awakenservices.net."]}}	2025-11-02 20:16:31
mQ0mruGU-4PVsWxlKjniEGPiuvLC2IxR	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-11-02T20:16:30.234Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"flash":{}}	2025-11-02 20:16:31
x3wjRy_v1QnUG8blvPpJ2BjEmOgCGilF	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-11-02T20:16:30.242Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"flash":{}}	2025-11-02 20:16:31
RXabWIybut0qSKoPu9PS_3qJJG7jXUfV	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-11-02T20:16:30.359Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"}}	2025-11-02 20:16:31
IC4vEGBtTrrX47IcfKohxFABFCXqPQwg	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-11-02T20:16:30.409Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"flash":{"error":["Worklenz account already exists for email khoang@awakenservices.net."]}}	2025-11-02 20:16:31
PIbT01DoW1XthJxo2slLECzTmQGqKFB7	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-11-02T20:16:30.415Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"flash":{}}	2025-11-02 20:16:31
tPiuJu6ek15cg3Gvu7CWLIRdg-Wel4be	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-11-02T20:16:30.426Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"flash":{}}	2025-11-02 20:16:31
IgtZt0MQUdD2ItDjBDzQBnwMKorKxxt4	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-11-02T20:16:30.537Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"}}	2025-11-02 20:16:31
mVSAQbU8GHKUGq50hr_StZqIaq0qGN41	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-11-02T20:16:30.590Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"flash":{"error":["Worklenz account already exists for email khoang@awakenservices.net."]}}	2025-11-02 20:16:31
mG1hLyneZhplQ6GVDMHFJAmWlcW3TL2c	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-11-02T20:16:30.598Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"flash":{}}	2025-11-02 20:16:31
YpR1N0xaRUr0DLqIbQr5aPIzonKecJaq	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-11-02T20:16:30.607Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"flash":{}}	2025-11-02 20:16:31
PcHM9iL-9wW-P29Cj00RdVW_O-8E7KG4	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-11-02T20:16:30.721Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"}}	2025-11-02 20:16:31
P2SWLufxxx-ys6VCxmEl8rpM39JsQiWr	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-11-02T20:16:30.772Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"flash":{"error":["Worklenz account already exists for email khoang@awakenservices.net."]}}	2025-11-02 20:16:31
IcNyaks0ibXkPnUo_jIL139xi1ETq4Xz	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-11-02T20:16:30.780Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"flash":{}}	2025-11-02 20:16:31
ccCE4UpzF9ECXvhTbbxTfzNYp0uOgA0i	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-11-02T20:16:30.790Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"flash":{}}	2025-11-02 20:16:31
tuuX1dDH4V0U2GJwhSDYyFj6PqwY7Mdo	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-11-02T20:16:30.890Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"}}	2025-11-02 20:16:31
f-foCEFGQOTevsrLceAqj_o_nOlt-452	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-11-02T20:16:30.939Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"flash":{"error":["Worklenz account already exists for email khoang@awakenservices.net."]}}	2025-11-02 20:16:31
BvOZ0IeqFgi7G9i12RKu-PoEWFD2cNmv	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-11-02T20:16:30.955Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"flash":{}}	2025-11-02 20:16:31
8WAWR-c59HhCKbWszQAAY6z964fNcKW2	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-11-02T20:16:30.964Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"flash":{}}	2025-11-02 20:16:31
pwGWgBruo6Bnwi1ND3JfbUVwDBdByZw9	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-11-02T20:16:31.064Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"}}	2025-11-02 20:16:32
DRkAwavLxCVNpXjq5i-nWpqiz1n2bUun	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-11-02T20:16:31.114Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"flash":{"error":["Worklenz account already exists for email khoang@awakenservices.net."]}}	2025-11-02 20:16:32
D6g2MnaMLCbFFDu2xGbsKoPnWgm6AgjU	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-11-02T20:16:31.120Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"flash":{}}	2025-11-02 20:16:32
7aMy_GdzWjS1yCxUP3J0INTWOn8M8MPX	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-11-02T20:16:31.130Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"flash":{}}	2025-11-02 20:16:32
NeCuTxylH6p2-DU_D1AlX9h9YGFF1aQG	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-11-02T20:16:31.239Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"}}	2025-11-02 20:16:32
jYmGuby09qNF87AJD5JIEoVEk8DtbmRF	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-11-02T20:16:31.290Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"flash":{"error":["Worklenz account already exists for email khoang@awakenservices.net."]}}	2025-11-02 20:16:32
M7OdRMZIXzQpyyEq02Ya1qrl5l5eK_RC	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-11-02T20:16:31.297Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"flash":{}}	2025-11-02 20:16:32
yYk79KfaJkUhHtEz8-TRlSoK_XuUzpv5	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-11-02T20:16:31.303Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"flash":{}}	2025-11-02 20:16:32
R3ahAHH6YfJ2q_NaCx6g2OpNVObdOUF1	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-11-02T20:16:31.416Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"}}	2025-11-02 20:16:32
IIkVTjhprXLZ-g2HKbO0rLOUEjLNtYWN	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-11-02T20:16:31.468Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"flash":{"error":["Worklenz account already exists for email khoang@awakenservices.net."]}}	2025-11-02 20:16:32
Uljs4IZ9pkK197-oRQFnppjBSF07-sJE	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-11-02T20:16:31.476Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"flash":{}}	2025-11-02 20:16:32
5AU_fQ66tBx2TATW4ozO3dV8iA7YADjt	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-11-02T20:16:31.486Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"flash":{}}	2025-11-02 20:16:32
jeKvukXZtjc7o0Ch7lWhM6R7pYVCeYoR	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-11-02T20:16:32.326Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"csrfToken":"e6156b28874230315bbdb3237cb44de559446485528f2c142c009b6f17dc2c827620d344062100e390faba07ca56cac92ee1c3c344ac8d22e3fbdc915db38e9d7bc2f8b90f6f94399f60ad1a7854b704f186d8bf4cb7f1a3cafd399db651c9e2ad411565886ad8d1b14a5252a27f97d10096257e5213557a3650902a22bf64a4"}	2025-11-02 20:16:33
bRQYzaceoM8vFk7xHGm9AGA1tYJIGeMM	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-11-02T20:16:47.136Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"flash":{}}	2025-11-02 20:16:48
_9lx4Io89mik64xz0hftrewzSCGP4sdo	{"cookie":{"originalMaxAge":2592000000,"expires":"2025-11-02T20:38:22.547Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"passport":{"user":{"id":"6f5e7931-2674-409a-9b5f-b51d4c5377fe"}},"flash":{},"csrfToken":"99f6878fe3d216e9df2d63019485a70a206a25d399af5501a18f6a3922a854b59261f86abaca1231591f67518eac325d148b6b1adca5f2006350d017ef29e24c19587730dc62b7eb855f21c9ae899c07957dddd0b753b4f5537704d3edeba160e500a5cb402792e5f01b39f2b82ba84630e860cc5ecaf464c294d0e13e0a38ac"}	2025-11-02 20:53:32
\.


--
-- Data for Name: project_access_levels; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.project_access_levels (id, name, key) FROM stdin;
ccc16515-b296-4972-b7c4-fe95d9cfe4ea	Admin	ADMIN
0accb410-9654-48b4-b191-90dd8810a6a5	Member	MEMBER
a7ee56f7-53b2-4377-b5f2-265365d9bae4	Project Manager	PROJECT_MANAGER
\.


--
-- Data for Name: project_categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.project_categories (id, name, color_code, team_id, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: project_comment_mentions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.project_comment_mentions (comment_id, mentioned_index, mentioned_by, informed_by, created_at) FROM stdin;
\.


--
-- Data for Name: project_comments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.project_comments (id, content, created_by, project_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: project_folders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.project_folders (id, name, key, color_code, created_by, parent_folder_id, team_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: project_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.project_logs (id, team_id, project_id, description, created_at) FROM stdin;
\.


--
-- Data for Name: project_member_allocations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.project_member_allocations (id, project_id, team_member_id, allocated_from, allocated_to, seconds_per_day) FROM stdin;
\.


--
-- Data for Name: project_members; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.project_members (id, team_member_id, project_access_level_id, project_id, role_id, created_at, default_view) FROM stdin;
94761ea8-c181-4442-af14-7c57bf66b198	2a1a966e-0acd-4992-a602-e0f40dd81324	a7ee56f7-53b2-4377-b5f2-265365d9bae4	ce10828c-6c4d-44a8-a374-cd6e46d74fa7	8226535d-fceb-4270-ba77-8e224ed44472	2025-10-03 19:51:50.679204+00	TASK_LIST
5731a61f-6e82-4e46-9c79-aed238a65e02	7831ea58-9057-4b8d-b3fe-8dc87f2fd007	a7ee56f7-53b2-4377-b5f2-265365d9bae4	c8eeeead-cd9e-43c9-9b30-409e50e31e52	50d9f631-34b9-4eeb-8328-f6b4d1b179a5	2025-10-03 19:54:27.847852+00	TASK_LIST
\.


--
-- Data for Name: project_phases; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.project_phases (id, name, color_code, project_id, created_at, start_date, end_date, sort_index) FROM stdin;
\.


--
-- Data for Name: project_subscribers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.project_subscribers (id, user_id, project_id, team_member_id, created_at) FROM stdin;
\.


--
-- Data for Name: project_task_list_cols; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.project_task_list_cols (id, name, key, index, pinned, project_id, custom_column, custom_column_obj) FROM stdin;
073e1d68-a0ad-4bd4-ae24-d41ede9effb5	Key	KEY	0	f	ce10828c-6c4d-44a8-a374-cd6e46d74fa7	f	\N
1a425835-30d1-45a2-a07c-a5eb4c61243b	Description	DESCRIPTION	2	f	ce10828c-6c4d-44a8-a374-cd6e46d74fa7	f	\N
667841fe-cd35-4c94-a10a-fa4afef1816e	Progress	PROGRESS	3	t	ce10828c-6c4d-44a8-a374-cd6e46d74fa7	f	\N
3da68c2b-7b81-4e71-bf9a-2538f00831fd	Status	STATUS	4	t	ce10828c-6c4d-44a8-a374-cd6e46d74fa7	f	\N
225039ef-4d9d-40ab-880b-f01288db208c	Members	ASSIGNEES	5	t	ce10828c-6c4d-44a8-a374-cd6e46d74fa7	f	\N
e32b9c80-69c8-42bb-8cbe-84ac3778f170	Labels	LABELS	6	t	ce10828c-6c4d-44a8-a374-cd6e46d74fa7	f	\N
371cf363-1521-4873-809b-eb0255fec286	Phase	PHASE	7	t	ce10828c-6c4d-44a8-a374-cd6e46d74fa7	f	\N
3016e4c9-1781-4f20-b337-cb6d7de93caf	Priority	PRIORITY	8	t	ce10828c-6c4d-44a8-a374-cd6e46d74fa7	f	\N
6fdbd9a8-b15d-45b8-9963-186a4f1f9272	Time Tracking	TIME_TRACKING	9	t	ce10828c-6c4d-44a8-a374-cd6e46d74fa7	f	\N
00440984-3106-4d76-8b62-21407a56af38	Estimation	ESTIMATION	10	f	ce10828c-6c4d-44a8-a374-cd6e46d74fa7	f	\N
0f244c9d-186c-4dc7-a483-e1212bea1597	Start Date	START_DATE	11	f	ce10828c-6c4d-44a8-a374-cd6e46d74fa7	f	\N
f67d9d44-2169-4135-9e48-60fff01fc56e	Due Date	DUE_DATE	12	t	ce10828c-6c4d-44a8-a374-cd6e46d74fa7	f	\N
f869a620-cc8f-4757-8a27-8a9547423f87	Completed Date	COMPLETED_DATE	13	f	ce10828c-6c4d-44a8-a374-cd6e46d74fa7	f	\N
f4d322e3-5fbc-4fba-a14a-e09974007b8c	Created Date	CREATED_DATE	14	f	ce10828c-6c4d-44a8-a374-cd6e46d74fa7	f	\N
4746ec8c-0d98-4e3f-8b61-a292657d69f2	Last Updated	LAST_UPDATED	15	f	ce10828c-6c4d-44a8-a374-cd6e46d74fa7	f	\N
ea5dc607-5456-4b2f-99cb-8dc67a04f52a	Reporter	REPORTER	16	f	ce10828c-6c4d-44a8-a374-cd6e46d74fa7	f	\N
b1a94a5b-f533-46f3-a5e8-26d83e5c11ca	Key	KEY	0	f	c8eeeead-cd9e-43c9-9b30-409e50e31e52	f	\N
31f7511e-7118-47c2-b15a-986b3b453b2f	Description	DESCRIPTION	2	f	c8eeeead-cd9e-43c9-9b30-409e50e31e52	f	\N
9f309390-280b-440c-897a-f57d9e6e8bbf	Progress	PROGRESS	3	t	c8eeeead-cd9e-43c9-9b30-409e50e31e52	f	\N
0f85287d-7044-4412-bd83-92d7f50786fe	Status	STATUS	4	t	c8eeeead-cd9e-43c9-9b30-409e50e31e52	f	\N
a90c01c0-15ab-40fe-b7fd-e91cc69a6843	Members	ASSIGNEES	5	t	c8eeeead-cd9e-43c9-9b30-409e50e31e52	f	\N
f6ca82f9-3184-4dce-9b09-1cc739c4e1bc	Labels	LABELS	6	t	c8eeeead-cd9e-43c9-9b30-409e50e31e52	f	\N
15d9cb2b-ec8c-4509-baf2-df5656a1ec0a	Phase	PHASE	7	t	c8eeeead-cd9e-43c9-9b30-409e50e31e52	f	\N
0a4388db-62e5-40e2-bad4-1dd94248cf84	Priority	PRIORITY	8	t	c8eeeead-cd9e-43c9-9b30-409e50e31e52	f	\N
f5758f54-400b-457b-a643-085ee0442ee6	Time Tracking	TIME_TRACKING	9	t	c8eeeead-cd9e-43c9-9b30-409e50e31e52	f	\N
0a7b1780-733d-482c-b142-f74acdce8048	Estimation	ESTIMATION	10	f	c8eeeead-cd9e-43c9-9b30-409e50e31e52	f	\N
fdec1fa0-7e02-4cad-9a1f-bae354dd4a77	Start Date	START_DATE	11	f	c8eeeead-cd9e-43c9-9b30-409e50e31e52	f	\N
48973ae6-3c5e-4be4-b95c-f0068cddfd76	Due Date	DUE_DATE	12	t	c8eeeead-cd9e-43c9-9b30-409e50e31e52	f	\N
85fd3c06-167f-4d1b-9726-ad03cbabcbec	Completed Date	COMPLETED_DATE	13	f	c8eeeead-cd9e-43c9-9b30-409e50e31e52	f	\N
b24506b6-e316-45f5-8d53-f6a32838d074	Created Date	CREATED_DATE	14	f	c8eeeead-cd9e-43c9-9b30-409e50e31e52	f	\N
1d5e13d1-0dea-47ad-bb5d-e13cca10c224	Last Updated	LAST_UPDATED	15	f	c8eeeead-cd9e-43c9-9b30-409e50e31e52	f	\N
c416d09f-3966-4675-b9b6-4102874829ea	Reporter	REPORTER	16	f	c8eeeead-cd9e-43c9-9b30-409e50e31e52	f	\N
\.


--
-- Data for Name: projects; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.projects (id, name, key, color_code, notes, tasks_counter, start_date, end_date, team_id, client_id, owner_id, status_id, created_at, updated_at, category_id, folder_id, phase_label, estimated_man_days, hours_per_day, health_id, estimated_working_days, use_manual_progress, use_weighted_progress, use_time_progress) FROM stdin;
ce10828c-6c4d-44a8-a374-cd6e46d74fa7	ERP	ERP	#3b7ad4	\N	1	\N	\N	cb828fd9-67f2-4982-b7f8-9ca34ee36d89	\N	6f5e7931-2674-409a-9b5f-b51d4c5377fe	24eccc00-582c-4eb8-b668-c4599e5c6e7a	2025-10-03 19:51:50.679204+00	2025-10-03 19:51:50.679204+00	\N	\N	Phase	0	8	\N	0	f	f	f
c8eeeead-cd9e-43c9-9b30-409e50e31e52	MVPO	MVP	#3b7ad4	\N	1	\N	\N	4481edd2-c821-44c6-b358-5d728efd4544	\N	bea2b5c0-3b6e-4550-b136-022ea9bb386e	24eccc00-582c-4eb8-b668-c4599e5c6e7a	2025-10-03 19:54:27.847852+00	2025-10-03 19:54:27.847852+00	\N	\N	Phase	0	8	\N	0	f	f	f
\.


--
-- Data for Name: pt_labels; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.pt_labels (id, name, color_code, template_id) FROM stdin;
\.


--
-- Data for Name: pt_phases; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.pt_phases (id, name, color_code, template_id) FROM stdin;
\.


--
-- Data for Name: pt_project_templates; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.pt_project_templates (id, name, key, description, phase_label, image_url, color_code) FROM stdin;
\.


--
-- Data for Name: pt_statuses; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.pt_statuses (id, name, template_id, category_id) FROM stdin;
\.


--
-- Data for Name: pt_task_labels; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.pt_task_labels (task_id, label_id) FROM stdin;
\.


--
-- Data for Name: pt_task_phases; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.pt_task_phases (task_id, phase_id) FROM stdin;
\.


--
-- Data for Name: pt_task_statuses; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.pt_task_statuses (id, name, template_id, team_id, category_id, sort_order) FROM stdin;
\.


--
-- Data for Name: pt_tasks; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.pt_tasks (id, name, description, total_minutes, sort_order, priority_id, template_id, parent_task_id, status_id) FROM stdin;
\.


--
-- Data for Name: role_permissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.role_permissions (role_id, permission_id) FROM stdin;
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.roles (id, name, team_id, default_role, admin_role, owner) FROM stdin;
8226535d-fceb-4270-ba77-8e224ed44472	Member	cb828fd9-67f2-4982-b7f8-9ca34ee36d89	t	f	f
257d1beb-befa-415a-a640-318ab1ed4ad6	Admin	cb828fd9-67f2-4982-b7f8-9ca34ee36d89	f	t	f
b3696a9e-751d-4df2-bc75-47cb49d652c0	Owner	cb828fd9-67f2-4982-b7f8-9ca34ee36d89	f	f	t
50d9f631-34b9-4eeb-8328-f6b4d1b179a5	Member	4481edd2-c821-44c6-b358-5d728efd4544	t	f	f
9b2d3275-cf76-4898-9733-3d9ea41d98fe	Admin	4481edd2-c821-44c6-b358-5d728efd4544	f	t	f
df298f52-7aa2-48a5-ae44-b88d1f6a4fb9	Owner	4481edd2-c821-44c6-b358-5d728efd4544	f	f	t
\.


--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.schema_migrations (version, applied_at) FROM stdin;
20250115000000-performance-indexes.sql	2025-10-03 19:41:12.510895
20250128000000-fix-window-function-error.sql	2025-10-03 19:41:12.593303
20250422132400-manual-task-progress.sql	2025-10-03 19:41:12.663158
20250423000000-subtask-manual-progress.sql	2025-10-03 19:41:12.732997
20250424000000-add-progress-and-weight-activity-types.sql	2025-10-03 19:41:12.808674
20250425000000-update-time-based-progress.sql	2025-10-03 19:41:12.872004
20250426000000-improve-parent-task-progress-calculation.sql	2025-10-03 19:41:12.936724
20250426000000-update-progress-mode-handlers.sql	2025-10-03 19:41:13.002912
20250427000000-fix-progress-mode-type.sql	2025-10-03 19:41:13.072966
20250506000000-fix-multilevel-subtask-progress-calculation.sql	2025-10-03 19:41:13.14405
consolidated-progress-migrations.sql	2025-10-03 19:41:13.221005
fix_duplicate_sort_orders.sql	2025-10-03 19:41:13.323484
user_deletion_logs.sql	2025-10-03 19:41:13.42368
\.


--
-- Data for Name: spam_emails; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.spam_emails (id, email, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: survey_answers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.survey_answers (id, response_id, question_id, answer_text, answer_json, created_at, updated_at) FROM stdin;
8956ab64-3d7d-44a9-a5be-54756e21af47	70baa712-8a93-4d1b-878f-5851fd4c0001	6d828135-0dc7-47a6-8901-406f002b3fcc	small_medium_business	\N	2025-10-03 19:51:08.779477	2025-10-03 19:51:08.779477
3da4e503-8d76-4ac1-94aa-d1ddf63d1269	70baa712-8a93-4d1b-878f-5851fd4c0001	5e026410-5b8a-4ada-b080-3cff26796b8c	software_developer	\N	2025-10-03 19:51:08.779477	2025-10-03 19:51:08.779477
9cb4164d-ccf0-4d11-8a26-b615ee19a6e6	70baa712-8a93-4d1b-878f-5851fd4c0001	379a42a9-1e1c-4e54-bccc-3d272a8558db	\N	["task_management", "team_collaboration", "resource_planning", "client_communication", "time_tracking", "other"]	2025-10-03 19:51:08.779477	2025-10-03 19:51:08.779477
63916054-77d9-4e8f-8290-dba0e603e287	70baa712-8a93-4d1b-878f-5851fd4c0001	84361e67-28a0-4455-bfab-c9e9600e1452	Trello	\N	2025-10-03 19:51:08.779477	2025-10-03 19:51:08.779477
243fcd2a-9241-4cd1-8da5-e82bb04a9583	70baa712-8a93-4d1b-878f-5851fd4c0001	68a9524b-f13c-4749-8e1b-f91f7dc02969	other	\N	2025-10-03 19:51:08.779477	2025-10-03 19:51:08.779477
652ba1ef-f463-437b-954f-517b315947da	b776b05a-44f9-41ad-ad1c-b5d02844076c	6d828135-0dc7-47a6-8901-406f002b3fcc	startup	\N	2025-10-03 19:54:15.115505	2025-10-03 19:54:15.115505
3b9526f7-c826-40cb-98c3-211b5df4442d	b776b05a-44f9-41ad-ad1c-b5d02844076c	5e026410-5b8a-4ada-b080-3cff26796b8c	designer	\N	2025-10-03 19:54:15.115505	2025-10-03 19:54:15.115505
517daf60-67fd-4a42-9c05-c031acb820b5	b776b05a-44f9-41ad-ad1c-b5d02844076c	379a42a9-1e1c-4e54-bccc-3d272a8558db	\N	["time_tracking"]	2025-10-03 19:54:15.115505	2025-10-03 19:54:15.115505
9d6ad7f8-b12c-475c-bb2f-6d039cf33c9c	b776b05a-44f9-41ad-ad1c-b5d02844076c	68a9524b-f13c-4749-8e1b-f91f7dc02969	twitter	\N	2025-10-03 19:54:15.115505	2025-10-03 19:54:15.115505
\.


--
-- Data for Name: survey_questions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.survey_questions (id, survey_id, question_key, question_type, is_required, sort_order, options, created_at, updated_at) FROM stdin;
6d828135-0dc7-47a6-8901-406f002b3fcc	a8b520cf-29b2-44b1-817b-3fa46401bb2b	organization_type	single_choice	t	1	["freelancer", "startup", "small_medium_business", "agency", "enterprise", "other"]	2025-10-03 19:41:12.382752	2025-10-03 19:41:12.382752
5e026410-5b8a-4ada-b080-3cff26796b8c	a8b520cf-29b2-44b1-817b-3fa46401bb2b	user_role	single_choice	t	2	["founder_ceo", "project_manager", "software_developer", "designer", "operations", "other"]	2025-10-03 19:41:12.382752	2025-10-03 19:41:12.382752
379a42a9-1e1c-4e54-bccc-3d272a8558db	a8b520cf-29b2-44b1-817b-3fa46401bb2b	main_use_cases	multiple_choice	t	3	["task_management", "team_collaboration", "resource_planning", "client_communication", "time_tracking", "other"]	2025-10-03 19:41:12.382752	2025-10-03 19:41:12.382752
84361e67-28a0-4455-bfab-c9e9600e1452	a8b520cf-29b2-44b1-817b-3fa46401bb2b	previous_tools	text	f	4	\N	2025-10-03 19:41:12.382752	2025-10-03 19:41:12.382752
68a9524b-f13c-4749-8e1b-f91f7dc02969	a8b520cf-29b2-44b1-817b-3fa46401bb2b	how_heard_about	single_choice	f	5	["google_search", "twitter", "linkedin", "friend_colleague", "blog_article", "other"]	2025-10-03 19:41:12.382752	2025-10-03 19:41:12.382752
\.


--
-- Data for Name: survey_responses; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.survey_responses (id, survey_id, user_id, is_completed, started_at, completed_at, created_at, updated_at) FROM stdin;
70baa712-8a93-4d1b-878f-5851fd4c0001	a8b520cf-29b2-44b1-817b-3fa46401bb2b	6f5e7931-2674-409a-9b5f-b51d4c5377fe	t	2025-10-03 19:51:08.777888	2025-10-03 19:51:08.777888	2025-10-03 19:51:08.777888	2025-10-03 19:51:08.777888
b776b05a-44f9-41ad-ad1c-b5d02844076c	a8b520cf-29b2-44b1-817b-3fa46401bb2b	bea2b5c0-3b6e-4550-b136-022ea9bb386e	t	2025-10-03 19:54:15.114184	2025-10-03 19:54:15.114184	2025-10-03 19:54:15.114184	2025-10-03 19:54:15.114184
\.


--
-- Data for Name: surveys; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.surveys (id, name, description, survey_type, is_active, created_at, updated_at) FROM stdin;
a8b520cf-29b2-44b1-817b-3fa46401bb2b	Account Setup Survey	Initial questionnaire during account setup to understand user needs	account_setup	t	2025-10-03 19:41:12.381273	2025-10-03 19:41:12.381273
\.


--
-- Data for Name: sys_license_types; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sys_license_types (id, name, key, description) FROM stdin;
d88bde9a-2bcf-4f05-bd13-183fa03080fa	Custom Subscription	CUSTOM	\N
7bdafd3f-d017-4509-9abb-53a1404a2ee0	Free Trial	TRIAL	\N
02e686f5-f374-47b8-8203-7544bc804332	Paddle Subscription	PADDLE	\N
b8ac434e-7cac-49ab-9c6a-3b388919cd49	Credit Subscription	CREDIT	\N
083da05d-2b75-4514-acd9-0f4b816da99d	Free Plan	FREE	\N
62f58a52-879e-4499-bc78-309e203251d8	Life Time Deal	LIFE_TIME_DEAL	\N
008196cf-6443-41f7-8182-7875ab7ee176	Self Hosted	SELF_HOSTED	\N
\.


--
-- Data for Name: sys_project_healths; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sys_project_healths (id, name, color_code, sort_order, is_default) FROM stdin;
8fdf8eb7-2c44-424d-9d56-78b0e87cc668	Not Set	#a9a9a9	0	t
f34ee8ca-1780-4dd0-bbf7-5e3ed9b4b434	Needs Attention	#fbc84c	1	f
9098b184-ca8e-4b5c-9e2e-26f92357c34a	At Risk	#f37070	2	f
86394436-3bf0-42e0-9189-692a6aacea12	Good	#75c997	3	f
\.


--
-- Data for Name: sys_project_statuses; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sys_project_statuses (id, name, color_code, icon, sort_order, is_default) FROM stdin;
fbca1aca-0462-4dfc-bcac-493197a54621	Cancelled	#f37070	close-circle	0	f
8e40c119-8f10-44e4-8a5c-e1f4850dbf6e	Blocked	#cbc8a1	stop	1	f
03f29edf-cbad-4ae2-8fae-13ae7abe36f0	On Hold	#cbc8a1	stop	2	f
24eccc00-582c-4eb8-b668-c4599e5c6e7a	Proposed	#cbc8a1	clock-circle	3	t
0959f078-743b-49e3-ae2d-9888d62c948c	In Planning	#cbc8a1	clock-circle	4	f
022d9e98-066b-4939-81e3-92092916f4db	In Progress	#80ca79	clock-circle	5	f
28868db1-1873-4793-85bf-a61c1afe4b8c	Completed	#80ca79	check-circle	6	f
84ce56fc-a32d-448e-89a1-d8d8b709b2eb	Continuous	#80ca79	clock-circle	7	f
\.


--
-- Data for Name: sys_task_status_categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sys_task_status_categories (id, name, color_code, index, is_todo, is_doing, is_done, description, color_code_dark) FROM stdin;
e7aa0bf3-b570-4a26-97a0-cd61f90c1323	To do	#a9a9a9	1	t	f	f	For tasks that have not been started.	#989898
7685a4e3-8d67-4250-ada7-bdb673eb1bbd	Doing	#70a6f3	2	f	t	f	For tasks that have been started.	#4190FF
11a8806e-9d0b-49f8-9c05-bb2d67628286	Done	#75c997	3	f	f	t	For tasks that have been completed.	#46D980
\.


--
-- Data for Name: task_activity_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.task_activity_logs (id, task_id, team_id, attribute_type, user_id, log_type, old_value, new_value, prev_string, next_string, created_at, project_id) FROM stdin;
\.


--
-- Data for Name: task_attachments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.task_attachments (id, name, size, type, task_id, team_id, project_id, uploaded_by, created_at) FROM stdin;
\.


--
-- Data for Name: task_comment_attachments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.task_comment_attachments (id, name, size, type, task_id, comment_id, team_id, project_id, created_at) FROM stdin;
\.


--
-- Data for Name: task_comment_contents; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.task_comment_contents (index, comment_id, team_member_id, text_content) FROM stdin;
\.


--
-- Data for Name: task_comment_mentions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.task_comment_mentions (comment_id, mentioned_index, mentioned_by, informed_by, created_at) FROM stdin;
\.


--
-- Data for Name: task_comment_reactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.task_comment_reactions (id, comment_id, user_id, team_member_id, reaction_type, created_at) FROM stdin;
\.


--
-- Data for Name: task_comments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.task_comments (id, user_id, team_member_id, task_id, created_at, updated_at, ses_message_id) FROM stdin;
\.


--
-- Data for Name: task_dependencies; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.task_dependencies (id, task_id, related_task_id, dependency_type, created_at) FROM stdin;
\.


--
-- Data for Name: task_labels; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.task_labels (task_id, label_id) FROM stdin;
\.


--
-- Data for Name: task_phase; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.task_phase (task_id, phase_id) FROM stdin;
\.


--
-- Data for Name: task_priorities; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.task_priorities (id, name, value, color_code, color_code_dark) FROM stdin;
28bc4612-0cd7-427a-949a-f7d3d7a1e601	Medium	1	#fbc84c	#FFC227
778f22fd-240d-4e9e-b2c3-161857922d2d	Low	0	#75c997	#46D980
1745de5d-d52e-41dd-b801-cc8615d9904b	High	2	#f37070	#FF4141
\.


--
-- Data for Name: task_recurring_schedules; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.task_recurring_schedules (id, schedule_type, days_of_week, day_of_month, week_of_month, interval_days, interval_weeks, interval_months, start_date, end_date, created_at) FROM stdin;
\.


--
-- Data for Name: task_recurring_templates; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.task_recurring_templates (id, task_id, schedule_id, name, description, end_date, priority_id, project_id, assignees, labels, created_at) FROM stdin;
\.


--
-- Data for Name: task_statuses; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.task_statuses (id, name, project_id, team_id, category_id, sort_order) FROM stdin;
efb766c0-a547-4940-b326-5bab991a52a9	To do	ce10828c-6c4d-44a8-a374-cd6e46d74fa7	cb828fd9-67f2-4982-b7f8-9ca34ee36d89	e7aa0bf3-b570-4a26-97a0-cd61f90c1323	0
4d883e0b-82f8-4642-8d2d-6af7f4b86de8	Doing	ce10828c-6c4d-44a8-a374-cd6e46d74fa7	cb828fd9-67f2-4982-b7f8-9ca34ee36d89	7685a4e3-8d67-4250-ada7-bdb673eb1bbd	0
13b023c0-9557-4208-add5-5cfc0d4d9cf6	Done	ce10828c-6c4d-44a8-a374-cd6e46d74fa7	cb828fd9-67f2-4982-b7f8-9ca34ee36d89	11a8806e-9d0b-49f8-9c05-bb2d67628286	0
bbb6f8c0-bad8-48d9-853e-a80aba839d6f	To do	c8eeeead-cd9e-43c9-9b30-409e50e31e52	4481edd2-c821-44c6-b358-5d728efd4544	e7aa0bf3-b570-4a26-97a0-cd61f90c1323	0
8ef596b2-87e4-482e-a5b1-d7512d62ba2d	Doing	c8eeeead-cd9e-43c9-9b30-409e50e31e52	4481edd2-c821-44c6-b358-5d728efd4544	7685a4e3-8d67-4250-ada7-bdb673eb1bbd	0
b54214f8-602d-428c-9af7-94e7552653fa	Done	c8eeeead-cd9e-43c9-9b30-409e50e31e52	4481edd2-c821-44c6-b358-5d728efd4544	11a8806e-9d0b-49f8-9c05-bb2d67628286	0
\.


--
-- Data for Name: task_subscribers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.task_subscribers (id, user_id, task_id, team_member_id, action, created_at) FROM stdin;
\.


--
-- Data for Name: task_templates; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.task_templates (id, name, team_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: task_templates_tasks; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.task_templates_tasks (name, template_id, total_minutes) FROM stdin;
\.


--
-- Data for Name: task_timers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.task_timers (task_id, user_id, start_time) FROM stdin;
\.


--
-- Data for Name: task_updates; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.task_updates (id, type, reporter_id, task_id, user_id, team_id, project_id, is_sent, created_at, retry_count) FROM stdin;
\.


--
-- Data for Name: task_work_log; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.task_work_log (id, time_spent, description, logged_by_timer, task_id, user_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: tasks; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tasks (id, name, description, done, total_minutes, archived, task_no, start_date, end_date, priority_id, project_id, reporter_id, parent_task_id, status_id, completed_at, created_at, updated_at, sort_order, roadmap_sort_order, status_sort_order, priority_sort_order, phase_sort_order, billable, schedule_id, manual_progress, progress_value, progress_mode, weight) FROM stdin;
4c6bb8e9-ecae-4d1f-bfc6-95febcf058ae	Task 1 - Test	\N	f	0	f	1	\N	\N	28bc4612-0cd7-427a-949a-f7d3d7a1e601	ce10828c-6c4d-44a8-a374-cd6e46d74fa7	6f5e7931-2674-409a-9b5f-b51d4c5377fe	\N	efb766c0-a547-4940-b326-5bab991a52a9	\N	2025-10-03 19:51:50.679204+00	2025-10-03 19:51:50.679204+00	1	0	0	0	0	t	\N	f	\N	default	\N
5a9c753a-b188-49c9-aaa4-46e330dbbc89	asd	\N	f	0	f	1	\N	\N	28bc4612-0cd7-427a-949a-f7d3d7a1e601	c8eeeead-cd9e-43c9-9b30-409e50e31e52	bea2b5c0-3b6e-4550-b136-022ea9bb386e	\N	bbb6f8c0-bad8-48d9-853e-a80aba839d6f	\N	2025-10-03 19:54:27.847852+00	2025-10-03 19:54:27.847852+00	1	0	0	0	0	t	\N	f	\N	default	\N
\.


--
-- Data for Name: tasks_assignees; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tasks_assignees (task_id, project_member_id, team_member_id, created_at, updated_at, assigned_by) FROM stdin;
4c6bb8e9-ecae-4d1f-bfc6-95febcf058ae	94761ea8-c181-4442-af14-7c57bf66b198	2a1a966e-0acd-4992-a602-e0f40dd81324	2025-10-03 19:51:50.679204+00	2025-10-03 19:51:50.679204+00	6f5e7931-2674-409a-9b5f-b51d4c5377fe
5a9c753a-b188-49c9-aaa4-46e330dbbc89	5731a61f-6e82-4e46-9c79-aed238a65e02	7831ea58-9057-4b8d-b3fe-8dc87f2fd007	2025-10-03 19:54:27.847852+00	2025-10-03 19:54:27.847852+00	bea2b5c0-3b6e-4550-b136-022ea9bb386e
\.


--
-- Data for Name: team_labels; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.team_labels (id, name, color_code, team_id) FROM stdin;
\.


--
-- Data for Name: team_members; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.team_members (id, user_id, team_id, role_id, job_title_id, created_at, updated_at, active) FROM stdin;
2a1a966e-0acd-4992-a602-e0f40dd81324	6f5e7931-2674-409a-9b5f-b51d4c5377fe	cb828fd9-67f2-4982-b7f8-9ca34ee36d89	b3696a9e-751d-4df2-bc75-47cb49d652c0	\N	2025-10-03 19:50:26.41415+00	2025-10-03 19:50:26.41415+00	t
3f735559-773e-42c9-9154-addb16c111ef	\N	cb828fd9-67f2-4982-b7f8-9ca34ee36d89	8226535d-fceb-4270-ba77-8e224ed44472	\N	2025-10-03 19:51:50.679204+00	2025-10-03 19:51:50.679204+00	t
7831ea58-9057-4b8d-b3fe-8dc87f2fd007	bea2b5c0-3b6e-4550-b136-022ea9bb386e	4481edd2-c821-44c6-b358-5d728efd4544	df298f52-7aa2-48a5-ae44-b88d1f6a4fb9	\N	2025-10-03 19:53:46.50038+00	2025-10-03 19:53:46.50038+00	t
8e5484ee-b02c-44b3-a2cc-b3fa3010c376	bea2b5c0-3b6e-4550-b136-022ea9bb386e	cb828fd9-67f2-4982-b7f8-9ca34ee36d89	257d1beb-befa-415a-a640-318ab1ed4ad6	\N	2025-10-03 19:53:00.053756+00	2025-10-03 19:53:00.053756+00	t
44b59eee-6011-4182-b6f7-47f56aced5cf	\N	cb828fd9-67f2-4982-b7f8-9ca34ee36d89	8226535d-fceb-4270-ba77-8e224ed44472	\N	2025-10-03 20:53:31.219379+00	2025-10-03 20:53:31.219379+00	t
\.


--
-- Data for Name: teams; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.teams (id, name, user_id, created_at, updated_at, organization_id) FROM stdin;
cb828fd9-67f2-4982-b7f8-9ca34ee36d89	Awaken Services	6f5e7931-2674-409a-9b5f-b51d4c5377fe	2025-10-03 19:50:26.41415+00	2025-10-03 19:50:26.41415+00	b05df0ba-e2cc-4908-a92a-71f7bc1d5599
4481edd2-c821-44c6-b358-5d728efd4544	Naturewise	bea2b5c0-3b6e-4550-b136-022ea9bb386e	2025-10-03 19:53:46.50038+00	2025-10-03 19:53:46.50038+00	311edbbc-b42b-42b5-807a-41d172815e9e
\.


--
-- Data for Name: timezones; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.timezones (id, name, abbrev, utc_offset) FROM stdin;
62942110-b0c7-4631-8e29-be3dc42dd2c1	Pacific/Wallis	+12	12:00:00
4047ba6d-2740-4d77-9c6e-d71522b7662c	Pacific/Tahiti	-10	-10:00:00
19d4cce9-96ec-4831-9bb8-6074e1c81b40	Pacific/Apia	+13	13:00:00
ee23c39c-8516-4bb0-b4db-7c0307839e50	Pacific/Majuro	+12	12:00:00
31c9d62b-acce-468a-a944-4f5de89d6c4c	Pacific/Pitcairn	-08	-08:00:00
27380cb8-1d06-47df-a66f-e5444d973e15	Pacific/Samoa	SST	-11:00:00
fca20928-b434-4a38-b4fa-fec3ad64d9aa	Pacific/Bougainville	+11	11:00:00
fbfff8d6-d75b-410f-ba0e-1fde44c9b943	Pacific/Pohnpei	+11	11:00:00
7a3d8a5a-5d5c-47dd-b9cf-986679f715d1	Pacific/Easter	-05	-05:00:00
ae659879-6e3c-4e29-8453-6f3733cc8010	Pacific/Saipan	ChST	10:00:00
43ac56b7-e660-422e-b631-9fe9662f7473	Pacific/Noumea	+11	11:00:00
fc0c431d-4027-4c27-8193-f7c0761a333a	Pacific/Palau	+09	09:00:00
005e6669-ea80-4f2c-bd70-0bc79d79e7b7	Pacific/Auckland	NZDT	13:00:00
3305e060-24c5-4676-8968-7d96b071b153	Pacific/Kanton	+13	13:00:00
534b0981-9f7c-414f-ad40-83cde327a2b7	Pacific/Kiritimati	+14	14:00:00
ec953a11-742f-429d-ad22-473ddeec2ad8	Pacific/Nauru	+12	12:00:00
433f7000-7b4b-4302-aaab-8f10b2180c3b	Pacific/Galapagos	-06	-06:00:00
2a3812c6-235f-482e-8f31-f6503922eb33	Pacific/Chatham	+1345	13:45:00
befed9b6-18b2-4cec-8e64-3b4600976176	Pacific/Gambier	-09	-09:00:00
6e497765-5315-4a52-b5ee-00cd5c769b7c	Pacific/Funafuti	+12	12:00:00
e60b1374-a554-46c8-8db4-1aada0211665	Pacific/Guam	ChST	10:00:00
36ef7866-0799-4b3f-b687-62ea162fe425	Pacific/Rarotonga	-10	-10:00:00
997ef751-b00e-4335-9fe4-db91b5ac5fb8	Pacific/Niue	-11	-11:00:00
6cc302e7-1d35-432e-a0dd-b57797172db2	Pacific/Yap	+10	10:00:00
824882e3-7cd7-4e35-a924-75c9bdf08bca	Pacific/Kosrae	+11	11:00:00
47175eaa-7359-40b3-a7a1-cc7cecfabeeb	Pacific/Marquesas	-0930	-09:30:00
bd3f5b44-399e-41ab-a0c7-697db216e70e	Pacific/Wake	+12	12:00:00
999eef1b-2234-4ad1-b85c-61ad9aa9a0a6	Pacific/Fakaofo	+13	13:00:00
653c9cc1-4722-4546-ab29-5bf93464b34d	Pacific/Pago_Pago	SST	-11:00:00
e7e28fce-e79e-4139-9b6b-aa2e7b16dd3e	Pacific/Honolulu	HST	-10:00:00
657c37df-844e-4806-bd54-021ff152399c	Pacific/Kwajalein	+12	12:00:00
da40bb4e-c0a6-4fae-9d3b-8e884dc79e55	Pacific/Johnston	HST	-10:00:00
960112eb-6791-475c-a604-31f6478d0f06	Pacific/Efate	+11	11:00:00
76427370-3fb6-4365-94f2-49bd99162bbd	Pacific/Norfolk	+11	11:00:00
24381cb8-ae13-4f75-8002-6f1421ec4018	Pacific/Guadalcanal	+11	11:00:00
65019e89-df18-445b-bedf-ad1986409307	Pacific/Tarawa	+12	12:00:00
394c5185-9b3d-4e87-a1c1-59efd54358a5	Pacific/Chuuk	+10	10:00:00
e039c857-e75c-4696-8048-74fd91a7c191	Pacific/Port_Moresby	+10	10:00:00
f8418a84-7475-4a9d-8e3f-fd1f4b3ef6c0	Pacific/Fiji	+12	12:00:00
ff923226-2ce4-4cd6-a6c9-a1b9e364f5de	Pacific/Tongatapu	+13	13:00:00
b5760f47-3173-48ed-af1b-46dea2c73028	Pacific/Midway	SST	-11:00:00
0e32a797-76ec-4f8a-bc19-35eb82d105d0	Africa/Luanda	WAT	01:00:00
c236b5c0-b404-4b27-91f6-425f7bee1b5a	Africa/El_Aaiun	+01	01:00:00
cf331dbe-e493-42be-bfdb-2f3e67db5d40	Africa/Bissau	GMT	00:00:00
823ae687-08fb-4026-9de6-81224089d5bb	Africa/Timbuktu	GMT	00:00:00
a4b54ccc-38d0-490f-9a69-7ec823742ee4	Africa/Mbabane	SAST	02:00:00
17475679-d2f0-408c-98b2-07f8c3341012	Africa/Lubumbashi	CAT	02:00:00
b5cec936-e081-4893-8669-b46f808eb722	Africa/Tripoli	EET	02:00:00
fa8c9468-6ec6-42c0-85a5-8b90410665f9	Africa/Kampala	EAT	03:00:00
02501cc4-07d9-47a6-b598-f8d2cb579a6b	Africa/Monrovia	GMT	00:00:00
cbc7b566-c3bc-4763-b0c1-2e300ebd430f	Africa/Gaborone	CAT	02:00:00
92ce0e26-b3e1-460b-9110-7f62803645f1	Africa/Dar_es_Salaam	EAT	03:00:00
0d06061f-a5d9-4150-ac75-186bb074a5a2	Africa/Bamako	GMT	00:00:00
4c2abecb-22ea-4dde-96c8-1b967a76667f	Africa/Douala	WAT	01:00:00
d5656411-eb02-4db5-952e-a0c724a0dedf	Africa/Maseru	SAST	02:00:00
b0c0ee56-926a-4a46-a1dc-42850e129bba	Africa/Sao_Tome	GMT	00:00:00
9eaf4752-4177-45b1-9dba-bad82b9c73fa	Africa/Windhoek	CAT	02:00:00
8d5b7b79-1fc2-4123-b97f-3fc9c4f7ada5	Africa/Ndjamena	WAT	01:00:00
a28f6aac-4b29-46d8-8d5a-1e0582bf10d9	Africa/Juba	CAT	02:00:00
b2bfdd9c-c129-49e5-aed1-c8bbaf4111b6	Africa/Khartoum	CAT	02:00:00
cfc61509-4ab3-4a09-9218-93dbcfff03fb	Africa/Maputo	CAT	02:00:00
5be77c8e-fbc9-4748-9f08-5d2298e62778	Africa/Brazzaville	WAT	01:00:00
672d7bec-6267-4cec-924c-94db1a032854	Africa/Lusaka	CAT	02:00:00
3d5ad6b0-6eba-4143-9e26-6dcf5df77dbf	Africa/Algiers	CET	01:00:00
78f1624e-85a1-4d1f-bc92-cdee0396a619	Africa/Banjul	GMT	00:00:00
27582659-57f3-46d0-b7f8-d29c522f5fbc	Africa/Malabo	WAT	01:00:00
536b9089-22e8-4a66-bf74-e5055849aaf0	Africa/Cairo	EEST	03:00:00
0ff5f5bf-4c79-42e7-8d24-d19e31f423de	Africa/Mogadishu	EAT	03:00:00
947e2ccc-935c-45ca-b6c7-44ea6a8f86cb	Africa/Asmara	EAT	03:00:00
a5dff382-68cb-4c8f-92b3-22c3ddcbeae6	Africa/Addis_Ababa	EAT	03:00:00
2d36cc73-a37a-44fe-a46a-c6958a60005b	Africa/Casablanca	+01	01:00:00
e504da64-567e-4073-b0b4-e6eb83f01b59	Africa/Libreville	WAT	01:00:00
0bb6d5a7-9f4d-4f57-b182-f7ff8fa54dcb	Africa/Dakar	GMT	00:00:00
c24786ff-4389-4cd2-bbea-c83b568a453a	Africa/Porto-Novo	WAT	01:00:00
f54443cf-e9d8-4cf1-b680-c1d822640daf	Africa/Accra	GMT	00:00:00
fb67f941-3d68-4ba8-a75e-c666b98e5974	Africa/Djibouti	EAT	03:00:00
0253593c-4a72-4244-9c0a-191899b80951	Africa/Niamey	WAT	01:00:00
87dff7ef-cff0-4ae8-bb85-932acfa420d7	Africa/Nouakchott	GMT	00:00:00
db2617aa-0c1d-4d29-82a8-122dc1bcb205	Africa/Blantyre	CAT	02:00:00
aa61d945-5afc-449c-a0e9-4c2cb16cb0b2	Africa/Kigali	CAT	02:00:00
05200850-60cc-4b36-bfcb-2968f912108e	Africa/Nairobi	EAT	03:00:00
4168ad1e-92a4-46a9-a2ee-5857b6a7c08d	Africa/Abidjan	GMT	00:00:00
2d93c34e-a724-4cbc-8caa-fcf6cab9e7c8	Africa/Tunis	CET	01:00:00
e6395783-fabf-4ab7-b6c7-5cff22ebed21	Africa/Harare	CAT	02:00:00
e1b7cf52-dac7-47f5-b6c2-0902efb42433	Africa/Ceuta	CEST	02:00:00
31269c3a-6383-4e8c-8559-143bdf1767ed	Africa/Lagos	WAT	01:00:00
aaa22f33-4051-4e26-b8b2-cbc0a95a47c5	Africa/Conakry	GMT	00:00:00
87128182-6065-4f93-a135-f482db6c65ad	Africa/Ouagadougou	GMT	00:00:00
9eb062eb-4853-4f56-89ca-703e8912f656	Africa/Bangui	WAT	01:00:00
0706999b-bd9d-4a4b-8386-aab4bb7a2c2d	Africa/Bujumbura	CAT	02:00:00
ae9ff1ce-bb51-4be4-82d8-c69bc161a6f1	Africa/Kinshasa	WAT	01:00:00
9af81bb4-0aa5-4ecc-9307-dc6e2461cc29	Africa/Lome	GMT	00:00:00
b4be2605-225c-482c-a738-e46bbc26bc36	Africa/Johannesburg	SAST	02:00:00
3cbb8bcb-bb45-4c19-ad7d-20ef5183c4c1	Africa/Freetown	GMT	00:00:00
69084900-f2cd-42c2-b06e-2a63f1af9efa	localtime	UTC	00:00:00
1873320e-12cb-453c-8cc1-7ec00de5d4c2	Factory	-00	00:00:00
0acb8ef9-f6f6-43f0-bc99-71ec8b2870f5	GMT	GMT	00:00:00
fff69c86-9db7-4b06-bdc5-74d0c0177170	UTC	UTC	00:00:00
eeff349d-8080-41c8-a76b-7307c11794b1	Atlantic/Bermuda	ADT	-03:00:00
74687de9-523c-4233-83ee-f75efd066fdf	Atlantic/Canary	WEST	01:00:00
9f57746e-5e16-457b-a73c-01214c3ca766	Atlantic/Reykjavik	GMT	00:00:00
d43c2a91-8f39-4f9a-8470-b644597f4dfd	Atlantic/Stanley	-03	-03:00:00
73899ba7-b6bf-4e8f-b31d-226b4dba9b30	Atlantic/Azores	+00	00:00:00
53867e3c-4b59-4836-8b54-2ecf9259f7b4	Atlantic/Cape_Verde	-01	-01:00:00
4a5ca84b-a395-4718-a6a7-3387181fe2ff	Atlantic/Faroe	WEST	01:00:00
fe688637-fb25-407e-a3b8-37559b7615c2	Atlantic/St_Helena	GMT	00:00:00
726634d6-b124-4948-9914-7e1a551fbfab	Atlantic/South_Georgia	-02	-02:00:00
0cde1ea5-7b23-4aa0-a1b5-0ba31893e1c5	Atlantic/Jan_Mayen	CEST	02:00:00
c6c2fafe-4e72-420c-882c-607008f14b1e	Atlantic/Madeira	WEST	01:00:00
17e5c2fe-a721-4bae-8c06-406d7ce45f87	Indian/Chagos	+06	06:00:00
01c5ac14-583c-4a04-83b1-80bd6c485bd2	Indian/Maldives	+05	05:00:00
093d8e35-80d3-46ec-9499-f3b22242e4ed	Indian/Antananarivo	EAT	03:00:00
defdf9c6-9a43-42f6-b5e5-68dc5dd840ad	Indian/Kerguelen	+05	05:00:00
e0873355-fa65-4b97-beca-8c2864a36542	Indian/Christmas	+07	07:00:00
85eb95c4-9e5f-4fac-89e3-cbc768eed4c9	Indian/Reunion	+04	04:00:00
7fffc72e-f974-4508-be0b-2f257270e1af	Indian/Mahe	+04	04:00:00
11c84318-9740-48ed-b130-488084670dc5	Indian/Mauritius	+04	04:00:00
59467ad4-41d2-4362-b0b8-2089cc5711cb	Indian/Comoro	EAT	03:00:00
1948b9e5-011a-462a-a4f2-ef62d263f392	Indian/Mayotte	EAT	03:00:00
a1cac800-d94b-4914-be44-e541102a6588	Indian/Cocos	+0630	06:30:00
ecceebd9-62de-408f-8445-e30adec3de2a	posixrules	EDT	-04:00:00
82096685-8f0e-48c8-9b15-f304de6dc35d	Europe/Ljubljana	CEST	02:00:00
ba078a58-d2fc-42ab-8ce2-ec5c5e463ebc	Europe/Copenhagen	CEST	02:00:00
c2acd074-eb11-4b68-94ea-f47c06a1d865	Europe/Warsaw	CEST	02:00:00
49d1cbc6-3d1a-4ebf-aabc-9d0a4295711e	Europe/Dublin	IST	01:00:00
1d40c449-bede-44e3-8185-5c3fe0d7978b	Europe/London	BST	01:00:00
b6893777-a610-445f-8e95-48a23c36b9e3	Europe/Athens	EEST	03:00:00
0d130007-c84f-40de-8fb0-f15f55b3059f	Europe/Podgorica	CEST	02:00:00
7eb7a1b5-548d-4cec-bafd-064ea83cae6e	Europe/Paris	CEST	02:00:00
5f962fe4-0367-499b-bdcf-e74e255452c0	Europe/Mariehamn	EEST	03:00:00
66f7656f-0e72-4935-99e7-fd6d4e5f39a4	Europe/Samara	+04	04:00:00
9605d85f-3805-4543-ae37-2da57ea97c83	Europe/Istanbul	+03	03:00:00
3b5edcbf-2979-4c4e-bbca-11320ecf992a	Europe/Vilnius	EEST	03:00:00
8f26442e-b48a-485d-84c9-1f38b5ab061a	Europe/Kaliningrad	EET	02:00:00
c44078dc-fa5b-4b3c-9c23-4e35e14f502e	Europe/Oslo	CEST	02:00:00
befbbf05-1603-4e03-b30e-eecf336777cb	Europe/Vienna	CEST	02:00:00
c1ccf35d-80c2-4cd0-bc19-9b64fec37ab4	Europe/Moscow	MSK	03:00:00
075be1e2-7f11-41e0-8805-48c10ba273c3	Europe/Nicosia	EEST	03:00:00
ceec36cb-a05b-414f-97d7-9422c5e45801	Europe/Lisbon	WEST	01:00:00
4a613e2a-8c82-4932-b2a9-20d4320a9938	Europe/Chisinau	EEST	03:00:00
0803a2e2-6224-449b-8bf9-1b664e05dbec	Europe/Kirov	MSK	03:00:00
4cd12ca3-19b0-4a27-8d7d-6f3bc1f66fbc	Europe/San_Marino	CEST	02:00:00
ee53b925-4bd3-409e-b42d-3bcd1233d5d8	Europe/Prague	CEST	02:00:00
fb44be77-05b7-4651-bd1b-08c0d44d3078	Europe/Vatican	CEST	02:00:00
d1c79e55-1342-40bb-ad21-e63c2c07d622	Europe/Tallinn	EEST	03:00:00
b957377b-a73f-4c7f-8a2d-b05f8d9973ef	Europe/Riga	EEST	03:00:00
c07d8975-800c-4236-8401-62d110e5ff80	Europe/Tirane	CEST	02:00:00
140acc0a-e88d-4af2-b4c9-858e691d3db5	Europe/Belfast	BST	01:00:00
40982635-7461-46a0-9333-32be810c9e73	Europe/Madrid	CEST	02:00:00
b159b1e0-5d71-4a8e-8677-51cfb3af5d28	Europe/Jersey	BST	01:00:00
3d277825-ee9f-44e4-a7c0-5246b83457b2	Europe/Busingen	CEST	02:00:00
c106c631-d4c1-4ad1-bed1-ee95e6298503	Europe/Gibraltar	CEST	02:00:00
3abc7b0b-f203-489f-81dd-8ba13ec5313f	Europe/Malta	CEST	02:00:00
9d58c615-5d0b-45fa-b720-6ffb3b8e66a5	Europe/Astrakhan	+04	04:00:00
a6b061e8-2320-454b-88ca-aa78a2a843a9	Europe/Helsinki	EEST	03:00:00
8f1035b0-553a-4187-b1c6-6610aa0366a6	Europe/Kyiv	EEST	03:00:00
5b055e65-65f2-4310-bab7-8ab0925c0d3f	Europe/Tiraspol	EEST	03:00:00
6d1a9975-cc98-4781-96a7-279bde8d87b8	Europe/Berlin	CEST	02:00:00
e24b612c-c312-4eb6-abad-eca342bd3604	Europe/Zagreb	CEST	02:00:00
17319994-8838-4029-b393-b485cfc1e7ce	Europe/Isle_of_Man	BST	01:00:00
cbca9b91-c448-42d9-b361-169e2a941d37	Europe/Bratislava	CEST	02:00:00
131d15a0-494f-4246-b59e-989a88c78498	Europe/Brussels	CEST	02:00:00
5bed3c85-4513-4c8f-a329-15ce1ebdba68	Europe/Bucharest	EEST	03:00:00
b6b8f636-5710-4dba-8772-139825a75660	Europe/Volgograd	MSK	03:00:00
1961f110-bfe8-4a03-b5b9-88619d93f0ba	Europe/Vaduz	CEST	02:00:00
f839759e-9a28-4886-8bd9-b858fd12c592	Europe/Amsterdam	CEST	02:00:00
6d57f735-a4da-411c-a2b2-e64f55a855d8	Europe/Monaco	CEST	02:00:00
2c42aa8b-860f-4d8a-a01e-098ed8caa60e	Europe/Skopje	CEST	02:00:00
feefb6dc-8766-4062-84ce-2146cb3ed8c5	Europe/Rome	CEST	02:00:00
c34a9516-42b3-45d5-ba55-96fda4e0d5e6	Europe/Ulyanovsk	+04	04:00:00
78df33c4-36a5-49d7-affc-6058f146fd59	Europe/Saratov	+04	04:00:00
77227dd1-35a9-4c2c-bc60-dfa6debf96ca	Europe/Andorra	CEST	02:00:00
bf2bce72-51b2-452b-b23d-525009f23a34	Europe/Stockholm	CEST	02:00:00
776e2b42-9cfc-41ad-8b26-ab3d0dd25f02	Europe/Simferopol	MSK	03:00:00
ccea9356-0aaa-43d4-9b5a-930fe80cef55	Europe/Sofia	EEST	03:00:00
2d8b7f8c-d0a7-475e-b548-ddb1b35922cf	Europe/Zurich	CEST	02:00:00
03709438-3305-4024-b0ab-cf761be21b58	Europe/Guernsey	BST	01:00:00
76bc00c5-a0e1-435e-af68-9797ea38e2f0	Europe/Belgrade	CEST	02:00:00
28682cc5-b0ba-4e14-bfa9-570b0d56faa1	Europe/Sarajevo	CEST	02:00:00
d4925568-fe0b-4776-a970-c7e1fae503aa	Europe/Budapest	CEST	02:00:00
f8d57779-1550-4690-802a-b94e615e309a	Europe/Minsk	+03	03:00:00
4924719f-72b4-4725-a2ed-ab6adcf39dbc	Europe/Luxembourg	CEST	02:00:00
de37a278-97ab-4e9f-bae3-0c6683802593	Antarctica/Palmer	-03	-03:00:00
b1b55852-046b-4bd8-b080-91414c175698	Antarctica/Davis	+07	07:00:00
843888ef-bd00-4cef-9560-e0eb3f88e9cc	Antarctica/Vostok	+05	05:00:00
b05ec0b5-f005-4955-a17d-1a4343bec6a4	Antarctica/DumontDUrville	+10	10:00:00
1c140537-aa1d-4d75-a6c4-3badeeeddaaa	Antarctica/Troll	+02	02:00:00
a2bf2e36-2fef-4349-ba21-67f8827c8c35	Antarctica/Macquarie	AEST	10:00:00
d7bac54f-78a0-4033-911b-aa5cc02a2b98	Antarctica/Mawson	+05	05:00:00
9b308aef-517c-48d9-b0c7-8de4d11e5a4f	Antarctica/McMurdo	NZDT	13:00:00
eea192b4-13b9-4d48-9775-1f84b0cd8311	Antarctica/Syowa	+03	03:00:00
176bf13f-4922-4fb1-9726-7ee5e66bc1ee	Antarctica/Rothera	-03	-03:00:00
ed2cf844-1cb2-4446-aaa3-ce7c5fad3b68	Antarctica/Casey	+08	08:00:00
5dbf879d-bf78-4c60-8f70-567e1027261d	Arctic/Longyearbyen	CEST	02:00:00
32e4ea5d-5f5d-40b1-b1a5-8597ce9d0799	America/Moncton	ADT	-03:00:00
a29867c5-806e-4a9d-8bca-fe279e5a1eb4	America/Iqaluit	EDT	-04:00:00
9e18f130-884c-41da-b668-29157a3e1fdd	America/Costa_Rica	CST	-06:00:00
ffa5a6ad-4112-4f0c-ae7b-638b10841e84	America/Nome	AKDT	-08:00:00
5013e872-dba1-424d-8263-eb870fdccb46	America/Campo_Grande	-04	-04:00:00
88b18b7c-3fca-49b8-a2ad-cbf7e2f86786	America/Sitka	AKDT	-08:00:00
b5e2c32e-cfdf-47d5-b91e-00f9535fcb85	America/Marigot	AST	-04:00:00
f7bb76fa-0296-4608-9ff4-e4d1480f6d53	America/Coral_Harbour	EST	-05:00:00
e60e5ae0-2086-4360-b723-80464ed9d317	America/Panama	EST	-05:00:00
b112a308-052d-4d73-ba65-8d76140eec2a	America/Paramaribo	-03	-03:00:00
3f3844a8-ee3a-482b-957e-8701e91f7fbf	America/Recife	-03	-03:00:00
017a1b72-7834-4195-9187-6c726e948b74	America/Dawson_Creek	MST	-07:00:00
759ca0cb-19c0-427f-a349-67f300783418	America/Inuvik	MDT	-06:00:00
34d8f87c-8002-40e9-ad9e-38b4bab2c220	America/Havana	CDT	-04:00:00
eef964ca-3929-4801-88e1-6a4e23875dcc	America/Lima	-05	-05:00:00
0e54659c-ec6b-40f4-a598-2407d48d1a24	America/Metlakatla	AKDT	-08:00:00
43e2dae6-6dcf-4b3b-9018-defb02aaec0a	America/Bogota	-05	-05:00:00
56ee189f-d9de-45a2-8004-70a7c7ec6c50	America/Cancun	EST	-05:00:00
2c1edc63-0b8a-4904-b913-eee6df32a0c7	America/Halifax	ADT	-03:00:00
acbdde64-6a99-41d6-af0a-c37144fb67cf	America/Guayaquil	-05	-05:00:00
6b4ccfe9-4301-4919-98ed-7aa86a665fce	America/Porto_Acre	-05	-05:00:00
6fb21e42-343b-4f71-a668-6bb2245ec2c3	America/Puerto_Rico	AST	-04:00:00
e59ab661-8f22-41c2-9433-f45307171545	America/Edmonton	MDT	-06:00:00
c2e74500-a9b4-4558-abcd-577f59856c0b	America/Guadeloupe	AST	-04:00:00
915b5485-f81f-4baa-b648-58bfb3f44442	America/Tortola	AST	-04:00:00
e13959f5-ba9f-4b80-aa1d-87608a22228a	America/Araguaina	-03	-03:00:00
fd8e1415-c6bc-449c-a260-335bb0595a91	America/Thunder_Bay	EDT	-04:00:00
ba71c28b-fa44-4aae-a625-64daeba85347	America/Ensenada	PDT	-07:00:00
f9f0db67-fef0-4d17-8a20-b7169bc9fffe	America/Whitehorse	MST	-07:00:00
88ffd68b-707c-4ba4-bd7f-4cc5dac69f43	America/Bahia	-03	-03:00:00
45e03b7a-b0c9-4ab9-a8bb-d488eaab7439	America/Atka	HDT	-09:00:00
bff86cac-3134-44cb-9bfa-8412467d57d6	America/Santiago	-03	-03:00:00
d006bdbb-1699-4524-9219-67288d0f3c33	America/Adak	HDT	-09:00:00
176ecbb9-ea5b-44e0-87dc-3ce183255b88	America/Argentina/San_Luis	-03	-03:00:00
dc919ebd-a7f9-44b8-8b1b-d4e45d5f4c3d	America/Argentina/Mendoza	-03	-03:00:00
ff362a2d-825f-4f68-90c0-d0c2d6c64327	America/Argentina/Tucuman	-03	-03:00:00
4c364d1c-cba9-4d9d-812a-28fb3990e8ea	America/Argentina/La_Rioja	-03	-03:00:00
3bfa1dfc-9bbc-4b79-96e3-5b243cd80132	America/Argentina/Jujuy	-03	-03:00:00
8b50a7a0-6d7e-4fec-bdcb-1366df2bb216	America/Argentina/Cordoba	-03	-03:00:00
2c50067f-d551-44b0-ae2e-19f15823881f	America/Argentina/Rio_Gallegos	-03	-03:00:00
a6e77f3a-8451-4ac1-84b7-0b5bd517d386	America/Argentina/Salta	-03	-03:00:00
5c3d091e-6af7-4747-ae69-9bb4d6d0beae	America/Argentina/Catamarca	-03	-03:00:00
0deeef24-efb1-491b-b334-351115ecb446	America/Argentina/San_Juan	-03	-03:00:00
3e8ab183-8086-44ca-8ba8-02be05b10372	America/Argentina/Ushuaia	-03	-03:00:00
c1f8e867-f7de-4168-9c1c-8e9a64846e21	America/Argentina/Buenos_Aires	-03	-03:00:00
8d3cdef3-9acb-4aef-ba09-a31a7d3d8e55	America/Tegucigalpa	CST	-06:00:00
917f2502-a162-4ffb-aeef-822c38b69350	America/Antigua	AST	-04:00:00
504330fa-c916-4f32-b60e-a3137c4a84d7	America/Thule	ADT	-03:00:00
6bd54c50-ce2b-47e3-9ef1-07265a4ec13b	America/Juneau	AKDT	-08:00:00
98ee9524-5b00-4e67-bb8e-05b2f3c2bfef	America/Santa_Isabel	PDT	-07:00:00
d21520b3-0287-4838-890c-3e3c3c0a110f	America/Los_Angeles	PDT	-07:00:00
8f3b1b05-e9b1-4e3c-8fc0-8eb75ecfb1c8	America/Glace_Bay	ADT	-03:00:00
63524baa-6043-4932-a0fa-9419668dfab3	America/Grenada	AST	-04:00:00
646da135-ac3e-46d2-b61f-e9b19ff641fd	America/Martinique	AST	-04:00:00
4695fb88-5d57-4936-8ae4-14d3c574b1cc	America/Mazatlan	MST	-07:00:00
e4b116ba-de09-42c2-a8ad-1a2fbbf50865	America/Barbados	AST	-04:00:00
904ba9f3-f0d1-47fc-a1d4-bb45108373fc	America/Ojinaga	CDT	-05:00:00
19871622-1102-468b-87c5-060572088531	America/Kentucky/Monticello	EDT	-04:00:00
1812be74-f932-419f-a2a5-c27d8478576b	America/Kentucky/Louisville	EDT	-04:00:00
a537d91e-2f2b-45f5-bf63-c8e22c326a11	America/Resolute	CDT	-05:00:00
0459578d-b4a4-4b85-9822-4155cc15e148	America/Nassau	EDT	-04:00:00
a1aa3772-1ba8-49bc-a204-ca43e72dfa4d	America/Detroit	EDT	-04:00:00
1d2fdc33-5efe-4702-a63f-83d1e41bc2f5	America/Danmarkshavn	GMT	00:00:00
62c7e28f-ac0d-4752-a8c6-ec887c7eaf1f	America/Noronha	-02	-02:00:00
84bc86c0-df56-44b2-898a-55d2aaff7161	America/Hermosillo	MST	-07:00:00
a03db41d-db32-4a46-9cd1-40d8daa21e68	America/Vancouver	PDT	-07:00:00
f90e8743-2b8a-4f06-87e4-608d7327a095	America/Menominee	CDT	-05:00:00
270f6dee-e609-4f98-aed0-443f1788c233	America/Monterrey	CST	-06:00:00
041324ba-77ec-4387-a75f-6c6495b034d1	America/Port_of_Spain	AST	-04:00:00
9c0e6d56-b490-4811-8e25-f83070668cf5	America/Pangnirtung	EDT	-04:00:00
a05404e0-0300-4df9-8712-60c2ac6b8e51	America/Dawson	MST	-07:00:00
27db238b-d014-4f84-8a9d-6377cde139ca	America/Jamaica	EST	-05:00:00
43fc41c2-d51f-428a-961e-625cbe8fc2e1	America/Cayman	EST	-05:00:00
18a44e63-086f-473b-9bc3-2a4d7a1d5328	America/Chihuahua	CST	-06:00:00
42444824-a3d7-4e4a-b13e-76eaff026b3c	America/Port-au-Prince	EDT	-04:00:00
ad9c94c7-cedd-46b2-a563-e22f40cd80dd	America/Rio_Branco	-05	-05:00:00
50afb398-2edf-448d-880c-947ca2757b68	America/Dominica	AST	-04:00:00
cb9248fb-8f6b-4368-a060-6dbba4d37bd9	America/Manaus	-04	-04:00:00
0f1cceb3-f135-420b-8e91-a30eeebf1355	America/Bahia_Banderas	CST	-06:00:00
466950ed-e33d-4541-a33c-40101dbc34ab	America/Swift_Current	CST	-06:00:00
22ce4f2a-f22d-4f55-a397-366f28465ccc	America/Goose_Bay	ADT	-03:00:00
797f31c1-87e0-465b-b5af-fe820cc2c096	America/Belem	-03	-03:00:00
2fb9a5bd-aca8-43c8-9111-5590226a9a92	America/Merida	CST	-06:00:00
981ea56d-ab1a-4179-b88b-d2bf97e01ec4	America/Yellowknife	MDT	-06:00:00
c4cad564-f200-4bad-b377-83aa86abd9d0	America/Winnipeg	CDT	-05:00:00
0508cb86-76f2-48ff-9ffa-86d2f8b481b7	America/St_Johns	NDT	-02:30:00
cf1a19fd-226a-4057-b976-c1a9bdecc88a	America/Ciudad_Juarez	MDT	-06:00:00
cfd18781-4a6f-478d-b11a-45e754cbc823	America/Scoresbysund	-01	-01:00:00
33ae5d5d-f6f8-496b-8da1-c26100afa983	America/Phoenix	MST	-07:00:00
942401b5-b4f9-4307-9055-3b6528f80683	America/Creston	MST	-07:00:00
f4959b59-febf-4975-94e9-bee4f7aef4f1	America/Yakutat	AKDT	-08:00:00
67113106-eeeb-496f-a8c5-75f3f1548cca	America/Managua	CST	-06:00:00
5b43f86b-e61d-4289-b1e9-b2da8c7f12bc	America/El_Salvador	CST	-06:00:00
905d36bf-c207-4af6-a47f-ecba760b233a	America/Caracas	-04	-04:00:00
81b28874-b385-4c08-8f1a-9f995b700780	America/Belize	CST	-06:00:00
99551175-cb06-4e54-958a-99f253fce38e	America/Porto_Velho	-04	-04:00:00
990d240b-afd3-41d4-b66f-7ee217272df5	America/Montreal	EDT	-04:00:00
d9afcc55-62b8-4107-87c3-13a04d15c15e	America/Atikokan	EST	-05:00:00
a0b162e0-f9a8-4037-9890-5ad81fad2977	America/Montserrat	AST	-04:00:00
1216a8f6-a8e4-4989-92dc-ee413f52c979	America/Grand_Turk	EDT	-04:00:00
8aa0d4c0-9df2-496d-9afc-e941d9c2607a	America/Boa_Vista	-04	-04:00:00
dc39395b-e2dd-42a6-9575-05ec4b222eaf	America/Nuuk	-01	-01:00:00
d74e0a80-3e45-4cc2-8723-efcd6fbb080f	America/New_York	EDT	-04:00:00
922145a6-94c8-4409-aeaf-73467e39be85	America/Rainy_River	CDT	-05:00:00
e258ab72-3955-4492-a9a5-a567397bb17c	America/North_Dakota/Center	CDT	-05:00:00
57f5afd4-c12e-437b-a3e8-cd277af557fd	America/North_Dakota/Beulah	CDT	-05:00:00
94b264c0-087b-40b8-8a6f-7318564e8436	America/North_Dakota/New_Salem	CDT	-05:00:00
b01a5cf9-0ffa-4762-a321-906369e980fc	America/Curacao	AST	-04:00:00
41d9899b-d7a3-4081-a41d-3400f007fa96	America/St_Vincent	AST	-04:00:00
9f8aba0c-3709-4537-a329-a1520c3a623f	America/Kralendijk	AST	-04:00:00
3a525ab0-8a18-4278-8876-26b634ff86f0	America/Shiprock	MDT	-06:00:00
f2cf5f2d-1663-4c02-b37b-54b04c2c95e5	America/Eirunepe	-05	-05:00:00
84a8ab23-3e69-4de5-9da9-ba5fa391e2f2	America/Coyhaique	-03	-03:00:00
681785e9-5f18-4a20-b54c-147e5316f836	America/Santarem	-03	-03:00:00
621d25a6-f45f-4978-b4b2-9dd41ba97356	America/La_Paz	-04	-04:00:00
e30114c0-9659-4a10-8cc6-d4452f3ea34e	America/Cambridge_Bay	MDT	-06:00:00
f9fa3bb3-433d-421c-8538-95e20757dd90	America/Boise	MDT	-06:00:00
79113077-bf05-4a35-aee1-49b8c7b801c3	America/Mexico_City	CST	-06:00:00
56a7e59b-21b5-4cbe-a169-ec3ff037f314	America/Montevideo	-03	-03:00:00
52b86ebc-3cff-40a6-a0f2-79950dbbfb64	America/Fortaleza	-03	-03:00:00
aa887008-d016-4fa3-86ab-903da6948467	America/Matamoros	CDT	-05:00:00
f114d7d4-dbed-44d6-a92d-e0b97eaab44c	America/Anguilla	AST	-04:00:00
29a72962-ca9a-4945-89e4-b6e83c367c7d	America/Sao_Paulo	-03	-03:00:00
9fc48349-d9da-4a53-b8df-7cf77ea41572	America/Anchorage	AKDT	-08:00:00
8f1e9c86-72ea-4451-9c57-67f483163c67	America/Punta_Arenas	-03	-03:00:00
b09b83cb-eb45-4205-b95a-1820ebea3932	America/Miquelon	-02	-02:00:00
d9435466-2224-4c52-98e5-8e978cf4a211	America/Guyana	-04	-04:00:00
df58c4ca-47e7-44c1-a095-c29126873059	America/Virgin	AST	-04:00:00
4106cc8b-59b5-410b-bea3-59ca2eef6484	America/Rankin_Inlet	CDT	-05:00:00
6e7486a5-4a99-4fd4-b6fe-39e7eb691aea	America/Nipigon	EDT	-04:00:00
51dc15ce-fda3-459e-bcd5-675011b15dd3	America/Maceio	-03	-03:00:00
12e6ddd1-852f-4a84-ac94-4da05169b8d6	America/St_Thomas	AST	-04:00:00
68ba351a-671d-475b-8d45-ca295fb74707	America/Indiana/Marengo	EDT	-04:00:00
39084bd1-6915-42b2-9589-43dce561a565	America/Indiana/Petersburg	EDT	-04:00:00
190b2c1a-bc7b-4149-9219-8ac005aa35ee	America/Indiana/Tell_City	CDT	-05:00:00
eefe0b53-c236-4339-8446-28e239894050	America/Indiana/Vevay	EDT	-04:00:00
23489ff9-7d08-4dec-88f1-7745b5471a27	America/Indiana/Winamac	EDT	-04:00:00
01c4d206-95a4-447d-be80-df11edbaec51	America/Indiana/Vincennes	EDT	-04:00:00
e7401175-dc51-4acb-ae51-a2527360822e	America/Indiana/Knox	CDT	-05:00:00
2b490582-adea-4b10-a695-b45f2e1c1f25	America/Indiana/Indianapolis	EDT	-04:00:00
6b346317-4d09-4e00-9e6e-187e726ce582	America/Toronto	EDT	-04:00:00
c5b2cd12-22f8-471a-9f72-ada2e34f0cfe	America/Cayenne	-03	-03:00:00
d5d0fcf1-576a-4b76-8b24-a8f41ff9eadd	America/Tijuana	PDT	-07:00:00
0aa071b7-e4d8-42f1-8288-8edae36b3b32	America/Guatemala	CST	-06:00:00
bfab4f6a-7b88-4fa0-9583-e4fbc02ac6cb	America/Cuiaba	-04	-04:00:00
e68dd7e0-0efc-42a2-b78f-ccb2b3c38ef8	America/Denver	MDT	-06:00:00
965c46e6-e7fd-4a6a-88fe-b792ca5965cf	America/Chicago	CDT	-05:00:00
52a7a8cb-e2a2-43fa-86c8-af649b382672	America/Asuncion	-03	-03:00:00
7e39ec95-b2ed-41ff-a4af-8235817e989b	America/St_Kitts	AST	-04:00:00
265117f1-f223-4ded-8dc0-89ddf7f83faf	America/Aruba	AST	-04:00:00
e680bbea-5b82-478e-a398-7db270ac2508	America/Lower_Princes	AST	-04:00:00
098a4146-888f-4fab-bde0-344526e91368	America/Blanc-Sablon	AST	-04:00:00
7def1353-eaa8-4d43-8356-175bb0d6cc86	America/St_Lucia	AST	-04:00:00
cec108ed-df67-42af-aa9f-dc236961cd9d	America/Regina	CST	-06:00:00
8cac58a4-0edf-42d4-9b85-8477f26d1677	America/Santo_Domingo	AST	-04:00:00
61bf82d7-9257-4fc6-bb4a-b74cd6c32d15	America/St_Barthelemy	AST	-04:00:00
211a66b1-3cec-4506-94a9-9ebcbe63e4ed	America/Fort_Nelson	MST	-07:00:00
4ee914ad-0ad0-45fc-9035-d9862f0452ef	Etc/GMT+5	-05	-05:00:00
3c9ceeaf-6e0b-47e9-bd31-b6318397fc25	Etc/Universal	UTC	00:00:00
e2cb34a6-a820-4ff5-940d-1c9d11631d91	Etc/GMT-9	+09	09:00:00
4f71bd22-026f-4451-a9ad-996a15f4e32c	Etc/UCT	UTC	00:00:00
e9d15b13-862c-44e0-a9f3-3df59b3360e6	Etc/GMT+2	-02	-02:00:00
5cee3d01-55fd-43e3-ae94-4526028b61fc	Etc/GMT	GMT	00:00:00
895b0f65-653f-4817-935b-e96337b71871	Etc/UTC	UTC	00:00:00
95e94f7b-41f5-4566-8b9f-412e13a06972	Etc/GMT0	GMT	00:00:00
a1ce6cb3-e267-492e-bda1-ac40c57ff28c	Etc/GMT-12	+12	12:00:00
ad08400d-c36c-4261-b039-34cfbb982656	Etc/GMT+8	-08	-08:00:00
4bff2762-227e-49e4-aa40-0a2ffb50e713	Etc/GMT+3	-03	-03:00:00
be1d6834-a6c9-4620-b64a-5249404f7537	Etc/GMT-10	+10	10:00:00
fed54904-765b-424c-8028-0d755438bb03	Etc/GMT-8	+08	08:00:00
c06fbdc5-ba4b-4fb1-ae66-052d961445d4	Etc/GMT-1	+01	01:00:00
23e88830-3f24-4472-ac5a-63ed0ec62df0	Etc/GMT+0	GMT	00:00:00
c8b981d9-f3a9-4235-ab77-314db94bea0f	Etc/GMT-7	+07	07:00:00
8435b096-5628-470a-84d5-5a5102aef294	Etc/GMT+4	-04	-04:00:00
6b287def-a9cf-46c6-bb32-d1a199889f79	Etc/GMT-3	+03	03:00:00
c5188ffa-382a-4917-b948-26176858b4f0	Etc/GMT+1	-01	-01:00:00
fd7d1c14-b23b-4f97-8bfc-0507c35e0711	Etc/GMT-0	GMT	00:00:00
3937198f-b11a-48a0-9b10-14f338909442	Etc/GMT-13	+13	13:00:00
b5723aeb-765a-4405-b03d-0cbc7faedcc6	Etc/GMT+10	-10	-10:00:00
18de86f4-1cdf-4647-bf70-51886f6b38dd	Etc/Zulu	UTC	00:00:00
115376c0-df2a-4ad2-860a-40e85f1d3f44	Etc/GMT+6	-06	-06:00:00
ced122ff-58d5-4e03-8cc2-14d546307a93	Etc/GMT+7	-07	-07:00:00
d4e3c062-43bf-4d21-a4a7-b77ba7ce2c54	Etc/GMT+12	-12	-12:00:00
cf741d27-493f-4ee7-a6b2-ac1ccfb29174	Etc/GMT+9	-09	-09:00:00
1f0b8dde-205b-4adf-9f08-825acf3f49ab	Etc/Greenwich	GMT	00:00:00
25d1b026-54e4-45cf-97f5-7f75a6dd7c5d	Etc/GMT-4	+04	04:00:00
0f642c46-02cb-45a9-91d7-dae614ffcb6a	Etc/GMT-11	+11	11:00:00
721cc959-9ead-4c08-a265-c55d0a1676f7	Etc/GMT-2	+02	02:00:00
43e4b6c3-93f3-41b6-a2e7-c1983e83cdf8	Etc/GMT-6	+06	06:00:00
afbb490e-67e9-4e60-85c1-17eec5cd05cd	Etc/GMT-14	+14	14:00:00
cec9ff3a-f492-40b3-be1f-419eb5aa1821	Etc/GMT-5	+05	05:00:00
cfb2736a-09f8-4fa2-a34f-42eee51f0917	Etc/GMT+11	-11	-11:00:00
8ce63bb2-4bed-4287-ab3c-cf03da5079bd	Australia/Eucla	+0845	08:45:00
7d3a8da7-b43a-4293-92fa-93c8b6b5f698	Australia/Broken_Hill	ACST	09:30:00
39fbd573-4db5-4023-80c4-46e7f1f178e5	Australia/Lindeman	AEST	10:00:00
2f82b7e7-0388-4486-9194-582baf3aad67	Australia/Hobart	AEST	10:00:00
b54c5f9d-f3d6-461c-acdb-1fee10183664	Australia/Adelaide	ACST	09:30:00
3349411f-3fd8-4df7-a3b6-d36796c78431	Australia/Perth	AWST	08:00:00
49f105a4-45f1-4378-93f3-10f952a9c486	Australia/Sydney	AEST	10:00:00
7b86f156-2ffe-400d-b7f5-f9bebcc388be	Australia/Canberra	AEST	10:00:00
15ab5ccb-d934-4f78-ba78-704abc65af59	Australia/Darwin	ACST	09:30:00
98df0b04-063d-4ad8-a40c-98ed18717536	Australia/Melbourne	AEST	10:00:00
9503e771-1689-40ea-86d1-4948317e33af	Australia/Currie	AEST	10:00:00
19b0e440-ad3e-4eef-a003-636d952edb4e	Australia/Lord_Howe	+1030	10:30:00
44ae1e91-e007-428c-bf6a-2c23c73427bb	Australia/Yancowinna	ACST	09:30:00
930c5e60-3729-48fc-ad60-a44295667434	Australia/Brisbane	AEST	10:00:00
f4aab821-b396-4bee-8dbf-4ec919239315	Asia/Riyadh	+03	03:00:00
90d2d805-e272-4676-bdc0-859ebe429177	Asia/Tomsk	+07	07:00:00
e090767b-69d7-441d-a791-645e5f1a7c05	Asia/Baku	+04	04:00:00
54bc15cc-a99b-4942-b9ec-7bb1520158ed	Asia/Vladivostok	+10	10:00:00
47178bf0-517e-4dde-a3b0-dd4cf6a2f8b7	Asia/Ust-Nera	+10	10:00:00
351b5629-fc10-4dea-93cd-ae8341038d5a	Asia/Hong_Kong	HKT	08:00:00
4b8b2f71-0538-44f6-bf29-51b972340f57	Asia/Tehran	+0330	03:30:00
380c3706-9a75-4a8d-a771-671eb73ea45b	Asia/Urumqi	+06	06:00:00
8c33f30b-b7a3-48bc-a165-44c07fc5ee8d	Asia/Qostanay	+05	05:00:00
adfa4d82-276e-4801-8c4e-8c06a084c344	Asia/Khandyga	+09	09:00:00
e26f793c-8a1a-41f0-8e7c-1ee0fe4fe623	Asia/Pyongyang	KST	09:00:00
dbddc529-c148-4128-97b2-ea01b3f493e2	Asia/Qyzylorda	+05	05:00:00
3e43977e-b2f4-42c1-a0b5-1418f39366a9	Asia/Sakhalin	+11	11:00:00
e3401433-c2c7-429d-813d-b1558753975e	Asia/Istanbul	+03	03:00:00
2ee62603-1e6f-4bf3-9685-ff6322a2ad25	Asia/Bishkek	+06	06:00:00
c423161a-26da-499e-98ef-0954fe371442	Asia/Harbin	CST	08:00:00
2808ae89-266f-4ac2-a8f7-5700acc9cfaf	Asia/Omsk	+06	06:00:00
212077c8-25cd-4531-8c3a-e41115ac1bc7	Asia/Aden	+03	03:00:00
50b6bdca-00eb-47dd-b99b-f84e196803f5	Asia/Dubai	+04	04:00:00
4e43b57f-9af0-4cc6-825d-7369723332fb	Asia/Yangon	+0630	06:30:00
4051ade6-1bec-482e-a2b7-dc331867ffe4	Asia/Ashgabat	+05	05:00:00
0bb780f9-2300-4a1d-91f0-de9f93b581a7	Asia/Colombo	+0530	05:30:00
407b5228-a100-4dec-83c6-2a7f0ffab567	Asia/Novokuznetsk	+07	07:00:00
5951a256-8a1c-4d55-9961-3419fcde598a	Asia/Kuala_Lumpur	+08	08:00:00
4e1b8d56-603b-4f0b-913c-8d78a0828a30	Asia/Beirut	EEST	03:00:00
4a6c85ad-334f-4176-aae7-9e82f140be59	Asia/Singapore	+08	08:00:00
3dafeee6-3eb4-4467-ac15-74885d07c565	Asia/Magadan	+11	11:00:00
a0878f1e-e3dd-424e-9ce6-8fc3cd833509	Asia/Nicosia	EEST	03:00:00
1887c053-ebab-4ad4-89b6-372389bab20e	Asia/Atyrau	+05	05:00:00
12452316-2b14-46fc-8760-f89672528841	Asia/Manila	PST	08:00:00
561c87f4-4ea5-4809-8b20-a49df2cc383f	Asia/Baghdad	+03	03:00:00
55124c29-9743-4091-b93f-3b5571069df8	Asia/Tokyo	JST	09:00:00
c25c8d2f-3bc6-4285-9bed-5ebfc8ce079e	Asia/Chita	+09	09:00:00
4cf9fc70-db51-477e-9047-9aa3bfedc273	Asia/Muscat	+04	04:00:00
9c2895df-1902-49d8-ab19-11d1561667e7	Asia/Jakarta	WIB	07:00:00
98669ad2-af6c-40d5-944b-e95039a1abe9	Asia/Barnaul	+07	07:00:00
ded8a927-08d4-4428-97ed-9b0e4a0a0448	Asia/Aqtobe	+05	05:00:00
68e4c58c-1a2b-47fa-9849-55f01021f253	Asia/Makassar	WITA	08:00:00
b421861a-31dc-448b-beb0-f2d7d44705fe	Asia/Kolkata	IST	05:30:00
6554b4e3-4104-44df-b7e6-538c93789d3b	Asia/Kabul	+0430	04:30:00
8a8095f4-1102-4296-a8da-6476720da6e7	Asia/Hovd	+07	07:00:00
0429e5ca-832d-4ae7-98df-dbd092e2cfdc	Asia/Karachi	PKT	05:00:00
7362c496-5dd7-4f1b-b671-6a8af7e6a20d	Asia/Vientiane	+07	07:00:00
23c4c6ef-4eeb-45ac-a6e5-457fb57df813	Asia/Thimphu	+06	06:00:00
78f551e3-e1bd-4403-b9ef-4772f2cde5ad	Asia/Dhaka	+06	06:00:00
334a6afc-4b85-40df-bce8-568660de6f18	Asia/Kashgar	+06	06:00:00
c83d501f-1d6d-4341-a785-417f5589b8ea	Asia/Tel_Aviv	IDT	03:00:00
13d1389b-9b3f-40f5-8172-945ccbdb3434	Asia/Taipei	CST	08:00:00
e5e112c1-c0ca-401f-b607-3dc4a57208f1	Asia/Yakutsk	+09	09:00:00
d8be3587-aad0-4f89-a3da-d69828020fbc	Asia/Oral	+05	05:00:00
e7b07bca-fc9c-4ad3-bc03-1f90a15aa894	Asia/Macau	CST	08:00:00
0088cdad-b370-4b79-b40c-d6e92acd7529	Asia/Tashkent	+05	05:00:00
3ce37e02-f726-434a-a68d-b80e9c555b67	Asia/Chongqing	CST	08:00:00
5e009f6c-cfd8-4712-a75f-eb39022b1586	Asia/Almaty	+05	05:00:00
42db40bc-665a-4c2d-be63-2c8aaf5710b0	Asia/Dushanbe	+05	05:00:00
796c4af5-8bc0-41bb-b604-fd5eb8c059e5	Asia/Yerevan	+04	04:00:00
4ccf9726-c5db-4a45-a3dc-ed0f142d9527	Asia/Hebron	EEST	03:00:00
23543e30-b1f0-4b55-ba81-4a1ba9b92647	Asia/Amman	+03	03:00:00
fde6c911-d23d-4198-9638-c5efbb2f9bc3	Asia/Yekaterinburg	+05	05:00:00
f26f693e-5c05-4ec7-8681-d089d22bd25c	Asia/Jayapura	WIT	09:00:00
accc8395-fc5d-4ec2-b210-1f33794b6015	Asia/Aqtau	+05	05:00:00
965bf669-0702-4058-864f-222fa408f9c1	Asia/Krasnoyarsk	+07	07:00:00
927e3af9-094f-4f9f-8432-8922e7c85baf	Asia/Damascus	+03	03:00:00
104d5cb2-ce56-443b-8753-9a634b1ec6e0	Asia/Srednekolymsk	+11	11:00:00
4f1fa50c-bcd0-4aa9-a5ec-5cb6f3ce0f2a	Asia/Ulaanbaatar	+08	08:00:00
3af52113-a400-430d-94e0-c9d0b223ed3f	Asia/Ho_Chi_Minh	+07	07:00:00
f320c72f-3da7-4b15-9d55-45d6b60719b4	Asia/Kamchatka	+12	12:00:00
8738e963-60c8-4bc9-a7ad-cb0541b4013b	Asia/Shanghai	CST	08:00:00
43256733-85b6-4d26-ab93-61db41fc9847	Asia/Brunei	+08	08:00:00
7ef3bca5-422d-4805-b964-1b64baf2cb5a	Asia/Kathmandu	+0545	05:45:00
971c0f8b-3268-40b7-9084-9db3b47fb793	Asia/Jerusalem	IDT	03:00:00
ee1f0f03-3a86-4e1d-8b8e-b13b0d8234fa	Asia/Pontianak	WIB	07:00:00
0dd2593e-60d7-404d-b5c9-c8fa852142ea	Asia/Qatar	+03	03:00:00
0a384730-d224-4a94-9f5c-13fe1aa9cf85	Asia/Kuwait	+03	03:00:00
9c4eec7e-526f-4df1-86e1-31bafd4b606c	Asia/Bangkok	+07	07:00:00
a9a32cc6-a863-4619-b2ef-cf2c97b839d7	Asia/Irkutsk	+08	08:00:00
2c409ad4-d269-40bb-8c52-df1bc758262d	Asia/Bahrain	+03	03:00:00
3b7fe241-8485-41b1-97ec-8a065887475f	Asia/Anadyr	+12	12:00:00
b7450621-632d-43b1-b162-fa6c03770b6d	Asia/Phnom_Penh	+07	07:00:00
9e0d5ac2-0bd8-4ef7-8bb7-8c4e1486ce27	Asia/Kuching	+08	08:00:00
3ca95a80-03a3-4d48-8969-282ff4e30433	Asia/Samarkand	+05	05:00:00
d9cc4b8b-370a-4b46-b930-9c3e139ca58c	Asia/Novosibirsk	+07	07:00:00
b6100fea-1efc-46ac-a23f-3ff8ae2cc35d	Asia/Seoul	KST	09:00:00
ee1a9725-efc4-4180-a906-274fcf6f370c	Asia/Dili	+09	09:00:00
769f47ce-6064-4de0-8a33-fb91ba75e64c	Asia/Tbilisi	+04	04:00:00
e927980d-cb65-4bed-af34-c4c7605c6709	Asia/Famagusta	EEST	03:00:00
ac25bd14-dd77-46b1-9bee-513e6ce07541	Asia/Gaza	EEST	03:00:00
\.


--
-- Data for Name: user_deletion_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_deletion_logs (id, user_id, email, name, requested_at, scheduled_deletion_date, deleted_at, deletion_completed, created_at) FROM stdin;
\.


--
-- Data for Name: user_notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_notifications (id, message, user_id, team_id, read, created_at, updated_at, task_id, project_id) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, name, email, password, active_team, avatar_url, setup_completed, user_no, timezone_id, google_id, socket_id, created_at, updated_at, last_active, temp_email, is_deleted, deleted_at, language) FROM stdin;
6f5e7931-2674-409a-9b5f-b51d4c5377fe	Khoa Hoang	khoang@awakenservices.net	$2b$10$plIuGMKu4WTi/GlNjEaeteJsW/oeuyALpzEPW/9Q1CoiIvWWM/yDi	cb828fd9-67f2-4982-b7f8-9ca34ee36d89	\N	t	1	fff69c86-9db7-4b06-bdc5-74d0c0177170	\N	\N	2025-10-03 19:50:26.41415+00	2025-10-03 19:50:26.41415+00	2025-10-03 20:53:31.211716+00	f	f	\N	en
bea2b5c0-3b6e-4550-b136-022ea9bb386e	Ethan	khoa@naturewise.com	$2b$10$u9obYtBbJhCa3FgsnWu0Ye92mzmEXA5usl6jdV8AoGOVTSYmq1Iiq	cb828fd9-67f2-4982-b7f8-9ca34ee36d89	\N	t	2	fff69c86-9db7-4b06-bdc5-74d0c0177170	\N	\N	2025-10-03 19:53:46.50038+00	2025-10-03 19:53:46.50038+00	2025-10-03 19:54:52.203925+00	f	f	\N	en
\.


--
-- Data for Name: users_data; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users_data (user_id, organization_name, contact_number, contact_number_secondary, address_line_1, address_line_2, country, city, state, postal_code, trial_in_progress, trial_expire_date, subscription_status, storage, updating_plan) FROM stdin;
6f5e7931-2674-409a-9b5f-b51d4c5377fe	Awaken Services	\N	\N	\N	\N	\N	\N	\N	\N	t	2025-10-17	trialing	1	f
bea2b5c0-3b6e-4550-b136-022ea9bb386e	Naturewise	\N	\N	\N	\N	\N	\N	\N	\N	t	2025-10-17	trialing	1	f
\.


--
-- Data for Name: worklenz_alerts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.worklenz_alerts (description, type, active) FROM stdin;
\.


--
-- Name: users_user_no_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_user_no_seq', 2, true);


--
-- Name: archived_projects archived_projects_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.archived_projects
    ADD CONSTRAINT archived_projects_pk PRIMARY KEY (user_id, project_id);


--
-- Name: bounced_emails bounced_emails_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bounced_emails
    ADD CONSTRAINT bounced_emails_pk PRIMARY KEY (id);


--
-- Name: cc_column_configurations cc_column_configurations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cc_column_configurations
    ADD CONSTRAINT cc_column_configurations_pkey PRIMARY KEY (id);


--
-- Name: cc_column_values cc_column_values_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cc_column_values
    ADD CONSTRAINT cc_column_values_pkey PRIMARY KEY (id);


--
-- Name: cc_column_values cc_column_values_task_id_column_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cc_column_values
    ADD CONSTRAINT cc_column_values_task_id_column_id_key UNIQUE (task_id, column_id);


--
-- Name: cc_custom_columns cc_custom_columns_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cc_custom_columns
    ADD CONSTRAINT cc_custom_columns_pkey PRIMARY KEY (id);


--
-- Name: cc_custom_columns cc_custom_columns_project_id_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cc_custom_columns
    ADD CONSTRAINT cc_custom_columns_project_id_key_key UNIQUE (project_id, key);


--
-- Name: cc_label_options cc_label_options_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cc_label_options
    ADD CONSTRAINT cc_label_options_pkey PRIMARY KEY (id);


--
-- Name: cc_selection_options cc_selection_options_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cc_selection_options
    ADD CONSTRAINT cc_selection_options_pkey PRIMARY KEY (id);


--
-- Name: clients clients_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pk PRIMARY KEY (id);


--
-- Name: countries countries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.countries
    ADD CONSTRAINT countries_pkey PRIMARY KEY (id);


--
-- Name: cpt_phases cpt_phases_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cpt_phases
    ADD CONSTRAINT cpt_phases_pk PRIMARY KEY (id);


--
-- Name: cpt_task_labels cpt_task_labels_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cpt_task_labels
    ADD CONSTRAINT cpt_task_labels_pk PRIMARY KEY (task_id, label_id);


--
-- Name: cpt_task_statuses cpt_task_statuses_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cpt_task_statuses
    ADD CONSTRAINT cpt_task_statuses_pk PRIMARY KEY (id);


--
-- Name: cpt_tasks cpt_tasks_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cpt_tasks
    ADD CONSTRAINT cpt_tasks_pk PRIMARY KEY (id);


--
-- Name: cpt_tasks cpt_tasks_sort_order_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cpt_tasks
    ADD CONSTRAINT cpt_tasks_sort_order_unique UNIQUE (template_id, sort_order) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: custom_project_templates custom_project_templates_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.custom_project_templates
    ADD CONSTRAINT custom_project_templates_pk PRIMARY KEY (id);


--
-- Name: email_invitations email_invitations_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_invitations
    ADD CONSTRAINT email_invitations_pk PRIMARY KEY (id);


--
-- Name: favorite_projects favorite_projects_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.favorite_projects
    ADD CONSTRAINT favorite_projects_pk PRIMARY KEY (user_id, project_id);


--
-- Name: job_titles job_titles_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_titles
    ADD CONSTRAINT job_titles_pk PRIMARY KEY (id);


--
-- Name: licensing_admin_users licensing_admin_users_id_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.licensing_admin_users
    ADD CONSTRAINT licensing_admin_users_id_pk PRIMARY KEY (id);


--
-- Name: licensing_app_sumo_batches licensing_app_sumo_batches_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.licensing_app_sumo_batches
    ADD CONSTRAINT licensing_app_sumo_batches_pk PRIMARY KEY (id);


--
-- Name: licensing_coupon_codes licensing_coupon_codes_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.licensing_coupon_codes
    ADD CONSTRAINT licensing_coupon_codes_pk PRIMARY KEY (id);


--
-- Name: licensing_coupon_logs licensing_coupon_logs_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.licensing_coupon_logs
    ADD CONSTRAINT licensing_coupon_logs_pk PRIMARY KEY (id);


--
-- Name: licensing_credit_subs licensing_credit_subs_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.licensing_credit_subs
    ADD CONSTRAINT licensing_credit_subs_pk PRIMARY KEY (id);


--
-- Name: licensing_custom_subs_logs licensing_custom_subs_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.licensing_custom_subs_logs
    ADD CONSTRAINT licensing_custom_subs_logs_pkey PRIMARY KEY (id);


--
-- Name: licensing_custom_subs licensing_custom_subs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.licensing_custom_subs
    ADD CONSTRAINT licensing_custom_subs_pkey PRIMARY KEY (id);


--
-- Name: licensing_payment_details licensing_payment_details_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.licensing_payment_details
    ADD CONSTRAINT licensing_payment_details_pkey PRIMARY KEY (id);


--
-- Name: licensing_pricing_plans licensing_pricing_plans_paddle_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.licensing_pricing_plans
    ADD CONSTRAINT licensing_pricing_plans_paddle_id_key UNIQUE (paddle_id);


--
-- Name: licensing_pricing_plans licensing_pricing_plans_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.licensing_pricing_plans
    ADD CONSTRAINT licensing_pricing_plans_pk PRIMARY KEY (id);


--
-- Name: licensing_user_subscriptions licensing_user_plans_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.licensing_user_subscriptions
    ADD CONSTRAINT licensing_user_plans_pk PRIMARY KEY (id);


--
-- Name: licensing_user_subscriptions licensing_user_subscriptions_subscription_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.licensing_user_subscriptions
    ADD CONSTRAINT licensing_user_subscriptions_subscription_id_key UNIQUE (subscription_id);


--
-- Name: notification_settings notification_settings_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_settings
    ADD CONSTRAINT notification_settings_pk PRIMARY KEY (user_id, team_id);


--
-- Name: organization_working_days organization_working_days_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_working_days
    ADD CONSTRAINT organization_working_days_pk PRIMARY KEY (id);


--
-- Name: organizations organizations_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pk PRIMARY KEY (id);


--
-- Name: organizations organizations_pk_2; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pk_2 UNIQUE (user_id);


--
-- Name: permissions permissions_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pk PRIMARY KEY (id);


--
-- Name: personal_todo_list personal_todo_list_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.personal_todo_list
    ADD CONSTRAINT personal_todo_list_pk PRIMARY KEY (id);


--
-- Name: pg_sessions pg_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pg_sessions
    ADD CONSTRAINT pg_sessions_pkey PRIMARY KEY (sid);


--
-- Name: project_access_levels project_access_levels_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_access_levels
    ADD CONSTRAINT project_access_levels_pk PRIMARY KEY (id);


--
-- Name: project_categories project_categories_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_categories
    ADD CONSTRAINT project_categories_pk PRIMARY KEY (id);


--
-- Name: project_comments project_comments_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_comments
    ADD CONSTRAINT project_comments_pk PRIMARY KEY (id);


--
-- Name: project_folders project_folders_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_folders
    ADD CONSTRAINT project_folders_pk PRIMARY KEY (id);


--
-- Name: project_logs project_logs_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_logs
    ADD CONSTRAINT project_logs_pk PRIMARY KEY (id);


--
-- Name: project_member_allocations project_member_allocations_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_member_allocations
    ADD CONSTRAINT project_member_allocations_pk PRIMARY KEY (id);


--
-- Name: project_members project_members_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_pk PRIMARY KEY (id);


--
-- Name: project_phases project_phases_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_phases
    ADD CONSTRAINT project_phases_pk PRIMARY KEY (id);


--
-- Name: project_subscribers project_subscribers_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_subscribers
    ADD CONSTRAINT project_subscribers_pk PRIMARY KEY (id);


--
-- Name: project_task_list_cols project_task_list_cols_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_task_list_cols
    ADD CONSTRAINT project_task_list_cols_pk PRIMARY KEY (id);


--
-- Name: projects projects_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pk PRIMARY KEY (id);


--
-- Name: pt_phases pt_project_template_phases_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pt_phases
    ADD CONSTRAINT pt_project_template_phases_pk PRIMARY KEY (id);


--
-- Name: pt_statuses pt_project_template_statuses_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pt_statuses
    ADD CONSTRAINT pt_project_template_statuses_pk PRIMARY KEY (id);


--
-- Name: pt_project_templates pt_project_templates_key_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pt_project_templates
    ADD CONSTRAINT pt_project_templates_key_unique UNIQUE (key);


--
-- Name: pt_labels pt_project_templates_labels_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pt_labels
    ADD CONSTRAINT pt_project_templates_labels_pk PRIMARY KEY (id);


--
-- Name: pt_project_templates pt_project_templates_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pt_project_templates
    ADD CONSTRAINT pt_project_templates_pk PRIMARY KEY (id);


--
-- Name: pt_task_labels pt_task_labels_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pt_task_labels
    ADD CONSTRAINT pt_task_labels_pk PRIMARY KEY (task_id, label_id);


--
-- Name: pt_task_statuses pt_task_statuses_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pt_task_statuses
    ADD CONSTRAINT pt_task_statuses_pk PRIMARY KEY (id);


--
-- Name: pt_tasks pt_tasks_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pt_tasks
    ADD CONSTRAINT pt_tasks_pk PRIMARY KEY (id);


--
-- Name: pt_tasks pt_tasks_sort_order_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pt_tasks
    ADD CONSTRAINT pt_tasks_sort_order_unique UNIQUE (template_id, sort_order) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: role_permissions role_permissions_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pk PRIMARY KEY (role_id, permission_id);


--
-- Name: roles roles_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pk PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: spam_emails spam_emails_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.spam_emails
    ADD CONSTRAINT spam_emails_pk PRIMARY KEY (id);


--
-- Name: survey_answers survey_answers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.survey_answers
    ADD CONSTRAINT survey_answers_pkey PRIMARY KEY (id);


--
-- Name: survey_questions survey_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.survey_questions
    ADD CONSTRAINT survey_questions_pkey PRIMARY KEY (id);


--
-- Name: survey_responses survey_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.survey_responses
    ADD CONSTRAINT survey_responses_pkey PRIMARY KEY (id);


--
-- Name: surveys surveys_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.surveys
    ADD CONSTRAINT surveys_pkey PRIMARY KEY (id);


--
-- Name: sys_license_types sys_license_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sys_license_types
    ADD CONSTRAINT sys_license_types_pkey PRIMARY KEY (id);


--
-- Name: sys_project_healths sys_project_healths_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sys_project_healths
    ADD CONSTRAINT sys_project_healths_pk PRIMARY KEY (id);


--
-- Name: sys_project_statuses sys_project_statuses_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sys_project_statuses
    ADD CONSTRAINT sys_project_statuses_pk PRIMARY KEY (id);


--
-- Name: sys_task_status_categories sys_task_status_categories_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sys_task_status_categories
    ADD CONSTRAINT sys_task_status_categories_pk PRIMARY KEY (id);


--
-- Name: task_activity_logs task_activity_logs_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_activity_logs
    ADD CONSTRAINT task_activity_logs_pk PRIMARY KEY (id);


--
-- Name: task_attachments task_attachments_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_attachments
    ADD CONSTRAINT task_attachments_pk PRIMARY KEY (id);


--
-- Name: task_comment_attachments task_comment_attachments_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_comment_attachments
    ADD CONSTRAINT task_comment_attachments_pk PRIMARY KEY (id);


--
-- Name: task_comment_reactions task_comment_reactions_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_comment_reactions
    ADD CONSTRAINT task_comment_reactions_pk PRIMARY KEY (id);


--
-- Name: task_comments task_comments_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_comments
    ADD CONSTRAINT task_comments_pk PRIMARY KEY (id);


--
-- Name: task_dependencies task_dependencies_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_dependencies
    ADD CONSTRAINT task_dependencies_pk PRIMARY KEY (id);


--
-- Name: task_dependencies task_dependencies_unique_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_dependencies
    ADD CONSTRAINT task_dependencies_unique_key UNIQUE (task_id, related_task_id, dependency_type);


--
-- Name: task_labels task_labels_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_labels
    ADD CONSTRAINT task_labels_pk PRIMARY KEY (task_id, label_id);


--
-- Name: task_priorities task_priorities_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_priorities
    ADD CONSTRAINT task_priorities_pk PRIMARY KEY (id);


--
-- Name: task_recurring_schedules task_recurring_schedules_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_recurring_schedules
    ADD CONSTRAINT task_recurring_schedules_pk PRIMARY KEY (id);


--
-- Name: task_statuses task_statuses_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_statuses
    ADD CONSTRAINT task_statuses_pk PRIMARY KEY (id);


--
-- Name: task_subscribers task_subscribers_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_subscribers
    ADD CONSTRAINT task_subscribers_pk PRIMARY KEY (id);


--
-- Name: task_templates task_templates_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_templates
    ADD CONSTRAINT task_templates_pk PRIMARY KEY (id);


--
-- Name: task_timers task_timers_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_timers
    ADD CONSTRAINT task_timers_pk PRIMARY KEY (task_id, user_id);


--
-- Name: task_updates task_updates_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_updates
    ADD CONSTRAINT task_updates_pk PRIMARY KEY (id);


--
-- Name: task_work_log task_work_log_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_work_log
    ADD CONSTRAINT task_work_log_pk PRIMARY KEY (id);


--
-- Name: tasks_assignees tasks_assignees_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks_assignees
    ADD CONSTRAINT tasks_assignees_pk PRIMARY KEY (task_id, project_member_id);


--
-- Name: tasks tasks_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pk PRIMARY KEY (id);


--
-- Name: tasks tasks_sort_order_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_sort_order_unique UNIQUE (project_id, sort_order) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: team_labels team_labels_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.team_labels
    ADD CONSTRAINT team_labels_pk PRIMARY KEY (id);


--
-- Name: team_members team_members_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_pk PRIMARY KEY (id);


--
-- Name: teams teams_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_pk PRIMARY KEY (id);


--
-- Name: timezones timezones_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.timezones
    ADD CONSTRAINT timezones_pk PRIMARY KEY (id);


--
-- Name: survey_answers unique_response_question_answer; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.survey_answers
    ADD CONSTRAINT unique_response_question_answer UNIQUE (response_id, question_id);


--
-- Name: survey_responses unique_user_survey_response; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.survey_responses
    ADD CONSTRAINT unique_user_survey_response UNIQUE (user_id, survey_id);


--
-- Name: user_deletion_logs user_deletion_logs_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_deletion_logs
    ADD CONSTRAINT user_deletion_logs_pk PRIMARY KEY (id);


--
-- Name: user_notifications user_notifications_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_notifications
    ADD CONSTRAINT user_notifications_pk PRIMARY KEY (id);


--
-- Name: users_data users_data_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users_data
    ADD CONSTRAINT users_data_user_id_key UNIQUE (user_id);


--
-- Name: users users_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pk PRIMARY KEY (id);


--
-- Name: bounced_emails_email_uindex; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX bounced_emails_email_uindex ON public.bounced_emails USING btree (email);


--
-- Name: clients_id_team_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX clients_id_team_id_index ON public.clients USING btree (id, team_id);


--
-- Name: clients_name_team_id_uindex; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX clients_name_team_id_uindex ON public.clients USING btree (name, team_id);


--
-- Name: cpt_phases_name_project_uindex; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX cpt_phases_name_project_uindex ON public.cpt_phases USING btree (name, template_id);


--
-- Name: cpt_task_phase_cpt_task_phase_uindex; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX cpt_task_phase_cpt_task_phase_uindex ON public.cpt_task_phases USING btree (task_id, phase_id);


--
-- Name: cpt_task_phase_task_id_uindex; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX cpt_task_phase_task_id_uindex ON public.cpt_task_phases USING btree (task_id);


--
-- Name: cpt_task_statuses_template_id_name_uindex; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX cpt_task_statuses_template_id_name_uindex ON public.cpt_task_statuses USING btree (template_id, name);


--
-- Name: custom_project_templates_name_team_id_uindex; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX custom_project_templates_name_team_id_uindex ON public.custom_project_templates USING btree (name, team_id);


--
-- Name: idx_cc_column_values_task; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cc_column_values_task ON public.cc_column_values USING btree (task_id);


--
-- Name: idx_email_invitations_team_member; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_email_invitations_team_member ON public.email_invitations USING btree (team_member_id);


--
-- Name: idx_notification_settings_user_team; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notification_settings_user_team ON public.notification_settings USING btree (user_id, team_id);


--
-- Name: idx_pg_sessions_expire; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pg_sessions_expire ON public.pg_sessions USING btree (expire);


--
-- Name: idx_project_phases_project_sort; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_project_phases_project_sort ON public.project_phases USING btree (project_id, sort_index);


--
-- Name: idx_survey_answers_response; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_survey_answers_response ON public.survey_answers USING btree (response_id);


--
-- Name: idx_survey_questions_survey_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_survey_questions_survey_order ON public.survey_questions USING btree (survey_id, sort_order);


--
-- Name: idx_survey_responses_completed; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_survey_responses_completed ON public.survey_responses USING btree (survey_id, is_completed);


--
-- Name: idx_survey_responses_user_survey; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_survey_responses_user_survey ON public.survey_responses USING btree (user_id, survey_id);


--
-- Name: idx_surveys_type_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_surveys_type_active ON public.surveys USING btree (survey_type, is_active);


--
-- Name: idx_sys_task_status_categories_covering; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sys_task_status_categories_covering ON public.sys_task_status_categories USING btree (id, color_code, color_code_dark, is_done, is_doing, is_todo);


--
-- Name: idx_task_attachments_task; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_task_attachments_task ON public.task_attachments USING btree (task_id);


--
-- Name: idx_task_comments_task; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_task_comments_task ON public.task_comments USING btree (task_id);


--
-- Name: idx_task_dependencies_task; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_task_dependencies_task ON public.task_dependencies USING btree (task_id);


--
-- Name: idx_task_labels_task_label; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_task_labels_task_label ON public.task_labels USING btree (task_id, label_id);


--
-- Name: idx_task_phase_task_phase; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_task_phase_task_phase ON public.task_phase USING btree (task_id, phase_id);


--
-- Name: idx_task_priorities_value; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_task_priorities_value ON public.task_priorities USING btree (value);


--
-- Name: idx_task_statuses_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_task_statuses_category ON public.task_statuses USING btree (category_id, project_id);


--
-- Name: idx_task_statuses_covering; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_task_statuses_covering ON public.task_statuses USING btree (id, category_id, project_id);


--
-- Name: idx_task_subscribers_task; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_task_subscribers_task ON public.task_subscribers USING btree (task_id);


--
-- Name: idx_task_timers_task_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_task_timers_task_user ON public.task_timers USING btree (task_id, user_id);


--
-- Name: idx_task_timers_user_task; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_task_timers_user_task ON public.task_timers USING btree (user_id, task_id);


--
-- Name: idx_task_work_log_task; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_task_work_log_task ON public.task_work_log USING btree (task_id);


--
-- Name: idx_tasks_assignees_task_member; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tasks_assignees_task_member ON public.tasks_assignees USING btree (task_id, team_member_id);


--
-- Name: idx_tasks_covering_main; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tasks_covering_main ON public.tasks USING btree (id, project_id, archived, parent_task_id, status_id, priority_id, sort_order, name) WHERE (archived = false);


--
-- Name: idx_tasks_dates; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tasks_dates ON public.tasks USING btree (project_id, start_date, end_date) WHERE (archived = false);


--
-- Name: idx_tasks_name_search; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tasks_name_search ON public.tasks USING gin (to_tsvector('english'::regconfig, name)) WHERE (archived = false);


--
-- Name: idx_tasks_parent_archived; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tasks_parent_archived ON public.tasks USING btree (parent_task_id, archived) WHERE ((parent_task_id IS NOT NULL) AND (archived = false));


--
-- Name: idx_tasks_parent_status_archived; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tasks_parent_status_archived ON public.tasks USING btree (parent_task_id, status_id, archived) WHERE (archived = false);


--
-- Name: idx_tasks_performance_main; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tasks_performance_main ON public.tasks USING btree (project_id, archived, parent_task_id, status_id, priority_id) WHERE (archived = false);


--
-- Name: idx_tasks_phase_sort_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tasks_phase_sort_order ON public.tasks USING btree (project_id, phase_sort_order);


--
-- Name: idx_tasks_priority_sort_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tasks_priority_sort_order ON public.tasks USING btree (project_id, priority_sort_order);


--
-- Name: idx_tasks_project_archived_parent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tasks_project_archived_parent ON public.tasks USING btree (project_id, archived, parent_task_id) WHERE (archived = false);


--
-- Name: idx_tasks_project_sort_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tasks_project_sort_order ON public.tasks USING btree (project_id, sort_order) WHERE (archived = false);


--
-- Name: idx_tasks_status_project; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tasks_status_project ON public.tasks USING btree (status_id, project_id) WHERE (archived = false);


--
-- Name: idx_tasks_status_sort_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tasks_status_sort_order ON public.tasks USING btree (project_id, status_sort_order);


--
-- Name: idx_team_labels_team; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_team_labels_team ON public.team_labels USING btree (team_id);


--
-- Name: idx_team_member_info_mv_team_member_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_team_member_info_mv_team_member_id ON public.team_member_info_mv USING btree (team_member_id);


--
-- Name: idx_team_member_info_mv_team_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_team_member_info_mv_team_user ON public.team_member_info_mv USING btree (team_id, user_id);


--
-- Name: idx_team_members_project_lookup; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_team_members_project_lookup ON public.team_members USING btree (team_id, active, user_id) WHERE (active = true);


--
-- Name: idx_team_members_team_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_team_members_team_user ON public.team_members USING btree (team_id, user_id) WHERE (active = true);


--
-- Name: idx_user_deletion_logs_scheduled_deletion; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_deletion_logs_scheduled_deletion ON public.user_deletion_logs USING btree (scheduled_deletion_date) WHERE (NOT deletion_completed);


--
-- Name: idx_user_deletion_logs_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_deletion_logs_user_id ON public.user_deletion_logs USING btree (user_id);


--
-- Name: job_titles_name_team_id_uindex; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX job_titles_name_team_id_uindex ON public.job_titles USING btree (name, team_id);


--
-- Name: job_titles_team_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX job_titles_team_id_index ON public.job_titles USING btree (team_id);


--
-- Name: licensing_admin_users_name_uindex; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX licensing_admin_users_name_uindex ON public.licensing_admin_users USING btree (name);


--
-- Name: licensing_admin_users_phone_no_uindex; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX licensing_admin_users_phone_no_uindex ON public.licensing_admin_users USING btree (phone_no);


--
-- Name: licensing_admin_users_username_uindex; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX licensing_admin_users_username_uindex ON public.licensing_admin_users USING btree (username);


--
-- Name: licensing_coupon_codes_coupon_code_uindex; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX licensing_coupon_codes_coupon_code_uindex ON public.licensing_coupon_codes USING btree (coupon_code);


--
-- Name: licensing_coupon_codes_redeemed_by_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX licensing_coupon_codes_redeemed_by_index ON public.licensing_coupon_codes USING btree (redeemed_by);


--
-- Name: licensing_pricing_plans_uindex; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX licensing_pricing_plans_uindex ON public.licensing_pricing_plans USING btree (id);


--
-- Name: licensing_user_plans_uindex; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX licensing_user_plans_uindex ON public.licensing_user_subscriptions USING btree (id);


--
-- Name: licensing_user_subscriptions_user_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX licensing_user_subscriptions_user_id_index ON public.licensing_user_subscriptions USING btree (user_id);


--
-- Name: notification_settings_team_user_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX notification_settings_team_user_id_index ON public.notification_settings USING btree (team_id, user_id);


--
-- Name: permissions_name_uindex; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX permissions_name_uindex ON public.permissions USING btree (name);


--
-- Name: personal_todo_list_index_uindex; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX personal_todo_list_index_uindex ON public.personal_todo_list USING btree (user_id, index);


--
-- Name: project_access_levels_key_uindex; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX project_access_levels_key_uindex ON public.project_access_levels USING btree (key);


--
-- Name: project_access_levels_name_uindex; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX project_access_levels_name_uindex ON public.project_access_levels USING btree (name);


--
-- Name: project_categories_name_team_id_uindex; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX project_categories_name_team_id_uindex ON public.project_categories USING btree (name, team_id);


--
-- Name: project_comments_project_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX project_comments_project_id_index ON public.project_comments USING btree (project_id);


--
-- Name: project_folders_team_id_key_uindex; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX project_folders_team_id_key_uindex ON public.project_folders USING btree (team_id, key);


--
-- Name: project_folders_team_id_name_uindex; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX project_folders_team_id_name_uindex ON public.project_folders USING btree (team_id, name);


--
-- Name: project_members_project_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX project_members_project_id_index ON public.project_members USING btree (project_id);


--
-- Name: project_members_project_id_member_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX project_members_project_id_member_id_index ON public.project_members USING btree (project_id, team_member_id);


--
-- Name: project_members_team_member_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX project_members_team_member_id_index ON public.project_members USING btree (team_member_id);


--
-- Name: project_members_team_member_project_uindex; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX project_members_team_member_project_uindex ON public.project_members USING btree (team_member_id, project_id);


--
-- Name: project_phases_name_project_uindex; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX project_phases_name_project_uindex ON public.project_phases USING btree (name, project_id);


--
-- Name: project_subscribers_user_task_team_member_uindex; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX project_subscribers_user_task_team_member_uindex ON public.project_subscribers USING btree (user_id, project_id, team_member_id);


--
-- Name: project_task_list_cols_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX project_task_list_cols_index ON public.project_task_list_cols USING btree (project_id, index);


--
-- Name: project_task_list_cols_key_project_uindex; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX project_task_list_cols_key_project_uindex ON public.project_task_list_cols USING btree (key, project_id);


--
-- Name: projects_folder_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX projects_folder_id_index ON public.projects USING btree (folder_id);


--
-- Name: projects_id_team_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX projects_id_team_id_index ON public.projects USING btree (id, team_id);


--
-- Name: projects_key_team_id_uindex; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX projects_key_team_id_uindex ON public.projects USING btree (key, team_id);


--
-- Name: projects_name_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX projects_name_index ON public.projects USING btree (name);


--
-- Name: projects_name_team_id_uindex; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX projects_name_team_id_uindex ON public.projects USING btree (name, team_id);


--
-- Name: projects_team_id_folder_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX projects_team_id_folder_id_index ON public.projects USING btree (team_id, folder_id);


--
-- Name: projects_team_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX projects_team_id_index ON public.projects USING btree (team_id);


--
-- Name: projects_team_id_name_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX projects_team_id_name_index ON public.projects USING btree (team_id, name);


--
-- Name: email_invitations email_invitations_email_lower; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER email_invitations_email_lower BEFORE INSERT OR UPDATE ON public.email_invitations FOR EACH STATEMENT EXECUTE FUNCTION public.lower_email();


--
-- Name: tasks ensure_parent_task_without_manual_progress_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER ensure_parent_task_without_manual_progress_trigger AFTER INSERT OR UPDATE OF parent_task_id ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.ensure_parent_task_without_manual_progress();


--
-- Name: team_members insert_notification_settings; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER insert_notification_settings AFTER INSERT ON public.team_members FOR EACH ROW EXECUTE FUNCTION public.notification_settings_insert_trigger_fn();


--
-- Name: tasks projects_tasks_counter_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER projects_tasks_counter_trigger BEFORE INSERT ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_project_tasks_counter_trigger_fn();


--
-- Name: team_members remove_notification_settings; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER remove_notification_settings BEFORE DELETE ON public.team_members FOR EACH ROW EXECUTE FUNCTION public.notification_settings_delete_trigger_fn();


--
-- Name: tasks reset_parent_manual_progress_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER reset_parent_manual_progress_trigger AFTER INSERT OR UPDATE OF parent_task_id ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.reset_parent_task_manual_progress();


--
-- Name: projects reset_progress_on_mode_change; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER reset_progress_on_mode_change AFTER UPDATE OF use_manual_progress, use_weighted_progress, use_time_progress ON public.projects FOR EACH ROW EXECUTE FUNCTION public.reset_project_progress_values();


--
-- Name: tasks set_task_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_task_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.set_task_updated_at_trigger_fn();


--
-- Name: tasks tasks_status_id_change; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tasks_status_id_change AFTER UPDATE OF status_id ON public.tasks FOR EACH ROW WHEN ((old.status_id IS DISTINCT FROM new.status_id)) EXECUTE FUNCTION public.task_status_change_trigger_fn();


--
-- Name: tasks tasks_task_subscriber_notify_done; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tasks_task_subscriber_notify_done BEFORE UPDATE OF status_id ON public.tasks FOR EACH ROW WHEN ((old.status_id IS DISTINCT FROM new.status_id)) EXECUTE FUNCTION public.tasks_task_subscriber_notify_done_trigger();


--
-- Name: tasks update_parent_task_progress_on_insert_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_parent_task_progress_on_insert_trigger AFTER INSERT ON public.tasks FOR EACH ROW WHEN ((new.parent_task_id IS NOT NULL)) EXECUTE FUNCTION public.update_parent_task_progress();


--
-- Name: tasks update_parent_task_progress_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_parent_task_progress_trigger AFTER UPDATE OF progress_value, weight, total_minutes, parent_task_id, manual_progress ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_parent_task_progress();


--
-- Name: users users_email_lower; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER users_email_lower BEFORE INSERT OR UPDATE ON public.users FOR EACH STATEMENT EXECUTE FUNCTION public.lower_email();


--
-- Name: archived_projects archived_projects_project_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.archived_projects
    ADD CONSTRAINT archived_projects_project_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: archived_projects archived_projects_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.archived_projects
    ADD CONSTRAINT archived_projects_user_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: cc_column_configurations cc_column_configurations_column_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cc_column_configurations
    ADD CONSTRAINT cc_column_configurations_column_id_fkey FOREIGN KEY (column_id) REFERENCES public.cc_custom_columns(id) ON DELETE CASCADE;


--
-- Name: cc_column_values cc_column_values_column_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cc_column_values
    ADD CONSTRAINT cc_column_values_column_id_fkey FOREIGN KEY (column_id) REFERENCES public.cc_custom_columns(id) ON DELETE CASCADE;


--
-- Name: cc_column_values cc_column_values_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cc_column_values
    ADD CONSTRAINT cc_column_values_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: cc_custom_columns cc_custom_columns_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cc_custom_columns
    ADD CONSTRAINT cc_custom_columns_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: cc_label_options cc_label_options_column_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cc_label_options
    ADD CONSTRAINT cc_label_options_column_id_fkey FOREIGN KEY (column_id) REFERENCES public.cc_custom_columns(id) ON DELETE CASCADE;


--
-- Name: cc_selection_options cc_selection_options_column_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cc_selection_options
    ADD CONSTRAINT cc_selection_options_column_id_fkey FOREIGN KEY (column_id) REFERENCES public.cc_custom_columns(id) ON DELETE CASCADE;


--
-- Name: clients clients_team_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_team_id_fk FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: cpt_phases cpt_phases_template_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cpt_phases
    ADD CONSTRAINT cpt_phases_template_id_fk FOREIGN KEY (template_id) REFERENCES public.custom_project_templates(id) ON DELETE CASCADE;


--
-- Name: cpt_task_labels cpt_task_labels_label_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cpt_task_labels
    ADD CONSTRAINT cpt_task_labels_label_id_fk FOREIGN KEY (label_id) REFERENCES public.team_labels(id) ON DELETE CASCADE;


--
-- Name: cpt_task_labels cpt_task_labels_task_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cpt_task_labels
    ADD CONSTRAINT cpt_task_labels_task_id_fk FOREIGN KEY (task_id) REFERENCES public.cpt_tasks(id) ON DELETE CASCADE;


--
-- Name: cpt_task_phases cpt_task_phase_phase_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cpt_task_phases
    ADD CONSTRAINT cpt_task_phase_phase_id_fk FOREIGN KEY (phase_id) REFERENCES public.cpt_phases(id) ON DELETE CASCADE;


--
-- Name: cpt_task_phases cpt_task_phase_task_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cpt_task_phases
    ADD CONSTRAINT cpt_task_phase_task_id_fk FOREIGN KEY (task_id) REFERENCES public.cpt_tasks(id) ON DELETE CASCADE;


--
-- Name: cpt_task_statuses cpt_task_statuses_category_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cpt_task_statuses
    ADD CONSTRAINT cpt_task_statuses_category_id_fk FOREIGN KEY (category_id) REFERENCES public.sys_task_status_categories(id);


--
-- Name: cpt_task_statuses cpt_task_statuses_team_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cpt_task_statuses
    ADD CONSTRAINT cpt_task_statuses_team_id_fk FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: cpt_task_statuses cpt_task_statuses_template_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cpt_task_statuses
    ADD CONSTRAINT cpt_task_statuses_template_id_fk FOREIGN KEY (template_id) REFERENCES public.custom_project_templates(id) ON DELETE CASCADE;


--
-- Name: cpt_tasks cpt_tasks_priority_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cpt_tasks
    ADD CONSTRAINT cpt_tasks_priority_fk FOREIGN KEY (priority_id) REFERENCES public.task_priorities(id);


--
-- Name: cpt_tasks cpt_tasks_status_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cpt_tasks
    ADD CONSTRAINT cpt_tasks_status_id_fk FOREIGN KEY (status_id) REFERENCES public.cpt_task_statuses(id) ON DELETE RESTRICT;


--
-- Name: cpt_tasks cpt_tasks_template_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cpt_tasks
    ADD CONSTRAINT cpt_tasks_template_fk FOREIGN KEY (template_id) REFERENCES public.custom_project_templates(id) ON DELETE CASCADE;


--
-- Name: custom_project_templates custom_project_templates_team_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.custom_project_templates
    ADD CONSTRAINT custom_project_templates_team_id_fk FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: email_invitations email_invitations_team_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_invitations
    ADD CONSTRAINT email_invitations_team_id_fk FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: email_invitations email_invitations_team_member_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_invitations
    ADD CONSTRAINT email_invitations_team_member_id_fk FOREIGN KEY (team_member_id) REFERENCES public.team_members(id) ON DELETE CASCADE;


--
-- Name: favorite_projects favorite_projects_project_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.favorite_projects
    ADD CONSTRAINT favorite_projects_project_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: favorite_projects favorite_projects_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.favorite_projects
    ADD CONSTRAINT favorite_projects_user_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: job_titles job_titles_team_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_titles
    ADD CONSTRAINT job_titles_team_id_fk FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: licensing_app_sumo_batches licensing_app_sumo_batches_created_by_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.licensing_app_sumo_batches
    ADD CONSTRAINT licensing_app_sumo_batches_created_by_fk FOREIGN KEY (created_by) REFERENCES public.licensing_admin_users(id);


--
-- Name: licensing_coupon_codes licensing_coupon_codes_created_by_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.licensing_coupon_codes
    ADD CONSTRAINT licensing_coupon_codes_created_by_fk FOREIGN KEY (created_by) REFERENCES public.licensing_admin_users(id);


--
-- Name: licensing_coupon_codes licensing_coupon_codes_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.licensing_coupon_codes
    ADD CONSTRAINT licensing_coupon_codes_users_id_fk FOREIGN KEY (redeemed_by) REFERENCES public.users(id);


--
-- Name: licensing_coupon_logs licensing_coupon_logs_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.licensing_coupon_logs
    ADD CONSTRAINT licensing_coupon_logs_users_id_fk FOREIGN KEY (redeemed_by) REFERENCES public.users(id);


--
-- Name: licensing_credit_subs licensing_credit_subs_created_by_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.licensing_credit_subs
    ADD CONSTRAINT licensing_credit_subs_created_by_fk FOREIGN KEY (created_by) REFERENCES public.licensing_admin_users(id);


--
-- Name: licensing_credit_subs licensing_credit_subs_next_plan_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.licensing_credit_subs
    ADD CONSTRAINT licensing_credit_subs_next_plan_id_fk FOREIGN KEY (next_plan_id) REFERENCES public.licensing_pricing_plans(id);


--
-- Name: licensing_credit_subs licensing_credit_subs_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.licensing_credit_subs
    ADD CONSTRAINT licensing_credit_subs_user_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: licensing_custom_subs_logs licensing_custom_subs_logs_licensing_admin_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.licensing_custom_subs_logs
    ADD CONSTRAINT licensing_custom_subs_logs_licensing_admin_users_id_fk FOREIGN KEY (admin_user_id) REFERENCES public.licensing_admin_users(id);


--
-- Name: licensing_custom_subs licensing_custom_subs_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.licensing_custom_subs
    ADD CONSTRAINT licensing_custom_subs_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: licensing_payment_details licensing_payment_details_licensing_pricing_plans_paddle_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.licensing_payment_details
    ADD CONSTRAINT licensing_payment_details_licensing_pricing_plans_paddle_id_fk FOREIGN KEY (subscription_plan_id) REFERENCES public.licensing_pricing_plans(paddle_id);


--
-- Name: licensing_payment_details licensing_payment_details_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.licensing_payment_details
    ADD CONSTRAINT licensing_payment_details_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: licensing_settings licensing_settings_licensing_pricing_plans_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.licensing_settings
    ADD CONSTRAINT licensing_settings_licensing_pricing_plans_id_fk FOREIGN KEY (default_startup_plan) REFERENCES public.licensing_pricing_plans(id);


--
-- Name: licensing_settings licensing_settings_licensing_user_plans_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.licensing_settings
    ADD CONSTRAINT licensing_settings_licensing_user_plans_id_fk FOREIGN KEY (default_monthly_plan) REFERENCES public.licensing_pricing_plans(id);


--
-- Name: licensing_settings licensing_settings_licensing_user_plans_id_fk_2; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.licensing_settings
    ADD CONSTRAINT licensing_settings_licensing_user_plans_id_fk_2 FOREIGN KEY (default_annual_plan) REFERENCES public.licensing_pricing_plans(id);


--
-- Name: licensing_user_subscriptions licensing_user_subscriptions_licensing_pricing_plans_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.licensing_user_subscriptions
    ADD CONSTRAINT licensing_user_subscriptions_licensing_pricing_plans_id_fk FOREIGN KEY (plan_id) REFERENCES public.licensing_pricing_plans(id);


--
-- Name: licensing_user_subscriptions licensing_user_subscriptions_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.licensing_user_subscriptions
    ADD CONSTRAINT licensing_user_subscriptions_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: notification_settings notification_settings_team_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_settings
    ADD CONSTRAINT notification_settings_team_id_fk FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: notification_settings notification_settings_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_settings
    ADD CONSTRAINT notification_settings_user_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: organization_working_days org_organization_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_working_days
    ADD CONSTRAINT org_organization_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: organizations organization_user_id_pk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organization_user_id_pk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: personal_todo_list personal_todo_list_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.personal_todo_list
    ADD CONSTRAINT personal_todo_list_user_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: project_categories project_categories_created_by_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_categories
    ADD CONSTRAINT project_categories_created_by_fk FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: project_categories project_categories_team_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_categories
    ADD CONSTRAINT project_categories_team_id_fk FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: project_comment_mentions project_comment_mentions_comment_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_comment_mentions
    ADD CONSTRAINT project_comment_mentions_comment_id_fk FOREIGN KEY (comment_id) REFERENCES public.project_comments(id) ON DELETE CASCADE;


--
-- Name: project_comment_mentions project_comment_mentions_informed_by_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_comment_mentions
    ADD CONSTRAINT project_comment_mentions_informed_by_fk FOREIGN KEY (informed_by) REFERENCES public.users(id);


--
-- Name: project_comment_mentions project_comment_mentions_mentioned_by_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_comment_mentions
    ADD CONSTRAINT project_comment_mentions_mentioned_by_fk FOREIGN KEY (mentioned_by) REFERENCES public.users(id);


--
-- Name: project_comments project_comments_created_by_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_comments
    ADD CONSTRAINT project_comments_created_by_fk FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: project_comments project_comments_project_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_comments
    ADD CONSTRAINT project_comments_project_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_folders project_folders_created_by_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_folders
    ADD CONSTRAINT project_folders_created_by_fk FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: project_folders project_folders_parent_folder_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_folders
    ADD CONSTRAINT project_folders_parent_folder_fk FOREIGN KEY (parent_folder_id) REFERENCES public.project_folders(id);


--
-- Name: project_folders project_folders_team_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_folders
    ADD CONSTRAINT project_folders_team_id_fk FOREIGN KEY (team_id) REFERENCES public.teams(id);


--
-- Name: project_logs project_logs_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_logs
    ADD CONSTRAINT project_logs_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_logs project_logs_teams_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_logs
    ADD CONSTRAINT project_logs_teams_id_fk FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: project_members project_members_access_level_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_access_level_fk FOREIGN KEY (project_access_level_id) REFERENCES public.project_access_levels(id);


--
-- Name: project_member_allocations project_members_allocations_project_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_member_allocations
    ADD CONSTRAINT project_members_allocations_project_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_member_allocations project_members_allocations_team_member_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_member_allocations
    ADD CONSTRAINT project_members_allocations_team_member_id_fk FOREIGN KEY (team_member_id) REFERENCES public.team_members(id) ON DELETE CASCADE;


--
-- Name: project_members project_members_project_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_project_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_members project_members_role_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_role_id_fk FOREIGN KEY (role_id) REFERENCES public.roles(id);


--
-- Name: project_members project_members_team_member_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_team_member_id_fk FOREIGN KEY (team_member_id) REFERENCES public.team_members(id) ON DELETE CASCADE;


--
-- Name: project_phases project_phases_project_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_phases
    ADD CONSTRAINT project_phases_project_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_subscribers project_subscribers_project_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_subscribers
    ADD CONSTRAINT project_subscribers_project_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_subscribers project_subscribers_team_member_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_subscribers
    ADD CONSTRAINT project_subscribers_team_member_id_fk FOREIGN KEY (team_member_id) REFERENCES public.team_members(id) ON DELETE CASCADE;


--
-- Name: project_subscribers project_subscribers_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_subscribers
    ADD CONSTRAINT project_subscribers_user_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: project_task_list_cols project_task_list_cols_project_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_task_list_cols
    ADD CONSTRAINT project_task_list_cols_project_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: projects projects_category_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_category_id_fk FOREIGN KEY (category_id) REFERENCES public.project_categories(id) ON DELETE CASCADE;


--
-- Name: projects projects_client_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_client_id_fk FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- Name: projects projects_folder_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_folder_id_fk FOREIGN KEY (folder_id) REFERENCES public.project_folders(id) ON DELETE SET DEFAULT;


--
-- Name: projects projects_owner_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_owner_id_fk FOREIGN KEY (owner_id) REFERENCES public.users(id);


--
-- Name: projects projects_team_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_team_id_fk FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: pt_labels pt_labels_pt_project_templates_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pt_labels
    ADD CONSTRAINT pt_labels_pt_project_templates_id_fk FOREIGN KEY (template_id) REFERENCES public.pt_project_templates(id);


--
-- Name: pt_phases pt_project_template_phases_template_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pt_phases
    ADD CONSTRAINT pt_project_template_phases_template_id_fk FOREIGN KEY (template_id) REFERENCES public.pt_project_templates(id) ON DELETE CASCADE;


--
-- Name: pt_statuses pt_project_template_statuses_category_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pt_statuses
    ADD CONSTRAINT pt_project_template_statuses_category_id_fk FOREIGN KEY (category_id) REFERENCES public.sys_task_status_categories(id);


--
-- Name: pt_statuses pt_project_template_statuses_template_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pt_statuses
    ADD CONSTRAINT pt_project_template_statuses_template_id_fk FOREIGN KEY (template_id) REFERENCES public.pt_project_templates(id) ON DELETE CASCADE;


--
-- Name: pt_task_labels pt_task_labels_label_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pt_task_labels
    ADD CONSTRAINT pt_task_labels_label_id_fk FOREIGN KEY (label_id) REFERENCES public.pt_labels(id);


--
-- Name: pt_task_labels pt_task_labels_task_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pt_task_labels
    ADD CONSTRAINT pt_task_labels_task_id_fk FOREIGN KEY (task_id) REFERENCES public.pt_tasks(id) ON DELETE CASCADE;


--
-- Name: pt_task_phases pt_task_phase_phase_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pt_task_phases
    ADD CONSTRAINT pt_task_phase_phase_id_fk FOREIGN KEY (phase_id) REFERENCES public.pt_phases(id) ON DELETE CASCADE;


--
-- Name: pt_task_phases pt_task_phase_task_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pt_task_phases
    ADD CONSTRAINT pt_task_phase_task_id_fk FOREIGN KEY (task_id) REFERENCES public.pt_tasks(id) ON DELETE CASCADE;


--
-- Name: pt_task_statuses pt_task_statuses_category_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pt_task_statuses
    ADD CONSTRAINT pt_task_statuses_category_id_fk FOREIGN KEY (category_id) REFERENCES public.sys_task_status_categories(id);


--
-- Name: pt_task_statuses pt_task_statuses_team_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pt_task_statuses
    ADD CONSTRAINT pt_task_statuses_team_id_fk FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: pt_task_statuses pt_task_statuses_template_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pt_task_statuses
    ADD CONSTRAINT pt_task_statuses_template_id_fk FOREIGN KEY (template_id) REFERENCES public.pt_project_templates(id) ON DELETE CASCADE;


--
-- Name: pt_tasks pt_tasks_parent_task_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pt_tasks
    ADD CONSTRAINT pt_tasks_parent_task_id_fk FOREIGN KEY (parent_task_id) REFERENCES public.pt_tasks(id) ON DELETE CASCADE;


--
-- Name: pt_tasks pt_tasks_priority_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pt_tasks
    ADD CONSTRAINT pt_tasks_priority_fk FOREIGN KEY (priority_id) REFERENCES public.task_priorities(id);


--
-- Name: pt_tasks pt_tasks_status_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pt_tasks
    ADD CONSTRAINT pt_tasks_status_id_fk FOREIGN KEY (status_id) REFERENCES public.pt_statuses(id) ON DELETE RESTRICT;


--
-- Name: pt_tasks pt_tasks_template_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pt_tasks
    ADD CONSTRAINT pt_tasks_template_fk FOREIGN KEY (template_id) REFERENCES public.pt_project_templates(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_permission_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_fk FOREIGN KEY (permission_id) REFERENCES public.permissions(id);


--
-- Name: role_permissions role_permissions_role_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fk FOREIGN KEY (role_id) REFERENCES public.roles(id);


--
-- Name: survey_answers survey_answers_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.survey_answers
    ADD CONSTRAINT survey_answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.survey_questions(id) ON DELETE CASCADE;


--
-- Name: survey_answers survey_answers_response_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.survey_answers
    ADD CONSTRAINT survey_answers_response_id_fkey FOREIGN KEY (response_id) REFERENCES public.survey_responses(id) ON DELETE CASCADE;


--
-- Name: survey_questions survey_questions_survey_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.survey_questions
    ADD CONSTRAINT survey_questions_survey_id_fkey FOREIGN KEY (survey_id) REFERENCES public.surveys(id) ON DELETE CASCADE;


--
-- Name: survey_responses survey_responses_survey_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.survey_responses
    ADD CONSTRAINT survey_responses_survey_id_fkey FOREIGN KEY (survey_id) REFERENCES public.surveys(id) ON DELETE CASCADE;


--
-- Name: survey_responses survey_responses_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.survey_responses
    ADD CONSTRAINT survey_responses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: task_activity_logs task_activity_logs_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_activity_logs
    ADD CONSTRAINT task_activity_logs_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: task_activity_logs task_activity_logs_tasks_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_activity_logs
    ADD CONSTRAINT task_activity_logs_tasks_id_fk FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: task_activity_logs task_activity_logs_team_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_activity_logs
    ADD CONSTRAINT task_activity_logs_team_id_fk FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: task_activity_logs task_activity_logs_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_activity_logs
    ADD CONSTRAINT task_activity_logs_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: task_attachments task_attachments_project_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_attachments
    ADD CONSTRAINT task_attachments_project_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: task_attachments task_attachments_task_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_attachments
    ADD CONSTRAINT task_attachments_task_id_fk FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE SET NULL;


--
-- Name: task_attachments task_attachments_team_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_attachments
    ADD CONSTRAINT task_attachments_team_id_fk FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: task_attachments task_attachments_uploaded_by_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_attachments
    ADD CONSTRAINT task_attachments_uploaded_by_fk FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: task_comment_attachments task_comment_attachments_comment_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_comment_attachments
    ADD CONSTRAINT task_comment_attachments_comment_id_fk FOREIGN KEY (comment_id) REFERENCES public.task_comments(id) ON DELETE CASCADE;


--
-- Name: task_comment_attachments task_comment_attachments_project_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_comment_attachments
    ADD CONSTRAINT task_comment_attachments_project_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: task_comment_attachments task_comment_attachments_task_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_comment_attachments
    ADD CONSTRAINT task_comment_attachments_task_id_fk FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: task_comment_attachments task_comment_attachments_team_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_comment_attachments
    ADD CONSTRAINT task_comment_attachments_team_id_fk FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: task_comment_contents task_comment_contents_comment_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_comment_contents
    ADD CONSTRAINT task_comment_contents_comment_id_fk FOREIGN KEY (comment_id) REFERENCES public.task_comments(id) ON DELETE CASCADE;


--
-- Name: task_comment_contents task_comment_contents_team_member_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_comment_contents
    ADD CONSTRAINT task_comment_contents_team_member_fk FOREIGN KEY (team_member_id) REFERENCES public.team_members(id);


--
-- Name: task_comment_mentions task_comment_mentions_comment_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_comment_mentions
    ADD CONSTRAINT task_comment_mentions_comment_id_fk FOREIGN KEY (comment_id) REFERENCES public.task_comments(id) ON DELETE CASCADE;


--
-- Name: task_comment_mentions task_comment_mentions_informed_by_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_comment_mentions
    ADD CONSTRAINT task_comment_mentions_informed_by_fk FOREIGN KEY (informed_by) REFERENCES public.team_members(id) ON DELETE CASCADE;


--
-- Name: task_comment_mentions task_comment_mentions_mentioned_by_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_comment_mentions
    ADD CONSTRAINT task_comment_mentions_mentioned_by_fk FOREIGN KEY (mentioned_by) REFERENCES public.users(id);


--
-- Name: task_comment_reactions task_comment_reactions_comment_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_comment_reactions
    ADD CONSTRAINT task_comment_reactions_comment_id_fk FOREIGN KEY (comment_id) REFERENCES public.task_comments(id) ON DELETE CASCADE;


--
-- Name: task_comment_reactions task_comment_reactions_team_member_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_comment_reactions
    ADD CONSTRAINT task_comment_reactions_team_member_id_fk FOREIGN KEY (team_member_id) REFERENCES public.team_members(id) ON DELETE CASCADE;


--
-- Name: task_comment_reactions task_comment_reactions_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_comment_reactions
    ADD CONSTRAINT task_comment_reactions_user_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: task_comments task_comments_task_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_comments
    ADD CONSTRAINT task_comments_task_id_fk FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: task_comments task_comments_team_member_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_comments
    ADD CONSTRAINT task_comments_team_member_id_fk FOREIGN KEY (team_member_id) REFERENCES public.team_members(id) ON DELETE CASCADE;


--
-- Name: task_comments task_comments_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_comments
    ADD CONSTRAINT task_comments_user_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: task_dependencies task_dependencies_tasks_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_dependencies
    ADD CONSTRAINT task_dependencies_tasks_id_fk FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: task_dependencies task_dependencies_tasks_id_fk_2; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_dependencies
    ADD CONSTRAINT task_dependencies_tasks_id_fk_2 FOREIGN KEY (related_task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: task_labels task_labels_label_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_labels
    ADD CONSTRAINT task_labels_label_id_fk FOREIGN KEY (label_id) REFERENCES public.team_labels(id) ON DELETE CASCADE;


--
-- Name: task_labels task_labels_task_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_labels
    ADD CONSTRAINT task_labels_task_id_fk FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: task_phase task_phase_phase_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_phase
    ADD CONSTRAINT task_phase_phase_id_fk FOREIGN KEY (phase_id) REFERENCES public.project_phases(id) ON DELETE CASCADE;


--
-- Name: task_phase task_phase_task_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_phase
    ADD CONSTRAINT task_phase_task_id_fk FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: task_recurring_templates task_recurring_templates_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_recurring_templates
    ADD CONSTRAINT task_recurring_templates_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: task_recurring_templates task_recurring_templates_task_priorities_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_recurring_templates
    ADD CONSTRAINT task_recurring_templates_task_priorities_id_fk FOREIGN KEY (priority_id) REFERENCES public.task_priorities(id);


--
-- Name: task_recurring_templates task_recurring_templates_task_recurring_schedules_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_recurring_templates
    ADD CONSTRAINT task_recurring_templates_task_recurring_schedules_id_fk FOREIGN KEY (schedule_id) REFERENCES public.task_recurring_schedules(id) ON DELETE CASCADE;


--
-- Name: task_recurring_templates task_recurring_templates_tasks_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_recurring_templates
    ADD CONSTRAINT task_recurring_templates_tasks_id_fk FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: task_statuses task_statuses_category_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_statuses
    ADD CONSTRAINT task_statuses_category_id_fk FOREIGN KEY (category_id) REFERENCES public.sys_task_status_categories(id);


--
-- Name: task_statuses task_statuses_project_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_statuses
    ADD CONSTRAINT task_statuses_project_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: task_statuses task_statuses_team_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_statuses
    ADD CONSTRAINT task_statuses_team_id_fk FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: task_subscribers task_subscribers_task_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_subscribers
    ADD CONSTRAINT task_subscribers_task_id_fk FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: task_subscribers task_subscribers_team_member_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_subscribers
    ADD CONSTRAINT task_subscribers_team_member_id_fk FOREIGN KEY (team_member_id) REFERENCES public.team_members(id) ON DELETE CASCADE;


--
-- Name: task_subscribers task_subscribers_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_subscribers
    ADD CONSTRAINT task_subscribers_user_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: task_templates_tasks task_templates_tasks_template_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_templates_tasks
    ADD CONSTRAINT task_templates_tasks_template_id_fk FOREIGN KEY (template_id) REFERENCES public.task_templates(id) ON DELETE CASCADE;


--
-- Name: task_templates task_templates_teams_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_templates
    ADD CONSTRAINT task_templates_teams_id_fk FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: task_timers task_timers_task_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_timers
    ADD CONSTRAINT task_timers_task_id_fk FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: task_timers task_timers_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_timers
    ADD CONSTRAINT task_timers_user_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: task_updates task_updates_project_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_updates
    ADD CONSTRAINT task_updates_project_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: task_updates task_updates_reporter_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_updates
    ADD CONSTRAINT task_updates_reporter_id_fk FOREIGN KEY (reporter_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: task_updates task_updates_task_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_updates
    ADD CONSTRAINT task_updates_task_id_fk FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: task_updates task_updates_team_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_updates
    ADD CONSTRAINT task_updates_team_id_fk FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: task_updates task_updates_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_updates
    ADD CONSTRAINT task_updates_user_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: task_work_log task_work_log_task_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_work_log
    ADD CONSTRAINT task_work_log_task_id_fk FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: task_work_log task_work_log_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_work_log
    ADD CONSTRAINT task_work_log_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: tasks_assignees tasks_assignees_assigned_by_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks_assignees
    ADD CONSTRAINT tasks_assignees_assigned_by_fk FOREIGN KEY (assigned_by) REFERENCES public.users(id);


--
-- Name: tasks_assignees tasks_assignees_project_member_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks_assignees
    ADD CONSTRAINT tasks_assignees_project_member_id_fk FOREIGN KEY (project_member_id) REFERENCES public.project_members(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: tasks_assignees tasks_assignees_task_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks_assignees
    ADD CONSTRAINT tasks_assignees_task_id_fk FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: tasks_assignees tasks_assignees_team_member_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks_assignees
    ADD CONSTRAINT tasks_assignees_team_member_fk FOREIGN KEY (team_member_id) REFERENCES public.team_members(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_parent_task_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_parent_task_id_fk FOREIGN KEY (parent_task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_priority_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_priority_fk FOREIGN KEY (priority_id) REFERENCES public.task_priorities(id);


--
-- Name: tasks tasks_project_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_project_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_reporter_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_reporter_id_fk FOREIGN KEY (reporter_id) REFERENCES public.users(id);


--
-- Name: tasks tasks_status_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_status_id_fk FOREIGN KEY (status_id) REFERENCES public.task_statuses(id) ON DELETE RESTRICT;


--
-- Name: team_labels team_labels_team_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.team_labels
    ADD CONSTRAINT team_labels_team_id_fk FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: team_members team_members_job_title_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_job_title_id_fk FOREIGN KEY (job_title_id) REFERENCES public.job_titles(id) ON DELETE SET NULL;


--
-- Name: team_members team_members_role_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_role_id_fk FOREIGN KEY (role_id) REFERENCES public.roles(id);


--
-- Name: team_members team_members_team_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_team_id_fk FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: team_members team_members_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_user_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: teams team_organization_id_pk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT team_organization_id_pk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: teams teams_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_user_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: user_deletion_logs user_deletion_logs_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_deletion_logs
    ADD CONSTRAINT user_deletion_logs_user_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_notifications user_notifications_project_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_notifications
    ADD CONSTRAINT user_notifications_project_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: user_notifications user_notifications_task_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_notifications
    ADD CONSTRAINT user_notifications_task_id_fk FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: user_notifications user_notifications_team_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_notifications
    ADD CONSTRAINT user_notifications_team_id_fk FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: user_notifications user_notifications_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_notifications
    ADD CONSTRAINT user_notifications_user_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: users users_active_team_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_active_team_fk FOREIGN KEY (active_team) REFERENCES public.teams(id);


--
-- Name: users_data users_data_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users_data
    ADD CONSTRAINT users_data_user_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users_data users_data_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users_data
    ADD CONSTRAINT users_data_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: users users_timezone_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_timezone_id_fk FOREIGN KEY (timezone_id) REFERENCES public.timezones(id);


--
-- Name: TABLE archived_projects; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.archived_projects TO worklenz_client;


--
-- Name: TABLE bounced_emails; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.bounced_emails TO worklenz_client;


--
-- Name: TABLE cc_column_configurations; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.cc_column_configurations TO worklenz_client;


--
-- Name: TABLE cc_column_values; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.cc_column_values TO worklenz_client;


--
-- Name: TABLE cc_custom_columns; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.cc_custom_columns TO worklenz_client;


--
-- Name: TABLE cc_label_options; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.cc_label_options TO worklenz_client;


--
-- Name: TABLE cc_selection_options; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.cc_selection_options TO worklenz_client;


--
-- Name: TABLE clients; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.clients TO worklenz_client;


--
-- Name: TABLE countries; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.countries TO worklenz_client;


--
-- Name: TABLE cpt_phases; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.cpt_phases TO worklenz_client;


--
-- Name: TABLE cpt_task_labels; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.cpt_task_labels TO worklenz_client;


--
-- Name: TABLE cpt_task_phases; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.cpt_task_phases TO worklenz_client;


--
-- Name: TABLE cpt_task_statuses; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.cpt_task_statuses TO worklenz_client;


--
-- Name: TABLE cpt_tasks; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.cpt_tasks TO worklenz_client;


--
-- Name: TABLE custom_project_templates; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.custom_project_templates TO worklenz_client;


--
-- Name: TABLE email_invitations; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.email_invitations TO worklenz_client;


--
-- Name: TABLE email_logs; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.email_logs TO worklenz_client;


--
-- Name: TABLE favorite_projects; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.favorite_projects TO worklenz_client;


--
-- Name: TABLE job_titles; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.job_titles TO worklenz_client;


--
-- Name: TABLE licensing_admin_users; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.licensing_admin_users TO worklenz_client;


--
-- Name: TABLE licensing_app_sumo_batches; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.licensing_app_sumo_batches TO worklenz_client;


--
-- Name: TABLE licensing_coupon_codes; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.licensing_coupon_codes TO worklenz_client;


--
-- Name: TABLE licensing_coupon_logs; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.licensing_coupon_logs TO worklenz_client;


--
-- Name: TABLE licensing_credit_subs; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.licensing_credit_subs TO worklenz_client;


--
-- Name: TABLE licensing_custom_subs; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.licensing_custom_subs TO worklenz_client;


--
-- Name: TABLE licensing_custom_subs_logs; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.licensing_custom_subs_logs TO worklenz_client;


--
-- Name: TABLE licensing_payment_details; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.licensing_payment_details TO worklenz_client;


--
-- Name: TABLE licensing_pricing_plans; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.licensing_pricing_plans TO worklenz_client;


--
-- Name: TABLE licensing_settings; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.licensing_settings TO worklenz_client;


--
-- Name: TABLE licensing_user_subscription_modifiers; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.licensing_user_subscription_modifiers TO worklenz_client;


--
-- Name: TABLE licensing_user_subscriptions; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.licensing_user_subscriptions TO worklenz_client;


--
-- Name: TABLE notification_settings; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.notification_settings TO worklenz_client;


--
-- Name: TABLE organization_working_days; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.organization_working_days TO worklenz_client;


--
-- Name: TABLE organizations; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.organizations TO worklenz_client;


--
-- Name: TABLE permissions; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.permissions TO worklenz_client;


--
-- Name: TABLE personal_todo_list; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.personal_todo_list TO worklenz_client;


--
-- Name: TABLE pg_sessions; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.pg_sessions TO worklenz_client;


--
-- Name: TABLE project_access_levels; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.project_access_levels TO worklenz_client;


--
-- Name: TABLE project_categories; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.project_categories TO worklenz_client;


--
-- Name: TABLE project_comment_mentions; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.project_comment_mentions TO worklenz_client;


--
-- Name: TABLE project_comments; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.project_comments TO worklenz_client;


--
-- Name: TABLE project_folders; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.project_folders TO worklenz_client;


--
-- Name: TABLE project_logs; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.project_logs TO worklenz_client;


--
-- Name: TABLE project_member_allocations; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.project_member_allocations TO worklenz_client;


--
-- Name: TABLE project_members; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.project_members TO worklenz_client;


--
-- Name: TABLE project_phases; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.project_phases TO worklenz_client;


--
-- Name: TABLE project_subscribers; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.project_subscribers TO worklenz_client;


--
-- Name: TABLE project_task_list_cols; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.project_task_list_cols TO worklenz_client;


--
-- Name: TABLE projects; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.projects TO worklenz_client;


--
-- Name: TABLE pt_labels; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.pt_labels TO worklenz_client;


--
-- Name: TABLE pt_phases; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.pt_phases TO worklenz_client;


--
-- Name: TABLE pt_project_templates; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.pt_project_templates TO worklenz_client;


--
-- Name: TABLE pt_statuses; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.pt_statuses TO worklenz_client;


--
-- Name: TABLE pt_task_labels; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.pt_task_labels TO worklenz_client;


--
-- Name: TABLE pt_task_phases; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.pt_task_phases TO worklenz_client;


--
-- Name: TABLE pt_task_statuses; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.pt_task_statuses TO worklenz_client;


--
-- Name: TABLE pt_tasks; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.pt_tasks TO worklenz_client;


--
-- Name: TABLE role_permissions; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.role_permissions TO worklenz_client;


--
-- Name: TABLE roles; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.roles TO worklenz_client;


--
-- Name: TABLE schema_migrations; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.schema_migrations TO worklenz_client;


--
-- Name: TABLE spam_emails; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.spam_emails TO worklenz_client;


--
-- Name: TABLE survey_answers; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.survey_answers TO worklenz_client;


--
-- Name: TABLE survey_questions; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.survey_questions TO worklenz_client;


--
-- Name: TABLE survey_responses; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.survey_responses TO worklenz_client;


--
-- Name: TABLE surveys; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.surveys TO worklenz_client;


--
-- Name: TABLE sys_license_types; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.sys_license_types TO worklenz_client;


--
-- Name: TABLE sys_project_healths; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.sys_project_healths TO worklenz_client;


--
-- Name: TABLE sys_project_statuses; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.sys_project_statuses TO worklenz_client;


--
-- Name: TABLE sys_task_status_categories; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.sys_task_status_categories TO worklenz_client;


--
-- Name: TABLE task_activity_logs; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.task_activity_logs TO worklenz_client;


--
-- Name: TABLE task_attachments; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.task_attachments TO worklenz_client;


--
-- Name: TABLE task_comment_attachments; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.task_comment_attachments TO worklenz_client;


--
-- Name: TABLE task_comment_contents; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.task_comment_contents TO worklenz_client;


--
-- Name: TABLE task_comment_mentions; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.task_comment_mentions TO worklenz_client;


--
-- Name: TABLE task_comment_reactions; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.task_comment_reactions TO worklenz_client;


--
-- Name: TABLE task_comments; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.task_comments TO worklenz_client;


--
-- Name: TABLE task_dependencies; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.task_dependencies TO worklenz_client;


--
-- Name: TABLE task_labels; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.task_labels TO worklenz_client;


--
-- Name: TABLE team_labels; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.team_labels TO worklenz_client;


--
-- Name: TABLE task_labels_view; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.task_labels_view TO worklenz_client;


--
-- Name: TABLE task_phase; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.task_phase TO worklenz_client;


--
-- Name: TABLE task_priorities; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.task_priorities TO worklenz_client;


--
-- Name: TABLE task_recurring_schedules; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.task_recurring_schedules TO worklenz_client;


--
-- Name: TABLE task_recurring_templates; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.task_recurring_templates TO worklenz_client;


--
-- Name: TABLE task_statuses; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.task_statuses TO worklenz_client;


--
-- Name: TABLE task_subscribers; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.task_subscribers TO worklenz_client;


--
-- Name: TABLE task_templates; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.task_templates TO worklenz_client;


--
-- Name: TABLE task_templates_tasks; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.task_templates_tasks TO worklenz_client;


--
-- Name: TABLE task_timers; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.task_timers TO worklenz_client;


--
-- Name: TABLE task_updates; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.task_updates TO worklenz_client;


--
-- Name: TABLE task_work_log; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.task_work_log TO worklenz_client;


--
-- Name: TABLE tasks; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.tasks TO worklenz_client;


--
-- Name: TABLE tasks_assignees; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.tasks_assignees TO worklenz_client;


--
-- Name: TABLE tasks_with_status_view; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.tasks_with_status_view TO worklenz_client;


--
-- Name: TABLE team_members; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.team_members TO worklenz_client;


--
-- Name: SEQUENCE users_user_no_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.users_user_no_seq TO worklenz_client;


--
-- Name: TABLE users; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.users TO worklenz_client;


--
-- Name: TABLE team_member_info_mv; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.team_member_info_mv TO worklenz_client;


--
-- Name: TABLE team_member_info_view; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.team_member_info_view TO worklenz_client;


--
-- Name: TABLE teams; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.teams TO worklenz_client;


--
-- Name: TABLE timezones; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.timezones TO worklenz_client;


--
-- Name: TABLE user_notifications; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.user_notifications TO worklenz_client;


--
-- Name: TABLE users_data; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.users_data TO worklenz_client;


--
-- Name: TABLE worklenz_alerts; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.worklenz_alerts TO worklenz_client;


--
-- Name: team_member_info_mv; Type: MATERIALIZED VIEW DATA; Schema: public; Owner: postgres
--

REFRESH MATERIALIZED VIEW public.team_member_info_mv;


--
-- PostgreSQL database dump complete
--

\unrestrict cXaFq3P6LqDQRplv9T04T96QuvXAyRIIeibBaOfW4nr2uu2faDsGHAz4sa2vtbK

