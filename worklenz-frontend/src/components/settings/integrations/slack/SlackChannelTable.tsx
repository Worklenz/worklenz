import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Table,
  Tag,
  DeleteOutlined,
  EditOutlined,
  ReloadOutlined,
} from '@/shared/antd-imports';
import type { TableColumnsType } from '@/shared/antd-imports';
import type { ISlackChannelConfig } from '@api/slack/slack.api.service';

interface SlackChannelTableProps {
  channels: ISlackChannelConfig[];
  loading: boolean;
  onEdit: (channel: ISlackChannelConfig) => void;
  onDelete: (channelId: string) => void;
  onReactivate: (channelId: string) => void;
}

export function SlackChannelTable({
  channels,
  loading,
  onEdit,
  onDelete,
  onReactivate,
}: SlackChannelTableProps) {
  const { t } = useTranslation('settings/slack-integration');

  const columns: TableColumnsType<ISlackChannelConfig> = useMemo(
    () => [
      {
        title: t('table.project'),
        dataIndex: 'projectName',
        key: 'projectName',
      },
      {
        title: t('table.slackChannel'),
        dataIndex: 'slackChannelName',
        key: 'slackChannelName',
        render: (text: string) => (
          <Tag color="purple" className="font-medium">
            #{text}
          </Tag>
        ),
      },
      {
        title: t('table.notifications'),
        dataIndex: 'notificationTypes',
        key: 'notificationTypes',
        render: (types: string[] | undefined | null) => (
          <div className="flex flex-wrap gap-1">
            {(types ?? []).map(type => {
              const formattedType = type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
              return (
                <Tag key={type} color="blue" className="m-0">
                  {formattedType}
                </Tag>
              );
            })}
          </div>
        ),
      },
      {
        title: t('table.status'),
        dataIndex: 'isActive',
        key: 'status',
        render: (isActive: boolean) => (
          <Tag color={isActive ? 'green' : 'red'} className="m-0">
            {isActive
              ? t('table.statusActive', { defaultValue: 'Active' })
              : t('table.statusInactive', { defaultValue: 'Inactive' })}
          </Tag>
        ),
      },
      {
        title: t('table.actions'),
        key: 'actions',
        render: (_: unknown, record: ISlackChannelConfig) => (
          <div className="flex gap-2">
            {record.isActive ? (
              <>
                <Button
                  type="text"
                  icon={<EditOutlined />}
                  onClick={() => onEdit(record)}
                  aria-label={t('table.editConfig', { channel: record.slackChannelName })}
                />
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => onDelete(record.id)}
                  aria-label={t('table.deleteConfig', { channel: record.slackChannelName })}
                />
              </>
            ) : (
              <Button
                type="link"
                icon={<ReloadOutlined />}
                onClick={() => onReactivate(record.id)}
                aria-label={t('table.reactivateConfig', { channel: record.slackChannelName })}
              >
                {t('table.reactivate', { defaultValue: 'Reactivate' })}
              </Button>
            )}
          </div>
        ),
      },
    ],
    [t, onEdit, onDelete, onReactivate]
  );

  return (
    <Table
      columns={columns}
      dataSource={channels}
      rowKey="id"
      loading={loading}
      aria-label={t('table.channelConfigs')}
      pagination={channels.length > 10 ? { pageSize: 10 } : false}
    />
  );
}
