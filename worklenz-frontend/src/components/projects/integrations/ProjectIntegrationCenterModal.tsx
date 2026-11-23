import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Spin } from '@/shared/antd-imports';

const IntegrationCenter = lazy(() => import('@/pages/settings/integrations/IntegrationsSettings'));

interface ProjectIntegrationCenterModalProps {
  open: boolean;
  projectId: string;
  onClose: () => void;
}

export function ProjectIntegrationCenterModal({
  open,
  projectId,
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
      title={t('center.title', { defaultValue: 'Integration Center' })}
      destroyOnHidden
    >
      <p style={{ margin: '0 0 16px' }}>
        {t('center.teamScope', {
          defaultValue:
            'Team integrations. Project-specific options are in the project integrations menu.',
        })}
      </p>
      <Suspense fallback={<Spin />}>
        <IntegrationCenter projectId={projectId} hideTitle />
      </Suspense>
    </Modal>
  );
}
