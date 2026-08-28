import { useEffect } from 'react';
import {
  Alert,
  Button,
  Card,
  Flex,
  Form,
  InputNumber,
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
import { hasBusinessFeatureAccess } from '@/ee/utils/subscription-utils';
import { toggleUpgradeModal } from '@/features/admin-center/admin-center.slice';

const ConfigurationSettings = () => {
  const { t } = useTranslation('settings/configuration');
  const { token } = theme.useToken();
  const dispatch = useAppDispatch();
  const auth = useAuthService();
  const session = auth.getCurrentSession();
  const isOwnerOrAdmin = auth.isOwnerOrAdmin();
  const hasBusinessAccess = hasBusinessFeatureAccess(session);

  const orgConfig = useAppSelector(state => state.orgConfigReducer);
  const [form] = Form.useForm();

  const backdateLimitEnabled = orgConfig.timelog_backdate_limit_days > 0;

  useEffect(() => {
    void dispatch(fetchOrgConfig());
  }, [dispatch]);

  useEffect(() => {
    form.setFieldsValue({
      restrict_task_creation: orgConfig.restrict_task_creation,
      timelog_backdate_limit_days: orgConfig.timelog_backdate_limit_days,
    });
  }, [form, orgConfig.restrict_task_creation, orgConfig.timelog_backdate_limit_days]);

  const handleRestrictTaskCreationChange = async (checked: boolean) => {
    if (!hasBusinessAccess) return;
    await dispatch(updateOrgConfig({ restrict_task_creation: checked }));
  };

  // 0 means "no limit", so toggling on needs a sensible starting value.
  const handleBackdateLimitToggle = async (checked: boolean) => {
    if (!hasBusinessAccess) return;
    await dispatch(updateOrgConfig({ timelog_backdate_limit_days: checked ? 7 : 0 }));
  };

  const handleBackdateLimitDaysChange = async (value: number | null) => {
    if (!hasBusinessAccess) return;
    const days = Math.floor(Number(value));
    if (!Number.isFinite(days) || days < 1 || days > 365) return;
    if (days === orgConfig.timelog_backdate_limit_days) return;
    await dispatch(updateOrgConfig({ timelog_backdate_limit_days: days }));
  };

  const handleUpgradeClick = () => {
    dispatch(toggleUpgradeModal());
  };

  const businessPlanAlert = !hasBusinessAccess && (
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
  );

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
        {businessPlanAlert}

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

      <Card
        title={
          <Typography.Text strong>
            {t('timeTrackingSection', { defaultValue: 'Time Tracking' })}
          </Typography.Text>
        }
      >
        {businessPlanAlert}

        <Form form={form} layout="vertical">
          <Form.Item
            valuePropName="checked"
            style={{ marginBlockEnd: 12 }}
            label={
              <Flex gap={8} align="center">
                <Typography.Text>
                  {t('limitTimelogBackdating', {
                    defaultValue: 'Limit how far back time can be logged',
                  })}
                </Typography.Text>
                <Tooltip
                  title={t('limitTimelogBackdatingTooltip', {
                    defaultValue:
                      'When enabled, members cannot create a time log dated earlier than the allowed number of days. Applies to everyone, including Owners and Admins. Running timers and imported logs are unaffected.',
                  })}
                >
                  <InfoCircleOutlined
                    style={{ color: token.colorTextSecondary }}
                    aria-label={t('limitTimelogBackdatingTooltip', {
                      defaultValue:
                        'When enabled, members cannot create a time log dated earlier than the allowed number of days.',
                    })}
                  />
                </Tooltip>
              </Flex>
            }
          >
            <Switch
              checked={backdateLimitEnabled}
              disabled={!isOwnerOrAdmin || !hasBusinessAccess}
              loading={orgConfig.isLoading}
              onChange={handleBackdateLimitToggle}
              aria-label={t('limitTimelogBackdating', {
                defaultValue: 'Limit how far back time can be logged',
              })}
            />
          </Form.Item>

          {backdateLimitEnabled && (
            <Form.Item
              name="timelog_backdate_limit_days"
              label={
                <Typography.Text>
                  {t('timelogBackdateLimitDays', {
                    defaultValue: 'Maximum days a time log can be backdated',
                  })}
                </Typography.Text>
              }
              style={{ marginBlockEnd: 12 }}
            >
              <InputNumber
                min={1}
                max={365}
                precision={0}
                style={{ width: 160 }}
                disabled={!isOwnerOrAdmin || !hasBusinessAccess}
                onBlur={event => handleBackdateLimitDaysChange(Number(event.target.value))}
                onPressEnter={event =>
                  handleBackdateLimitDaysChange(Number((event.target as HTMLInputElement).value))
                }
                addonAfter={t('days', { defaultValue: 'days' })}
                aria-label={t('timelogBackdateLimitDays', {
                  defaultValue: 'Maximum days a time log can be backdated',
                })}
              />
            </Form.Item>
          )}
        </Form>

        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {t('timelogBackdateLimitNote', {
            defaultValue:
              'Note: Existing time logs are never altered. Editing an already-old log stays possible as long as its date is not changed.',
          })}
        </Typography.Text>
      </Card>
    </Flex>
  );
};

export default ConfigurationSettings;
