import { Flex, Form, Space, Switch, Typography, theme, InfoCircleOutlined, Tooltip } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import SettingsCard from '../components/settings-card';

interface PrivacySettingsSectionProps {
  disabled?: boolean;
}

const PrivacySettingsSection = ({ disabled = false }: PrivacySettingsSectionProps) => {
  const { t } = useTranslation('project-drawer');
  const { token } = theme.useToken();

  return (
    <Flex vertical gap={16}>
      <div>
        <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 4 }}>
          {t('projectPrivacySectionTitle', { defaultValue: 'Project Privacy' })}
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 0 }}>
          {t('projectPrivacySectionDescription', {
            defaultValue: 'Control which tasks members can see in this project.',
          })}
        </Typography.Paragraph>
      </div>

      <SettingsCard
        title={t('taskVisibilitySettings', { defaultValue: 'Task Visibility' })}
        description={t('taskVisibilitySettingsDescription', {
          defaultValue:
            'Limit task visibility for members without changing who can be assigned to tasks.',
        })}
      >
        <Form.Item
          name="restrict_tasks_to_assignee"
          label={
            <Space>
              <Typography.Text>
                {t('restrictTasksToAssignee', {
                  defaultValue: 'Show only assigned tasks to members',
                })}
              </Typography.Text>
              <Tooltip
                title={t('restrictTasksToAssigneeTooltip', {
                  defaultValue:
                    'When enabled, members only see tasks assigned to them. Owners, Admins, Team Leads, Project Managers, and Guests always see all tasks.',
                })}
              >
                <InfoCircleOutlined
                  style={{ color: token.colorTextSecondary }}
                  aria-label={t('restrictTasksToAssigneeTooltip', {
                    defaultValue:
                      'When enabled, members only see tasks assigned to them. Owners, Admins, Team Leads, Project Managers, and Guests always see all tasks.',
                  })}
                />
              </Tooltip>
            </Space>
          }
          valuePropName="checked"
          extra={
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {t('restrictTasksToAssigneeHelper', {
                defaultValue:
                  'When enabled, members only see tasks assigned to them. Owners, Admins, Team Leads, Project Managers, and Guests always see all tasks.',
              })}
            </Typography.Text>
          }
        >
          <Switch
            disabled={disabled}
            aria-label={t('restrictTasksToAssignee', {
              defaultValue: 'Show only assigned tasks to members',
            })}
          />
        </Form.Item>
      </SettingsCard>
    </Flex>
  );
};

export default PrivacySettingsSection;
