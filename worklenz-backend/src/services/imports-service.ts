import db from "../config/db";
import { v4 as uuidv4 } from "uuid";
import { PoolClient } from "pg";

export type ImportFlowType = "direct" | "csv";
export type ImportStatus =
  | "pending"
  | "ready"
  | "running"
  | "success"
  | "failed";

export interface CreateImportJobInput {
  provider: string;
  flowType: ImportFlowType;
  createdBy: string;
  targetProjectId?: string;
  targetSpaceType?: string;
  targetTemplate?: string;
  sourceReference?: Record<string, unknown>;
}

export interface ImportJob {
  id: string;
  provider: string;
  flow_type: ImportFlowType;
  status: ImportStatus;
  current_step: number;
  created_by: string;
  target_project_id: string | null;
  target_space_type: string | null;
  target_template: string | null;
  source_reference: Record<string, unknown> | null;
  stats: Record<string, unknown>;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface ValueMappingRow {
  source_value: string;
  target_worktype: string;
  include?: boolean;
}

export interface UserMappingRow {
  source_user_id?: string | null;
  source_email?: string | null;
  target_user_id?: string | null;
  resolution?: string;
  include?: boolean;
}

export interface AttachmentPlanRow {
  source_url: string;
  filename?: string | null;
  content_type?: string | null;
  size_bytes?: number | null;
  status?: string;
  storage_key?: string | null;
}

export interface StageTaskRow {
  source_task_id?: string | null;
  parent_source_task_id?: string | null;
  title: string;
  description?: string | null;
  status?: string | null;
  due_at?: string | null;
  start_at?: string | null;
  worktype?: string | null;
  assignee_source_id?: string | null;
  attachments_planned?: boolean;
  raw?: unknown;
}

class ImportsService {
  async createJob(input: CreateImportJobInput): Promise<ImportJob> {
    const id = uuidv4();
    const q = `INSERT INTO import_jobs (id, provider, flow_type, created_by, target_project_id, target_space_type, target_template, source_reference)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
               RETURNING *;`;
    const params = [
      id,
      input.provider,
      input.flowType,
      input.createdBy,
      input.targetProjectId || null,
      input.targetSpaceType || null,
      input.targetTemplate || null,
      input.sourceReference || null,
    ];
    const { rows } = await db.query(q, params);
    return rows[0];
  }

  async getJob(jobId: string): Promise<ImportJob | null> {
    const { rows } = await db.query("SELECT * FROM import_jobs WHERE id = $1", [
      jobId,
    ]);
    return rows[0] || null;
  }

  async getJobForUser(
    jobId: string,
    userId?: string | null
  ): Promise<ImportJob | null> {
    if (!userId) return null;
    const { rows } = await db.query(
      "SELECT * FROM import_jobs WHERE id = $1 AND created_by = $2",
      [jobId, userId]
    );
    return rows[0] || null;
  }

  async mergeSourceReference(jobId: string, patch: Record<string, unknown>) {
    // Merge JSONB while preserving existing data
    await db.query(
      `UPDATE import_jobs
       SET source_reference = COALESCE(source_reference, '{}'::jsonb) || $2::jsonb,
           updated_at = NOW()
       WHERE id = $1`,
      [jobId, patch]
    );
  }

  async updateJobStatus(
    jobId: string,
    status: ImportStatus,
    errorMessage?: string | null,
    stats?: Record<string, unknown>
  ) {
    await db.query(
      "UPDATE import_jobs SET status = $2, error_message = $3, stats = COALESCE($4, stats), updated_at = NOW() WHERE id = $1",
      [jobId, status, errorMessage || null, stats || null]
    );
  }

  async updateJobTargets(
    jobId: string,
    targetProjectId?: string | null,
    targetSpaceType?: string | null,
    targetTemplate?: string | null
  ) {
    await db.query(
      `UPDATE import_jobs
         SET target_project_id = COALESCE($2, target_project_id),
             target_space_type = COALESCE($3, target_space_type),
             target_template   = COALESCE($4, target_template),
             updated_at        = NOW()
       WHERE id = $1`,
      [
        jobId,
        targetProjectId || null,
        targetSpaceType || null,
        targetTemplate || null,
      ]
    );
  }

