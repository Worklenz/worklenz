import db from "../../config/db";
import {
  CommentExportSource,
  TaskExportCustomFieldDef,
  TaskExportSource,
} from "../task-export-csv";
import { TaskExportAttachmentRow } from "./types";

const mapAssignees = (raw: unknown): TaskExportSource["assignees"] => {
  if (!raw) return [];
  if (typeof raw === "string") {
    try {
      return mapAssignees(JSON.parse(raw));
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    if (typeof item === "string") return item;
    if (item && typeof item === "object" && "name" in item) {
      return { name: String((item as { name?: string }).name || "") };
    }
    return { name: "" };
  });
};

const mapLabels = (raw: unknown): TaskExportSource["labels"] => mapAssignees(raw);

const parseCustomValues = (raw: unknown): Record<string, unknown> => {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (typeof raw === "object") return raw as Record<string, unknown>;
  return {};
};

/**
 * The project key is constant for an entire export — fetched once here
 * instead of via a correlated subquery re-evaluated per output row.
 */
const fetchProjectKey = async (projectId: string): Promise<string> => {
  const { rows } = await db.query(
    `SELECT key FROM projects WHERE id = $1::UUID LIMIT 1`,
    [projectId]
  );
  return String(rows[0]?.key || "");
};

export const fetchProjectCustomFields = async (
  projectId: string
): Promise<TaskExportCustomFieldDef[]> => {
  const { rows } = await db.query(
    `SELECT key, name, field_type
     FROM cc_custom_columns
     WHERE project_id = $1::UUID
     ORDER BY created_at ASC`,
    [projectId]
  );
  return rows.map((row: { key: string; name: string; field_type: string }) => ({
    key: row.key,
    name: row.name,
    field_type: row.field_type,
  }));
};

/**
 * Loads tasks for export. When taskIds is provided, only those tasks are included.
 */
export const fetchTasksForExport = async (
  projectId: string,
  taskIds?: string[] | null
): Promise<TaskExportSource[]> => {
  const projectKey = await fetchProjectKey(projectId);
  const params: unknown[] = [projectId, projectKey];
  let taskFilter = "";
  if (taskIds && taskIds.length > 0) {
    params.push(taskIds);
    taskFilter = `AND t.id = ANY($3::UUID[])`;
  }

  const q = `
    SELECT
      t.id,
      $2 || '-' || t.task_no AS task_key,
      t.name,
      t.description,
      (SELECT name FROM task_statuses WHERE id = t.status_id) AS status_name,
      (SELECT name FROM task_priorities WHERE id = t.priority_id) AS priority_name,
      (SELECT name FROM project_phases
         WHERE id = (SELECT phase_id FROM task_phase WHERE task_id = t.id LIMIT 1)) AS phase_name,
      COALESCE(get_task_assignees(t.id), '[]'::JSON) AS assignees,
      (SELECT name FROM users WHERE id = t.reporter_id) AS reporter,
      COALESCE((
        SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(l))), '[]'::JSON)
        FROM (
          SELECT tl.name
          FROM task_labels tlb
          JOIN team_labels tl ON tl.id = tlb.label_id
          WHERE tlb.task_id = t.id
        ) l
      ), '[]'::JSON) AS labels,
      t.start_date,
      t.end_date,
      t.completed_at,
      t.total_minutes,
      (SELECT COALESCE(SUM(time_spent), 0) FROM task_work_log WHERE task_id = t.id) AS time_spent_seconds,
      t.progress_value AS progress,
      (
        SELECT $2 || '-' || pt.task_no
        FROM tasks pt
        WHERE pt.id = t.parent_task_id
      ) AS parent_task_key,
      (t.parent_task_id IS NOT NULL) AS is_sub_task,
      t.created_at,
      t.updated_at,
      (
        SELECT COALESCE(
          jsonb_object_agg(custom_cols.key, custom_cols.value),
          '{}'::JSONB
        )
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
          WHERE ccv.task_id = t.id AND cc.project_id = t.project_id
        ) AS custom_cols
        WHERE custom_cols.value IS NOT NULL
      ) AS custom_column_values
    FROM tasks t
    WHERE t.project_id = $1::UUID
      AND t.archived IS FALSE
      ${taskFilter}
    ORDER BY t.task_no ASC
  `;

  const { rows } = await db.query(q, params);

  return rows.map((row: Record<string, unknown>) => ({
    task_key: String(row.task_key || ""),
    name: String(row.name || ""),
    description: (row.description as string) || null,
    status_name: (row.status_name as string) || null,
    priority_name: (row.priority_name as string) || null,
    phase_name: (row.phase_name as string) || null,
    assignees: mapAssignees(row.assignees),
    reporter: (row.reporter as string) || null,
    labels: mapLabels(row.labels),
    start_date: (row.start_date as string) || null,
    end_date: (row.end_date as string) || null,
    completed_at: (row.completed_at as string) || null,
    total_minutes: row.total_minutes as number | string | null,
    time_spent_seconds: row.time_spent_seconds as number | string | null,
    progress: row.progress as number | string | null,
    parent_task_key: (row.parent_task_key as string) || null,
    is_sub_task: Boolean(row.is_sub_task),
    created_at: (row.created_at as string) || null,
    updated_at: (row.updated_at as string) || null,
    custom_column_values: parseCustomValues(row.custom_column_values),
  }));
};

