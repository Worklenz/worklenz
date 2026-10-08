/**
 * Custom project template create / apply contracts (schema_version 2+).
 * @see docs/project-templates-config-preservation-phase0.md
 */

export const CUSTOM_PROJECT_TEMPLATE_SCHEMA_VERSION = 2 as const;

export interface IProjectTemplateProjectIncludes {
  statuses: boolean;
  phases: boolean;
  labels: boolean;
  customColumns: boolean;
}

export interface IProjectTemplateProjectSettingsIncludes {
  category: boolean;
  projectManager: boolean;
  estimatedWorkingDays: boolean;
  estimatedManDays: boolean;
  hoursPerDay: boolean;
  advanced: boolean;
  budget: boolean;
}

export interface IProjectTemplateTaskIncludes {
  status: boolean;
  phase: boolean;
  labels: boolean;
  estimation: boolean;
  description: boolean;
  subtasks: boolean;
  assignees: boolean;
  recurrence: boolean;
  dependencies: boolean;
  billable: boolean;
  dateOffsets: boolean;
}

export interface IProjectTemplateIncludes {
  project: IProjectTemplateProjectIncludes;
  projectSettings: IProjectTemplateProjectSettingsIncludes;
  task: IProjectTemplateTaskIncludes;
}

export interface IProjectTemplateAdvancedSettings {
  use_manual_progress: boolean;
  use_weighted_progress: boolean;
  use_time_progress: boolean;
  auto_assign_task_creator: boolean;
  restrict_task_creation: boolean;
  phase_assignees_enabled: boolean;
}

export interface IProjectTemplateRateCardRole {
  job_title_id?: string | null;
  job_title_name: string;
  rate: number;
  man_day_rate?: number | null;
}

export interface IProjectTemplateBudgetSettings {
  amount: number;
  currency: string;
  rate_card?: IProjectTemplateRateCardRole[];
}

export interface IProjectTemplateSettingsSnapshot {
  category_id?: string | null;
  category_name?: string | null;
  project_manager_id?: string | null;
  estimated_working_days?: number | null;
  estimated_man_days?: number | null;
  hours_per_day?: number | null;
  advanced?: IProjectTemplateAdvancedSettings | null;
  budget?: IProjectTemplateBudgetSettings | null;
  /** Calendar-day span of source project (end - start), used when applying end date. */
  project_duration_days?: number | null;
}

export interface ICustomProjectTemplateCreateRequest {
  project_id: string;
  templateName: string;
  projectIncludes: IProjectTemplateProjectIncludes;
  /** Optional until Save modal ships Project Settings group; backend treats missing as all false. */
  projectSettingsIncludes?: Partial<IProjectTemplateProjectSettingsIncludes>;
  taskIncludes: Partial<IProjectTemplateTaskIncludes> & {
    status: boolean;
    phase: boolean;
    labels: boolean;
    estimation: boolean;
    description: boolean;
    subtasks: boolean;
  };
  includeCustomColumns?: boolean;
}

export interface IProjectTemplateSettingsOverrides {
  category_id?: string | null;
  project_manager_id?: string | null;
  estimated_working_days?: number | null;
  estimated_man_days?: number | null;
  hours_per_day?: number | null;
  advanced?: Partial<IProjectTemplateAdvancedSettings> | null;
  budget?: {
    amount?: number | null;
    currency?: string | null;
  } | null;
}

export interface ICustomProjectTemplateImportRequest {
  template_id: string;
  project_name?: string;
  color_code?: string;
  /** Required for date-offset application when template has dateOffsets. */
  start_date?: string | null;
  /** Editable overrides from the review step; does not mutate the template. */
  settings_overrides?: IProjectTemplateSettingsOverrides | null;
}

export interface IProjectTemplateApplySkip {
  type:
    | 'assignee'
    | 'project_manager'
    | 'rate_card_role'
    | 'dependency'
    | 'recurrence'
    | 'category'
    | 'plan_gated'
    | 'other';
  reason: string;
  detail?: string;
}

export interface ICustomProjectTemplateImportResult {
  project_id?: string;
  skips?: IProjectTemplateApplySkip[];
}

/** Eng-lean defaults from Phase 0 (pending Product sign-off). */
export const DEFAULT_PROJECT_SETTINGS_INCLUDES: IProjectTemplateProjectSettingsIncludes = {
  category: true,
  projectManager: false,
  estimatedWorkingDays: true,
  estimatedManDays: true,
  hoursPerDay: true,
  advanced: true,
  budget: false,
};

export const DEFAULT_NEW_TASK_INCLUDES: Pick<
  IProjectTemplateTaskIncludes,
  'assignees' | 'recurrence' | 'dependencies' | 'billable' | 'dateOffsets'
> = {
  assignees: false,
  recurrence: true,
  dependencies: true,
  billable: true,
  dateOffsets: true,
};

/** Full custom project template definition for Edit / Copy & Customize save. */
export interface ICustomProjectTemplateDefinitionPayload {
  name: string;
  phase_label?: string;
  color_code?: string;
  notes?: string;
  description?: string;
  phases?: Array<{ name?: string; color_code?: string }>;
  status?: Array<{
    name?: string;
    category_id?: string;
    sort_order?: string | number;
  }>;
  labels?: Array<{ name?: string; color_code?: string }>;
  tasks?: Array<Record<string, unknown>>;
  includes?: IProjectTemplateIncludes;
  settings?: IProjectTemplateSettingsSnapshot | null;
  include_custom_columns?: boolean;
  custom_columns?: Array<Record<string, unknown>>;
}

/** Copy & Customize request — built-in source plus optional edited definition. */
export interface ICustomFromWorklenzTemplateRequest
  extends Partial<ICustomProjectTemplateDefinitionPayload> {
  worklenz_template_id: string;
  /** Preferred template name; defaults to "Copy of {built-in name}" on the server. */
  templateName?: string;
}
