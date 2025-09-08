import { Row, Space, Typography, Select, Button, InputNumber, Flex } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { PlanSelectionControlsProps } from '../types';
import { IPaddlePlans } from '@/shared/constants';

export const PlanSelectionControls: React.FC<PlanSelectionControlsProps> = ({
  teamSize,
  billingFrequency,
  isLoadingPlans,
  isAppSumoUser,
  onTeamSizeChange,
  onBillingFrequencyChange,
  generateTeamSizeOptions,
  minTeamSize,
  maxTeamSize,
}) => {
  const { t } = useTranslation(['admin-center/current-bill', 'pricing-modal']);

  return (
    <Row
      justify="center"
      align="middle"
      style={{ marginTop: isAppSumoUser ? 8 : 24, marginBottom: 16 }}
    >
      <Space size="large" align="center">
        {!isAppSumoUser && (
          <Space align="center" size="middle">
            <Typography.Text strong>{t('pricing-modal:teamSize.label')}:</Typography.Text>
            <Flex align="center" gap={8}>
              <InputNumber
                value={teamSize}
                min={minTeamSize}
                max={maxTeamSize}
                step={1}
                size="large"
                style={{ width: 140 }}
                onChange={(value) => {
                  const v = Number(value);
                  if (Number.isFinite(v)) {
                    onTeamSizeChange(Math.min(Math.max(v, minTeamSize), maxTeamSize));
                  }
                }}
                onBlur={() => {
                  if (teamSize < minTeamSize) onTeamSizeChange(minTeamSize);
                  if (teamSize > maxTeamSize) onTeamSizeChange(maxTeamSize);
                }}
                aria-label={t('pricing-modal:teamSize.aria', 'Team size')}
                disabled={isLoadingPlans}
              />
            </Flex>
          </Space>
        )}

        <Space align="center" size="middle">
          <Typography.Text strong>{t('pricing-modal:billingCycle.label')}:</Typography.Text>
          <Button.Group size="large">
            <Button
              type={billingFrequency === 'monthly' ? 'primary' : 'default'}
              onClick={() => onBillingFrequencyChange('monthly')}
              disabled={isLoadingPlans}
            >
              {t('pricing-modal:billingCycle.monthly')}
            </Button>
            <Button
              type={billingFrequency === 'annual' ? 'primary' : 'default'}
              onClick={() => onBillingFrequencyChange('annual')}
              disabled={isLoadingPlans}
            >
              {t('pricing-modal:billingCycle.yearly')}
            </Button>
          </Button.Group>
        </Space>
      </Space>
    </Row>
  );
};