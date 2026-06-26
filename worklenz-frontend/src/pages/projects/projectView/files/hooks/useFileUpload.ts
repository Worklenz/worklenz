import { useState } from 'react';
import { message, Upload } from 'antd';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import projectFilesApiService from '@/api/projects/project-files.api.service';
import { evt_file_uploaded } from '@/shared/worklenz-analytics-events';
import { getFileType } from '@/types/mixpanel-events.types';
import logger from '@/utils/errorLogger';
import { BLOCKED_EXTENSIONS, MAX_FILE_SIZE_BYTES } from '../constants';
import { isBlockedExtension } from '../utils';
import type { RcFile } from 'antd/es/upload/interface';
import type { PendingUploadFile } from '../types';

export const useFileUpload = (onUploadSuccess?: () => void) => {
  const { t } = useTranslation('project-view-files');
  const { projectId } = useAppSelector(state => state.projectReducer);
  const { trackMixpanelEvent } = useMixpanelTracking();

  const [uploading, setUploading] = useState(false);
  const [isUploaderOpen, setIsUploaderOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingUploadFile[]>([]);

  const resetUploader = () => {
    setPendingFiles([]);
  };

  const openUploader = () => {
    setIsUploaderOpen(true);
    resetUploader();
  };

  const closeUploader = () => {
    setIsUploaderOpen(false);
    resetUploader();
  };

  const beforeUpload = (file: RcFile) => {
    if (isBlockedExtension(file.name, BLOCKED_EXTENSIONS)) {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      message.error(
        t('blockedFileType', {
          defaultValue: 'Files with .{{ext}} extensions are not allowed.',
          ext,
        })
      );
      return Upload.LIST_IGNORE;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      message.error(
        t('fileTooLarge', {
          defaultValue: '{{file}} exceeds the 100 MB limit.',
          file: file.name,
        })
      );
      return Upload.LIST_IGNORE;
    }

    const alreadyAdded = pendingFiles.some(
      pending => pending.name === file.name && pending.size === file.size
    );

    if (!alreadyAdded) {
      const newFile: PendingUploadFile = {
        uid: file.uid,
        name: file.name,
        size: file.size,
        status: undefined,
        percent: 0,
        originFileObj: file,
      };
      setPendingFiles(prev => [...prev, newFile]);
    }

    return false;
  };

  const handleRemoveFile = (file: PendingUploadFile) => {
    setPendingFiles(prev => prev.filter(item => item.uid !== file.uid));
    return true;
  };

  const updatePendingFile = (
    uid: string,
    updater: (file: PendingUploadFile) => PendingUploadFile
  ) => {
    setPendingFiles(prev => prev.map(file => (file.uid === uid ? updater(file) : file)));
  };

  const uploadAttachments = async () => {
    if (!projectId) return;

    if (!pendingFiles.length) {
      message.warning(t('noFilesSelected', { defaultValue: 'Add at least one file.' }));
      return;
    }

    try {
      setUploading(true);
      let hasError = false;

      for (const file of pendingFiles) {
        const rawFile = file.originFileObj as File;

        updatePendingFile(file.uid, current => ({
          ...current,
          status: 'uploading',
          percent: 0,
          errorMessage: undefined,
        }));

        try {
          const response = await projectFilesApiService.upload(projectId, rawFile, percent => {
            updatePendingFile(file.uid, current => ({ ...current, status: 'uploading', percent }));
          });

          if (!response.done) {
            throw new Error('Upload failed');
          }

          trackMixpanelEvent(evt_file_uploaded, { file_type: getFileType(rawFile.name) });

          updatePendingFile(file.uid, current => ({
            ...current,
            status: 'done',
            percent: 100,
          }));
        } catch (error: unknown) {
          hasError = true;
          const serverMessage = (error as any)?.response?.data?.message as string | undefined;
          const tooLarge = serverMessage?.toLowerCase().includes('max file size') || false;
          const errorMessage = tooLarge
            ? t('fileTooLargeLabel', { defaultValue: 'File too large' })
            : serverMessage || t('uploadFailedShort', { defaultValue: 'Upload failed' });

          updatePendingFile(file.uid, current => ({
            ...current,
            status: 'error',
            percent: undefined,
            errorMessage,
          }));
        }
      }

      if (!hasError) {
        message.success(t('uploadSuccess', { defaultValue: 'Files uploaded successfully.' }));
        closeUploader();
        onUploadSuccess?.();
      } else {
        message.error(t('uploadFailed', { defaultValue: 'Upload failed. Please try again.' }));
      }
    } catch (error) {
      logger.error('Error uploading files', error);
      message.error(t('uploadFailed', { defaultValue: 'Upload failed. Please try again.' }));
    } finally {
      setUploading(false);
    }
  };

  return {
    uploading,
    isUploaderOpen,
    pendingFiles,
    beforeUpload,
    handleRemoveFile,
    updatePendingFile,
    uploadAttachments,
    openUploader,
    closeUploader,
  };
};
