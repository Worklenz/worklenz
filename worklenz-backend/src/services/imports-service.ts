import db from "../config/db";
import { v4 as uuidv4 } from "uuid";
import { PoolClient } from "pg";
import slugify from "slugify";

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

export interface FieldMappingRow {
  source_field: string;
  target_field: string;
  required?: boolean;
  include?: boolean;
}

export interface TaskFieldPatch {
  description?: string | null;
  status?: string | null;
  start_at?: string | null;
  due_at?: string | null;
  assignee_source_id?: string | null;
  priority_label?: string | null;
  completed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface CustomFieldValuePlan {
  columnKey: string;
  columnName: string;
  value: unknown;
}

type SupportedCustomFieldType =
  | "people"
  | "number"
  | "date"
  | "selection"
  | "checkbox"
  | "labels"
  | "key"
  | "formula";

interface SelectionOptionPlan {
  id: string;
  name: string;
  color: string;
}

interface ColumnPlanConfig {
  fieldType: SupportedCustomFieldType;
  numberType?: string | null;
  decimals?: number | null;
  selections?: SelectionOptionPlan[];
  valueToSelectionId?: Map<string, string>;
}

interface CustomColumnPlan {
  key: string;
  name: string;
  sourceField: string;
  samples: Set<string>;
}

interface CustomColumnRef {
  id: string;
  key: string;
  fieldType?: SupportedCustomFieldType;
}

const MAX_SELECTION_OPTIONS = 200;
const SELECTION_COLORS = [
  "#2563eb",
  "#7c3aed",
  "#14b8a6",
  "#f97316",
  "#f43f5e",
  "#f59e0b",
  "#0ea5e9",
  "#10b981",
];

const sanitizeSampleValue = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  return typeof value === "string" ? value.trim() : String(value);
};

const isNumericSample = (value: string): boolean => {
  if (!value) return false;
  return Number.isFinite(Number(value));
};

const countDecimalPlaces = (value: string): number => {
  if (!value.includes(".")) return 0;
  const decimals = value.split(".")[1] || "";
  return Math.min(decimals.length, 6);
};

const isDateSample = (value: string): boolean => {
  if (!value) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed);
};

const isBooleanSample = (value: string): boolean => {
  if (!value) return false;
  const normalized = value.toLowerCase();
  return ["true", "false", "yes", "no", "1", "0"].includes(normalized);
};

const coerceBooleanValue = (value: string): boolean | null => {
  const normalized = value.toLowerCase();
  if (["true", "yes", "1"].includes(normalized)) return true;
  if (["false", "no", "0"].includes(normalized)) return false;
  return null;
};

const buildSelectionOptions = (
  plan: CustomColumnPlan,
  values: string[]
): { selections: SelectionOptionPlan[]; map: Map<string, string> } => {
  const uniqueValues = Array.from(new Set(values)).slice(
    0,
    MAX_SELECTION_OPTIONS
  );
  const selections = uniqueValues.map((value, index) => {
    const slug =
      slugify(value, { lower: true, strict: true }).slice(0, 40) ||
      `option-${index}`;
    return {
      id: `${plan.key}-${slug}-${index}`,
      name: value,
      color: SELECTION_COLORS[index % SELECTION_COLORS.length],
    };
  });
  const map = new Map<string, string>();
  selections.forEach((selection) => {
    map.set(selection.name, selection.id);
  });
  return { selections, map };
};

const inferColumnConfig = (plan: CustomColumnPlan): ColumnPlanConfig => {
  const values = Array.from(plan.samples).filter((value) => !!value);
  if (values.length && values.every(isNumericSample)) {
    const decimals = values.reduce(
      (acc, value) => Math.max(acc, countDecimalPlaces(value)),
      0
    );
    return { fieldType: "number", numberType: "formatted", decimals };
  }

  if (values.length && values.every(isDateSample)) {
    return { fieldType: "date" };
  }

  if (values.length && values.every(isBooleanSample)) {
    return { fieldType: "checkbox" };
  }

  const { selections, map } = buildSelectionOptions(plan, values);
  return {
    fieldType: "selection",
    selections,
    valueToSelectionId: map,
  };
};

const STANDARD_TARGET_FIELDS = new Set<string>([
  "key",
  "description",
  "progress",
  "status",
  "assignees",
  "labels",
  "phase",
  "priority",
  "timeTracking",
  "estimation",
  "startDate",
  "dueDate",
  "completedDate",
  "createdDate",
  "lastUpdated",
  "reporter",
]);

