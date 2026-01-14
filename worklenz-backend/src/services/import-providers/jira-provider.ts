import { ImportProvider, ProviderResult } from "./provider-types";
import { ImportJob, StageTaskRow, UserMappingRow } from "../imports-service";
import { getWithRetries } from "./http-utils";
import db from "../../config/db";

interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    description?: any;
    created?: string;
    updated?: string;
    resolutiondate?: string;
    duedate?: string;
    startdate?: string;
    status?: {
      name?: string;
      statusCategory?: {
        key?: string;
        name?: string;
      };
    };
    priority?: {
      name?: string;
    };
    assignee?: {
      accountId?: string;
      displayName?: string;
      emailAddress?: string;
    };
    reporter?: {
      accountId?: string;
      displayName?: string;
      emailAddress?: string;
    };
    creator?: {
      accountId?: string;
      displayName?: string;
      emailAddress?: string;
    };
    labels?: string[];
    comment?: {
      comments?: Array<{ body?: string; author?: any; created?: string }>;
    };
    attachment?: Array<{ filename?: string; content?: string; size?: number }>;
    parent?: {
      id?: string;
      key?: string;
    };
    subtasks?: Array<{ id?: string; key?: string }>;
    timetracking?: {
      originalEstimate?: string;
      remainingEstimate?: string;
      timeSpent?: string;
    };
    progress?: {
      progress?: number;
      total?: number;
      percent?: number;
    };
    workratio?: number;
    environment?: string;
    fixVersions?: Array<{ name?: string }>;
    votes?: { votes?: number };
    watches?: { watchCount?: number };
    customfield_10020?: any; // Sprint field
    [key: string]: any; // For custom fields
  };
}

interface JiraSearchResponse {
  issues: JiraIssue[];
  startAt: number;
  maxResults: number;
  total: number;
}

interface JiraProject {
  id: string;
  key: string;
  name: string;
}

interface JiraOptions {
  token?: string;
  email?: string;
  domain?: string;
  projectKey?: string;
  projectName?: string | null;
}

interface FieldMappingRow {
  source_field: string;
  target_field: string;
  required?: boolean;
  include?: boolean;
}

interface JiraField {
  id: string;
  name: string;
  schema?: any;
  scope?: {
    type?: string;
    project?: { id?: string; key?: string };
  };
}

// JIRA standard field mappings to Worklenz
const STANDARD_FIELD_CANDIDATES: Array<{
  name: string;
  target: string;
  required?: boolean;
}> = [
  { name: "Summary", target: "key", required: true },
  { name: "Description", target: "description" },
  { name: "Assignee", target: "assignees" },
  { name: "Start date", target: "startDate" },
  { name: "Due date", target: "dueDate" },
  { name: "Status", target: "status" },
  { name: "Reporter", target: "reporter" },
  { name: "Priority", target: "priority" },
  { name: "Created", target: "createdDate" },
  { name: "Updated", target: "lastUpdated" },
  { name: "Resolved", target: "completedDate" },
  { name: "Labels", target: "labels" },
  { name: "Original estimate", target: "estimation" },
  { name: "Time Spent", target: "timeTracking" },
  { name: "Progress", target: "progress" },
  { name: "Key", target: "key" },
];

const STATUS_HIERARCHY_FALLBACK = [
  { source_level: "To Do", target_level: "Status", position: 1 },
  { source_level: "In Progress", target_level: "Status", position: 2 },
  { source_level: "Done", target_level: "Status", position: 3 },
  { source_level: "Issue", target_level: "Task", position: 4 },
  { source_level: "Sub-task", target_level: "Subtask", position: 5 },
];

export default class JiraProvider implements ImportProvider {
  name = "jira";

  private resolveOptions(
    job: ImportJob,
    payload?: Record<string, unknown>
  ): Required<Pick<JiraOptions, "token" | "email" | "domain" | "projectKey">> &
    JiraOptions {
    const ref = (job.source_reference as any) || {};
    const payloadRef = (payload?.sourceReference as JiraOptions) || {};
    const providerKey = (job.provider || "jira").toLowerCase();
    const auth = (ref.auth?.[providerKey] as any) || {};
    const sourceSelection =
      (ref.source?.[providerKey] as any) || (ref.source as any) || {};

    const token = payloadRef.token || auth.api_token || auth.access_token;
    const email = payloadRef.email || auth.email;
    const domain = payloadRef.domain || auth.domain || sourceSelection.domain;
    const projectKey =
      payloadRef.projectKey ||
      sourceSelection.projectKey ||
      sourceSelection.projectId ||
      ref.projectKey;
    const projectName =
      payloadRef.projectName || sourceSelection.projectName || ref.projectName;

    if (!token || !email || !domain || !projectKey) {
      throw new Error(
        "Missing JIRA credentials (token, email, domain) or project selection"
      );
    }

    return { token, email, domain, projectKey, projectName };
  }

  private buildAuthHeader(email: string, token: string): string {
    const credentials = Buffer.from(`${email}:${token}`).toString("base64");
    return `Basic ${credentials}`;
  }

