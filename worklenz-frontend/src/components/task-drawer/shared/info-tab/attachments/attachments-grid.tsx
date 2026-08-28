import { ITaskAttachmentViewModel } from '@/types/tasks/task-attachment-view-model';
import AttachmentsPreview from './attachments-preview';
import './attachments-preview.css';
import { TaskAttachmentUploadItem, TaskAttachmentUploadProgress } from './upload-progress';
import type { RcFile, UploadProps } from 'antd/es/upload';
import { TFunction } from 'i18next';
import AttachmentsUpload from './attachments-upload';

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
  const handleUpload: UploadProps['beforeUpload'] = file => {
    if (onUpload) {
      onUpload(file);
    }
    return false; // Prevent default upload behavior
  };

  return (
    <div className="attachments-container">
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
        {!isCommentAttachment && !isGuest && (
          <>
            {uploadProgressItems.length > 0 && (
              <div className="attachments-upload-progress-list" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {uploadProgressItems.map(item => (
                  <div key={item.uid} style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: 10 }}>
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
