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
      options?: {
        subtasks?: boolean;
        attachments?: boolean;
        dates?: boolean;
        dependencies?: boolean;
        assignees?: boolean;
        labels?: boolean;
        customFields?: boolean;
        subscribers?: boolean;
        // copyNamePrefix?: string;
      };
    };

    const {
      subtasks = false,
      attachments = false,
      dates = false,
      dependencies = false,
      assignees = false,
      labels = false,
      customFields = false,
      subscribers = false,
      // copyNamePrefix = "Copy - ",
    } = options;

    try {
      // Start transaction
      await db.query("BEGIN");

      // 1. Fetch original task
      const { rows } = await db.query(
        `SELECT * FROM tasks WHERE id = $1 AND project_id = $2`,
        [taskId, projectId]
      );

      const originalTask = rows[0];
      if (!originalTask) {
        await db.query("ROLLBACK");
        return res.status(404).send(new ServerResponse(false, null, "Task not found"));
      }

      // 2. Prepare new task data
      const newTask: any = { ...originalTask };
      delete newTask.id;
      delete newTask.created_at;
      delete newTask.updated_at;
      delete newTask.completed_at;
      // delete newTask.task_no;

      newTask.name = 'Copy - ' + originalTask.name;
      newTask.reporter_id = originalTask.reporter_id;
      newTask.done = false;
      newTask.archived = false;
      newTask.progress_value = 0;
      newTask.manual_progress = false;
      newTask.completed_at = null;
      newTask.schedule_id = null;

      if (!dates) {
        newTask.start_date = null;
        newTask.end_date = null;
      }

      // Fix sort_order conflict
      const maxSort = await db.query(
        `SELECT COALESCE(MAX(sort_order), 0) as max_sort FROM tasks WHERE project_id = $1`,
        [projectId]
      );
      newTask.sort_order = maxSort.rows[0].max_sort + 1000;

      // Reset grouping sort orders
      newTask.status_sort_order = 0;
      newTask.priority_sort_order = 0;
      newTask.phase_sort_order = 0;
      newTask.member_sort_order = 0;

      // 3. Insert new task
      const keys = Object.keys(newTask);
      const values = Object.values(newTask);
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");

      const insertResult = await db.query(
        `INSERT INTO tasks (${keys.join(", ")})
       VALUES (${placeholders})
       RETURNING id, task_no, name`,
        [...values]
      );

      const newTaskId = insertResult.rows[0].id;
      const newTaskNo = insertResult.rows[0].task_no;

      // 4. Copy relations (all using db.query — no client needed)

      if (assignees) {
        await db.query(
          `INSERT INTO tasks_assignees (task_id, team_member_id, project_member_id, assigned_by)
          SELECT $1, team_member_id, project_member_id, assigned_by
          FROM tasks_assignees WHERE task_id = $2`,
          [newTaskId, taskId]
        );
      }

      if (labels) {
        await db.query(
          `INSERT INTO task_labels (task_id, label_id)
         SELECT $1, label_id FROM task_labels WHERE task_id = $2
         ON CONFLICT (task_id, label_id) DO NOTHING`,
          [newTaskId, taskId]
        );
      }

      if (dependencies) {
        await db.query(
          `INSERT INTO task_dependencies (task_id, related_task_id, dependency_type)
         SELECT $1, related_task_id, dependency_type
         FROM task_dependencies WHERE task_id = $2
         ON CONFLICT (task_id, related_task_id, dependency_type) DO NOTHING`,
          [newTaskId, taskId]
        );
      }

      if (subscribers) {
        await db.query(
          `INSERT INTO task_subscribers (user_id, task_id, team_member_id, action)
         SELECT user_id, $1, team_member_id, action
         FROM task_subscribers WHERE task_id = $2
         ON CONFLICT (user_id, task_id, team_member_id) DO NOTHING`,
          [newTaskId, taskId]
        );
      }

      if (customFields) {
        await db.query(
          `INSERT INTO cc_column_values (task_id, column_id, text_value, number_value, date_value, boolean_value, json_value)
         SELECT $1, column_id, text_value, number_value, date_value, boolean_value, json_value
         FROM cc_column_values
         WHERE task_id = $2
         ON CONFLICT (task_id, column_id) DO NOTHING`,
          [newTaskId, taskId]
        );
      }

      if (attachments) {
        await db.query(
          `INSERT INTO task_attachments (name, size, type, task_id, team_id, project_id, uploaded_by)
          SELECT name, size, type, $1, team_id, project_id, uploaded_by
          FROM task_attachments
          WHERE task_id = $2`,
          [newTaskId, taskId]
        );
      }

      // Subtasks: simple loop (non-recursive for now — safe & works)
      if (subtasks) {
        const subtasksRes = await db.query(
          `SELECT id FROM tasks WHERE parent_task_id = $1 AND archived = false ORDER BY sort_order`,
          [taskId]
        );

        for (const sub of subtasksRes.rows) {
          // Reuse the same endpoint logic via SQL or call a helper
          // For now: just copy top-level subtasks (deep clone needs stored proc)
          await db.query(
            `SELECT duplicate_task_shallow($1, $2, $3)`,
            [sub.id, newTaskId, JSON.stringify(options)]
          );
          // Or just skip deep recursion if not critical
        }
      }

      // Commit transaction
      await db.query("COMMIT");

      const q = `SELECT get_single_task($1) AS task;`;
      const result = await db.query(q, [newTaskId]);

      const [singleTask] = result.rows;

      return res.status(201).send(new ServerResponse(true, singleTask.task || {}, "Task duplicated successfully"));

    } catch (error) {
      // This will auto-rollback if transaction is active
      await db.query("ROLLBACK").catch(() => { });
      console.error("Task duplication failed:", error);
      throw error;
    }
  }
}