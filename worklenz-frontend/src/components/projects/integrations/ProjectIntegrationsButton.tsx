import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiOutlined, Button, Tooltip } from '@/shared/antd-imports';
import { ProjectIntegrationCenterModal } from './ProjectIntegrationCenterModal';

interface ProjectIntegrationsButtonProps {
  projectId: string;
  projectName?: string;
}

export const ProjectIntegrationsButton = memo(({ projectId, projectName }: ProjectIntegrationsButtonProps) => {
  const { t } = useTranslation('project-integrations');
  const [isOpen, setIsOpen] = useState(false);
  const label = t('tooltip', { defaultValue: 'Manage project integrations' });

  return <>
    <Tooltip title={label}>
      <Button shape="circle" icon={<ApiOutlined />} aria-label={label} onClick={() => setIsOpen(true)} />
    </Tooltip>
    <ProjectIntegrationCenterModal open={isOpen} projectId={projectId} projectName={projectName} onClose={() => setIsOpen(false)} />
  </>;
});

ProjectIntegrationsButton.displayName = 'ProjectIntegrationsButton';
