import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IntegrationItem } from './IntegrationItem';
import { TeamsProjectModal } from './TeamsProjectModal';
import { MSTeamsIcon } from '@/components/settings/integrations/IntegrationIcons';
import type { TeamsIntegrationStatus } from './integrations.types';

interface TeamsProjectIntegrationProps {
  projectId: string;
  projectName?: string;
  status: TeamsIntegrationStatus | null;
  /** Closes a parent dropdown before the modal opens. */
  onClose?: () => void;
  onRefresh?: () => void;
}

export const TeamsProjectIntegration: React.FC<TeamsProjectIntegrationProps> = ({
  projectId,
  projectName,
  status,
  onClose,
  onRefresh,
}) => {
  const { t } = useTranslation('project-integrations');
  const [modalOpen, setModalOpen] = useState(false);

  const handleClick = () => {
    onClose?.();
    setModalOpen(true);
  };

  return (
    <>
      <IntegrationItem
        icon={<MSTeamsIcon />}
        title={t('teams.title', { defaultValue: 'Microsoft Teams' })}
        description={t('teams.description', {
          defaultValue: 'Post task and status updates to your Teams channels',
        })}
        badge={status?.channelCount}
        channels={status?.channels}
        onClick={handleClick}
      />

      <TeamsProjectModal
        open={modalOpen}
        projectId={projectId}
        projectName={projectName}
        onClose={() => setModalOpen(false)}
        onChange={onRefresh}
      />
    </>
  );
};
