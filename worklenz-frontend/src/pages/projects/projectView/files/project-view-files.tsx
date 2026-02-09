import {
  Button,
  Card,
  Flex,
  Form,
  Modal,
  Popconfirm,
  Select,
  Space,
  Segmented,
  Table,
  TableProps,
  Tooltip,
  Typography,
  Upload,
  UploadProps,
  message,
} from '@/shared/antd-imports';
import { useEffect, useState } from 'react';
import { colors } from '@/styles/colors';
import {
  AppstoreOutlined,
  BarsOutlined,
  CloudDownloadOutlined,
  DeleteOutlined,
  ExclamationCircleFilled,
  ExclamationCircleOutlined,
  PaperClipOutlined,
} from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { durationDateFormat } from '@utils/durationDateFormat';
import { DEFAULT_PAGE_SIZE, IconsMap } from '@/shared/constants';
import {
  IProjectAttachmentsViewModel,
  ITaskAttachmentViewModel,
  ITaskAttachment,
} from '@/types/tasks/task-attachment-view-model';
import { useAppSelector } from '@/hooks/useAppSelector';
import { attachmentsApiService } from '@/api/attachments/attachments.api.service';
import taskAttachmentsApiService from '@/api/tasks/task-attachments.api.service';
import { tasksApiService } from '@/api/tasks/tasks.api.service';
import logger from '@/utils/errorLogger';
import { evt_file_uploaded, evt_project_files_visit } from '@/shared/worklenz-analytics-events';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { getBase64 } from '@/utils/file-utils';
import type { UploadFile } from 'antd/es/upload/interface';
import { getFileType } from '@/types/mixpanel-events.types';

const MAX_FILE_SIZE_BYTES = 52_430_000; // ~50 MB
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
  'hta',
  'cpl',
  'msc',
  'vb',
  'wsf',
  'wsh',
  'scf',
  'lnk',
  'inf',
];

