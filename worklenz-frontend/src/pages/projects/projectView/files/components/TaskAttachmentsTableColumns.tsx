import { Button, Flex, Popconfirm, Tooltip, Typography } from '@/shared/antd-imports';
import { CloudDownloadOutlined, DeleteOutlined } from '@ant-design/icons';
import type { TFunction } from 'i18next';
import { colors } from '@/styles/colors';
import { durationDateFormat } from '@utils/durationDateFormat';
import type { TableProps } from 'antd';
import type { ITaskAttachmentViewModel } from '@/types/tasks/task-attachment-view-model';
import { getFileTypeIcon } from '../utils';

interface TaskAttachmentsTableColumnsProps {
  t: TFunction;
  deletingTaskAttachmentId: string | null;
  onPreview: (attachment: ITaskAttachmentViewModel) => void;
  onDownload: (attachment: ITaskAttachmentViewModel) => void;
  onDelete: (attachmentId?: string) => void;
}

export const getTaskAttachmentsTableColumns = ({
  t,
  deletingTaskAttachmentId,
  onPreview,
  onDownload,
  onDelete,
}: TaskAttachmentsTableColumnsProps): TableProps<ITaskAttachmentViewModel>['columns'] => {
  return [
    {
      key: 'name',
      title: t('nameColumn', { defaultValue: 'Name' }),
      dataIndex: 'name',
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
                loading={deletingTaskAttachmentId === record.id}
                onClick={event => event.stopPropagation()}
              />
            </Tooltip>
          </Popconfirm>
        </Flex>
      ),
    },
  ];
};
