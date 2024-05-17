export interface ITaskAssignmentModelTask {
  id?: string;
  task_name?: string;
  updater_name?: string;
  members?: string;
  url?: string;
}

export interface ITaskAssignmentModelProject {
  id?: string;
  name?: string;
  url?: string;
  tasks?: ITaskAssignmentModelTask[];
}

export interface ITaskAssignmentModelTeam {
  id?: string;
  name?: string;
  team_member_id?: string;
  projects?: ITaskAssignmentModelProject[];
}

export interface ITaskAssignmentsModel {
  email?: string;
  name?: string;
  team_member_id?: string;
  url?: string;
  settings_url?: string;
  teams?: ITaskAssignmentModelTeam[];
}
