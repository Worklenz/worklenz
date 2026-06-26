BEGIN;

CREATE OR REPLACE FUNCTION get_task_form_view_model(_user_id uuid, _team_id uuid, _task_id uuid, _project_id uuid) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _task                 JSON;
    _priorities           JSON;
    _projects             JSON;
    _statuses             JSON;
    _team_members         JSON;
    _assignees            JSON;
    _phases               JSON;
    _custom_columns       JSON;
    _custom_column_values JSON;
BEGIN

    SELECT COALESCE(ROW_TO_JSON(rec), '{}'::JSON)
    INTO _task
    FROM (SELECT id,
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
                    AND tt.is_done IS TRUE) AS completed_count,
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
                 (SELECT color_code_dark
                  FROM sys_task_status_categories
                  WHERE id = (SELECT category_id FROM task_statuses WHERE id = tasks.status_id)) AS status_color_dark,
                 (SELECT COUNT(*) FROM tasks WHERE parent_task_id = _task_id) AS sub_tasks_count,
                 (SELECT name FROM users WHERE id = tasks.reporter_id) AS reporter,
                 (SELECT get_task_assignees(tasks.id)) AS assignees,
                 (SELECT id FROM team_members WHERE user_id = _user_id AND team_id = _team_id) AS team_member_id,
                 billable,
                 schedule_id
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
          WHERE team_id = _team_id AND team_members.active IS TRUE) rec;

    SELECT get_task_assignees(_task_id) INTO _assignees;

    SELECT COALESCE(
               JSON_AGG(
                   JSON_BUILD_OBJECT(
                       'key', rec.key,
                       'id', rec.id,
                       'name', rec.name,
                       'width', rec.width,
                       'pinned', rec.is_visible,
                       'custom_column', TRUE,
                       'custom_column_obj', JSON_BUILD_OBJECT(
                           'fieldType', rec.field_type,
                           'fieldTitle', rec.field_title,
                           'numberType', rec.number_type,
                           'decimals', rec.decimals,
                           'label', rec.label,
                           'labelPosition', rec.label_position,
                           'previewValue', rec.preview_value,
                           'expression', rec.expression,
                           'firstNumericColumnKey', rec.first_numeric_column_key,
                           'secondNumericColumnKey', rec.second_numeric_column_key,
                           'selectionsList', COALESCE(rec.selections_list, '[]'::JSON),
                           'labelsList', COALESCE(rec.labels_list, '[]'::JSON)
                       )
                   )
                   ORDER BY rec.created_at
               ),
               '[]'::JSON
           )
    INTO _custom_columns
    FROM (
             SELECT cc.id,
                    cc.key,
                    cc.name,
                    cc.width,
                    cc.is_visible,
                    cc.created_at,
                    cc.field_type,
                    cf.field_title,
                    cf.number_type,
                    cf.decimals,
                    cf.label,
                    cf.label_position,
                    cf.preview_value,
                    cf.expression,
                    cf.first_numeric_column_key,
                    cf.second_numeric_column_key,
                    (SELECT JSON_AGG(
                                    JSON_BUILD_OBJECT(
                                            'selection_id', so.selection_id,
                                            'selection_name', so.selection_name,
                                            'selection_color', so.selection_color
                                    )
                            ORDER BY so.selection_order
                            )
                     FROM cc_selection_options so
                     WHERE so.column_id = cc.id) AS selections_list,
                    (SELECT JSON_AGG(
                                    JSON_BUILD_OBJECT(
                                            'label_id', lo.label_id,
                                            'label_name', lo.label_name,
                                            'label_color', lo.label_color
                                    )
                            ORDER BY lo.label_order
                            )
                     FROM cc_label_options lo
                     WHERE lo.column_id = cc.id) AS labels_list
             FROM cc_custom_columns cc
                      LEFT JOIN cc_column_configurations cf ON cf.column_id = cc.id
             WHERE cc.project_id = _project_id
               AND cc.is_visible IS TRUE
         ) rec;

    SELECT COALESCE(
               JSON_OBJECT_AGG(rec.key, rec.value),
               '{}'::JSON
           )
    INTO _custom_column_values
    FROM (
             SELECT cc.key,
                    CASE
                        WHEN ccv.text_value IS NOT NULL THEN TO_JSON(ccv.text_value)
                        WHEN ccv.number_value IS NOT NULL THEN TO_JSON(ccv.number_value)
                        WHEN ccv.boolean_value IS NOT NULL THEN TO_JSON(ccv.boolean_value)
                        WHEN ccv.date_value IS NOT NULL THEN TO_JSON(ccv.date_value)
                        WHEN ccv.json_value IS NOT NULL THEN ccv.json_value::JSON
                        ELSE NULL::JSON
                        END AS value
             FROM cc_column_values ccv
                      INNER JOIN cc_custom_columns cc ON ccv.column_id = cc.id
             WHERE ccv.task_id = _task_id
               AND cc.project_id = _project_id
               AND cc.is_visible IS TRUE
         ) rec
    WHERE rec.value IS NOT NULL;

    RETURN JSON_BUILD_OBJECT(
        'task', (_task::JSONB || JSONB_BUILD_OBJECT('custom_column_values', COALESCE(_custom_column_values, '{}'::JSON)::JSONB))::JSON,
        'priorities', _priorities,
        'projects', _projects,
        'statuses', _statuses,
        'team_members', _team_members,
        'assignees', _assignees,
        'phases', _phases,
        'custom_columns', _custom_columns
    );
END;
$$;

COMMIT;
