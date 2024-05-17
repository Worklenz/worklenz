export interface IProjectDigestTask {
  id: string;
  name: string;
  url: string;
  members: string;
}

export interface IProjectDigestSubscriber {
  name: string;
  email: string;
}

export interface IProjectDigest {
  id: string;
  name: string;
  team_name: string;
  greeting: string;
  summary: string;
  settings_url: string;
  project_url: string;
  today_completed: IProjectDigestTask[];
  today_new: IProjectDigestTask[];
  due_tomorrow: IProjectDigestTask[];
  subscribers: IProjectDigestSubscriber[];
}