  private guessTargetField(name?: string | null): string {
    const normalized = (name || "").toLowerCase();
    if (normalized.includes("due")) return "dueDate";
    if (normalized.includes("start")) return "startDate";
    if (normalized.includes("assignee")) return "assignees";
    if (normalized.includes("reporter")) return "reporter";
    if (normalized.includes("status")) return "status";
    if (normalized.includes("priority")) return "priority";
    if (normalized.includes("created")) return "createdDate";
    if (normalized.includes("updated") || normalized.includes("modified"))
      return "lastUpdated";
    if (normalized.includes("resolved") || normalized.includes("completed"))
      return "completedDate";
    if (normalized.includes("description")) return "description";
    if (normalized.includes("label")) return "labels";
    if (normalized.includes("estimate")) return "estimation";
    if (normalized.includes("time") && normalized.includes("spent"))
      return "timeTracking";
    if (normalized.includes("progress")) return "progress";
    return name || "Custom field";
  }

  private async fetchJiraFields(
    domain: string,
    email: string,
    token: string,
    projectKey: string
  ): Promise<JiraField[]> {
    try {
      const [project, fields] = await Promise.all([
        getWithRetries<{ id?: string }>({
          method: "GET",
          url: `https://${domain}/rest/api/3/project/${projectKey}`,
          headers: {
            Authorization: this.buildAuthHeader(email, token),
            Accept: "application/json",
          },
        }),
        getWithRetries<JiraField[]>({
          method: "GET",
          url: `https://${domain}/rest/api/3/field`,
          headers: {
            Authorization: this.buildAuthHeader(email, token),
            Accept: "application/json",
          },
        }),
      ]);

      const projectId = project?.id;
      const allFields = fields || [];
      if (!projectId) return allFields;

      return allFields.filter((field) => {
        const scopeProjectId = field.scope?.project?.id;
        if (!scopeProjectId) return true; // keep global/unscoped fields
        return scopeProjectId === projectId;
      });
    } catch (err) {
      return [];
    }
  }

