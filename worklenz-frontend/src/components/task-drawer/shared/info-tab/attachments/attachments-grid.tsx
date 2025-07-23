import { ITaskAttachmentViewModel } from '@/types/tasks/task-attachment-view-model';
import AttachmentsPreview from './attachments-preview';
import './attachments-preview.css';
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
            onDelete={onDelete}
            isCommentAttachment={isCommentAttachment}
          />
        ))}
        {!isCommentAttachment && (
          <AttachmentsUpload
            t={t}
            loadingTask={loadingTask}
            uploading={uploading}
            onFilesSelected={handleFilesSelected}
          />
        )}
      </div>
    </div>
  );
};

export default AttachmentsGrid;
