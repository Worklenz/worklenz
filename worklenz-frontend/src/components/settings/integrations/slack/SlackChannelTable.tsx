import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Switch, Table, Tag, DeleteOutlined, EditOutlined } from '@/shared/antd-imports';
import type { TableColumnsType } from '@/shared/antd-imports';
import type { ISlackChannelConfig } from '@api/slack/slack.api.service';

interface SlackChannelTableProps {
  channels: ISlackChannelConfig[];
  loading: boolean;
  onToggle: (channelId: string, isActive: boolean) => void;
  onEdit: (channel: ISlackChannelConfig) => void;
  onDelete: (channelId: string) => void;
}

export function SlackChannelTable({
  channels,
  loading,
  onToggle,
  onEdit,
  onDelete,
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
        title: t('table.active'),
        dataIndex: 'isActive',
        key: 'isActive',
        render: (isActive: boolean, record: ISlackChannelConfig) => (
          <Switch
            checked={isActive}
            onChange={checked => onToggle(record.id, checked)}
            aria-label={t('table.toggleStatus', { channel: record.slackChannelName })}
          />
        ),
      },
      {
        title: t('table.actions'),
        key: 'actions',
        render: (_: unknown, record: ISlackChannelConfig) => (
          <div className="flex gap-2">
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
          </div>
        ),
      },
    ],
    [t, onToggle, onEdit, onDelete]
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
