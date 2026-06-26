import { useEffect } from 'react';
import {
  Alert,
  Button,
  Card,
  Flex,
  Form,
  Switch,
  Tooltip,
  Typography,
  theme,
} from '@/shared/antd-imports';
import { CrownOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { fetchOrgConfig, updateOrgConfig } from '@/features/org-config/org-config.slice';
import { useAuthService } from '@/hooks/useAuth';
import { useBusinessFeatures } from '@/worklenz-ee/hooks/use-business-features';
import { useUpgradePrompt } from '@/worklenz-ee/hooks/use-upgrade-prompt';

const ConfigurationSettings = () => {
  const { t } = useTranslation('settings/configuration');
  const { token } = theme.useToken();
  const dispatch = useAppDispatch();
  const auth = useAuthService();
  const session = auth.getCurrentSession();
  const isOwnerOrAdmin = auth.isOwnerOrAdmin();
  const { hasBusinessAccess } = useBusinessFeatures();
  const { promptUpgrade } = useUpgradePrompt();

  const orgConfig = useAppSelector(state => state.orgConfigReducer);
  const [form] = Form.useForm();

  useEffect(() => {
    void dispatch(fetchOrgConfig());
  }, [dispatch]);

  useEffect(() => {
    form.setFieldsValue({
      restrict_task_creation: orgConfig.restrict_task_creation,
    });
  }, [form, orgConfig.restrict_task_creation]);

  const handleRestrictTaskCreationChange = async (checked: boolean) => {
    if (!hasBusinessAccess) return;
    await dispatch(updateOrgConfig({ restrict_task_creation: checked }));
  };

  const handleUpgradeClick = () => {
    promptUpgrade();
  };

  return (
    <Flex vertical gap={24}>
      <Typography.Title level={4} style={{ margin: 0 }}>
        {t('configurationTitle', { defaultValue: 'Configuration' })}
      </Typography.Title>
      <Typography.Text type="secondary">
        {t('configurationDescription', {
          defaultValue:
            'Manage organization-wide settings that apply across all projects.',
        })}
      </Typography.Text>

      <Card
        title={
          <Typography.Text strong>
            {t('taskManagementSection', { defaultValue: 'Task Management' })}
          </Typography.Text>
        }
      >
        {!hasBusinessAccess && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message={t('businessPlanRequired', { defaultValue: 'Business Plan Required' })}
            description={
              <Flex justify="space-between" align="center" gap={12} wrap="wrap">
                <Typography.Text>
                  {t('businessPlanRequiredDescription', {
                    defaultValue:
                      'Organization-level task restriction settings are available on Business and Enterprise plans.',
                  })}
                </Typography.Text>
                <Button
                  type="primary"
                  icon={<CrownOutlined />}
                  onClick={handleUpgradeClick}
                  aria-label={t('upgradePlan', { defaultValue: 'Upgrade Plan' })}
                >
                  {t('upgradePlan', { defaultValue: 'Upgrade Plan' })}
                </Button>
              </Flex>
            }
          />
        )}

        <Form form={form} layout="vertical">
          <Form.Item
            name="restrict_task_creation"
            valuePropName="checked"
            label={
              <Flex gap={8} align="center">
                <Typography.Text>
                  {t('restrictTaskCreation', {
                    defaultValue: 'Restrict task assignment to Admins and Team Leads',
                  })}
                </Typography.Text>
                <Tooltip
                  title={t('restrictTaskCreationTooltip', {
                    defaultValue:
                      'When enabled, only Admins and Team Leads can create and assign tasks across all projects. Team Members can only view tasks assigned to them. Project-level settings override this organization-level setting.',
                  })}
                >
                  <InfoCircleOutlined
                    style={{ color: token.colorTextSecondary }}
                    aria-label={t('restrictTaskCreationTooltip', {
                      defaultValue:
                        'When enabled, only Admins and Team Leads can create and assign tasks across all projects.',
                    })}
                  />
                </Tooltip>
              </Flex>
            }
          >
            <Switch
              disabled={!isOwnerOrAdmin || !hasBusinessAccess}
              loading={orgConfig.isLoading}
              onChange={handleRestrictTaskCreationChange}
              aria-label={t('restrictTaskCreation', {
                defaultValue: 'Restrict task assignment to Admins and Team Leads',
              })}
            />
          </Form.Item>
        </Form>

        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {t('restrictTaskCreationNote', {
            defaultValue:
              'Note: Project-level settings take priority over this organization-level setting. Changes take effect immediately.',
          })}
        </Typography.Text>
      </Card>
    </Flex>
  );
};

export default ConfigurationSettings;
