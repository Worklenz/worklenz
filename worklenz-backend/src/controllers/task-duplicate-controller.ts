import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import db from "../config/db";
import { ServerResponse } from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import { copyObject, getKey } from "../shared/storage";

interface DuplicateOptions {
  dates?: boolean;
  assignees?: boolean;
  dependencies?: boolean;
  labels?: boolean;
  attachments?: boolean;
  comments?: boolean;
}

export default class TaskDuplicateController extends WorklenzControllerBase {
  /**
   * Helper function to copy attachment files from original task to duplicated task
   */
  private static async copyAttachmentFiles(originalTaskId: string, newTaskId: string): Promise<void> {
    // Fetch original attachments with their IDs
    const originalAttachments = await db.query(
      `SELECT id, name, size, type, team_id, project_id, uploaded_by
      FROM task_attachments
      WHERE task_id = $1`,
      [originalTaskId]
    );

    // Get new attachments that were just created (they should match by name, size, type, and order)
    const newAttachments = await db.query(
      `SELECT id, name, size, type, team_id, project_id
      FROM task_attachments
      WHERE task_id = $1
      ORDER BY created_at ASC`,
      [newTaskId]
    );

    // Match and copy files
    // We'll match by name, size, and type since those should be unique enough
    for (const originalAttachment of originalAttachments.rows) {
      // Find matching new attachment
      const matchingNewAttachment = newAttachments.rows.find(
        (newAtt) =>
          newAtt.name === originalAttachment.name &&
          newAtt.size === originalAttachment.size &&
          newAtt.type === originalAttachment.type
      );

      if (matchingNewAttachment) {
        // Copy the file from old location to new location
        const sourceKey = getKey(
          originalAttachment.team_id,
          originalAttachment.project_id,
          originalAttachment.id,
          originalAttachment.type
        );
        const destinationKey = getKey(
          matchingNewAttachment.team_id,
          matchingNewAttachment.project_id,
          matchingNewAttachment.id,
          matchingNewAttachment.type
        );

        // Copy the file in storage (S3/Azure)
        await copyObject(sourceKey, destinationKey);
      }
    }
  }

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
        // Fetch original attachments with their IDs
        const originalAttachments = await db.query(
          `SELECT id, name, size, type, team_id, project_id, uploaded_by
          FROM task_attachments
          WHERE task_id = $1
          ORDER BY created_at ASC`,
          [taskId]
        );

