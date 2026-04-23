import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { message } from '@/shared/antd-imports';
import { IntegrationItem } from './IntegrationItem';
import { SlackProjectQuickAddModal } from './SlackProjectQuickAddModal';
import { SlackIcon } from '@/components/settings/integrations/IntegrationIcons';
import type { SlackIntegrationStatus } from './integrations.types';

interface SlackProjectIntegrationProps {
  projectId: string;
  projectName?: string;
  status: SlackIntegrationStatus | null;
  onClose: () => void;
  onRefresh?: () => void;
}

export const SlackProjectIntegration: React.FC<SlackProjectIntegrationProps> = ({
  projectId,
  projectName,
  status,
  onClose,
  onRefresh,
}) => {
  const { t } = useTranslation('project-integrations');
  const [modalOpen, setModalOpen] = useState(false);

  const handleClick = () => {
    if (!status?.workspaceConnected) {
      message.warning(
        t('slack.notConnected', {
          defaultValue: 'Please connect your Slack workspace in Settings first',
        })
      );
      return;
    }
    // Close the parent dropdown when opening the modal
    onClose();
    setModalOpen(true);
  };

  const handleSuccess = () => {
    onRefresh?.();
  };

  return (
    <>
      <IntegrationItem
        icon={<SlackIcon />}
        title={t('slack.title', { defaultValue: 'Slack' })}
        description={t('slack.description', {
          defaultValue: 'Send notifications to Slack channels',
        })}
        badge={status?.channelCount}
        channels={status?.channels?.map(ch => `#${ch.name}`)}
        onClick={handleClick}
      />

      <SlackProjectQuickAddModal
        open={modalOpen}
        projectId={projectId}
        projectName={projectName}
        onClose={() => setModalOpen(false)}
        onSuccess={handleSuccess}
      />
    </>
  );
};
