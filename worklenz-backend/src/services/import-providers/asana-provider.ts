import { ImportProvider, ProviderResult } from "./provider-types";
import { ImportJob, StageTaskRow } from "../imports-service";
import { getWithRetries } from "./http-utils";

interface AsanaTask {
  gid: string;
  name: string;
  notes?: string;
  due_on?: string;
  start_on?: string;
  assignee?: {
    gid: string | null;
    name?: string | null;
    email?: string | null;
  };
  created_at?: string;
  modified_at?: string;
  completed_at?: string;
  custom_fields?: Array<AsanaCustomFieldValue>;
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
  { name: "Due date", target: "dueDate" },
  { name: "Start date", target: "startDate" },
  { name: "Created at", target: "createdDate" },
  { name: "Modified at", target: "lastUpdated" },
  { name: "Completed at", target: "completedDate" },
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
    const raw: Record<string, unknown> = {
      "Task name": task.name || "",
      Description: task.notes || "",
      Assignee: task.assignee?.email || task.assignee?.name || "",
      "Assignee name": task.assignee?.name || "",
      "Assignee gid": task.assignee?.gid || "",
      "Due date": task.due_on || "",
      "Start date": task.start_on || "",
      "Created at": task.created_at || "",
      "Modified at": task.modified_at || "",
      "Completed at": task.completed_at || "",
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
    let offset: string | undefined;
    const optFields = [
      "gid",
      "name",
      "notes",
      "due_on",
      "start_on",
      "assignee.gid",
      "assignee.name",
      "assignee.email",
      "created_at",
      "modified_at",
      "completed_at",
      "custom_fields.gid",
      "custom_fields.name",
      "custom_fields.type",
      "custom_fields.text_value",
      "custom_fields.number_value",
      "custom_fields.display_value",
      "custom_fields.enum_value.name",
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
        tasks.push({
          source_task_id: t.gid,
          title: t.name || "Untitled task",
          description: t.notes || null,
          due_at: t.due_on || null,
          start_at: t.start_on || null,
          assignee_source_id: t.assignee?.email || t.assignee?.gid || null,
          raw,
        });
      }
      offset = page.next_page?.offset || undefined;
    } while (offset);

    const hierarchy = await this.buildHierarchy(
      options.token,
      options.projectId
    );

    return { tasks, fields: fieldMappings, hierarchy };
  }
}
