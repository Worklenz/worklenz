import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Modal,
  Card,
  Row,
  Col,
  Button,
  Typography,
  Tag,
  Badge,
  Space,
  Segmented,
  InputNumber,
  Alert,
  Tooltip,
  List,
  Skeleton,
  Result,
  Statistic,
  Descriptions,
  Divider,
  Drawer,
  message,
} from '@/shared/antd-imports';
import {
  CheckCircleOutlined,
  CloseOutlined,
  SunOutlined,
  MoonOutlined,
  InfoCircleOutlined,
  StarFilled,
  CrownOutlined,
  TeamOutlined,
  DollarOutlined,
  ShoppingCartOutlined,
  FireOutlined,
  ClockCircleOutlined,
} from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useSelector, useDispatch } from 'react-redux';
import { toggleTheme } from '@/features/theme/themeSlice';
import { usePricingData } from './hooks/usePricingData';
import CheckoutModal from './CheckoutModal';
import MobilePricingDrawer from './MobilePricingDrawer';
import './PricingModal.css';
import { RootState } from '@/app/store';

// Types and interfaces
export type PricingModel = 'BASE_PLAN' | 'PER_USER';
export type BillingCycle = 'MONTHLY' | 'YEARLY';
export type UserType = 'trial' | 'free' | 'appsumo' | 'custom' | 'paid';

export interface PlanTier {
  id: string;
  name: string;
  description: string;
  category: 'free' | 'pro' | 'business' | 'enterprise';
  features: string[];
  limits: {
    projects: number | 'unlimited';
    users: number | 'unlimited';
    storage: number;
  };
  pricing: {
    basePlan?: {
      basePrice: number;
      includedUsers: number;
      additionalUserPrice: number;
      maxUsers: number;
    };
    perUser?: {
      monthly: number;
      annual: number;
    };
    enterprise?: {
      price: number;
    };
  };
  badge?: 'most_popular' | 'recommended' | 'best_value';
  isCustomizable?: boolean;
}

export interface UserPersonalization {
  userType: UserType;
  currentPlan?: string;
  trialDaysRemaining?: number;
  appSumoDiscountExpiry?: Date;
  customPlanFeatures?: string[];
  usageMetrics?: {
    projects: number;
    users: number;
    storage: number;
  };
}

export interface PricingCalculation {
  model: PricingModel;
  cycle: BillingCycle;
  teamSize: number;
  planId: string;
  basePrice: number;
  additionalUsersCost: number;
  totalCost: number;
  annualSavings?: number;
  discountApplied?: {
    type: 'appsumo' | 'migration' | 'promotional';
    percentage: number;
    amount: number;
  };
}

interface PricingModalProps {
  visible: boolean;
  onClose: () => void;
  onPlanSelect?: (calculation: PricingCalculation) => void;
  userPersonalization?: UserPersonalization;
  loading?: boolean;
  defaultPricingModel?: PricingModel;
  defaultBillingCycle?: BillingCycle;
  defaultTeamSize?: number;
  organizationId?: string;
  showMobileDrawer?: boolean;
  preselectedPlan?: string;
}

