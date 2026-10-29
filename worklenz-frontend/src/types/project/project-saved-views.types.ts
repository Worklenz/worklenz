export const SAVED_VIEW_CONFIG_VERSION = 1;

export type SavedViewBaseView = 'tasks-list';

/** Task List state captured by a saved view. Mirrors the backend validator in src/shared/project-saved-views.ts. */
export interface ISavedViewConfig {
  version: number;
  priorities: string[];
  statuses: string[];
  phases: string[];
  members: string[];
  labels: string[];
  search: string;
  archived: boolean;
  group: 'status' | 'priority' | 'phase' | 'assignee';
  sort_field: string;
  sort_order: 'ASC' | 'DESC';
}

export interface IProjectSavedView {
  id: string;
  project_id: string;
  name: string;
  base_view: SavedViewBaseView;
  config: ISavedViewConfig;
  sort_order: number;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface ICreateSavedViewBody {
  name: string;
  base_view: SavedViewBaseView;
  config: ISavedViewConfig;
}

export interface IUpdateSavedViewBody {
  name?: string;
  config?: ISavedViewConfig;
}
