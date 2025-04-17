import type { NavigateFunction } from 'react-router-dom';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import type { AppDispatch } from '@/app/store';
import type { IProjectViewModel } from '@/types/project/projectViewModel.types';
import type { IProjectStatus } from '@/types/project/projectStatus.types';
import type { IProjectCategory } from '@/types/project/projectCategory.types';
import type { InlineMember } from '@/types/teamMembers/inlineMember.types';
import { FilterValue } from 'antd/es/table/interface';
import { SorterResult } from 'antd/es/table/interface';

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
