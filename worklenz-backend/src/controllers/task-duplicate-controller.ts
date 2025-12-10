import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import db from "../config/db";
import { ServerResponse } from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";

interface DuplicateOptions {
  dates?: boolean;
  assignees?: boolean;
  dependencies?: boolean;
  labels?: boolean;
  attachments?: boolean;
  comments?: boolean;
}

export default class TaskDuplicateController extends WorklenzControllerBase {
  @HandleExceptions()
  public static async duplicate(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { task_id: taskId, project_id: projectId, options = {} } = req.body as {
      task_id: string;
      project_id: string;
      options?: DuplicateOptions;
    };

    const teamId = req.user?.team_id;
    const userId = req.user?.id;

    if (!taskId || !projectId) {
      return res.status(400).send(new ServerResponse(false, null, "task_id and project_id are required"));
    }

    try {
      await db.query("BEGIN");

      // 1. Fetch original task (ensure it belongs to the project and team)
      const selectQuery = `
        SELECT 
          name, done, start_date, end_date, priority_id, project_id, reporter_id,
          description, total_minutes, parent_task_id, status_id, archived, completed_at,
          task_no, sort_order, roadmap_sort_order, billable, schedule_id,
          manual_progress, progress_value, weight, progress_mode, fixed_cost,
          status_sort_order, priority_sort_order, phase_sort_order, member_sort_order
        FROM tasks 
        WHERE id = $1 AND project_id = $2 AND team_id = $3 AND archived = false;
      `;

      const { rows } = await db.query(selectQuery, [taskId, projectId, teamId]);
      const originalTask = rows[0];

      if (!originalTask) {
        await db.query("ROLLBACK");
        return res.status(404).send(new ServerResponse(false, null, "Task not found or access denied"));
      }

      // 2. Prepare new task data
      const newTask: any = { ...originalTask };

      // Remove auto-generated or unique fields
      delete newTask.id;
      delete newTask.created_at;
      delete newTask.updated_at;
      delete newTask.completed_at;
      delete newTask.task_no; // usually auto-generated

      // Reset state for new task
      newTask.done = false;
      newTask.archived = false;
      newTask.reporter_id = userId; // person duplicating is new reporter
      newTask.progress_value = 0;
      newTask.manual_progress = false;

      // Optional: mark as copy
      newTask.name = `Copy - ${originalTask.name}`;

      // Handle date copying
      if (!options.dates) {
        newTask.start_date = null;
        newTask.end_date = null;
      }

      // 3. Insert the new task
      const columns = Object.keys(newTask).join(", ");
      const placeholders = Object.keys(newTask)
        .map((_, i) => `$${i + 1}`)
        .join(", ");
      const values = Object.values(newTask);

      const insertQuery = `
        INSERT INTO tasks (${columns}, team_id)
        VALUES (${placeholders}, $${Object.keys(newTask).length + 1})
        RETURNING id, task_no, name, start_date, end_date, status_id, priority_id, done, created_at;
      `;

      const insertResult = await db.query(insertQuery, [...values, teamId]);
      const duplicatedTask = insertResult.rows[0];

      // 4. Duplicate assignees (if requested)
      if (options.assignees) {
        await db.query(`
          INSERT INTO task_assignees (task_id, team_member_id, project_member_id, role)
          SELECT $1, team_member_id, project_member_id, role
          FROM task_assignees
          WHERE task_id = $2
        `, [duplicatedTask.id, taskId]);
      }

      // 5. Duplicate task labels (if requested and table exists)
      if (options.labels) {
        await db.query(`
          INSERT INTO task_labels (task_id, label_id)
          SELECT $1, label_id
          FROM task_labels
          WHERE task_id = $2
        `, [duplicatedTask.id, taskId]);
      }

      // 6. Duplicate dependencies (optional)
      if (options.dependencies) {
        await db.query(`
          INSERT INTO task_dependencies (task_id, depends_on_task_id, dependency_type)
          SELECT $1, depends_on_task_id, dependency_type
          FROM task_dependencies
          WHERE task_id = $2
        `, [duplicatedTask.id, taskId]);
      }

      await db.query("COMMIT");

      return res.status(201).send(new ServerResponse(true, {
        task_id: duplicatedTask.id,
        task_no: duplicatedTask.task_no,
        name: duplicatedTask.name
      }, "Task duplicated successfully"));

    } catch (error) {
      await db.query("ROLLBACK");
      throw error; // Let @HandleExceptions catch and format it
    }
  }
}