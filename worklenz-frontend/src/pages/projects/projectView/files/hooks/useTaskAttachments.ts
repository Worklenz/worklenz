import { useEffect, useState, useCallback } from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import taskAttachmentsApiService from '@/api/tasks/task-attachments.api.service';
import { DEFAULT_PAGE_SIZE } from '@/shared/constants';
import logger from '@/utils/errorLogger';
import type { ITaskAttachmentViewModel } from '@/types/tasks/task-attachment-view-model';
import type { PaginationConfig } from '../types';

export const useTaskAttachments = () => {
  const { projectId } = useAppSelector(state => state.projectReducer);

  const [taskAttachments, setTaskAttachments] = useState<ITaskAttachmentViewModel[]>([]);
  const [taskAttachmentsLoading, setTaskAttachmentsLoading] = useState(false);
  const [taskAttachmentsPagination, setTaskAttachmentsPagination] = useState<PaginationConfig>({
    total: 0,
    pageIndex: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  const fetchTaskAttachments = useCallback(async () => {
    if (!projectId) return;

    setTaskAttachmentsLoading(true);
    try {
      const response = await taskAttachmentsApiService.getProjectAttachments(
        projectId,
        taskAttachmentsPagination.pageIndex,
        taskAttachmentsPagination.pageSize
      );
      if (response.done && response.body) {
        setTaskAttachments(response.body.data || []);
        setTaskAttachmentsPagination(prev => ({ ...prev, total: response.body.total || 0 }));
      }
    } catch (error) {
      logger.error('Error fetching task attachments', error);
    } finally {
      setTaskAttachmentsLoading(false);
    }
  }, [projectId, taskAttachmentsPagination.pageIndex, taskAttachmentsPagination.pageSize]);

  useEffect(() => {
    void fetchTaskAttachments();
  }, [fetchTaskAttachments]);

  return {
    taskAttachments,
    taskAttachmentsLoading,
    taskAttachmentsPagination,
    setTaskAttachmentsPagination,
    fetchTaskAttachments,
  };
};
