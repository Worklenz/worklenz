import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DownloadOutlined, HistoryOutlined, LockOutlined, MoreOutlined, UploadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { Alert, Button, Dropdown, Empty, Flex, Select, Table, Typography, message, theme } from '@/shared/antd-imports';
import type { MenuProps } from '@/shared/antd-imports';
import { getPortalErrorMessage } from '@/api/client-portal/portal-api-utils';
import {
  useGetFileDownloadLinkMutation,
  useGetProjectFilesQuery,
  useUpdatePortalFileMutation,
} from '@/api/client-portal/portal-projects-api';
import { StatusTag, VisibilitySwitch, formatPortalDate, useVisibilityToast } from '@/components/client-portal/v2';
import {
  FILE_CATEGORIES,
  type FileCategory,
  type PortalFile,
  type PortalProject,
  type PortalVisibility,
} from '@/types/client-portal/v2';
import { FileVersionsModal } from './FileVersionsModal';
import { UploadFileModal } from './UploadFileModal';
import { PortalLoader } from '@/components/client-portal/v2';

interface FilesTabProps {
  project: PortalProject;
}

/** Project files, Internal Only until shared. Replacing a file adds a version; nothing is overwritten. */
export const FilesTab = ({ project }: FilesTabProps) => {
  const { t, i18n } = useTranslation('client-portal-v2-projects');
  const { token } = theme.useToken();
  const showVisibilityToast = useVisibilityToast();

  const [category, setCategory] = useState<FileCategory | 'all'>('all');
  // `undefined` = closed, `null` = uploading a new file, a file = adding a version to it.
  const [uploading, setUploading] = useState<PortalFile | null | undefined>(undefined);
  const [historyOf, setHistoryOf] = useState<PortalFile | null>(null);

  const query = useGetProjectFilesQuery({
    projectId: project.id,
    params: category === 'all' ? undefined : { category },
  });
  const [updateFile, { isLoading: isUpdating }] = useUpdatePortalFileMutation();
  const [getDownloadLink] = useGetFileDownloadLinkMutation();
  const files = query.data?.body ?? [];

  const changeVisibility = async (file: PortalFile, visibility: PortalVisibility) => {
    try {
      await updateFile({ projectId: project.id, fileId: file.id, body: { visibility } }).unwrap();
      showVisibilityToast('file', file.name, visibility);
    } catch (error) {
      message.error(getPortalErrorMessage(error, t('files.visibilityFailed', { defaultValue: 'The visibility could not be changed.' })));
    }
  };

  const changeCategory = async (file: PortalFile, next: FileCategory) => {
    try {
      await updateFile({ projectId: project.id, fileId: file.id, body: { category: next } }).unwrap();
    } catch (error) {
      message.error(getPortalErrorMessage(error, t('files.categoryFailed', { defaultValue: 'The category could not be changed.' })));
    }
  };

  const download = async (file: PortalFile) => {
    try {
      const result = await getDownloadLink({ fileId: file.id }).unwrap();
      if (result.body?.url) window.open(result.body.url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      message.error(getPortalErrorMessage(error, t('files.downloadFailed', { defaultValue: 'The download link could not be created.' })));
    }
  };

  const menuFor = (file: PortalFile): MenuProps['items'] => [
    {
      key: 'download',
      icon: <DownloadOutlined />,
      label: t('files.menu.download', { defaultValue: 'Download' }),
      onClick: () => void download(file),
    },
    {
      key: 'version',
      icon: <UploadOutlined />,
      label: t('files.menu.newVersion', { defaultValue: 'Upload new version' }),
      onClick: () => setUploading(file),
    },
    {
      key: 'history',
      icon: <HistoryOutlined />,
      label: t('files.menu.history', { defaultValue: 'Version history' }),
      onClick: () => setHistoryOf(file),
    },
  ];

  const columns: ColumnsType<PortalFile> = [
    {
      key: 'file',
      title: t('files.columns.file', { defaultValue: 'File' }),
      render: (_value, file) => (
        <div>
          <Flex align="center" gap={6} wrap="wrap" style={{ fontWeight: 600, fontSize: 13 }}>
            {file.visibility === 'internal' && <LockOutlined aria-hidden style={{ fontSize: 12 }} />}
            {file.name}
            {file.source === 'client' && (
              <StatusTag tone="purple">{t('files.clientUpload', { defaultValue: 'Client upload' })}</StatusTag>
            )}
          </Flex>
          <div style={{ fontSize: 11.5, color: token.colorTextTertiary }}>{file.size_label}</div>
        </div>
      ),
    },
    {
      key: 'category',
      title: t('files.columns.category', { defaultValue: 'Category' }),
      render: (_value, file) => (
        <Select<FileCategory>
          size="small"
          value={file.category}
          style={{ minWidth: 150 }}
          disabled={isUpdating}
          onChange={next => void changeCategory(file, next)}
          aria-label={t('files.categoryLabel', { name: file.name, defaultValue: 'Category of {{name}}' })}
          options={FILE_CATEGORIES.map(item => ({ value: item, label: item }))}
        />
      ),
    },
    {
      key: 'version',
      title: t('files.columns.version', { defaultValue: 'Version' }),
      render: (_value, file) => (
        <span>
          {t('files.versions.number', { version: file.current_version, defaultValue: 'v{{version}}' })}
          {file.version_count > 1 && (
            <Typography.Text type="secondary">
              {' · '}
              {t('files.versionCount', { count: file.version_count, defaultValue: '{{count}} versions' })}
            </Typography.Text>
          )}
        </span>
      ),
    },
    {
      key: 'uploaded',
      title: t('files.columns.uploaded', { defaultValue: 'Uploaded' }),
      render: (_value, file) => (
        <div style={{ fontSize: 12 }}>
          {file.uploaded_by}
          <div style={{ fontSize: 11, color: token.colorTextTertiary }}>
            {formatPortalDate(file.uploaded_at, i18n.language)}
          </div>
        </div>
      ),
    },
    {
      key: 'visible',
      title: t('files.columns.visible', { defaultValue: 'Client visible' }),
      render: (_value, file) => (
        <VisibilitySwitch
          visibility={file.visibility}
          itemLabel={file.name}
          disabled={isUpdating}
          onChange={visibility => void changeVisibility(file, visibility)}
        />
      ),
    },
    {
      key: 'actions',
      align: 'right',
      render: (_value, file) => (
        <Dropdown menu={{ items: menuFor(file) }} trigger={['click']}>
          <Button
            size="small"
            type="text"
            icon={<MoreOutlined />}
            aria-label={t('files.rowActions', { name: file.name, defaultValue: 'Actions for {{name}}' })}
          />
        </Dropdown>
      ),
    },
  ];

  if (query.isLoading) return <PortalLoader />;
  if (query.isError) {
    return (
      <Alert
        type="error"
        showIcon
        message={t('files.loadFailed', { defaultValue: 'The files could not be loaded.' })}
        action={
          <Button size="small" onClick={() => query.refetch()}>
            {t('retry', { defaultValue: 'Retry' })}
          </Button>
        }
      />
    );
  }

  return (
    <div>
      <Flex justify="space-between" align="center" gap={10} wrap="wrap" style={{ marginBottom: 12 }}>
        <Select<FileCategory | 'all'>
          value={category}
          onChange={setCategory}
          style={{ minWidth: 190 }}
          aria-label={t('files.categoryFilter', { defaultValue: 'Filter by category' })}
          options={[
            { value: 'all', label: t('files.allCategories', { defaultValue: 'All categories' }) },
            ...FILE_CATEGORIES.map(item => ({ value: item, label: item })),
          ]}
        />
        <Button type="primary" size="small" icon={<UploadOutlined />} onClick={() => setUploading(null)}>
          {t('files.upload', { defaultValue: 'Upload file' })}
        </Button>
      </Flex>

      <div style={{ border: `1px solid ${token.colorBorderSecondary}`, borderRadius: 8, overflow: 'hidden' }}>
        <Table<PortalFile>
          aria-label={t('files.tableLabel', { defaultValue: 'Files' })}
          size="middle"
          columns={columns}
          dataSource={files}
          rowKey={file => file.id}
          pagination={false}
          scroll={{ x: 'max-content' }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={t('files.empty', { defaultValue: 'No files in this view.' })}
              />
            ),
          }}
        />
      </div>

      <Typography.Paragraph type="secondary" style={{ fontSize: 11.5, marginTop: 10 }}>
        {t('files.footnote', {
          defaultValue:
            'Client-uploaded files are always visible to your team and are logged as client activity. Opening, previewing and downloading a file is logged too. Turning visibility off hides a file from the client without deleting it.',
        })}
      </Typography.Paragraph>

      {uploading !== undefined && (
        <UploadFileModal key={uploading?.id ?? 'new'} project={project} replacing={uploading} onClose={() => setUploading(undefined)} />
      )}
      {historyOf && <FileVersionsModal file={historyOf} onClose={() => setHistoryOf(null)} />}
    </div>
  );
};