const TARGET_FIELD_ALIASES: Record<string, string> = {
  key: "key",
  description: "description",
  progress: "progress",
  status: "status",
  assignee: "assignees",
  assignees: "assignees",
  member: "assignees",
  members: "assignees",
  label: "labels",
  labels: "labels",
  phase: "phase",
  priority: "priority",
  timetracking: "timeTracking",
  estimation: "estimation",
  estimate: "estimation",
  startdate: "startDate",
  start: "startDate",
  startat: "startDate",
  startatdate: "startDate",
  duedate: "dueDate",
  due: "dueDate",
  dueat: "dueDate",
  completeddate: "completedDate",
  completed: "completedDate",
  completedat: "completedDate",
  createddate: "createdDate",
  created: "createdDate",
  createdat: "createdDate",
  lastupdated: "lastUpdated",
  updated: "lastUpdated",
  updatedat: "lastUpdated",
  reporter: "reporter",
  owner: "reporter",
};

const normalizeTargetField = (value: string) => {
  const normalized = slugify(value || "", {
    lower: true,
    strict: true,
  }).replace(/-/g, "");
  return TARGET_FIELD_ALIASES[normalized] || value;
};

const toColumnKey = (value: string) =>
  slugify(value || "custom-column", { lower: true, strict: true }) ||
  "custom-column";

