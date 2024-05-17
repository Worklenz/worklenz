export interface ITaskListConfig {
  id: string;
  index: number;
  size: number;
  field: string | null;
  order: string | null;
  search: string | null;
  statuses: string | null;
  members: string | null;
  projects: string | null;
  labels?: string | null;
  priorities?: string | null;
  filterBy?: string | null;
  archived?: boolean;
  paginate?: boolean;
  count?: boolean;
  parent_task?: string;
}
