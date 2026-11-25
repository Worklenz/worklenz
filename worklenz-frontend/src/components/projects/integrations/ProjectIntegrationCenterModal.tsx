import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Spin } from '@/shared/antd-imports';

const IntegrationCenter = lazy(() => import('@/pages/settings/integrations/IntegrationsSettings'));

interface ProjectIntegrationCenterModalProps {
  open: boolean;
  projectId: string;
  projectName?: string;
  onClose: () => void;
}

export function ProjectIntegrationCenterModal({
  open,
  projectId,
  projectName,
  onClose,
}: ProjectIntegrationCenterModalProps) {
  const { t } = useTranslation('project-integrations');
  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={1200}
      style={{ maxWidth: 'calc(100vw - 32px)', top: 16 }}
      styles={{ body: { maxHeight: 'calc(100dvh - 120px)', overflowY: 'auto' } }}
      title={projectName
        ? t('center.projectTitle', { defaultValue: 'Integrations · {{project}}', project: projectName })
        : t('center.title', { defaultValue: 'Integration Center' })}
      destroyOnHidden
    >
      <Suspense fallback={<Spin />}>
        <IntegrationCenter projectId={projectId} projectName={projectName} onClose={onClose} hideTitle />
      </Suspense>
    </Modal>
  );
}
