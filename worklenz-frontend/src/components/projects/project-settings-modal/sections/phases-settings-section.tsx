import { useTranslation } from 'react-i18next';
import { Flex, Typography } from '@/shared/antd-imports';
import ManagePhaseContent from '@/components/task-management/ManagePhaseContent';

interface PhasesSettingsSectionProps {
  projectId?: string | null;
}

const PhasesSettingsSection = ({ projectId }: PhasesSettingsSectionProps) => {
  const { t } = useTranslation('project-drawer');

  return (
    <Flex vertical gap={16}>
      <div>
        <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 4 }}>
          {t('phasesSectionTitle', { defaultValue: 'Phases' })}
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 0 }}>
          {t('phasesSectionDescription', {
            defaultValue: 'Pipeline phases used to group and progress tasks in this project.',
          })}
        </Typography.Paragraph>
      </div>

      {projectId && <ManagePhaseContent projectId={projectId} />}
    </Flex>
  );
};

export default PhasesSettingsSection;
