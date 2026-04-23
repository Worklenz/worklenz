import { useTranslation } from 'react-i18next';
import {
  Button,
  Card,
  Tag,
  CheckCircleOutlined,
  SettingOutlined,
  GlobalOutlined,
} from '@/shared/antd-imports';
import { SlackIcon } from '../IntegrationIcons';
import type { ISlackChannelConfig } from '@api/slack/slack.api.service';

interface SlackConnectedCardProps {
  workspace: {
    id: string;
    name: string;
    team_id: string;
    is_active: boolean;
  } | null;
  channels: ISlackChannelConfig[];
  availableChannels: { id: string; channel_name: string }[];
  onManage: () => void;
  onDisconnect: () => void;
}

export function SlackConnectedCard({
  workspace,
  channels,
  availableChannels,
  onManage,
  onDisconnect,
}: SlackConnectedCardProps) {
  const { t } = useTranslation('settings/slack-integration');
  const activeChannels = channels.filter(channel => channel.isActive);

  return (
    <Card
      className="min-h-[320px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-200"
      styles={{ body: { padding: '24px' } }}
    >
      <div className="h-full flex flex-col">
        {/* Header Section */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="text-4xl flex-shrink-0">
              <SlackIcon />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 m-0 mb-1 truncate">
                {workspace?.name || t('defaultWorkspaceName', { defaultValue: 'Slack Workspace' })}
              </h3>
              <div className="flex items-center gap-2 flex-wrap">
                <Tag
                  color="success"
                  className="m-0"
                  style={{ fontSize: '11px', padding: '1px 6px' }}
                >
                  <CheckCircleOutlined style={{ fontSize: '11px' }} className="mr-1" />
                  {t('status.connected', { defaultValue: 'Connected' })}
                </Tag>
                <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {workspace?.team_id}
                </span>
              </div>
            </div>
          </div>
          <Button
            danger
            type="text"
            size="small"
            onClick={onDisconnect}
            className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex-shrink-0"
          >
            {t('disconnect.okText', { defaultValue: 'Disconnect' })}
          </Button>
        </div>

        {/* Quick Stats - Compact */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-md p-2 border border-blue-200 dark:border-blue-800 text-center min-h-[60px] flex flex-col justify-center">
            <div className="text-lg font-bold text-blue-600 dark:text-blue-400 leading-none">
              {channels.length}
            </div>
            <div className="text-xs text-blue-800 dark:text-blue-300 mt-1">
              {t('stats.total', { defaultValue: 'Total' })}
            </div>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 rounded-md p-2 border border-green-200 dark:border-green-800 text-center min-h-[60px] flex flex-col justify-center">
            <div className="text-lg font-bold text-green-600 dark:text-green-400 leading-none">
              {activeChannels.length}
            </div>
            <div className="text-xs text-green-800 dark:text-green-300 mt-1">
              {t('stats.active', { defaultValue: 'Active' })}
            </div>
          </div>
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-md p-2 border border-purple-200 dark:border-purple-800 text-center min-h-[60px] flex flex-col justify-center">
            <div className="text-lg font-bold text-purple-600 dark:text-purple-400 leading-none">
              {availableChannels.length}
            </div>
            <div className="text-xs text-purple-800 dark:text-purple-300 mt-1">
              {t('stats.available', { defaultValue: 'Available' })}
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="flex-1 flex items-start">
          <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed m-0">
            {t('connectedDescription', {
              defaultValue:
                "Your team's Slack workspace is connected. Configure which channels receive notifications for each project.",
            })}
          </p>
        </div>

        {/* Action Buttons - Always at bottom */}
        <div className="mt-4 pt-4 space-y-2">
          <Button
            type="primary"
            icon={<SettingOutlined />}
            onClick={onManage}
            size="large"
            className="w-full h-12 text-sm font-medium"
          >
            {t('manageConfigurations', { defaultValue: 'Manage' })}
          </Button>
        </div>
      </div>
    </Card>
  );
}
