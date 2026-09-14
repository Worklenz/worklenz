export interface IProjectDocTask {
  id: string;
  name: string;
  task_no: number;
  task_key: string;
}

export interface IProjectDoc {
  id: string;
  project_id: string;
  parent_id: string | null;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  tasks?: IProjectDocTask[];
}

export interface IProjectDocPayload {
  title: string;
  content: string;
  parent_id: string | null;
}
