export interface IProjectEpic {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  color_code: string;
  owner_id: string | null;
  owner_name: string | null;
  owner_avatar_url: string | null;
  is_archived: boolean;
  sort_index: number;
  created_at: string;
  issue_count: number;
  done_issue_count: number;
  total_points: number;
  done_points: number;
}

export interface IProjectEpicInput {
  name: string;
  description?: string | null;
  color_code: string;
  owner_id?: string | null;
  is_archived?: boolean;
}

export interface ITaskEpicAssignment {
  id: string;
  epic_id: string | null;
}