  async appendLog(
    jobId: string,
    level: string,
    message: string,
    context: Record<string, unknown> = {}
  ) {
    await db.query(
      "INSERT INTO import_logs (job_id, level, message, context) VALUES ($1,$2,$3,$4)",
      [jobId, level, message, context]
    );
  }

  async upsertHierarchy(
    jobId: string,
    rows: Array<{
      source_level: string;
      target_level: string;
      position: number;
    }>
  ) {
    await db.query("DELETE FROM import_hierarchy_mappings WHERE job_id = $1", [
      jobId,
    ]);
    const insertValues: string[] = [];
    const params: unknown[] = [];
    rows.forEach((row, idx) => {
      insertValues.push(
        `($1, $${idx * 3 + 2}, $${idx * 3 + 3}, $${idx * 3 + 4})`
      );
      params.push(row.source_level, row.target_level, row.position);
    });
    if (rows.length) {
      await db.query(
        `INSERT INTO import_hierarchy_mappings (job_id, source_level, target_level, position)
         VALUES ${insertValues.join(",")}`,
        [jobId, ...params]
      );
    }
  }

  async upsertFields(
    jobId: string,
    rows: Array<{
      source_field: string;
      target_field: string;
      required?: boolean;
      include?: boolean;
    }>
  ) {
    await db.query("DELETE FROM import_field_mappings WHERE job_id = $1", [
      jobId,
    ]);
    const insertValues: string[] = [];
    const params: unknown[] = [];
    rows.forEach((row, idx) => {
      insertValues.push(
        `($1, $${idx * 4 + 2}, $${idx * 4 + 3}, $${idx * 4 + 4}, $${
          idx * 4 + 5
        })`
      );
      params.push(
        row.source_field,
        row.target_field,
        row.required ?? false,
        row.include ?? true
      );
    });
    if (rows.length) {
      await db.query(
        `INSERT INTO import_field_mappings (job_id, source_field, target_field, required, include)
         VALUES ${insertValues.join(",")}`,
        [jobId, ...params]
      );
    }
  }

  async upsertValueMappings(jobId: string, rows: ValueMappingRow[]) {
    await db.query("DELETE FROM import_value_mappings WHERE job_id = $1", [
      jobId,
    ]);
    if (!rows.length) return;
    const insertValues: string[] = [];
    const params: unknown[] = [];
    rows.forEach((row, idx) => {
      insertValues.push(
        `($1, $${idx * 3 + 2}, $${idx * 3 + 3}, $${idx * 3 + 4})`
      );
      params.push(row.source_value, row.target_worktype, row.include ?? true);
    });
    await db.query(
      `INSERT INTO import_value_mappings (job_id, source_value, target_worktype, include)
       VALUES ${insertValues.join(",")}`,
      [jobId, ...params]
    );
  }

  async upsertUserMappings(jobId: string, rows: UserMappingRow[]) {
    await db.query("DELETE FROM import_user_mappings WHERE job_id = $1", [
      jobId,
    ]);
    if (!rows.length) return;
    const insertValues: string[] = [];
    const params: unknown[] = [];
    rows.forEach((row, idx) => {
      insertValues.push(
        `($1, $${idx * 6 + 2}, $${idx * 6 + 3}, $${idx * 6 + 4}, $${
          idx * 6 + 5
        }, $${idx * 6 + 6})`
      );
      params.push(
        row.source_user_id || null,
        row.source_email || null,
        row.target_user_id || null,
        row.resolution || "unresolved",
        row.include ?? true
      );
    });
    await db.query(
      `INSERT INTO import_user_mappings (job_id, source_user_id, source_email, target_user_id, resolution, include)
       VALUES ${insertValues.join(",")}`,
      [jobId, ...params]
    );
  }

  async upsertAttachmentPlans(jobId: string, rows: AttachmentPlanRow[]) {
    await db.query("DELETE FROM import_attachment_plans WHERE job_id = $1", [
      jobId,
    ]);
    if (!rows.length) return;
    const insertValues: string[] = [];
    const params: unknown[] = [];
    rows.forEach((row, idx) => {
      insertValues.push(
        `($1, $${idx * 6 + 2}, $${idx * 6 + 3}, $${idx * 6 + 4}, $${
          idx * 6 + 5
        }, $${idx * 6 + 6}, $${idx * 6 + 7})`
      );
      params.push(
        row.source_url,
        row.filename || null,
        row.content_type || null,
        row.size_bytes ?? null,
        row.status || "planned",
        row.storage_key || null
      );
    });
    await db.query(
      `INSERT INTO import_attachment_plans (job_id, source_url, filename, content_type, size_bytes, status, storage_key)
       VALUES ${insertValues.join(",")}`,
      [jobId, ...params]
    );
  }

