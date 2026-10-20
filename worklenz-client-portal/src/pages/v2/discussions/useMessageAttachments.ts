import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMessage } from '@/hooks/useMessage';
import { useUploadFile } from '@/hooks/useFileActions';
import { errorMessage } from '@/components/v2';

/** The same limits as the team's side of a discussion. */
export const MAX_MESSAGE_ATTACHMENTS = 5;
export const MAX_MESSAGE_ATTACHMENT_BYTES = 100 * 1024 * 1024;

export interface DraftAttachment {
  key: string;
  name: string;
  size: number;
  status: 'uploading' | 'ready' | 'failed';
  /** The project file id to send with the message once the upload is confirmed. */
  fileId?: string;
  /** Why the upload failed, shown next to the file. */
  error?: string;
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
 * Files for the message being written. Each one is uploaded to the project as soon as it is chosen,
 * so sending the message only has to link them. Choosing another project starts the list over.
 */
export const useMessageAttachments = (projectId: string | undefined): MessageAttachmentsController => {
  const { t } = useTranslation();
  const message = useMessage();
  const upload = useUploadFile();
  const [items, setItems] = useState<DraftAttachment[]>([]);
  const itemsRef = useRef<DraftAttachment[]>([]);
  const projectRef = useRef(projectId);

  const commit = useCallback((update: (current: DraftAttachment[]) => DraftAttachment[]) => {
    itemsRef.current = update(itemsRef.current);
    setItems(itemsRef.current);
  }, []);

  useEffect(() => {
    projectRef.current = projectId;
    commit(() => []);
  }, [projectId, commit]);

  const patch = useCallback(
    (key: string, changes: Partial<DraftAttachment>) =>
      commit(current => current.map(item => (item.key === key ? { ...item, ...changes } : item))),
    [commit]
  );

  const send = useCallback(
    async (key: string, file: File, targetProjectId: string) => {
      try {
        const saved = await upload(targetProjectId, file, 'Supporting Document');
        // The project changed or the file was removed while it uploaded: the patch finds no item.
        if (projectRef.current === targetProjectId) patch(key, { status: 'ready', fileId: saved.id });
      } catch (error) {
        const reason =
          errorMessage(error) ?? t('discussions.attachFailed', { name: file.name, defaultValue: '{{name}} could not be uploaded.' });
        void message.error(reason);
        patch(key, { status: 'failed', error: reason });
      }
    },
    [upload, patch, message, t]
  );

  const add = useCallback(
    (files: File[]) => {
      if (!projectId || files.length === 0) return;
      let slots = MAX_MESSAGE_ATTACHMENTS - itemsRef.current.length;
      const accepted: Array<{ key: string; file: File }> = [];

      for (const file of files) {
        if (file.size === 0) {
          void message.warning(t('discussions.attachEmpty', { name: file.name, defaultValue: '{{name}} is empty.' }));
        } else if (file.size > MAX_MESSAGE_ATTACHMENT_BYTES) {
          void message.warning(t('discussions.attachTooLarge', { name: file.name, defaultValue: '{{name}} is larger than 100 MB.' }));
        } else if (slots <= 0) {
          void message.warning(
            t('discussions.attachTooMany', { max: MAX_MESSAGE_ATTACHMENTS, defaultValue: 'You can attach at most {{max}} files.' })
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
        ...accepted.map(({ key, file }) => ({ key, name: file.name, size: file.size, status: 'uploading' as const })),
      ]);
      accepted.forEach(({ key, file }) => void send(key, file, projectId));
    },
    [projectId, commit, send, message, t]
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
