import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import db from "../config/db";
import { ServerResponse } from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import { copyObject, getKey } from "../shared/storage";
import { NON_GUEST_ACCESS_JOIN, NON_GUEST_ACCESS_PREDICATE } from "../shared/guest-access-sql";
import { PoolClient } from "pg";

interface DuplicateOptions {
  dates?: boolean;
  assignees?: boolean;
  dependencies?: boolean;
  labels?: boolean;
  attachments?: boolean;
  comments?: boolean;
  customFields?: boolean;
  subscribers?: boolean;
  subtasks?: boolean;
}

interface MissingPhaseRow {
  id: string;
  name: string;
  color_code: string;
  sort_index: number;
}

interface StatusMappingInfo {
  isMissing: boolean;
  sourceStatusName: string | null;
  sourceCategoryName: string | null;
  destinationStatusName: string | null;
  destinationCategoryName: string | null;
}

interface Queryable {
  query: (text: string, params?: any[]) => Promise<{ rows: any[] }>;
}

export default class TaskDuplicateController extends WorklenzControllerBase {
  private static readonly MISSING_PHASES_QUERY = `
    WITH RECURSIVE task_tree AS (
      SELECT id
      FROM tasks
      WHERE id = $1
        AND archived IS NOT TRUE
      UNION ALL
      SELECT child.id
      FROM tasks child
      INNER JOIN task_tree parent ON child.parent_task_id = parent.id
      WHERE child.archived IS NOT TRUE
    )
    SELECT DISTINCT
      source_phases.id,
      source_phases.name,
      source_phases.color_code,
      source_phases.sort_index
    FROM task_tree tt
    INNER JOIN task_phase tp ON tp.task_id = tt.id
    INNER JOIN project_phases source_phases
      ON source_phases.id = tp.phase_id
     AND source_phases.project_id = $2
    LEFT JOIN project_phases destination_phases
      ON destination_phases.project_id = $3
     AND LOWER(TRIM(destination_phases.name)) = LOWER(TRIM(source_phases.name))
    WHERE destination_phases.id IS NULL
    ORDER BY source_phases.sort_index ASC, source_phases.name ASC
  `;

  private static async getMissingPhasesForTaskCopy(
    taskId: string,
    sourceProjectId: string,
    destinationProjectId: string,
    client: Queryable = db,
  ): Promise<MissingPhaseRow[]> {
    const result = await client.query(
      this.MISSING_PHASES_QUERY,
      [taskId, sourceProjectId, destinationProjectId]
    );
    return result.rows as MissingPhaseRow[];
  }

  private static async createMissingPhasesInDestination(
    client: PoolClient,
    destinationProjectId: string,
    missingPhases: MissingPhaseRow[],
  ): Promise<void> {
    for (const phase of missingPhases) {
      await client.query(
        `INSERT INTO project_phases (name, color_code, project_id, sort_index)
         SELECT $1, $2, $3,
                COALESCE((SELECT MAX(sort_index) FROM project_phases WHERE project_id = $3), 0) + 1
         WHERE NOT EXISTS (
           SELECT 1
           FROM project_phases
           WHERE project_id = $3
             AND LOWER(TRIM(name)) = LOWER(TRIM($1))
         )`,
        [phase.name, phase.color_code, destinationProjectId]
      );
    }
  }

  private static async getStatusMappingForTaskCopy(
    taskId: string,
    sourceProjectId: string,
    destinationProjectId: string,
    client: Queryable = db,
  ): Promise<StatusMappingInfo> {
    const result = await client.query(
      `WITH source_status AS (
         SELECT ts.id, ts.name, ts.category_id, stsc.name AS category_name
         FROM tasks t
         INNER JOIN task_statuses ts ON ts.id = t.status_id
         INNER JOIN sys_task_status_categories stsc ON stsc.id = ts.category_id
         WHERE t.id = $1
           AND t.project_id = $2
       ),
       exact_match AS (
         SELECT EXISTS (
           SELECT 1
           FROM task_statuses destination_statuses
           CROSS JOIN source_status
           WHERE destination_statuses.project_id = $3
             AND LOWER(TRIM(destination_statuses.name)) = LOWER(TRIM(source_status.name))
         ) AS exists
       ),
       mapped_status AS (
         SELECT get_mapped_status_id(
           (SELECT id FROM source_status),
           $2,
           $3
         ) AS id
       ),
       destination_status AS (
         SELECT ts.id, ts.name, stsc.name AS category_name
         FROM task_statuses ts
         INNER JOIN sys_task_status_categories stsc ON stsc.id = ts.category_id
         WHERE ts.id = (SELECT id FROM mapped_status)
       )
       SELECT
         (SELECT name FROM source_status) AS source_status_name,
         (SELECT category_name FROM source_status) AS source_category_name,
         (SELECT name FROM destination_status) AS destination_status_name,
         (SELECT category_name FROM destination_status) AS destination_category_name,
         NOT COALESCE((SELECT exists FROM exact_match), FALSE) AS is_missing`,
      [taskId, sourceProjectId, destinationProjectId]
    );

    const row = result.rows[0];
    return {
      isMissing: Boolean(row?.is_missing),
      sourceStatusName: row?.source_status_name ?? null,
      sourceCategoryName: row?.source_category_name ?? null,
      destinationStatusName: row?.destination_status_name ?? null,
      destinationCategoryName: row?.destination_category_name ?? null,
    };
  }

