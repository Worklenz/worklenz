import { useTranslation } from 'react-i18next';
import { Flex, Typography } from '@/shared/antd-imports';
import ManageStatusContent from '@/components/task-management/ManageStatusContent';

interface StatusesSettingsSectionProps {
  projectId?: string | null;
}

const StatusesSettingsSection = ({ projectId }: StatusesSettingsSectionProps) => {
  const { t } = useTranslation('project-drawer');

  return (
    <Flex vertical gap={16}>
      <div>
        <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 4 }}>
          {t('statusesSectionTitle', { defaultValue: 'Task Statuses' })}
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 0 }}>
          {t('statusesSectionDescription', {
            defaultValue: 'Statuses tasks in this project can move through.',
          })}
        </Typography.Paragraph>
      </div>

      <ManageStatusContent projectId={projectId || undefined} />
    </Flex>
  );
};

export default StatusesSettingsSection;
