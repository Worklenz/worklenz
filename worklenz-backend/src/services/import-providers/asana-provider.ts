import { ImportProvider, ProviderResult } from "./provider-types";
import { ImportJob, StageTaskRow, UserMappingRow } from "../imports-service";
import { getWithRetries } from "./http-utils";
import db from "../../config/db";

interface AsanaTask {
  gid: string;
  name: string;
  notes?: string;
  due_on?: string;
  due_at?: string;
  start_on?: string;
  assignee?: {
    gid: string | null;
    name?: string | null;
    email?: string | null;
  };
  created_by?: {
    gid?: string | null;
    name?: string | null;
    email?: string | null;
  } | null;
  created_at?: string;
  modified_at?: string;
  completed_at?: string;
  completed?: boolean;
  likes?: Array<{
    user?: {
      gid?: string | null;
      name?: string | null;
      email?: string | null;
    } | null;
  }>;
  num_likes?: number | null;
  custom_fields?: Array<AsanaCustomFieldValue>;
  memberships?: Array<{
    section?: { gid?: string; name?: string | null } | null;
  }>;
}

interface AsanaCustomFieldValue {
  gid: string;
  name?: string;
  type?: string;
  text_value?: string | null;
  number_value?: number | null;
  display_value?: string | null;
  enum_value?: { gid?: string; name?: string | null } | null;
}

interface AsanaTaskResponse {
  data: AsanaTask[];
  next_page?: { offset?: string | null };
}

interface AsanaOptions {
  token?: string;
  projectId?: string;
  projectName?: string | null;
  workspaceId?: string | null;
}

interface AsanaCustomFieldSetting {
  custom_field?: {
    gid: string;
    name?: string;
    type?: string;
    enum_options?: Array<{ name?: string | null }> | null;
  };
}

interface AsanaCustomFieldSettingsResponse {
  data: AsanaCustomFieldSetting[];
  next_page?: { offset?: string | null };
}

interface FieldMappingRow {
  source_field: string;
  target_field: string;
  required?: boolean;
  include?: boolean;
}

const STANDARD_FIELD_CANDIDATES: Array<{
  name: string;
  target: string;
  required?: boolean;
}> = [
  { name: "Task name", target: "key", required: true },
  { name: "Description", target: "description" },
  { name: "Assignee", target: "assignees" },
  { name: "Start date", target: "startDate" },
  { name: "Due date", target: "dueDate" },
  { name: "Section", target: "status" },
  { name: "Created by", target: "reporter" },
  { name: "Priority", target: "priority" },
  { name: "Likes", target: "likes" },
  { name: "Alphabetical", target: "alphabetical" },
  { name: "Completed on", target: "completedDate" },
];

const SECTION_FALLBACK = [
  { source_level: "Section", target_level: "Status", position: 1 },
  { source_level: "Task", target_level: "Task", position: 2 },
  { source_level: "Subtask", target_level: "Subtask", position: 3 },
  { source_level: "Nested subtask", target_level: "Subtask", position: 4 },
];

export default class AsanaProvider implements ImportProvider {
  name = "asana";

  private resolveOptions(
    job: ImportJob,
    payload?: Record<string, unknown>
  ): Required<Pick<AsanaOptions, "projectId" | "token">> & AsanaOptions {
    const ref = (job.source_reference as any) || {};
    const payloadRef = (payload?.sourceReference as AsanaOptions) || {};
    const providerKey = (job.provider || "asana").toLowerCase();
    const auth = (ref.auth?.[providerKey] as any) || {};
    const sourceSelection =
      (ref.source?.[providerKey] as any) || (ref.source as any) || {};

    const token = payloadRef.token || auth.access_token;
    const projectId =
      payloadRef.projectId || sourceSelection.projectId || ref.projectId;
    const projectName =
      payloadRef.projectName || sourceSelection.projectName || ref.projectName;
    const workspaceId =
      payloadRef.workspaceId ||
      sourceSelection.workspaceId ||
      ref.workspaceId ||
      null;

    if (!token || !projectId) {
      throw new Error("Missing Asana token or project selection");
    }

    return { token, projectId, projectName, workspaceId };
  }

  private async fetchCustomFieldSettings(
    token: string,
    projectId: string
  ): Promise<AsanaCustomFieldSetting[]> {
    const collected: AsanaCustomFieldSetting[] = [];
    let offset: string | undefined;
    do {
      const resp = await getWithRetries<AsanaCustomFieldSettingsResponse>({
        method: "GET",
        url: `https://app.asana.com/api/1.0/projects/${projectId}/custom_field_settings`,
        params: {
          limit: 50,
          offset,
          opt_fields:
            "custom_field.name,custom_field.type,custom_field.enum_options.name,custom_field.gid",
        },
        headers: { Authorization: `Bearer ${token}` },
      });
      collected.push(...(resp.data || []));
      offset = resp.next_page?.offset || undefined;
    } while (offset);
    return collected;
  }

