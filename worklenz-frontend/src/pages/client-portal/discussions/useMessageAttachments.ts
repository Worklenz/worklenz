import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { message } from '@/shared/antd-imports';
import projectFilesApiService from '@/api/projects/project-files.api.service';
import { getPortalErrorMessage } from '@/api/client-portal/portal-api-utils';
import { useConfirmPortalFileMutation, usePresignPortalFileMutation } from '@/api/client-portal/portal-projects-api';
import { getUploadProblem } from '@/components/client-portal/v2/file-rules';

/** The same limits as a change request's attachments. */
export const MAX_MESSAGE_ATTACHMENTS = 5;
export const MAX_MESSAGE_ATTACHMENT_BYTES = 100 * 1024 * 1024;

export interface DraftAttachment {
  key: string;
  name: string;
  size: number;
  /** 0 to 100 while uploading. */
  progress: number;
  status: 'uploading' | 'ready' | 'failed';
  /** The project file id to send with the message once the upload is confirmed. */
  fileId?: string;
}

export interface MessageAttachmentsController {
  items: DraftAttachment[];
  add: (files: File[]) => void;
  remove: (key: string) => void;
  reset: () => void;
  /** Ids of the files that finished uploading. */
  fileIds: string[];
  isUploading: boolean;
  isFull: boolean;
}

let nextKey = 0;

/**
 * Files for the message being written. Each one is uploaded to the project as soon as it is chosen
 * (Internal Only, like any staff upload), so sending the message only has to link them. The message
 * is what shares them with the client.
 */
export const useMessageAttachments = (projectId: string | undefined): MessageAttachmentsController => {
  const { t } = useTranslation('client-portal-v2-discussions');
  const [items, setItems] = useState<DraftAttachment[]>([]);
  const itemsRef = useRef<DraftAttachment[]>([]);
  const projectRef = useRef(projectId);
  const [presign] = usePresignPortalFileMutation();
  const [confirm] = useConfirmPortalFileMutation();

  const commit = useCallback((update: (current: DraftAttachment[]) => DraftAttachment[]) => {
    itemsRef.current = update(itemsRef.current);
    setItems(itemsRef.current);
  }, []);

  // Files belong to one project, so choosing another project starts the list over.
  useEffect(() => {
    projectRef.current = projectId;
    commit(() => []);
  }, [projectId, commit]);

  const patch = useCallback(
    (key: string, changes: Partial<DraftAttachment>) =>
      commit(current => current.map(item => (item.key === key ? { ...item, ...changes } : item))),
    [commit]
  );

  const upload = useCallback(
    async (key: string, file: File, targetProjectId: string) => {
      try {
        const presigned = await presign({
          projectId: targetProjectId,
          body: {
            filename: file.name,
            size: file.size,
            mime_type: file.type || 'application/octet-stream',
            category: 'Supporting Document',
          },
        }).unwrap();
        const target = presigned.body;
        if (!target) throw new Error('No upload link');
        await projectFilesApiService.uploadDirect(target.upload_url, file, percent => patch(key, { progress: percent }));
        await confirm({ projectId: targetProjectId, fileId: target.file_id }).unwrap();
        // The project changed or the file was removed while it uploaded: the patch finds no item.
        if (projectRef.current === targetProjectId) patch(key, { status: 'ready', progress: 100, fileId: target.file_id });
      } catch (error) {
        message.error(
          getPortalErrorMessage(
            error,
            t('composer.attachFailed', { name: file.name, defaultValue: '{{name}} could not be uploaded.' })
          )
        );
        patch(key, { status: 'failed' });
      }
    },
    [presign, confirm, patch, t]
  );

  const add = useCallback(
    (files: File[]) => {
      if (!projectId || files.length === 0) return;
      let slots = MAX_MESSAGE_ATTACHMENTS - itemsRef.current.length;
      const accepted: Array<{ key: string; file: File }> = [];

      for (const file of files) {
        const problem = getUploadProblem(file);
        if (problem === 'blocked_type') {
          message.warning(t('composer.attachBlocked', { name: file.name, defaultValue: '{{name}}: this file type is not allowed.' }));
        } else if (problem === 'empty') {
          message.warning(t('composer.attachEmpty', { name: file.name, defaultValue: '{{name}} is empty.' }));
        } else if (problem === 'too_large' || file.size > MAX_MESSAGE_ATTACHMENT_BYTES) {
          message.warning(t('composer.attachTooLarge', { name: file.name, defaultValue: '{{name}} is larger than 100 MB.' }));
        } else if (slots <= 0) {
          message.warning(
            t('composer.attachTooMany', { max: MAX_MESSAGE_ATTACHMENTS, defaultValue: 'You can attach at most {{max}} files.' })
          );
          break;
        } else {
          slots -= 1;
          nextKey += 1;
          accepted.push({ key: `attachment-${nextKey}`, file });
        }
      }

      if (accepted.length === 0) return;
      commit(current => [
        ...current,
        ...accepted.map(({ key, file }) => ({ key, name: file.name, size: file.size, progress: 0, status: 'uploading' as const })),
      ]);
      accepted.forEach(({ key, file }) => void upload(key, file, projectId));
    },
    [projectId, commit, upload, t]
  );

  const remove = useCallback((key: string) => commit(current => current.filter(item => item.key !== key)), [commit]);
  const reset = useCallback(() => commit(() => []), [commit]);

  return {
    items,
    add,
    remove,
    reset,
    fileIds: items.flatMap(item => (item.status === 'ready' && item.fileId ? [item.fileId] : [])),
    isUploading: items.some(item => item.status === 'uploading'),
    isFull: items.length >= MAX_MESSAGE_ATTACHMENTS,
  };
};
