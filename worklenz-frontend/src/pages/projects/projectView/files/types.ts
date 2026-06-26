import type { UploadFile } from 'antd/es/upload/interface';
import type {
  ProjectFilesSortField,
  ProjectFilesSortOrder,
} from '@/types/projects/project-files.types';
import type { ITaskAttachmentViewModel } from '@/types/tasks/task-attachment-view-model';

export type PendingUploadFile = UploadFile & { errorMessage?: string };

export type TabType = 'project' | 'task';

export interface PaginationConfig {
  total: number;
  pageIndex: number;
  pageSize: number;
}

export interface SortConfig {
  field: ProjectFilesSortField;
  order: ProjectFilesSortOrder;
}

export interface StorageUsage {
  used: number;
  fileCount: number;
}

export interface PreviewState {
  open: boolean;
  url: string | null;
  name: string | null;
  isLoading: boolean;
  downloadFn: (() => void) | null;
}

export interface FileOperationsState {
  downloadingId: string | null;
  deletingId: string | null;
  deletingTaskAttachmentId: string | null;
}
