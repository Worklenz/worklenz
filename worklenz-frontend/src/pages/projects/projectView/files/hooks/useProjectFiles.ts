import { useEffect, useState, useCallback } from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import projectFilesApiService from '@/api/projects/project-files.api.service';
import { DEFAULT_PAGE_SIZE } from '@/shared/constants';
import logger from '@/utils/errorLogger';
import type {
  ProjectFile,
  ProjectFilesSortField,
  ProjectFilesSortOrder,
} from '@/types/projects/project-files.types';
import type { PaginationConfig, SortConfig, StorageUsage } from '../types';

export const useProjectFiles = () => {
  const { projectId, refreshTimestamp } = useAppSelector(state => state.projectReducer);

  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [storageUsage, setStorageUsage] = useState<StorageUsage>({ used: 0, fileCount: 0 });
  const [sorter, setSorter] = useState<SortConfig>({
    field: 'created_at',
    order: 'desc',
  });
  const [paginationConfig, setPaginationConfig] = useState<PaginationConfig>({
    total: 0,
    pageIndex: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [searchValue, setSearchValue] = useState('');

  const fetchFiles = useCallback(async () => {
    if (!projectId) return;

    try {
      setLoading(true);
      const response = await projectFilesApiService.list(projectId, {
        page: paginationConfig.pageIndex,
        size: paginationConfig.pageSize,
        sort: sorter.field,
        order: sorter.order,
        search: searchValue.trim() || undefined,
      });

      if (response.done && response.body) {
        setFiles(response.body.files || []);
        setPaginationConfig(prev => ({ ...prev, total: response.body.total || 0 }));
        setStorageUsage({
          used: Number(response.body.storage_used) || 0,
          fileCount: Number(response.body.file_count) || 0,
        });
      }
    } catch (error) {
      logger.error('Error fetching project files', error);
    } finally {
      setLoading(false);
    }
  }, [
    projectId,
    paginationConfig.pageIndex,
    paginationConfig.pageSize,
    sorter.field,
    sorter.order,
    searchValue,
    refreshTimestamp,
  ]);

  const handleSearch = (value: string) => {
    setPaginationConfig(prev => ({ ...prev, pageIndex: 1 }));
    setSearchValue(value.trim());
  };

  const handleTableChange = (pagination: any, _filters: any, sorterParam: any) => {
    setPaginationConfig(prev => ({
      ...prev,
      pageIndex: pagination.current || 1,
      pageSize: pagination.pageSize || DEFAULT_PAGE_SIZE,
    }));

    if (!Array.isArray(sorterParam)) {
      const sortField = (sorterParam.field as ProjectFilesSortField) || 'created_at';
      const sortOrder: ProjectFilesSortOrder =
        sorterParam.order === 'ascend'
          ? 'asc'
          : sorterParam.order === 'descend'
            ? 'desc'
            : sorter.order;
      setSorter({ field: sortField, order: sortOrder });
    }
  };

  useEffect(() => {
    void fetchFiles();
  }, [fetchFiles]);

  return {
    files,
    loading,
    storageUsage,
    sorter,
    paginationConfig,
    searchValue,
    handleSearch,
    handleTableChange,
    fetchFiles,
    setPaginationConfig,
  };
};
