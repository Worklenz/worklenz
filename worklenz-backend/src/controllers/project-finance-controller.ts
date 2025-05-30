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
          COALESCE((SELECT SUM(time_spent) FROM task_work_log WHERE task_id = t.id), 0) as total_time_logged_seconds,
          (SELECT COUNT(*) FROM tasks WHERE parent_task_id = t.id AND archived = false) as sub_tasks_count,
          0 as level,
          t.id as root_id
        FROM tasks t
        WHERE t.project_id = $1 
          AND t.archived = false
          AND t.parent_task_id IS NULL  -- Only load parent tasks initially
        
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
          COALESCE((SELECT SUM(time_spent) FROM task_work_log WHERE task_id = t.id), 0) as total_time_logged_seconds,
          0 as sub_tasks_count,
          tt.level + 1 as level,
          tt.root_id
        FROM tasks t
        INNER JOIN task_tree tt ON t.parent_task_id = tt.id
        WHERE t.archived = false
      ),
      task_costs AS (
        SELECT 
          tt.*,
          -- Calculate estimated cost based on estimated hours and assignee rates
          COALESCE((
            SELECT SUM((tt.estimated_seconds / 3600.0) * COALESCE(fprr.rate, 0))
            FROM json_array_elements(tt.assignees) AS assignee_json
            LEFT JOIN project_members pm ON pm.team_member_id = (assignee_json->>'team_member_id')::uuid 
              AND pm.project_id = tt.project_id
            LEFT JOIN finance_project_rate_card_roles fprr ON fprr.id = pm.project_rate_card_role_id
            WHERE assignee_json->>'team_member_id' IS NOT NULL
          ), 0) as estimated_cost,
          -- Calculate actual cost based on time logged and assignee rates
          COALESCE((
            SELECT SUM(COALESCE(fprr.rate, 0) * (twl.time_spent / 3600.0))
            FROM task_work_log twl 
            LEFT JOIN users u ON twl.user_id = u.id
            LEFT JOIN team_members tm ON u.id = tm.user_id
            LEFT JOIN project_members pm ON pm.team_member_id = tm.id AND pm.project_id = tt.project_id
            LEFT JOIN finance_project_rate_card_roles fprr ON fprr.id = pm.project_rate_card_role_id
            WHERE twl.task_id = tt.id
          ), 0) as actual_cost_from_logs
        FROM task_tree tt
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
          tc.fixed_cost,
          tc.sub_tasks_count,
          -- For parent tasks, sum values from all descendants including self
          CASE 
            WHEN tc.level = 0 AND tc.sub_tasks_count > 0 THEN (
              SELECT SUM(sub_tc.estimated_seconds)
              FROM task_costs sub_tc 
              WHERE sub_tc.root_id = tc.id
            )
            ELSE tc.estimated_seconds
          END as estimated_seconds,
          CASE 
            WHEN tc.level = 0 AND tc.sub_tasks_count > 0 THEN (
              SELECT SUM(sub_tc.total_time_logged_seconds)
              FROM task_costs sub_tc 
              WHERE sub_tc.root_id = tc.id
            )
            ELSE tc.total_time_logged_seconds
          END as total_time_logged_seconds,
          CASE 
            WHEN tc.level = 0 AND tc.sub_tasks_count > 0 THEN (
              SELECT SUM(sub_tc.estimated_cost)
              FROM task_costs sub_tc 
              WHERE sub_tc.root_id = tc.id
            )
            ELSE tc.estimated_cost
          END as estimated_cost,
          CASE 
            WHEN tc.level = 0 AND tc.sub_tasks_count > 0 THEN (
              SELECT SUM(sub_tc.actual_cost_from_logs)
              FROM task_costs sub_tc 
              WHERE sub_tc.root_id = tc.id
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
        ((at.actual_cost_from_logs + at.fixed_cost) - (at.estimated_cost + at.fixed_cost)) as variance
      FROM aggregated_tasks at;
    `;

    const result = await db.query(q, [projectId]);
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
          total_time_logged_seconds:
            Number(task.total_time_logged_seconds) || 0,
          total_time_logged: formatTimeToHMS(
            Number(task.total_time_logged_seconds) || 0
          ),
          estimated_cost: Number(task.estimated_cost) || 0,
          fixed_cost: Number(task.fixed_cost) || 0,
          total_budget: Number(task.total_budget) || 0,
          total_actual: Number(task.total_actual) || 0,
          variance: Number(task.variance) || 0,
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

    const q = `
      UPDATE tasks 
      SET fixed_cost = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, name, fixed_cost;
    `;

    const result = await db.query(q, [fixed_cost, taskId]);

    if (result.rows.length === 0) {
      return res
        .status(404)
        .send(new ServerResponse(false, null, "Task not found"));
    }

    return res.status(200).send(new ServerResponse(true, result.rows[0]));
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

    if (!parentTaskId) {
      return res
        .status(400)
        .send(new ServerResponse(false, null, "Parent task ID is required"));
    }

    // Get subtasks with their financial data
    const q = `
      WITH task_costs AS (
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
          COALESCE((SELECT SUM(time_spent) FROM task_work_log WHERE task_id = t.id), 0) as total_time_logged_seconds,
          (SELECT COUNT(*) FROM tasks WHERE parent_task_id = t.id AND archived = false) as sub_tasks_count
        FROM tasks t
        WHERE t.project_id = $1 
          AND t.archived = false
          AND t.parent_task_id = $2
      ),
      task_estimated_costs AS (
        SELECT 
          tc.*,
          -- Calculate estimated cost based on estimated hours and assignee rates
          COALESCE((
            SELECT SUM((tc.estimated_seconds / 3600.0) * COALESCE(fprr.rate, 0))
            FROM json_array_elements(tc.assignees) AS assignee_json
            LEFT JOIN project_members pm ON pm.team_member_id = (assignee_json->>'team_member_id')::uuid 
              AND pm.project_id = tc.project_id
            LEFT JOIN finance_project_rate_card_roles fprr ON fprr.id = pm.project_rate_card_role_id
            WHERE assignee_json->>'team_member_id' IS NOT NULL
          ), 0) as estimated_cost,
          -- Calculate actual cost based on time logged and assignee rates
          COALESCE((
            SELECT SUM(COALESCE(fprr.rate, 0) * (twl.time_spent / 3600.0))
            FROM task_work_log twl 
            LEFT JOIN users u ON twl.user_id = u.id
            LEFT JOIN team_members tm ON u.id = tm.user_id
            LEFT JOIN project_members pm ON pm.team_member_id = tm.id AND pm.project_id = tc.project_id
            LEFT JOIN finance_project_rate_card_roles fprr ON fprr.id = pm.project_rate_card_role_id
            WHERE twl.task_id = tc.id
          ), 0) as actual_cost_from_logs
        FROM task_costs tc
      )
      SELECT 
        tec.*,
        (tec.estimated_cost + tec.fixed_cost) as total_budget,
        (tec.actual_cost_from_logs + tec.fixed_cost) as total_actual,
        ((tec.actual_cost_from_logs + tec.fixed_cost) - (tec.estimated_cost + tec.fixed_cost)) as variance
      FROM task_estimated_costs tec;
    `;

    const result = await db.query(q, [projectId, parentTaskId]);
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
      total_time_logged_seconds: Number(task.total_time_logged_seconds) || 0,
      total_time_logged: formatTimeToHMS(
        Number(task.total_time_logged_seconds) || 0
      ),
      estimated_cost: Number(task.estimated_cost) || 0,
      fixed_cost: Number(task.fixed_cost) || 0,
      total_budget: Number(task.total_budget) || 0,
      total_actual: Number(task.total_actual) || 0,
      variance: Number(task.variance) || 0,
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

    // Get project name for filename
    const projectNameQuery = `SELECT name FROM projects WHERE id = $1`;
    const projectNameResult = await db.query(projectNameQuery, [projectId]);
    const projectName = projectNameResult.rows[0]?.name || "Unknown Project";

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
          COALESCE((SELECT SUM(time_spent) FROM task_work_log WHERE task_id = t.id), 0) as total_time_logged_seconds,
          (SELECT COUNT(*) FROM tasks WHERE parent_task_id = t.id AND archived = false) as sub_tasks_count,
          0 as level,
          t.id as root_id
        FROM tasks t
        WHERE t.project_id = $1 
          AND t.archived = false
          AND t.parent_task_id IS NULL  -- Only load parent tasks initially
        
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
          COALESCE((SELECT SUM(time_spent) FROM task_work_log WHERE task_id = t.id), 0) as total_time_logged_seconds,
          0 as sub_tasks_count,
          tt.level + 1 as level,
          tt.root_id
        FROM tasks t
        INNER JOIN task_tree tt ON t.parent_task_id = tt.id
        WHERE t.archived = false
      ),
      task_costs AS (
        SELECT 
          tt.*,
          -- Calculate estimated cost based on estimated hours and assignee rates
          COALESCE((
            SELECT SUM((tt.estimated_seconds / 3600.0) * COALESCE(fprr.rate, 0))
            FROM json_array_elements(tt.assignees) AS assignee_json
            LEFT JOIN project_members pm ON pm.team_member_id = (assignee_json->>'team_member_id')::uuid 
              AND pm.project_id = tt.project_id
            LEFT JOIN finance_project_rate_card_roles fprr ON fprr.id = pm.project_rate_card_role_id
            WHERE assignee_json->>'team_member_id' IS NOT NULL
          ), 0) as estimated_cost,
          -- Calculate actual cost based on time logged and assignee rates
          COALESCE((
            SELECT SUM(COALESCE(fprr.rate, 0) * (twl.time_spent / 3600.0))
            FROM task_work_log twl 
            LEFT JOIN users u ON twl.user_id = u.id
            LEFT JOIN team_members tm ON u.id = tm.user_id
            LEFT JOIN project_members pm ON pm.team_member_id = tm.id AND pm.project_id = tt.project_id
            LEFT JOIN finance_project_rate_card_roles fprr ON fprr.id = pm.project_rate_card_role_id
            WHERE twl.task_id = tt.id
          ), 0) as actual_cost_from_logs
        FROM task_tree tt
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
          tc.fixed_cost,
          tc.sub_tasks_count,
          -- For parent tasks, sum values from all descendants including self
          CASE 
            WHEN tc.level = 0 AND tc.sub_tasks_count > 0 THEN (
              SELECT SUM(sub_tc.estimated_seconds)
              FROM task_costs sub_tc 
              WHERE sub_tc.root_id = tc.id
            )
            ELSE tc.estimated_seconds
          END as estimated_seconds,
          CASE 
            WHEN tc.level = 0 AND tc.sub_tasks_count > 0 THEN (
              SELECT SUM(sub_tc.total_time_logged_seconds)
              FROM task_costs sub_tc 
              WHERE sub_tc.root_id = tc.id
            )
            ELSE tc.total_time_logged_seconds
          END as total_time_logged_seconds,
          CASE 
            WHEN tc.level = 0 AND tc.sub_tasks_count > 0 THEN (
              SELECT SUM(sub_tc.estimated_cost)
              FROM task_costs sub_tc 
              WHERE sub_tc.root_id = tc.id
            )
            ELSE tc.estimated_cost
          END as estimated_cost,
          CASE 
            WHEN tc.level = 0 AND tc.sub_tasks_count > 0 THEN (
              SELECT SUM(sub_tc.actual_cost_from_logs)
              FROM task_costs sub_tc 
              WHERE sub_tc.root_id = tc.id
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
        ((at.actual_cost_from_logs + at.fixed_cost) - (at.estimated_cost + at.fixed_cost)) as variance
      FROM aggregated_tasks at;
    `;

    const result = await db.query(q, [projectId]);
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
          total_time_logged_seconds:
            Number(task.total_time_logged_seconds) || 0,
          total_time_logged: formatTimeToHMS(
            Number(task.total_time_logged_seconds) || 0
          ),
          estimated_cost: Number(task.estimated_cost) || 0,
          fixed_cost: Number(task.fixed_cost) || 0,
          total_budget: Number(task.total_budget) || 0,
          total_actual: Number(task.total_actual) || 0,
          variance: Number(task.variance) || 0,
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
    ).value = `Finance Data Export - ${projectName} - ${moment().format(
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
}
