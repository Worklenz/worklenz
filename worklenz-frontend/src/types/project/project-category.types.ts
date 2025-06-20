export interface IProjectCategory {
  id?: string;
  name?: string;
  color_code?: string;
  team_id?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface IProjectCategoryViewModel extends IProjectCategory {
  selected?: boolean;
  usage?: number;
}
