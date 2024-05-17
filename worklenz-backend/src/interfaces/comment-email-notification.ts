export interface ICommentEmailNotification {
  greeting: string;
  summary: string;
  team: string;
  project_name: string;
  comment: string;
  task: string;
  settings_url: string;
  task_url: string;
}

export interface IProjectCommentEmailNotification {
  greeting: string;
  summary: string;
  team: string;
  project_name: string;
  comment: string;
}