        // Copy each attachment with file duplication
        for (const originalAttachment of originalAttachments.rows) {
          // Insert new attachment record and get the new ID
          const newAttachmentResult = await db.query(
            `INSERT INTO task_attachments (name, size, type, task_id, team_id, project_id, uploaded_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id`,
            [
              originalAttachment.name,
              originalAttachment.size,
              originalAttachment.type,
              newTaskId,
              originalAttachment.team_id,
              originalAttachment.project_id,
              originalAttachment.uploaded_by
            ]
          );

          const newAttachmentId = newAttachmentResult.rows[0].id;

          // Copy the file from old location to new location
          const sourceKey = getKey(
            originalAttachment.team_id,
            originalAttachment.project_id,
            originalAttachment.id,
            originalAttachment.type
          );
          const destinationKey = getKey(
            originalAttachment.team_id,
            originalAttachment.project_id,
            newAttachmentId,
            originalAttachment.type
          );

          // Copy the file in storage (S3/Azure)
          await copyObject(sourceKey, destinationKey);
        }
      }

      // Subtasks: recursively duplicate all nested subtasks
      if (subtasks) {
        const subtasksRes = await db.query(
          `SELECT id FROM tasks WHERE parent_task_id = $1 AND archived = false ORDER BY sort_order`,
          [taskId]
        );

        for (const sub of subtasksRes.rows) {
          // duplicate_task_shallow will recursively handle nested subtasks when subtasks option is enabled
          const subtaskResult = await db.query(
            `SELECT duplicate_task_shallow($1, $2, $3) AS new_task_id`,
            [sub.id, newTaskId, JSON.stringify(options)]
          );
          
          const newSubtaskId = subtaskResult.rows[0]?.new_task_id;
          
          // If attachments were included, copy the files for subtask attachments
          if (attachments && newSubtaskId) {
            await this.copyAttachmentFiles(sub.id, newSubtaskId);
          }
        }
      }

      // Commit transaction
      await db.query("COMMIT");

      // Manually count subtasks to ensure accurate count after duplication
      const subtaskCountResult = await db.query(
        `SELECT COUNT(*)::INT as count FROM tasks WHERE parent_task_id = $1 AND archived IS FALSE`,
        [newTaskId]
      );
      const subtaskCount = subtaskCountResult.rows[0]?.count || 0;

      // Fetch custom column values for the duplicated task
      const customColumnsQuery = `
        SELECT COALESCE(
          jsonb_object_agg(
            custom_cols.key,
            custom_cols.value
          ),
          '{}'::JSONB
        ) AS custom_column_values
        FROM (
          SELECT
            cc.key,
            CASE
              WHEN ccv.text_value IS NOT NULL THEN to_jsonb(ccv.text_value)
              WHEN ccv.number_value IS NOT NULL THEN to_jsonb(ccv.number_value)
              WHEN ccv.boolean_value IS NOT NULL THEN to_jsonb(ccv.boolean_value)
              WHEN ccv.date_value IS NOT NULL THEN to_jsonb(ccv.date_value)
              WHEN ccv.json_value IS NOT NULL THEN ccv.json_value
              ELSE NULL::JSONB
            END AS value
          FROM cc_column_values ccv
          JOIN cc_custom_columns cc ON ccv.column_id = cc.id
          WHERE ccv.task_id = $1
        ) AS custom_cols
        WHERE custom_cols.value IS NOT NULL
      `;
      const customColumnsResult = await db.query(customColumnsQuery, [newTaskId]);
      const customColumnValues = customColumnsResult.rows[0]?.custom_column_values || {};

      // Fetch attachment, dependency, subscriber and comment counts for icons
      const attachmentsResult = await db.query(
        `SELECT COUNT(*)::INT as count FROM task_attachments WHERE task_id = $1`,
        [newTaskId]
      );
      const attachmentsCount = attachmentsResult.rows[0]?.count || 0;

      const dependenciesResult = await db.query(
        `SELECT EXISTS(SELECT 1 FROM task_dependencies WHERE task_id = $1) AS has_dependencies`,
        [newTaskId]
      );
      const hasDependencies = !!dependenciesResult.rows[0]?.has_dependencies;

      const subscribersResult = await db.query(
        `SELECT EXISTS(SELECT 1 FROM task_subscribers WHERE task_id = $1) AS has_subscribers`,
        [newTaskId]
      );
      const hasSubscribers = !!subscribersResult.rows[0]?.has_subscribers;

      const commentsResult = await db.query(
        `SELECT COUNT(*)::INT as count FROM task_comments WHERE task_id = $1`,
        [newTaskId]
      );
      const commentsCount = commentsResult.rows[0]?.count || 0;

      const q = `SELECT get_single_task($1) AS task;`;
      const result = await db.query(q, [newTaskId]);

      const [singleTask] = result.rows;
      
      // Ensure the subtask count, custom column values and icon-related fields are correct in the response
      if (singleTask?.task) {
        singleTask.task.sub_tasks_count = subtaskCount;
        singleTask.task.custom_column_values = customColumnValues;
        singleTask.task.attachments_count = attachmentsCount;
        singleTask.task.has_dependencies = hasDependencies;
        singleTask.task.has_subscribers = hasSubscribers;
        singleTask.task.comments_count = commentsCount;
      }

      return res.status(201).send(new ServerResponse(true, singleTask.task || {}, "Task duplicated successfully"));

    } catch (error) {
      // This will auto-rollback if transaction is active
      await db.query("ROLLBACK").catch(() => { });
      console.error("Task duplication failed:", error);
      throw error;
    }
  }
}