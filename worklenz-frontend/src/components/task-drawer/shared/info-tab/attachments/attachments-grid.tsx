import { ITaskAttachmentViewModel } from '@/types/tasks/task-attachment-view-model';
import AttachmentsPreview from './attachments-preview';
import './attachments-preview.css';
import { TaskAttachmentUploadItem, TaskAttachmentUploadProgress } from './upload-progress';
import type { RcFile, UploadProps } from 'antd/es/upload';
import { TFunction } from 'i18next';
import AttachmentsUpload from './attachments-upload';
import { useEffect, useRef } from 'react';
import { message } from '@/shared/antd-imports';

interface AttachmentsGridProps {
  attachments: ITaskAttachmentViewModel[];
  onDelete?: (id: string) => void;
  onUpload?: (file: RcFile) => void;
  isCommentAttachment?: boolean;
  t: TFunction;
  loadingTask: boolean;
  uploading: boolean;
  handleFilesSelected: (files: File[]) => void;
  onUpgradeRequested?: () => void;
  maxFileSizeMb?: number;
  showUpgradeLink?: boolean;
  uploadProgressItems?: TaskAttachmentUploadItem[];
  isGuest?: boolean;
}

const DEFAULT_MAX_FILE_SIZE_MB = 25;

/**
 * Pull files off a clipboard event, preferring `items` (keeps the original
 * MIME type intact) and falling back to `files` for older browsers.
 * Must be called synchronously inside the `paste` handler — `DataTransfer`
 * is only valid during the event dispatch.
 */
const extractFilesFromClipboard = (data: DataTransfer | null): File[] => {
  if (!data) return [];

  const files: File[] = [];
  if (data.items && data.items.length > 0) {
    for (let i = 0; i < data.items.length; i++) {
      const item = data.items[i];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
  }

  if (files.length === 0 && data.files && data.files.length > 0) {
    files.push(...Array.from(data.files));
  }

  return files;
};

const AttachmentsGrid = ({
  attachments,
  onDelete,
  onUpload,
  isCommentAttachment = false,
  t,
  loadingTask,
  uploading,
  handleFilesSelected,
  onUpgradeRequested,
  maxFileSizeMb,
  showUpgradeLink,
  uploadProgressItems = [],
  isGuest = false,
}: AttachmentsGridProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const supportsUpload = !isCommentAttachment && !isGuest;

  useEffect(() => {
    if (!supportsUpload) return;

    const handlePaste = (event: ClipboardEvent) => {
      // Don't intercept when the grid (or its drawer) isn't on screen.
      const container = containerRef.current;
      if (!container) return;

      // Scope to the drawer that contains this grid so other drawers / the
      // rest of the page keep their native paste behaviour.
      const drawer = container.closest('.ant-drawer');
      const target = event.target as HTMLElement | null;
      if (drawer && target && !drawer.contains(target)) return;

      // Never steal pastes from text editors (description, comments, inputs):
      // those handle their own paste (images into the description, plain text
      // into the comment box) and must keep working.
      if (
        target?.closest(
          'input, textarea, [contenteditable="true"], [contenteditable=""], [role="textbox"]'
        )
      ) {
        return;
      }

      // Busy or disabled — let the browser handle paste normally.
      if (loadingTask || uploading) return;

      const files = extractFilesFromClipboard(event.clipboardData);
      if (files.length === 0) return; // text/other paste — do not hijack

      event.preventDefault();

      const maxMb = maxFileSizeMb ?? DEFAULT_MAX_FILE_SIZE_MB;
      const maxBytes = maxMb * 1024 * 1024;

      const valid: File[] = [];
      const oversize: File[] = [];

      files.forEach(file => {
        if (file.size > maxBytes) oversize.push(file);
        else valid.push(file);
      });

      if (oversize.length > 0) {
        message.error(
          t('taskInfoTab.attachments.filesTooLarge', {
            defaultValue:
              'These files exceed the {{maxSize}}MB limit and were not added: {{names}}',
            maxSize: maxMb,
            names: oversize.map(f => f.name || 'pasted-file').join(', '),
          })
        );
      }

      if (valid.length > 0) {
        // Delegate to the same handler used by the file picker so all
        // existing type/size/plan validation and telemetry runs unchanged.
        handleFilesSelected(valid);
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [
    supportsUpload,
    loadingTask,
    uploading,
    handleFilesSelected,
    maxFileSizeMb,
    t,
  ]);

  const handleUpload: UploadProps['beforeUpload'] = file => {
    if (onUpload) {
      onUpload(file);
    }
    return false; // Prevent default upload behavior
  };

  return (
    <div className="attachments-container" ref={containerRef}>
      <div className="attachments-grid">
        {attachments.map(attachment => (
          <AttachmentsPreview
            key={attachment.id}
            attachment={attachment}
            onDelete={isGuest ? undefined : onDelete}
            isCommentAttachment={isCommentAttachment}
            isGuest={isGuest}
          />
        ))}
        {supportsUpload && (
          <>
            {uploadProgressItems.length > 0 && (
              <div
                className="attachments-upload-progress-list"
                style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}
              >
                {uploadProgressItems.map(item => (
                  <div
                    key={item.uid}
                    style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: 10 }}
                  >
                    <TaskAttachmentUploadProgress file={item} />
                  </div>
                ))}
              </div>
            )}
            <AttachmentsUpload
              t={t}
              loadingTask={loadingTask}
              uploading={uploading}
              onFilesSelected={handleFilesSelected}
              onUpgradeRequested={onUpgradeRequested}
              maxFileSizeMb={maxFileSizeMb}
              showUpgradeLink={showUpgradeLink}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default AttachmentsGrid;
