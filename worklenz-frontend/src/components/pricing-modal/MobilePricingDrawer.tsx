import React, { useState, useCallback } from 'react';
import {
  Drawer,
  Card,
  Button,
  Typography,
  Space,
  Divider,
  Segmented,
  InputNumber,
  Alert,
  List,
  Tag,
  Badge,
  Affix,
} from '@/shared/antd-imports';
import {
  CheckCircleOutlined,
  CloseOutlined,
  TeamOutlined,
  DollarOutlined,
  ShoppingCartOutlined,
  InfoCircleOutlined,
  ArrowUpOutlined,
} from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import {
  PlanTier,
  PricingModel,
  BillingCycle,
  UserPersonalization,
  PricingCalculation,
} from './PricingModal';

interface MobilePricingDrawerProps {
  visible: boolean;
  onClose: () => void;
  plans: PlanTier[];
  selectedPlan: string;
  pricingModel: PricingModel;
  billingCycle: BillingCycle;
  teamSize: number;
  userPersonalization?: UserPersonalization;
  onPlanSelect: (planId: string) => void;
  onPricingModelChange: (model: PricingModel) => void;
  onBillingCycleChange: (cycle: BillingCycle) => void;
  onTeamSizeChange: (size: number) => void;
  onCheckout: (planId: string) => void;
  calculatePlanPricing: (plan: PlanTier) => PricingCalculation | null;
  loading?: boolean;
}

