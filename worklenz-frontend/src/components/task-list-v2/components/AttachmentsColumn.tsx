import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  DownloadOutlined,
  FileOutlined,
  LoadingOutlined,
  PlusOutlined,
  Popover,
  message,
} from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import taskAttachmentsApiService from '@/api/tasks/task-attachments.api.service';
import type { ITaskAttachmentViewModel } from '@/types/tasks/task-attachment-view-model';
import type { Task } from '@/types/task-management.types';
import { FilePreviewModal } from '@/components/common/FilePreviewModal';

interface AttachmentsColumnProps {
  width: string;
  task: Task;
  projectId: string;
  disabled?: boolean;
}

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']);

const getExtension = (attachment: ITaskAttachmentViewModel): string => {
  const type = attachment.type?.toLowerCase().split('/').pop() || '';
  if (type && type !== 'octet-stream') return type.replace('jpeg', 'jpg');
  return attachment.name?.split('.').pop()?.toLowerCase() || '';
};

const isImageAttachment = (attachment: ITaskAttachmentViewModel): boolean =>
  IMAGE_EXTENSIONS.has(getExtension(attachment));

const getTypeLabel = (attachment: ITaskAttachmentViewModel): string => {
  const extension = getExtension(attachment);
  const label = extension === 'jpeg' ? 'jpg' : extension;
  return (label || 'file').slice(0, 4).toUpperCase();
};

const downloadAttachment = async (attachment: ITaskAttachmentViewModel): Promise<void> => {
  if (!attachment.id || !attachment.name) return;

  const response = await taskAttachmentsApiService.downloadTaskAttachment(
    attachment.id,
    attachment.name
  );

  if (!response.done || !response.body?.url) {
    throw new Error(response.message || 'Download failed');
  }

  const link = document.createElement('a');
  link.href = response.body.url;
  link.download = attachment.name;
  link.click();
  link.remove();
};

const AttachmentDetails = ({
  attachment,
  onDownload,
  onOpen,
  t,
}: {
  attachment: ITaskAttachmentViewModel;
  onDownload: () => void;
  onOpen: () => void;
  t: ReturnType<typeof useTranslation>['t'];
}) => (
  <div className="flex min-w-[240px] max-w-[280px] flex-col gap-2 p-1">
    <div className="flex items-center gap-2">
      {isImageAttachment(attachment) ? (
        <img
          src={attachment.url}
          alt={attachment.name || t('attachmentsColumn', { defaultValue: 'Attachment' })}
          className="h-10 w-10 rounded object-cover"
          loading="lazy"
        />
      ) : (
        <FileOutlined className="text-2xl text-gray-500" />
      )}

      <div className="min-w-0">
        <div className="truncate font-medium">{attachment.name || '--'}</div>
        <div className="text-xs text-gray-500">
          {getTypeLabel(attachment)} {attachment.size ? `- ${attachment.size}` : ''}
        </div>
      </div>
    </div>

    <div className="text-xs text-gray-500">
      {attachment.uploader_name ||
        t('attachmentsUnknownUploader', { defaultValue: 'Unknown uploader' })}
      {attachment.created_at ? ` - ${attachment.created_at}` : ''}
    </div>

    <div className="flex gap-2">
      <Button size="small" onClick={onOpen}>
        {t('attachmentsOpen', { defaultValue: 'Open' })}
      </Button>
      <Button size="small" icon={<DownloadOutlined />} onClick={onDownload}>
        {t('attachmentsDownload', { defaultValue: 'Download' })}
      </Button>
    </div>
  </div>
);