const PLAN_TIERS: PlanTier[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'Perfect for getting started',
    category: 'free',
    features: [
      '3 projects',
      'Basic task management',
      'Team collaboration',
      'Manual management',
      'Community support',
    ],
    limits: {
      projects: 3,
      users: 3,
      storage: 100, // MB
    },
    pricing: {},
  },
  {
    id: 'proSmall',
    name: 'Pro Small',
    description: 'Ideal for small teams',
    category: 'pro',
    features: [
      'Unlimited projects',
      'Advanced task management',
      'Gantt charts',
      'Time tracking',
      'Custom fields',
      'Email support',
    ],
    limits: {
      projects: 'unlimited',
      users: 5,
      storage: 10000, // MB
    },
    pricing: {
      perUser: {
        monthly: 9.99,
        annual: 6.99,
      },
    },
    badge: 'most_popular',
  },
  {
    id: 'businessSmall',
    name: 'Business Small',
    description: 'For growing teams',
    category: 'business',
    features: [
      'Everything in Pro Small',
      'Advanced reporting',
      'Custom workflows',
      'API access',
      'Priority support',
      'Advanced integrations',
    ],
    limits: {
      projects: 'unlimited',
      users: 5,
      storage: 50000, // MB
    },
    pricing: {
      perUser: {
        monthly: 14.99,
        annual: 11.99,
      },
    },
  },
  {
    id: 'proLarge',
    name: 'Pro Large',
    description: 'For larger teams',
    category: 'pro',
    features: [
      'Everything in Pro Small',
      'Advanced team management',
      'Resource allocation',
      'Portfolio management',
      'Priority support',
    ],
    limits: {
      projects: 'unlimited',
      users: 50,
      storage: 50000, // MB
    },
    pricing: {
      basePlan: {
        basePrice: 69,
        includedUsers: 15,
        additionalUserPrice: 5.99,
        maxUsers: 50,
      },
    },
    badge: 'recommended',
  },
  {
    id: 'businessLarge',
    name: 'Business Large',
    description: 'For enterprise teams',
    category: 'business',
    features: [
      'Everything in Business Small',
      'Advanced analytics',
      'Custom branding',
      'SSO integration',
      'Dedicated support',
      'SLA guarantee',
    ],
    limits: {
      projects: 'unlimited',
      users: 100,
      storage: 100000, // MB
    },
    pricing: {
      basePlan: {
        basePrice: 99,
        includedUsers: 20,
        additionalUserPrice: 5.99,
        maxUsers: 100,
      },
    },
    badge: 'best_value',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For large organizations',
    category: 'enterprise',
    features: [
      'Everything in Business Large',
      'Unlimited users',
      'Advanced security',
      'Custom integrations',
      'Dedicated account manager',
      'On-premises deployment',
    ],
    limits: {
      projects: 'unlimited',
      users: 'unlimited',
      storage: 'unlimited',
    },
    pricing: {
      enterprise: {
        price: 349,
      },
    },
    isCustomizable: true,
  },
];

