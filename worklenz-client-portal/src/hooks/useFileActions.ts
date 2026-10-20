import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useMessage } from '@/hooks/useMessage';
import { useConfirmUploadMutation, useGetFileAccessMutation, usePresignUploadMutation } from '@/store/api-v2';
import { errorStatus } from '@/components/v2/queryErrors';
import type { ClientFileV2 } from '@/types/v2';

export const FILE_CATEGORIES = [
  'Proposal',
  'Requirements',
  'Agreement',
  'Design',
  'Report',
  'Deliverable',
  'Supporting Document',
  'Other',
] as const;

/**
 * Preview and download always go through `GET /files/:id/access`, which re-checks access and returns a
 * link that lasts about a minute. A 404 means the file is no longer shared with this person.
 */
export const useFileAccess = () => {
  const { t } = useTranslation();
  const message = useMessage();
  const [requestAccess] = useGetFileAccessMutation();

  const openFile = useCallback(
    async (file: { id: string; name: string }, action: 'preview' | 'download', version?: number): Promise<boolean> => {
      try {
        const result = await requestAccess({ fileId: file.id, action, version }).unwrap();
        window.open(result.url, '_blank', 'noopener,noreferrer');
        return true;
      } catch (error) {
        void message.error(
          errorStatus(error) === 404
            ? t('files.denied', { defaultValue: 'Download denied. This file is no longer shared with you.' })
            : t('files.accessFailed', { defaultValue: 'We could not open this file. Please try again.' })
        );
        return false;
      }
    },
    [requestAccess, t, message]
  );

  return { openFile };
};

/** Presign, PUT to storage, then confirm. The server decides who may upload and where. */
export const useUploadFile = () => {
  const [presign] = usePresignUploadMutation();
  const [confirm] = useConfirmUploadMutation();

  return useCallback(
    async (projectId: string, file: File, category: string): Promise<ClientFileV2> => {
      const target = await presign({
        projectId,
        filename: file.name,
        size: file.size,
        mime_type: file.type || 'application/octet-stream',
        category,
      }).unwrap();
      const response = await fetch(target.upload_url, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
      });
      if (!response.ok) throw new Error(`Upload failed (${response.status})`);
      return confirm({ projectId, file_id: target.file_id }).unwrap();
    },
    [presign, confirm]
  );
};
