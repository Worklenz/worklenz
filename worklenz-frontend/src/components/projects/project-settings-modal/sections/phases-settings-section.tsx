import { useTranslation } from 'react-i18next';
import { Flex, Typography, Switch, Space, Tooltip, theme, Alert, Form } from '@/shared/antd-imports';
import { InfoCircleOutlined } from '@ant-design/icons';
import ManagePhaseContent from '@/components/task-management/ManagePhaseContent';
import { useAppSelector } from '@/hooks/useAppSelector';

interface PhasesSettingsSectionProps {
  projectId?: string | null;
  disabled?: boolean;
}

const PhasesSettingsSection = ({ projectId, disabled = false }: PhasesSettingsSectionProps) => {
  const { t } = useTranslation('project-drawer');
  const { token } = theme.useToken();

  const { phaseList } = useAppSelector(state => state.phaseReducer);
  const projectHasPhases = phaseList && phaseList.length > 0;

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

      {projectId && <ManagePhaseContent projectId={projectId} disabled={disabled} />}

      <div>
        <Flex justify="space-between" align="center" style={{ marginBottom: 8 }}>
          <Space>
            <Typography.Text>
              {t('autoAssignSubtaskPhase', { defaultValue: 'Auto-assign parent phase to subtasks' })}
            </Typography.Text>
            <Tooltip
              title={t('autoAssignSubtaskPhaseTooltip', {
                defaultValue:
                  "When enabled, new subtasks automatically inherit their parent task's phase. Subtask phases stay synced when the parent's phase changes.",
              })}
            >
              <InfoCircleOutlined style={{ color: token.colorTextSecondary }} />
            </Tooltip>
          </Space>
          <Form.Item name="auto_assign_subtask_phase" valuePropName="checked" noStyle>
            <Switch
              disabled={disabled || !projectHasPhases}
              aria-label={t('autoAssignSubtaskPhase', {
                defaultValue: 'Auto-assign parent phase to subtasks',
              })}
            />
          </Form.Item>
        </Flex>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {t('autoAssignSubtaskPhaseDescription', {
            defaultValue:
              "Subtasks will mirror their parent task's phase at creation and when the parent phase changes.",
          })}
        </Typography.Text>

        {!projectHasPhases && (
          <Alert
            type="info"
            showIcon
            style={{ marginTop: 12 }}
            message={t('noPhasesHint', {
              defaultValue: 'Add phases to this project to use auto-assignment',
            })}
          />
        )}
      </div>
    </Flex>
  );
};

export default PhasesSettingsSection;
