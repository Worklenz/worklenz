import React from 'react';
import { Button, Modal, Spin, Typography, DownloadOutlined } from '@/shared/antd-imports';
import './FilePreviewModal.css';

type FileType = 'image' | 'video' | 'audio' | 'document' | 'unknown';

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'ico'];
const VIDEO_EXTS = ['mp4', 'webm', 'ogg'];
const AUDIO_EXTS = ['mp3', 'wav'];
const DOC_EXTS = ['ppt', 'pptx', 'doc', 'docx', 'xls', 'xlsx', 'pdf'];

const MODAL_WIDTH: Record<FileType, number> = {
  image: 768,
  video: 768,
  audio: 600,
  document: 1024,
  unknown: 600,
};

function detectFileType(url?: string): FileType {
  if (!url) return 'unknown';
  const ext = url.split('?')[0].split('.').pop()?.toLowerCase() || '';
  if (IMAGE_EXTS.includes(ext)) return 'image';
  if (VIDEO_EXTS.includes(ext)) return 'video';
  if (AUDIO_EXTS.includes(ext)) return 'audio';
  if (DOC_EXTS.includes(ext)) return 'document';
  return 'unknown';
}

interface FilePreviewModalProps {
  open: boolean;
  name?: string;
  url?: string;
  isLoading?: boolean;
  onClose: () => void;
  onDownload?: () => void;
  downloading?: boolean;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  open,
  name,
  url,
  isLoading,
  onClose,
  onDownload,
  downloading,
}) => {
  const fileType = detectFileType(url);
  const width = MODAL_WIDTH[fileType];

  return (
    <Modal
      open={open}
      title={<Typography.Text>{name}</Typography.Text>}
      centered
      onCancel={onClose}
      width={width}
      className="file-preview-modal"
      footer={
        onDownload
          ? [
              <Button key="download" onClick={onDownload} loading={downloading}>
                <DownloadOutlined /> Download
              </Button>,
            ]
          : null
      }
    >
      <div className="file-preview-container">
        {isLoading && <Spin />}

        {!isLoading && fileType === 'image' && url && (
          <img src={url} className="file-preview-media" alt={name} />
        )}

        {!isLoading && fileType === 'video' && url && (
          <video className="file-preview-media" controls>
            <source src={url} type="video/mp4" />
          </video>
        )}

        {!isLoading && fileType === 'audio' && url && (
          <audio className="file-preview-media" controls>
            <source src={url} type="audio/mpeg" />
          </audio>
        )}

        {!isLoading && fileType === 'document' && url && (
          <iframe
            src={`https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`}
            width="100%"
            height="500px"
            style={{ border: 'none' }}
          />
        )}

        {!isLoading && fileType === 'unknown' && (
          <Typography.Text type="secondary">
            Preview is not available for this file type.
          </Typography.Text>
        )}
      </div>
    </Modal>
  );
};