const ProjectViewFiles = () => {
  const { t } = useTranslation('project-view-files');
  const { trackMixpanelEvent } = useMixpanelTracking();
  const { projectId, refreshTimestamp } = useAppSelector(state => state.projectReducer);
  const [attachments, setAttachments] = useState<IProjectAttachmentsViewModel>({});
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isUploaderOpen, setIsUploaderOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<UploadFile[]>([]);
  const [taskOptions, setTaskOptions] = useState<{ label: string; value: string }[]>([]);
  const [taskSearchLoading, setTaskSearchLoading] = useState(false);
  const [form] = Form.useForm();

  const [paginationConfig, setPaginationConfig] = useState({
    total: 0,
    pageIndex: 1,
    showSizeChanger: true,
    defaultPageSize: DEFAULT_PAGE_SIZE,
  });

  const fetchAttachments = async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      const response = await attachmentsApiService.getProjectAttachments(
        projectId,
        paginationConfig.pageIndex,
        paginationConfig.defaultPageSize
      );
      if (response.done) {
        setAttachments(response.body || {});
        setPaginationConfig(prev => ({ ...prev, total: response.body?.total || 0 }));
      }
    } catch (error) {
      logger.error('Error fetching project attachments', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttachments();
  }, [refreshTimestamp]);

  const getFileTypeIcon = (type: string | undefined) => {
    if (!type) return IconsMap['search'];
    return IconsMap[type as string] || IconsMap['search'];
  };

  const downloadAttachment = async (id: string | undefined, filename: string | undefined) => {
    if (!id || !filename) return;
    try {
      setDownloading(true);

      const response = await attachmentsApiService.downloadAttachment(id, filename);

      if (response.done) {
        const link = document.createElement('a');
        link.href = response.body || '';
        link.download = filename;
        link.click();
        link.remove();
      }
    } catch (error) {
      logger.error('Error downloading attachment', error);
    } finally {
      setDownloading(false);
    }
  };

  const deleteAttachment = async (id: string | undefined) => {
    if (!id) return;
    try {
      const response = await attachmentsApiService.deleteAttachment(id);
      if (response.done) {
        fetchAttachments();
      }
    } catch (error) {
      logger.error('Error deleting attachment', error);
    }
  };

  const openAttachment = (url: string | undefined) => {
    if (!url) return;

    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.style.display = 'none';
    a.click();
  };

  useEffect(() => {
    trackMixpanelEvent(evt_project_files_visit);
    fetchAttachments();
  }, [paginationConfig.pageIndex, projectId]);

  const resetUploader = () => {
    setPendingFiles([]);
    form.resetFields();
  };

  const openUploader = () => {
    setIsUploaderOpen(true);
    void handleTaskSearch('');
  };

  const closeUploader = () => {
    setIsUploaderOpen(false);
    resetUploader();
  };

  const handleTaskSearch = async (searchQuery: string) => {
    if (!projectId) return;
    const term = searchQuery?.trim() ?? '';

    try {
      setTaskSearchLoading(true);
      const res = await tasksApiService.searchTask(undefined, projectId, term);
      if (res.done) {
        setTaskOptions(res.body || []);
      }
    } catch (error) {
      logger.error('Error searching tasks for attachments', error);
      message.error(
        t('taskSearchError', { defaultValue: 'Unable to search tasks. Please try again.' })
      );
    } finally {
      setTaskSearchLoading(false);
    }
  };

  const isBlockedExtension = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    return BLOCKED_EXTENSIONS.includes(ext);
  };

  const beforeUpload: UploadProps['beforeUpload'] = file => {
    if (isBlockedExtension(file.name)) {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      message.error(
        t('blockedFileType', {
          defaultValue: 'Files with .{{ext}} extensions are not allowed.',
          ext,
        })
      );
      return Upload.LIST_IGNORE;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      message.error(
        t('fileTooLarge', {
          defaultValue: '{{file}} exceeds the 50 MB limit.',
          file: file.name,
        })
      );
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
          status: 'done',
          originFileObj: file,
        },
      ]);
    }

    return false; // prevent auto-upload
  };

  const handleRemoveFile = (file: UploadFile) => {
    setPendingFiles(prev => prev.filter(item => item.uid !== file.uid));
    return true;
  };

  const uploadAttachments = async () => {
    if (!projectId) return;
    const values = await form.validateFields();

    if (!pendingFiles.length) {
      message.warning(t('noFilesSelected', { defaultValue: 'Add at least one file.' }));
      return;
    }

    try {
      setUploading(true);
      await Promise.all(
        pendingFiles.map(async file => {
          const rawFile = file.originFileObj as File;
          const base64 = await getBase64(rawFile);
          const body: ITaskAttachment = {
            file: base64 as string,
            file_name: rawFile.name,
            task_id: values.taskId,
            project_id: projectId,
            size: rawFile.size,
          };

          const response = await taskAttachmentsApiService.createTaskAttachment(body);

          if (!response.done) {
            throw new Error('Upload failed');
          }

          trackMixpanelEvent(evt_file_uploaded, { file_type: getFileType(rawFile.name) });
        })
      );

      message.success(t('uploadSuccess', { defaultValue: 'Files uploaded successfully.' }));
      closeUploader();
      setPaginationConfig(prev => ({ ...prev, pageIndex: 1 }));
      fetchAttachments();
    } catch (error) {
      logger.error('Error uploading attachments', error);
      message.error(t('uploadFailed', { defaultValue: 'Upload failed. Please try again.' }));
    } finally {
      setUploading(false);
    }
  };

  const columns: TableProps<ITaskAttachmentViewModel>['columns'] = [
    {
      key: 'fileName',
      title: t('nameColumn'),
      render: (record: ITaskAttachmentViewModel) => (
        <Flex
          gap={4}
          align="center"
          style={{ cursor: 'pointer' }}
          onClick={() => openAttachment(record.url)}
        >
          <img
            src={`/file-types/${getFileTypeIcon(record.type)}`}
            alt={t('fileIconAlt')}
            style={{ width: '100%', maxWidth: 25 }}
          />
          <Typography.Text>
            [{record.task_key}] {record.name}
          </Typography.Text>
        </Flex>
      ),
    },
    {
      key: 'attachedTask',
      title: t('attachedTaskColumn'),
      render: (record: ITaskAttachmentViewModel) => (
        <Typography.Text style={{ cursor: 'pointer' }} onClick={() => openAttachment(record.url)}>
          {record.task_name}
        </Typography.Text>
      ),
    },
    {
      key: 'size',
      title: t('sizeColumn'),
      render: (record: ITaskAttachmentViewModel) => (
        <Typography.Text style={{ cursor: 'pointer' }} onClick={() => openAttachment(record.url)}>
          {record.size}
        </Typography.Text>
      ),
    },
    {
      key: 'uploadedBy',
      title: t('uploadedByColumn'),
      render: (record: ITaskAttachmentViewModel) => (
        <Typography.Text style={{ cursor: 'pointer' }} onClick={() => openAttachment(record.url)}>
          {record.uploader_name}
        </Typography.Text>
      ),
    },
    {
      key: 'uploadedAt',
      title: t('uploadedAtColumn'),
      render: (record: ITaskAttachmentViewModel) => (
        <Typography.Text style={{ cursor: 'pointer' }} onClick={() => openAttachment(record.url)}>
          <Tooltip title={record.created_at}>{durationDateFormat(record.created_at)}</Tooltip>
        </Typography.Text>
      ),
    },
    {
      key: 'actionBtns',
      width: 80,
      render: (record: ITaskAttachmentViewModel) => (
        <Flex gap={8} style={{ padding: 0 }}>
          <Popconfirm
            title={t('deleteConfirmationTitle')}
            icon={<ExclamationCircleFilled style={{ color: colors.vibrantOrange }} />}
            okText={t('deleteConfirmationOk')}
            cancelText={t('deleteConfirmationCancel')}
            onConfirm={() => deleteAttachment(record.id)}
          >
            <Tooltip title={t('deleteTooltip', { defaultValue: 'Delete' })}>
              <Button shape="default" icon={<DeleteOutlined />} size="small" />
            </Tooltip>
          </Popconfirm>

          <Tooltip title={t('downloadTooltip', { defaultValue: 'Download' })}>
            <Button
              size="small"
              icon={<CloudDownloadOutlined />}
              onClick={() => downloadAttachment(record.id, record.name)}
              loading={downloading}
            />
          </Tooltip>
        </Flex>
      ),
    },
  ];

  return (
    <Card
      style={{ width: '100%' }}
      title={
        <Flex justify="space-between">
          <Typography.Text
            style={{
              display: 'flex',
              gap: 4,
              alignItems: 'center',
              color: colors.lightGray,
              fontSize: 13,
              lineHeight: 1,
            }}
          >
            <ExclamationCircleOutlined />
            {t('titleDescriptionText')}
          </Typography.Text>

          <Space size={8}>
            <Tooltip title={t('segmentedTooltip')}>
              <Segmented
                options={[
                  { value: 'listView', icon: <BarsOutlined /> },
                  { value: 'thumbnailView', icon: <AppstoreOutlined /> },
                ]}
                defaultValue={'listView'}
                disabled={true}
              />
            </Tooltip>

            <Button
              type="primary"
              icon={<PaperClipOutlined />}
              onClick={openUploader}
              disabled={!projectId}
            >
              {t('uploadButton', { defaultValue: 'Upload files' })}
            </Button>
          </Space>
        </Flex>
      }
    >
      <Table<ITaskAttachmentViewModel>
        className="custom-two-colors-row-table"
        dataSource={attachments.data}
        locale={{ emptyText: t('emptyText') }}
        columns={columns}
        rowKey={record => record.id || ''}
        loading={loading}
        pagination={{
          showSizeChanger: paginationConfig.showSizeChanger,
          defaultPageSize: paginationConfig.defaultPageSize,
          total: paginationConfig.total,
          current: paginationConfig.pageIndex,
          onChange: (page, pageSize) =>
            setPaginationConfig(prev => ({
              ...prev,
              pageIndex: page,
              defaultPageSize: pageSize,
            })),
        }}
      />

      <Modal
        open={isUploaderOpen}
        onCancel={closeUploader}
        title={t('uploaderTitle', { defaultValue: 'Attach files to a task' })}
        okText={t('uploadActionCta', { defaultValue: 'Upload' })}
        cancelText={t('cancelActionCta', { defaultValue: 'Cancel' })}
        onOk={uploadAttachments}
        confirmLoading={uploading}
        destroyOnClose
      >
        <Form layout="vertical" form={form} initialValues={{ taskId: undefined }}>
          <Form.Item
            name="taskId"
            label={t('taskSelectLabel', { defaultValue: 'Attach to task' })}
            rules={[
              {
                required: true,
                message: t('taskRequired', { defaultValue: 'Please select a task.' }),
              },
            ]}
          >
            <Select
              showSearch
              placeholder={t('taskSelectPlaceholder', {
                defaultValue: 'Search by task name or key',
              })}
              onSearch={handleTaskSearch}
              onFocus={() => handleTaskSearch('')}
              options={taskOptions}
              loading={taskSearchLoading}
              filterOption={false}
              notFoundContent={
                taskSearchLoading
                  ? t('searchingTasks', { defaultValue: 'Searching tasks...' })
                  : t('taskSearchEmpty', { defaultValue: 'No matching tasks' })
              }
            />
          </Form.Item>

          <Form.Item
            label={t('filePickerLabel', { defaultValue: 'Files' })}
            required
            extra={t('uploadHintLimit', {
              defaultValue: 'Up to 50 MB per file. Executable file types are blocked for security.',
            })}
          >
            <Upload.Dragger
              multiple
              beforeUpload={beforeUpload}
              onRemove={handleRemoveFile}
              fileList={pendingFiles}
              disabled={uploading}
            >
              <p className="ant-upload-drag-icon">
                <PaperClipOutlined />
              </p>
              <p className="ant-upload-text">
                {t('filePickerHint', {
                  defaultValue: 'Drag and drop files here or click to browse.',
                })}
              </p>
              <p className="ant-upload-hint">
                {t('uploadHintLimit', {
                  defaultValue:
                    'Up to 50 MB per file. Executable file types are blocked for security.',
                })}
              </p>
            </Upload.Dragger>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default ProjectViewFiles;
