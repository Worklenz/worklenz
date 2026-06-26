import {
  Button,
  Card,
  Flex,
  Input,
  Modal,
  Popconfirm,
  Segmented,
  Space,
  Table,
  TableProps,
  Tooltip,
  Typography,
  Upload,
  UploadProps,
  Progress,
  message,
  Popover,
  CloudDownloadOutlined,
  DeleteOutlined,
  InboxOutlined,
  ImportOutlined,
  SearchOutlined,
  CheckCircleTwoTone,
  CloseCircleTwoTone,
  ClockCircleOutlined,
} from '@/shared/antd-imports';
import { FilePreviewModal } from '@/components/common/FilePreviewModal';
import type { UploadFile } from 'antd/es/upload/interface';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import projectFilesApiService from '@/api/projects/project-files.api.service';
import taskAttachmentsApiService from '@/api/tasks/task-attachments.api.service';
import { DEFAULT_PAGE_SIZE, IconsMap } from '@/shared/constants';
import { evt_file_uploaded, evt_project_files_visit } from '@/shared/worklenz-analytics-events';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { useAppSumoTracking } from '@/hooks/useAppSumoTracking';
import { AppSumoUpsellEvents } from '@/types/mixpanel-events.types';
import { useAuthService } from '@/hooks/useAuth';
import { useBusinessFeatures } from '@/worklenz-ee/hooks/use-business-features';
import { fetchStorageInfo } from '@/features/admin-center/admin-center.slice';
import { useUpgradePrompt } from '@/worklenz-ee/hooks/use-upgrade-prompt';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { colors } from '@/styles/colors';
import {
  ProjectFile,
  ProjectFilesSortField,
  ProjectFilesSortOrder,
} from '@/types/projects/project-files.types';
import { ITaskAttachmentViewModel } from '@/types/tasks/task-attachment-view-model';
import { getFileType } from '@/types/mixpanel-events.types';
import { durationDateFormat } from '@utils/durationDateFormat';
import logger from '@/utils/errorLogger';

const MB = 1024 * 1024;
const STARTER_FILE_SIZE_LIMIT_BYTES = 25 * MB;
const BUSINESS_FILE_SIZE_LIMIT_BYTES = 250 * MB;
const STARTER_STORAGE_LIMIT_BYTES = 5 * 1024 * MB;
const BLOCKED_EXTENSIONS = [
  'exe',
  'bat',
  'cmd',
  'com',
  'pif',
  'scr',
  'vbs',
  'js',
  'jar',
  'app',
  'deb',
  'rpm',
  'dmg',
  'pkg',
  'sh',
  'ps1',
  'dll',
  'msi',
];

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

