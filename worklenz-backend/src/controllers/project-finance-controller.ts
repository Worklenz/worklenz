import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";

import db from "../config/db";
import { ServerResponse } from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import { TASK_STATUS_COLOR_ALPHA } from "../shared/constants";
import { getColor } from "../shared/utils";
import moment from "moment";
import Excel from "exceljs";

// Utility function to format time in hours, minutes, seconds format
const formatTimeToHMS = (totalSeconds: number): string => {
  if (!totalSeconds || totalSeconds === 0) return "0s";

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

  return parts.join(" ");
};

// Utility function to parse time string back to seconds for calculations
const parseTimeToSeconds = (timeString: string): number => {
  if (!timeString || timeString === "0s") return 0;

  let totalSeconds = 0;
  const hourMatch = timeString.match(/(\d+)h/);
  const minuteMatch = timeString.match(/(\d+)m/);
  const secondMatch = timeString.match(/(\d+)s/);

  if (hourMatch) totalSeconds += parseInt(hourMatch[1]) * 3600;
  if (minuteMatch) totalSeconds += parseInt(minuteMatch[1]) * 60;
  if (secondMatch) totalSeconds += parseInt(secondMatch[1]);

  return totalSeconds;
};

export default class ProjectfinanceController extends WorklenzControllerBase {
  @HandleExceptions()
  public static async getTasks(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const projectId = req.params.project_id;
    const groupBy = req.query.group_by || "status";
    const billableFilter = req.query.billable_filter || "billable";

    // Get project information including currency and organization calculation method
    const projectQuery = `
      SELECT 
        p.id, 
        p.name, 
        p.currency,
        o.calculation_method,
        o.hours_per_day
      FROM projects p
      JOIN teams t ON p.team_id = t.id
      JOIN organizations o ON t.organization_id = o.id
      WHERE p.id = $1
    `;
    const projectResult = await db.query(projectQuery, [projectId]);
    
    if (projectResult.rows.length === 0) {
      return res.status(404).send(new ServerResponse(false, null, "Project not found"));
    }
    
    const project = projectResult.rows[0];

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
    const groupedTasks = groups.map((group) => {
      const groupTasks = tasks.filter((task) => {
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
        tasks: groupTasks.map((task) => ({
          id: task.id,
          name: task.name,
          estimated_seconds: Number(task.estimated_seconds) || 0,
          estimated_hours: formatTimeToHMS(Number(task.estimated_seconds) || 0),
          total_minutes: Number(task.total_minutes) || 0,
          total_time_logged_seconds:
            Number(task.total_time_logged_seconds) || 0,
          total_time_logged: formatTimeToHMS(
            Number(task.total_time_logged_seconds) || 0
          ),
          estimated_cost: Number(task.estimated_cost) || 0,
          actual_cost_from_logs: Number(task.actual_cost_from_logs) || 0,
          fixed_cost: Number(task.fixed_cost) || 0,
          total_budget: Number(task.total_budget) || 0,
          total_actual: Number(task.total_actual) || 0,
          variance: Number(task.variance) || 0,
          effort_variance_man_days: task.effort_variance_man_days ? Number(task.effort_variance_man_days) : null,
          actual_man_days: task.actual_man_days ? Number(task.actual_man_days) : null,
          members: task.assignees,
          billable: task.billable,
          sub_tasks_count: Number(task.sub_tasks_count) || 0,
        })),
      };
    });

    // Include project rate cards and currency in the response for reference
    const responseData = {
      groups: groupedTasks,
      project_rate_cards: projectRateCards,
      project: {
        id: project.id,
        name: project.name,
        currency: project.currency || "USD",
        calculation_method: project.calculation_method || "hourly",
        hours_per_day: Number(project.hours_per_day) || 8
      }
    };

    return res.status(200).send(new ServerResponse(true, responseData));
  }

  @HandleExceptions()
  public static async updateTaskFixedCost(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const taskId = req.params.task_id;
    const { fixed_cost } = req.body;

    if (typeof fixed_cost !== "number" || fixed_cost < 0) {
      return res
        .status(400)
        .send(new ServerResponse(false, null, "Invalid fixed cost value"));
    }

    // Check if the task has subtasks - parent tasks should not have editable fixed costs
    const checkParentQuery = `
      SELECT 
        t.id,
        t.name,
        (SELECT COUNT(*) FROM tasks st WHERE st.parent_task_id = t.id AND st.archived = false) as sub_tasks_count
      FROM tasks t 
      WHERE t.id = $1 AND t.archived = false;
    `;

    const checkResult = await db.query(checkParentQuery, [taskId]);

    if (checkResult.rows.length === 0) {
      return res
        .status(404)
        .send(new ServerResponse(false, null, "Task not found"));
    }

    const task = checkResult.rows[0];
    
    // Prevent updating fixed cost for parent tasks
    if (task.sub_tasks_count > 0) {
      return res
        .status(400)
        .send(new ServerResponse(false, null, "Cannot update fixed cost for parent tasks. Fixed cost is calculated from subtasks."));
    }

    // Update only the specific subtask's fixed cost
    const updateQuery = `
      UPDATE tasks 
      SET fixed_cost = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, name, fixed_cost;
    `;

    const result = await db.query(updateQuery, [fixed_cost, taskId]);

    if (result.rows.length === 0) {
      return res
        .status(404)
        .send(new ServerResponse(false, null, "Task not found"));
    }

    return res.status(200).send(new ServerResponse(true, {
      updated_task: result.rows[0],
      message: "Fixed cost updated successfully."
    }));
  }

  @HandleExceptions()
  public static async getTaskBreakdown(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const taskId = req.params.id;

    // Get task basic information and financial data
    const taskQuery = `
      SELECT 
        t.id,
        t.name,
        t.project_id,
        COALESCE(t.total_minutes, 0) / 60.0 as estimated_hours,
        COALESCE((SELECT SUM(time_spent) FROM task_work_log WHERE task_id = t.id), 0) / 3600.0 as total_time_logged,
        COALESCE(t.fixed_cost, 0) as fixed_cost,
        t.billable,
        (SELECT get_task_assignees(t.id)) as assignees
      FROM tasks t
      WHERE t.id = $1 AND t.archived = false;
    `;

    const taskResult = await db.query(taskQuery, [taskId]);

    if (taskResult.rows.length === 0) {
      return res
        .status(404)
        .send(new ServerResponse(false, null, "Task not found"));
    }

    const [task] = taskResult.rows;

    // Get detailed member information with rates and job titles
    const membersWithRates = [];
    if (Array.isArray(task.assignees)) {
      for (const assignee of task.assignees) {
        const memberRateQuery = `
          SELECT 
            tm.id as team_member_id,
            u.name,
            u.avatar_url,
            pm.project_rate_card_role_id,
            COALESCE(fprr.rate, 0) as hourly_rate,
            fprr.job_title_id,
            jt.name as job_title_name
          FROM team_members tm
          LEFT JOIN users u ON tm.user_id = u.id
          LEFT JOIN project_members pm ON pm.team_member_id = tm.id AND pm.project_id = $1
          LEFT JOIN finance_project_rate_card_roles fprr ON fprr.id = pm.project_rate_card_role_id
          LEFT JOIN job_titles jt ON fprr.job_title_id = jt.id
          WHERE tm.id = $2
        `;

        try {
          const memberResult = await db.query(memberRateQuery, [
            task.project_id,
            assignee.team_member_id,
          ]);
          if (memberResult.rows.length > 0) {
            const [member] = memberResult.rows;

            // Get actual time logged by this member for this task
            const timeLogQuery = `
              SELECT COALESCE(SUM(time_spent), 0) / 3600.0 as logged_hours
              FROM task_work_log twl
              LEFT JOIN users u ON twl.user_id = u.id
              LEFT JOIN team_members tm ON u.id = tm.user_id
              WHERE twl.task_id = $1 AND tm.id = $2
            `;

            const timeLogResult = await db.query(timeLogQuery, [
              taskId,
              member.team_member_id,
            ]);
            const loggedHours = Number(
              timeLogResult.rows[0]?.logged_hours || 0
            );

            membersWithRates.push({
              team_member_id: member.team_member_id,
              name: member.name || "Unknown User",
              avatar_url: member.avatar_url,
              hourly_rate: Number(member.hourly_rate || 0),
              job_title_name: member.job_title_name || "Unassigned",
              estimated_hours:
                task.assignees.length > 0
                  ? Number(task.estimated_hours) / task.assignees.length
                  : 0,
              logged_hours: loggedHours,
              estimated_cost:
                (task.assignees.length > 0
                  ? Number(task.estimated_hours) / task.assignees.length
                  : 0) * Number(member.hourly_rate || 0),
              actual_cost: loggedHours * Number(member.hourly_rate || 0),
            });
          }
        } catch (error) {
          console.error("Error fetching member details:", error);
        }
      }
    }

    // Group members by job title and calculate totals
    const groupedMembers = membersWithRates.reduce((acc: any, member: any) => {
      const jobRole = member.job_title_name || "Unassigned";

      if (!acc[jobRole]) {
        acc[jobRole] = {
          jobRole,
          estimated_hours: 0,
          logged_hours: 0,
          estimated_cost: 0,
          actual_cost: 0,
          members: [],
        };
      }

      acc[jobRole].estimated_hours += member.estimated_hours;
      acc[jobRole].logged_hours += member.logged_hours;
      acc[jobRole].estimated_cost += member.estimated_cost;
      acc[jobRole].actual_cost += member.actual_cost;
      acc[jobRole].members.push({
        team_member_id: member.team_member_id,
        name: member.name,
        avatar_url: member.avatar_url,
        hourly_rate: member.hourly_rate,
        estimated_hours: member.estimated_hours,
        logged_hours: member.logged_hours,
        estimated_cost: member.estimated_cost,
        actual_cost: member.actual_cost,
      });

      return acc;
    }, {});

    // Calculate task totals
    const taskTotals = {
      estimated_hours: Number(task.estimated_hours || 0),
      logged_hours: Number(task.total_time_logged || 0),
      estimated_labor_cost: membersWithRates.reduce(
        (sum, member) => sum + member.estimated_cost,
        0
      ),
      actual_labor_cost: membersWithRates.reduce(
        (sum, member) => sum + member.actual_cost,
        0
      ),
      fixed_cost: Number(task.fixed_cost || 0),
      total_estimated_cost:
        membersWithRates.reduce(
          (sum, member) => sum + member.estimated_cost,
          0
        ) + Number(task.fixed_cost || 0),
      total_actual_cost:
        membersWithRates.reduce((sum, member) => sum + member.actual_cost, 0) +
        Number(task.fixed_cost || 0),
    };

    const responseData = {
      task: {
        id: task.id,
        name: task.name,
        project_id: task.project_id,
        billable: task.billable,
        ...taskTotals,
      },
      grouped_members: Object.values(groupedMembers),
      members: membersWithRates,
    };

    return res.status(200).send(new ServerResponse(true, responseData));
  }

  @HandleExceptions()
  public static async getSubTasks(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const projectId = req.params.project_id;
    const parentTaskId = req.params.parent_task_id;
    const billableFilter = req.query.billable_filter || "billable";

    if (!parentTaskId) {
      return res
        .status(400)
        .send(new ServerResponse(false, null, "Parent task ID is required"));
    }

    // Get project information including currency and organization calculation method
    const projectQuery = `
      SELECT 
        p.id, 
        p.name, 
        p.currency,
        o.calculation_method,
        o.hours_per_day
      FROM projects p
      JOIN teams t ON p.team_id = t.id
      JOIN organizations o ON t.organization_id = o.id
      WHERE p.id = $1;
    `;
    const projectResult = await db.query(projectQuery, [projectId]);
    if (projectResult.rows.length === 0) {
      return res.status(404).send(new ServerResponse(false, null, "Project not found"));
    }
    const project = projectResult.rows[0];

    // Build billable filter condition for subtasks
    let billableCondition = "";
    if (billableFilter === "billable") {
      billableCondition = "AND t.billable = true";
    } else if (billableFilter === "non-billable") {
      billableCondition = "AND t.billable = false";
    }

    // Get subtasks with their financial data, including recursive aggregation for sub-subtasks
    const q = `
      WITH RECURSIVE task_tree AS (
        -- Get the requested subtasks
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
          AND t.parent_task_id = $2
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
            WHEN $3 = 'man_days' THEN
              -- Man days calculation: use estimated_man_days * man_day_rate
              COALESCE((
                SELECT SUM(
                  CASE 
                    WHEN COALESCE(fprr.man_day_rate, 0) > 0 THEN 
                      -- Use total_minutes if available, otherwise use estimated_seconds
                      CASE 
                        WHEN tt.total_minutes > 0 THEN ((tt.total_minutes / 60.0) / $4) * COALESCE(fprr.man_day_rate, 0)
                        ELSE ((tt.estimated_seconds / 3600.0) / $4) * COALESCE(fprr.man_day_rate, 0)
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
            WHEN $3 = 'man_days' THEN
              -- Man days calculation: convert actual time to man days and multiply by man day rates
              COALESCE((
                SELECT SUM(
                  CASE 
                    WHEN COALESCE(fprr.man_day_rate, 0) > 0 THEN 
                      COALESCE(fprr.man_day_rate, 0) * ((twl.time_spent / 3600.0) / $4)
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
          -- For subtasks that have their own sub-subtasks, sum values from leaf tasks only
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
        WHERE tc.level = 0  -- Only return the requested level (subtasks)
      )
      SELECT 
        at.*,
        (at.estimated_cost + at.fixed_cost) as total_budget,
        (at.actual_cost_from_logs + at.fixed_cost) as total_actual,
        ((at.actual_cost_from_logs + at.fixed_cost) - (at.estimated_cost + at.fixed_cost)) as variance
      FROM aggregated_tasks at;
    `;

    const result = await db.query(q, [projectId, parentTaskId, project.calculation_method, project.hours_per_day]);
    const tasks = result.rows;

    // Add color_code to each assignee and include their rate information
    for (const task of tasks) {
      if (Array.isArray(task.assignees)) {
        for (const assignee of task.assignees) {
          assignee.color_code = getColor(assignee.name);

          // Get the rate for this assignee
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
              assignee.project_rate_card_role_id = null;
              assignee.rate = 0;
              assignee.job_title_id = null;
              assignee.job_title_name = null;
            }
          } catch (error) {
            console.error("Error fetching member rate:", error);
            assignee.project_rate_card_role_id = null;
            assignee.rate = 0;
            assignee.job_title_id = null;
            assignee.job_title_name = null;
          }
        }
      }
    }

