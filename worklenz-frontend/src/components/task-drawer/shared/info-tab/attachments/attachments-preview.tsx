import { useState } from 'react';
import { ITaskAttachmentViewModel } from '@/types/tasks/task-attachment-view-model';
import { Button, Tooltip, Popconfirm, message, dayjs } from '@/shared/antd-imports';
import {
  EyeOutlined,
  DownloadOutlined,
  DeleteOutlined,
  QuestionCircleOutlined,
} from '@/shared/antd-imports';
import { attachmentsApiService } from '@/api/attachments/attachments.api.service';
import { IconsMap } from '@/shared/constants';
import './attachments-preview.css';
import taskAttachmentsApiService from '@/api/tasks/task-attachments.api.service';
import logger from '@/utils/errorLogger';
import taskCommentsApiService from '@/api/tasks/task-comments.api.service';
import { useAppSelector } from '@/hooks/useAppSelector';
import { FilePreviewModal } from '@/components/common/FilePreviewModal';

interface AttachmentsPreviewProps {
  attachment: ITaskAttachmentViewModel;
  onDelete?: (id: string) => void;
  isCommentAttachment?: boolean;
}

const AttachmentsPreview = ({
  attachment,
  onDelete,
  isCommentAttachment = false,
}: AttachmentsPreviewProps) => {
  const { selectedTaskId } = useAppSelector(state => state.taskDrawerReducer);
  const [deleting, setDeleting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const getFileIcon = (type?: string) => {
    if (!type) return 'search.png';
    return IconsMap[type] || 'search.png';
  };

  const isImageFile = (): boolean => {
    const imageTypes = ['jpeg', 'jpg', 'bmp', 'gif', 'webp', 'png', 'ico'];
    const type = attachment?.type;
    if (type) return imageTypes.includes(type);
    return false;
  };

  const download = async (id?: string, name?: string) => {
    if (!id || !name) return;
    try {
      setDownloading(true);
      const res = await attachmentsApiService.downloadAttachment(id, name);
      if (res && res.done && res.body?.url) {
        const link = document.createElement('a');
        link.href = res.body.url;
        link.download = name;
        link.click();
        link.remove();
      }
    } catch (e) {
      console.error(e);
      message.error('Failed to download file');
    } finally {
      setDownloading(false);
    }
  };

  const handleDelete = async (id?: string) => {
    if (!id || !selectedTaskId) return;
    try {
      setDeleting(true);

      if (isCommentAttachment) {
        const res = await taskCommentsApiService.deleteAttachment(id, selectedTaskId);
        if (res.done) {
          document.dispatchEvent(new Event('task-comment-update'));
        }
      } else {
        const res = await taskAttachmentsApiService.deleteTaskAttachment(id);
        if (res.done && onDelete) {
          onDelete(id);
        }
      }
    } catch (e) {
      logger.error('Error deleting attachment:', e);
      message.error('Failed to delete attachment');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="ant-upload-list-picture-card-container">
        {attachment && (
          <div className="ant-upload-list-item ant-upload-list-item-done ant-upload-list-item-list-type-picture-card">
            <Tooltip
              title={
                <div>
                  <p style={{ margin: 0 }}>{attachment.name}</p>
                  <p style={{ margin: 0 }}>{attachment.size}</p>
                  <p style={{ margin: 0 }}>
                    {attachment.created_at
                      ? dayjs(attachment.created_at).format('MMM D, YYYY h:mm A')
                      : ''}
                  </p>
                </div>
              }
              placement="bottom"
            >
              <div className="ant-upload-list-item-info">
                <img
                  src={`/file-types/${getFileIcon(attachment.type)}`}
                  className="file-icon"
                  alt=""
                />
                <div
                  className="ant-upload-span"
                  style={{
                    backgroundImage: isImageFile() ? `url(${attachment.url})` : '',
                  }}
                >
                  <a
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ant-upload-list-item-thumbnail"
                    href={attachment.url}
                  >
                    {!isImageFile() && (
                      <span
                        className="anticon anticon-file-unknown"
                        style={{ fontSize: 34, color: '#cccccc' }}
                      />
                    )}
                  </a>
                </div>
              </div>
            </Tooltip>

            <span className="ant-upload-list-item-actions">
              <Button
                type="text"
                size="small"
                title="Preview file"
                onClick={() => setPreviewOpen(true)}
                className="ant-upload-list-item-card-actions-btn"
              >
                <EyeOutlined />
              </Button>

              <Button
                type="text"
                size="small"
                title="Download file"
                onClick={() => download(attachment.id, attachment.name)}
                loading={downloading}
                className="ant-upload-list-item-card-actions-btn"
              >
                <DownloadOutlined />
              </Button>

              <Popconfirm
                title="Delete Attachment"
                description="Are you sure you want to delete this attachment?"
                icon={<QuestionCircleOutlined style={{ color: 'red' }} />}
                onConfirm={() => handleDelete(attachment.id)}
                okText="Yes"
                cancelText="No"
              >
                <Button
                  type="text"
                  size="small"
                  title="Remove file"
                  loading={deleting}
                  className="ant-upload-list-item-card-actions-btn"
                >
                  <DeleteOutlined />
                </Button>
              </Popconfirm>
            </span>
          </div>
        )}
      </div>

      <FilePreviewModal
        open={previewOpen}
        name={attachment.name}
        url={attachment.url}
        onClose={() => setPreviewOpen(false)}
        onDownload={() => void download(attachment.id, attachment.name)}
        downloading={downloading}
      />
    </>
  );
};

export default AttachmentsPreview;
