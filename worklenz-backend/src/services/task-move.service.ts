import { PoolClient } from "pg";
import db from "../config/db";
import { IO } from "../shared/io";
import { SocketEvents } from "../socket.io/events";
import { IActivityLogAttributeTypes, IActivityLogChangeType } from "./activity-logs/interfaces";
import { canUserEditTasks } from "../shared/assignee-task-scope";
import { log_error } from "../shared/utils";
import { ServerResponse } from "../models/server-response";
import TasksControllerV2 from "../controllers/tasks-controller-v2";
import { copyObject, getKey, getTaskAttachmentKey } from "../shared/storage";

export interface IMoveTasksOptions {
  move_subtasks: boolean;
  keep_assignees_if_member_exists: boolean;
  keep_labels_by_name: boolean;
}

export interface IMoveTasksMapping {
  status: Record<string, string>;
  phase?: Record<string, string>;
  custom_fields?: Record<string, string>;
}

export interface IMoveTasksPayload {
  task_ids: string[];
  source_project_id: string;
  destination_project_id: string;
  mapping: IMoveTasksMapping;
  options: IMoveTasksOptions;
}

export interface IMoveTasksWarning {
  task_id: string;
  code: string;
  message: string;
}

export interface IMoveTasksResult {
  moved_task_ids: string[];
  unmoved_task_ids: string[];
  warnings: IMoveTasksWarning[];
  destination_refresh_hint: {
    project_id: string;
  };
}

export interface ITaskMoveServiceResponse {
  status: number;
  response: ServerResponse<unknown>;
}

interface IStatusMeta {
  id: string;
  name: string;
  is_done: boolean;
  is_todo: boolean;
}

export class TaskMoveService {
  /** Notify the sender and members of both projects after a move. */
  public static notifyProjectUpdatesForMove(
    socketId: string | null | undefined,
    sourceProjectId: string,
    destinationProjectId: string
  ): void {
    const event = SocketEvents.PROJECT_UPDATES_AVAILABLE.toString();
    if (socketId) IO.getSocketById(socketId)?.emit(event);
    const options = socketId ? { excludeSocketId: socketId } : undefined;
    IO.emitToProjectRoom(sourceProjectId, event, undefined, options);
    IO.emitToProjectRoom(destinationProjectId, event, undefined, options);
  }

  /** Collect selected tasks and, when requested, their descendants in lock order. */
  public static async collectTaskIdsForMove(
    initialTaskIds: string[],
    moveSubtasks: boolean,
    client: PoolClient
  ): Promise<string[]> {
    if (!moveSubtasks) return [...new Set(initialTaskIds)].sort();

    const q = `
      WITH RECURSIVE task_tree AS (
        SELECT id, parent_task_id
        FROM tasks
        WHERE id = ANY($1::UUID[])

        UNION ALL

        SELECT child.id, child.parent_task_id
        FROM tasks child
        INNER JOIN task_tree tt ON child.parent_task_id = tt.id
      )
      SELECT DISTINCT id FROM task_tree;
    `;
    const result = await client.query(q, [initialTaskIds]);
    return result.rows.map((row: { id: string }) => row.id).sort();
  }

  /** Fetch project statuses and their completion categories. */
  public static async fetchProjectStatuses(
    projectId: string,
    client: PoolClient
  ): Promise<Map<string, IStatusMeta>> {
    const result = await client.query(
      `
      SELECT ts.id, ts.name,
             COALESCE(sc.is_done, FALSE) AS is_done,
             COALESCE(sc.is_todo, FALSE) AS is_todo
      FROM task_statuses ts
      LEFT JOIN sys_task_status_categories sc ON ts.category_id = sc.id
      WHERE ts.project_id = $1
      ORDER BY ts.sort_order ASC
      `,
      [projectId]
    );
    return new Map(
      result.rows.map((row: { id: string; name: string; is_done: boolean; is_todo: boolean }) => [
        row.id,
        {
          id: row.id,
          name: row.name,
          is_done: row.is_done,
          is_todo: row.is_todo,
        },
      ])
    );
  }