    // Format the response to match the expected structure
    const formattedTasks = tasks.map((task) => ({
      id: task.id,
      name: task.name,
      estimated_seconds: Number(task.estimated_seconds) || 0,
      estimated_hours: formatTimeToHMS(Number(task.estimated_seconds) || 0),
      total_minutes: Number(task.total_minutes) || 0,
      total_time_logged_seconds: Number(task.total_time_logged_seconds) || 0,
      total_time_logged: formatTimeToHMS(
        Number(task.total_time_logged_seconds) || 0
      ),
      estimated_cost: Number(task.estimated_cost) || 0,
      actual_cost_from_logs: Number(task.actual_cost_from_logs) || 0,
      fixed_cost: Number(task.fixed_cost) || 0,
      total_budget: Number(task.total_budget) || 0,
      total_actual: Number(task.total_actual) || 0,
      variance: Number(task.variance) || 0,
      effort_variance_man_days: task.effort_variance_man_days ? Number(task.effort_variance_man_days) : null,
      actual_man_days: task.actual_man_days ? Number(task.actual_man_days) : null,
      members: task.assignees,
      billable: task.billable,
      sub_tasks_count: Number(task.sub_tasks_count) || 0,
    }));

    return res.status(200).send(new ServerResponse(true, formattedTasks));
  }

  @HandleExceptions()
  public static async exportFinanceData(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<void> {
    const projectId = req.params.project_id;
    const groupBy = (req.query.groupBy as string) || "status";
    const billableFilter = req.query.billable_filter || "billable";

    // Get project information including currency and organization calculation method
    const projectQuery = `
      SELECT 
        p.id, 
        p.name, 
        p.currency,
        o.calculation_method,
        o.hours_per_day
      FROM projects p
      JOIN teams t ON p.team_id = t.id
      JOIN organizations o ON t.organization_id = o.id
      WHERE p.id = $1
    `;
    const projectResult = await db.query(projectQuery, [projectId]);
    
    if (projectResult.rows.length === 0) {
      res.status(404).send(new ServerResponse(false, null, "Project not found"));
      return;
    }
    
    const project = projectResult.rows[0];
    const projectName = project?.name || "Unknown Project";
    const projectCurrency = project?.currency || "USD";

    // First, get the project rate cards for this project
    const rateCardQuery = `
      SELECT 
        fprr.id,
        fprr.project_id,
        fprr.job_title_id,
        fprr.rate,
        jt.name as job_title_name
      FROM finance_project_rate_card_roles fprr
      LEFT JOIN job_titles jt ON fprr.job_title_id = jt.id
      WHERE fprr.project_id = $1
      ORDER BY jt.name;
    `;

    const rateCardResult = await db.query(rateCardQuery, [projectId]);
    const projectRateCards = rateCardResult.rows;

    // Build billable filter condition for export
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
        ((at.actual_cost_from_logs + at.fixed_cost) - (at.estimated_cost + at.fixed_cost)) as variance,
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
    const groupedTasks = groups.map((group) => {
      const groupTasks = tasks.filter((task) => {
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
        tasks: groupTasks.map((task) => ({
          id: task.id,
          name: task.name,
          estimated_seconds: Number(task.estimated_seconds) || 0,
          estimated_hours: formatTimeToHMS(Number(task.estimated_seconds) || 0),
          total_minutes: Number(task.total_minutes) || 0,
          total_time_logged_seconds:
            Number(task.total_time_logged_seconds) || 0,
          total_time_logged: formatTimeToHMS(
            Number(task.total_time_logged_seconds) || 0
          ),
          estimated_cost: Number(task.estimated_cost) || 0,
          actual_cost_from_logs: Number(task.actual_cost_from_logs) || 0,
          fixed_cost: Number(task.fixed_cost) || 0,
          total_budget: Number(task.total_budget) || 0,
          total_actual: Number(task.total_actual) || 0,
          variance: Number(task.variance) || 0,
          effort_variance_man_days: task.effort_variance_man_days ? Number(task.effort_variance_man_days) : null,
          actual_man_days: task.actual_man_days ? Number(task.actual_man_days) : null,
          members: task.assignees,
          billable: task.billable,
          sub_tasks_count: Number(task.sub_tasks_count) || 0,
        })),
      };
    });

    // Include project rate cards in the response for reference
    const responseData = {
      groups: groupedTasks,
      project_rate_cards: projectRateCards,
    };

    // Create Excel workbook and worksheet
    const workbook = new Excel.Workbook();
    const worksheet = workbook.addWorksheet("Finance Data");

    // Add headers to the worksheet
    worksheet.columns = [
      { header: "Task Name", key: "task_name", width: 30 },
      { header: "Group", key: "group_name", width: 20 },
      { header: "Estimated Hours", key: "estimated_hours", width: 15 },
      { header: "Total Time Logged", key: "total_time_logged", width: 15 },
      { header: "Estimated Cost", key: "estimated_cost", width: 15 },
      { header: "Fixed Cost", key: "fixed_cost", width: 15 },
      { header: "Total Budget", key: "total_budget", width: 15 },
      { header: "Total Actual", key: "total_actual", width: 15 },
      { header: "Variance", key: "variance", width: 15 },
      { header: "Members", key: "members", width: 30 },
      { header: "Billable", key: "billable", width: 10 },
      { header: "Sub Tasks Count", key: "sub_tasks_count", width: 15 },
    ];

    // Add title row
    worksheet.getCell(
      "A1"
    ).value = `Finance Data Export - ${projectName} (${projectCurrency}) - ${moment().format(
      "MMM DD, YYYY"
    )}`;
    worksheet.mergeCells("A1:L1");
    worksheet.getCell("A1").alignment = { horizontal: "center" };
    worksheet.getCell("A1").style.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "D9D9D9" },
    };
    worksheet.getCell("A1").font = { size: 16, bold: true };

    // Add headers on row 3
    worksheet.getRow(3).values = [
      "Task Name",
      "Group",
      "Estimated Hours",
      "Total Time Logged",
      "Estimated Cost",
      "Fixed Cost",
      "Total Budget",
      "Total Actual",
      "Variance",
      "Members",
      "Billable",
      "Sub Tasks Count",
    ];
    worksheet.getRow(3).font = { bold: true };

    // Add data to the worksheet
    let currentRow = 4;
    for (const group of responseData.groups) {
      for (const task of group.tasks) {
        worksheet.addRow({
          task_name: task.name,
          group_name: group.group_name,
          estimated_hours: task.estimated_hours,
          total_time_logged: task.total_time_logged,
          estimated_cost: task.estimated_cost.toFixed(2),
          fixed_cost: task.fixed_cost.toFixed(2),
          total_budget: task.total_budget.toFixed(2),
          total_actual: task.total_actual.toFixed(2),
          variance: task.variance.toFixed(2),
          members: task.members.map((m: any) => m.name).join(", "),
          billable: task.billable ? "Yes" : "No",
          sub_tasks_count: task.sub_tasks_count,
        });
        currentRow++;
      }
    }

    // Create a buffer to hold the Excel file
    const buffer = await workbook.xlsx.writeBuffer();

    // Create filename with project name, date and time
    const sanitizedProjectName = projectName
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .replace(/\s+/g, "_");
    const dateTime = moment().format("YYYY-MM-DD_HH-mm-ss");
    const filename = `${sanitizedProjectName}_Finance_Data_${dateTime}.xlsx`;

    // Set the response headers for the Excel file
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    // Send the Excel file as a response
    res.end(buffer);
  }

  @HandleExceptions()
  public static async updateProjectCurrency(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const projectId = req.params.project_id;
    const { currency } = req.body;

    // Validate currency format (3-character uppercase code)
    if (!currency || typeof currency !== "string" || !/^[A-Z]{3}$/.test(currency)) {
      return res
        .status(400)
        .send(new ServerResponse(false, null, "Invalid currency format. Currency must be a 3-character uppercase code (e.g., USD, EUR, GBP)"));
    }

    // Check if project exists and user has access
    const projectCheckQuery = `
      SELECT p.id, p.name, p.currency as current_currency
      FROM projects p
      WHERE p.id = $1 AND p.team_id = $2
    `;

    const projectCheckResult = await db.query(projectCheckQuery, [projectId, req.user?.team_id]);

    if (projectCheckResult.rows.length === 0) {
      return res
        .status(404)
        .send(new ServerResponse(false, null, "Project not found or access denied"));
    }

    const project = projectCheckResult.rows[0];

    // Update project currency
    const updateQuery = `
      UPDATE projects 
      SET currency = $1, updated_at = NOW()
      WHERE id = $2 AND team_id = $3
      RETURNING id, name, currency;
    `;

    const result = await db.query(updateQuery, [currency, projectId, req.user?.team_id]);

    if (result.rows.length === 0) {
      return res
        .status(500)
        .send(new ServerResponse(false, null, "Failed to update project currency"));
    }

    const updatedProject = result.rows[0];

    // Log the currency change for audit purposes
    const logQuery = `
      INSERT INTO project_logs (team_id, project_id, description)
      VALUES ($1, $2, $3)
    `;

    const logDescription = `Project currency changed from ${project.current_currency || "USD"} to ${currency}`;
    
    try {
      await db.query(logQuery, [req.user?.team_id, projectId, logDescription]);
    } catch (error) {
      console.error("Failed to log currency change:", error);
      // Don't fail the request if logging fails
    }

    return res.status(200).send(new ServerResponse(true, {
      id: updatedProject.id,
      name: updatedProject.name,
      currency: updatedProject.currency,
      message: `Project currency updated to ${currency}`
    }));
  }

  @HandleExceptions()
  public static async updateProjectBudget(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const projectId = req.params.project_id;
    const { budget } = req.body;

    // Validate budget format (must be a non-negative number)
    if (budget === undefined || budget === null || isNaN(budget) || budget < 0) {
      return res
        .status(400)
        .send(new ServerResponse(false, null, "Invalid budget amount. Budget must be a non-negative number"));
    }

    // Check if project exists and user has access
    const projectCheckQuery = `
      SELECT p.id, p.name, p.budget as current_budget, p.currency
      FROM projects p
      WHERE p.id = $1 AND p.team_id = $2
    `;

    const projectCheckResult = await db.query(projectCheckQuery, [projectId, req.user?.team_id]);

    if (projectCheckResult.rows.length === 0) {
      return res
        .status(404)
        .send(new ServerResponse(false, null, "Project not found or access denied"));
    }

    const project = projectCheckResult.rows[0];

    // Update project budget
    const updateQuery = `
      UPDATE projects 
      SET budget = $1, updated_at = NOW()
      WHERE id = $2 AND team_id = $3
      RETURNING id, name, budget, currency;
    `;

    const result = await db.query(updateQuery, [budget, projectId, req.user?.team_id]);

    if (result.rows.length === 0) {
      return res
        .status(500)
        .send(new ServerResponse(false, null, "Failed to update project budget"));
    }

    const updatedProject = result.rows[0];

    // Log the budget change for audit purposes
    const logQuery = `
      INSERT INTO project_logs (team_id, project_id, description)
      VALUES ($1, $2, $3)
    `;

    const logDescription = `Project budget changed from ${project.current_budget || 0} to ${budget} ${project.currency || "USD"}`;
    
    try {
      await db.query(logQuery, [req.user?.team_id, projectId, logDescription]);
    } catch (error) {
      console.error("Failed to log budget change:", error);
      // Don't fail the request if logging fails
    }

    return res.status(200).send(new ServerResponse(true, {
      id: updatedProject.id,
      name: updatedProject.name,
      budget: Number(updatedProject.budget),
      currency: updatedProject.currency,
      message: `Project budget updated to ${budget} ${project.currency || "USD"}`
    }));
  }

  @HandleExceptions()
  public static async updateProjectCalculationMethod(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const projectId = req.params.project_id;
    const { calculation_method, hours_per_day } = req.body;

    // Validate calculation method
    if (!["hourly", "man_days"].includes(calculation_method)) {
      return res.status(400).send(new ServerResponse(false, null, "Invalid calculation method. Must be \"hourly\" or \"man_days\""));
    }

    // Validate hours per day
    if (hours_per_day && (typeof hours_per_day !== "number" || hours_per_day <= 0)) {
      return res.status(400).send(new ServerResponse(false, null, "Invalid hours per day. Must be a positive number"));
    }

    const updateQuery = `
      UPDATE projects 
      SET calculation_method = $1, 
          hours_per_day = COALESCE($2, hours_per_day),
          updated_at = NOW()
      WHERE id = $3
      RETURNING id, name, calculation_method, hours_per_day;
    `;

    const result = await db.query(updateQuery, [calculation_method, hours_per_day, projectId]);

    if (result.rows.length === 0) {
      return res.status(404).send(new ServerResponse(false, null, "Project not found"));
    }

    return res.status(200).send(new ServerResponse(true, {
      project: result.rows[0],
      message: "Project calculation method updated successfully"
    }));
  }

  @HandleExceptions()
  public static async updateRateCardManDayRate(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { rate_card_role_id } = req.params;
    const { man_day_rate } = req.body;

    // Validate man day rate
    if (typeof man_day_rate !== "number" || man_day_rate < 0) {
      return res.status(400).send(new ServerResponse(false, null, "Invalid man day rate. Must be a non-negative number"));
    }

    const updateQuery = `
      UPDATE finance_project_rate_card_roles 
      SET man_day_rate = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, project_id, job_title_id, rate, man_day_rate;
    `;

    const result = await db.query(updateQuery, [man_day_rate, rate_card_role_id]);

    if (result.rows.length === 0) {
      return res.status(404).send(new ServerResponse(false, null, "Rate card role not found"));
    }

    return res.status(200).send(new ServerResponse(true, {
      rate_card_role: result.rows[0],
      message: "Man day rate updated successfully"
    }));
  }
}