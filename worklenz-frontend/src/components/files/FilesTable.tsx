import React, { useMemo } from 'react';
import {
  Table,
  TableProps,
  Badge,
  Tooltip,
  Typography,
  Button,
  Popconfirm,
  Flex,
  theme,
  CloudDownloadOutlined,
  DeleteOutlined,
  EditOutlined,
  LinkOutlined,
  ArrowRightOutlined,
} from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { durationDateFormat } from '@utils/durationDateFormat';
import { colors } from '@/styles/colors';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, IconsMap } from '@/shared/constants';
import CustomTableTitle from '@/components/CustomTableTitle';
import type {
  ITeamProjectFileRow,
  ITeamTaskAttachmentRow,
  ITeamProjectLinkRow,
} from '@/api/files/team-files.api.service';
import './files-table.css';

const MB = 1024 * 1024;

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

const getFileTypeIcon = (type?: string) => {
  if (!type) return IconsMap['search'];
  return IconsMap[type] || IconsMap['search'];
};

export type FilesTableMode = 'project' | 'task' | 'links';

interface FilesTableProps {
  mode: FilesTableMode;
  projectFiles: ITeamProjectFileRow[];
  taskAttachments: ITeamTaskAttachmentRow[];
  links: ITeamProjectLinkRow[];
  loading: boolean;
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number, pageSize: number) => void;
  onPreviewFile: (row: ITeamProjectFileRow) => void;
  onPreviewAttachment: (row: ITeamTaskAttachmentRow) => void;
  onDownloadFile: (row: ITeamProjectFileRow) => void;
  onDeleteFile: (row: ITeamProjectFileRow) => void;
  onDownloadAttachment: (row: ITeamTaskAttachmentRow) => void;
  onDeleteAttachment: (row: ITeamTaskAttachmentRow) => void;
  onOpenLink: (row: ITeamProjectLinkRow) => void;
  onEditLink: (row: ITeamProjectLinkRow) => void;
  onDeleteLink: (row: ITeamProjectLinkRow) => void;
  downloadingId: string | null;
  deletingId: string | null;
}