export const AttachmentsColumn: React.FC<AttachmentsColumnProps> = ({
  width,
  task,
  projectId,
  disabled = false,
}) => {
  const { t } = useTranslation('task-list-table');

  const inputRef = useRef<HTMLInputElement>(null);

  // Drag depth counter to avoid flicker when moving over children inside the drop zone
  const dragDepthRef = useRef(0);

  const [attachments, setAttachments] = useState<ITaskAttachmentViewModel[]>(
    task.attachments || []
  );
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [isDragging, setIsDragging] = useState(false);

  const [previewAttachment, setPreviewAttachment] = useState<ITaskAttachmentViewModel | null>(null);

  const [popoverOpen, setPopoverOpen] = useState(false);

  useEffect(() => {
    setAttachments(task.attachments || []);
  }, [task.attachments, task.id]);

  const visibleAttachments = useMemo(() => {
    if (attachments.length <= 2) return attachments;
    return attachments.slice(0, attachments.length > 5 ? 1 : 2);
  }, [attachments]);

  const overflowAttachments = useMemo(() => {
    return attachments.slice(visibleAttachments.length);
  }, [attachments, visibleAttachments.length]);

  const overflowCount = overflowAttachments.length;

  const handleDownload = async (attachment: ITaskAttachmentViewModel) => {
    try {
      await downloadAttachment(attachment);
    } catch {
      message.error(
        t('attachmentsDownloadFailed', { defaultValue: 'Unable to download attachment' })
      );
    }
  };

  const uploadFile = async (file: File) => {
    if (disabled || isUploading || !task.id || !projectId) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const presign = await taskAttachmentsApiService.presignTaskAttachment(
        task.id,
        projectId,
        file.name,
        file.size,
        file.type || 'application/octet-stream'
      );
      if (!presign.done || !presign.body) throw new Error(presign.message || 'Upload failed');

      await taskAttachmentsApiService.uploadDirect(presign.body.upload_url, file);

      const confirmed = await taskAttachmentsApiService.confirmTaskAttachment(
        presign.body.file_id,
        task.id
      );
      if (!confirmed.done || !confirmed.body) throw new Error(confirmed.message || 'Upload failed');

      setAttachments(prev => [...prev, confirmed.body as ITaskAttachmentViewModel]);
    } catch {
      setUploadError(t('attachmentsUploadFailed', { defaultValue: 'Unable to upload attachment' }));
    } finally {
      setIsUploading(false);
      setIsDragging(false);
      dragDepthRef.current = 0;
    }
  };

  const handleFiles = (files: FileList | File[]) => {
    const file = files[0];
    if (file) void uploadFile(file);
  };

  const handleCellClick = () => {
    if (!disabled && !isUploading) inputRef.current?.click();
  };

  const isFilesDrag = (event: React.DragEvent) =>
    Array.from(event.dataTransfer.types || []).includes('Files');

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    if (disabled || isUploading) return;
    if (!isFilesDrag(event)) return;

    event.preventDefault();
    event.stopPropagation();

    dragDepthRef.current += 1;
    setIsDragging(true);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (disabled || isUploading) return;
    if (!isFilesDrag(event)) return;

    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    if (disabled || isUploading) return;
    if (!isFilesDrag(event)) return;

    event.preventDefault();
    event.stopPropagation();

    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDragging(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    if (disabled || isUploading) return;
    if (!isFilesDrag(event)) return;

    event.preventDefault();
    event.stopPropagation();

    dragDepthRef.current = 0;
    setIsDragging(false);

    handleFiles(event.dataTransfer.files);
  };

  // Open in the SAME modal for all file types (best-effort preview handled by FilePreviewModal)
  const handleOpen = (attachment: ITaskAttachmentViewModel) => {
    if (attachment.url) {
      setPreviewAttachment(attachment);
      return;
    }
    void handleDownload(attachment);
  };

  const renderAttachment = (attachment: ITaskAttachmentViewModel) => {
    const button = (
      <button
        type="button"
        key={attachment.id || attachment.name}
        className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded border border-gray-200 bg-gray-50 dark:border-gray-600 dark:bg-gray-800"
        onClick={() => handleOpen(attachment)}
        aria-label={attachment.name || t('attachmentsColumn', { defaultValue: 'Attachment' })}
      >
        {isImageAttachment(attachment) ? (
          <img src={attachment.url} alt="" className="h-8 w-8 object-cover" loading="lazy" />
        ) : (
          <span className="text-[10px] font-semibold text-gray-600 dark:text-gray-300">
            {getTypeLabel(attachment)}
          </span>
        )}
      </button>
    );

    return (
      <Popover
        key={attachment.id || attachment.name}
        trigger="hover"
        mouseEnterDelay={0.3}
        content={
          <AttachmentDetails
            attachment={attachment}
            onDownload={() => void handleDownload(attachment)}
            onOpen={() => handleOpen(attachment)}
            t={t}
          />
        }
      >
        {button}
      </Popover>
    );
  };

  const addAttachmentButton = !disabled ? (
    <button
      type="button"
      onClick={handleCellClick}
      disabled={isUploading}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-dashed border-gray-300 bg-transparent text-gray-400 transition-colors hover:border-gray-400 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:hover:border-gray-500 dark:hover:text-gray-200"
      aria-label={t('attachmentsAdd', { defaultValue: 'Add attachment' })}
      title={t('attachmentsAdd', { defaultValue: 'Add attachment' })}
    >
      {isUploading ? <LoadingOutlined spin /> : <PlusOutlined />}
    </button>
  ) : null;

  const content =
    attachments.length === 0 ? (
      <div className="flex h-full w-full flex-col items-center justify-center">
        <button
          type="button"
          className="flex h-full w-full items-center justify-center gap-1 text-xs text-gray-400 opacity-0 transition-opacity group-hover:opacity-100"
          onClick={handleCellClick}
          disabled={disabled || isUploading}
        >
          {isUploading ? <LoadingOutlined spin /> : <PlusOutlined />}
          {t('attachmentsAdd', { defaultValue: 'Add' })}
        </button>

        {uploadError && (
          <span className="max-w-full truncate text-[10px] text-red-500">{uploadError}</span>
        )}
      </div>
    ) : (
      <div className="flex h-full items-center gap-1">
        {visibleAttachments.map(renderAttachment)}

        {overflowCount > 0 && (
          <Popover
            open={popoverOpen}
            onOpenChange={setPopoverOpen}
            trigger={['hover', 'click']}
            mouseEnterDelay={0.3}
            content={
              <div className="flex max-h-64 min-w-[260px] flex-col gap-2 overflow-auto">
                {overflowAttachments.map(attachment => (
                  <div
                    key={attachment.id || attachment.name}
                    className="flex items-center justify-between gap-2"
                  >
                    <button
                      type="button"
                      className="min-w-0 truncate text-left"
                      onClick={() => handleOpen(attachment)}
                    >
                      {attachment.name || '--'}
                    </button>

                    <Button
                      size="small"
                      icon={<DownloadOutlined />}
                      aria-label={t('attachmentsDownload', { defaultValue: 'Download' })}
                      onClick={() => void handleDownload(attachment)}
                    />
                  </div>
                ))}
              </div>
            }
          >
            <button
              type="button"
              className="text-xs text-blue-600 dark:text-blue-400"
              onClick={() => setPopoverOpen(true)}
            >
              +{overflowCount}
            </button>
          </Popover>
        )}

        {/* Add attachment control in populated state */}
        {addAttachmentButton}

        {uploadError && (
          <span className="ml-2 max-w-[140px] truncate text-[10px] text-red-500">
            {uploadError}
          </span>
        )}
      </div>
    );

  return (
    <>
      <div
        className={[
          // min-h-* prevents squashed outline on empty cells
          'group relative flex h-full min-h-10 items-center border-r border-gray-200 px-2 dark:border-gray-700',
          isDragging
            ? [
                'bg-blue-50 dark:bg-blue-900/20',
                // outline overlay
                "after:content-[''] after:pointer-events-none after:absolute after:inset-0 after:m-1 after:rounded-md",
                'after:border-2 after:border-dashed after:border-blue-500/80 dark:after:border-blue-400/70',
                'ring-1 ring-blue-400/30',
              ].join(' ')
            : '',
        ].join(' ')}
        style={{ width }}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={event => {
            if (event.target.files) handleFiles(event.target.files);
            event.target.value = '';
          }}
          disabled={disabled || isUploading}
        />

        {content}
      </div>

      <FilePreviewModal
        open={previewAttachment !== null}
        name={previewAttachment?.name}
        url={previewAttachment?.url}
        onClose={() => setPreviewAttachment(null)}
        onDownload={previewAttachment ? () => void handleDownload(previewAttachment) : undefined}
      />
    </>
  );
};

AttachmentsColumn.displayName = 'AttachmentsColumn';
