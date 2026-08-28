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
  title?: string;
  description?: string | null;
  status?: string | null;
  start_at?: string | null;
  due_at?: string | null;
  assignee_source_id?: string | null;
  labels?: string[] | null;
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

export interface ImportedJiraComment {
  author?: string;
  authorDisplayName?: string | null;
  authorEmail?: string | null;
  authorAccountId?: string | null;
  created?: string | null;
  body?: string;
}

export interface ImportedJiraWorklog {
  author?: string;
  started?: string | null;
  created?: string | null;
  timeSpent?: string;
  timeSpentSeconds?: number;
  comment?: string;
}

export interface ImportedJiraAttachment {
  filename?: string;
  url?: string;
  mimeType?: string | null;
  size?: number | null;
  created?: string | null;
  author?: string;
}

export type SupportedCustomFieldType =
  | "people"
  | "text"
  | "number"
  | "date"
  | "selection"
  | "checkbox"
  | "labels"
  | "key"
  | "formula";

export interface SelectionOptionPlan {
  id: string;
  name: string;
  color: string;
}

export interface ColumnPlanConfig {
  fieldType: SupportedCustomFieldType;
  numberType?: string | null;
  decimals?: number | null;
  selections?: SelectionOptionPlan[];
  valueToSelectionId?: Map<string, string>;
}

export interface CustomColumnPlan {
  key: string;
  name: string;
  sourceField: string;
  samples: Set<string>;
}

export interface CustomColumnRef {
  id: string;
  key: string;
  fieldType?: SupportedCustomFieldType;
}

// Worklenz only has Low / Medium / High / Critical — there is no "Urgent"
// priority. Kept alongside the other import-pipeline context types since it's
// shared between the resolvers and the commit orchestration.
export interface AssigneeResolutionContext {
  shouldImportMembers: boolean;
  assigneeMap: Map<string, string>;
  teamMemberEmailMap: Map<string, string>;
  teamMemberNameMap: Map<string, string>;
}

export interface TaskCommentImportContext {
  creatorTeamMemberId: string | null;
  createdByUserId: string;
  assigneeMap: Map<string, string>;
  teamMemberUserMap: Map<string, string>;
  teamMemberEmailMap: Map<string, string>;
  teamMemberUserIdByEmailMap: Map<string, string>;
}

export interface TaskAttachmentImportContext {
  shouldImportAttachments: boolean;
  targetTeamId: string | null;
  targetProjectId: string;
  createdByUserId: string;
  jiraAuthHeader: string | null;
}