  async upsertStageTasks(jobId: string, rows: StageTaskRow[]) {
    await db.query("DELETE FROM import_stage_tasks WHERE job_id = $1", [jobId]);
    if (!rows.length) return;
    const insertValues: string[] = [];
    const params: unknown[] = [];
    rows.forEach((row, idx) => {
      insertValues.push(
        `($1, $${idx * 11 + 2}, $${idx * 11 + 3}, $${idx * 11 + 4}, $${
          idx * 11 + 5
        }, $${idx * 11 + 6}, $${idx * 11 + 7}, $${idx * 11 + 8}, $${
          idx * 11 + 9
        }, $${idx * 11 + 10}, $${idx * 11 + 11}, $${idx * 11 + 12})`
      );
      params.push(
        row.source_task_id || null,
        row.parent_source_task_id || null,
        row.title,
        row.description || null,
        row.status || null,
        row.due_at || null,
        row.start_at || null,
        row.worktype || null,
        row.assignee_source_id || null,
        row.attachments_planned ?? false,
        row.raw || null
      );
    });
    await db.query(
      `INSERT INTO import_stage_tasks (job_id, source_task_id, parent_source_task_id, title, description, status, due_at, start_at, worktype, assignee_source_id, attachments_planned, raw)
       VALUES ${insertValues.join(",")}`,
      [jobId, ...params]
    );
  }

  async listStageTasks(jobId: string) {
    const { rows } = await db.query(
      "SELECT * FROM import_stage_tasks WHERE job_id = $1 ORDER BY id",
      [jobId]
    );
    return rows;
  }

  async listLogs(jobId: string) {
    const { rows } = await db.query(
      "SELECT * FROM import_logs WHERE job_id = $1 ORDER BY id DESC LIMIT 200",
      [jobId]
    );
    return rows;
  }

  async progress(jobId: string) {
    const job = await this.getJob(jobId);
    if (!job) return null;
    const [
      [hierarchyCount],
      [fieldCount],
      [valueCount],
      [userCount],
      [stageCount],
      [attachmentCount],
    ] = await Promise.all([
      db
        .query(
          "SELECT COUNT(*)::int AS count FROM import_hierarchy_mappings WHERE job_id = $1",
          [jobId]
        )
        .then((r) => r.rows),
      db
        .query(
          "SELECT COUNT(*)::int AS count FROM import_field_mappings WHERE job_id = $1",
          [jobId]
        )
        .then((r) => r.rows),
      db
        .query(
          "SELECT COUNT(*)::int AS count FROM import_value_mappings WHERE job_id = $1",
          [jobId]
        )
        .then((r) => r.rows),
      db
        .query(
          "SELECT COUNT(*)::int AS count FROM import_user_mappings WHERE job_id = $1",
          [jobId]
        )
        .then((r) => r.rows),
      db
        .query(
          "SELECT COUNT(*)::int AS count FROM import_stage_tasks WHERE job_id = $1",
          [jobId]
        )
        .then((r) => r.rows),
      db
        .query(
          "SELECT COUNT(*)::int AS count FROM import_attachment_plans WHERE job_id = $1",
          [jobId]
        )
        .then((r) => r.rows),
    ]);
    const { rows: recentLogs } = await db.query(
      "SELECT level, message, created_at FROM import_logs WHERE job_id = $1 ORDER BY id DESC LIMIT 20",
      [jobId]
    );
    return {
      job,
      counts: {
        hierarchy: hierarchyCount?.count || 0,
        fields: fieldCount?.count || 0,
        values: valueCount?.count || 0,
        users: userCount?.count || 0,
        stageTasks: stageCount?.count || 0,
        attachments: attachmentCount?.count || 0,
      },
      recentLogs,
    };
  }