const ProjectViewFiles = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('project-view-files');
  const { trackMixpanelEvent } = useMixpanelTracking();
  const { trackAppSumoEvent } = useAppSumoTracking();
  const authService = useAuthService();
  const currentSession = authService.getCurrentSession();
  const isAppSumoUser = String(currentSession?.subscription_type || '').toLowerCase().includes('appsumo');
  const { hasBusinessAccess } = useBusinessFeatures();
  const { promptUpgrade } = useUpgradePrompt();
  const maxFileSizeBytes = hasBusinessAccess
    ? BUSINESS_FILE_SIZE_LIMIT_BYTES
    : STARTER_FILE_SIZE_LIMIT_BYTES;
  const maxFileSizeMb = hasBusinessAccess ? 250 : 25;
  const { projectId, refreshTimestamp } = useAppSelector(state => state.projectReducer);
  const storageInfo = useAppSelector(state => state.adminCenterReducer.storageInfo);
  type PendingUploadFile = UploadFile & { errorMessage?: string };

  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isUploaderOpen, setIsUploaderOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingUploadFile[]>([]);
  const [searchValue, setSearchValue] = useState('');
  const [storageUsage, setStorageUsage] = useState({ used: 0, fileCount: 0 });
  const [sorter, setSorter] = useState<{
    field: ProjectFilesSortField;
    order: ProjectFilesSortOrder;
  }>({
    field: 'created_at',
    order: 'desc',
  });
  const [paginationConfig, setPaginationConfig] = useState({
    total: 0,
    pageIndex: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  const [activeTab, setActiveTab] = useState<'project' | 'task'>('project');
  const [taskAttachments, setTaskAttachments] = useState<ITaskAttachmentViewModel[]>([]);
  const [taskAttachmentsLoading, setTaskAttachmentsLoading] = useState(false);
  const [deletingTaskAttachmentId, setDeletingTaskAttachmentId] = useState<string | null>(null);
  const [taskAttachmentsPagination, setTaskAttachmentsPagination] = useState({
    total: 0,
    pageIndex: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string | null>(null);
  const [previewUrlLoading, setPreviewUrlLoading] = useState(false);
  const [previewDownloadFn, setPreviewDownloadFn] = useState<(() => void) | null>(null);
  const [isStorageUpgradePopoverOpen, setIsStorageUpgradePopoverOpen] = useState(false);
  const [oversizedFileSizeMb, setOversizedFileSizeMb] = useState<number | null>(null);

  const GB = 1024 * MB;
  const storageTotalBytes = storageInfo?.total ? storageInfo.total * GB : null;
  const storagePercent =
    storageTotalBytes && storageUsage.used
      ? Math.min(Math.ceil((storageUsage.used / storageTotalBytes) * 10000) / 100, 100)
      : 0;

  const formattedStorage = useMemo(() => {
    if (storageTotalBytes !== null) {
      return t('storageUsageWithLimit', {
        defaultValue: '{{used}} of {{total}} used ({{count}} files)',
        used: formatFileSize(storageUsage.used),
        total: formatFileSize(storageTotalBytes),
        count: storageUsage.fileCount,
      });
    }
    return t('storageUsage', {
      defaultValue: 'Storage used: {{used}} ({{count}} files)',
      used: formatFileSize(storageUsage.used),
      count: storageUsage.fileCount,
    });
  }, [storageTotalBytes, storageUsage, t]);

  const getFileTypeIcon = (type?: string) => {
    if (!type) return IconsMap['search'];
    return IconsMap[type] || IconsMap['search'];
  };

  const fetchFiles = async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      const response = await projectFilesApiService.list(projectId, {
        page: paginationConfig.pageIndex,
        size: paginationConfig.pageSize,
        sort: sorter.field,
        order: sorter.order,
        search: searchValue.trim() || undefined,
      });

      if (response.done && response.body) {
        setFiles(response.body.files || []);
        setPaginationConfig(prev => ({ ...prev, total: response.body.total || 0 }));
        setStorageUsage({
          used: Number(response.body.storage_used) || 0,
          fileCount: Number(response.body.file_count) || 0,
        });
      }
    } catch (error) {
      logger.error('Error fetching project files', error);
      message.error(t('loadError', { defaultValue: 'Unable to load files. Please try again.' }));
    } finally {
      setLoading(false);
    }
  };

  const fetchTaskAttachments = async () => {
    if (!projectId) return;
    setTaskAttachmentsLoading(true);
    try {
      const response = await taskAttachmentsApiService.getProjectAttachments(
        projectId,
        taskAttachmentsPagination.pageIndex,
        taskAttachmentsPagination.pageSize
      );
      if (response.done && response.body) {
        setTaskAttachments(response.body.data || []);
        setTaskAttachmentsPagination(prev => ({ ...prev, total: response.body.total || 0 }));
      }
    } catch (error) {
      logger.error('Error fetching task attachments', error);
      message.error(t('loadError', { defaultValue: 'Unable to load files. Please try again.' }));
    } finally {
      setTaskAttachmentsLoading(false);
    }
  };

  const deleteTaskAttachment = async (attachmentId?: string) => {
    if (!attachmentId) return;
    try {
      setDeletingTaskAttachmentId(attachmentId);
      const response = await taskAttachmentsApiService.deleteTaskAttachment(attachmentId);
      if (response.done) {
        setTaskAttachmentsPagination(prev => ({ ...prev, pageIndex: 1 }));
        void fetchTaskAttachments();
      }
    } catch (error) {
      logger.error('Error deleting task attachment', error);
    } finally {
      setDeletingTaskAttachmentId(null);
    }
  };

  const downloadTaskAttachment = async (attachment: ITaskAttachmentViewModel) => {
    if (!attachment.id || !attachment.name) return;
    try {
      const response = await taskAttachmentsApiService.downloadTaskAttachment(
        attachment.id,
        attachment.name
      );
      if (response.done && response.body?.url) {
        const link = document.createElement('a');
        link.href = response.body.url;
        link.download = attachment.name;
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
    } catch (error) {
      logger.error('Error downloading task attachment', error);
      message.error(t('downloadFailed', { defaultValue: 'Unable to download file.' }));
    }
  };

  const openProjectFilePreview = async (file: ProjectFile) => {
    if (!projectId || !file.id) return;
    setPreviewName(file.name);
    setPreviewUrl(null);
    setPreviewUrlLoading(true);
    setPreviewOpen(true);
    try {
      const response = await projectFilesApiService.download(projectId, file.id, file.name);
      if (response.done && response.body?.url) {
        setPreviewUrl(response.body.url);
        setPreviewDownloadFn(() => () => void downloadFile(file));
      }
    } catch (error) {
      logger.error('Error loading preview', error);
      message.error(t('downloadFailed', { defaultValue: 'Unable to download file.' }));
      setPreviewOpen(false);
    } finally {
      setPreviewUrlLoading(false);
    }
  };

  const openTaskAttachmentPreview = (attachment: ITaskAttachmentViewModel) => {
    setPreviewName(attachment.name || null);
    setPreviewUrl(attachment.url || null);
    setPreviewDownloadFn(() => () => void downloadTaskAttachment(attachment));
    setPreviewOpen(true);
  };

  const closePreview = () => {
    setPreviewOpen(false);
    setPreviewUrl(null);
    setPreviewName(null);
    setPreviewDownloadFn(null);
  };

  useEffect(() => {
    trackMixpanelEvent(evt_project_files_visit);
    dispatch(fetchStorageInfo());
  }, [trackMixpanelEvent]);

  useEffect(() => {
    void fetchFiles();
  }, [
    projectId,
    paginationConfig.pageIndex,
    paginationConfig.pageSize,
    sorter.field,
    sorter.order,
    searchValue,
    refreshTimestamp,
  ]);

  useEffect(() => {
    if (activeTab === 'task') {
      void fetchTaskAttachments();
    }
  }, [
    activeTab,
    projectId,
    taskAttachmentsPagination.pageIndex,
    taskAttachmentsPagination.pageSize,
  ]);

  const isBlockedExtension = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    return BLOCKED_EXTENSIONS.includes(ext);
  };

  const resetUploader = () => {
    setPendingFiles([]);
  };

  const openUploader = () => {
    setIsUploaderOpen(true);
    resetUploader();
  };

  const closeUploader = () => {
    setIsUploaderOpen(false);
    resetUploader();
  };

  const beforeUpload: UploadProps['beforeUpload'] = file => {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';

    if (isBlockedExtension(file.name)) {
      message.error(
        t('blockedFileType', {
          defaultValue: 'Files with .{{ext}} extensions are not allowed.',
          ext,
        })
      );
      return Upload.LIST_IGNORE;
    }

    if (file.size > maxFileSizeBytes) {
      if (!hasBusinessAccess) {
        // Show the upgrade popover with the actual file size
        const fileSizeMb = Math.round(file.size / MB);
        setOversizedFileSizeMb(fileSizeMb);
        if (isAppSumoUser) {
          trackAppSumoEvent(AppSumoUpsellEvents.OVERSIZED_FILE_BLOCKED, { feature: 'project_files', file_size_mb: fileSizeMb });
        }
      } else {
        message.error(
          t('fileTooLarge', {
            defaultValue: '{{file}} exceeds the {{maxSize}} MB limit.',
            file: file.name,
            maxSize: maxFileSizeMb,
          })
        );
      }
      return Upload.LIST_IGNORE;
    }

    const alreadyAdded = pendingFiles.some(
      pending => pending.name === file.name && pending.size === file.size
    );

    if (!alreadyAdded) {
      setPendingFiles(prev => [
        ...prev,
        {
          uid: file.uid,
          name: file.name,
          size: file.size,
          status: 'ready',
          percent: 0,
          originFileObj: file,
        },
      ]);
    }

    return false;
  };

  const handleRemoveFile = (file: PendingUploadFile) => {
    setPendingFiles(prev => prev.filter(item => item.uid !== file.uid));
    return true;
  };

  const updatePendingFile = (
    uid: string,
    updater: (file: PendingUploadFile) => PendingUploadFile
  ) => {
    setPendingFiles(prev => prev.map(file => (file.uid === uid ? updater(file) : file)));
  };

  const uploadAttachments = async () => {
    if (!projectId) return;

    if (!pendingFiles.length) {
      message.warning(t('noFilesSelected', { defaultValue: 'Add at least one file.' }));
      return;
    }

    try {
      setUploading(true);

      let hasError = false;

      for (const file of pendingFiles) {
        const rawFile = file.originFileObj as File;

        updatePendingFile(file.uid, current => ({
          ...current,
          status: 'uploading',
          percent: 0,
          errorMessage: undefined,
        }));

        try {
          const response = await projectFilesApiService.upload(projectId, rawFile, percent => {
            updatePendingFile(file.uid, current => ({ ...current, status: 'uploading', percent }));
          });

          if (!response.done) {
            throw new Error('Upload failed');
          }

          trackMixpanelEvent(evt_file_uploaded, { file_type: getFileType(rawFile.name) });

          updatePendingFile(file.uid, current => ({
            ...current,
            status: 'done',
            percent: 100,
          }));
        } catch (error: unknown) {
          hasError = true;
          const serverMessage = (error as any)?.response?.data?.message as string | undefined;
          const tooLarge = serverMessage?.toLowerCase().includes('max file size') || false;
          const errorMessage = tooLarge
            ? t('fileTooLargeLabel', { defaultValue: 'File too large' })
            : serverMessage || t('uploadFailedShort', { defaultValue: 'Upload failed' });

          updatePendingFile(file.uid, current => ({
            ...current,
            status: 'error',
            percent: undefined,
            errorMessage,
          }));
        }
      }

      if (!hasError) {
        message.success(t('uploadSuccess', { defaultValue: 'Files uploaded successfully.' }));
        closeUploader();
        setPaginationConfig(prev => ({ ...prev, pageIndex: 1 }));
        void fetchFiles();
      } else {
        message.error(t('uploadFailed', { defaultValue: 'Upload failed. Please try again.' }));
      }
    } catch (error) {
      logger.error('Error uploading files', error);
      message.error(t('uploadFailed', { defaultValue: 'Upload failed. Please try again.' }));
    } finally {
      setUploading(false);
    }
  };

  const handleSearch = (value: string) => {
    setPaginationConfig(prev => ({ ...prev, pageIndex: 1 }));
    setSearchValue(value.trim());
  };

  const downloadFile = async (file: ProjectFile) => {
    if (!projectId || !file.id) return;

    try {
      setDownloadingId(file.id);
      const response = await projectFilesApiService.download(projectId, file.id, file.name);

      if (response.done && response.body?.url) {
        const link = document.createElement('a');
        link.href = response.body.url;
        link.download = file.name;
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
    } catch (error) {
      logger.error('Error downloading file', error);
      message.error(t('downloadFailed', { defaultValue: 'Unable to download file.' }));
    } finally {
      setDownloadingId(null);
    }
  };

  const deleteFile = async (fileId?: string) => {
    if (!projectId || !fileId) return;

    try {
      setDeletingId(fileId);
      const response = await projectFilesApiService.delete(projectId, fileId);

      if (response.done) {
        message.success(t('deleteSuccess', { defaultValue: 'File deleted successfully.' }));
        // Reset to first page after deletion for better UX
        setPaginationConfig(prev => ({ ...prev, pageIndex: 1 }));
        void fetchFiles();
      }
    } catch (error) {
      logger.error('Error deleting file', error);
      message.error(t('deleteFailed', { defaultValue: 'Unable to delete file.' }));
    } finally {
      setDeletingId(null);
    }
  };

  const handleTableChange: TableProps<ProjectFile>['onChange'] = (
    pagination,
    _filters,
    sorterParam
  ) => {
    setPaginationConfig(prev => ({
      ...prev,
      pageIndex: pagination.current || 1,
      pageSize: pagination.pageSize || DEFAULT_PAGE_SIZE,
    }));

    if (!Array.isArray(sorterParam)) {
      const sortField = (sorterParam.field as ProjectFilesSortField) || 'created_at';
      const sortOrder: ProjectFilesSortOrder =
        sorterParam.order === 'ascend'
          ? 'asc'
          : sorterParam.order === 'descend'
            ? 'desc'
            : sorter.order;
      setSorter({ field: sortField, order: sortOrder });
    }
  };

  const columns: TableProps<ProjectFile>['columns'] = [
    {
      key: 'name',
      title: t('nameColumn', { defaultValue: 'Name' }),
      dataIndex: 'name',
      sorter: true,
      render: (_: string, record) => (
        <Flex
          align="center"
          gap={6}
          style={{ cursor: 'pointer' }}
          onClick={() => void openProjectFilePreview(record)}
        >
          <img
            src={`/file-types/${getFileTypeIcon(record.type)}`}
            alt={t('fileIconAlt')}
            style={{ width: '100%', maxWidth: 24 }}
          />
          <Typography.Link>{record.name}</Typography.Link>
        </Flex>
      ),
    },
    {
      key: 'size',
      title: t('sizeColumn', { defaultValue: 'Size' }),
      dataIndex: 'size',
      sorter: true,
      width: 120,
      render: (size: number) => <Typography.Text>{formatFileSize(size)}</Typography.Text>,
    },
    {
      key: 'uploaded_by',
      title: t('uploadedByColumn', { defaultValue: 'Uploaded By' }),
      dataIndex: 'uploaded_by',
      sorter: true,
      width: 180,
      render: (uploadedBy: string | undefined) => (
        <Typography.Text>
          {uploadedBy || t('unknownUploader', { defaultValue: 'Unknown' })}
        </Typography.Text>
      ),
    },
    {
      key: 'created_at',
      title: t('uploadedAtColumn', { defaultValue: 'Date' }),
      dataIndex: 'created_at',
      sorter: true,
      width: 140,
      render: (date: string) => (
        <Tooltip title={date}>
          <Typography.Text>{durationDateFormat(date)}</Typography.Text>
        </Tooltip>
      ),
    },
    {
      key: 'actions',
      title: t('actionsColumn', { defaultValue: 'Actions' }),
      width: 120,
      render: (_: unknown, record: ProjectFile) => (
        <Flex gap={8} align="center" style={{ padding: 0 }}>
          <Tooltip title={t('downloadTooltip', { defaultValue: 'Download' })}>
            <Button
              size="small"
              icon={<CloudDownloadOutlined />}
              loading={downloadingId === record.id}
              onClick={event => {
                event.stopPropagation();
                void downloadFile(record);
              }}
            />
          </Tooltip>

          <Popconfirm
            title={t('deleteConfirmationTitle', { defaultValue: 'Are you sure?' })}
            okText={t('deleteConfirmationOk', { defaultValue: 'Yes' })}
            cancelText={t('deleteConfirmationCancel', { defaultValue: 'Cancel' })}
            icon={<DeleteOutlined style={{ color: colors.vibrantOrange }} />}
            onConfirm={event => {
              event?.stopPropagation();
              void deleteFile(record.id);
            }}
          >
            <Tooltip title={t('deleteTooltip', { defaultValue: 'Delete' })}>
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                loading={deletingId === record.id}
                onClick={event => event.stopPropagation()}
              />
            </Tooltip>
          </Popconfirm>
        </Flex>
      ),
    },
  ];

  const taskAttachmentColumns: TableProps<ITaskAttachmentViewModel>['columns'] = [
    {
      key: 'name',
      title: t('nameColumn', { defaultValue: 'Name' }),
      dataIndex: 'name',
      render: (_: string, record) => (
        <Flex
          align="center"
          gap={6}
          style={{ cursor: 'pointer' }}
          onClick={() => openTaskAttachmentPreview(record)}
        >
          <img
            src={`/file-types/${getFileTypeIcon(record.type)}`}
            alt={t('fileIconAlt')}
            style={{ width: '100%', maxWidth: 24 }}
          />
          <Typography.Link>{record.name}</Typography.Link>
        </Flex>
      ),
    },
    {
      key: 'task',
      title: t('taskColumn', { defaultValue: 'Task' }),
      width: 220,
      render: (_: unknown, record) => (
        <Typography.Text>
          {record.task_key && record.task_name
            ? `${record.task_key} - ${record.task_name}`
            : record.task_name || '--'}
        </Typography.Text>
      ),
    },
    {
      key: 'size',
      title: t('sizeColumn', { defaultValue: 'Size' }),
      dataIndex: 'size',
      width: 120,
      render: (size: string) => <Typography.Text>{size || '--'}</Typography.Text>,
    },
    {
      key: 'uploader_name',
      title: t('uploadedByColumn', { defaultValue: 'Uploaded By' }),
      dataIndex: 'uploader_name',
      width: 180,
      render: (name: string | undefined) => (
        <Typography.Text>
          {name || t('unknownUploader', { defaultValue: 'Unknown' })}
        </Typography.Text>
      ),
    },
    {
      key: 'created_at',
      title: t('uploadedAtColumn', { defaultValue: 'Date' }),
      dataIndex: 'created_at',
      width: 140,
      render: (date: string) => (
        <Tooltip title={date}>
          <Typography.Text>{durationDateFormat(date)}</Typography.Text>
        </Tooltip>
      ),
    },
    {
      key: 'actions',
      title: t('actionsColumn', { defaultValue: 'Actions' }),
      width: 120,
      render: (_: unknown, record: ITaskAttachmentViewModel) => (
        <Flex gap={8} align="center">
          <Tooltip title={t('downloadTooltip', { defaultValue: 'Download' })}>
            <Button
              size="small"
              icon={<CloudDownloadOutlined />}
              onClick={event => {
                event.stopPropagation();
                void downloadTaskAttachment(record);
              }}
            />
          </Tooltip>
          <Popconfirm
            title={t('deleteConfirmationTitle', { defaultValue: 'Are you sure?' })}
            okText={t('deleteConfirmationOk', { defaultValue: 'Yes' })}
            cancelText={t('deleteConfirmationCancel', { defaultValue: 'Cancel' })}
            icon={<DeleteOutlined style={{ color: colors.vibrantOrange }} />}
            onConfirm={event => {
              event?.stopPropagation();
              void deleteTaskAttachment(record.id);
            }}
          >
            <Tooltip title={t('deleteTooltip', { defaultValue: 'Delete' })}>
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                loading={deletingTaskAttachmentId === record.id}
                onClick={event => event.stopPropagation()}
              />
            </Tooltip>
          </Popconfirm>
        </Flex>
      ),
    },
  ];

  return (
    <Card
      style={{ width: '100%' }}
      title={
        <Flex justify="space-between" align="center">
          <Segmented
            options={[
              {
                label: t('projectFilesTab', { defaultValue: 'Project Files' }),
                value: 'project',
              },
              {
                label: t('taskAttachmentsTab', { defaultValue: 'Task Attachments' }),
                value: 'task',
              },
            ]}
            value={activeTab}
            onChange={v => setActiveTab(v as 'project' | 'task')}
          />

          {activeTab === 'project' && (
            <Space size={8}>
              <Input
                allowClear
                placeholder={t('searchPlaceholder', { defaultValue: 'Search files...' })}
                style={{ width: 280 }}
                onChange={e => handleSearch(e.target.value)}
                value={searchValue}
                suffix={<SearchOutlined style={{ color: 'rgba(0,0,0,.45)' }} />}
                onPressEnter={e => handleSearch((e.target as HTMLInputElement).value)}
              />
              <Button
                type="primary"
                icon={<ImportOutlined />}
                onClick={openUploader}
                disabled={!projectId}
              >
                {t('uploadButton', { defaultValue: 'Upload' })}
              </Button>
            </Space>
          )}
        </Flex>
      }
    >
      {activeTab === 'project' ? (
        <>
          <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
            {formattedStorage}
          </Typography.Text>
          {storageTotalBytes !== null && (
            <Progress
              percent={Math.min(storagePercent, 100)}
              size="small"
              style={{ marginBottom: 12 }}
              status={storagePercent >= 90 ? 'exception' : 'normal'}
              showInfo={false}
            />
          )}
          {!hasBusinessAccess && (
            <Popover
              trigger="click"
              open={isStorageUpgradePopoverOpen}
              onOpenChange={open => {
                setIsStorageUpgradePopoverOpen(open);
                if (isAppSumoUser) {
                  trackAppSumoEvent(
                    open ? AppSumoUpsellEvents.UPGRADE_PROMPT_SHOWN : AppSumoUpsellEvents.UPGRADE_PROMPT_DISMISSED,
                    { feature: 'storage' }
                  );
                }
              }}
              title={t('storageLimitTitle', { defaultValue: 'Storage Limit' })}
              content={
                <Flex vertical gap={12} style={{ maxWidth: 280 }}>
                  <Typography.Text>
                    {t('storageLimitBody', {
                      defaultValue:
                        'You are using {{used}} of your {{total}} storage limit. Upgrade to get more storage for your team files.',
                      used: formatFileSize(storageUsage.used),
                      total: formatFileSize(storageTotalBytes ?? STARTER_STORAGE_LIMIT_BYTES),
                    })}
                  </Typography.Text>
                  <Button
                    type="primary"
                    onClick={() => {
                      setIsStorageUpgradePopoverOpen(false);
                      if (isAppSumoUser) {
                        trackAppSumoEvent(AppSumoUpsellEvents.STORAGE_ADD_MORE_CLICKED, { feature: 'storage' });
                        trackAppSumoEvent(AppSumoUpsellEvents.UPGRADE_NOW_CLICKED, { feature: 'storage' });
                      }
                      promptUpgrade();
                    }}
                  >
                    {t('upgradeNow', { defaultValue: 'Upgrade Now' })}
                  </Button>
                </Flex>
              }
            >
              <Button size="small" type="default" style={{ marginBottom: 16 }}>
                {t('addMoreStorage', { defaultValue: 'Add More Storage' })}
              </Button>
            </Popover>
          )}

          <Table<ProjectFile>
            dataSource={files}
            columns={columns}
            rowKey={record => record.id}
            loading={loading}
            locale={{ emptyText: t('emptyText', { defaultValue: 'There are no files yet.' }) }}
            pagination={{
              total: paginationConfig.total,
              current: paginationConfig.pageIndex,
              pageSize: paginationConfig.pageSize,
              showSizeChanger: true,
              onChange: (page, pageSize) =>
                setPaginationConfig(prev => ({ ...prev, pageIndex: page, pageSize })),
            }}
            onChange={handleTableChange}
          />
        </>
      ) : (
        <Table<ITaskAttachmentViewModel>
          dataSource={taskAttachments}
          columns={taskAttachmentColumns}
          rowKey={record => record.id || ''}
          loading={taskAttachmentsLoading}
          locale={{
            emptyText: t('taskAttachmentsEmptyText', {
              defaultValue: 'No task attachments found.',
            }),
          }}
          pagination={{
            total: taskAttachmentsPagination.total,
            current: taskAttachmentsPagination.pageIndex,
            pageSize: taskAttachmentsPagination.pageSize,
            showSizeChanger: true,
            onChange: (page, pageSize) =>
              setTaskAttachmentsPagination(prev => ({ ...prev, pageIndex: page, pageSize })),
          }}
        />
      )}

      <FilePreviewModal
        open={previewOpen}
        name={previewName || undefined}
        url={previewUrl || undefined}
        isLoading={previewUrlLoading}
        onClose={closePreview}
        onDownload={previewDownloadFn || undefined}
      />

      <Modal
        open={isUploaderOpen}
        onCancel={closeUploader}
        title={t('uploaderTitle', { defaultValue: 'Upload Files' })}
        okText={t('uploadActionCta', { defaultValue: 'Upload' })}
        cancelText={t('cancelActionCta', { defaultValue: 'Cancel' })}
        onOk={uploadAttachments}
        confirmLoading={uploading}
        width={700}
        destroyOnClose
      >
        <Typography.Paragraph style={{ marginBottom: 16 }}>
          {t('uploadDescription', {
            defaultValue: 'Drag & Drop files or click to browse. Max {{maxSize}} MB per file.',
            maxSize: maxFileSizeMb,
          })}
        </Typography.Paragraph>

        <Popover
          open={oversizedFileSizeMb !== null}
          onOpenChange={visible => {
            if (!visible) setOversizedFileSizeMb(null);
          }}
          title={t('fileTooLargePopoverTitle', { defaultValue: 'File Too Large' })}
          content={
            <Flex vertical gap={12} style={{ maxWidth: 300 }}>
              <Typography.Text>
                {t('fileTooLargePopoverBody', {
                  defaultValue:
                    'Files larger than 25MB require the Business plan. This file is {{sizeMb}} MB. Upgrade to upload larger files.',
                  sizeMb: oversizedFileSizeMb,
                })}
              </Typography.Text>
              <Button
                type="primary"
                onClick={() => {
                  setOversizedFileSizeMb(null);
                  promptUpgrade('fileSizeLimit');
                }}
              >
                {t('upgradeNow', { defaultValue: 'Upgrade Now' })}
              </Button>
            </Flex>
          }
          trigger="click"
        >
        <Upload.Dragger
          multiple
          beforeUpload={beforeUpload}
          onRemove={handleRemoveFile}
          fileList={pendingFiles}
          disabled={uploading}
          showUploadList
          itemRender={(originNode, file, _fileList, actions) => {
            const typedFile = file as PendingUploadFile;

            const renderStatus = () => {
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
                    <Typography.Text>
                      {t('uploadedLabel', { defaultValue: 'Uploaded' })}
                    </Typography.Text>
                  </Flex>
                );
              }

              if (typedFile.status === 'error') {
                return (
                  <Flex align="center" gap={6}>
                    <CloseCircleTwoTone twoToneColor={colors.vibrantOrange} />
                    <Typography.Text type="danger">
                      {typedFile.errorMessage ||
                        t('uploadFailedShort', { defaultValue: 'Upload failed' })}
                    </Typography.Text>
                  </Flex>
                );
              }

              return null;
            };

            return (
              <Flex
                justify="space-between"
                align="center"
                style={{ width: '100%', padding: '4px 8px' }}
              >
                <Space size={8} align="center">
                  <Typography.Text>{typedFile.name}</Typography.Text>
                  <Typography.Text type="secondary">
                    {formatFileSize(typedFile.size)}
                  </Typography.Text>
                </Space>

                <Space size={12} align="center">
                  {renderStatus()}
                  {!uploading && (
                    <Button
                      type="text"
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={event => {
                        event.stopPropagation();
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
            {t('filePickerHint', {
              defaultValue: 'Drag & Drop files or click to browse',
            })}
          </p>
          <p className="ant-upload-hint">
            {t('uploadHintLimit', {
              defaultValue: 'PDF, images, documents, archives. Max {{maxSize}} MB per file.',
              maxSize: maxFileSizeMb,
            })}
          </p>
        </Upload.Dragger>
        </Popover>
      </Modal>
    </Card>
  );
};

export default ProjectViewFiles;
