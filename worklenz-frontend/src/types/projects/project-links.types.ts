export interface IProjectLink {
  id: string;
  title: string;
  url: string;
  description?: string;
  source_type: 'manual' | 'task_description' | 'task_comment';
  source_task_id?: string;
  source_task_name?: string;
  source_task_key?: string;
  added_by_name?: string;
  created_at: string;
  updated_at: string;
}

export interface IProjectLinksResponse {
  total: number;
  data: IProjectLink[];
}

export interface ICreateLinkBody {
  title: string;
  url: string;
  description?: string;
}

export interface IUpdateLinkBody {
  title: string;
  url: string;
  description?: string;
}
