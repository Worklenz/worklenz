import { useState } from 'react';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import projectFilesApiService from '@/api/projects/project-files.api.service';
import taskAttachmentsApiService from '@/api/tasks/task-attachments.api.service';
import logger from '@/utils/errorLogger';
import type { ProjectFile } from '@/types/projects/project-files.types';
import type { ITaskAttachmentViewModel } from '@/types/tasks/task-attachment-view-model';
import type { FileOperationsState, PreviewState } from '../types';

export const useFileOperations = () => {
  const { t } = useTranslation('project-view-files');
  const { projectId } = useAppSelector(state => state.projectReducer);

  const [operations, setOperations] = useState<FileOperationsState>({
    downloadingId: null,
    deletingId: null,
    deletingTaskAttachmentId: null,
  });

  const [preview, setPreview] = useState<PreviewState>({
    open: false,
    url: null,
    name: null,
    isLoading: false,
    downloadFn: null,
  });

  const setDownloadingId = (id: string | null) =>
    setOperations(prev => ({ ...prev, downloadingId: id }));

  const setDeletingId = (id: string | null) => setOperations(prev => ({ ...prev, deletingId: id }));

  const setDeletingTaskAttachmentId = (id: string | null) =>
    setOperations(prev => ({ ...prev, deletingTaskAttachmentId: id }));

  const downloadFile = async (file: ProjectFile, onSuccess?: () => void) => {
    if (!projectId || !file.id) return;

    try {
      setDownloadingId(file.id);
      const response = await projectFilesApiService.download(projectId, file.id, file.name);

      if (response.done && response.body?.url) {
        const link = document.createElement('a');
        link.href = response.body.url;
        link.download = file.name;
        document.body.appendChild(link);
        link.click();
        link.remove();
        onSuccess?.();
      }
    } catch (error) {
      logger.error('Error downloading file', error);
      message.error(t('downloadFailed', { defaultValue: 'Unable to download file.' }));
    } finally {
      setDownloadingId(null);
    }
  };

  const deleteFile = async (fileId?: string, onSuccess?: () => void) => {
    if (!projectId || !fileId) return;

    try {
      setDeletingId(fileId);
      const response = await projectFilesApiService.delete(projectId, fileId);

      if (response.done) {
        onSuccess?.();
      }
    } catch (error) {
      logger.error('Error deleting file', error);
      message.error(t('deleteFailed', { defaultValue: 'Unable to delete file.' }));
    } finally {
      setDeletingId(null);
    }
  };

  const downloadTaskAttachment = async (attachment: ITaskAttachmentViewModel) => {
    if (!attachment.id || !attachment.name) return;

    try {
      const response = await taskAttachmentsApiService.downloadTaskAttachment(
        attachment.id,
        attachment.name
      );
      if (response.done && response.body?.url) {
        const link = document.createElement('a');
        link.href = response.body.url;
        link.download = attachment.name;
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
    } catch (error) {
      logger.error('Error downloading task attachment', error);
      message.error(t('downloadFailed', { defaultValue: 'Unable to download file.' }));
    }
  };

  const deleteTaskAttachment = async (attachmentId?: string, onSuccess?: () => void) => {
    if (!attachmentId) return;

    try {
      setDeletingTaskAttachmentId(attachmentId);
      const response = await taskAttachmentsApiService.deleteTaskAttachment(attachmentId);
      if (response.done) {
        onSuccess?.();
      }
    } catch (error) {
      logger.error('Error deleting task attachment', error);
    } finally {
      setDeletingTaskAttachmentId(null);
    }
  };

  const openProjectFilePreview = async (file: ProjectFile) => {
    if (!projectId || !file.id) return;

    setPreview(prev => ({
      ...prev,
      name: file.name,
      url: null,
      isLoading: true,
      open: true,
    }));

    try {
      const response = await projectFilesApiService.download(projectId, file.id, file.name);
      if (response.done && response.body?.url) {
        setPreview(prev => ({
          ...prev,
          url: response.body.url,
          downloadFn: () => void downloadFile(file),
        }));
      }
    } catch (error) {
      logger.error('Error loading preview', error);
      message.error(t('downloadFailed', { defaultValue: 'Unable to download file.' }));
      setPreview(prev => ({ ...prev, open: false }));
    } finally {
      setPreview(prev => ({ ...prev, isLoading: false }));
    }
  };

  const openTaskAttachmentPreview = (attachment: ITaskAttachmentViewModel) => {
    setPreview({
      open: true,
      name: attachment.name || null,
      url: attachment.url || null,
      isLoading: false,
      downloadFn: () => void downloadTaskAttachment(attachment),
    });
  };

  const closePreview = () => {
    setPreview({
      open: false,
      url: null,
      name: null,
      isLoading: false,
      downloadFn: null,
    });
  };

  return {
    operations,
    preview,
    downloadFile,
    deleteFile,
    downloadTaskAttachment,
    deleteTaskAttachment,
    openProjectFilePreview,
    openTaskAttachmentPreview,
    closePreview,
  };
};