  private guessTargetField(name?: string | null): string {
    const normalized = (name || "").toLowerCase();
    if (normalized.includes("due")) return "dueDate";
    if (normalized.includes("start")) return "startDate";
    if (normalized.includes("assignee") || normalized.includes("owner"))
      return "assignees";
    if (normalized.includes("reporter") || normalized.includes("created by"))
      return "reporter";
    if (normalized.includes("status") || normalized.includes("state"))
      return "status";
    if (normalized.includes("priority")) return "priority";
    if (normalized.includes("created")) return "createdDate";
    if (normalized.includes("modified") || normalized.includes("updated"))
      return "lastUpdated";
    if (normalized.includes("completed") || normalized.includes("done"))
      return "completedDate";
    if (normalized.includes("description") || normalized.includes("notes"))
      return "description";
    return name || "Custom field";
  }

  private buildFieldMappings(
    customFields: AsanaCustomFieldSetting[]
  ): FieldMappingRow[] {
    const rows: FieldMappingRow[] = STANDARD_FIELD_CANDIDATES.map(
      ({ name, target, required }) => ({
        source_field: name,
        target_field: target,
        required: required ?? false,
        include: true,
      })
    );

    customFields.forEach((setting) => {
      const name = setting.custom_field?.name;
      if (!name) return;
      const target = this.guessTargetField(name);
      // Avoid duplicates by source field
      if (rows.some((row) => row.source_field === name)) return;
      rows.push({ source_field: name, target_field: target, include: true });
    });

    return rows;
  }

  private pickPrimarySection(task: AsanaTask): string | null {
    const membership = task.memberships?.find((entry) => entry.section?.name);
    return membership?.section?.name || null;
  }

  private async findTeamUserIds(
    job: ImportJob,
    emails: string[]
  ): Promise<Map<string, string>> {
    if (!emails.length) return new Map();
    const normalized = emails.map((email) => email.toLowerCase());
    const { rows } = await db.query(
      "SELECT active_team FROM users WHERE id = $1",
      [job.created_by]
    );
    let teamId = rows[0]?.active_team || null;

    if (!teamId && job.target_project_id) {
      const { rows: projectRows } = await db.query(
        "SELECT team_id FROM projects WHERE id = $1",
        [job.target_project_id]
      );
      teamId = projectRows[0]?.team_id || null;
    }

    if (!teamId) return new Map();

    const { rows: teamRows } = await db.query(
      `SELECT LOWER(u.email) AS email, tm.id AS team_member_id
         FROM team_members tm
         INNER JOIN users u ON u.id = tm.user_id
         WHERE tm.team_id = $2
           AND LOWER(u.email) = ANY($1)`,
      [normalized, teamId]
    );
    return new Map(teamRows.map((row: any) => [row.email, row.team_member_id]));
  }

  private async buildUserMappings(
    job: ImportJob,
    assignees: Map<
      string,
      { source_user_id?: string | null; source_email?: string | null }
    >
  ): Promise<UserMappingRow[]> {
    if (!assignees.size) return [];
    const emails = Array.from(assignees.keys());
    const targetMap = await this.findTeamUserIds(job, emails);
    return emails.map((email) => {
      const record = assignees.get(email) || {};
      const targetId = targetMap.get(email);
      return {
        source_user_id: record.source_user_id || null,
        source_email: record.source_email || null,
        target_user_id: targetId || null,
        resolution: targetId ? "auto-matched" : "unresolved",
        include: true,
      } as UserMappingRow;
    });
  }

  private formatCustomFieldValue(
    setting: AsanaCustomFieldSetting,
    value?: AsanaCustomFieldValue
  ): string | number | null {
    if (!value) return null;
    if (value.display_value !== undefined && value.display_value !== null) {
      return value.display_value;
    }
    if (value.text_value !== undefined && value.text_value !== null) {
      return value.text_value;
    }
    if (value.number_value !== undefined && value.number_value !== null) {
      return value.number_value;
    }
    if (value.enum_value?.name) return value.enum_value.name;
    if (setting.custom_field?.enum_options?.length) {
      const matched = setting.custom_field.enum_options.find(
        (opt) => opt.name && opt.name === value.name
      );
      if (matched?.name) return matched.name;
    }
    return null;
  }

  private buildRawTask(
    task: AsanaTask,
    customFields: AsanaCustomFieldSetting[],
    projectName?: string | null
  ): Record<string, unknown> {
    const primarySection = this.pickPrimarySection(task);
    const dueDisplay = task.due_at || task.due_on || "";
    const createdBy = task.created_by?.email || task.created_by?.name || "";
    const likesCount =
      typeof task.num_likes === "number"
        ? task.num_likes
        : task.likes?.length ?? null;
    const alphabeticalValue = task.name || "";
    const statusLabel = primarySection || (task.completed ? "Completed" : "");
    const raw: Record<string, unknown> = {
      "Task name": task.name || "",
      Description: task.notes || "",
      Assignee: task.assignee?.email || task.assignee?.name || "",
      "Assignee name": task.assignee?.name || "",
      "Assignee gid": task.assignee?.gid || "",
      "Start date": task.start_on || "",
      "Due date": dueDisplay,
      "Created by": createdBy,
      "Created on": task.created_at || "",
      "Last modified on": task.modified_at || "",
      "Completed on": task.completed_at || "",
      Likes: likesCount !== null ? String(likesCount) : "",
      Alphabetical: alphabeticalValue,
      Priority: "",
      Status: statusLabel || "",
      Project: projectName || "",
    };

    const valueMap = new Map<string, AsanaCustomFieldValue>();
    (task.custom_fields || []).forEach((cf) => {
      if (cf.gid) valueMap.set(cf.gid, cf);
    });

    customFields.forEach((setting) => {
      const name = setting.custom_field?.name;
      const gid = setting.custom_field?.gid;
      if (!name || !gid) return;
      const value = this.formatCustomFieldValue(setting, valueMap.get(gid));
      raw[name] = value ?? "";
      if (name.toLowerCase() === "priority" && value !== undefined) {
        raw["Priority"] = value ?? "";
      }
    });

    return raw;
  }

