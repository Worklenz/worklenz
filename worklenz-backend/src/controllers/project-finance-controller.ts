import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";

import db from "../config/db";
import { ServerResponse } from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import { TASK_STATUS_COLOR_ALPHA } from "../shared/constants";
import { getColor } from "../shared/utils";

export default class ProjectfinanceController extends WorklenzControllerBase {
  @HandleExceptions()
  public static async getTasks(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const projectId = req.params.project_id;
    const groupBy = req.query.group || "status";

    // Get all tasks with their financial data
    const q = `
      WITH task_costs AS (
        SELECT 
          t.id,
          t.name,
          COALESCE(t.total_minutes, 0)::float as estimated_hours,
          COALESCE((SELECT SUM(time_spent) FROM task_work_log WHERE task_id = t.id), 0) / 3600.0::float as total_time_logged,
          COALESCE((SELECT SUM(rate * (time_spent / 3600.0)) 
                    FROM task_work_log twl 
                    LEFT JOIN users u ON twl.user_id = u.id
                    LEFT JOIN team_members tm ON u.id = tm.user_id
                    LEFT JOIN project_members pm ON tm.id = pm.team_member_id
                    LEFT JOIN finance_project_rate_card_roles pmr ON pm.project_rate_card_role_id = pmr.id
                    WHERE twl.task_id = t.id), 0)::float as estimated_cost,
          COALESCE(t.fixed_cost, 0)::float as fixed_cost,
          t.project_id,
          t.status_id,
          t.priority_id,
          (SELECT phase_id FROM task_phase WHERE task_id = t.id) as phase_id,
          (SELECT get_task_assignees(t.id)) as assignees,
          t.billable
        FROM tasks t
        WHERE t.project_id = $1 AND t.archived = false
      )
      SELECT 
        tc.*,
        (tc.estimated_cost + tc.fixed_cost)::float as total_budget,
        COALESCE((SELECT SUM(rate * (time_spent / 3600.0)) 
                  FROM task_work_log twl 
                  LEFT JOIN users u ON twl.user_id = u.id
                  LEFT JOIN team_members tm ON u.id = tm.user_id
                  LEFT JOIN project_members pm ON tm.id = pm.team_member_id
                  LEFT JOIN finance_project_rate_card_roles pmr ON pm.project_rate_card_role_id = pmr.id
                  WHERE twl.task_id = tc.id), 0)::float + tc.fixed_cost as total_actual,
        (COALESCE((SELECT SUM(rate * (time_spent / 3600.0)) 
                  FROM task_work_log twl 
                  LEFT JOIN users u ON twl.user_id = u.id
                  LEFT JOIN team_members tm ON u.id = tm.user_id
                  LEFT JOIN project_members pm ON tm.id = pm.team_member_id
                  LEFT JOIN finance_project_rate_card_roles pmr ON pm.project_rate_card_role_id = pmr.id
                  WHERE twl.task_id = tc.id), 0)::float + tc.fixed_cost) - (tc.estimated_cost + tc.fixed_cost)::float as variance
      FROM task_costs tc;
    `;

    const result = await db.query(q, [projectId]);
    const tasks = result.rows;

    // Add color_code to each assignee
    for (const task of tasks) {
      if (Array.isArray(task.assignees)) {
        for (const assignee of task.assignees) {
          assignee.color_code = getColor(assignee.name);
        }
      }
    }

    // Get groups based on groupBy parameter
    let groups: Array<{ id: string; group_name: string; color_code: string; color_code_dark: string }> = [];
    
    if (groupBy === "status") {
      const q = `
        SELECT 
          ts.id,
          ts.name as group_name,
          stsc.color_code::text,
          stsc.color_code_dark::text
        FROM task_statuses ts
        INNER JOIN sys_task_status_categories stsc ON ts.category_id = stsc.id
        WHERE ts.project_id = $1
        ORDER BY ts.sort_order;
      `;
      groups = (await db.query(q, [projectId])).rows;
    } else if (groupBy === "priority") {
      const q = `
        SELECT 
          id,
          name as group_name,
          color_code::text,
          color_code_dark::text
        FROM task_priorities 
        ORDER BY value;
      `;
      groups = (await db.query(q)).rows;
    } else if (groupBy === "phases") {
      const q = `
        SELECT 
          id,
          name as group_name,
          color_code::text,
          color_code::text as color_code_dark
        FROM project_phases 
        WHERE project_id = $1
        ORDER BY sort_index;
      `;
      groups = (await db.query(q, [projectId])).rows;
      
      // Add TASK_STATUS_COLOR_ALPHA to color codes
      for (const group of groups) {
        group.color_code = group.color_code + TASK_STATUS_COLOR_ALPHA;
        group.color_code_dark = group.color_code_dark + TASK_STATUS_COLOR_ALPHA;
      }
    }

    // Group tasks by the selected criteria
    const groupedTasks = groups.map(group => {
      const groupTasks = tasks.filter(task => {
        if (groupBy === "status") return task.status_id === group.id;
        if (groupBy === "priority") return task.priority_id === group.id;
        if (groupBy === "phases") return task.phase_id === group.id;
        return false;
      });

      return {
        group_id: group.id,
        group_name: group.group_name,
        color_code: group.color_code,
        color_code_dark: group.color_code_dark,
        tasks: groupTasks.map(task => ({
          id: task.id,
          name: task.name,
          estimated_hours: Number(task.estimated_hours) || 0,
          total_time_logged: Number(task.total_time_logged) || 0,
          estimated_cost: Number(task.estimated_cost) || 0,
          fixed_cost: Number(task.fixed_cost) || 0,
          total_budget: Number(task.total_budget) || 0,
          total_actual: Number(task.total_actual) || 0,
          variance: Number(task.variance) || 0,
          members: task.assignees,
          billable: task.billable
        }))
      };
    });

    return res.status(200).send(new ServerResponse(true, groupedTasks));
  }
}
