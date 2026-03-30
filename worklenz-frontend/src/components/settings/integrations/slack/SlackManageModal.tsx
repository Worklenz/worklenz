import { useTranslation } from 'react-i18next';
import { Button, Modal } from '@/shared/antd-imports';
import { PlusOutlined } from '@/shared/antd-imports';
import { SlackIcon } from '../IntegrationIcons';
import { SlackChannelTable } from './SlackChannelTable';
import type { ISlackChannelConfig } from '@api/slack/slack.api.service';

interface SlackManageModalProps {
  open: boolean;
  channels: ISlackChannelConfig[];
  loading: boolean;
  onClose: () => void;
  onAddNew: () => void;
  onEdit: (channel: ISlackChannelConfig) => void;
  onDelete: (channelId: string) => void;
  onReactivate: (channelId: string) => void;
}

export function SlackManageModal({
  open,
  channels,
  loading,
  onClose,
  onAddNew,
  onEdit,
  onDelete,
  onReactivate,
}: SlackManageModalProps) {
  const { t } = useTranslation('settings/slack-integration');

  return (
    <Modal
      title={
        <div className="flex items-center gap-3">
          <SlackIcon />
          <span>{t('manageTitle', { defaultValue: 'Manage Slack Configurations' })}</span>
        </div>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={900}
    >
      {/* Important Info Banner */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-4">
        <div className="flex items-start gap-3">
          <span className="text-xl">⚠️</span>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200 mb-1">
              {t('instructions.inviteBot.title', {
                defaultValue: "Don't forget to invite the bot!",
              })}
            </h4>
            <p className="text-sm text-amber-800 dark:text-amber-300 mb-2">
              {t('instructions.inviteBot.description', {
                defaultValue:
                  'Before you can receive notifications in a Slack channel, you must invite the Worklenz bot to that channel.',
              })}
            </p>
            <code className="bg-amber-100 dark:bg-amber-900/40 px-2 py-1 rounded text-xs font-mono text-amber-900 dark:text-amber-200">
              /invite @Worklenz
            </code>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-2 mb-0">
              {t('instructions.inviteBot.note', {
                defaultValue: 'This only needs to be done once per channel.',
              })}
            </p>
          </div>
        </div>
      </div>

      {/* First Time Info Banner */}
      {channels.length === 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
          <p className="text-sm text-blue-800 dark:text-blue-200 m-0">
            💡{' '}
            {t('instructions.getStarted', {
              defaultValue:
                'Get started by adding a channel configuration to receive notifications from your projects.',
            })}
          </p>
        </div>
      )}

      <div className="mb-4 flex justify-end">
        <Button type="primary" icon={<PlusOutlined />} onClick={onAddNew}>
          {t('addChannelConfig', { defaultValue: 'Add Channel' })}
        </Button>
      </div>

      {/* Table Section */}
      <SlackChannelTable
        channels={channels}
        loading={loading}
        onEdit={onEdit}
        onDelete={onDelete}
        onReactivate={onReactivate}
      />

      {/* Empty State */}
      {channels.length === 0 && !loading && (
        <div className="py-8 text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">No channel configurations yet</p>
          <Button type="primary" icon={<PlusOutlined />} onClick={onAddNew}>
            Add Your First Channel
          </Button>
        </div>
      )}
    </Modal>
  );
}
