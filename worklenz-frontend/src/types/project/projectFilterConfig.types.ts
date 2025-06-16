export interface IProjectFilterConfig {
  index: number;
  size: number;
  field: string | null;
  order: string | null;
  search: string | null;
  filter: string | null;
  categories: string | null;
  statuses: string | null;
  current_tab: string | null;
  projects_group_by: number;
  current_view: number;
  is_group_view: boolean;
}