export const FilesTable: React.FC<FilesTableProps> = ({
  mode,
  projectFiles,
  taskAttachments,
  links,
  loading,
  total,
  page,
  pageSize,
  onPageChange,
  onPreviewFile,
  onPreviewAttachment,
  onDownloadFile,
  onDeleteFile,
  onDownloadAttachment,
  onDeleteAttachment,
  onOpenLink,
  onEditLink,
  onDeleteLink,
  downloadingId,
  deletingId,
}) => {
  const { t } = useTranslation('team-files');
  const { token } = theme.useToken();
  const navigate = useNavigate();

  const goToProject = (projectId?: string) => {
    if (projectId) navigate(`/worklenz/projects/${projectId}?tab=all-attachments`);
  };

  const projectColumn = useMemo(
    () => ({
      key: 'project',
      title: <CustomTableTitle title={t('colProject', { defaultValue: 'Project' })} />,
      width: 180,
      render: (_: unknown, record: { project_id: string; project_name: string; project_color: string }) => (
        <span
          style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
          onClick={() => goToProject(record.project_id)}
        >
          <Badge color={record.project_color || token.colorPrimary} />
          <Typography.Text ellipsis={{ tooltip: record.project_name }} style={{ maxWidth: 150 }}>
            {record.project_name}
          </Typography.Text>
        </span>
      ),
    }),
    [t, token, navigate]
  );

  const fileColumns: TableProps<ITeamProjectFileRow>['columns'] = useMemo(
    () => [
      {
        key: 'name',
        title: <CustomTableTitle title={t('colName', { defaultValue: 'Name' })} />,
        width: 240,
        fixed: 'left' as const,
        render: (_: unknown, record) => (
          <Flex align="center" gap={6} style={{ cursor: 'pointer' }} onClick={() => onPreviewFile(record)}>
            <img
              src={`/file-types/${getFileTypeIcon(record.type)}`}
              alt=""
              style={{ width: '100%', maxWidth: 22 }}
            />
            <Typography.Text ellipsis={{ tooltip: record.name }} style={{ maxWidth: 200 }}>
              {record.name}
            </Typography.Text>
          </Flex>
        ),
      },
      projectColumn as any,
      {
        key: 'size',
        title: <CustomTableTitle title={t('colSize', { defaultValue: 'Size' })} />,
        width: 100,
        render: (_: unknown, record) => <Typography.Text>{formatFileSize(record.size)}</Typography.Text>,
      },
      {
        key: 'uploaded_by',
        title: <CustomTableTitle title={t('colUploadedBy', { defaultValue: 'Uploaded By' })} />,
        width: 160,
        render: (_: unknown, record) => (
          <Typography.Text>{record.uploaded_by || t('unknownUploader', { defaultValue: 'Unknown' })}</Typography.Text>
        ),
      },
      {
        key: 'created_at',
        title: <CustomTableTitle title={t('colWhen', { defaultValue: 'When' })} />,
        width: 120,
        render: (_: unknown, record) => (
          <Tooltip title={record.created_at}>
            <Typography.Text>{durationDateFormat(record.created_at)}</Typography.Text>
          </Tooltip>
        ),
      },
      {
        key: 'actions',
        title: <CustomTableTitle title={t('colActions', { defaultValue: 'Actions' })} />,
        width: 100,
        render: (_: unknown, record) => (
          <Flex gap={8} align="center">
            <Tooltip title={t('downloadTooltip', { defaultValue: 'Download' })}>
              <Button
                size="small"
                icon={<CloudDownloadOutlined />}
                loading={downloadingId === record.id}
                onClick={e => {
                  e.stopPropagation();
                  onDownloadFile(record);
                }}
              />
            </Tooltip>
            <Popconfirm
              title={t('deleteConfirmationTitle', { defaultValue: 'Are you sure?' })}
              okText={t('deleteConfirmationOk', { defaultValue: 'Yes' })}
              cancelText={t('deleteConfirmationCancel', { defaultValue: 'Cancel' })}
              icon={<DeleteOutlined style={{ color: colors.vibrantOrange }} />}
              onConfirm={e => {
                e?.stopPropagation();
                onDeleteFile(record);
              }}
            >
              <Tooltip title={t('deleteTooltip', { defaultValue: 'Delete' })}>
                <Button
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  loading={deletingId === record.id}
                  onClick={e => e.stopPropagation()}
                />
              </Tooltip>
            </Popconfirm>
          </Flex>
        ),
      },
    ],
    [t, projectColumn, onPreviewFile, onDownloadFile, onDeleteFile, downloadingId, deletingId]
  );

  const attachmentColumns: TableProps<ITeamTaskAttachmentRow>['columns'] = useMemo(
    () => [
      {
        key: 'name',
        title: <CustomTableTitle title={t('colName', { defaultValue: 'Name' })} />,
        width: 240,
        fixed: 'left' as const,
        render: (_: unknown, record) => (
          <Flex align="center" gap={6} style={{ cursor: 'pointer' }} onClick={() => onPreviewAttachment(record)}>
            <img
              src={`/file-types/${getFileTypeIcon(record.type)}`}
              alt=""
              style={{ width: '100%', maxWidth: 22 }}
            />
            <Typography.Text ellipsis={{ tooltip: record.name }} style={{ maxWidth: 200 }}>
              {record.name}
            </Typography.Text>
          </Flex>
        ),
      },
      projectColumn as any,
      {
        key: 'task',
        title: <CustomTableTitle title={t('colTask', { defaultValue: 'Task' })} />,
        width: 200,
        render: (_: unknown, record) => (
          <Typography.Text ellipsis={{ tooltip: record.task_name }} style={{ maxWidth: 180 }}>
            {record.task_key && record.task_name ? `${record.task_key} - ${record.task_name}` : record.task_name || t('noTaskName', { defaultValue: '--' })}
          </Typography.Text>
        ),
      },
      {
        key: 'size',
        title: <CustomTableTitle title={t('colSize', { defaultValue: 'Size' })} />,
        width: 100,
        render: (_: unknown, record) => <Typography.Text>{formatFileSize(record.size)}</Typography.Text>,
      },
      {
        key: 'uploaded_by',
        title: <CustomTableTitle title={t('colUploadedBy', { defaultValue: 'Uploaded By' })} />,
        width: 160,
        render: (_: unknown, record) => (
          <Typography.Text>{record.uploaded_by || t('unknownUploader', { defaultValue: 'Unknown' })}</Typography.Text>
        ),
      },
      {
        key: 'created_at',
        title: <CustomTableTitle title={t('colWhen', { defaultValue: 'When' })} />,
        width: 120,
        render: (_: unknown, record) => (
          <Tooltip title={record.created_at}>
            <Typography.Text>{durationDateFormat(record.created_at)}</Typography.Text>
          </Tooltip>
        ),
      },
      {
        key: 'actions',
        title: <CustomTableTitle title={t('colActions', { defaultValue: 'Actions' })} />,
        width: 100,
        render: (_: unknown, record) => (
          <Flex gap={8} align="center">
            <Tooltip title={t('downloadTooltip', { defaultValue: 'Download' })}>
              <Button
                size="small"
                icon={<CloudDownloadOutlined />}
                loading={downloadingId === record.id}
                onClick={e => {
                  e.stopPropagation();
                  onDownloadAttachment(record);
                }}
              />
            </Tooltip>
            <Popconfirm
              title={t('deleteConfirmationTitle', { defaultValue: 'Are you sure?' })}
              okText={t('deleteConfirmationOk', { defaultValue: 'Yes' })}
              cancelText={t('deleteConfirmationCancel', { defaultValue: 'Cancel' })}
              icon={<DeleteOutlined style={{ color: colors.vibrantOrange }} />}
              onConfirm={e => {
                e?.stopPropagation();
                onDeleteAttachment(record);
              }}
            >
              <Tooltip title={t('deleteTooltip', { defaultValue: 'Delete' })}>
                <Button
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  loading={deletingId === record.id}
                  onClick={e => e.stopPropagation()}
                />
              </Tooltip>
            </Popconfirm>
          </Flex>
        ),
      },
    ],
    [t, projectColumn, onPreviewAttachment, onDownloadAttachment, onDeleteAttachment, downloadingId, deletingId]
  );

  const linkColumns: TableProps<ITeamProjectLinkRow>['columns'] = useMemo(
    () => [
      {
        key: 'title',
        title: <CustomTableTitle title={t('colName', { defaultValue: 'Name' })} />,
        width: 240,
        fixed: 'left' as const,
        render: (_: unknown, record) => (
          <Flex align="center" gap={6} style={{ cursor: 'pointer' }} onClick={() => onOpenLink(record)}>
            <LinkOutlined style={{ color: colors.lightGray }} />
            <Typography.Text ellipsis={{ tooltip: record.title }} style={{ maxWidth: 210 }}>
              {record.title}
            </Typography.Text>
          </Flex>
        ),
      },
      projectColumn as any,
      {
        key: 'uploaded_by',
        title: <CustomTableTitle title={t('colUploadedBy', { defaultValue: 'Uploaded By' })} />,
        width: 160,
        render: (_: unknown, record) => (
          <Typography.Text>{record.added_by_name || t('unknownUploader', { defaultValue: 'Unknown' })}</Typography.Text>
        ),
      },
      {
        key: 'created_at',
        title: <CustomTableTitle title={t('colWhen', { defaultValue: 'When' })} />,
        width: 120,
        render: (_: unknown, record) => (
          <Tooltip title={record.created_at}>
            <Typography.Text>{durationDateFormat(record.created_at)}</Typography.Text>
          </Tooltip>
        ),
      },
      {
        key: 'actions',
        title: <CustomTableTitle title={t('colActions', { defaultValue: 'Actions' })} />,
        width: 100,
        render: (_: unknown, record) => {
          if (record.source_type !== 'manual') {
            return (
              <Tooltip title={t('openTask', { defaultValue: 'Open task' })}>
                <Button
                  size="small"
                  icon={<ArrowRightOutlined />}
                  onClick={e => {
                    e.stopPropagation();
                    onOpenLink(record);
                  }}
                />
              </Tooltip>
            );
          }
          return (
            <Flex gap={8} align="center">
              <Tooltip title={t('editLink', { defaultValue: 'Edit link' })}>
                <Button
                  size="small"
                  icon={<EditOutlined />}
                  onClick={e => {
                    e.stopPropagation();
                    onEditLink(record);
                  }}
                />
              </Tooltip>
              <Popconfirm
                title={t('deleteConfirmationTitle', { defaultValue: 'Are you sure?' })}
                okText={t('deleteConfirmationOk', { defaultValue: 'Yes' })}
                cancelText={t('deleteConfirmationCancel', { defaultValue: 'Cancel' })}
                icon={<DeleteOutlined style={{ color: colors.vibrantOrange }} />}
                onConfirm={e => {
                  e?.stopPropagation();
                  onDeleteLink(record);
                }}
              >
                <Tooltip title={t('deleteLink', { defaultValue: 'Delete link' })}>
                  <Button
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    loading={deletingId === record.id}
                    onClick={e => e.stopPropagation()}
                  />
                </Tooltip>
              </Popconfirm>
            </Flex>
          );
        },
      },
    ],
    [t, projectColumn, onOpenLink, onEditLink, onDeleteLink, deletingId]
  );

  const emptyText = (
    <div style={{ padding: '32px 16px', textAlign: 'center' }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
        {t('emptyTitle', { defaultValue: 'No files yet' })}
      </div>
      <p style={{ opacity: 0.6, fontSize: 12, margin: 0 }}>
        {t('emptySubtitle', { defaultValue: 'Files uploaded across your projects will appear here.' })}
      </p>
    </div>
  );

  const pagination = {
    current: page,
    pageSize,
    total,
    showSizeChanger: true,
    defaultPageSize: DEFAULT_PAGE_SIZE,
    pageSizeOptions: PAGE_SIZE_OPTIONS,
    size: 'small' as const,
    onChange: onPageChange,
  };

  return (
    <div
      className="files-table"
      style={{
        borderRadius: token.borderRadiusLG,
        border: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorBgContainer,
      }}
    >
      {mode === 'project' && (
        <Table<ITeamProjectFileRow>
          dataSource={projectFiles}
          rowKey={record => record.id}
          columns={fileColumns}
          size="middle"
          loading={loading}
          sticky
          scroll={{ x: 'max-content', y: 'calc(100vh - 280px)' }}
          pagination={pagination}
          locale={{ emptyText }}
        />
      )}
      {mode === 'task' && (
        <Table<ITeamTaskAttachmentRow>
          dataSource={taskAttachments}
          rowKey={record => record.id}
          columns={attachmentColumns}
          size="middle"
          loading={loading}
          sticky
          scroll={{ x: 'max-content', y: 'calc(100vh - 280px)' }}
          pagination={pagination}
          locale={{ emptyText }}
        />
      )}
      {mode === 'links' && (
        <Table<ITeamProjectLinkRow>
          dataSource={links}
          rowKey={record => record.id}
          columns={linkColumns}
          size="middle"
          loading={loading}
          sticky
          scroll={{ x: 'max-content', y: 'calc(100vh - 280px)' }}
          pagination={pagination}
          locale={{ emptyText }}
        />
      )}
    </div>
  );
};
