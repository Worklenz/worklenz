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
  onToggle: (channelId: string, isActive: boolean) => void;
  onEdit: (channel: ISlackChannelConfig) => void;
  onDelete: (channelId: string) => void;
}

export function SlackManageModal({
  open,
  channels,
  loading,
  onClose,
  onAddNew,
  onToggle,
  onEdit,
  onDelete,
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
      {/* Info Banner */}
      {channels.length === 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
          <p className="text-sm text-blue-800 dark:text-blue-200 m-0">
            💡 Get started by adding a channel configuration to receive notifications from your
            projects.
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
        onToggle={onToggle}
        onEdit={onEdit}
        onDelete={onDelete}
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
