import { ImportProvider, ProviderResult } from "./provider-types";
import {
  AttachmentPlanRow,
  ImportJob,
  StageTaskRow,
  UserMappingRow,
} from "../imports-service";
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
    attachment?: Array<{
      filename?: string;
      content?: string;
      size?: number;
      mimeType?: string;
      created?: string;
      author?: {
        displayName?: string;
        accountId?: string;
        emailAddress?: string;
      };
    }>;
    worklog?: {
      total?: number;
      worklogs?: Array<{
        author?: {
          displayName?: string;
          accountId?: string;
          emailAddress?: string;
        };
        comment?: any;
        timeSpent?: string;
        timeSpentSeconds?: number;
        started?: string;
        created?: string;
      }>;
    };
    parent?: {
      id?: string;
      key?: string;
    };
    subtasks?: Array<{ id?: string; key?: string }>;
    timetracking?: {
      originalEstimate?: string;
      remainingEstimate?: string;
      timeSpent?: string;
      originalEstimateSeconds?: number;
      remainingEstimateSeconds?: number;
      timeSpentSeconds?: number;
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

// JIRA standard field mappings to Worklenz.
// Fields with include:false are excluded by default to avoid creating
// dozens of useless custom columns from Jira metadata.
const STANDARD_FIELD_CANDIDATES: Array<{
  name: string;
  target: string;
  required?: boolean;
  include?: boolean;
}> = [
  { name: "Summary", target: "key", required: true },
  { name: "Description", target: "description" },
  { name: "Assignee", target: "assignees" },
  { name: "Start date", target: "startDate" },
  { name: "Due date", target: "dueDate" },
  { name: "Status", target: "status" },
  { name: "Reporter", target: "reporter" },
  { name: "Priority", target: "priority" },
  { name: "Created", target: "createdDate", required: true },
  { name: "Updated", target: "lastUpdated" },
  { name: "Resolved", target: "completedDate" },
  { name: "Labels", target: "labels" },
  { name: "Original estimate", target: "estimation" },
  { name: "Time Spent", target: "timeTracking" },
  { name: "Progress", target: "progress", include: false },
  // Metadata fields — excluded by default (would create noisy custom columns)
  { name: "Reporter email", target: "reporterEmail", include: false },
  { name: "Comments", target: "comments", include: false },
  { name: "Work logs", target: "workLogs", include: false },
  { name: "Work logged (seconds)", target: "workLoggedSeconds", include: false },
  { name: "Attachments", target: "attachments", include: false },
  { name: "Attachment URLs", target: "attachmentUrls", include: false },
  { name: "Original estimate (seconds)", target: "originalEstimateSeconds", include: false },
  { name: "Remaining estimate (seconds)", target: "remainingEstimateSeconds", include: false },
  { name: "Remaining Estimate", target: "remainingEstimate", include: false },
  { name: "Time Spent (seconds)", target: "timeSpentSeconds", include: false },
  { name: "Key", target: "jiraKey", include: false },
  { name: "Status Category", target: "statusCategory", include: false },
  { name: "Comments count", target: "commentsCount", include: false },
  { name: "Attachment count", target: "attachmentCount", include: false },
  { name: "Work Ratio", target: "workRatio", include: false },
  { name: "Environment", target: "environment", include: false },
  { name: "Fix versions", target: "fixVersions", include: false },
  { name: "Votes", target: "votes", include: false },
  { name: "Watchers", target: "watchers", include: false },
  { name: "Sub-tasks", target: "subTasks", include: false },
  { name: "Parent", target: "parentKey", include: false },
  { name: "Project", target: "project", include: false },
  { name: "Reporter name", target: "reporterName", include: false },
  { name: "Assignee name", target: "assigneeName", include: false },
  { name: "Assignee id", target: "assigneeId", include: false },
  { name: "Creator", target: "creator", include: false },
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
      ({ name, target, required, include }) => ({
        source_field: name,
        target_field: target,
        required: required ?? false,
        // Default include to false only when explicitly set to false
        include: include !== false,
      })
    );

    // Add custom fields from JIRA — excluded by default to keep the import clean
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
        // Custom Jira fields start excluded — user can toggle them in field mapping UI
        include: false,
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
    projectName?: string | null,
    fieldNameById?: Map<string, string>
  ): { raw: Record<string, unknown>; attachmentPlans: AttachmentPlanRow[] } {
    const attachmentPlans: AttachmentPlanRow[] = [];
    const fields = issue.fields;
    const comments = Array.isArray(fields.comment?.comments)
      ? fields.comment?.comments || []
      : [];
    const structuredComments = comments.map((comment) => ({
      body: this.formatDescription(comment?.body),
      author:
        comment?.author?.displayName ||
        comment?.author?.emailAddress ||
        "Unknown",
      authorDisplayName: comment?.author?.displayName || null,
      authorEmail: comment?.author?.emailAddress || null,
      authorAccountId: comment?.author?.accountId || null,
      created: comment?.created || null,
    }));
    const commentLines = comments
      .map((comment) => {
        const body = this.formatDescription(comment?.body);
        if (!body) return null;
        const author =
          comment?.author?.displayName ||
          comment?.author?.emailAddress ||
          "Unknown";
        const created = comment?.created ? ` (${comment.created})` : "";
        return `${author}${created}: ${body}`;
      })
      .filter((line): line is string => !!line);

    const worklogs = Array.isArray(fields.worklog?.worklogs)
      ? fields.worklog?.worklogs || []
      : [];
    const structuredWorklogs = worklogs.map((worklog) => ({
      author:
        worklog?.author?.displayName ||
        worklog?.author?.emailAddress ||
        "Unknown",
      started: worklog?.started || null,
      created: worklog?.created || null,
      timeSpent: worklog?.timeSpent || "",
      timeSpentSeconds: Number(worklog?.timeSpentSeconds || 0),
      comment: this.formatDescription(worklog?.comment),
    }));
    const worklogLines = worklogs
      .map((worklog) => {
        const author =
          worklog?.author?.displayName ||
          worklog?.author?.emailAddress ||
          "Unknown";
        const spent = worklog?.timeSpent || "";
        const started = worklog?.started ? ` (${worklog.started})` : "";
        const comment = this.formatDescription(worklog?.comment);
        const suffix = comment ? ` - ${comment}` : "";
        return `${author}${started}: ${spent}${suffix}`.trim();
      })
      .filter(Boolean);
    const worklogSeconds = worklogs.reduce(
      (sum, entry) => sum + Number(entry?.timeSpentSeconds || 0),
      0
    );

    const attachments = Array.isArray(fields.attachment)
      ? fields.attachment || []
      : [];
    const structuredAttachments: Array<{
      filename: string;
      url: string;
      mimeType: string | null;
      size: number | null;
      created: string | null;
      author: string;
    }> = [];
    const attachmentNames: string[] = [];
    const attachmentUrls: string[] = [];
    attachments.forEach((attachment) => {
      if (attachment?.filename) {
        attachmentNames.push(attachment.filename);
      }
      if (attachment?.content) {
        attachmentUrls.push(attachment.content);
        structuredAttachments.push({
          filename: attachment.filename || "attachment",
          url: attachment.content,
          mimeType: attachment.mimeType || null,
          size: attachment.size ?? null,
          created: attachment.created || null,
          author:
            attachment.author?.displayName ||
            attachment.author?.emailAddress ||
            "Unknown",
        });
        attachmentPlans.push({
          source_url: attachment.content,
          filename: attachment.filename || null,
          content_type: attachment.mimeType || null,
          size_bytes: attachment.size ?? null,
          status: "planned",
        });
      }
    });

    const baseDescription = this.formatDescription(fields.description);
    const descriptionSections: string[] = [];
    if (baseDescription) {
      descriptionSections.push(baseDescription);
    }
    if (commentLines.length) {
      descriptionSections.push(`Jira comments:\n${commentLines.join("\n")}`);
    }
    if (worklogLines.length) {
      descriptionSections.push(`Jira work logs:\n${worklogLines.join("\n")}`);
    }
    if (attachmentUrls.length) {
      descriptionSections.push(`Jira attachments:\n${attachmentUrls.join("\n")}`);
    }
    const enrichedDescription = descriptionSections.join("\n\n");

    const raw: Record<string, unknown> = {
      Key: issue.key || "",
      Summary: fields.summary || "",
      Description: enrichedDescription,
      Assignee:
        fields.assignee?.emailAddress || fields.assignee?.displayName || "",
      "Assignee name": fields.assignee?.displayName || "",
      "Assignee id": fields.assignee?.accountId || "",
      Reporter:
        fields.reporter?.emailAddress || fields.reporter?.displayName || "",
      "Reporter name": fields.reporter?.displayName || "",
      "Reporter email": fields.reporter?.emailAddress || "",
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
      "Original estimate (seconds)":
        fields.timetracking?.originalEstimateSeconds || 0,
      "Remaining Estimate": fields.timetracking?.remainingEstimate || "",
      "Remaining estimate (seconds)":
        fields.timetracking?.remainingEstimateSeconds || 0,
      "Time Spent": fields.timetracking?.timeSpent || "",
      "Time Spent (seconds)": fields.timetracking?.timeSpentSeconds || 0,
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
      Comments: commentLines.join("\n"),
      "Comments count": commentLines.length,
      "Work logs": worklogLines.join("\n"),
      "Work logged (seconds)": worklogSeconds,
      Attachments: attachmentNames.join(", "),
      "Attachment URLs": attachmentUrls.join("\n"),
      "Attachment count": attachmentNames.length,
      __jira_comments: structuredComments,
      __jira_worklogs: structuredWorklogs,
      __jira_attachments: structuredAttachments,
    };

    // Add custom fields
    Object.keys(fields).forEach((key) => {
      if (!key.startsWith("customfield_")) return;
      const value = fields[key];
      if (value === null || value === undefined) return;

      const normalized =
        typeof value === "object" ? JSON.stringify(value) : String(value);

      // Keep the raw custom field id
      raw[key] = normalized;

      // Also expose by display name so field mappings that use names work
      const name = fieldNameById?.get(key);
      if (name) {
        raw[name] = normalized;
      }
    });

    return { raw, attachmentPlans };
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
    const attachments: AttachmentPlanRow[] = [];
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
        const taskData = this.buildRawTask(
          issue,
          options.projectName,
          new Map(jiraFields.map((f) => [f.id, f.name]))
        );
        const raw = taskData.raw;
        const fields = issue.fields;
        if (taskData.attachmentPlans.length) {
          attachments.push(...taskData.attachmentPlans);
        }

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
          attachments_planned: taskData.attachmentPlans.length > 0,
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

    return { tasks, fields: fieldMappings, hierarchy, users, attachments };
  }
}
