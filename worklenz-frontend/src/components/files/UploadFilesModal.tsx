import React, { useRef, useState } from 'react';
import {
  Modal,
  Select,
  Typography,
  Upload,
  UploadProps,
  Flex,
  Space,
  Progress,
  Button,
  DeleteOutlined,
  InboxOutlined,
  ClockCircleOutlined,
  CheckCircleTwoTone,
  CloseCircleTwoTone,
  message,
} from '@/shared/antd-imports';
import type { UploadFile } from 'antd/es/upload/interface';
import { useTranslation } from 'react-i18next';
import { useGetProjectsQuery } from '@/api/projects/projects.v1.api.service';
import projectFilesApiService from '@/api/projects/project-files.api.service';
import { useAuthService } from '@/hooks/useAuth';
import { hasBusinessFeatureAccess } from '@/ee/utils/subscription-utils';
import { colors } from '@/styles/colors';
import logger from '@/utils/errorLogger';

const MB = 1024 * 1024;
const STARTER_FILE_SIZE_LIMIT_BYTES = 25 * MB;
const BUSINESS_FILE_SIZE_LIMIT_BYTES = 250 * MB;
const BLOCKED_EXTENSIONS = [
  'exe', 'bat', 'cmd', 'com', 'pif', 'scr', 'vbs', 'js', 'jar', 'app',
  'deb', 'rpm', 'dmg', 'pkg', 'sh', 'ps1', 'dll', 'msi',
];

type PendingUploadFile = UploadFile & { errorMessage?: string };

const formatFileSize = (bytes?: number): string => {
  if (bytes === undefined || bytes === null) return '--';
  const thresh = 1024;
  if (bytes < thresh) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let u = -1;
  let value = bytes;
  do {
    value /= thresh;
    ++u;
  } while (value >= thresh && u < units.length - 1);
  const precision = value >= 10 ? 0 : 1;
  return `${value.toFixed(precision)} ${units[u]}`;
};

interface UploadFilesModalProps {
  open: boolean;
  onClose: () => void;
  onUploaded: () => void;
}

