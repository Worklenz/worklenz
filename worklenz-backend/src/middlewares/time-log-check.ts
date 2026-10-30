import { NextFunction } from "express";
import db from "../config/db";
import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import { ServerResponse } from "../models/server-response";
import { getColor } from "../shared/utils";
import { TASK_STATUS_COLOR_ALPHA } from "../shared/constants";


interface projectBudgetAndTotalCost {
  projectBudget: number;
  totalCost: number;
}


export default class TimeLogCheckMiddleware {
  public static async ProjectBudgetVarianceCheck(req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction) {
    console.log("I AM INSIDE TimeLogCheckMiddleware")
    const {project_id} = req.body
    console.log(`Project ID: ${project_id}`)

    const {projectBudget, totalCost} = await TimeLogCheckMiddleware.getProjectBudgetAndTotalCost(project_id)
    console.log(`Total Cost: ${totalCost}; Project Budget: ${projectBudget}`)

    const totalVariance = projectBudget - totalCost
    console.log(`Total Variance: ${totalVariance}`)

    if (totalVariance <= 0) {
      return res.status(406).send(new ServerResponse(false, null, "Cannot log time. Project budget has exceeded."))
    }

    next() // Pass with no error
  }

  private static async getProjectBudgetAndTotalCost(projectId: string): Promise<projectBudgetAndTotalCost> {
    const groupBy = "status";
    const billableFilter = "billable";

    // Get project information including currency and organization calculation method
    const projectQuery = `
      SELECT
        p.id,
        p.name,
        p.currency,
        p.budget,
        o.calculation_method,
        o.hours_per_day
      FROM projects p
      JOIN teams t ON p.team_id = t.id
      JOIN organizations o ON t.organization_id = o.id
      WHERE p.id = $1
    `;
    const projectResult = await db.query(projectQuery, [projectId]);

    if (projectResult.rows.length === 0) {
      return {
        projectBudget: -1,
        totalCost: -1
      }
    }

    const project = projectResult.rows[0];
    const budget: number = project.budget;

    // First, get the project rate cards for this project
    const rateCardQuery = `
      SELECT
        fprr.id,
        fprr.project_id,
        fprr.job_title_id,
        fprr.rate,
        fprr.man_day_rate,
        jt.name as job_title_name
      FROM finance_project_rate_card_roles fprr
      LEFT JOIN job_titles jt ON fprr.job_title_id = jt.id
      WHERE fprr.project_id = $1
      ORDER BY jt.name;
    `;

    const rateCardResult = await db.query(rateCardQuery, [projectId]);
    const projectRateCards = rateCardResult.rows;

    // Build billable filter condition
    let billableCondition = "";
    if (billableFilter === "billable") {
      billableCondition = "AND t.billable = true";
    } else if (billableFilter === "non-billable") {
      billableCondition = "AND t.billable = false";
    }

    // Get tasks with their financial data - support hierarchical loading
    const q = `
      WITH RECURSIVE task_tree AS (
        -- Get the requested tasks (parent tasks or subtasks of a specific parent)
        SELECT
          t.id,
          t.name,
          t.parent_task_id,
          t.project_id,
          t.status_id,
          t.priority_id,
          (SELECT phase_id FROM task_phase WHERE task_id = t.id) as phase_id,
          (SELECT get_task_assignees(t.id)) as assignees,
          t.billable,
          COALESCE(t.fixed_cost, 0) as fixed_cost,
          COALESCE(t.total_minutes * 60, 0) as estimated_seconds,
          COALESCE(t.total_minutes, 0) as total_minutes,
          COALESCE((SELECT SUM(time_spent) FROM task_work_log WHERE task_id = t.id), 0) as total_time_logged_seconds,
          (SELECT COUNT(*) FROM tasks WHERE parent_task_id = t.id AND archived = false) as sub_tasks_count,
          0 as level,
          t.id as root_id
        FROM tasks t
        WHERE t.project_id = $1
          AND t.archived = false
          AND t.parent_task_id IS NULL  -- Only load parent tasks initially
          ${billableCondition}

        UNION ALL

        -- Get all descendant tasks for aggregation
        SELECT
          t.id,
          t.name,
          t.parent_task_id,
          t.project_id,
          t.status_id,
          t.priority_id,
          (SELECT phase_id FROM task_phase WHERE task_id = t.id) as phase_id,
          (SELECT get_task_assignees(t.id)) as assignees,
          t.billable,
          COALESCE(t.fixed_cost, 0) as fixed_cost,
          COALESCE(t.total_minutes * 60, 0) as estimated_seconds,
          COALESCE(t.total_minutes, 0) as total_minutes,
          COALESCE((SELECT SUM(time_spent) FROM task_work_log WHERE task_id = t.id), 0) as total_time_logged_seconds,
          0 as sub_tasks_count,
          tt.level + 1 as level,
          tt.root_id
        FROM tasks t
        INNER JOIN task_tree tt ON t.parent_task_id = tt.id
        WHERE t.archived = false
      ),
      -- Identify leaf tasks (tasks with no children) for proper aggregation
      leaf_tasks AS (
        SELECT
          tt.*,
          CASE
            WHEN NOT EXISTS (
              SELECT 1 FROM task_tree child_tt
              WHERE child_tt.parent_task_id = tt.id
                AND child_tt.root_id = tt.root_id
            ) THEN true
            ELSE false
          END as is_leaf
        FROM task_tree tt
      ),
      task_costs AS (
        SELECT
          tt.*,
          -- Calculate estimated cost based on organization calculation method
          CASE
            WHEN $2 = 'man_days' THEN
              -- Man days calculation: use estimated_man_days * man_day_rate
              COALESCE((
                SELECT SUM(
                  CASE
                    WHEN COALESCE(fprr.man_day_rate, 0) > 0 THEN
                      -- Use total_minutes if available, otherwise use estimated_seconds
                      CASE
                        WHEN tt.total_minutes > 0 THEN ((tt.total_minutes / 60.0) / $3) * COALESCE(fprr.man_day_rate, 0)
                        ELSE ((tt.estimated_seconds / 3600.0) / $3) * COALESCE(fprr.man_day_rate, 0)
                      END
                    ELSE
                      -- Fallback to hourly rate if man_day_rate is 0
                      CASE
                        WHEN tt.total_minutes > 0 THEN (tt.total_minutes / 60.0) * COALESCE(fprr.rate, 0)
                        ELSE (tt.estimated_seconds / 3600.0) * COALESCE(fprr.rate, 0)
                      END
                  END
                )
                FROM json_array_elements(tt.assignees) AS assignee_json
                LEFT JOIN project_members pm ON pm.team_member_id = (assignee_json->>'team_member_id')::uuid
                  AND pm.project_id = tt.project_id
                LEFT JOIN finance_project_rate_card_roles fprr ON fprr.id = pm.project_rate_card_role_id
                WHERE assignee_json->>'team_member_id' IS NOT NULL
              ), 0)
            ELSE
              -- Hourly calculation: use estimated_hours * hourly_rate
              COALESCE((
                SELECT SUM(
                  CASE
                    WHEN tt.total_minutes > 0 THEN (tt.total_minutes / 60.0) * COALESCE(fprr.rate, 0)
                    ELSE (tt.estimated_seconds / 3600.0) * COALESCE(fprr.rate, 0)
                  END
                )
                FROM json_array_elements(tt.assignees) AS assignee_json
                LEFT JOIN project_members pm ON pm.team_member_id = (assignee_json->>'team_member_id')::uuid
                  AND pm.project_id = tt.project_id
                LEFT JOIN finance_project_rate_card_roles fprr ON fprr.id = pm.project_rate_card_role_id
                WHERE assignee_json->>'team_member_id' IS NOT NULL
              ), 0)
          END as estimated_cost,
          -- Calculate actual cost based on organization calculation method
          CASE
            WHEN $2 = 'man_days' THEN
              -- Man days calculation: convert actual time to man days and multiply by man day rates
              COALESCE((
                SELECT SUM(
                  CASE
                    WHEN COALESCE(fprr.man_day_rate, 0) > 0 THEN
                      COALESCE(fprr.man_day_rate, 0) * ((twl.time_spent / 3600.0) / $3)
                    ELSE
                      -- Fallback to hourly rate if man_day_rate is 0
                      COALESCE(fprr.rate, 0) * (twl.time_spent / 3600.0)
                  END
                )
                FROM task_work_log twl
                LEFT JOIN users u ON twl.user_id = u.id
                LEFT JOIN team_members tm ON u.id = tm.user_id
                LEFT JOIN project_members pm ON pm.team_member_id = tm.id AND pm.project_id = tt.project_id
                LEFT JOIN finance_project_rate_card_roles fprr ON fprr.id = pm.project_rate_card_role_id
                WHERE twl.task_id = tt.id
              ), 0)
            ELSE
              -- Hourly calculation: use actual time logged * hourly rates
              COALESCE((
                SELECT SUM(COALESCE(fprr.rate, 0) * (twl.time_spent / 3600.0))
                FROM task_work_log twl
                LEFT JOIN users u ON twl.user_id = u.id
                LEFT JOIN team_members tm ON u.id = tm.user_id
                LEFT JOIN project_members pm ON pm.team_member_id = tm.id AND pm.project_id = tt.project_id
                LEFT JOIN finance_project_rate_card_roles fprr ON fprr.id = pm.project_rate_card_role_id
                WHERE twl.task_id = tt.id
              ), 0)
          END as actual_cost_from_logs
        FROM leaf_tasks tt
      ),
      aggregated_tasks AS (
        SELECT
          tc.id,
          tc.name,
          tc.parent_task_id,
          tc.status_id,
          tc.priority_id,
          tc.phase_id,
          tc.assignees,
          tc.billable,
          -- Fixed cost aggregation: sum from leaf tasks only
          CASE
            WHEN tc.level = 0 AND tc.sub_tasks_count > 0 THEN (
              SELECT COALESCE(SUM(leaf_tc.fixed_cost), 0)
              FROM task_costs leaf_tc
              WHERE leaf_tc.root_id = tc.id
                AND leaf_tc.is_leaf = true
            )
            ELSE tc.fixed_cost
          END as fixed_cost,
          tc.sub_tasks_count,
          -- For parent tasks, sum values from leaf tasks only
          CASE
            WHEN tc.level = 0 AND tc.sub_tasks_count > 0 THEN (
              SELECT COALESCE(SUM(leaf_tc.estimated_seconds), 0)
              FROM task_costs leaf_tc
              WHERE leaf_tc.root_id = tc.id
                AND leaf_tc.is_leaf = true
            )
            ELSE tc.estimated_seconds
          END as estimated_seconds,
          -- Sum total_minutes from leaf tasks only
          CASE
            WHEN tc.level = 0 AND tc.sub_tasks_count > 0 THEN (
              SELECT COALESCE(SUM(leaf_tc.total_minutes), 0)
              FROM task_costs leaf_tc
              WHERE leaf_tc.root_id = tc.id
                AND leaf_tc.is_leaf = true
            )
            ELSE tc.total_minutes
          END as total_minutes,
          -- Sum time logged from leaf tasks only
          CASE
            WHEN tc.level = 0 AND tc.sub_tasks_count > 0 THEN (
              SELECT COALESCE(SUM(leaf_tc.total_time_logged_seconds), 0)
              FROM task_costs leaf_tc
              WHERE leaf_tc.root_id = tc.id
                AND leaf_tc.is_leaf = true
            )
            ELSE tc.total_time_logged_seconds
          END as total_time_logged_seconds,
          -- Sum estimated cost from leaf tasks only
          CASE
            WHEN tc.level = 0 AND tc.sub_tasks_count > 0 THEN (
              SELECT COALESCE(SUM(leaf_tc.estimated_cost), 0)
              FROM task_costs leaf_tc
              WHERE leaf_tc.root_id = tc.id
                AND leaf_tc.is_leaf = true
            )
            ELSE tc.estimated_cost
          END as estimated_cost,
          -- Sum actual cost from leaf tasks only
          CASE
            WHEN tc.level = 0 AND tc.sub_tasks_count > 0 THEN (
              SELECT COALESCE(SUM(leaf_tc.actual_cost_from_logs), 0)
              FROM task_costs leaf_tc
              WHERE leaf_tc.root_id = tc.id
                AND leaf_tc.is_leaf = true
            )
            ELSE tc.actual_cost_from_logs
          END as actual_cost_from_logs
        FROM task_costs tc
        WHERE tc.level = 0  -- Only return the requested level
      )
      SELECT
        at.*,
        (at.estimated_cost + at.fixed_cost) as total_budget,
        (at.actual_cost_from_logs + at.fixed_cost) as total_actual,
        ((at.estimated_cost + at.fixed_cost) - (at.actual_cost_from_logs + at.fixed_cost)) as variance,
        -- Add effort variance for man days calculation
        CASE
          WHEN $2 = 'man_days' THEN
            -- Effort variance in man days: actual man days - estimated man days
            ((at.total_time_logged_seconds / 3600.0) / $3) -
            ((at.estimated_seconds / 3600.0) / $3)
          ELSE
            NULL -- No effort variance for hourly projects
        END as effort_variance_man_days,
        -- Add actual man days for man days calculation
        CASE
          WHEN $2 = 'man_days' THEN
            (at.total_time_logged_seconds / 3600.0) / $3
          ELSE
            NULL
        END as actual_man_days
      FROM aggregated_tasks at;
    `;

    const result = await db.query(q, [projectId, project.calculation_method, project.hours_per_day]);
    const tasks = result.rows;

    // Add color_code to each assignee and include their rate information using project_members
    for (const task of tasks) {
      if (Array.isArray(task.assignees)) {
        for (const assignee of task.assignees) {
          assignee.color_code = getColor(assignee.name);

          // Get the rate for this assignee using project_members.project_rate_card_role_id
          const memberRateQuery = `
            SELECT
              pm.project_rate_card_role_id,
              fprr.rate,
              fprr.job_title_id,
              jt.name as job_title_name
            FROM project_members pm
            LEFT JOIN finance_project_rate_card_roles fprr ON fprr.id = pm.project_rate_card_role_id
            LEFT JOIN job_titles jt ON fprr.job_title_id = jt.id
            WHERE pm.team_member_id = $1 AND pm.project_id = $2
          `;

          try {
            const memberRateResult = await db.query(memberRateQuery, [
              assignee.team_member_id,
              projectId,
            ]);
            if (memberRateResult.rows.length > 0) {
              const memberRate = memberRateResult.rows[0];
              assignee.project_rate_card_role_id =
                memberRate.project_rate_card_role_id;
              assignee.rate = memberRate.rate ? Number(memberRate.rate) : 0;
              assignee.job_title_id = memberRate.job_title_id;
              assignee.job_title_name = memberRate.job_title_name;
            } else {
              // Member doesn't have a rate card role assigned
              assignee.project_rate_card_role_id = null;
              assignee.rate = 0;
              assignee.job_title_id = null;
              assignee.job_title_name = null;
            }
          } catch (error) {
            console.error(
              "Error fetching member rate from project_members:",
              error
            );
            assignee.project_rate_card_role_id = null;
            assignee.rate = 0;
            assignee.job_title_id = null;
            assignee.job_title_name = null;
          }
        }
      }
    }

    // Get groups based on groupBy parameter
    let groups: Array<{
      id: string;
      group_name: string;
      color_code: string;
      color_code_dark: string;
    }> = [];

    if (groupBy === "status") {
      const q = `
        SELECT
          ts.id,
          ts.name as group_name,
          COALESCE(ts.color_code, stsc.color_code)::text AS color_code,
          COALESCE(ts.color_code, stsc.color_code_dark, stsc.color_code)::text AS color_code_dark
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
        ORDER BY sort_index DESC;
      `;
      groups = (await db.query(q, [projectId])).rows;

      // Add TASK_STATUS_COLOR_ALPHA to color codes
      for (const group of groups) {
        group.color_code = group.color_code + TASK_STATUS_COLOR_ALPHA;
        group.color_code_dark = group.color_code_dark + TASK_STATUS_COLOR_ALPHA;
      }
    }

    let totalActualCost = 0;

    // Group tasks by the selected criteria
    const groupedTasks = groups.map((group) => {
      const groupTasks = tasks.filter((task) => {
        if (groupBy === "status") return task.status_id === group.id;
        if (groupBy === "priority") return task.priority_id === group.id;
        if (groupBy === "phases") return task.phase_id === group.id;
        return false;
      });

      groupTasks.map(task => totalActualCost += Number(task.total_actual) || 0)

      // return {
      //   tasks: groupTasks.map((task) => ({
      //     variance: Number(task.variance) || 0,
      //   })),
      // };
    });

    return {
      projectBudget: budget,
      totalCost: totalActualCost
    }
  }
}
