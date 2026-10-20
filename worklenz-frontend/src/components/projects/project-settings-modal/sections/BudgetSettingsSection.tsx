import {
  Alert,
  Button,
  CrownOutlined,
  Flex,
  Form,
  Input,
  Select,
  Typography,
} from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';

import { CURRENCY_OPTIONS } from '@/shared/currencies';
import SettingsCard from '../components/settings-card';

interface BudgetSettingsSectionProps {
  editMode: boolean;
  canManage: boolean;
  hasFinanceAccess: boolean;
  onUpgradeClick: () => void;
}

const BudgetSettingsSection = ({
  editMode,
  canManage,
  hasFinanceAccess,
  onUpgradeClick,
}: BudgetSettingsSectionProps) => {
  const { t } = useTranslation('project-drawer');
  const { t: tCommon } = useTranslation('common');

  return (
    <SettingsCard title={t('budgetSettingsTab', { defaultValue: 'Budget Settings' })}>
      {!hasFinanceAccess && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={t('budgetBusinessPlanTitle', { defaultValue: 'Business Plan Required' })}
          description={
            <Flex justify="space-between" align="center" gap={12} wrap="wrap">
              <Typography.Text>
                {t('budgetBusinessPlanDescription', {
                  defaultValue:
                    'Project budget settings are available on Business and Enterprise plans.',
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

      {!editMode && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message={t('budgetCreateFirstTitle', { defaultValue: 'Create Project First' })}
          description={t('budgetCreateFirstDescription', {
            defaultValue:
              'Save the project first, then return to configure budget and currency settings.',
          })}
        />
      )}

      <Form.Item
        name="budget"
        label={t('budgetAmountLabel', { defaultValue: 'Project Budget' })}
        rules={[
          {
            validator: (_, value) => {
              if (value === undefined || value === null || Number(value) >= 0) {
                return Promise.resolve();
              }
              return Promise.reject(
                new Error(
                  t('budgetValidationMessage', {
                    defaultValue: 'Budget must be 0 or greater',
                  })
                )
              );
            },
          },
        ]}
      >
        <Input
          type="number"
          min={0}
          step="0.01"
          disabled={!canManage || !editMode}
          placeholder={t('budgetAmountPlaceholder', { defaultValue: 'Enter project budget' })}
        />
      </Form.Item>

      <Form.Item
        name="currency"
        label={t('budgetCurrencyLabel', { defaultValue: 'Currency' })}
        rules={[
          {
            required: false,
            message: t('budgetCurrencyRequired', { defaultValue: 'Please select a currency' }),
          },
        ]}
      >
        <Select
          showSearch
          options={CURRENCY_OPTIONS}
          disabled={!canManage || !editMode}
          placeholder={t('budgetCurrencyPlaceholder', { defaultValue: 'Select currency' })}
          filterOption={(input, option) =>
            String(option?.label || '')
              .toLowerCase()
              .includes(input.toLowerCase())
          }
        />
      </Form.Item>
    </SettingsCard>
  );
};

export default BudgetSettingsSection;
