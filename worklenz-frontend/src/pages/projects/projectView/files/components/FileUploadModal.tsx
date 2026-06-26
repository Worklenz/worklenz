import { Button, Flex, Modal, Progress, Space, Typography, Upload } from '@/shared/antd-imports';
import type { RcFile } from 'antd/es/upload/interface';
import {
  CheckCircleTwoTone,
  CloseCircleTwoTone,
  ClockCircleOutlined,
  DeleteOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { colors } from '@/styles/colors';
import { formatFileSize } from '../utils';
import type { PendingUploadFile } from '../types';

interface FileUploadModalProps {
  open: boolean;
  uploading: boolean;
  pendingFiles: PendingUploadFile[];
  onClose: () => void;
  onUpload: () => void;
  beforeUpload: (file: RcFile) => boolean | string;
  onRemoveFile: (file: PendingUploadFile) => boolean;
}

export const FileUploadModal = ({
  open,
  uploading,
  pendingFiles,
  onClose,
  onUpload,
  beforeUpload,
  onRemoveFile,
}: FileUploadModalProps) => {
  const { t } = useTranslation('project-view-files');

  const renderStatus = (typedFile: PendingUploadFile) => {
    if (typedFile.status === 'uploading') {
      return (
        <Flex align="center" gap={6}>
          <ClockCircleOutlined style={{ color: '#8c8c8c' }} />
          <Typography.Text type="secondary">
            {typedFile.percent
              ? `${typedFile.percent}%`
              : t('uploadingLabel', { defaultValue: 'Uploading' })}
          </Typography.Text>
          <Progress
            percent={typedFile.percent ?? 0}
            size="small"
            style={{ width: 90, marginBottom: 0 }}
            showInfo={false}
          />
        </Flex>
      );
    }

    if (typedFile.status === 'done') {
      return (
        <Flex align="center" gap={6}>
          <CheckCircleTwoTone twoToneColor="#52c41a" />
          <Typography.Text>{t('uploadedLabel', { defaultValue: 'Uploaded' })}</Typography.Text>
        </Flex>
      );
    }

    if (typedFile.status === 'error') {
      return (
        <Flex align="center" gap={6}>
          <CloseCircleTwoTone twoToneColor={colors.vibrantOrange} />
          <Typography.Text type="danger">
            {typedFile.errorMessage || t('uploadFailedShort', { defaultValue: 'Upload failed' })}
          </Typography.Text>
        </Flex>
      );
    }

    return null;
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={t('uploaderTitle', { defaultValue: 'Upload Files' })}
      okText={t('uploadActionCta', { defaultValue: 'Upload' })}
      cancelText={t('cancelActionCta', { defaultValue: 'Cancel' })}
      onOk={onUpload}
      confirmLoading={uploading}
      width={700}
      destroyOnClose
    >
      <Typography.Paragraph style={{ marginBottom: 16 }}>
        {t('uploadDescription', {
          defaultValue: 'Drag & Drop files or click to browse. Max 100 MB per file.',
        })}
      </Typography.Paragraph>

      <Upload.Dragger
        multiple
        beforeUpload={beforeUpload}
        onRemove={onRemoveFile}
        fileList={pendingFiles}
        disabled={uploading}
        showUploadList
        itemRender={(originNode, file, _fileList, actions) => {
          const typedFile = file as PendingUploadFile;

          return (
            <Flex
              justify="space-between"
              align="center"
              style={{ width: '100%', padding: '4px 8px' }}
            >
              <Space size={8} align="center">
                <Typography.Text>{typedFile.name}</Typography.Text>
                <Typography.Text type="secondary">{formatFileSize(typedFile.size)}</Typography.Text>
              </Space>

              <Space size={12} align="center">
                {renderStatus(typedFile)}
                {!uploading && (
                  <Button
                    type="text"
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={event => {
                      event.stopPropagation();
                      actions.remove?.();
                    }}
                  />
                )}
              </Space>
            </Flex>
          );
        }}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">
          {t('filePickerHint', {
            defaultValue: 'Drag & Drop files or click to browse',
          })}
        </p>
        <p className="ant-upload-hint">
          {t('uploadHintLimit', {
            defaultValue: 'PDF, images, documents, archives. Max 100 MB per file.',
          })}
        </p>
      </Upload.Dragger>
    </Modal>
  );
};
