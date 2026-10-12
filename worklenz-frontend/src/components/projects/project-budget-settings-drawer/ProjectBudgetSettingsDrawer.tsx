import React, { useState, useEffect } from 'react';
import {
  Drawer,
  Form,
  Select,
  InputNumber,
  Button,
  Space,
  Typography,
  Card,
  Row,
  Col,
  Tooltip,
  message,
  Alert,
  SettingOutlined,
  InfoCircleOutlined,
  DollarOutlined,
  CalculatorOutlined,
  SaveOutlined,
  CloseOutlined,
} from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  updateProjectFinanceCurrency,
  fetchProjectFinancesSilent,
} from '@/features/projects/finance/project-finance.slice';
import { updateProjectCurrency, getProject } from '@/features/project/project.slice';
import { projectFinanceApiService } from '@/api/project-finance-ratecard/project-finance.api.service';
import { CURRENCY_OPTIONS } from '@/shared/currencies';

const { Text } = Typography;

interface ProjectBudgetSettingsDrawerProps {
  visible: boolean;
  onClose: () => void;
  projectId: string;
}

const ProjectBudgetSettingsDrawer: React.FC<ProjectBudgetSettingsDrawerProps> = ({
  visible,
  onClose,
  projectId,
}) => {
  const { t } = useTranslation('project-view-finance');
  const dispatch = useAppDispatch();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Get project data from Redux
  const financeProject = useAppSelector(state => state.projectFinancesReducer.project);
  const { project } = useAppSelector(state => state.projectReducer);
  const activeGroup = useAppSelector(state => state.projectFinancesReducer.activeGroup);
  const billableFilter = useAppSelector(state => state.projectFinancesReducer.billableFilter);

  // Form initial values
  const initialValues = {
    budget: project?.budget || 0,
    currency: financeProject?.currency || 'USD',
  };

  // Set form values when drawer opens
  useEffect(() => {
    if (visible && (project || financeProject)) {
      form.setFieldsValue(initialValues);
      setHasChanges(false);
    }
  }, [visible, project, financeProject, form]);

  // Handle form value changes
  const handleValuesChange = () => {
    setHasChanges(true);
  };

  // Handle save
  const handleSave = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();

      // Update budget if changed
      if (values.budget !== project?.budget) {
        await projectFinanceApiService.updateProjectBudget(projectId, values.budget);
      }

      // Update currency if changed
      if (values.currency !== financeProject?.currency) {
        await projectFinanceApiService.updateProjectCurrency(
          projectId,
          values.currency.toUpperCase()
        );
        dispatch(updateProjectCurrency(values.currency));
        dispatch(updateProjectFinanceCurrency(values.currency));
      }

      message.success(
        t('budgetSettingsDrawer.budgetSettingsUpdated', {
          defaultValue: 'Project settings updated successfully',
        })
      );
      setHasChanges(false);

      // Reload project finances after save
      dispatch(
        fetchProjectFinancesSilent({
          projectId,
          groupBy: activeGroup,
          billableFilter,
          resetExpansions: true,
        })
      );

      // Also refresh the main project data to update budget statistics
      dispatch(getProject(projectId));

      onClose();
    } catch (error) {
      console.error('Failed to update project settings:', error);
      message.error(
        t('budgetSettingsDrawer.budgetSettingsUpdateFailed', {
          defaultValue: 'Failed to update project settings',
        })
      );
    } finally {
      setLoading(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    if (hasChanges) {
      form.setFieldsValue(initialValues);
      setHasChanges(false);
    }
    onClose();
  };

  const filterOption = (input: string, option: any) => {
    return option.label.toLowerCase().includes(input.toLowerCase());
  };

  return (
    <Drawer
      title={
        <Space>
          <SettingOutlined />
          <span>
            {t('budgetSettingsDrawer.title', { defaultValue: 'Project Budget Settings' })}
          </span>
        </Space>
      }
      width={480}
      open={visible}
      onClose={handleCancel}
      footer={
        <Space style={{ float: 'right' }}>
          <Button icon={<CloseOutlined />} onClick={handleCancel}>
            {t('budgetSettingsDrawer.cancel', { defaultValue: 'Cancel' })}
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={loading}
            disabled={!hasChanges}
            onClick={handleSave}
          >
            {t('budgetSettingsDrawer.saveChanges', { defaultValue: 'Save Changes' })}
          </Button>
        </Space>
      }
    >
      <Form
        form={form}
        layout="vertical"
        onValuesChange={handleValuesChange}
        initialValues={initialValues}
      >
        {/* Budget Configuration */}
        <Card
          title={
            <Space>
              <DollarOutlined />
              <span>
                {t('budgetSettingsDrawer.budgetConfiguration', {
                  defaultValue: 'Budget Configuration',
                })}
              </span>
            </Space>
          }
          size="small"
          style={{ marginBottom: 16 }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="budget"
                label={
                  <Space>
                    <span>
                      {t('budgetSettingsDrawer.projectBudget', { defaultValue: 'Project Budget' })}
                    </span>
                    <Tooltip
                      title={t('budgetSettingsDrawer.projectBudgetTooltip', {
                        defaultValue: 'Total budget allocated for this project',
                      })}
                    >
                      <InfoCircleOutlined style={{ color: '#666' }} />
                    </Tooltip>
                  </Space>
                }
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  precision={2}
                  placeholder={t('budgetModal.placeholder', {
                    defaultValue: 'Enter budget amount',
                  })}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="currency" label={t('currencyText', { defaultValue: 'Currency' })}>
                <Select
                  options={CURRENCY_OPTIONS}
                  showSearch
                  allowClear
                  filterOption={filterOption}
                  placeholder={t('budgetSettingsDrawer.currencyPlaceholder', {
                    defaultValue: 'Select currency',
                  })}
                />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* Calculation Method - Organization Wide Setting */}
        <Card
          title={
            <Space>
              <CalculatorOutlined />
              <span>
                {t('budgetSettingsDrawer.costCalculationMethod', {
                  defaultValue: 'Cost Calculation Method',
                })}
              </span>
            </Space>
          }
          size="small"
          style={{ marginBottom: 16 }}
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <Text strong>
                {t('budgetSettingsDrawer.calculationMethod', {
                  defaultValue: 'Calculation Method: ',
                })}
              </Text>
              <Text>
                {' '}
                {financeProject?.calculation_method === 'man_days'
                  ? t('manDaysText', {
                      defaultValue: 'Man Days ({hours}h/day)',
                      hours: financeProject?.hours_per_day || 8,
                    })
                  : t('hourlyRatesText', { defaultValue: 'Hourly Rates' })}
              </Text>
            </div>

            <Alert
              message={t('budgetSettingsDrawer.title', {
                defaultValue: 'Organization-wide Setting',
              })}
              description={
                <Space direction="vertical" size="small">
                  <Text>
                    {t('budgetSettingsDrawer.hourlyCalculationInfo', {
                      defaultValue:
                        'The calculation method is now configured at the organization level and applies to all projects.',
                    })}
                  </Text>
                  <Text>
                    {t('budgetSettingsDrawer.manDaysCalculationInfo', {
                      defaultValue: 'To change this setting, please visit the {page} page',
                      page: 'Admin Center → Overview',
                    })}
                  </Text>
                </Space>
              }
              type="info"
              showIcon
            />
          </Space>
        </Card>

        {/* Information Section */}
        <Card
          title={t('budgetSettingsDrawer.importantNotes', { defaultValue: 'Important Notes' })}
          size="small"
          type="inner"
        >
          <Space direction="vertical" size="small">
            <Text type="secondary">
              {t('budgetSettingsDrawer.calculationMethodChangeNote', {
                defaultValue:
                  '• Changing the calculation method will affect how costs are calculated for all tasks in this project',
              })}
            </Text>
            <Text type="secondary">
              {t('budgetSettingsDrawer.immediateEffectNote', {
                defaultValue:
                  '• Changes take effect immediately and will recalculate all project totals',
              })}
            </Text>
            <Text type="secondary">
              {t('budgetSettingsDrawer.projectWideNote', {
                defaultValue: '• Budget settings apply to the entire project and all its tasks',
              })}
            </Text>
          </Space>
        </Card>
      </Form>
    </Drawer>
  );
};

export default ProjectBudgetSettingsDrawer;