export const fetchCommentsForExport = async (
  projectId: string,
  taskIds?: string[] | null
): Promise<CommentExportSource[]> => {
  // TE-30: INNER JOIN task_comments — tasks with zero comments never appear.
  const projectKey = await fetchProjectKey(projectId);
  const params: unknown[] = [projectId, projectKey];
  let taskFilter = "";
  if (taskIds && taskIds.length > 0) {
    params.push(taskIds);
    taskFilter = `AND t.id = ANY($3::UUID[])`;
  }

  const q = `
    SELECT
      $2 || '-' || t.task_no AS task_key,
      t.name AS task_name,
      COALESCE(
        (SELECT name FROM team_member_info_view WHERE team_member_id = tc.team_member_id),
        (SELECT name FROM users WHERE id = tc.user_id)
      ) AS author_name,
      tcc.text_content AS content,
      tc.created_at,
      tc.updated_at,
      tc.is_edited,
      (
        SELECT COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT('user_name', tmiv.name)
            ORDER BY tcm.mentioned_index
          ),
          '[]'::JSON
        )
        FROM task_comment_mentions tcm
        LEFT JOIN team_member_info_view tmiv
          ON tcm.informed_by = tmiv.team_member_id
        WHERE tcm.comment_id = tc.id
      ) AS mentions,
      (
        SELECT COALESCE(
          JSON_AGG(tca.name ORDER BY tca.created_at ASC),
          '[]'::JSON
        )
        FROM task_comment_attachments tca
        WHERE tca.comment_id = tc.id
      ) AS attachment_names
    FROM task_comments tc
    INNER JOIN tasks t ON t.id = tc.task_id
    LEFT JOIN task_comment_contents tcc ON tcc.comment_id = tc.id
    WHERE t.project_id = $1::UUID
      AND t.archived IS FALSE
      AND COALESCE(tc.is_deleted, FALSE) IS FALSE
      ${taskFilter}
    ORDER BY tc.created_at ASC
  `;

  const { rows } = await db.query(q, params);

  return rows.map((row: Record<string, unknown>) => {
    let mentions = row.mentions as CommentExportSource["mentions"];
    if (typeof mentions === "string") {
      try {
        mentions = JSON.parse(mentions) as CommentExportSource["mentions"];
      } catch {
        mentions = [];
      }
    }

    let attachmentNames = row.attachment_names as unknown;
    if (typeof attachmentNames === "string") {
      try {
        attachmentNames = JSON.parse(attachmentNames);
      } catch {
        attachmentNames = [];
      }
    }
    const names = Array.isArray(attachmentNames)
      ? attachmentNames.map((name) => String(name || "")).filter(Boolean)
      : [];

    return {
      task_key: String(row.task_key || ""),
      task_name: String(row.task_name || ""),
      author_name: (row.author_name as string) || null,
      content: (row.content as string) || null,
      created_at: (row.created_at as string) || null,
      updated_at: (row.updated_at as string) || null,
      is_edited: Boolean(row.is_edited),
      mentions: mentions || [],
      attachment_names: names,
    };
  });
};

export const fetchAttachmentsForExport = async (
  projectId: string,
  taskIds?: string[] | null
): Promise<TaskExportAttachmentRow[]> => {
  // Includes task_attachments and task_comment_attachments (images/files on comments).
  // TE-31: only rows with attachments; bundler never invents empty task folders.
  const projectKey = await fetchProjectKey(projectId);
  const params: unknown[] = [projectId, projectKey];
  let taskFilterTask = "";
  let taskFilterComment = "";
  if (taskIds && taskIds.length > 0) {
    params.push(taskIds);
    taskFilterTask = `AND ta.task_id = ANY($3::UUID[])`;
    taskFilterComment = `AND tca.task_id = ANY($3::UUID[])`;
  }

  const q = `
    SELECT
      ta.id,
      ta.name,
      ta.type,
      ta.size,
      ta.task_id,
      $2 || '-' || t.task_no AS task_key,
      ta.team_id,
      ta.project_id,
      'task'::TEXT AS source,
      NULL::UUID AS comment_id,
      ta.created_at
    FROM task_attachments ta
    INNER JOIN tasks t ON t.id = ta.task_id
    WHERE ta.project_id = $1::UUID
      AND t.archived IS FALSE
      ${taskFilterTask}

    UNION ALL

    SELECT
      tca.id,
      tca.name,
      tca.type,
      tca.size,
      tca.task_id,
      $2 || '-' || t.task_no AS task_key,
      tca.team_id,
      tca.project_id,
      'comment'::TEXT AS source,
      tca.comment_id,
      tca.created_at
    FROM task_comment_attachments tca
    INNER JOIN tasks t ON t.id = tca.task_id
    INNER JOIN task_comments tc ON tc.id = tca.comment_id
    WHERE tca.project_id = $1::UUID
      AND t.archived IS FALSE
      AND COALESCE(tc.is_deleted, FALSE) IS FALSE
      ${taskFilterComment}

    ORDER BY task_key ASC, created_at ASC
  `;

  const { rows } = await db.query(q, params);
  return rows.map((row: Record<string, unknown>) => ({
    id: String(row.id),
    name: String(row.name || ""),
    type: String(row.type || ""),
    size: Number(row.size || 0),
    task_id: String(row.task_id),
    task_key: String(row.task_key || ""),
    team_id: String(row.team_id),
    project_id: String(row.project_id),
    source: row.source === "comment" ? "comment" : "task",
    comment_id: row.comment_id ? String(row.comment_id) : null,
  }));
};
