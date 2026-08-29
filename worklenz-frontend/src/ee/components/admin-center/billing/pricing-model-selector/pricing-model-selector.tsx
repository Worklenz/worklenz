import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Card,
  Row,
  Col,
  Button,
  Typography,
  Tag,
  Space,
  Form,
  InputNumber,
  Alert,
  Tooltip,
  Divider,
} from '@/shared/antd-imports';
import { CheckCircleFilled, InfoCircleOutlined } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { IPricingOption } from '@/types/admin-center/admin-center.types';
import './pricing-model-selector.css';

interface PricingModelSelectorProps {
  teamSize: number;
  pricingOptions: IPricingOption[];
  selectedModel: 'per_user' | 'flat_rate';
  selectedPlan: string;
  onModelChange: (model: 'per_user' | 'flat_rate') => void;
  onTeamSizeChange: (size: number) => void;
  onPlanChange: (planId: string) => void;
  loading?: boolean;
}

const PricingModelSelector: React.FC<PricingModelSelectorProps> = ({
  teamSize,
  pricingOptions,
  selectedModel,
  selectedPlan,
  onModelChange,
  onTeamSizeChange,
  onPlanChange,
  loading = false,
}) => {
  const { t } = useTranslation('admin-center/current-bill');

  const planGroups = useMemo(() => {
    const grouped = pricingOptions.reduce(
      (acc, option) => {
        if (!acc[option.plan_id]) {
          acc[option.plan_id] = {
            plan_id: option.plan_id,
            plan_name: option.plan_name,
            variants: {},
          };
        }
        acc[option.plan_id].variants[option.variant_type] = option;
        return acc;
      },
      {} as Record<
        string,
        { plan_id: string; plan_name: string; variants: Record<string, IPricingOption> }
      >
    );

    return Object.values(grouped);
  }, [pricingOptions]);

  const currentPlanVariants = useMemo(() => {
    const plan = planGroups.find(p => p.plan_id === selectedPlan);
    return plan?.variants || {};
  }, [planGroups, selectedPlan]);

  const perUserOption = currentPlanVariants['per_user'];
  const flatRateOption = currentPlanVariants['flat_rate'];

  const pricingComparison = useMemo(() => {
    if (!perUserOption || !flatRateOption) return null;

    const perUserTotal = perUserOption.per_user_price! * teamSize;
    const flatRateTotal = flatRateOption.flat_price!;
    const savings = Math.abs(perUserTotal - flatRateTotal);
    const percentSavings = ((savings / Math.max(perUserTotal, flatRateTotal)) * 100).toFixed(0);

    return {
      per_user: {
        total: perUserTotal,
        per_seat: perUserOption.per_user_price!,
        recommended: perUserTotal < flatRateTotal,
      },
      flat_rate: {
        total: flatRateTotal,
        max_users: flatRateOption.user_range_max,
        recommended: flatRateTotal < perUserTotal,
      },
      savings,
      percentSavings,
      betterOption: perUserTotal < flatRateTotal ? 'per_user' : 'flat_rate',
    };
  }, [perUserOption, flatRateOption, teamSize]);

  const handleTeamSizeChange = useCallback(
    (value: number | null) => {
      const newSize = Math.max(1, Math.min(100, value || 1));
      onTeamSizeChange(newSize);
    },
    [onTeamSizeChange]
  );

  const renderPricingCard = useCallback(
    (
      type: 'per_user' | 'flat_rate',
      option: IPricingOption,
      isSelected: boolean,
      isRecommended: boolean
    ) => {
      const isPerUser = type === 'per_user';
      const price = isPerUser ? option.per_user_price! * teamSize : option.flat_price!;
      const priceLabel = isPerUser
        ? `$${option.per_user_price}/user/month`
        : `$${option.flat_price}/month`;

      return (
        <Card
          key={type}
          className={`pricing-model-card ${isSelected ? 'selected' : ''}`}
          onClick={() => onModelChange(type)}
          hoverable
        >
          <div className="pricing-header">
            <Space align="center">
              <Typography.Title level={4} style={{ margin: 0 }}>
                {isPerUser ? t('perUser', 'Per User') : t('flatRate', 'Flat Rate')}
              </Typography.Title>
              {isRecommended && (
                <Tag color="green" size="small">
                  {t('recommended', 'Recommended')}
                </Tag>
              )}
              {isSelected && <CheckCircleFilled style={{ color: '#52c41a', fontSize: '16px' }} />}
            </Space>
          </div>

          <div className="pricing-details">
            <Typography.Text className="price">${price.toFixed(2)}</Typography.Text>
            <Typography.Text className="price-label">{priceLabel}</Typography.Text>

            {!isPerUser && (
              <Typography.Text className="subtitle">
                Up to {option.user_range_max} users
              </Typography.Text>
            )}
          </div>

          <Divider style={{ margin: '16px 0' }} />

          <ul className="features">
            {isPerUser ? (
              <>
                <li>{t('payOnlyForActiveUsers', 'Pay only for active users')}</li>
                <li>{t('scaleAsYouGrow', 'Scale as you grow')}</li>
                <li>{t('addRemoveUsersAnytime', 'Add/remove users anytime')}</li>
                <li>{t('noUserManagement', 'No seat management required')}</li>
              </>
            ) : (
              <>
                <li>{t('fixedMonthlyCost', 'Fixed monthly cost')}</li>
                <li>{t('predictableBilling', 'Predictable billing')}</li>
                <li>{t('noSeatCalculations', 'No per-seat calculations')}</li>
                <li>{t('perfectForStableTeams', 'Perfect for stable teams')}</li>
              </>
            )}
          </ul>
        </Card>
      );
    },
    [teamSize, onModelChange, t]
  );

  if (!perUserOption || !flatRateOption) {
    return (
      <Alert
        message={t('incompletePricingData', 'Incomplete pricing data for selected plan')}
        type="warning"
        showIcon
      />
    );
  }

  return (
    <div className="pricing-model-selector">
      {/* Team Size Input */}
      <Card title={t('selectTeamSize', 'Select Your Team Size')} style={{ marginBottom: 24 }}>
        <Row gutter={16} align="middle">
          <Col xs={24} sm={12} md={8}>
            <Form.Item
              label={
                <Space>
                  <span>{t('numberOfUsers', 'Number of Users')}</span>
                  <Tooltip
                    title={t('teamSizeTooltip', 'Select your current or expected team size')}
                  >
                    <InfoCircleOutlined style={{ color: '#8c8c8c' }} />
                  </Tooltip>
                </Space>
              }
            >
              <InputNumber
                min={1}
                max={100}
                value={teamSize}
                onChange={handleTeamSizeChange}
                addonAfter={teamSize === 1 ? 'user' : 'users'}
                style={{ width: '100%' }}
                size="large"
              />
            </Form.Item>
          </Col>

          <Col xs={24} sm={12} md={16}>
            {pricingComparison && pricingComparison.savings > 0 && (
              <Alert
                message={
                  <Typography.Text>
                    <strong>
                      Save ${pricingComparison.savings.toFixed(2)}/month (
                      {pricingComparison.percentSavings}%)
                    </strong>{' '}
                    with{' '}
                    <Typography.Text strong>
                      {pricingComparison.betterOption === 'per_user' ? 'Per User' : 'Flat Rate'}
                    </Typography.Text>{' '}
                    pricing for {teamSize} {teamSize === 1 ? 'user' : 'users'}
                  </Typography.Text>
                }
                type="success"
                showIcon
                banner
              />
            )}
          </Col>
        </Row>
      </Card>

      {/* Pricing Model Selection */}
      <Card title={t('choosePricingModel', 'Choose Your Pricing Model')}>
        <Row gutter={24}>
          <Col xs={24} lg={12}>
            {renderPricingCard(
              'per_user',
              perUserOption,
              selectedModel === 'per_user',
              pricingComparison?.per_user.recommended || false
            )}
          </Col>

          <Col xs={24} lg={12}>
            {renderPricingCard(
              'flat_rate',
              flatRateOption,
              selectedModel === 'flat_rate',
              pricingComparison?.flat_rate.recommended || false
            )}
          </Col>
        </Row>

        {/* Additional Information */}
        <div style={{ marginTop: 24 }}>
          <Alert
            message={
              <div>
                <Typography.Text strong>
                  {t('pricingModelNote', 'Pricing Model Information')}
                </Typography.Text>
                <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 20 }}>
                  <li>
                    {t(
                      'switchAnytime',
                      'You can switch between pricing models anytime from your billing settings'
                    )}
                  </li>
                  <li>
                    {t(
                      'flatRateLimit',
                      'Flat rate plans have user limits - ensure your team size fits within the limit'
                    )}
                  </li>
                  <li>
                    {t(
                      'perUserScaling',
                      'Per user plans automatically scale with your team growth'
                    )}
                  </li>
                </ul>
              </div>
            }
            type="info"
            showIcon
          />
        </div>
      </Card>
    </div>
  );
};

export default PricingModelSelector;