export const UploadFilesModal: React.FC<UploadFilesModalProps> = ({ open, onClose, onUploaded }) => {
  const { t } = useTranslation('team-files');
  const authService = useAuthService();
  const hasBusinessAccess = hasBusinessFeatureAccess(authService.getCurrentSession());
  const maxFileSizeBytes = hasBusinessAccess ? BUSINESS_FILE_SIZE_LIMIT_BYTES : STARTER_FILE_SIZE_LIMIT_BYTES;
  const maxFileSizeMb = hasBusinessAccess ? 250 : 25;

  const { data: projectsData } = useGetProjectsQuery({
    index: 1,
    size: 200,
    field: 'name',
    order: 'asc',
    search: '',
    filter: null,
    statuses: '',
    categories: '',
    priorities: '',
  });

  const [projectId, setProjectId] = useState<string | undefined>(undefined);
  const [pendingFiles, setPendingFiles] = useState<PendingUploadFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const uploadAbortRef = useRef<AbortController | null>(null);

  const reset = () => {
    setPendingFiles([]);
    setProjectId(undefined);
  };

  const handleClose = () => {
    uploadAbortRef.current?.abort();
    reset();
    onClose();
  };

  const isBlockedExtension = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    return BLOCKED_EXTENSIONS.includes(ext);
  };

  const beforeUpload: UploadProps['beforeUpload'] = file => {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';

    if (isBlockedExtension(file.name)) {
      message.error(
        t('blockedFileType', { defaultValue: 'Files with .{{ext}} extensions are not allowed.', ext })
      );
      return Upload.LIST_IGNORE;
    }

    if (file.size > maxFileSizeBytes) {
      message.error(
        t('fileTooLarge', {
          defaultValue: '{{file}} exceeds the {{maxSize}} MB limit.',
          file: file.name,
          maxSize: maxFileSizeMb,
        })
      );
      return Upload.LIST_IGNORE;
    }

    const alreadyAdded = pendingFiles.some(p => p.name === file.name && p.size === file.size);
    if (!alreadyAdded) {
      setPendingFiles(prev => [
        ...prev,
        { uid: file.uid, name: file.name, size: file.size, status: 'ready', percent: 0, originFileObj: file },
      ]);
    }

    return false;
  };

  const handleRemoveFile = (file: PendingUploadFile) => {
    setPendingFiles(prev => prev.filter(item => item.uid !== file.uid));
    return true;
  };

  const updatePendingFile = (uid: string, updater: (file: PendingUploadFile) => PendingUploadFile) => {
    setPendingFiles(prev => prev.map(file => (file.uid === uid ? updater(file) : file)));
  };

  const uploadFiles = async () => {
    if (!projectId) {
      message.warning(t('selectProjectFirst', { defaultValue: 'Please select a project.' }));
      return;
    }
    if (!pendingFiles.length) {
      message.warning(t('noFilesSelected', { defaultValue: 'Add at least one file.' }));
      return;
    }

    const abortController = new AbortController();
    uploadAbortRef.current = abortController;

    try {
      setUploading(true);
      let hasError = false;

      for (const file of pendingFiles) {
        const rawFile = file.originFileObj as File;

        updatePendingFile(file.uid, current => ({ ...current, status: 'uploading', percent: 0, errorMessage: undefined }));

        try {
          const presignResponse = await projectFilesApiService.presign(
            projectId,
            rawFile.name,
            rawFile.size,
            rawFile.type || 'application/octet-stream'
          );

          if (!presignResponse.done || !presignResponse.body) {
            throw new Error(presignResponse.message || 'Failed to initiate upload');
          }

          const { file_id, upload_url } = presignResponse.body;

          await projectFilesApiService.uploadDirect(
            upload_url,
            rawFile,
            percent => updatePendingFile(file.uid, current => ({ ...current, status: 'uploading', percent })),
            abortController.signal
          );

          const confirmResponse = await projectFilesApiService.confirm(projectId, file_id);
          if (!confirmResponse.done) {
            throw new Error(confirmResponse.message || 'Upload confirmation failed');
          }

          updatePendingFile(file.uid, current => ({ ...current, status: 'done', percent: 100 }));
        } catch (error: unknown) {
          hasError = true;
          const axiosMessage = (error as any)?.response?.data?.message as string | undefined;
          const rawMessage = error instanceof Error ? error.message : undefined;
          const serverMessage = axiosMessage || rawMessage;

          updatePendingFile(file.uid, current => ({
            ...current,
            status: 'error',
            percent: undefined,
            errorMessage: serverMessage || t('uploadFailedShort', { defaultValue: 'Upload failed' }),
          }));

          logger.error('Error uploading file', error);
          if (abortController.signal.aborted) break;
        }
      }

      if (!hasError) {
        message.success(t('uploadSuccess', { defaultValue: 'Files uploaded successfully.' }));
        handleClose();
        onUploaded();
      } else {
        message.error(t('uploadFailed', { defaultValue: 'Upload failed. Please try again.' }));
      }
    } finally {
      setUploading(false);
      uploadAbortRef.current = null;
    }
  };

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      title={t('uploaderTitle', { defaultValue: 'Upload Files' })}
      okText={t('uploadActionCta', { defaultValue: 'Upload' })}
      cancelText={t('cancelActionCta', { defaultValue: 'Cancel' })}
      onOk={uploadFiles}
      confirmLoading={uploading}
      width={700}
      destroyOnClose
    >
      <Typography.Text style={{ display: 'block', marginBottom: 8 }}>
        {t('selectProjectLabel', { defaultValue: 'Project' })}
      </Typography.Text>
      <Select
        showSearch
        allowClear
        placeholder={t('selectProjectPlaceholder', { defaultValue: 'Select a project' })}
        value={projectId}
        onChange={setProjectId}
        disabled={uploading}
        filterOption={(input, opt) => (opt?.label as string)?.toLowerCase().includes(input.toLowerCase())}
        options={(projectsData?.body?.data || []).map(p => ({ value: p.id as string, label: p.name as string }))}
        style={{ width: '100%', marginBottom: 16 }}
      />

      <Typography.Paragraph style={{ marginBottom: 16 }}>
        {t('uploadDescription', {
          defaultValue: 'Drag & Drop files or click to browse. Max {{maxSize}} MB per file.',
          maxSize: maxFileSizeMb,
        })}
      </Typography.Paragraph>

      <Upload.Dragger
        multiple
        beforeUpload={beforeUpload}
        onRemove={handleRemoveFile}
        fileList={pendingFiles}
        disabled={uploading || !projectId}
        showUploadList
        itemRender={(_originNode, file, _fileList, actions) => {
          const typedFile = file as PendingUploadFile;

          const renderStatus = () => {
            if (typedFile.status === 'uploading') {
              return (
                <Flex align="center" gap={6}>
                  <ClockCircleOutlined style={{ color: '#8c8c8c' }} />
                  <Typography.Text type="secondary">
                    {typedFile.percent ? `${typedFile.percent}%` : t('uploadingLabel', { defaultValue: 'Uploading' })}
                  </Typography.Text>
                  <Progress percent={typedFile.percent ?? 0} size="small" style={{ width: 90, marginBottom: 0 }} showInfo={false} />
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
            <Flex justify="space-between" align="center" style={{ width: '100%', padding: '4px 8px' }}>
              <Space size={8} align="center">
                <Typography.Text>{typedFile.name}</Typography.Text>
                <Typography.Text type="secondary">{formatFileSize(typedFile.size)}</Typography.Text>
              </Space>
              <Space size={12} align="center">
                {renderStatus()}
                {!uploading && (
                  <Button
                    type="text"
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={e => {
                      e.stopPropagation();
                      actions.remove?.(file);
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
          {projectId
            ? t('filePickerHint', { defaultValue: 'Drag & Drop files or click to browse' })
            : t('selectProjectFirstHint', { defaultValue: 'Select a project above to enable uploads' })}
        </p>
        <p className="ant-upload-hint">
          {t('uploadHintLimit', {
            defaultValue: 'PDF, images, documents, archives. Max {{maxSize}} MB per file.',
            maxSize: maxFileSizeMb,
          })}
        </p>
      </Upload.Dragger>
    </Modal>
  );
};
