export interface TaskRecord {
  name: string;
  members: string;
  url: string;
  team_name: string;
  project_name: string;
}

export interface ITaskMovedToDoneRecord {
  greeting: string;
  summary: string;
  settings_url: string;
  task: TaskRecord;
}
