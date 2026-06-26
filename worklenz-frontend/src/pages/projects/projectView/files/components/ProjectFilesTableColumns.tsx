import { Button, Flex, Popconfirm, Tooltip, Typography } from '@/shared/antd-imports';
import { CloudDownloadOutlined, DeleteOutlined } from '@ant-design/icons';
import type { TFunction } from 'i18next';
import { colors } from '@/styles/colors';
import { durationDateFormat } from '@utils/durationDateFormat';
import type { TableProps } from 'antd';
import type { ProjectFile } from '@/types/projects/project-files.types';
import { formatFileSize, getFileTypeIcon } from '../utils';

interface ProjectFilesTableColumnsProps {
  t: TFunction;
  downloadingId: string | null;
  deletingId: string | null;
  onPreview: (file: ProjectFile) => void;
  onDownload: (file: ProjectFile) => void;
  onDelete: (fileId?: string) => void;
}

export const getProjectFilesTableColumns = ({
  t,
  downloadingId,
  deletingId,
  onPreview,
  onDownload,
  onDelete,
}: ProjectFilesTableColumnsProps): TableProps<ProjectFile>['columns'] => {
  return [
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
          onClick={() => onPreview(record)}
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
                onDownload(record);
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
              onDelete(record.id);
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
};
