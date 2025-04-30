export interface IActivityLogsUser {
  avatar_url?: string;
  color_code?: string;
  name?: string;
  user_id?: string;
}

export interface IActivityLogsLabel {
  color_code?: string;
  color_code_dark?: string;
  name?: string;
}

export interface IActivityLogsStatus {
  color_code?: string;
  color_code_dark?: string;
  name?: string;
}

export enum IActivityLogAttributeTypes {
  NAME = 'name',
  STATUS = 'status',
  ASSIGNEES = 'assignee',
  END_DATE = 'end_date',
  START_DATE = 'start_date',
  PRIORITY = 'priority',
  PHASE = 'phase',
  ESTIMATION = 'estimation',
  LABEL = 'label',
  DESCRIPTION = 'description',
  ATTACHMENT = 'attachment',
  COMMENT = 'comment',
  ARCHIVE = 'archive',
  PROGRESS = 'progress',
  WEIGHT = 'weight',
}

export interface IActivityLog {
  attribute_type?: string;
  created_at?: string;
  current?: string;
  log_text?: string;
  log_type?: string;
  previous?: string;
  task_id?: string;
  done_by?: IActivityLogsUser;
  assigned_user?: IActivityLogsUser;
  label_data?: IActivityLogsLabel;
  previous_status?: IActivityLogsLabel;
  next_status?: IActivityLogsLabel;
  previous_priority?: IActivityLogsLabel;
  next_priority?: IActivityLogsLabel;
  previous_phase: IActivityLogsLabel;
  next_phase: IActivityLogsLabel;
}

export interface IActivityLogsResponse {
  avatar_url?: string;
  color_code?: string;
  created_at?: string;
  logs?: IActivityLog[];
  name?: string;
}