  @HandleExceptions()
  public static async compare(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { task_id: taskId, project_id: projectId, destination_project_id: destinationProjectId } = req.body;
    if (!taskId || !projectId || !destinationProjectId) {
      return res.status(400).send(new ServerResponse(false, null, "Task and source/destination projects are required"));
    }

    const access = await db.query(
      `SELECT 1 FROM tasks t
       INNER JOIN projects source_project ON source_project.id = t.project_id
      INNER JOIN projects p ON p.id = $3
       ${NON_GUEST_ACCESS_JOIN('$2')}
       WHERE t.id = $1 AND t.project_id = $4
         AND p.team_id = $5
         AND ${NON_GUEST_ACCESS_PREDICATE}
       LIMIT 1`,
      [taskId, req.user?.id, destinationProjectId, projectId, req.user?.team_id]
    );
    if (!access.rowCount) {
      return res.status(403).send(new ServerResponse(false, null, "You do not have permission to compare these projects"));
    }

    const [defaultColumns, customColumns, missingPhases, statusMapping] = await Promise.all([
      db.query(
        `SELECT source_columns.name, source_columns.key, source_columns.index,
                source_columns.pinned, source_columns.custom_column, source_columns.custom_column_obj
         FROM project_task_list_cols source_columns
         LEFT JOIN project_task_list_cols destination_columns
           ON destination_columns.project_id = $2 AND destination_columns.key = source_columns.key
         WHERE source_columns.project_id = $1 AND destination_columns.id IS NULL
         ORDER BY source_columns.index ASC`,
        [projectId, destinationProjectId]
      ),
      db.query(
        `SELECT source_columns.name, source_columns.key, source_columns.field_type,
                source_columns.width, source_columns.is_visible
         FROM cc_custom_columns source_columns
         LEFT JOIN cc_custom_columns destination_columns
           ON destination_columns.project_id = $2 AND destination_columns.key = source_columns.key
         WHERE source_columns.project_id = $1 AND destination_columns.id IS NULL
         ORDER BY source_columns.created_at ASC, source_columns.key ASC`,
        [projectId, destinationProjectId]
      ),
      this.getMissingPhasesForTaskCopy(taskId, projectId, destinationProjectId),
      this.getStatusMappingForTaskCopy(taskId, projectId, destinationProjectId),
    ]);

    return res.status(200).send(new ServerResponse(true, {
      missingDefaultColumns: defaultColumns.rows,
      missingCustomColumns: customColumns.rows,
      missingPhases,
      statusMapping,
      hasDifferences:
        defaultColumns.rows.length > 0 ||
        customColumns.rows.length > 0 ||
        missingPhases.length > 0 ||
        statusMapping.isMissing,
    }));
  }