const PricingModal: React.FC<PricingModalProps> = ({
  visible,
  onClose,
  onPlanSelect,
  userPersonalization,
  loading = false,
  defaultPricingModel = 'BASE_PLAN',
  defaultBillingCycle = 'YEARLY',
  defaultTeamSize = 5,
  organizationId,
  showMobileDrawer = false,
  preselectedPlan,
}) => {
  const { t } = useTranslation(['pricing-modal', 'common']);
  const dispatch = useDispatch();
  const theme = useSelector((state: RootState) => state.theme.mode);
  const isDarkMode = theme === 'dark';

  // State management
  const [pricingModel, setPricingModel] = useState<PricingModel>(defaultPricingModel);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(defaultBillingCycle);
  const [teamSize, setTeamSize] = useState<number>(defaultTeamSize);
  const [selectedPlan, setSelectedPlan] = useState<string>(preselectedPlan || '');
  const [isCalculating, setIsCalculating] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [selectedCalculation, setSelectedCalculation] = useState<PricingCalculation | null>(null);
  const [showPlanDetails, setShowPlanDetails] = useState<string | null>(null);
  const [appSumoCountdown, setAppSumoCountdown] = useState<any>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [useMobileDrawer, setUseMobileDrawer] = useState(showMobileDrawer);

  // API integration
  const {
    currentUser,
    availablePlans,
    recommendations,
    loading: apiLoading,
    calculating,
    calculatePricing,
    getAppSumoStatus,
    error: apiError,
    clearError,
  } = usePricingData({
    organizationId,
    initialTeamSize: defaultTeamSize,
    initialPricingModel: defaultPricingModel,
    initialBillingCycle: defaultBillingCycle,
  });

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (mobile && showMobileDrawer) {
        setUseMobileDrawer(true);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [showMobileDrawer]);

  // Determine optimal pricing model based on team size
  const optimalPricingModel = useMemo(() => {
    return teamSize <= 5 ? 'PER_USER' : 'BASE_PLAN';
  }, [teamSize]);

  // Filter plans based on pricing model and team size
  const availablePlanTiers = useMemo(() => {
    return PLAN_TIERS.filter(plan => {
      if (plan.id === 'free') return true;
      if (plan.id === 'enterprise') return true;

      if (pricingModel === 'PER_USER') {
        return plan.pricing.perUser && teamSize <= 5;
      } else {
        return plan.pricing.basePlan || plan.pricing.enterprise;
      }
    });
  }, [pricingModel, teamSize]);

  // Calculate pricing for each plan
  const calculatePlanPricing = useCallback(
    (plan: PlanTier): PricingCalculation | null => {
      if (plan.id === 'free') {
        return {
          model: pricingModel,
          cycle: billingCycle,
          teamSize,
          planId: plan.id,
          basePrice: 0,
          additionalUsersCost: 0,
          totalCost: 0,
        };
      }

      let calculation: PricingCalculation = {
        model: pricingModel,
        cycle: billingCycle,
        teamSize,
        planId: plan.id,
        basePrice: 0,
        additionalUsersCost: 0,
        totalCost: 0,
      };

      if (plan.pricing.enterprise) {
        calculation.basePrice = plan.pricing.enterprise.price;
        calculation.totalCost = plan.pricing.enterprise.price;
      } else if (pricingModel === 'PER_USER' && plan.pricing.perUser) {
        const pricePerUser =
          billingCycle === 'YEARLY' ? plan.pricing.perUser.annual : plan.pricing.perUser.monthly;

        calculation.basePrice = pricePerUser * teamSize;
        calculation.totalCost = pricePerUser * teamSize;

        if (billingCycle === 'YEARLY') {
          const monthlyCost = plan.pricing.perUser.monthly * teamSize * 12;
          const annualCost = pricePerUser * teamSize * 12;
          calculation.annualSavings = monthlyCost - annualCost;
        }
      } else if (pricingModel === 'BASE_PLAN' && plan.pricing.basePlan) {
        const { basePrice, includedUsers, additionalUserPrice } = plan.pricing.basePlan;

        calculation.basePrice = basePrice;

        if (teamSize > includedUsers) {
          calculation.additionalUsersCost = (teamSize - includedUsers) * additionalUserPrice;
        }

        calculation.totalCost = calculation.basePrice + calculation.additionalUsersCost;
      }

      // Apply AppSumo discount if applicable
      if (
        (currentUser?.userType === 'appsumo' || userPersonalization?.userType === 'appsumo') &&
        plan.category !== 'free'
      ) {
        const discountPercentage = 50;
        const discountAmount = calculation.totalCost * (discountPercentage / 100);

        calculation.discountApplied = {
          type: 'appsumo',
          percentage: discountPercentage,
          amount: discountAmount,
        };

        calculation.totalCost -= discountAmount;
      }

      return calculation;
    },
    [pricingModel, billingCycle, teamSize, currentUser, userPersonalization]
  );

  // Handle team size change with pricing model recommendation
  const handleTeamSizeChange = useCallback((value: number | null) => {
    const newSize = Math.max(1, Math.min(500, value || 1));
    setTeamSize(newSize);
  }, []);

  // Handle pricing model change
  const handlePricingModelChange = useCallback((model: PricingModel) => {
    setPricingModel(model);
    setSelectedPlan(''); // Reset selected plan when model changes
  }, []);

  // Handle plan selection
  const handlePlanSelect = useCallback(
    async (planId: string) => {
      setSelectedPlan(planId);

      // Calculate pricing
      const plan = PLAN_TIERS.find(p => p.id === planId);
      if (plan) {
        const calculation = calculatePlanPricing(plan);
        if (calculation) {
          setSelectedCalculation(calculation);
          if (onPlanSelect) {
            onPlanSelect(calculation);
          }
        }
      }
    },
    [calculatePlanPricing, onPlanSelect]
  );

  // Handle checkout initiation
  const handleCheckoutStart = useCallback(
    (planId: string) => {
      if (planId === 'enterprise') {
        // Contact sales for enterprise
        window.open('mailto:sales@worklenz.com?subject=Enterprise Plan Inquiry', '_blank');
        return;
      }

      handlePlanSelect(planId).then(() => {
        setShowCheckout(true);
      });
    },
    [handlePlanSelect]
  );

  // Handle successful checkout
  const handleCheckoutSuccess = useCallback(
    (subscriptionId: string) => {
      message.success('Subscription created successfully!');
      setShowCheckout(false);
      onClose();

      // Optionally redirect to dashboard or billing page
      setTimeout(() => {
        window.location.href = '/admin-center/billing';
      }, 1000);
    },
    [onClose]
  );

  // Handle checkout error
  const handleCheckoutError = useCallback((error: string) => {
    message.error(`Checkout failed: ${error}`);
    setShowCheckout(false);
  }, []);

  // Get AppSumo countdown data
  useEffect(() => {
    const fetchAppSumoCountdown = async () => {
      if (
        (currentUser?.userType === 'appsumo' || userPersonalization?.userType === 'appsumo') &&
        organizationId
      ) {
        try {
          const response = await fetch(
            `/api/plan-recommendations/organizations/${organizationId}/appsumo-countdown`
          );
          if (response.ok) {
            const countdownData = await response.json();
            setAppSumoCountdown(countdownData);
          }
        } catch (error) {
          console.warn('Failed to fetch AppSumo countdown:', error);
        }
      }
    };

    if (visible) {
      fetchAppSumoCountdown();
    }
  }, [visible, currentUser, userPersonalization, organizationId]);

  // Render user type personalization banner
  const renderPersonalizationBanner = () => {
    if (!currentUser && !userPersonalization) return null;

    const user = currentUser || userPersonalization;
    const { userType, trialDaysRemaining, appSumoDiscountExpiry, currentPlan } = user!;

    switch (userType) {
      case 'trial':
        return (
          <Alert
            message={
              <Space>
                <ClockCircleOutlined />
                <span>
                  <strong>{t('userTypes.trial.title')}</strong>{' '}
                  {t('userTypes.trial.message', { days: trialDaysRemaining })}
                </span>
              </Space>
            }
            type="warning"
            showIcon
            banner
            style={{ marginBottom: 16 }}
          />
        );

      case 'appsumo':
        const daysLeft =
          appSumoCountdown?.remainingDays ||
          (appSumoDiscountExpiry
            ? Math.ceil(
                (appSumoDiscountExpiry.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
              )
            : 0);

        return (
          <Alert
            message={
              <Space>
                <FireOutlined />
                <span>
                  <strong>{t('userTypes.appsumo.title')}</strong> {t('userTypes.appsumo.message')}
                  {daysLeft > 0 ? (
                    <>{t('userTypes.appsumo.countdown', { days: daysLeft })}</>
                  ) : (
                    <Tag color="blue">{t('userTypes.appsumo.standardPricing')}</Tag>
                  )}
                </span>
              </Space>
            }
            type={daysLeft > 0 ? 'error' : 'info'}
            showIcon
            banner
            style={{ marginBottom: 16 }}
          />
        );

      case 'free':
        return (
          <Alert
            message={
              <Space>
                <StarFilled />
                <span>
                  <strong>{t('userTypes.free.title')}</strong> {t('userTypes.free.message')}
                </span>
              </Space>
            }
            type="info"
            showIcon
            banner
            style={{ marginBottom: 16 }}
          />
        );

      case 'custom':
        return (
          <Alert
            message={
              <Space>
                <CrownOutlined />
                <span>
                  <strong>{t('userTypes.custom.title')}</strong> {t('userTypes.custom.message')}
                </span>
              </Space>
            }
            type="success"
            showIcon
            banner
            style={{ marginBottom: 16 }}
          />
        );

      default:
        return null;
    }
  };

  // Render plan card
  const renderPlanCard = (plan: PlanTier) => {
    const calculation = calculatePlanPricing(plan);
    const isSelected = selectedPlan === plan.id;
    const isCurrent = (currentUser?.currentPlan || userPersonalization?.currentPlan) === plan.id;

    if (!calculation) return null;

    const { totalCost, basePrice, additionalUsersCost, annualSavings, discountApplied } =
      calculation;

    // Determine if plan should be filtered for AppSumo users
    const isAppSumoUser =
      currentUser?.userType === 'appsumo' || userPersonalization?.userType === 'appsumo';
    const shouldShowForAppSumo =
      !isAppSumoUser ||
      plan.category === 'business' ||
      plan.category === 'enterprise' ||
      plan.id === 'free';

    if (isAppSumoUser && !shouldShowForAppSumo) return null;

    return (
      <Col xs={24} sm={12} lg={6} key={plan.id}>
        <Card
          className={`pricing-plan-card ${isSelected ? 'selected' : ''} ${isCurrent ? 'current' : ''}`}
          hoverable={!loading && !apiLoading}
          loading={loading || apiLoading}
          tabIndex={0}
          role="button"
          aria-pressed={isSelected}
          aria-label={`${plan.name} plan - $${totalCost.toFixed(2)} per month`}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handlePlanSelect(plan.id);
            }
          }}
        >
          {/* Plan Header */}
          <div className="plan-header">
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <div className="plan-title-row">
                <Typography.Title level={4} style={{ margin: 0 }}>
                  {t(`plans.${plan.id}.name`, plan.name)}
                </Typography.Title>
                {plan.badge && (
                  <Badge
                    count={
                      plan.badge === 'most_popular'
                        ? t('badges.mostPopular')
                        : plan.badge === 'recommended'
                          ? t('badges.recommended')
                          : t('badges.bestValue')
                    }
                    style={{
                      backgroundColor:
                        plan.badge === 'most_popular'
                          ? '#1890ff'
                          : plan.badge === 'recommended'
                            ? '#52c41a'
                            : '#fa8c16',
                    }}
                  />
                )}
              </div>

              <Typography.Text type="secondary">
                {t(`plans.${plan.id}.description`, plan.description)}
              </Typography.Text>

              {isCurrent && (
                <Tag color="blue" icon={<CheckCircleOutlined />}>
                  {t('badges.currentPlan')}
                </Tag>
              )}
            </Space>
          </div>

          {/* Pricing Display */}
          <div className="plan-pricing">
            {plan.id === 'free' ? (
              <div className="price-display">
                <Typography.Title level={2} style={{ margin: 0, color: '#52c41a' }}>
                  {t('plans.free.name')}
                </Typography.Title>
                <Typography.Text type="secondary">{t('plans.free.forever')}</Typography.Text>
              </div>
            ) : plan.pricing.enterprise ? (
              <div className="price-display">
                <Typography.Title level={2} style={{ margin: 0 }}>
                  ${plan.pricing.enterprise.price}
                </Typography.Title>
                <Typography.Text type="secondary">{t('pricing.perMonth')}</Typography.Text>
              </div>
            ) : (
              <div className="price-display">
                {discountApplied && (
                  <div className="original-price">
                    <Typography.Text delete style={{ fontSize: '16px', color: '#8c8c8c' }}>
                      ${(totalCost + discountApplied.amount).toFixed(2)}
                    </Typography.Text>
                    <Tag color="red" size="small" style={{ marginLeft: 4 }}>
                      -{discountApplied.percentage}%
                    </Tag>
                  </div>
                )}

                <Typography.Title level={2} style={{ margin: 0 }}>
                  ${totalCost.toFixed(2)}
                </Typography.Title>

                <Typography.Text type="secondary">
                  {pricingModel === 'PER_USER'
                    ? t('pricing.forUsers', {
                        count: teamSize,
                        unit: teamSize === 1 ? t('teamSize.user') : t('teamSize.users'),
                      }) + t('pricing.perMonth')
                    : t('pricing.perMonth')}
                </Typography.Text>

                {pricingModel === 'BASE_PLAN' && plan.pricing.basePlan && (
                  <div className="pricing-breakdown">
                    <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                      {t('pricing.basePrice', {
                        price: `$${basePrice}`,
                        additionalCost: `$${additionalUsersCost.toFixed(2)}`,
                      })}
                    </Typography.Text>
                  </div>
                )}

                {annualSavings && annualSavings > 0 && (
                  <Tag color="green" size="small" style={{ marginTop: 4 }}>
                    {t('pricing.savePerYear', { amount: annualSavings.toFixed(2) })}
                  </Tag>
                )}
              </div>
            )}
          </div>

          <Divider />

          {/* Features List */}
          <div className="plan-features">
            <List
              size="small"
              dataSource={plan.features}
              renderItem={(feature, index) => (
                <List.Item style={{ padding: '4px 0', border: 'none' }}>
                  <Space>
                    <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '14px' }} />
                    <Typography.Text style={{ fontSize: '14px' }}>
                      {t(`plans.${plan.id}.features.${index}`, feature)}
                    </Typography.Text>
                  </Space>
                </List.Item>
              )}
            />
          </div>

          {/* Plan Limits */}
          <div className="plan-limits">
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              {pricingModel === 'BASE_PLAN' && plan.pricing.basePlan && (
                <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                  {t('pricing.upToUsers', { count: plan.pricing.basePlan.maxUsers })}
                </Typography.Text>
              )}
              {pricingModel === 'PER_USER' && plan.limits.users !== 'unlimited' && (
                <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                  {t('pricing.usersRange', { count: plan.limits.users })}
                </Typography.Text>
              )}
            </Space>
          </div>

          {/* Action Button */}
          <div className="plan-action" style={{ marginTop: 16 }}>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Button
                type={isSelected ? 'primary' : 'default'}
                size="large"
                block
                onClick={() =>
                  plan.id === 'free' ? handlePlanSelect(plan.id) : handleCheckoutStart(plan.id)
                }
                disabled={loading || apiLoading || calculating}
                icon={
                  isCurrent ? (
                    <CheckCircleOutlined />
                  ) : plan.id === 'enterprise' ? (
                    <CrownOutlined />
                  ) : plan.id === 'free' ? (
                    <StarFilled />
                  ) : (
                    <ShoppingCartOutlined />
                  )
                }
                loading={calculating && selectedPlan === plan.id}
              >
                {isCurrent
                  ? t('buttons.currentPlan')
                  : plan.id === 'free'
                    ? t('buttons.getStartedFree')
                    : plan.id === 'enterprise'
                      ? t('buttons.contactSales')
                      : t('buttons.choosePlan')}
              </Button>

              {plan.id !== 'free' && (
                <Button
                  type="link"
                  size="small"
                  block
                  onClick={() => setShowPlanDetails(plan.id)}
                  icon={<InfoCircleOutlined />}
                >
                  {t('buttons.viewDetails')}
                </Button>
              )}
            </Space>
          </div>
        </Card>
      </Col>
    );
  };

  // Render pricing model comparison
  const renderPricingModelComparison = () => {
    if (teamSize <= 5 && teamSize > 1) {
      const perUserSample = PLAN_TIERS.find(p => p.id === 'proSmall');
      const basePlanSample = PLAN_TIERS.find(p => p.id === 'proLarge');

      if (perUserSample && basePlanSample) {
        const perUserCost =
          (billingCycle === 'YEARLY'
            ? perUserSample.pricing.perUser!.annual
            : perUserSample.pricing.perUser!.monthly) * teamSize;
        const basePlanCost = basePlanSample.pricing.basePlan!.basePrice;

        const savings = Math.abs(perUserCost - basePlanCost);
        const betterOption = perUserCost < basePlanCost ? 'PER_USER' : 'BASE_PLAN';

        if (pricingModel !== betterOption && savings > 10) {
          return (
            <Alert
              message={
                <span>
                  {t('recommendations.switchModel', {
                    amount: savings.toFixed(2),
                    model:
                      betterOption === 'PER_USER'
                        ? t('recommendations.perUserPricing')
                        : t('recommendations.basePlanPricing'),
                    count: teamSize,
                  })}
                </span>
              }
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
          );
        }
      }
    }
    return null;
  };

  // Render mobile drawer if preferred
  if (useMobileDrawer && isMobile) {
    return (
      <MobilePricingDrawer
        visible={visible}
        onClose={onClose}
        plans={availablePlanTiers}
        selectedPlan={selectedPlan}
        pricingModel={pricingModel}
        billingCycle={billingCycle}
        teamSize={teamSize}
        userPersonalization={currentUser || userPersonalization}
        onPlanSelect={handlePlanSelect}
        onPricingModelChange={handlePricingModelChange}
        onBillingCycleChange={setBillingCycle}
        onTeamSizeChange={handleTeamSizeChange}
        onCheckout={handleCheckoutStart}
        calculatePlanPricing={calculatePlanPricing}
        loading={loading || apiLoading || calculating}
      />
    );
  }

  return (
    <>
      <Modal
        title={null}
        open={visible}
        onCancel={onClose}
        footer={null}
        width="100%"
        style={{ maxWidth: '1400px', top: 20 }}
        className={`pricing-modal ${isDarkMode ? 'dark' : 'light'} ${useMobileDrawer ? 'mobile-preferred' : ''}`}
        destroyOnClose
        aria-labelledby="pricing-modal-title"
        aria-describedby="pricing-modal-description"
      >
        {/* Modal Header */}
        <div className="pricing-modal-header">
          <Space size="large" style={{ width: '100%', justifyContent: 'space-between' }}>
            <div>
              <Typography.Title level={2} style={{ margin: 0 }} id="pricing-modal-title">
                {t('title')}
              </Typography.Title>
              <Typography.Text type="secondary" id="pricing-modal-description">
                {t('subtitle')}
              </Typography.Text>
            </div>

            <Space>
              {isMobile && (
                <Tooltip title={t('buttons.switchToMobile')}>
                  <Button
                    type="text"
                    icon={<TeamOutlined />}
                    onClick={() => setUseMobileDrawer(true)}
                    aria-label={t('buttons.switchToMobile')}
                  />
                </Tooltip>
              )}

              <Tooltip title={t('buttons.toggleTheme')}>
                <Button
                  type="text"
                  icon={isDarkMode ? <SunOutlined /> : <MoonOutlined />}
                  onClick={() => dispatch(toggleTheme())}
                  aria-label={isDarkMode ? t('buttons.switchToLight') : t('buttons.switchToDark')}
                />
              </Tooltip>

              <Button
                type="text"
                icon={<CloseOutlined />}
                onClick={onClose}
                aria-label={t('buttons.closeModal')}
              />
            </Space>
          </Space>
        </div>

        <div className="pricing-modal-content">
          {/* User Personalization Banner */}
          {renderPersonalizationBanner()}

          {/* Billing Cycle Toggle */}
          <Card style={{ marginBottom: 24 }} role="group" aria-labelledby="billing-options">
            <Row gutter={[24, 16]} align="middle">
              <Col xs={24} sm={12} md={8}>
                <Space direction="vertical" size="small">
                  <Typography.Text strong id="billing-cycle-label">
                    {t('billingCycle.label')}
                  </Typography.Text>
                  <Segmented
                    value={billingCycle}
                    onChange={setBillingCycle}
                    options={[
                      {
                        label: (
                          <Space>
                            <span>{t('billingCycle.monthly')}</span>
                          </Space>
                        ),
                        value: 'MONTHLY',
                      },
                      {
                        label: (
                          <Space>
                            <span>{t('billingCycle.yearly')}</span>
                            <Tag color="green" size="small">
                              {t('billingCycle.savePercent')}
                            </Tag>
                          </Space>
                        ),
                        value: 'YEARLY',
                      },
                    ]}
                    size="large"
                    aria-labelledby="billing-cycle-label"
                  />
                </Space>
              </Col>

              <Col xs={24} sm={12} md={8}>
                <Space direction="vertical" size="small">
                  <Typography.Text strong id="pricing-model-label">
                    {t('pricingModel.label')}
                  </Typography.Text>
                  <Segmented
                    value={pricingModel}
                    onChange={handlePricingModelChange}
                    options={[
                      {
                        label: (
                          <Space>
                            <TeamOutlined />
                            <span>{t('pricingModel.perUser')}</span>
                          </Space>
                        ),
                        value: 'PER_USER',
                      },
                      {
                        label: (
                          <Space>
                            <DollarOutlined />
                            <span>{t('pricingModel.basePlan')}</span>
                            {pricingModel !== 'BASE_PLAN' && (
                              <Tag color="blue" size="small">
                                {t('pricingModel.default')}
                              </Tag>
                            )}
                          </Space>
                        ),
                        value: 'BASE_PLAN',
                      },
                    ]}
                    size="large"
                    aria-labelledby="pricing-model-label"
                  />
                </Space>
              </Col>

              <Col xs={24} sm={24} md={8}>
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  <Space>
                    <Typography.Text strong id="team-size-label">
                      {t('teamSize.label')}
                    </Typography.Text>
                    <Tooltip title={t('teamSize.help')}>
                      <InfoCircleOutlined
                        style={{ color: '#8c8c8c' }}
                        aria-label={t('accessibility.teamSizeHelp')}
                      />
                    </Tooltip>
                  </Space>
                  <InputNumber
                    min={1}
                    max={500}
                    value={teamSize}
                    onChange={handleTeamSizeChange}
                    addonAfter={teamSize === 1 ? t('teamSize.user') : t('teamSize.users')}
                    style={{ width: '100%' }}
                    size="large"
                    aria-labelledby="team-size-label"
                    aria-describedby="team-size-help"
                  />
                  <div id="team-size-help" className="sr-only">
                    {t('teamSize.helpDescription')}
                  </div>
                </Space>
              </Col>
            </Row>

            {/* Pricing Model Recommendation */}
            {renderPricingModelComparison()}

            {/* Pricing Model Explanation */}
            <Alert
              message={
                <div>
                  <Typography.Text strong>
                    {pricingModel === 'PER_USER'
                      ? t('pricingModel.perUser')
                      : t('pricingModel.basePlan')}{' '}
                    {t('pricingModel.label')}
                  </Typography.Text>
                  <Typography.Paragraph style={{ marginTop: 8, marginBottom: 0 }}>
                    {pricingModel === 'PER_USER'
                      ? t('pricingModel.explanation.perUser')
                      : t('pricingModel.explanation.basePlan')}
                  </Typography.Paragraph>
                </div>
              }
              type="info"
              showIcon
              style={{ marginTop: 16 }}
            />
          </Card>

          {/* API Error Display */}
          {apiError && (
            <Alert
              message={t('errors.loadingData')}
              description={apiError}
              type="error"
              closable
              onClose={clearError}
              style={{ marginBottom: 16 }}
            />
          )}

          {/* Live region for screen readers */}
          <div aria-live="polite" aria-atomic="true" className="pricing-updates sr-only">
            {calculating ? t('errors.calculating') : ''}
            {selectedPlan ? t('errors.selectedPlan', { plan: selectedPlan }) : ''}
          </div>

          {/* Plan Cards */}
          <div role="group" aria-labelledby="available-plans">
            <Typography.Title level={3} id="available-plans" className="sr-only">
              {t('accessibility.availablePlans')}
            </Typography.Title>
            <Row gutter={[24, 24]}>{availablePlanTiers.map(renderPlanCard)}</Row>
          </div>

          {/* Mobile Optimization Note */}
          <div className="mobile-note" style={{ marginTop: 24 }}>
            <Alert message={t('tips.switchAnytime')} type="info" showIcon banner />
          </div>
        </div>

        {/* Checkout Modal */}
        <CheckoutModal
          visible={showCheckout}
          onClose={() => setShowCheckout(false)}
          onSuccess={handleCheckoutSuccess}
          onError={handleCheckoutError}
          calculation={selectedCalculation}
          userPersonalization={currentUser || userPersonalization}
          organizationId={organizationId}
        />

        {/* Plan Details Drawer */}
        <Drawer
          title={t('planDetails.title')}
          placement="right"
          onClose={() => setShowPlanDetails(null)}
          open={!!showPlanDetails}
          width={400}
        >
          {showPlanDetails &&
            (() => {
              const plan = PLAN_TIERS.find(p => p.id === showPlanDetails);
              if (!plan) return null;

              return (
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                  <div>
                    <Typography.Title level={4}>{plan.name}</Typography.Title>
                    <Typography.Text type="secondary">{plan.description}</Typography.Text>
                  </div>

                  <Divider />

                  <div>
                    <Typography.Title level={5}>{t('planDetails.features')}</Typography.Title>
                    <List
                      dataSource={plan.features}
                      renderItem={(feature, index) => (
                        <List.Item style={{ padding: '8px 0', border: 'none' }}>
                          <Space>
                            <CheckCircleOutlined style={{ color: '#52c41a' }} />
                            <Typography.Text>
                              {t(`plans.${plan.id}.features.${index}`, feature)}
                            </Typography.Text>
                          </Space>
                        </List.Item>
                      )}
                    />
                  </div>

                  <Divider />

                  <div>
                    <Typography.Title level={5}>{t('planDetails.limits')}</Typography.Title>
                    <Descriptions column={1} size="small">
                      <Descriptions.Item label={t('planDetails.projects')}>
                        {plan.limits.projects === 'unlimited'
                          ? t('planDetails.unlimited')
                          : plan.limits.projects}
                      </Descriptions.Item>
                      <Descriptions.Item label={t('planDetails.users')}>
                        {plan.limits.users === 'unlimited'
                          ? t('planDetails.unlimited')
                          : `${t('pricing.upToUsers', { count: plan.limits.users })}`}
                      </Descriptions.Item>
                      <Descriptions.Item label={t('planDetails.storage')}>
                        {plan.limits.storage === 'unlimited'
                          ? t('planDetails.unlimited')
                          : `${plan.limits.storage} MB`}
                      </Descriptions.Item>
                    </Descriptions>
                  </div>

                  <Button
                    type="primary"
                    size="large"
                    block
                    onClick={() => {
                      setShowPlanDetails(null);
                      handleCheckoutStart(plan.id);
                    }}
                    icon={<ShoppingCartOutlined />}
                  >
                    {plan.id === 'enterprise'
                      ? t('buttons.contactSales')
                      : t('buttons.chooseThisPlan')}
                  </Button>
                </Space>
              );
            })()}
        </Drawer>
      </Modal>
    </>
  );
};

export default PricingModal;
