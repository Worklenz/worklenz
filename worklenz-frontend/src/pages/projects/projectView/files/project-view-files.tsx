import {
  Card,
  Flex,
  Input,
  Segmented,
  Space,
  Table,
  Typography,
  Button,
} from '@/shared/antd-imports';
import { FilePreviewModal } from '@/components/common/FilePreviewModal';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { evt_project_files_visit } from '@/shared/worklenz-analytics-events';
import { ImportOutlined, SearchOutlined } from '@ant-design/icons';
import { useAppSelector } from '@/hooks/useAppSelector';
import type { TabType } from './types';
import { useProjectFiles } from './hooks/useProjectFiles';
import { useTaskAttachments } from './hooks/useTaskAttachments';
import { useFileOperations } from './hooks/useFileOperations';
import { useFileUpload } from './hooks/useFileUpload';
import { getProjectFilesTableColumns } from './components/ProjectFilesTableColumns';
import { getTaskAttachmentsTableColumns } from './components/TaskAttachmentsTableColumns';
import { FileUploadModal } from './components/FileUploadModal';
import { formatFileSize } from './utils';

const ProjectViewFiles = () => {
  const { t } = useTranslation('project-view-files');
  const { trackMixpanelEvent } = useMixpanelTracking();
  const { projectId } = useAppSelector(state => state.projectReducer);

  const [activeTab, setActiveTab] = useState<TabType>('project');

  // Custom hooks
  const {
    files,
    loading,
    storageUsage,
    paginationConfig,
    searchValue,
    handleSearch,
    handleTableChange,
    fetchFiles,
    setPaginationConfig,
  } = useProjectFiles();

  const {
    taskAttachments,
    taskAttachmentsLoading,
    taskAttachmentsPagination,
    setTaskAttachmentsPagination,
    fetchTaskAttachments,
  } = useTaskAttachments();

  const {
    operations,
    preview,
    downloadFile,
    deleteFile,
    downloadTaskAttachment,
    deleteTaskAttachment,
    openProjectFilePreview,
    openTaskAttachmentPreview,
    closePreview,
  } = useFileOperations();

  const {
    uploading,
    isUploaderOpen,
    pendingFiles,
    beforeUpload,
    handleRemoveFile,
    uploadAttachments,
    openUploader,
    closeUploader,
  } = useFileUpload(() => {
    setPaginationConfig(prev => ({ ...prev, pageIndex: 1 }));
    void fetchFiles();
  });

  // Memoized values
  const formattedStorage = useMemo(
    () =>
      t('storageUsage', {
        defaultValue: 'Total Storage: {{used}} ({{count}} files)',
        used: formatFileSize(storageUsage.used),
        count: storageUsage.fileCount,
      }),
    [storageUsage, t]
  );

  const projectFilesColumns = useMemo(
    () =>
      getProjectFilesTableColumns({
        t: t as TFunction,
        downloadingId: operations.downloadingId,
        deletingId: operations.deletingId,
        onPreview: openProjectFilePreview,
        onDownload: file => downloadFile(file, () => {
          setPaginationConfig(prev => ({ ...prev, pageIndex: 1 }));
          void fetchFiles();
        }),
        onDelete: fileId => deleteFile(fileId, () => {
          setPaginationConfig(prev => ({ ...prev, pageIndex: 1 }));
          void fetchFiles();
        }),
      }),
    [t, operations.downloadingId, operations.deletingId, openProjectFilePreview, downloadFile, deleteFile, fetchFiles, setPaginationConfig]
  );

  const taskAttachmentsColumns = useMemo(
    () =>
      getTaskAttachmentsTableColumns({
        t: t as TFunction,
        deletingTaskAttachmentId: operations.deletingTaskAttachmentId,
        onPreview: openTaskAttachmentPreview,
        onDownload: downloadTaskAttachment,
        onDelete: attachmentId => deleteTaskAttachment(attachmentId, () => {
          setTaskAttachmentsPagination(prev => ({ ...prev, pageIndex: 1 }));
          void fetchTaskAttachments();
        }),
      }),
    [t, operations.deletingTaskAttachmentId, openTaskAttachmentPreview, downloadTaskAttachment, deleteTaskAttachment, fetchTaskAttachments, setTaskAttachmentsPagination]
  );

  // Effects
  useEffect(() => {
    trackMixpanelEvent(evt_project_files_visit);
  }, [trackMixpanelEvent]);

  return (
    <Card
      style={{ width: '100%' }}
      title={
        <Flex justify="space-between" align="center">
          <Segmented
            options={[
              {
                label: t('projectFilesTab', { defaultValue: 'Project Files' }),
                value: 'project' as TabType,
              },
              {
                label: t('taskAttachmentsTab', { defaultValue: 'Task Attachments' }),
                value: 'task' as TabType,
              },
            ]}
            value={activeTab}
            onChange={v => setActiveTab(v as TabType)}
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
          <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            {formattedStorage}
          </Typography.Text>

          <Table
            dataSource={files}
            columns={projectFilesColumns}
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
        <Table
          dataSource={taskAttachments}
          columns={taskAttachmentsColumns}
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
        open={preview.open}
        name={preview.name || undefined}
        url={preview.url || undefined}
        isLoading={preview.isLoading}
        onClose={closePreview}
        onDownload={preview.downloadFn || undefined}
      />

      <FileUploadModal
        open={isUploaderOpen}
        uploading={uploading}
        pendingFiles={pendingFiles}
        onClose={closeUploader}
        onUpload={uploadAttachments}
        beforeUpload={beforeUpload}
        onRemoveFile={handleRemoveFile}
      />
    </Card>
  );
};

export default ProjectViewFiles;
