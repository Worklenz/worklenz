import { IProjectCategory } from '@/types/project/projectCategory.types';
import { IProjectStatus } from '@/types/project/projectStatus.types';
import { IProjectViewModel } from './projectViewModel.types';
import { NavigateFunction } from 'react-router-dom';
import { AppDispatch } from '@/app/store';
import { TablePaginationConfig } from '@/shared/antd-imports';
import { FilterValue, SorterResult } from 'antd/es/table/interface';

export interface IProject {
  id?: string;
  name?: string;
  color_code?: string;
  notes?: string;
  team_id?: string;
  client_id?: string;
  client_name?: string | null;
  owner_id?: string;
  created_at?: string;
  updated_at?: string;
  status_id?: string;
  man_days?: number;
  hours_per_day?: number;
}

export interface IProjectUpdate {
  name?: string;
  category?: IProjectCategory;
  status?: IProjectStatus;
  notes?: string;
}

export interface IProjectUpdateComment {
  id?: string;
  content?: string;
  user_id?: string;
  project_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface IProjectUpdateCommentViewModel extends IProjectUpdateComment {
  created_by?: string;
  avatar_url?: string;
  color_code?: string;
  mentions: [user_name?: string, user_email?: string];
}

export enum IProjectFilter {
  All = 'All',
  Favourites = 'Favorites',
  Archived = 'Archived',
}

export interface ProjectNameCellProps {
  record: IProjectViewModel;
  navigate: NavigateFunction;
}

export interface CategoryCellProps {
  record: IProjectViewModel;
}

export interface ActionButtonsProps {
  t: (key: string) => string;
  record: IProjectViewModel;
  setProjectId: (id: string) => void;
  dispatch: AppDispatch;
  isOwnerOrAdmin: boolean;
}

export interface TableColumnsProps {
  navigate: NavigateFunction;
  statuses: IProjectStatus[];
  categories: IProjectCategory[];
  setProjectId: (id: string) => void;
}

export interface ProjectListTableProps {
  loading: boolean;
  projects: IProjectViewModel[];
  statuses: IProjectStatus[];
  categories: IProjectCategory[];
  pagination: TablePaginationConfig;
  onTableChange: (
    pagination: TablePaginationConfig,
    filters: Record<string, FilterValue | null>,
    sorter: SorterResult<IProjectViewModel> | SorterResult<IProjectViewModel>[]
  ) => void;
  onProjectSelect: (id: string) => void;
  onArchive: (id: string) => void;
}

export enum ProjectViewType {
  LIST = 'list',
  GROUP = 'group',
}

export enum ProjectGroupBy {
  CLIENT = 'client',
  CATEGORY = 'category',
}

export interface GroupedProject {
  groupKey: string;
  groupName: string;
  projects: IProjectViewModel[];
  count: number;
}

export interface ProjectViewControlsProps {
  viewState: ProjectViewState;
  onViewChange: (state: ProjectViewState) => void;
  availableGroupByOptions?: ProjectGroupBy[];
  t: (key: string) => string;
}

export interface ProjectGroupCardProps {
  group: GroupedProject;
  navigate: NavigateFunction;
  onProjectSelect: (id: string) => void;
  onArchive: (id: string) => void;
  isOwnerOrAdmin: boolean;
  t: (key: string) => string;
}

export interface ProjectGroupListProps {
  groups: GroupedProject[];
  navigate: NavigateFunction;
  onProjectSelect: (id: string) => void;
  onArchive: (id: string) => void;
  isOwnerOrAdmin: boolean;
  loading: boolean;
  t: (key: string) => string;
}

export interface GroupedProject {
  groupKey: string;
  groupName: string;
  groupColor?: string;
  projects: IProjectViewModel[];
  count: number;
  totalProgress: number;
  totalTasks: number;
  averageProgress?: number;
}

export interface ProjectViewState {
  mode: ProjectViewType;
  groupBy: ProjectGroupBy;
  lastUpdated?: string;
}
