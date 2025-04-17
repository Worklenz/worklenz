export interface IProjectFilterConfig {
  index: number;
  size: number;
  field: string | null;
  order: string | null;
  search: string | null;
  filter: string | null;
  categories: string | null;
  statuses: string | null;
}
