import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";

import db from "../config/db";
import { ServerResponse } from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import { getColor } from "../shared/utils";
import moment from "moment";

export default class GanttController extends WorklenzControllerBase {
  @HandleExceptions()
  public static async getPhaseLabel(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `SELECT phase_label
        FROM projects
        WHERE id = $1;`;
    const result = await db.query(q, [req.query.project_id]);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async get(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `SELECT id AS "TaskID",
       name AS "TaskName",
       start_date AS "StartDate",
       end_date AS "EndDate",
       (SELECT name FROM task_statuses WHERE id = tasks.status_id) AS status,
       (SELECT color_code
        FROM sys_task_status_categories
        WHERE id = (SELECT category_id FROM task_statuses WHERE id = tasks.status_id)),
       (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
        FROM (SELECT id AS "TaskID",
                     name AS "TaskName",
                     start_date AS "StartDate",
                     end_date AS "EndDate",
                     (SELECT name FROM task_statuses WHERE id = tasks.status_id) AS status,
                     (SELECT color_code
                      FROM sys_task_status_categories
                      WHERE id = (SELECT category_id FROM task_statuses WHERE id = tasks.status_id))
              FROM tasks t
              WHERE t.parent_task_id = tasks.id) rec) AS subtasks
        FROM tasks
        WHERE archived IS FALSE
          AND project_id = $1
          AND parent_task_id IS NULL
        ORDER BY roadmap_sort_order, created_at DESC;`;
    const result = await db.query(q, [req.query.project_id]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async getPhasesByProject(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `SELECT name AS label,
       (SELECT MIN(start_date)
        FROM tasks
        WHERE id IN (SELECT task_id FROM task_phase WHERE phase_id = project_phases.id)) as day
      FROM project_phases
      WHERE project_id = $1;`;
    const result = await db.query(q, [req.params.id]);
    for (const phase of result.rows) {
      phase.day = new Date(phase.day);
    }
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async getWorkload(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `SELECT pm.id AS "TaskID",
       tmiv.team_member_id,
       name AS "TaskName",
       avatar_url,
       email,
       TRUE as project_member,
       (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
        FROM (SELECT id AS "TaskID",
                     name AS "TaskName",
                     start_date AS "StartDate",
                     end_date AS "EndDate"
              FROM tasks
                       INNER JOIN tasks_assignees ta ON tasks.id = ta.task_id
              WHERE archived IS FALSE
                AND project_id = pm.project_id
                AND ta.team_member_id = tmiv.team_member_id
              ORDER BY roadmap_sort_order, start_date DESC) rec) AS subtasks
      FROM project_members pm
              INNER JOIN team_member_info_view tmiv ON pm.team_member_id = tmiv.team_member_id
      WHERE project_id = $1
      ORDER BY tmiv.name;`;
    const result = await db.query(q, [req.query.project_id]);

    for (const member of result.rows) {
      member.color_code = getColor(member.TaskName);
    }
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async getRoadmapTasks(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const projectId = req.query.project_id;
    
    const q = `
      SELECT 
        t.id,
        t.name,
        t.start_date,
        t.end_date,
        t.done,
        t.roadmap_sort_order,
        t.parent_task_id,
        CASE WHEN t.done THEN 100 ELSE 0 END as progress,
        ts.name as status_name,
        tsc.color_code as status_color,
        tp.name as priority_name,
        tp.value as priority_value,
        tp.color_code as priority_color,
        (
          SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(assignee_info))), '[]'::JSON)
          FROM (
            SELECT 
              tm.id as team_member_id,
              u.name as assignee_name,
              u.avatar_url
            FROM tasks_assignees ta
            JOIN team_members tm ON ta.team_member_id = tm.id
            JOIN users u ON tm.user_id = u.id
            WHERE ta.task_id = t.id
          ) assignee_info
        ) as assignees,
        (
          SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(phase_info))), '[]'::JSON)
          FROM (
            SELECT 
              pp.id as phase_id,
              pp.name as phase_name,
              pp.color_code as phase_color
            FROM task_phase tp
            JOIN project_phases pp ON tp.phase_id = pp.id
            WHERE tp.task_id = t.id
          ) phase_info
        ) as phases,
        (
          SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(dependency_info))), '[]'::JSON)
          FROM (
            SELECT 
              td.related_task_id,
              td.dependency_type,
              rt.name as related_task_name
            FROM task_dependencies td
            JOIN tasks rt ON td.related_task_id = rt.id
            WHERE td.task_id = t.id
          ) dependency_info
        ) as dependencies
      FROM tasks t
      LEFT JOIN task_statuses ts ON t.status_id = ts.id
      LEFT JOIN sys_task_status_categories tsc ON ts.category_id = tsc.id
      LEFT JOIN task_priorities tp ON t.priority_id = tp.id
      WHERE t.project_id = $1 
        AND t.archived = FALSE
        AND t.parent_task_id IS NULL
      ORDER BY t.roadmap_sort_order, t.created_at DESC;
    `;
    
    const result = await db.query(q, [projectId]);
    
    // Get subtasks for each parent task
    for (const task of result.rows) {
      const subtasksQuery = `
        SELECT 
          id,
          name,
          start_date,
          end_date,
          done,
          roadmap_sort_order,
          parent_task_id,
          CASE WHEN done THEN 100 ELSE 0 END as progress
        FROM tasks 
        WHERE parent_task_id = $1 
          AND archived = FALSE
        ORDER BY roadmap_sort_order, created_at DESC;
      `;
      
      const subtasksResult = await db.query(subtasksQuery, [task.id]);
      task.subtasks = subtasksResult.rows;
    }
    
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async getProjectPhases(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const projectId = req.query.project_id;
    
    const q = `
      SELECT 
        pp.id,
        pp.name,
        pp.color_code,
        pp.start_date,
        pp.end_date,
        pp.sort_index,
        -- Calculate task counts by status category for progress
        COALESCE(
          (SELECT COUNT(*) 
           FROM tasks t 
           JOIN task_phase tp ON t.id = tp.task_id 
           JOIN task_statuses ts ON t.status_id = ts.id
           JOIN sys_task_status_categories stsc ON ts.category_id = stsc.id
           WHERE tp.phase_id = pp.id 
             AND t.archived = FALSE 
             AND stsc.is_todo = TRUE), 0
        ) as todo_count,
        COALESCE(
          (SELECT COUNT(*) 
           FROM tasks t 
           JOIN task_phase tp ON t.id = tp.task_id 
           JOIN task_statuses ts ON t.status_id = ts.id
           JOIN sys_task_status_categories stsc ON ts.category_id = stsc.id
           WHERE tp.phase_id = pp.id 
             AND t.archived = FALSE 
             AND stsc.is_doing = TRUE), 0
        ) as doing_count,
        COALESCE(
          (SELECT COUNT(*) 
           FROM tasks t 
           JOIN task_phase tp ON t.id = tp.task_id 
           JOIN task_statuses ts ON t.status_id = ts.id
           JOIN sys_task_status_categories stsc ON ts.category_id = stsc.id
           WHERE tp.phase_id = pp.id 
             AND t.archived = FALSE 
             AND stsc.is_done = TRUE), 0
        ) as done_count,
        COALESCE(
          (SELECT COUNT(*) 
           FROM tasks t 
           JOIN task_phase tp ON t.id = tp.task_id 
           WHERE tp.phase_id = pp.id 
             AND t.archived = FALSE), 0
        ) as total_count
      FROM project_phases pp
      WHERE pp.project_id = $1
      ORDER BY pp.sort_index, pp.created_at;
    `;
    
    const result = await db.query(q, [projectId]);
    
    // Calculate progress percentages for each phase
    const phasesWithProgress = result.rows.map(phase => {
      const total = parseInt(phase.total_count) || 0;
      const todoCount = parseInt(phase.todo_count) || 0;
      const doingCount = parseInt(phase.doing_count) || 0;
      const doneCount = parseInt(phase.done_count) || 0;
      
      return {
        id: phase.id,
        name: phase.name,
        color_code: phase.color_code,
        start_date: phase.start_date,
        end_date: phase.end_date,
        sort_index: phase.sort_index,
        // Calculate progress percentages
        todo_progress: total > 0 ? Math.round((todoCount / total) * 100) : 0,
        doing_progress: total > 0 ? Math.round((doingCount / total) * 100) : 0,
        done_progress: total > 0 ? Math.round((doneCount / total) * 100) : 0,
        total_tasks: total
      };
    });
    
    return res.status(200).send(new ServerResponse(true, phasesWithProgress));
  }

  @HandleExceptions()
  public static async updateTaskDates(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { task_id, start_date, end_date } = req.body;
    
    const q = `
      UPDATE tasks 
      SET start_date = $2, end_date = $3, updated_at = NOW()
      WHERE id = $1
      RETURNING id, start_date, end_date;
    `;
    
    const result = await db.query(q, [task_id, start_date, end_date]);
    return res.status(200).send(new ServerResponse(true, result.rows[0]));
  }

  @HandleExceptions()
  public static async createTask(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { project_id, name, phase_id, start_date, end_date, priority_id, status_id } = req.body;
    
    if (!project_id || !name?.trim()) {
      return res.status(400).send(new ServerResponse(false, null, "Project ID and task name are required"));
    }

    // Get default status if not provided
    let defaultStatusId = status_id;
    if (!defaultStatusId) {
      const statusQuery = `
        SELECT id FROM task_statuses 
        WHERE project_id = $1 
        ORDER BY sort_order ASC 
        LIMIT 1;
      `;
      const statusResult = await db.query(statusQuery, [project_id]);
      if (statusResult.rows.length > 0) {
        defaultStatusId = statusResult.rows[0].id;
      }
    }

    // Create the task
    const createTaskQuery = `
      INSERT INTO tasks (
        name, 
        project_id, 
        status_id,
        priority_id,
        start_date, 
        end_date, 
        created_by,
        updated_by,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7, NOW(), NOW())
      RETURNING id, name, start_date, end_date, project_id;
    `;
    
    const taskResult = await db.query(createTaskQuery, [
      name.trim(),
      project_id,
      defaultStatusId,
      priority_id,
      start_date,
      end_date,
      req.user?.id
    ]);

    const createdTask = taskResult.rows[0];

    // Link task to phase if phase_id provided
    if (phase_id && createdTask.id) {
      const linkPhaseQuery = `
        INSERT INTO task_phase (task_id, phase_id) 
        VALUES ($1, $2)
        ON CONFLICT (task_id, phase_id) DO NOTHING;
      `;
      await db.query(linkPhaseQuery, [createdTask.id, phase_id]);
    }

    return res.status(200).send(new ServerResponse(true, createdTask));
  }

  @HandleExceptions()
  public static async createPhase(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { project_id, name, color_code, start_date, end_date } = req.body;
    
    if (!project_id || !name?.trim()) {
      return res.status(400).send(new ServerResponse(false, null, "Project ID and phase name are required"));
    }

    // Get next sort index
    const sortQuery = `
      SELECT COALESCE(MAX(sort_index), 0) + 1 as next_sort_index 
      FROM project_phases 
      WHERE project_id = $1;
    `;
    const sortResult = await db.query(sortQuery, [project_id]);
    const nextSortIndex = sortResult.rows[0]?.next_sort_index || 1;

    const createPhaseQuery = `
      INSERT INTO project_phases (
        name, 
        project_id, 
        color_code,
        start_date, 
        end_date,
        sort_index,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING id, name, color_code, start_date, end_date, sort_index, project_id;
    `;
    
    const result = await db.query(createPhaseQuery, [
      name.trim(),
      project_id,
      color_code || getColor(),
      start_date,
      end_date,
      nextSortIndex
    ]);

    return res.status(200).send(new ServerResponse(true, result.rows[0]));
  }

  @HandleExceptions()
  public static async updatePhase(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { phase_id, project_id, name, color_code, start_date, end_date } = req.body;
    
    if (!phase_id || !project_id) {
      return res.status(400).send(new ServerResponse(false, null, "Phase ID and Project ID are required"));
    }

    // Build dynamic update query based on provided fields
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name.trim());
    }

    if (color_code !== undefined) {
      updates.push(`color_code = $${paramIndex++}`);
      values.push(color_code);
    }

    if (start_date !== undefined) {
      updates.push(`start_date = $${paramIndex++}`);
      values.push(start_date);
    }

    if (end_date !== undefined) {
      updates.push(`end_date = $${paramIndex++}`);
      values.push(end_date);
    }

    // Add phase_id and project_id at the end for WHERE clause
    values.push(phase_id);
    values.push(project_id);

    const updateQuery = `
      UPDATE project_phases 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex} AND project_id = $${paramIndex + 1}
      RETURNING id, name, color_code, start_date, end_date, sort_index;
    `;
    
    const result = await db.query(updateQuery, values);

    if (result.rows.length === 0) {
      return res.status(404).send(new ServerResponse(false, null, "Phase not found"));
    }

    return res.status(200).send(new ServerResponse(true, result.rows[0]));
  }
}