  /** Fetch phase names indexed by their IDs. */
  public static async fetchProjectPhases(
    projectId: string,
    client: PoolClient
  ): Promise<Map<string, string>> {
    const result = await client.query(
      "SELECT id, name FROM project_phases WHERE project_id = $1",
      [projectId]
    );
    return new Map(
      result.rows.map((row: { id: string; name: string }) => [row.id, row.name])
    );
  }

  /** Fetch custom column IDs indexed by their keys. */
  public static async fetchProjectCustomColumns(
    projectId: string,
    client: PoolClient
  ): Promise<Map<string, string>> {
    const result = await client.query(
      "SELECT id, key FROM cc_custom_columns WHERE project_id = $1",
      [projectId]
    );
    return new Map(
      result.rows.map((row: { id: string; key: string }) => [row.key, row.id])
    );
  }

  /** Move tasks and their supported project-specific metadata in one transaction. */
  public static async moveTasksToProject(
    payload: IMoveTasksPayload,
    user: any
  ): Promise<ITaskMoveServiceResponse> {
    const {
      task_ids: inputTaskIds,
      source_project_id: sourceProjectId,
      destination_project_id: destinationProjectId,
      mapping,
      options,
    } = payload;

    if (sourceProjectId === destinationProjectId) {
      return {
        status: 400,
        response: new ServerResponse(false, null, "Source and destination projects cannot be the same"),
      };
    }

    let taskIds: string[] = [];
    const warnings: IMoveTasksWarning[] = [];
    const movedTaskIds: string[] = [];
    const unmovedTaskIds: string[] = [];

    const client = await db.connect();
    try {
      await client.query("BEGIN");

      taskIds = await this.collectTaskIdsForMove(inputTaskIds, !!options?.move_subtasks, client);

      const workspaceProjects = await client.query(
        "SELECT id FROM projects WHERE id = ANY($1::UUID[]) AND team_id = $2",
        [[sourceProjectId, destinationProjectId], user?.team_id]
      );
      if (workspaceProjects.rowCount !== 2) {
        await client.query("ROLLBACK");
        return {
          status: 403,
          response: new ServerResponse(false, null, "Projects must belong to the current workspace"),
        };
      }

      const restriction = await client.query(
        "SELECT is_task_creation_restricted($1, $2) OR is_task_creation_restricted($1, $3) AS restricted",
        [user?.id, sourceProjectId, destinationProjectId]
      );
      if (restriction.rows[0]?.restricted === true) {
        await client.query("ROLLBACK");
        return {
          status: 403,
          response: new ServerResponse(false, null, "Task creation is restricted for one of these projects"),
        };
      }

      // Enforce deterministic row locking to prevent deadlocks under concurrent operations
      const taskRowsResult = await client.query(
        `
          SELECT id, project_id, status_id, completed_at
          FROM tasks
          WHERE id = ANY($1::UUID[])
          ORDER BY id
          FOR UPDATE
        `,
        [taskIds]
      );

      const taskRows = taskRowsResult.rows as Array<{
        id: string;
        project_id: string;
        status_id: string | null;
        completed_at: string | null;
      }>;

      const foundTaskIds = new Set(taskRows.map(task => task.id));
      const missingTaskIds = inputTaskIds.filter(id => !foundTaskIds.has(id));
      if (missingTaskIds.length > 0) {
        await client.query("ROLLBACK");
        return {
          status: 404,
          response: new ServerResponse(false, { missing_task_ids: missingTaskIds }, "Some tasks were not found"),
        };
      }

      const outsideSource = taskRows.filter(task => task.project_id !== sourceProjectId);
      if (outsideSource.length > 0) {
        await client.query("ROLLBACK");
        return {
          status: 400,
          response: new ServerResponse(
            false,
            { invalid_task_ids: outsideSource.map(task => task.id) },
            "Some tasks do not belong to source project"
          ),
        };
      }

      // Single-query batch check for edit permissions
      const canEdit = await canUserEditTasks(user?.id, taskIds, user, client);
      if (!canEdit) {
        await client.query("ROLLBACK");
        return {
          status: 403,
          response: new ServerResponse(false, null, "You cannot move one or more selected tasks"),
        };
      }

      if (!options?.move_subtasks) {
        const hasSubtasksResult = await client.query(
          `
            SELECT DISTINCT parent_task_id
            FROM tasks
            WHERE parent_task_id = ANY($1::UUID[])
          `,
          [taskIds]
        );
        if (hasSubtasksResult.rowCount && hasSubtasksResult.rowCount > 0) {
          await client.query("ROLLBACK");
          return {
            status: 400,
            response: new ServerResponse(
              false,
              null,
              "One or more selected tasks have subtasks. Enable move_subtasks to continue."
            ),
          };
        }
      }

      const sourceStatuses = await this.fetchProjectStatuses(sourceProjectId, client);
      const destinationStatuses = await this.fetchProjectStatuses(destinationProjectId, client);

      const projectNamesResult = await client.query(
        `
          SELECT id, name
          FROM projects
          WHERE id = ANY($1::UUID[])
        `,
        [[sourceProjectId, destinationProjectId]]
      );
      const projectNameById = new Map(
        projectNamesResult.rows.map((row: { id: string; name: string }) => [row.id, row.name])
      );
      const sourceProjectName = projectNameById.get(sourceProjectId) || sourceProjectId;
      const destinationProjectName = projectNameById.get(destinationProjectId) || destinationProjectId;

      // Status resolution with fallback support for unmapped subtask statuses
      const normalizeToken = (value: string) => value.trim().toLowerCase().replace(/\s+/g, "_");
      const destStatusByNormalizedName = new Map<string, IStatusMeta>();
      let defaultTodoStatus: IStatusMeta | undefined;

      destinationStatuses.forEach(st => {
        if (!defaultTodoStatus && st.is_todo) defaultTodoStatus = st;
        destStatusByNormalizedName.set(normalizeToken(st.name), st);
      });
      if (!defaultTodoStatus && destinationStatuses.size > 0) {
        defaultTodoStatus = destinationStatuses.values().next().value;
      }

      const resolvedStatusMap = new Map<string, IStatusMeta>();
      const usedStatusIds = [...new Set(taskRows.map(task => task.status_id).filter(Boolean) as string[])];

      for (const statusId of usedStatusIds) {
        const mappedStatusId = mapping?.status?.[statusId];
        if (mappedStatusId && destinationStatuses.has(mappedStatusId)) {
          resolvedStatusMap.set(statusId, destinationStatuses.get(mappedStatusId)!);
          continue;
        }

        // Subtask status fallback: match by normalized name
        const sourceMeta = sourceStatuses.get(statusId);
        const nameMatch = sourceMeta ? destStatusByNormalizedName.get(normalizeToken(sourceMeta.name)) : undefined;
        if (nameMatch) {
          resolvedStatusMap.set(statusId, nameMatch);
          continue;
        }

        // Subtask status fallback: use default To Do status
        if (defaultTodoStatus) {
          resolvedStatusMap.set(statusId, defaultTodoStatus);
          for (const task of taskRows.filter(row => row.status_id === statusId)) {
            warnings.push({
              task_id: task.id,
              code: "STATUS_FALLBACK",
              message: `Status "${sourceMeta?.name || statusId}" was mapped to "${defaultTodoStatus.name}" by default`,
            });
          }
          continue;
        }

        await client.query("ROLLBACK");
        return {
          status: 400,
          response: new ServerResponse(
            false,
            { status_id: statusId },
            `Missing or invalid status mapping for ${sourceMeta?.name || statusId}`
          ),
        };
      }

      const phaseRowsResult = await client.query(
        "SELECT task_id, phase_id FROM task_phase WHERE task_id = ANY($1::UUID[])",
        [taskIds]
      );
      const phaseRows = phaseRowsResult.rows as Array<{ task_id: string; phase_id: string }>;
      const sourcePhases = await this.fetchProjectPhases(sourceProjectId, client);
      const destinationPhases = await this.fetchProjectPhases(destinationProjectId, client);
      const destinationPhaseIdByNormalizedName = new Map<string, string>();
      destinationPhases.forEach((phaseName, phaseId) => {
        if (phaseName) destinationPhaseIdByNormalizedName.set(normalizeToken(phaseName), phaseId);
      });

      const sourceColumnResult = await client.query(
        `
          SELECT DISTINCT cc.key
          FROM cc_column_values ccv
          INNER JOIN cc_custom_columns cc ON cc.id = ccv.column_id
          WHERE ccv.task_id = ANY($1::UUID[])
            AND cc.project_id = $2
        `,
        [taskIds, sourceProjectId]
      );
      const sourceColumnKeys = sourceColumnResult.rows.map((row: { key: string }) => row.key);
      const destinationColumns = await this.fetchProjectCustomColumns(destinationProjectId, client);

      const destinationMaxSortResult = await client.query(
        "SELECT COALESCE(MAX(sort_order), 0) AS max_sort FROM tasks WHERE project_id = $1",
        [destinationProjectId]
      );
      let nextSortOrder = Number(destinationMaxSortResult.rows[0]?.max_sort || 0) + 1;

      // Reserve destination task numbers atomically to avoid duplicate task keys
      const counter = await client.query(
        "UPDATE projects SET tasks_counter = tasks_counter + $2 WHERE id = $1 RETURNING tasks_counter",
        [destinationProjectId, taskRows.length]
      );
      let nextTaskNo = Number(counter.rows[0].tasks_counter) - taskRows.length + 1;

      // Remove cross-project dependencies where only one task moves
      const removedDeps = await client.query(
        `
          DELETE FROM task_dependencies td
          WHERE (td.task_id = ANY($1::UUID[]) AND NOT (td.related_task_id = ANY($1::UUID[])))
             OR (td.related_task_id = ANY($1::UUID[]) AND NOT (td.task_id = ANY($1::UUID[])))
          RETURNING td.task_id, td.related_task_id
        `,
        [taskIds]
      );
      for (const row of removedDeps.rows as Array<{ task_id: string; related_task_id: string }>) {
        warnings.push({
          task_id: row.task_id,
          code: "DEPENDENCY_REMOVED",
          message: "Cross-project dependency was removed because tasks are in different projects",
        });
      }

      // Copy first: old keys remain valid if the transaction rolls back or clients retain URLs.
      const attachments = await client.query(
        "SELECT id, team_id, project_id, type FROM task_attachments WHERE task_id = ANY($1::UUID[]) FOR UPDATE",
        [taskIds]
      );
      for (const attachment of attachments.rows as Array<{ id: string; team_id: string; project_id: string; type: string }>) {
        const sourceKey = getKey(attachment.team_id, attachment.project_id, attachment.id, attachment.type);
        const destinationKey = getKey(attachment.team_id, destinationProjectId, attachment.id, attachment.type);
        if (sourceKey !== destinationKey && !(await copyObject(sourceKey, destinationKey))) {
          throw new Error(`Failed to copy task attachment ${attachment.id}`);
        }
      }
      const commentAttachments = await client.query(
        "SELECT id, team_id, project_id, task_id, comment_id, type FROM task_comment_attachments WHERE task_id = ANY($1::UUID[]) FOR UPDATE",
        [taskIds]
      );
      for (const attachment of commentAttachments.rows as Array<{ id: string; team_id: string; project_id: string; task_id: string; comment_id: string; type: string }>) {
        const sourceKey = getTaskAttachmentKey(attachment.team_id, attachment.project_id, attachment.task_id, attachment.comment_id, attachment.id, attachment.type);
        const destinationKey = getTaskAttachmentKey(attachment.team_id, destinationProjectId, attachment.task_id, attachment.comment_id, attachment.id, attachment.type);
        if (sourceKey !== destinationKey && !(await copyObject(sourceKey, destinationKey))) {
          throw new Error(`Failed to copy comment attachment ${attachment.id}`);
        }
      }
      await client.query("UPDATE task_attachments SET project_id = $2 WHERE task_id = ANY($1::UUID[])", [taskIds, destinationProjectId]);
      await client.query("UPDATE task_comment_attachments SET project_id = $2 WHERE task_id = ANY($1::UUID[])", [taskIds, destinationProjectId]);

      // Update tasks in deterministic batches with done and completed_at properly synchronized
      for (const task of taskRows) {
        const destStatus = resolvedStatusMap.get(task.status_id as string) || defaultTodoStatus;
        const destStatusId = destStatus?.id || mapping.status[task.status_id as string];
        const isDone = destStatus?.is_done ?? false;

        await client.query(
          `
            UPDATE tasks
            SET project_id = $2,
                status_id = $3,
                task_no = $6,
                sort_order = $4,
                done = $7,
                completed_at = CASE 
                  WHEN $7::BOOLEAN THEN COALESCE(completed_at, CURRENT_TIMESTAMP)
                  ELSE NULL 
                END,
                status_sort_order = 0,
                priority_sort_order = 0,
                phase_sort_order = 0,
                member_sort_order = 0,
                parent_task_id = CASE WHEN parent_task_id = ANY($5::UUID[]) THEN parent_task_id ELSE NULL END,
                epic_id = CASE WHEN epic_id = ANY($5::UUID[]) THEN epic_id ELSE NULL END
            WHERE id = $1
          `,
          [task.id, destinationProjectId, destStatusId, nextSortOrder++, taskIds, nextTaskNo++, isDone]
        );
      }

      await client.query(
        "UPDATE tasks SET epic_id = NULL WHERE epic_id = ANY($1::UUID[]) AND NOT (id = ANY($1::UUID[]))",
        [taskIds]
      );

      // Phase handling
      if (phaseRows.length > 0) {
        await client.query("DELETE FROM task_phase WHERE task_id = ANY($1::UUID[])", [taskIds]);
        for (const row of phaseRows) {
          const sourcePhaseName = sourcePhases.get(row.phase_id);
          const normalizedSourcePhaseName = sourcePhaseName ? normalizeToken(sourcePhaseName) : undefined;
          const mappedPhaseId =
            mapping.phase?.[row.phase_id] ||
            (sourcePhaseName ? mapping.phase?.[sourcePhaseName] : undefined) ||
            (normalizedSourcePhaseName ? mapping.phase?.[normalizedSourcePhaseName] : undefined) ||
            (normalizedSourcePhaseName ? destinationPhaseIdByNormalizedName.get(normalizedSourcePhaseName) : undefined);

          if (!mappedPhaseId) {
            warnings.push({
              task_id: row.task_id,
              code: "PHASE_SKIPPED",
              message: `Phase "${sourcePhaseName || row.phase_id}" was skipped because no mapping was provided`,
            });
            continue;
          }
          if (!destinationPhases.has(mappedPhaseId)) {
            warnings.push({
              task_id: row.task_id,
              code: "PHASE_SKIPPED",
              message: `Phase "${sourcePhaseName || row.phase_id}" was skipped because destination phase is unavailable`,
            });
            continue;
          }
          await client.query("INSERT INTO task_phase (task_id, phase_id) VALUES ($1, $2)", [row.task_id, mappedPhaseId]);
        }
      }

      // Custom fields handling
      if (sourceColumnKeys.length > 0) {
        const existingValues = await client.query(
          `
            SELECT ccv.task_id, cc.key, ccv.text_value, ccv.number_value, ccv.date_value, ccv.boolean_value, ccv.json_value
            FROM cc_column_values ccv
            INNER JOIN cc_custom_columns cc ON cc.id = ccv.column_id
            WHERE ccv.task_id = ANY($1::UUID[])
              AND cc.project_id = $2
          `,
          [taskIds, sourceProjectId]
        );

        await client.query("DELETE FROM cc_column_values WHERE task_id = ANY($1::UUID[])", [taskIds]);

        for (const row of existingValues.rows) {
          const mappedSourceKey = mapping.custom_fields?.[row.key];
          if (!mappedSourceKey) {
            warnings.push({
              task_id: row.task_id,
              code: "CUSTOM_FIELD_SKIPPED",
              message: `Custom field "${row.key}" was skipped because no mapping was provided`,
            });
            continue;
          }
          const destinationColumnId = destinationColumns.get(mappedSourceKey);
          if (!destinationColumnId) {
            warnings.push({
              task_id: row.task_id,
              code: "CUSTOM_FIELD_SKIPPED",
              message: `Custom field "${row.key}" was skipped because destination field is unavailable`,
            });
            continue;
          }
          await client.query(
            `
              INSERT INTO cc_column_values
                (task_id, column_id, text_value, number_value, date_value, boolean_value, json_value)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
              ON CONFLICT (task_id, column_id) DO UPDATE
              SET text_value = EXCLUDED.text_value,
                  number_value = EXCLUDED.number_value,
                  date_value = EXCLUDED.date_value,
                  boolean_value = EXCLUDED.boolean_value,
                  json_value = EXCLUDED.json_value
            `,
            [
              row.task_id,
              destinationColumnId,
              row.text_value,
              row.number_value,
              row.date_value,
              row.boolean_value,
              row.json_value,
            ]
          );
        }
      }

      // Labels handling
      if (!options?.keep_labels_by_name) {
        await client.query("DELETE FROM task_labels WHERE task_id = ANY($1::UUID[])", [taskIds]);
      }

      // Assignees handling
      if (options?.keep_assignees_if_member_exists) {
        const deleteResult = await client.query(
          `
            DELETE FROM tasks_assignees ta
            WHERE ta.task_id = ANY($1::UUID[])
              AND NOT EXISTS (
                SELECT 1
                FROM project_members pm
                WHERE pm.project_id = $2
                  AND pm.team_member_id = ta.team_member_id
              )
            RETURNING ta.task_id
          `,
          [taskIds, destinationProjectId]
        );

        for (const removedRow of deleteResult.rows as Array<{ task_id: string }>) {
          warnings.push({
            task_id: removedRow.task_id,
            code: "ASSIGNEE_REMOVED",
            message: "One or more assignees were removed because they are not members of destination project",
          });
        }

        await client.query(
          `
            UPDATE tasks_assignees ta
            SET project_member_id = pm.id
            FROM project_members pm
            WHERE ta.task_id = ANY($1::UUID[])
              AND pm.project_id = $2
              AND pm.team_member_id = ta.team_member_id
          `,
          [taskIds, destinationProjectId]
        );
      } else {
        await client.query("DELETE FROM tasks_assignees WHERE task_id = ANY($1::UUID[])", [taskIds]);
      }

      // Activity logs
      for (const taskId of taskIds) {
        await client.query(
          `INSERT INTO task_activity_logs (task_id, team_id, project_id, user_id, log_type, attribute_type, old_value, new_value, next_string)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            taskId,
            user?.team_id,
            destinationProjectId,
            user?.id,
            IActivityLogChangeType.UPDATE,
            IActivityLogAttributeTypes.PROJECT,
            sourceProjectName,
            destinationProjectName,
            "task moved between projects",
          ]
        );
      }

      movedTaskIds.push(...taskIds);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      log_error("moveTasksToProject failed", error);
      console.error(
        JSON.stringify({
          event: "task_move_project_failed",
          source_project_id: sourceProjectId,
          destination_project_id: destinationProjectId,
          task_ids: taskIds,
          error: error instanceof Error ? error.message : String(error),
        })
      );
      throw error;
    } finally {
      client.release();
    }

    // Post-commit: recalculate project progress in background
    Promise.allSettled([
      TasksControllerV2.refreshProjectTaskProgressValues(sourceProjectId),
      TasksControllerV2.refreshProjectTaskProgressValues(destinationProjectId),
    ]).catch(err => log_error("refreshProjectTaskProgressValues after move failed", err));

    // Post-commit: emit real-time updates to all project members
    this.notifyProjectUpdatesForMove(user?.socket_id, sourceProjectId, destinationProjectId);

    return {
      status: 200,
      response: new ServerResponse(true, {
        moved_task_ids: movedTaskIds,
        unmoved_task_ids: unmovedTaskIds,
        warnings,
        destination_refresh_hint: {
          project_id: destinationProjectId,
        },
      }),
    };
  }
}

export default TaskMoveService;