const MobilePricingDrawer: React.FC<MobilePricingDrawerProps> = ({
  visible,
  onClose,
  plans,
  selectedPlan,
  pricingModel,
  billingCycle,
  teamSize,
  userPersonalization,
  onPlanSelect,
  onPricingModelChange,
  onBillingCycleChange,
  onTeamSizeChange,
  onCheckout,
  calculatePlanPricing,
  loading = false,
}) => {
  const { t } = useTranslation(['pricing', 'common']);
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);

  // Handle scroll to show back to top button
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    setShowBackToTop(scrollTop > 300);
  }, []);

  // Scroll to top
  const scrollToTop = useCallback(() => {
    const drawer = document.querySelector('.mobile-pricing-drawer .ant-drawer-body');
    if (drawer) {
      drawer.scrollTop = 0;
    }
  }, []);

  // Handle team size change with validation
  const handleTeamSizeChange = useCallback(
    (value: number | null) => {
      const newSize = Math.max(1, Math.min(500, value || 1));
      onTeamSizeChange(newSize);
    },
    [onTeamSizeChange]
  );

  // Render sticky controls
  const renderStickyControls = () => (
    <Card size="small" style={{ marginBottom: 16 }}>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {/* Billing Cycle */}
        <div>
          <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
            Billing Cycle
          </Typography.Text>
          <Segmented
            value={billingCycle}
            onChange={onBillingCycleChange}
            options={[
              { label: 'Monthly', value: 'MONTHLY' },
              {
                label: (
                  <Space>
                    <span>Yearly</span>
                    <Tag color="green" size="small">
                      Save 30%
                    </Tag>
                  </Space>
                ),
                value: 'YEARLY',
              },
            ]}
            block
          />
        </div>

        {/* Pricing Model */}
        <div>
          <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
            Pricing Model
          </Typography.Text>
          <Segmented
            value={pricingModel}
            onChange={onPricingModelChange}
            options={[
              {
                label: (
                  <Space>
                    <TeamOutlined />
                    <span>Per User</span>
                  </Space>
                ),
                value: 'PER_USER',
              },
              {
                label: (
                  <Space>
                    <DollarOutlined />
                    <span>Base Plan</span>
                  </Space>
                ),
                value: 'BASE_PLAN',
              },
            ]}
            block
          />
        </div>

        {/* Team Size */}
        <div>
          <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
            Team Size
          </Typography.Text>
          <InputNumber
            min={1}
            max={500}
            value={teamSize}
            onChange={handleTeamSizeChange}
            addonAfter={teamSize === 1 ? 'user' : 'users'}
            style={{ width: '100%' }}
            size="large"
          />
        </div>
      </Space>
    </Card>
  );

  // Render compact plan card
  const renderCompactPlanCard = (plan: PlanTier) => {
    const calculation = calculatePlanPricing(plan);
    const isSelected = selectedPlan === plan.id;
    const isExpanded = expandedPlan === plan.id;
    const isCurrent = userPersonalization?.currentPlan === plan.id;

    if (!calculation) return null;

    const { totalCost, discountApplied } = calculation;

    return (
      <Card
        key={plan.id}
        size="small"
        className={`mobile-plan-card ${isSelected ? 'selected' : ''} ${isCurrent ? 'current' : ''}`}
        style={{ marginBottom: 12 }}
      >
        {/* Plan Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}
          onClick={() => setExpandedPlan(isExpanded ? null : plan.id)}
        >
          <div>
            <Space>
              <Typography.Text strong>{plan.name}</Typography.Text>
              {plan.badge && (
                <Badge
                  count={
                    plan.badge === 'most_popular'
                      ? 'Popular'
                      : plan.badge === 'recommended'
                        ? 'Recommended'
                        : 'Best Value'
                  }
                  style={{
                    backgroundColor:
                      plan.badge === 'most_popular'
                        ? '#1890ff'
                        : plan.badge === 'recommended'
                          ? '#52c41a'
                          : '#fa8c16',
                    fontSize: '10px',
                  }}
                />
              )}
            </Space>

            {isCurrent && (
              <Tag color="blue" size="small" style={{ marginLeft: 8 }}>
                Current
              </Tag>
            )}
          </div>

          {/* Pricing Display */}
          <div style={{ textAlign: 'right' }}>
            {discountApplied && (
              <Typography.Text
                delete
                style={{ fontSize: '12px', color: '#8c8c8c', display: 'block' }}
              >
                ${(totalCost + discountApplied.amount).toFixed(2)}
              </Typography.Text>
            )}

            <Typography.Title level={5} style={{ margin: 0, color: '#1890ff' }}>
              {plan.id === 'free' ? 'Free' : `$${totalCost.toFixed(2)}`}
            </Typography.Title>

            {plan.id !== 'free' && (
              <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                /month
              </Typography.Text>
            )}
          </div>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <>
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
              {plan.description}
            </Typography.Text>

            <Divider style={{ margin: '12px 0' }} />

            {/* Key Features (limited to 3 for mobile) */}
            <List
              size="small"
              dataSource={plan.features.slice(0, 3)}
              renderItem={feature => (
                <List.Item style={{ padding: '4px 0', border: 'none' }}>
                  <Space>
                    <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '12px' }} />
                    <Typography.Text style={{ fontSize: '12px' }}>{feature}</Typography.Text>
                  </Space>
                </List.Item>
              )}
            />

            {plan.features.length > 3 && (
              <Typography.Text type="secondary" style={{ fontSize: '11px' }}>
                +{plan.features.length - 3} more features
              </Typography.Text>
            )}

            <Divider style={{ margin: '12px 0' }} />
          </>
        )}

        {/* Action Buttons */}
        <Space style={{ width: '100%' }} direction="vertical" size="small">
          <Button
            type={isSelected ? 'primary' : 'default'}
            size="middle"
            block
            onClick={() => onPlanSelect(plan.id)}
            disabled={loading}
            icon={isCurrent ? <CheckCircleOutlined /> : undefined}
          >
            {isCurrent ? 'Current Plan' : isSelected ? 'Selected' : 'Select Plan'}
          </Button>

          {!isCurrent && plan.id !== 'free' && (
            <Button
              type="primary"
              size="middle"
              block
              onClick={() => onCheckout(plan.id)}
              disabled={loading}
              icon={plan.id === 'enterprise' ? <InfoCircleOutlined /> : <ShoppingCartOutlined />}
            >
              {plan.id === 'enterprise' ? 'Contact Sales' : 'Get Started'}
            </Button>
          )}

          <Button
            type="link"
            size="small"
            block
            onClick={() => setExpandedPlan(isExpanded ? null : plan.id)}
          >
            {isExpanded ? 'Show Less' : 'Show More'}
          </Button>
        </Space>
      </Card>
    );
  };

  return (
    <Drawer
      title={
        <Space>
          <Typography.Title level={4} style={{ margin: 0 }}>
            Choose Your Plan
          </Typography.Title>
        </Space>
      }
      placement="bottom"
      onClose={onClose}
      open={visible}
      height="90%"
      className="mobile-pricing-drawer"
      extra={<Button type="text" icon={<CloseOutlined />} onClick={onClose} />}
    >
      <div onScroll={handleScroll} style={{ height: '100%', overflowY: 'auto' }}>
        {/* User Personalization Banner */}
        {userPersonalization?.userType === 'appsumo' && (
          <Alert
            message="AppSumo Special: 50% off Business+ plans!"
            type="error"
            showIcon
            banner
            style={{ marginBottom: 16 }}
          />
        )}

        {/* Sticky Controls */}
        <Affix offsetTop={0}>{renderStickyControls()}</Affix>

        {/* Pricing Model Recommendation */}
        {teamSize <= 5 && pricingModel === 'BASE_PLAN' && (
          <Alert
            message={
              <span>
                💡 <strong>Save money</strong> by switching to Per User pricing for {teamSize} users
              </span>
            }
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            action={
              <Button size="small" type="primary" onClick={() => onPricingModelChange('PER_USER')}>
                Switch
              </Button>
            }
          />
        )}

        {/* Plan Cards */}
        <div style={{ paddingBottom: 80 }}>{plans.map(renderCompactPlanCard)}</div>

        {/* Back to Top Button */}
        {showBackToTop && (
          <Affix style={{ position: 'fixed', bottom: 20, right: 20 }}>
            <Button
              type="primary"
              shape="circle"
              icon={<ArrowUpOutlined />}
              onClick={scrollToTop}
              size="large"
            />
          </Affix>
        )}
      </div>
    </Drawer>
  );
};

export default MobilePricingDrawer;