  private async buildHierarchy(
    token: string,
    projectId: string
  ): Promise<NonNullable<ProviderResult["hierarchy"]>> {
    try {
      const resp = await getWithRetries<{ data: Array<{ name: string }> }>({
        method: "GET",
        url: `https://app.asana.com/api/1.0/projects/${projectId}/sections`,
        headers: { Authorization: `Bearer ${token}` },
      });

      const sections = resp.data || [];
      if (!sections.length) return SECTION_FALLBACK;

      return sections.map((section, idx) => ({
        source_level: section.name || `Section ${idx + 1}`,
        target_level: "Status",
        position: idx + 1,
      }));
    } catch (err) {
      // On failure, fall back to defaults
      return SECTION_FALLBACK;
    }
  }

  async getAutoMappings(
    job: ImportJob,
    payload?: Record<string, unknown>
  ): Promise<ProviderResult> {
    const { token, projectId, projectName, workspaceId } = this.resolveOptions(
      job,
      payload
    );
    const customFields = await this.fetchCustomFieldSettings(token, projectId);
    const fields = this.buildFieldMappings(customFields);
    const hierarchy = await this.buildHierarchy(token, projectId);
    return {
      fields,
      hierarchy,
      raw: { projectId, projectName, workspaceId },
    };
  }

  async ingest(
    job: ImportJob,
    payload?: Record<string, unknown>
  ): Promise<ProviderResult> {
    let options: ReturnType<AsanaProvider["resolveOptions"]>;
    try {
      options = this.resolveOptions(job, payload);
    } catch (err) {
      return { tasks: [], raw: { warning: (err as Error)?.message } };
    }

    const customFieldSettings = await this.fetchCustomFieldSettings(
      options.token,
      options.projectId
    );
    const fieldMappings = this.buildFieldMappings(customFieldSettings);
    const tasks: StageTaskRow[] = [];
    const assigneeDirectory = new Map<
      string,
      { source_user_id?: string | null; source_email?: string | null }
    >();
    let offset: string | undefined;
    const optFields = [
      "gid",
      "name",
      "notes",
      "due_on",
      "due_at",
      "start_on",
      "assignee.gid",
      "assignee.name",
      "assignee.email",
      "created_by.gid",
      "created_by.name",
      "created_by.email",
      "created_at",
      "modified_at",
      "completed_at",
      "completed",
      "likes.user.name",
      "likes.user.email",
      "num_likes",
      "custom_fields.gid",
      "custom_fields.name",
      "custom_fields.type",
      "custom_fields.text_value",
      "custom_fields.number_value",
      "custom_fields.display_value",
      "custom_fields.enum_value.name",
      "memberships.section.name",
      "memberships.section.gid",
    ];

    do {
      const page = await getWithRetries<AsanaTaskResponse>({
        method: "GET",
        url: `https://app.asana.com/api/1.0/projects/${options.projectId}/tasks`,
        params: { limit: 50, offset, opt_fields: optFields.join(",") },
        headers: { Authorization: `Bearer ${options.token}` },
      });

      for (const t of page.data || []) {
        const raw = this.buildRawTask(
          t,
          customFieldSettings,
          options.projectName
        );
        const primarySection = this.pickPrimarySection(t);
        const normalizedEmail = t.assignee?.email?.toLowerCase();
        if (normalizedEmail) {
          if (!assigneeDirectory.has(normalizedEmail)) {
            assigneeDirectory.set(normalizedEmail, {
              source_user_id: t.assignee?.gid || null,
              source_email: t.assignee?.email || null,
            });
          }
        }
        const resolvedStatus =
          primarySection || (t.completed ? "Completed" : null);
        tasks.push({
          source_task_id: t.gid,
          title: t.name || "Untitled task",
          description: t.notes || null,
          due_at: t.due_at || t.due_on || null,
          start_at: t.start_on || null,
          status: resolvedStatus || null,
          assignee_source_id: t.assignee?.email || t.assignee?.gid || null,
          worktype: resolvedStatus || null,
          raw,
        });
      }
      offset = page.next_page?.offset || undefined;
    } while (offset);

    const hierarchy = await this.buildHierarchy(
      options.token,
      options.projectId
    );
    const users = await this.buildUserMappings(job, assigneeDirectory);

    return { tasks, fields: fieldMappings, hierarchy, users };
  }
}