  /**
   * Helper function to copy attachment files from original task to duplicated task
   */
  private static async copyAttachmentFiles(
    originalTaskId: string,
    newTaskId: string,
    destinationProjectId?: string,
    client?: PoolClient,
  ): Promise<void> {
    const query = client?.query.bind(client) || db.query;
    // Fetch original attachments with their IDs
    const originalAttachments = await query(
      `SELECT id, name, size, type, team_id, project_id, uploaded_by
      FROM task_attachments
      WHERE task_id = $1`,
      [originalTaskId]
    );

    // Get new attachments that were just created (they should match by name, size, type, and order)
    const newAttachments = await query(
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
          destinationProjectId || matchingNewAttachment.project_id,
          matchingNewAttachment.id,
          matchingNewAttachment.type
        );

        // Copy the file in storage (S3/Azure)
        await copyObject(sourceKey, destinationKey);
      }
    }
  }

  /**
   * duplicate_task_shallow copies a task's assignees, custom-field values, phase
   * assignment and dependency edges verbatim - i.e. still pointing at the *source*
   * project's project_members / cc_custom_columns / project_phases / tasks. For a
   * cross-project copy the caller must remap those references for the whole copied
   * subtree (root task + every descendant). Safe to run on an already-correct tree:
   * every statement is a no-op when the rows already belong to the destination.
   */
  private static async remapCopiedSubtreeRelations(
    client: PoolClient,
    rootTaskId: string,
    destinationProjectId: string,
  ): Promise<void> {
    const subtreeCte = `WITH RECURSIVE copied_tasks AS (
        SELECT $1::uuid AS id
        UNION ALL
        SELECT child.id
        FROM tasks child
        INNER JOIN copied_tasks parent ON child.parent_task_id = parent.id
      )`;

    // Assignees: remap project_member_id to the destination project's membership
    // for the same team member, then drop assignees who are not members there.
    await client.query(
      `${subtreeCte}
       UPDATE tasks_assignees ta
       SET project_member_id = dest_pm.id
       FROM project_members dest_pm
       WHERE ta.task_id IN (SELECT id FROM copied_tasks)
         AND dest_pm.project_id = $2
         AND dest_pm.team_member_id = ta.team_member_id
         AND dest_pm.id <> ta.project_member_id`,
      [rootTaskId, destinationProjectId]
    );
    await client.query(
      `${subtreeCte}
       DELETE FROM tasks_assignees ta
       WHERE ta.task_id IN (SELECT id FROM copied_tasks)
         AND NOT EXISTS (
           SELECT 1 FROM project_members dest_pm
           WHERE dest_pm.project_id = $2
             AND dest_pm.team_member_id = ta.team_member_id
         )`,
      [rootTaskId, destinationProjectId]
    );

    // Custom-field values: remap column_id to the destination column with the same
    // key, then drop values whose column has no counterpart in the destination.
    await client.query(
      `${subtreeCte}
       UPDATE cc_column_values v
       SET column_id = dest_col.id
       FROM cc_custom_columns src_col
       INNER JOIN cc_custom_columns dest_col
         ON dest_col.project_id = $2
        AND dest_col.key = src_col.key
       WHERE v.task_id IN (SELECT id FROM copied_tasks)
         AND v.column_id = src_col.id
         AND src_col.project_id <> $2`,
      [rootTaskId, destinationProjectId]
    );
    await client.query(
      `${subtreeCte}
       DELETE FROM cc_column_values v
       WHERE v.task_id IN (SELECT id FROM copied_tasks)
         AND NOT EXISTS (
           SELECT 1 FROM cc_custom_columns dest_col
           WHERE dest_col.id = v.column_id
             AND dest_col.project_id = $2
         )`,
      [rootTaskId, destinationProjectId]
    );

    // Phase: remap to the destination phase with the same name, drop otherwise.
    await client.query(
      `${subtreeCte}
       UPDATE task_phase tp
       SET phase_id = dest_phase.id
       FROM project_phases src_phase
       INNER JOIN project_phases dest_phase
         ON dest_phase.project_id = $2
        AND LOWER(TRIM(dest_phase.name)) = LOWER(TRIM(src_phase.name))
       WHERE tp.task_id IN (SELECT id FROM copied_tasks)
         AND tp.phase_id = src_phase.id
         AND src_phase.project_id <> $2`,
      [rootTaskId, destinationProjectId]
    );
    await client.query(
      `${subtreeCte}
       DELETE FROM task_phase tp
       WHERE tp.task_id IN (SELECT id FROM copied_tasks)
         AND NOT EXISTS (
           SELECT 1 FROM project_phases dest_phase
           WHERE dest_phase.id = tp.phase_id
             AND dest_phase.project_id = $2
         )`,
      [rootTaskId, destinationProjectId]
    );

    // Dependency edges: duplicate_task_shallow copies them pointing at the source
    // tasks. Cross-project dependency copying is only wired for the top-level task
    // (copyTaskWithDependencies); drop any subtree edge that still crosses projects.
    await client.query(
      `${subtreeCte}
       DELETE FROM task_dependencies td
       WHERE td.task_id IN (SELECT id FROM copied_tasks)
         AND EXISTS (
           SELECT 1 FROM tasks related
           WHERE related.id = td.related_task_id
             AND related.project_id <> $2
         )`,
      [rootTaskId, destinationProjectId]
    );
  }

  private static async copyAttachmentTree(
    originalTaskId: string,
    newTaskId: string,
    destinationProjectId: string,
    client: PoolClient,
  ): Promise<void> {
    await this.copyAttachmentFiles(originalTaskId, newTaskId, destinationProjectId, client);

    const [originalChildren, newChildren] = await Promise.all([
      client.query(
        `SELECT id FROM tasks WHERE parent_task_id = $1 AND archived = false ORDER BY sort_order`,
        [originalTaskId]
      ),
      client.query(
        `SELECT id FROM tasks WHERE parent_task_id = $1 AND archived = false ORDER BY sort_order`,
        [newTaskId]
      ),
    ]);

    for (let index = 0; index < originalChildren.rows.length; index += 1) {
      const newChild = newChildren.rows[index];
      if (!newChild) break;

      await this.copyAttachmentTree(
        originalChildren.rows[index].id,
        newChild.id,
        destinationProjectId,
        client,
      );
    }
  }

  private static async collectAttachmentTreeCopyTasks(
    originalTaskId: string,
    newTaskId: string,
    destinationProjectId: string,
    client: PoolClient,
    copyTasks: Array<{ sourceKey: string; destinationKey: string }>,
  ): Promise<void> {
    // Collect attachment copy tasks for this level
    const originalAttachments = await client.query(
      `SELECT id, name, size, type, team_id, project_id
      FROM task_attachments
      WHERE task_id = $1`,
      [originalTaskId]
    );

    const newAttachments = await client.query(
      `SELECT id, name, size, type, team_id, project_id
      FROM task_attachments
      WHERE task_id = $1
      ORDER BY created_at ASC`,
      [newTaskId]
    );

    // Match and collect file copy tasks
    for (const originalAttachment of originalAttachments.rows) {
      const matchingNewAttachment = newAttachments.rows.find(
        (newAtt) =>
          newAtt.name === originalAttachment.name &&
          newAtt.size === originalAttachment.size &&
          newAtt.type === originalAttachment.type
      );

      if (matchingNewAttachment) {
        const sourceKey = getKey(
          originalAttachment.team_id,
          originalAttachment.project_id,
          originalAttachment.id,
          originalAttachment.type
        );
        const destinationKey = getKey(
          matchingNewAttachment.team_id,
          destinationProjectId,
          matchingNewAttachment.id,
          matchingNewAttachment.type
        );

        copyTasks.push({ sourceKey, destinationKey });
      }
    }

    // Recursively collect from children
    const [originalChildren, newChildren] = await Promise.all([
      client.query(
        `SELECT id FROM tasks WHERE parent_task_id = $1 AND archived = false ORDER BY sort_order`,
        [originalTaskId]
      ),
      client.query(
        `SELECT id FROM tasks WHERE parent_task_id = $1 AND archived = false ORDER BY sort_order`,
        [newTaskId]
      ),
    ]);

    for (let index = 0; index < originalChildren.rows.length; index += 1) {
      const newChild = newChildren.rows[index];
      if (!newChild) break;

      await this.collectAttachmentTreeCopyTasks(
        originalChildren.rows[index].id,
        newChild.id,
        destinationProjectId,
        client,
        copyTasks,
      );
    }
  }

  @HandleExceptions()
  public static async duplicate(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const {
      task_id: taskId,
      project_id: projectId,
      destination_project_id: destinationProjectId,
      confirm_project_differences: confirmProjectDifferences,
      options = {},
    } = req.body as {
      task_id: string;
      project_id: string;
      destination_project_id?: string;
      confirm_project_differences?: boolean;
      options?: {
        subtasks?: boolean;
        attachments?: boolean;
        dates?: boolean;
        dependencies?: boolean;
        assignees?: boolean;
        labels?: boolean;
        customFields?: boolean;
        subscribers?: boolean;
        comments?: boolean;
        // copyNamePrefix?: string;
      };
    };

    const {
      subtasks = true,
      attachments = false,
      dates = false,
      dependencies = false,
      assignees = false,
      labels = false,
      customFields = false,
      subscribers = false,
      comments = false,
      // copyNamePrefix = "Copy - ",
    } = options;

    const client = await db.pool.connect();
    try {
      // Start transaction
      await client.query("BEGIN");

      const effectiveDestinationProjectId = destinationProjectId || projectId;

      // 1. Fetch original task
      const { rows } = await client.query(
        `SELECT * FROM tasks WHERE id = $1 AND project_id = $2`,
        [taskId, projectId]
      );

      const originalTask = rows[0];
      if (!originalTask) {
        await client.query("ROLLBACK");
        return res.status(404).send(new ServerResponse(false, null, "Task not found"));
      }

      // Check if task is a subtask - subtasks cannot be copied to *other* projects.
      // Same-project subtask duplication remains supported.
      const isCrossProjectCopy = !!destinationProjectId && destinationProjectId !== projectId;
      if (originalTask.parent_task_id && isCrossProjectCopy) {
        await client.query("ROLLBACK");
        return res.status(403).send(new ServerResponse(false, null, "Subtasks cannot be copied to other projects. Please copy the main task instead."));
      }

      // 2. Verify that the destination is in the active team and that the user
      // has non-guest access before any copied data is created.
      const destinationAccessResult = await client.query(
        `SELECT 1
         FROM projects p
         ${NON_GUEST_ACCESS_JOIN('$2')}
         WHERE p.id = $1
           AND p.team_id = $3
           AND ${NON_GUEST_ACCESS_PREDICATE}
         LIMIT 1`,
        [effectiveDestinationProjectId, req.user?.id, req.user?.team_id]
      );

      if (!destinationAccessResult.rowCount) {
        await client.query("ROLLBACK");
        return res.status(403).send(
          new ServerResponse(false, null, "You do not have permission to copy tasks to this project")
        );
      }

      const missingDestinationColumnsResult = await client.query(
        `SELECT source_columns.name,
                source_columns.key,
                source_columns.index,
                source_columns.pinned,
                source_columns.custom_column,
                source_columns.custom_column_obj
         FROM project_task_list_cols source_columns
         LEFT JOIN project_task_list_cols destination_columns
           ON destination_columns.project_id = $2
          AND destination_columns.key = source_columns.key
         WHERE source_columns.project_id = $1
           AND destination_columns.id IS NULL
         ORDER BY source_columns.index ASC`,
        [projectId, effectiveDestinationProjectId]
      );

      const missingCustomColumnsResult = await client.query(
        `SELECT source_columns.id, source_columns.name, source_columns.key,
                source_columns.field_type, source_columns.width, source_columns.is_visible,
                config.field_title, config.number_type, config.decimals, config.label,
                config.label_position, config.preview_value, config.expression,
                config.first_numeric_column_key, config.second_numeric_column_key
         FROM cc_custom_columns source_columns
         LEFT JOIN cc_custom_columns destination_columns
           ON destination_columns.project_id = $2
          AND destination_columns.key = source_columns.key
         LEFT JOIN cc_column_configurations config ON config.column_id = source_columns.id
         WHERE source_columns.project_id = $1
           AND destination_columns.id IS NULL
         ORDER BY source_columns.created_at ASC, source_columns.key ASC`,
        [projectId, effectiveDestinationProjectId]
      );

      const missingPhases = await this.getMissingPhasesForTaskCopy(
        taskId,
        projectId,
        effectiveDestinationProjectId,
        client,
      );

      const missingDestinationColumns = [
        ...missingDestinationColumnsResult.rows,
        ...missingCustomColumnsResult.rows.map(column => ({
          name: column.name,
          key: column.key,
          index: null,
          pinned: true,
          custom_column: true,
          custom_column_obj: null,
        })),
      ];
      const hasMissingColumns = missingDestinationColumns.length > 0;
      const hasMissingPhases = missingPhases.length > 0;

      // Missing columns require explicit confirmation; phases are auto-created unless declined.
      if (
        effectiveDestinationProjectId !== projectId &&
        hasMissingColumns &&
        confirmProjectDifferences === undefined
      ) {
        await client.query("ROLLBACK");
        return res.status(409).send(
          new ServerResponse(false, {
            requiresConfirmation: true,
            missingColumns: missingDestinationColumns,
            missingPhases,
          }, "The destination project is missing columns or phases required by this task")
        );
      }

      if (effectiveDestinationProjectId !== projectId && hasMissingPhases) {
        await this.createMissingPhasesInDestination(
          client,
          effectiveDestinationProjectId,
          missingPhases,
        );
      }

      if (
        effectiveDestinationProjectId !== projectId &&
        hasMissingColumns &&
        confirmProjectDifferences === true
      ) {
        for (const column of missingDestinationColumnsResult.rows) {
          await client.query(
            `INSERT INTO project_task_list_cols
              (name, key, index, pinned, project_id, custom_column, custom_column_obj)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT DO NOTHING`,
            [
              column.name,
              column.key,
              column.index,
              column.pinned,
              effectiveDestinationProjectId,
              column.custom_column,
              column.custom_column_obj,
            ]
          );
        }

        for (const column of missingCustomColumnsResult.rows) {
          const createdColumnResult = await client.query(
            `INSERT INTO cc_custom_columns
              (project_id, name, key, field_type, width, is_visible, is_custom_column)
             VALUES ($1, $2, $3, $4, $5, $6, true)
             ON CONFLICT (project_id, key) DO UPDATE SET key = EXCLUDED.key
             RETURNING id`,
            [
              effectiveDestinationProjectId,
              column.name,
              column.key,
              column.field_type,
              column.width,
              column.is_visible,
            ]
          );
          const destinationColumnId = createdColumnResult.rows[0]?.id;
          if (!destinationColumnId) continue;

          await client.query(
            `INSERT INTO cc_column_configurations
              (column_id, field_title, field_type, number_type, decimals, label,
               label_position, preview_value, expression, first_numeric_column_key,
               second_numeric_column_key)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
              destinationColumnId,
              column.field_title,
              column.field_type,
              column.number_type,
              column.decimals,
              column.label,
              column.label_position,
              column.preview_value,
              column.expression,
              column.first_numeric_column_key,
              column.second_numeric_column_key,
            ]
          );

          await client.query(
            `INSERT INTO cc_selection_options
              (column_id, selection_id, selection_name, selection_color, selection_order)
             SELECT $1, selection_id, selection_name, selection_color, selection_order
             FROM cc_selection_options WHERE column_id = $2`,
            [destinationColumnId, column.id]
          );
          await client.query(
            `INSERT INTO cc_label_options
              (column_id, label_id, label_name, label_color, label_order)
             SELECT $1, label_id, label_name, label_color, label_order
             FROM cc_label_options WHERE column_id = $2`,
            [destinationColumnId, column.id]
          );
        }
      }

      // Single source of truth for status mapping across projects: get_mapped_status_id
      // (exact-name match, then semantic synonym mapping, then destination default).
      const destinationStatusResult = await client.query(
        `SELECT get_mapped_status_id($1, $2, $3) AS id`,
        [originalTask.status_id, projectId, effectiveDestinationProjectId]
      );

      if (!destinationStatusResult.rows[0]?.id) {
        await client.query("ROLLBACK");
        return res.status(422).send(
          new ServerResponse(false, null, "The destination project has no task status available")
        );
      }

      // 3. Prepare new task data
      const newTask: any = { ...originalTask };
      delete newTask.id;
      delete newTask.created_at;
      delete newTask.updated_at;
      delete newTask.completed_at;
      // delete newTask.task_no;

      newTask.name = 'Copy - ' + originalTask.name;
      newTask.project_id = effectiveDestinationProjectId;
      newTask.status_id = destinationStatusResult.rows[0].id;
      newTask.reporter_id = originalTask.reporter_id;
      newTask.done = false;
      newTask.archived = false;
      newTask.completed_at = null;
      newTask.schedule_id = null;
      newTask.manual_progress = false;
      newTask.progress_value = 0;

      if (!dates) {
        newTask.start_date = null;
        newTask.end_date = null;
      }

      // Fix sort_order conflict
      const maxSort = await client.query(
        `SELECT COALESCE(MAX(sort_order), 0) as max_sort FROM tasks WHERE project_id = $1`,
        [effectiveDestinationProjectId]
      );
      newTask.sort_order = maxSort.rows[0].max_sort + 1000;

      // Reset grouping sort orders
      newTask.status_sort_order = 0;
      newTask.priority_sort_order = 0;
      newTask.phase_sort_order = 0;
      newTask.member_sort_order = 0;
      // Also reset roadmap_sort_order — otherwise the duplicate is left tied with
      // the original task's position in the Roadmap view (this column isn't part
      // of the general sort_order/created_at fallback the other columns share).
      newTask.roadmap_sort_order = 0;

      // 3. Insert new task
      const keys = Object.keys(newTask);
      const values = Object.values(newTask);
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");

      const insertResult = await client.query(
        `INSERT INTO tasks (${keys.join(", ")})
       VALUES (${placeholders})
       RETURNING id, task_no, name`,
        [...values]
      );

      const newTaskId = insertResult.rows[0].id;
      const newTaskNo = insertResult.rows[0].task_no;

      // 4. Copy relations on the same transaction client.

      if (assignees) {
        await client.query(
          `INSERT INTO tasks_assignees (task_id, team_member_id, project_member_id, assigned_by)
          SELECT $1, source_assignees.team_member_id, destination_members.id, source_assignees.assigned_by
          FROM tasks_assignees source_assignees
          INNER JOIN project_members destination_members
            ON destination_members.team_member_id = source_assignees.team_member_id
           AND destination_members.project_id = $3
          WHERE source_assignees.task_id = $2
          ON CONFLICT (task_id, project_member_id) DO NOTHING`,
          [newTaskId, taskId, effectiveDestinationProjectId]
        );
      }

      if (labels) {
        await client.query(
          `INSERT INTO task_labels (task_id, label_id)
         SELECT $1, label_id FROM task_labels WHERE task_id = $2
         ON CONFLICT (task_id, label_id) DO NOTHING`,
          [newTaskId, taskId]
        );
      }

      if (dependencies) {
        // Helper function to recursively copy a task and its dependencies
        const copyTaskWithDependencies = async (
          originalTaskId: string,
          newTaskId: string,
          alreadyProcessed: Set<string> = new Set()
        ): Promise<void> => {
          // Prevent infinite loops
          if (alreadyProcessed.has(originalTaskId)) {
            return;
          }
          alreadyProcessed.add(originalTaskId);

          // Get all tasks that this task depends on
          const dependencyTasksResult = await client.query(
            `SELECT related_task_id, dependency_type FROM task_dependencies WHERE task_id = $1`,
            [originalTaskId]
          );

          for (const dep of dependencyTasksResult.rows) {
            const dependencyTaskId = dep.related_task_id;

            // Check if this dependency task is already in the destination project
            const existingResult = await client.query(
              `SELECT id FROM tasks WHERE id = $1 AND project_id = $2`,
              [dependencyTaskId, effectiveDestinationProjectId]
            );

            let newDependencyTaskId = dependencyTaskId;

            if (!existingResult.rowCount) {
              // Task doesn't exist in destination project, so duplicate it
              // Don't pass destination_status_id here - let each task use its own status mapping
              const dupResult = await client.query(
                `SELECT duplicate_task_shallow($1, NULL, $2, $3, NULL) AS new_task_id`,
                [dependencyTaskId, JSON.stringify(options), effectiveDestinationProjectId]
              );
              newDependencyTaskId = dupResult.rows[0]?.new_task_id;

              // duplicate_task_shallow creates the copied task (and any of its own
              // subtasks) in the *source* project. Reassign the whole copied
              // subtree - project, status, attachments - and remap its relations
              // to the destination project, mirroring the main subtasks branch.
              if (newDependencyTaskId && effectiveDestinationProjectId !== projectId) {
                await client.query(
                  `WITH RECURSIVE copied_tasks AS (
                     SELECT $1::uuid AS id
                     UNION ALL
                     SELECT child.id
                     FROM tasks child
                     INNER JOIN copied_tasks parent ON child.parent_task_id = parent.id
                   )
                   UPDATE tasks copied
                   SET project_id = $2,
                       status_id = get_mapped_status_id(copied.status_id, copied.project_id, $2),
                       sort_order = (
                         SELECT COALESCE(MAX(sort_order), 0)
                         FROM tasks WHERE project_id = $2
                       ) + 1000
                   FROM copied_tasks
                   WHERE copied.id = copied_tasks.id`,
                  [newDependencyTaskId, effectiveDestinationProjectId]
                );
                await client.query(
                  `WITH RECURSIVE copied_tasks AS (
                     SELECT $1::uuid AS id
                     UNION ALL
                     SELECT child.id
                     FROM tasks child
                     INNER JOIN copied_tasks parent ON child.parent_task_id = parent.id
                   )
                   UPDATE task_attachments
                   SET project_id = $2
                   WHERE task_id IN (SELECT id FROM copied_tasks)`,
                  [newDependencyTaskId, effectiveDestinationProjectId]
                );
                await TaskDuplicateController.remapCopiedSubtreeRelations(
                  client,
                  newDependencyTaskId,
                  effectiveDestinationProjectId
                );
              }

              // Recursively copy this dependency's dependencies
              await copyTaskWithDependencies(dependencyTaskId, newDependencyTaskId, alreadyProcessed);
            }

            // Create the dependency link
            await client.query(
              `INSERT INTO task_dependencies (task_id, related_task_id, dependency_type)
               VALUES ($1, $2, $3)
               ON CONFLICT (task_id, related_task_id, dependency_type) DO NOTHING`,
              [newTaskId, newDependencyTaskId, dep.dependency_type]
            );
          }
        };

        // Start recursive copy from the main task
        await copyTaskWithDependencies(taskId, newTaskId);
      }

      if (subscribers) {
        await client.query(
          `INSERT INTO task_subscribers (user_id, task_id, team_member_id, action)
         SELECT user_id, $1, team_member_id, action
         FROM task_subscribers WHERE task_id = $2
         ON CONFLICT (user_id, task_id, team_member_id) DO NOTHING`,
          [newTaskId, taskId]
        );
      }

      const sourceCommentsResult = await client.query(
        `SELECT comments.user_id, comments.team_member_id, comments.created_at, comments.updated_at,
                contents.index, contents.team_member_id AS content_team_member_id,
                contents.text_content
         FROM task_comments comments
         LEFT JOIN task_comment_contents contents ON contents.comment_id = comments.id
         WHERE comments.task_id = $1
         ORDER BY comments.created_at ASC`,
        [taskId]
      );

      if (comments) {
        for (const sourceComment of sourceCommentsResult.rows) {
          // Check if comment author is a member of the destination project
          let destinationTeamMemberId = sourceComment.team_member_id;
          let destinationUserId = sourceComment.user_id;
          
          // If copying to a different project, verify team members still exist in destination
          if (effectiveDestinationProjectId !== projectId && destinationTeamMemberId) {
            const memberCheck = await client.query(
              `SELECT id FROM team_members WHERE id = $1 AND team_id = $2`,
              [destinationTeamMemberId, req.user?.team_id]
            );
            if (!memberCheck.rowCount) {
              // Member doesn't exist in destination team, null it out
              destinationTeamMemberId = null;
            }
          }

          const copiedCommentResult = await client.query(
            `INSERT INTO task_comments (user_id, team_member_id, task_id, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id`,
            [
              destinationUserId,
              destinationTeamMemberId,
              newTaskId,
              sourceComment.created_at,
              sourceComment.updated_at,
            ]
          );

          if (sourceComment.index !== null && sourceComment.text_content !== null) {
            // Check if content author is a valid member
            let contentTeamMemberId = sourceComment.content_team_member_id;
            if (effectiveDestinationProjectId !== projectId && contentTeamMemberId) {
              const memberCheck = await client.query(
                `SELECT id FROM team_members WHERE id = $1 AND team_id = $2`,
                [contentTeamMemberId, req.user?.team_id]
              );
              if (!memberCheck.rowCount) {
                contentTeamMemberId = null;
              }
            }

            await client.query(
              `INSERT INTO task_comment_contents (index, comment_id, team_member_id, text_content)
               VALUES ($1, $2, $3, $4)`,
              [
                sourceComment.index,
                copiedCommentResult.rows[0].id,
                contentTeamMemberId,
                sourceComment.text_content,
              ]
            );
          }
        }
      }

      if (customFields) {
        await client.query(
          `INSERT INTO cc_column_values (task_id, column_id, text_value, number_value, date_value, boolean_value, json_value)
         SELECT $1, destination_columns.id, source_values.text_value, source_values.number_value,
                source_values.date_value, source_values.boolean_value, source_values.json_value
         FROM cc_column_values source_values
         INNER JOIN cc_custom_columns source_columns
           ON source_columns.id = source_values.column_id
          AND source_columns.project_id = $2
         INNER JOIN cc_custom_columns destination_columns
           ON destination_columns.project_id = $3
          AND destination_columns.key = source_columns.key
         WHERE source_values.task_id = $4
         ON CONFLICT (task_id, column_id) DO NOTHING`,
          [newTaskId, projectId, effectiveDestinationProjectId, taskId]
        );
      }

      await client.query(
        `INSERT INTO task_phase (task_id, phase_id)
         SELECT $1, destination_phases.id
         FROM task_phase source_task_phase
         INNER JOIN project_phases source_phases ON source_phases.id = source_task_phase.phase_id
         INNER JOIN project_phases destination_phases
           ON destination_phases.project_id = $3
          AND LOWER(TRIM(destination_phases.name)) = LOWER(TRIM(source_phases.name))
         WHERE source_task_phase.task_id = $2
           AND NOT EXISTS (
             SELECT 1 FROM task_phase existing WHERE existing.task_id = $1
           )`,
        [newTaskId, taskId, effectiveDestinationProjectId]
      );

      // Collect attachment copy tasks to execute outside transaction
      const attachmentCopyTasks: Array<{ sourceKey: string; destinationKey: string }> = [];

      if (attachments) {
        // Fetch original attachments with their IDs
        const originalAttachments = await client.query(
          `SELECT id, name, size, type, team_id, project_id, uploaded_by
          FROM task_attachments
          WHERE task_id = $1
          ORDER BY created_at ASC`,
          [taskId]
        );

        // Copy each attachment - record metadata for file copy outside transaction
        for (const originalAttachment of originalAttachments.rows) {
          // Insert new attachment record and get the new ID
          const newAttachmentResult = await client.query(
            `INSERT INTO task_attachments (name, size, type, task_id, team_id, project_id, uploaded_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id`,
            [
              originalAttachment.name,
              originalAttachment.size,
              originalAttachment.type,
              newTaskId,
              originalAttachment.team_id,
              effectiveDestinationProjectId,
              originalAttachment.uploaded_by
            ]
          );

          const newAttachmentId = newAttachmentResult.rows[0].id;

          // Collect file copy task for later execution outside transaction
          const sourceKey = getKey(
            originalAttachment.team_id,
            originalAttachment.project_id,
            originalAttachment.id,
            originalAttachment.type
          );
          const destinationKey = getKey(
            originalAttachment.team_id,
            effectiveDestinationProjectId,
            newAttachmentId,
            originalAttachment.type
          );

          attachmentCopyTasks.push({ sourceKey, destinationKey });
        }
      }

      // Subtasks: recursively duplicate all nested subtasks
      if (subtasks) {
        const subtasksRes = await client.query(
          `SELECT id FROM tasks WHERE parent_task_id = $1 AND archived = false ORDER BY sort_order`,
          [taskId]
        );

        for (const sub of subtasksRes.rows) {
          // duplicate_task_shallow will recursively handle nested subtasks when subtasks option is enabled
          // Don't pass destination_status_id - let each subtask use its own status mapping
          const subtaskResult = await client.query(
            `SELECT duplicate_task_shallow($1, $2, $3, $4, NULL) AS new_task_id`,
            [sub.id, newTaskId, JSON.stringify(options), effectiveDestinationProjectId]
          );
          
          const newSubtaskId = subtaskResult.rows[0]?.new_task_id;
          
          // If attachments were included, collect files for the complete subtask tree.
          // File copies will be executed outside the transaction.
          if (attachments && newSubtaskId) {
            await this.collectAttachmentTreeCopyTasks(
              sub.id,
              newSubtaskId,
              effectiveDestinationProjectId,
              client,
              attachmentCopyTasks,
            );
          }
        }

        // The legacy recursive database function creates descendants using the
        // source project. Reassign the copied subtree after creation so every
        // copied task belongs to the destination project.
        await client.query(
          `WITH RECURSIVE copied_tasks AS (
             SELECT id, created_at
             FROM tasks
             WHERE parent_task_id = $1
             UNION ALL
             SELECT child.id, child.created_at
             FROM tasks child
             INNER JOIN copied_tasks parent ON child.parent_task_id = parent.id
           )
           , ordered_copied_tasks AS (
             SELECT id,
                    ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS copy_order
             FROM copied_tasks
           )
           UPDATE tasks copied
           SET project_id = $2,
               sort_order = (
                 SELECT COALESCE(MAX(destination_tasks.sort_order), 0)
                 FROM tasks destination_tasks
                 WHERE destination_tasks.project_id = $2
                   AND destination_tasks.id NOT IN (SELECT id FROM copied_tasks)
               ) + (ordered_copied_tasks.copy_order * 1000),
               status_id = get_mapped_status_id(copied.status_id, copied.project_id, $2)
           FROM ordered_copied_tasks
           WHERE copied.id = ordered_copied_tasks.id`,
          [newTaskId, effectiveDestinationProjectId]
        );

        await client.query(
          `WITH RECURSIVE copied_tasks AS (
             SELECT id
             FROM tasks
             WHERE parent_task_id = $1
             UNION ALL
             SELECT child.id
             FROM tasks child
             INNER JOIN copied_tasks parent ON child.parent_task_id = parent.id
           )
           UPDATE task_attachments
           SET project_id = $2
           WHERE task_id IN (SELECT id FROM copied_tasks)`,
          [newTaskId, effectiveDestinationProjectId]
        );

        // The copied subtasks were created by duplicate_task_shallow with the
        // source project's assignee / custom-field / phase / dependency
        // references. Remap them to the destination project. (The main task's
        // own relations are handled by the dedicated copy queries above.)
        if (effectiveDestinationProjectId !== projectId) {
          await TaskDuplicateController.remapCopiedSubtreeRelations(
            client,
            newTaskId,
            effectiveDestinationProjectId
          );
        }
      }

      // Commit transaction
      await client.query("COMMIT");

      // Execute attachment file copies outside the transaction
      for (const copyTask of attachmentCopyTasks) {
        try {
          await copyObject(copyTask.sourceKey, copyTask.destinationKey);
        } catch (error) {
          console.error(`Failed to copy attachment file: ${copyTask.sourceKey} -> ${copyTask.destinationKey}`, error);
          // Continue with other files even if one fails
        }
      }

      // Manually count subtasks to ensure accurate count after duplication
      const subtaskCountResult = await client.query(
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
      const customColumnsResult = await client.query(customColumnsQuery, [newTaskId]);
      const customColumnValues = customColumnsResult.rows[0]?.custom_column_values || {};

      // Fetch attachment, dependency, subscriber and comment counts for icons
      const attachmentsResult = await client.query(
        `SELECT COUNT(*)::INT as count FROM task_attachments WHERE task_id = $1`,
        [newTaskId]
      );
      const attachmentsCount = attachmentsResult.rows[0]?.count || 0;

      const dependenciesResult = await client.query(
        `SELECT EXISTS(SELECT 1 FROM task_dependencies WHERE task_id = $1) AS has_dependencies`,
        [newTaskId]
      );
      const hasDependencies = !!dependenciesResult.rows[0]?.has_dependencies;

      const subscribersResult = await client.query(
        `SELECT EXISTS(SELECT 1 FROM task_subscribers WHERE task_id = $1) AS has_subscribers`,
        [newTaskId]
      );
      const hasSubscribers = !!subscribersResult.rows[0]?.has_subscribers;

      const commentsResult = await client.query(
        `SELECT COUNT(*)::INT as count FROM task_comments WHERE task_id = $1`,
        [newTaskId]
      );
      const commentsCount = commentsResult.rows[0]?.count || 0;

      const q = `SELECT get_single_task($1) AS task;`;
      const result = await client.query(q, [newTaskId]);

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
      await client.query("ROLLBACK").catch(() => { });
      console.error("Task duplication failed:", error);
      throw error;
    } finally {
      client.release();
    }
  }
}
