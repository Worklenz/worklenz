import { Socket } from "socket.io";

export interface IActivityLog {
  task_id?: string;
  team_id?: string;
  attribute_type?: string;
  user_id?: string | null;
  log_type?: string;
  old_value?: string | null;
  new_value?: string | null;
  assign_type?: string | null;
  change_type?: string | null;
  socket?: Socket;
  prev_string?: string | null;
  next_string?: string | null;
}

export enum IActivityLogAttributeTypes {
  NAME = "name",
  STATUS = "status",
  ASSIGNEES = "assignee",
  END_DATE = "end_date",
  START_DATE = "start_date",
  PRIORITY = "priority",
  ESTIMATION = "estimation",
  LABEL = "label",
  DESCRIPTION = "description",
  ATTACHMENT = "attachment",
  COMMENT = "comment",
  ARCHIVE = "archive",
  PHASE = "phase",
  PROGRESS = "progress",
  WEIGHT = "weight",
}

export enum IActivityLogChangeType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  ASSIGN = "assign",
  UNASSIGN = "unassign",
}
