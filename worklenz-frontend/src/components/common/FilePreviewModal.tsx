import React from 'react';
import { Button, Modal, Spin, Typography, DownloadOutlined } from '@/shared/antd-imports';
import './FilePreviewModal.css';

type FileType = 'image' | 'video' | 'audio' | 'document' | 'unknown';

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'ico', 'svg'];
const VIDEO_EXTS = ['mp4', 'webm', 'ogg'];
const AUDIO_EXTS = ['mp3', 'wav', 'm4a', 'aac', 'ogg'];

// We'll still call these "document", but treat PDF specially (direct iframe)
const DOC_EXTS = ['ppt', 'pptx', 'doc', 'docx', 'xls', 'xlsx', 'pdf'];

const MODAL_WIDTH: Record<FileType, number> = {
  image: 768,
  video: 768,
  audio: 600,
  document: 1024,
  unknown: 600,
};

function getExt(name?: string, url?: string): string {
  const fromName = name?.split('.').pop()?.toLowerCase();
  if (fromName) return fromName;

  const fromUrl = url?.split('?')[0].split('.').pop()?.toLowerCase();
  return fromUrl || '';
}

function detectFileType(name?: string, url?: string): FileType {
  const ext = getExt(name, url);
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
  const fileType = detectFileType(name, url);
  const width = MODAL_WIDTH[fileType];
  const ext = getExt(name, url);

  const isPdf = ext === 'pdf';

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
            <source src={url} />
          </video>
        )}

        {!isLoading && fileType === 'audio' && url && (
          <audio className="file-preview-media" controls>
            <source src={url} />
          </audio>
        )}

        {!isLoading && fileType === 'document' && url && (
          <>
            {/* Prefer direct render for PDFs */}
            {isPdf ? (
              <iframe
                title={name || 'PDF preview'}
                src={url}
                width="100%"
                height="500px"
                style={{ border: 'none' }}
              />
            ) : (
              <iframe
                title={name || 'Document preview'}
                src={`https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`}
                width="100%"
                height="500px"
                style={{ border: 'none' }}
              />
            )}
          </>
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