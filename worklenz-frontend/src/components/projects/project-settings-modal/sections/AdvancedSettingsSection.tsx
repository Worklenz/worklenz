import {
  Alert,
  Button,
  CrownOutlined,
  Flex,
  Form,
  FormInstance,
  InfoCircleOutlined,
  Space,
  Switch,
  Tooltip,
  Typography,
  theme,
} from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';

import SettingsCard from '../components/settings-card';

interface AdvancedSettingsSectionProps {
  form: FormInstance;
  disabled: boolean;
  canRestrictTaskCreation: boolean;
  onUpgradeClick: () => void;
}

/** The three progress methods are mutually exclusive: enabling one switches the others off. */
const PROGRESS_FIELDS = [
  'use_manual_progress',
  'use_weighted_progress',
  'use_time_progress',
] as const;

const AdvancedSettingsSection = ({
  form,
  disabled,
  canRestrictTaskCreation,
  onUpgradeClick,
}: AdvancedSettingsSectionProps) => {
  const { t } = useTranslation('project-drawer');
  const { t: tCommon } = useTranslation('common');
  const { token } = theme.useToken();

  const handleProgressChange = (field: (typeof PROGRESS_FIELDS)[number]) => (checked: boolean) => {
    if (checked) {
      form.setFieldsValue(Object.fromEntries(PROGRESS_FIELDS.map(name => [name, name === field])));
    } else {
      form.setFieldsValue({ [field]: false });
    }
  };

  return (
    <Flex vertical gap={16}>
      <SettingsCard
        title={t('progressSettings')}
        description={t('progressSettingsDescription', {
          defaultValue:
            'Configure how task progress is calculated for this project. Only one method can be active at a time.',
        })}
      >
        <Form.Item
          name="use_manual_progress"
          label={
            <Space>
              <Typography.Text>{t('manualProgress')}</Typography.Text>
              <Tooltip title={t('manualProgressTooltip')}>
                <InfoCircleOutlined style={{ color: token.colorTextSecondary }} />
              </Tooltip>
            </Space>
          }
          valuePropName="checked"
        >
          <Switch onChange={handleProgressChange('use_manual_progress')} disabled={disabled} />
        </Form.Item>

        <Form.Item
          name="use_weighted_progress"
          label={
            <Space>
              <Typography.Text>{t('weightedProgress')}</Typography.Text>
              <Tooltip title={t('weightedProgressTooltip')}>
                <InfoCircleOutlined style={{ color: token.colorTextSecondary }} />
              </Tooltip>
            </Space>
          }
          valuePropName="checked"
        >
          <Switch onChange={handleProgressChange('use_weighted_progress')} disabled={disabled} />
        </Form.Item>

        <Form.Item
          name="use_time_progress"
          label={
            <Space>
              <Typography.Text>{t('timeProgress')}</Typography.Text>
              <Tooltip title={t('timeProgressTooltip')}>
                <InfoCircleOutlined style={{ color: token.colorTextSecondary }} />
              </Tooltip>
            </Space>
          }
          valuePropName="checked"
        >
          <Switch onChange={handleProgressChange('use_time_progress')} disabled={disabled} />
        </Form.Item>
      </SettingsCard>

      <SettingsCard
        title={t('taskSettings', { defaultValue: 'Task Settings' })}
        description={t('taskSettingsDescription', {
          defaultValue: 'Configure default behavior for tasks created in this project.',
        })}
      >
        <Form.Item
          name="auto_assign_task_creator"
          label={
            <Space>
              <Typography.Text>{t('autoAssignTaskCreator')}</Typography.Text>
              <Tooltip title={t('autoAssignTaskCreatorTooltip')}>
                <InfoCircleOutlined style={{ color: token.colorTextSecondary }} />
              </Tooltip>
            </Space>
          }
          valuePropName="checked"
        >
          <Switch disabled={disabled} />
        </Form.Item>
      </SettingsCard>

      <SettingsCard
        title={t('accessControlSettings', { defaultValue: 'Access Control' })}
        description={t('accessControlSettingsDescription', {
          defaultValue: 'Control who can create and assign tasks in this project.',
        })}
      >
        {!canRestrictTaskCreation && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message={t('restrictTaskCreationBusinessPlanTitle', {
              defaultValue: 'Business Plan Required',
            })}
            description={
              <Flex justify="space-between" align="center" gap={12} wrap="wrap">
                <Typography.Text>
                  {t('restrictTaskCreationBusinessPlanDescription', {
                    defaultValue:
                      'Restricting task creation to Admins and Team Leads is available on Business and Enterprise plans.',
                  })}
                </Typography.Text>
                <Button
                  type="primary"
                  icon={<CrownOutlined />}
                  onClick={onUpgradeClick}
                  aria-label={tCommon('upgrade-plan')}
                >
                  {tCommon('upgrade-plan')}
                </Button>
              </Flex>
            }
          />
        )}

        <Form.Item
          name="restrict_task_creation"
          label={
            <Space>
              <Typography.Text>
                {t('restrictTaskCreation', {
                  defaultValue: 'Restrict task assignment to Admins and Team Leads',
                })}
              </Typography.Text>
              <Tooltip
                title={t('restrictTaskCreationTooltip', {
                  defaultValue:
                    'When enabled, only Admins and Team Leads can create and assign tasks. Team Members can only view their assigned tasks.',
                })}
              >
                <InfoCircleOutlined style={{ color: token.colorTextSecondary }} />
              </Tooltip>
            </Space>
          }
          valuePropName="checked"
        >
          <Switch disabled={disabled || !canRestrictTaskCreation} />
        </Form.Item>
      </SettingsCard>

      <SettingsCard
        title={t('phaseAssigneesSettings', { defaultValue: 'Phase Assignees' })}
        description={t('phaseAssigneesSettingsDescription', {
          defaultValue:
            'When enabled, each pipeline phase can have a dedicated assignee. Tasks can only be advanced by their phase assignee (admins can always override).',
        })}
      >
        <Form.Item
          name="phase_assignees_enabled"
          label={
            <Space>
              <Typography.Text>
                {t('phaseAssigneesEnabled', { defaultValue: 'Enable Phase Assignees' })}
              </Typography.Text>
              <Tooltip
                title={t('phaseAssigneesEnabledTooltip', {
                  defaultValue:
                    'When enabled, each phase in the pipeline can have a default assignee who is automatically assigned and responsible for completing tasks in that phase.',
                })}
              >
                <InfoCircleOutlined style={{ color: token.colorTextSecondary }} />
              </Tooltip>
            </Space>
          }
          valuePropName="checked"
        >
          <Switch disabled={disabled} />
        </Form.Item>
      </SettingsCard>
    </Flex>
  );
};

export default AdvancedSettingsSection;