  private buildFieldMappings(jiraFields: JiraField[]): FieldMappingRow[] {
    const rows: FieldMappingRow[] = STANDARD_FIELD_CANDIDATES.map(
      ({ name, target, required }) => ({
        source_field: name,
        target_field: target,
        required: required ?? false,
        include: true,
      })
    );

    // Add custom fields from JIRA
    jiraFields.forEach((field) => {
      const name = field.name;
      if (!name) return;

      // Skip if already in standard mappings
      if (
        rows.some(
          (row) => row.source_field.toLowerCase() === name.toLowerCase()
        )
      )
        return;

      const target = this.guessTargetField(name);
      rows.push({
        source_field: name,
        target_field: target,
        include: true,
      });
    });

    return rows;
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

  private formatDescription(description: any): string {
    if (!description) return "";
    if (typeof description === "string") return description;

    // Handle Atlassian Document Format (ADF)
    if (description.type === "doc" && Array.isArray(description.content)) {
      return this.extractTextFromADF(description);
    }

    return JSON.stringify(description);
  }

  private extractTextFromADF(doc: any): string {
    let text = "";

    const traverse = (node: any) => {
      if (node.text) {
        text += node.text;
      }
      if (node.content && Array.isArray(node.content)) {
        node.content.forEach((child: any) => traverse(child));
        if (node.type === "paragraph") text += "\n";
      }
    };

    traverse(doc);
    return text.trim();
  }

  private buildRawTask(
    issue: JiraIssue,
    projectName?: string | null
  ): Record<string, unknown> {
    const fields = issue.fields;
    const raw: Record<string, unknown> = {
      Key: issue.key || "",
      Summary: fields.summary || "",
      Description: this.formatDescription(fields.description),
      Assignee:
        fields.assignee?.emailAddress || fields.assignee?.displayName || "",
      "Assignee name": fields.assignee?.displayName || "",
      "Assignee id": fields.assignee?.accountId || "",
      Reporter:
        fields.reporter?.emailAddress || fields.reporter?.displayName || "",
      "Reporter name": fields.reporter?.displayName || "",
      Creator: fields.creator?.displayName || "",
      Priority: fields.priority?.name || "",
      Status: fields.status?.name || "",
      "Status Category": fields.status?.statusCategory?.name || "",
      "Start date": fields.startdate || "",
      "Due date": fields.duedate || "",
      Created: fields.created || "",
      Updated: fields.updated || "",
      Resolved: fields.resolutiondate || "",
      Labels: Array.isArray(fields.labels) ? fields.labels.join(", ") : "",
      "Original estimate": fields.timetracking?.originalEstimate || "",
      "Remaining Estimate": fields.timetracking?.remainingEstimate || "",
      "Time Spent": fields.timetracking?.timeSpent || "",
      Progress: fields.progress?.percent || "",
      "Work Ratio": fields.workratio || "",
      Environment: fields.environment || "",
      "Fix versions": Array.isArray(fields.fixVersions)
        ? fields.fixVersions.map((v) => v.name).join(", ")
        : "",
      Votes: fields.votes?.votes || 0,
      Watchers: fields.watches?.watchCount || 0,
      Project: projectName || "",
      Parent: fields.parent?.key || "",
      "Sub-tasks": Array.isArray(fields.subtasks) ? fields.subtasks.length : 0,
    };

    // Add custom fields
    Object.keys(fields).forEach((key) => {
      if (key.startsWith("customfield_")) {
        const value = fields[key];
        if (value !== null && value !== undefined) {
          raw[key] =
            typeof value === "object" ? JSON.stringify(value) : String(value);
        }
      }
    });

    return raw;
  }

  private async buildHierarchy(
    domain: string,
    email: string,
    token: string,
    projectKey: string
  ): Promise<NonNullable<ProviderResult["hierarchy"]>> {
    try {
      const resp = await getWithRetries<any>({
        method: "GET",
        url: `https://${domain}/rest/api/3/project/${projectKey}/statuses`,
        headers: {
          Authorization: this.buildAuthHeader(email, token),
          Accept: "application/json",
        },
      });

      const statuses: Array<{ name: string }> = [];

      if (Array.isArray(resp)) {
        resp.forEach((issueType: any) => {
          if (Array.isArray(issueType.statuses)) {
            issueType.statuses.forEach((status: any) => {
              if (
                status.name &&
                !statuses.find((s) => s.name === status.name)
              ) {
                statuses.push({ name: status.name });
              }
            });
          }
        });
      }

      if (!statuses.length) return STATUS_HIERARCHY_FALLBACK;

      return statuses.map((status, idx) => ({
        source_level: status.name,
        target_level: "Status",
        position: idx + 1,
      }));
    } catch (err) {
      return STATUS_HIERARCHY_FALLBACK;
    }
  }

  async getAutoMappings(
    job: ImportJob,
    payload?: Record<string, unknown>
  ): Promise<ProviderResult> {
    const { token, email, domain, projectKey, projectName } =
      this.resolveOptions(job, payload);
    const jiraFields = await this.fetchJiraFields(
      domain,
      email,
      token,
      projectKey
    );
    const fields = this.buildFieldMappings(jiraFields);
    const hierarchy = await this.buildHierarchy(
      domain,
      email,
      token,
      projectKey
    );
    return {
      fields,
      hierarchy,
      raw: { projectKey, projectName, domain },
    };
  }

  async ingest(
    job: ImportJob,
    payload?: Record<string, unknown>
  ): Promise<ProviderResult> {
    let options: ReturnType<JiraProvider["resolveOptions"]>;
    try {
      options = this.resolveOptions(job, payload);
    } catch (err) {
      return { tasks: [], raw: { warning: (err as Error)?.message } };
    }

    const jiraFields = await this.fetchJiraFields(
      options.domain,
      options.email,
      options.token,
      options.projectKey
    );
    const fieldMappings = this.buildFieldMappings(jiraFields);
    const tasks: StageTaskRow[] = [];
    const assigneeDirectory = new Map<
      string,
      { source_user_id?: string | null; source_email?: string | null }
    >();

    let startAt = 0;
    const maxResults = 50;
    let total = 0;

    // Fetch all issues from JIRA project
    do {
      const response = await getWithRetries<JiraSearchResponse>({
        method: "GET",
        //url: `https://${options.domain}/rest/api/3/search`,
        url: `https://${options.domain}/rest/api/3/search/jql`,
        params: {
          jql: `project = ${options.projectKey} ORDER BY created DESC`,
          startAt,
          maxResults,
          fields: "*all",
        },
        headers: {
          Authorization: this.buildAuthHeader(options.email, options.token),
          Accept: "application/json",
        },
      });

      total = response.total || 0;
      const issues = response.issues || [];

      for (const issue of issues) {
        const raw = this.buildRawTask(issue, options.projectName);
        const fields = issue.fields;

        // Track assignees
        const assigneeEmail = fields.assignee?.emailAddress?.toLowerCase();
        if (assigneeEmail) {
          if (!assigneeDirectory.has(assigneeEmail)) {
            assigneeDirectory.set(assigneeEmail, {
              source_user_id: fields.assignee?.accountId || null,
              source_email: fields.assignee?.emailAddress || null,
            });
          }
        }

        // Determine if task is completed
        const isCompleted =
          fields.status?.statusCategory?.key === "done" ||
          fields.status?.statusCategory?.name?.toLowerCase() === "done";

        tasks.push({
          source_task_id: issue.id,
          parent_source_task_id: fields.parent?.id || null,
          title: fields.summary || "Untitled issue",
          description: this.formatDescription(fields.description),
          due_at: fields.duedate || null,
          start_at: fields.startdate || null,
          status: fields.status?.name || null,
          assignee_source_id:
            fields.assignee?.emailAddress || fields.assignee?.accountId || null,
          worktype: fields.status?.name || null,
          raw,
        });
      }

      startAt += maxResults;
    } while (startAt < total);

    const hierarchy = await this.buildHierarchy(
      options.domain,
      options.email,
      options.token,
      options.projectKey
    );
    const users = await this.buildUserMappings(job, assigneeDirectory);

    return { tasks, fields: fieldMappings, hierarchy, users };
  }
}
