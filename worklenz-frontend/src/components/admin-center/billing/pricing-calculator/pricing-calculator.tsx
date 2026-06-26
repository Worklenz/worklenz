import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Card,
  Row,
  Col,
  Slider,
  InputNumber,
  Statistic,
  Alert,
  Form,
  Typography,
  Space,
  Tag,
} from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { billingApiService } from '@/api/admin-center/billing.api.service';
import { IPricingOption } from '@/types/admin-center/admin-center.types';
import logger from '@/utils/errorLogger';
import './pricing-calculator.css';

interface PricingCalculatorProps {
  onPricingChange?: (
    teamSize: number,
    recommendedModel: 'per_user' | 'flat_rate',
    savings: number
  ) => void;
  initialTeamSize?: number;
}

const PricingCalculator: React.FC<PricingCalculatorProps> = ({
  onPricingChange,
  initialTeamSize = 5,
}) => {
  const { t } = useTranslation('admin-center/current-bill');
  const [teamSize, setTeamSize] = useState(initialTeamSize);
  const [pricingOptions, setPricingOptions] = useState<IPricingOption[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPricingOptions = useCallback(async (size: number) => {
    try {
      setLoading(true);
      const response = await billingApiService.getPricingOptions(size);
      if (response.done) {
        setPricingOptions(response.body || []);
      }
    } catch (error) {
      logger.error('Error fetching pricing options', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPricingOptions(teamSize);
  }, [teamSize, fetchPricingOptions]);

  const handleTeamSizeChange = useCallback((value: number | null) => {
    const newSize = Math.max(1, Math.min(100, value || 1));
    setTeamSize(newSize);
  }, []);

  const planComparisons = useMemo(() => {
    const groupedPlans = pricingOptions.reduce(
      (acc, option) => {
        if (!acc[option.plan_name]) {
          acc[option.plan_name] = {};
        }
        acc[option.plan_name][option.variant_type] = option;
        return acc;
      },
      {} as Record<string, Record<string, IPricingOption>>
    );

    return Object.entries(groupedPlans)
      .map(([planName, variants]) => {
        const perUser = variants['per_user'];
        const flatRate = variants['flat_rate'];

        if (!perUser || !flatRate) return null;

        const perUserTotal = perUser.total_cost;
        const flatRateTotal = flatRate.total_cost;
        const savings = Math.abs(perUserTotal - flatRateTotal);
        const percentSavings = ((savings / Math.max(perUserTotal, flatRateTotal)) * 100).toFixed(0);
        const betterOption = perUserTotal < flatRateTotal ? 'per_user' : 'flat_rate';

        return {
          planName,
          perUser,
          flatRate,
          savings,
          percentSavings,
          betterOption,
        };
      })
      .filter(Boolean);
  }, [pricingOptions]);

  // Notify parent component of pricing changes
  useEffect(() => {
    if (planComparisons.length > 0 && onPricingChange) {
      const firstPlan = planComparisons[0];
      if (firstPlan) {
        onPricingChange(
          teamSize,
          firstPlan.betterOption as 'per_user' | 'flat_rate',
          firstPlan.savings
        );
      }
    }
  }, [planComparisons, teamSize, onPricingChange]);

  const sliderMarks = useMemo(
    () => ({
      1: '1',
      5: '5',
      10: '10',
      25: '25',
      50: '50',
      100: '100+',
    }),
    []
  );

  return (
    <Card
      title={
        <Typography.Title level={4} style={{ margin: 0 }}>
          {t('pricingCalculator', 'Pricing Calculator')}
        </Typography.Title>
      }
      className="pricing-calculator"
      loading={loading}
    >
      <Row gutter={24} align="middle">
        <Col xs={24} md={8}>
          <Form.Item label={<Typography.Text strong>{t('teamSize', 'Team Size')}</Typography.Text>}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Slider
                min={1}
                max={100}
                value={teamSize}
                onChange={handleTeamSizeChange}
                marks={sliderMarks}
                tooltip={{
                  formatter: value => `${value} ${value === 1 ? 'user' : 'users'}`,
                }}
              />
              <InputNumber
                min={1}
                max={100}
                value={teamSize}
                onChange={handleTeamSizeChange}
                addonAfter={teamSize === 1 ? 'user' : 'users'}
                style={{ width: '100%' }}
              />
            </Space>
          </Form.Item>
        </Col>

        <Col xs={24} md={16}>
          <div className="pricing-comparison-grid">
            {planComparisons.map(comparison => (
              <Card
                key={comparison.planName}
                size="small"
                className="plan-comparison-card"
                title={<Typography.Text strong>{comparison.planName}</Typography.Text>}
              >
                <Row gutter={16}>
                  <Col span={12}>
                    <div className="pricing-option">
                      <Statistic
                        title={
                          <Space>
                            <span>{t('perUserPricing', 'Per User')}</span>
                            {comparison.betterOption === 'per_user' && (
                              <Tag color="green" size="small">
                                {t('recommended', 'Recommended')}
                              </Tag>
                            )}
                          </Space>
                        }
                        value={comparison.perUser.total_cost}
                        prefix="$"
                        suffix="/month"
                        precision={2}
                        valueStyle={{
                          color: comparison.betterOption === 'per_user' ? '#52c41a' : '#1890ff',
                          fontSize: '18px',
                        }}
                      />
                      <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                        ${comparison.perUser.per_user_price}/user/month
                      </Typography.Text>
                    </div>
                  </Col>

                  <Col span={12}>
                    <div className="pricing-option">
                      <Statistic
                        title={
                          <Space>
                            <span>{t('flatRatePricing', 'Flat Rate')}</span>
                            {comparison.betterOption === 'flat_rate' && (
                              <Tag color="green" size="small">
                                {t('recommended', 'Recommended')}
                              </Tag>
                            )}
                          </Space>
                        }
                        value={comparison.flatRate.total_cost}
                        prefix="$"
                        suffix="/month"
                        precision={2}
                        valueStyle={{
                          color: comparison.betterOption === 'flat_rate' ? '#52c41a' : '#1890ff',
                          fontSize: '18px',
                        }}
                      />
                      <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                        Up to {comparison.flatRate.user_range_max} users
                      </Typography.Text>
                    </div>
                  </Col>
                </Row>

                {comparison.savings > 0 && (
                  <Alert
                    message={
                      <Typography.Text>
                        <strong>
                          Save ${comparison.savings.toFixed(2)}/month ({comparison.percentSavings}%)
                        </strong>{' '}
                        with{' '}
                        <Typography.Text strong>
                          {comparison.betterOption === 'per_user' ? 'Per User' : 'Flat Rate'}
                        </Typography.Text>{' '}
                        pricing
                      </Typography.Text>
                    }
                    type="success"
                    showIcon
                    style={{ marginTop: 12 }}
                    banner
                  />
                )}
              </Card>
            ))}
          </div>

          {planComparisons.length === 0 && !loading && (
            <Alert
              message={t(
                'noPricingOptions',
                'No pricing options available for the selected team size.'
              )}
              type="info"
              showIcon
            />
          )}
        </Col>
      </Row>
    </Card>
  );
};

export default PricingCalculator;
