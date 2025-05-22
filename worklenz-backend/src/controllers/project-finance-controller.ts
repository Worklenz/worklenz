import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";

import db from "../config/db";
import { ServerResponse } from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";

export default class ProjectfinanceController extends WorklenzControllerBase {
  @HandleExceptions()
  public static async getTasks(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { project_id } = req.params;
    const { group_by = "status" } = req.query;

    const q = `
      WITH task_data AS (
        SELECT 
          t.id,
          t.name,
          t.status_id,
          t.priority_id,
          tp.phase_id,
          (t.total_minutes / 3600.0) as estimated_hours,
          (COALESCE((SELECT SUM(time_spent) FROM task_work_log WHERE task_id = t.id), 0) / 3600.0) as actual_hours,
          t.completed_at,
          t.created_at,
          t.updated_at,
          t.billable,
          s.name as status_name,
          p.name as priority_name,
          ph.name as phase_name,
          (SELECT color_code FROM sys_task_status_categories WHERE id = s.category_id) as status_color,
          (SELECT color_code_dark FROM sys_task_status_categories WHERE id = s.category_id) as status_color_dark,
          (SELECT color_code FROM task_priorities WHERE id = t.priority_id) as priority_color,
          (SELECT color_code FROM project_phases WHERE id = tp.phase_id) as phase_color,
          (SELECT get_task_assignees(t.id)) as assignees,
          json_agg(
            json_build_object(
              'name', u.name,
              'avatar_url', u.avatar_url,
              'team_member_id', tm.id,
              'color_code', '#1890ff'
            )
          ) FILTER (WHERE u.id IS NOT NULL) as members
        FROM tasks t
        LEFT JOIN task_statuses s ON t.status_id = s.id
        LEFT JOIN task_priorities p ON t.priority_id = p.id
        LEFT JOIN task_phase tp ON t.id = tp.task_id
        LEFT JOIN project_phases ph ON tp.phase_id = ph.id
        LEFT JOIN tasks_assignees ta ON t.id = ta.task_id
        LEFT JOIN project_members pm ON ta.project_member_id = pm.id
        LEFT JOIN team_members tm ON pm.team_member_id = tm.id
        LEFT JOIN finance_project_rate_card_roles pmr ON pm.project_rate_card_role_id = pmr.id
        LEFT JOIN users u ON tm.user_id = u.id
        LEFT JOIN job_titles jt ON tm.job_title_id = jt.id
        WHERE t.project_id = $1
        GROUP BY 
          t.id, 
          s.name, 
          p.name, 
          ph.name, 
          tp.phase_id,
          s.category_id,
          t.priority_id
      )
      SELECT 
        CASE 
          WHEN $2 = 'status' THEN status_id
          WHEN $2 = 'priority' THEN priority_id
          WHEN $2 = 'phases' THEN phase_id
        END as group_id,
        CASE 
          WHEN $2 = 'status' THEN status_name
          WHEN $2 = 'priority' THEN priority_name
          WHEN $2 = 'phases' THEN phase_name
        END as group_name,
        CASE 
          WHEN $2 = 'status' THEN status_color
          WHEN $2 = 'priority' THEN priority_color
          WHEN $2 = 'phases' THEN phase_color
        END as color_code,
        CASE 
          WHEN $2 = 'status' THEN status_color_dark
          WHEN $2 = 'priority' THEN priority_color
          WHEN $2 = 'phases' THEN phase_color
        END as color_code_dark,
        json_agg(
          json_build_object(
            'id', id,
            'name', name,
            'status_id', status_id,
            'priority_id', priority_id,
            'phase_id', phase_id,
            'estimated_hours', estimated_hours,
            'actual_hours', actual_hours,
            'completed_at', completed_at,
            'created_at', created_at,
            'updated_at', updated_at,
            'billable', billable,
            'assignees', assignees,
            'members', members
          )
        ) as tasks
      FROM task_data
      GROUP BY 
        CASE 
          WHEN $2 = 'status' THEN status_id
          WHEN $2 = 'priority' THEN priority_id
          WHEN $2 = 'phases' THEN phase_id
        END,
        CASE 
          WHEN $2 = 'status' THEN status_name
          WHEN $2 = 'priority' THEN priority_name
          WHEN $2 = 'phases' THEN phase_name
        END,
        CASE 
          WHEN $2 = 'status' THEN status_color
          WHEN $2 = 'priority' THEN priority_color
          WHEN $2 = 'phases' THEN phase_color
        END,
        CASE 
          WHEN $2 = 'status' THEN status_color_dark
          WHEN $2 = 'priority' THEN priority_color
          WHEN $2 = 'phases' THEN phase_color
        END
      ORDER BY group_name;
    `;

    const result = await db.query(q, [project_id, group_by]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }
}