export const mapRawToTaskFields = (
  raw: unknown,
  mappings: FieldMappingRow[]
): { patch: TaskFieldPatch; customValues: CustomFieldValuePlan[] } => {
  // DEBUG: Log mapping and raw input
  // eslint-disable-next-line no-console
  console.log("[mapRawToTaskFields] === START ===");
  // eslint-disable-next-line no-console
  console.log("[mapRawToTaskFields] Number of mappings:", mappings.length);
  // eslint-disable-next-line no-console
  console.log(
    "[mapRawToTaskFields] Created field mapping:",
    mappings.find(
      (m) => m.source_field === "Created" || m.target_field === "createdDate"
    )
  );
  const source =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  // eslint-disable-next-line no-console
  console.log(
    "[mapRawToTaskFields] Raw 'Created' value:",
    (source as any)?.Created
  );

  const patch: TaskFieldPatch = {};
  const customValues: CustomFieldValuePlan[] = [];

  mappings.forEach((mapping) => {
    if (mapping.include === false) return;
    const value = source[mapping.source_field];
    if (value === undefined || value === null || value === "") return;

    const targetField = normalizeTargetField(mapping.target_field);

    switch (targetField) {
      case "description":
        patch.description = String(value);
        break;
      case "status":
        patch.status = String(value);
        break;
      case "startDate":
        patch.start_at = String(value);
        break;
      case "dueDate":
        patch.due_at = String(value);
        break;
      case "createdDate":
        // eslint-disable-next-line no-console
        console.log(
          "[mapRawToTaskFields] ✓ Mapping createdDate - source_field:",
          mapping.source_field,
          "value:",
          value
        );
        patch.created_at = String(value);
        break;
      case "lastUpdated":
        patch.updated_at = String(value);
        break;
      case "assignees":
        if (
          typeof value === "string" &&
          value.trim() &&
          (value.includes("@") || !patch.assignee_source_id)
        ) {
          patch.assignee_source_id = String(value);
        }
        break;
      case "priority":
        patch.priority_label = String(value);
        break;
      case "completedDate":
        patch.completed_at = String(value);
        break;
      default: {
        const columnKey = toColumnKey(targetField);
        const columnName = mapping.source_field || targetField;
        customValues.push({ columnKey, columnName, value });
        break;
      }
    }
  });
  // DEBUG: Log patch output
  // eslint-disable-next-line no-console
  console.log("[mapRawToTaskFields] FINAL patch.created_at:", patch.created_at);
  // eslint-disable-next-line no-console
  console.log("[mapRawToTaskFields] FINAL patch:", patch);
  // eslint-disable-next-line no-console
  console.log("[mapRawToTaskFields] === END ===");

  return { patch, customValues };
};

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
        { rows: fieldRows },
        { rows: customColumnRows },
        { rows: taskListColumns },
      ] = await Promise.all([
        client.query(
          "SELECT * FROM import_stage_tasks WHERE job_id = $1 ORDER BY id",
          [jobId]
        ),
        client.query(
          `SELECT ts.id,
                  ts.name,
                  COALESCE(cat.is_done, FALSE) AS is_done,
                  COALESCE(cat.is_todo, FALSE) AS is_todo
             FROM task_statuses ts
             LEFT JOIN sys_task_status_categories cat ON cat.id = ts.category_id
             WHERE ts.project_id = $1
             ORDER BY ts.sort_order`,
          [job.target_project_id]
        ),
        client.query(
          "SELECT id, name, value FROM task_priorities ORDER BY value NULLS LAST"
        ),
        client.query(
          "SELECT source_user_id, source_email, target_user_id FROM import_user_mappings WHERE job_id = $1 AND (include IS NULL OR include = true)",
          [jobId]
        ),
        client.query(
          "SELECT source_field, target_field, include FROM import_field_mappings WHERE job_id = $1",
          [jobId]
        ),
        client.query(
          "SELECT id, key, field_type FROM cc_custom_columns WHERE project_id = $1",
          [job.target_project_id]
        ),
        client.query(
          "SELECT id, key, pinned FROM project_task_list_cols WHERE project_id = $1",
          [job.target_project_id]
        ),
      ]);

      const { rows: projectRows } = await client.query(
        "SELECT team_id FROM projects WHERE id = $1",
        [job.target_project_id]
      );
      const targetTeamId = projectRows[0]?.team_id || null;

      const teamMemberEmailMap = new Map<string, string>();
      const loadTeamMemberEmails = async () => {
        if (!targetTeamId) return [] as any[];
        const { rows } = await client.query(
          `SELECT tm.id,
                  LOWER(COALESCE(u.email, ei.email)) AS email
             FROM team_members tm
             LEFT JOIN users u ON u.id = tm.user_id
             LEFT JOIN email_invitations ei ON ei.team_member_id = tm.id
             WHERE tm.team_id = $1`,
          [targetTeamId]
        );
        return rows as any[];
      };
      const hydrateTeamMemberEmails = (rows: any[]) => {
        rows.forEach((row) => {
          if (row?.email) {
            teamMemberEmailMap.set(row.email, row.id);
          }
        });
      };
      if (targetTeamId) {
        const initialMembers = await loadTeamMemberEmails();
        hydrateTeamMemberEmails(initialMembers);
      }

      const ensureAssigneeTeamMembers = async () => {
        if (!targetTeamId) return;
        const pendingEmails = new Set<string>();
        staged.forEach((task: StageTaskRow) => {
          const candidate =
            typeof task.assignee_source_id === "string"
              ? task.assignee_source_id.trim()
              : "";
          if (!candidate || !candidate.includes("@")) return;
          const normalized = candidate.toLowerCase();
          if (!teamMemberEmailMap.has(normalized)) {
            pendingEmails.add(normalized);
          }
        });
        if (!pendingEmails.size) return;
        await client.query("SELECT create_team_member($1) AS new_members;", [
          JSON.stringify({
            team_id: targetTeamId,
            emails: Array.from(pendingEmails),
          }),
        ]);
        teamMemberEmailMap.clear();
        const refreshedMembers = await loadTeamMemberEmails();
        hydrateTeamMemberEmails(refreshedMembers);
      };

      await ensureAssigneeTeamMembers();

      const statusMap = new Map<string, string>();
      const doneStatusIds = new Set<string>();
      let defaultDoneStatusId: string | null = null;
      statusRows.forEach((row: any) => {
        if (row.name) {
          statusMap.set(row.name.toString().toLowerCase(), row.id);
        }
        if (row.is_done) {
          doneStatusIds.add(row.id);
          if (!defaultDoneStatusId) defaultDoneStatusId = row.id;
        }
      });
      const defaultStatusId =
        statusRows.find((row: any) => row.is_todo)?.id ||
        statusRows[0]?.id ||
        null;

      if (!defaultStatusId) {
        throw new Error("Target project has no statuses configured");
      }

      const defaultPriorityId = priorityRows[0]?.id || null;

      const priorityMap = new Map<string, string>();
      priorityRows.forEach((row: any) => {
        if (row.name)
          priorityMap.set(row.name.toString().toLowerCase(), row.id);
      });

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

      const activeFieldMappings: FieldMappingRow[] = (fieldRows ||
        []) as FieldMappingRow[];

      const customColumnMap = new Map<string, CustomColumnRef>();
      customColumnRows.forEach((row: any) => {
        if (row.key)
          customColumnMap.set(row.key, {
            id: row.id,
            key: row.key,
            fieldType: row.field_type || undefined,
          });
      });

      const customColumnPlans = new Map<string, CustomColumnPlan>();
      activeFieldMappings.forEach((mapping) => {
        if (mapping.include === false) return;
        const normalizedTarget = normalizeTargetField(mapping.target_field);
        if (STANDARD_TARGET_FIELDS.has(normalizedTarget)) return;
        const key = toColumnKey(normalizedTarget);
        if (!customColumnPlans.has(key)) {
          const sourceField = mapping.source_field || normalizedTarget;
          customColumnPlans.set(key, {
            key,
            name: sourceField,
            sourceField,
            samples: new Set<string>(),
          });
        }
      });

      if (customColumnPlans.size) {
        staged.forEach((task: StageTaskRow) => {
          const rawSource =
            task.raw && typeof task.raw === "object" && !Array.isArray(task.raw)
              ? (task.raw as Record<string, unknown>)
              : {};
          customColumnPlans.forEach((plan) => {
            const rawValue = rawSource?.[plan.sourceField];
            const sanitized = sanitizeSampleValue(rawValue);
            if (sanitized) {
              plan.samples.add(sanitized);
            }
          });
        });
      }

      const customColumnConfigs = new Map<string, ColumnPlanConfig>();
      customColumnPlans.forEach((plan, key) => {
        customColumnConfigs.set(key, inferColumnConfig(plan));
      });

      const TASK_LIST_COLUMN_INFO: Record<
        string,
        { key: string; name: string; index: number }
      > = {
        key: { key: "KEY", name: "Key", index: 0 },
        description: { key: "DESCRIPTION", name: "Description", index: 2 },
        progress: { key: "PROGRESS", name: "Progress", index: 3 },
        status: { key: "STATUS", name: "Status", index: 4 },
        assignees: { key: "ASSIGNEES", name: "Members", index: 5 },
        labels: { key: "LABELS", name: "Labels", index: 6 },
        phase: { key: "PHASE", name: "Phase", index: 7 },
        priority: { key: "PRIORITY", name: "Priority", index: 8 },
        timeTracking: { key: "TIME_TRACKING", name: "Time Tracking", index: 9 },
        estimation: { key: "ESTIMATION", name: "Estimation", index: 10 },
        startDate: { key: "START_DATE", name: "Start Date", index: 11 },
        dueDate: { key: "DUE_DATE", name: "Due Date", index: 12 },
        completedDate: {
          key: "COMPLETED_DATE",
          name: "Completed Date",
          index: 13,
        },
        createdDate: { key: "CREATED_DATE", name: "Created Date", index: 14 },
        lastUpdated: { key: "LAST_UPDATED", name: "Last Updated", index: 15 },
        reporter: { key: "REPORTER", name: "Reporter", index: 16 },
      };

      const taskListColumnMap = new Map<
        string,
        { id: string; pinned: boolean }
      >();
      taskListColumns.forEach((col: any) => {
        if (col?.key)
          taskListColumnMap.set(col.key, { id: col.id, pinned: !!col.pinned });
      });

      const ensureTaskListColumn = async (info: {
        key: string;
        name: string;
        index: number;
      }) => {
        const existing = taskListColumnMap.get(info.key);
        if (existing) {
          if (!existing.pinned) {
            await client.query(
              "UPDATE project_task_list_cols SET pinned = TRUE WHERE id = $1",
              [existing.id]
            );
            taskListColumnMap.set(info.key, { id: existing.id, pinned: true });
          }
          return;
        }

        const inserted = await client.query(
          `INSERT INTO project_task_list_cols (project_id, name, key, index, pinned, custom_column, custom_column_obj)
           VALUES ($1, $2, $3, $4, TRUE, FALSE, NULL)
           RETURNING id`,
          [job.target_project_id, info.name, info.key, info.index]
        );
        const newId = inserted.rows[0]?.id;
        if (newId) taskListColumnMap.set(info.key, { id: newId, pinned: true });
      };

      for (const mapping of activeFieldMappings) {
        if (mapping.include === false) continue;
        const normalizedTarget = normalizeTargetField(mapping.target_field);
        const info = TASK_LIST_COLUMN_INFO[normalizedTarget];
        if (info) {
          await ensureTaskListColumn(info);
        }
      }

      const configureColumnMetadata = async (
        columnId: string,
        plan: CustomColumnPlan,
        config: ColumnPlanConfig
      ) => {
        await client.query(
          "DELETE FROM cc_column_configurations WHERE column_id = $1",
          [columnId]
        );
        await client.query(
          `INSERT INTO cc_column_configurations (
             column_id,
             field_title,
             field_type,
             number_type,
             decimals,
             label,
             label_position,
             preview_value,
             expression,
             first_numeric_column_key,
             second_numeric_column_key
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [
            columnId,
            plan.name,
            config.fieldType,
            config.numberType || null,
            config.decimals ?? null,
            null,
            null,
            null,
            null,
            null,
            null,
          ]
        );
        await client.query(
          "DELETE FROM cc_selection_options WHERE column_id = $1",
          [columnId]
        );
        await client.query(
          "DELETE FROM cc_label_options WHERE column_id = $1",
          [columnId]
        );
        if (config.fieldType === "selection" && config.selections?.length) {
          for (const [order, selection] of config.selections.entries()) {
            await client.query(
              `INSERT INTO cc_selection_options (
                 column_id,
                 selection_id,
                 selection_name,
                 selection_color,
                 selection_order
               ) VALUES ($1,$2,$3,$4,$5)`,
              [columnId, selection.id, selection.name, selection.color, order]
            );
          }
        }
      };

      const ensureCustomColumn = async (
        plan: CustomColumnPlan,
        config: ColumnPlanConfig
      ): Promise<CustomColumnRef | null> => {
        const existing = customColumnMap.get(plan.key);
        if (existing) {
          await client.query(
            `UPDATE cc_custom_columns
             SET name = $1,
                 field_type = $2,
                 updated_at = NOW()
             WHERE id = $3`,
            [plan.name, config.fieldType, existing.id]
          );
          await configureColumnMetadata(existing.id, plan, config);
          const column = {
            id: existing.id,
            key: plan.key,
            fieldType: config.fieldType,
          };
          customColumnMap.set(plan.key, column);
          return column;
        }

        const columnResult = await client.query(
          `INSERT INTO cc_custom_columns (
             project_id,
             name,
             key,
             field_type,
             width,
             is_visible,
             is_custom_column
           ) VALUES ($1,$2,$3,$4,$5,$6,true)
           RETURNING id;`,
          [
            job.target_project_id,
            plan.name,
            plan.key,
            config.fieldType,
            150,
            true,
          ]
        );
        const columnId = columnResult.rows[0]?.id;
        if (!columnId) return null;

        await configureColumnMetadata(columnId, plan, config);
        const column = {
          id: columnId,
          key: plan.key,
          fieldType: config.fieldType,
        };
        customColumnMap.set(plan.key, column);
        return column;
      };

      const insertCustomColumnValue = async (
        taskId: string,
        column: CustomColumnRef,
        customValue: CustomFieldValuePlan,
        config?: ColumnPlanConfig
      ) => {
        const effectiveConfig = config || customColumnConfigs.get(column.key);
        const fieldType = effectiveConfig?.fieldType || column.fieldType;
        const normalizedValue = sanitizeSampleValue(customValue.value);

        let textValue: string | null = null;
        let numberValue: number | null = null;
        let dateValue: Date | null = null;
        let booleanValue: boolean | null = null;
        let jsonValue: string | null = null;

        switch (fieldType) {
          case "number": {
            if (!normalizedValue) break;
            const numericValue = Number(normalizedValue);
            if (!Number.isFinite(numericValue)) break;
            numberValue = numericValue;
            break;
          }
          case "date": {
            if (!normalizedValue) break;
            const parsed = new Date(normalizedValue);
            if (Number.isNaN(parsed.getTime())) break;
            dateValue = parsed;
            break;
          }
          case "checkbox": {
            if (!normalizedValue) break;
            const coerced = coerceBooleanValue(normalizedValue);
            if (coerced === null) break;
            booleanValue = coerced;
            break;
          }
          case "selection": {
            if (!normalizedValue) break;
            const selectionId =
              effectiveConfig?.valueToSelectionId?.get(normalizedValue) ||
              normalizedValue;
            textValue = selectionId;
            break;
          }
          case "people": {
            if (!normalizedValue) break;
            jsonValue = JSON.stringify([normalizedValue]);
            break;
          }
          default: {
            if (!normalizedValue) break;
            textValue = normalizedValue;
          }
        }

        if (
          textValue === null &&
          numberValue === null &&
          dateValue === null &&
          booleanValue === null &&
          jsonValue === null
        ) {
          return;
        }

        await client.query(
          `INSERT INTO cc_column_values (
             task_id,
             column_id,
             text_value,
             number_value,
             date_value,
             boolean_value,
             json_value,
             created_at,
             updated_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())`,
          [
            taskId,
            column.id,
            textValue,
            numberValue,
            dateValue,
            booleanValue,
            jsonValue,
          ]
        );
      };

      for (const plan of customColumnPlans.values()) {
        const config =
          customColumnConfigs.get(plan.key) || inferColumnConfig(plan);
        customColumnConfigs.set(plan.key, config);
        await ensureCustomColumn(plan, config);
      }

      const createdTasks: any[] = [];
      const sourceToId = new Map<string, string>();
      const roots = staged.filter((task: any) => !task.parent_source_task_id);
      const deferred = staged.filter((task: any) => task.parent_source_task_id);

      const lookupStatusId = (value?: string | null): string | null => {
        if (!value) return defaultStatusId;
        const key = value.toString().trim().toLowerCase();
        const match = statusMap.get(key) || null;
        return match || defaultStatusId;
      };

      const parseDateValue = (value?: string | null): Date | null => {
        if (!value) return null;
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
      };

      const getRawCompletedValue = (raw: unknown): string | null => {
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
        const source = raw as Record<string, unknown>;
        const normalizedEntries = Object.entries(source).map(
          ([key, value]) => ({
            key: key.trim().toLowerCase(),
            value,
          })
        );
        const candidates = new Set([
          "completed on",
          "completed_on",
          "completed date",
          "completeddate",
          "completed",
        ]);
        for (const entry of normalizedEntries) {
          if (!candidates.has(entry.key)) continue;
          if (typeof entry.value === "string" && entry.value.trim()) {
            return entry.value;
          }
        }
        return null;
      };

      const finalizeTaskCompletion = async (
        taskId: string,
        statusId: string | null,
        completedDate: Date | null
      ) => {
        const shouldMarkDone =
          (statusId && doneStatusIds.has(statusId)) || !!completedDate;
        if (!shouldMarkDone) return;
        await client.query(
          `UPDATE tasks
             SET done = TRUE,
                 completed_at = CASE
                   WHEN $2 IS NOT NULL THEN $2
                   WHEN completed_at IS NULL THEN NOW()
                   ELSE completed_at
                 END
           WHERE id = $1`,
          [taskId, completedDate ? completedDate.toISOString() : null]
        );
      };

      const resolvePriorityId = (value?: string | null) => {
        if (!value) return defaultPriorityId;
        const key = value.toString().trim().toLowerCase();
        return priorityMap.get(key) || defaultPriorityId;
      };

      const resolveAssignees = (value?: string | null) => {
        if (!value) return [] as string[];
        const normalized = value.toString().trim();
        if (!normalized) return [] as string[];
        const lower = normalized.toLowerCase();
        const direct = assigneeMap.get(normalized);
        const emailMatch = assigneeMap.get(lower);
        const teamMemberId =
          direct || emailMatch || teamMemberEmailMap.get(lower);
        return teamMemberId ? [teamMemberId] : [];
      };

      const createTask = async (task: any, parentId?: string | null) => {
        const { patch, customValues } = mapRawToTaskFields(
          task.raw,
          activeFieldMappings
        );
        const taskWithMappings = { ...task, ...patch } as any;
        // eslint-disable-next-line no-console
        console.log("[createTask] Task title:", task.title);
        // eslint-disable-next-line no-console
        console.log(
          "[createTask] taskWithMappings.created_at:",
          taskWithMappings.created_at
        );
        // eslint-disable-next-line no-console
        console.log(
          "[createTask] taskWithMappings.updated_at:",
          taskWithMappings.updated_at
        );
        let statusId = lookupStatusId(taskWithMappings.status);
        const completedValue =
          typeof taskWithMappings.completed_at === "string" &&
          taskWithMappings.completed_at.trim()
            ? taskWithMappings.completed_at
            : getRawCompletedValue(task.raw);
        const completedDate = parseDateValue(completedValue);
        if (
          completedDate &&
          defaultDoneStatusId &&
          (!statusId || !doneStatusIds.has(statusId))
        ) {
          statusId = defaultDoneStatusId;
        }

        const payload: Record<string, unknown> = {
          name: task.title,
          project_id: job.target_project_id,
          team_id: targetTeamId,
          description: taskWithMappings.description,
          start: taskWithMappings.start_at,
          end: taskWithMappings.due_at,
          total_minutes: 0,
          reporter_id: job.created_by,
          status_id: statusId,
          priority_id: resolvePriorityId(taskWithMappings.priority_label),
          parent_task_id: parentId || null,
          assignees: resolveAssignees(taskWithMappings.assignee_source_id),
        };

        const result = await client.query("SELECT create_task($1) AS task;", [
          JSON.stringify(payload),
        ]);
        const created = result.rows[0]?.task || null;
        // eslint-disable-next-line no-console
        console.log("[createTask] Task created with ID:", created?.id);
        // eslint-disable-next-line no-console
        console.log(
          "[createTask] Initial created.created_at from DB:",
          created?.created_at
        );
        if (
          created?.id &&
          (taskWithMappings.created_at || taskWithMappings.updated_at)
        ) {
          const createdAt = taskWithMappings.created_at
            ? new Date(taskWithMappings.created_at)
            : null;
          const updatedAt = taskWithMappings.updated_at
            ? new Date(taskWithMappings.updated_at)
            : null;
          // eslint-disable-next-line no-console
          console.log(
            "[createTask] About to UPDATE - createdAt:",
            createdAt?.toISOString(),
            "updatedAt:",
            updatedAt?.toISOString()
          );
          const updateResult = await client.query(
            `UPDATE tasks
               SET created_at = COALESCE($2, created_at),
                   updated_at = COALESCE($3, updated_at)
             WHERE id = $1
             RETURNING created_at, updated_at`,
            [
              created.id,
              createdAt && !isNaN(createdAt.valueOf())
                ? createdAt.toISOString()
                : null,
              updatedAt && !isNaN(updatedAt.valueOf())
                ? updatedAt.toISOString()
                : null,
            ]
          );
          // eslint-disable-next-line no-console
          console.log(
            "[createTask] UPDATE complete - new values:",
            updateResult.rows[0]
          );
        } else {
          // eslint-disable-next-line no-console
          console.log(
            "[createTask] Skipping timestamp update - created?.id:",
            created?.id,
            "has timestamps:",
            !!(taskWithMappings.created_at || taskWithMappings.updated_at)
          );
        }
        if (created?.id && task.source_task_id) {
          sourceToId.set(task.source_task_id, created.id);
        }
        if (created?.id) {
          await finalizeTaskCompletion(created.id, statusId, completedDate);
          if (completedDate && created) {
            created.completed_at = completedDate.toISOString();
          }
        }
        createdTasks.push(created);

        if (created?.id && customValues.length) {
          for (const customValue of customValues) {
            let plan = customColumnPlans.get(customValue.columnKey);
            let config = customColumnConfigs.get(customValue.columnKey);

            if (!plan) {
              plan = {
                key: customValue.columnKey,
                name: customValue.columnName,
                sourceField: customValue.columnName,
                samples: new Set<string>([
                  sanitizeSampleValue(customValue.value),
                ]),
              };
              customColumnPlans.set(customValue.columnKey, plan);
              config = inferColumnConfig(plan);
              customColumnConfigs.set(customValue.columnKey, config);
            }

            if (!config && plan) {
              config = inferColumnConfig(plan);
              customColumnConfigs.set(plan.key, config);
            }

            const column =
              customColumnMap.get(customValue.columnKey) ||
              (plan && config ? await ensureCustomColumn(plan, config) : null);
            if (!column) continue;

            await insertCustomColumnValue(
              created.id,
              column,
              customValue,
              config
            );
          }
        }
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
        const unresolved = deferred.length;
        await this.appendLog(jobId, "warning", "Unresolved parent tasks", {
          unresolved,
        });
        for (const task of deferred) {
          await createTask(task, null);
        }
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