  async commit(jobId: string) {
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await this.updateJobStatus(jobId, "running");

      const job = await this.getJob(jobId);
      if (!job?.target_project_id)
        throw new Error("Target project is required for commit");

      const [
        { rows: staged },
        { rows: statusRows },
        { rows: priorityRows },
        { rows: userRows },
      ] = await Promise.all([
        client.query(
          "SELECT * FROM import_stage_tasks WHERE job_id = $1 ORDER BY id",
          [jobId]
        ),
        client.query(
          "SELECT id, name FROM task_statuses WHERE project_id = $1 ORDER BY position",
          [job.target_project_id]
        ),
        client.query(
          "SELECT id, name, value FROM task_priorities WHERE project_id = $1 ORDER BY value NULLS LAST",
          [job.target_project_id]
        ),
        client.query(
          "SELECT source_user_id, source_email, target_user_id FROM import_user_mappings WHERE job_id = $1 AND (include IS NULL OR include = true)",
          [jobId]
        ),
      ]);

      const statusMap = new Map<string, string>();
      statusRows.forEach((row: any) => {
        if (row.name) statusMap.set(row.name.toString().toLowerCase(), row.id);
      });
      const defaultStatusId = statusRows[0]?.id || null;

      if (!defaultStatusId) {
        throw new Error("Target project has no statuses configured");
      }

      const defaultPriorityId = priorityRows[0]?.id || null;

      const assigneeMap = new Map<string, string>();
      userRows.forEach((row: any) => {
        if (row.source_user_id && row.target_user_id)
          assigneeMap.set(row.source_user_id.toString(), row.target_user_id);
        if (row.source_email && row.target_user_id)
          assigneeMap.set(
            row.source_email.toString().toLowerCase(),
            row.target_user_id
          );
      });

      const createdTasks: any[] = [];
      const sourceToId = new Map<string, string>();
      const roots = staged.filter((task: any) => !task.parent_source_task_id);
      const deferred = staged.filter((task: any) => task.parent_source_task_id);

      const resolveStatusId = (value?: string | null) => {
        if (!value) return defaultStatusId;
        const key = value.toString().trim().toLowerCase();
        return statusMap.get(key) || defaultStatusId;
      };

      const resolveAssignees = (value?: string | null) => {
        if (!value) return [] as Array<{ user_id: string }>;
        const direct = assigneeMap.get(value.toString());
        const email = assigneeMap.get(value.toString().toLowerCase());
        const userId = direct || email;
        return userId ? [{ user_id: userId }] : [];
      };

      const createTask = async (task: any, parentId?: string | null) => {
        const payload: Record<string, unknown> = {
          name: task.title,
          project_id: job.target_project_id,
          description: task.description,
          start_date: task.start_at,
          end_date: task.due_at,
          reporter_id: job.created_by,
          status_id: resolveStatusId(task.status),
          priority_id: defaultPriorityId,
          parent_task_id: parentId || null,
          assignees: resolveAssignees(task.assignee_source_id),
        };

        const result = await client.query("SELECT create_task($1) AS task;", [
          JSON.stringify(payload),
        ]);
        const created = result.rows[0]?.task || null;
        if (created?.id && task.source_task_id) {
          sourceToId.set(task.source_task_id, created.id);
        }
        createdTasks.push(created);
      };

      for (const task of roots) {
        await createTask(task, null);
      }

      let guard = deferred.length * 2;
      while (deferred.length && guard > 0) {
        const task = deferred.shift() as any;
        const parentId = task.parent_source_task_id
          ? sourceToId.get(task.parent_source_task_id) || null
          : null;
        if (task.parent_source_task_id && !parentId) {
          deferred.push(task);
          guard -= 1;
          continue;
        }
        await createTask(task, parentId);
      }

      if (deferred.length) {
        throw new Error("Failed to resolve parent tasks for all staged items");
      }

      const progress = await this.progress(jobId);
      const stats = progress?.counts || {};
      await this.appendLog(jobId, "info", "Commit pipeline executed", {
        stats,
        created: createdTasks.length,
      });
      await this.updateJobStatus(jobId, "success", undefined, stats);
      await client.query("COMMIT");
    } catch (err: any) {
      await client.query("ROLLBACK");
      const message = err?.message || "Commit failed";
      await this.appendLog(jobId, "error", message, {
        error: err?.stack || err,
      });
      await this.updateJobStatus(jobId, "failed", message);
      throw err;
    } finally {
      client.release();
    }
  }

  async cancel(jobId: string, message?: string) {
    await this.updateJobStatus(jobId, "failed", message || "Cancelled");
  }
}

export default new ImportsService();
