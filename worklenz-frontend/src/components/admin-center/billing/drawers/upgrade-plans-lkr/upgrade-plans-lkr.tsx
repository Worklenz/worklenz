import { Button, Card, Col, Row, Tag, Typography, message } from '@/shared/antd-imports';
import React, { useState } from 'react';
import './upgrade-plans-lkr.css';
import { CheckCircleFilled } from '@/shared/antd-imports';
import { RootState } from '@/app/store';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useTranslation } from 'react-i18next';
import { timeZoneCurrencyMap } from '@/utils/timeZoneCurrencyMap';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { toggleUpgradeModal, fetchBillingInfo } from '@features/admin-center/admin-center.slice';
import { useAuthService } from '@/hooks/useAuth';
import { adminCenterApiService } from '@/api/admin-center/admin-center.api.service';
import logger from '@/utils/errorLogger';
import { setSession } from '@/utils/session-helper';
import { authApiService } from '@/api/auth/auth.api.service';
import { setUser } from '@/features/user/userSlice';
import { billingApiService } from '@/api/admin-center/billing.api.service';
import { ILocalPlans } from '@/shared/constants';
import { DirectPayModal } from './DirectPayModal';

const UpgradePlansLKR: React.FC = () => {
  const dispatch = useAppDispatch();
  const themeMode = useAppSelector((state: RootState) => state.themeReducer.mode);
  const { t } = useTranslation(['admin-center/current-bill', 'pricing-modal']);
  const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const userCurrency = timeZoneCurrencyMap[userTimeZone] || 'LKR';

  const [selectedPlan, setSelectedPlan] = useState<ILocalPlans[keyof ILocalPlans]>(ILocalPlans.ANNUAL);
  const [switchingToFreePlan, setSwitchingToFreePlan] = useState(false);
  const [directPayLoading, setDirectPayLoading] = useState<boolean>(false);
  const [checkoutPlan, setCheckoutPlan] = useState<'pro' | 'startup' | null>(null);
  const [directPayError, setDirectPayError] = useState<string | null>(null);
  const [showDirectPayModal, setShowDirectPayModal] = useState<boolean>(false);
  const [directPayUrl, setDirectPayUrl] = useState<string>('');

  const [lkrPricingLoading, setLkrPricingLoading] = useState<boolean>(true);
  const [lkrPricingError, setLkrPricingError] = useState<string | null>(null);
  const [freePrice, setFreePrice] = useState<number>(0);
  const [proMonthlyPrice, setProMonthlyPrice] = useState<number>(0);
  const [proAnnualPrice, setProAnnualPrice] = useState<number>(0);
  const [businessMonthlyPrice, setBusinessMonthlyPrice] = useState<number>(0);
  const [businessAnnualPrice, setBusinessAnnualPrice] = useState<number>(0);

  const currentSession = useAuthService().getCurrentSession();
  const annualSavingsPercent =
    businessMonthlyPrice > 0 && businessAnnualPrice > 0
      ? Math.round(
          (1 - businessAnnualPrice / (businessMonthlyPrice * 12)) * 100,
        )
      : 0;

  const hasValidPricing = businessMonthlyPrice > 0 || businessAnnualPrice > 0;
  const hasValidProPricing = proMonthlyPrice > 0 || proAnnualPrice > 0;

  // Pricing data (populated from backend)
  const plans = {
    free: {
      title: t('freePlan'),
      price: freePrice,
      subtitle: t('freeSubtitle'),
      tagline: 'Best for personal use',
      features: ['freeText01', 'freeText02', 'freeText03'],
      tag: selectedPlan === ILocalPlans.FREE ? t('currentPlan') : undefined,
    },
    pro: {
      title: t('pro', { defaultValue: 'Pro' }),
      priceMonthly: proMonthlyPrice,
      priceAnnual: proAnnualPrice,
      subtitle: t('startupSubtitle'),
      tagline: 'Best for small teams',
      features: [
        'startupText01',
        'startupText02',
        'startupText03',
        'startupText04',
        'startupText05',
      ],
      tag: t('tag', { defaultValue: 'Most Popular' }),
    },
    startup: {
      // Local business plan
      title: t('business'),
      priceMonthly: businessMonthlyPrice,
      priceAnnual: businessAnnualPrice,
      subtitle: t('startupSubtitle'),
      tagline: 'Best for growing teams',
      features: [
        'startupText01',
        'startupText02',
        'startupText03',
        'startupText04',
        'startupText05',
      ],
      tag: 'Recommended',
    },
  };

  const cardStyles = {
    checkIcon: { color: '#52c41a', fontSize: '16px' },
    title: {
      fontWeight: 600,
      fontSize: '18px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
    },
    price: {
      fontSize: '32px',
      fontWeight: 700,
      margin: 0,
      lineHeight: 1.1,
    },
    subtitle: {
      fontSize: '14px',
      fontWeight: 500,
    },
    users: {
      fontSize: '14px',
      fontWeight: 400,
    },
    featuresContainer: {
      textAlign: 'left' as const,
      marginTop: '20px',
    },
    featureText: {
      fontSize: '14px',
      lineHeight: 1.5,
    },
  };

  const getCardStyle = (isSelected: boolean) => ({
    height: '100%',
    cursor: 'pointer',
    border: isSelected ? '2px solid #1890ff' : '1px solid #d9d9d9',
    boxShadow: isSelected ? '0 4px 12px rgba(24, 144, 255, 0.15)' : '0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 1px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px 0 rgba(0, 0, 0, 0.02)',
    transition: 'all 0.2s',
    display: 'flex' as const,
    flexDirection: 'column' as const,
  });

  const getCardContainerStyle = () => ({
    display: 'flex' as const,
    flexDirection: 'column' as const,
    height: '100%',
  });

  const handlePlanSelect = (plan: keyof typeof plans) => {
    if (plan === 'free') {
      setSelectedPlan(ILocalPlans.FREE);
    } else if (plan === 'pro') {
      setSelectedPlan(ILocalPlans.PRO_ANNUAL);
    } else {
      setSelectedPlan(ILocalPlans.ANNUAL);
    }
  };

  const switchToFreePlan = async () => {
    const teamId = currentSession?.team_id;
    if (!teamId) return;

    try {
      setSwitchingToFreePlan(true);
      const res = await adminCenterApiService.switchToFreePlan(teamId);
      if (res.done) {
        dispatch(fetchBillingInfo());
        dispatch(toggleUpgradeModal());
        const authorizeResponse = await authApiService.verify();
        if (authorizeResponse.authenticated) {
          setSession(authorizeResponse.user);
          dispatch(setUser(authorizeResponse.user));
          window.location.href = '/worklenz/admin-center/billing';
        }
      }
    } catch (error) {
      logger.error('Error switching to free plan', error);
    } finally {
      setSwitchingToFreePlan(false);
    }
  };

  React.useEffect(() => {
    const loadLkrPricing = async () => {
      try {
        setLkrPricingLoading(true);
        setLkrPricingError(null);
        const response = await billingApiService.getLkrPricing();
        if (response.done && response.body) {
          const { free, pro, business } = response.body;
          setFreePrice(free?.price ?? 0);
          setProMonthlyPrice(pro?.price ?? 0);
          setProAnnualPrice(pro?.discountedPrice ?? 0);
          setBusinessMonthlyPrice(business?.price ?? 0);
          setBusinessAnnualPrice(business?.discountedPrice ?? 0);
        } else {
          setLkrPricingError('Failed to load pricing');
        }
      } catch (error) {
        logger.error('Failed to load LKR pricing', error);
        setLkrPricingError('Failed to load pricing');
      } finally {
        setLkrPricingLoading(false);
      }
    };

    loadLkrPricing();
  }, []);

  const renderFeature = (text: string, index: number) => (
    <div key={index} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '12px' }}>
      <CheckCircleFilled style={cardStyles.checkIcon} />
      <Typography.Text style={cardStyles.featureText}>{t(text)}</Typography.Text>
    </div>
  );

  const isPlanSelected = (planKey: 'free' | 'pro' | 'startup') => {
    if (planKey === 'free') return selectedPlan === ILocalPlans.FREE;
    if (planKey === 'pro') return selectedPlan === ILocalPlans.PRO_ANNUAL || selectedPlan === ILocalPlans.PRO_MONTHLY;
    return selectedPlan === ILocalPlans.ANNUAL || selectedPlan === ILocalPlans.MONTHLY;
  };

  const initializeDirectPayCheckout = async (planKey?: 'pro' | 'startup') => {
    try {
      setDirectPayLoading(true);
      setDirectPayError(null);

      // Derive amount from planKey (explicit) or fall back to selectedPlan state
      const effectivePlan = planKey ?? (
        selectedPlan === ILocalPlans.PRO_ANNUAL || selectedPlan === ILocalPlans.PRO_MONTHLY ? 'pro' : 'startup'
      );
      const amount =
        effectivePlan === 'pro'
          ? proAnnualPrice
          : businessAnnualPrice;

      if (!amount || amount <= 0) {
        throw new Error('Invalid pricing. Please contact support.');
      }

      // Create card add session with initial payment enabled
      const response = await billingApiService.createCardAddSession(amount, true);

      if (!response.done || !response.body) {
        throw new Error(response.message || 'Failed to create card add session');
      }

      const { sessionData } = response.body;

      if (!sessionData) {
        throw new Error('Invalid session data received from server');
      }

      // Extract payment URL from session data
      let paymentUrl = '';
      if (sessionData?.data?.link) {
        paymentUrl = sessionData.data.link;
      } else if (sessionData?.link) {
        paymentUrl = sessionData.link;
      } else if (sessionData?.redirect_url) {
        paymentUrl = sessionData.redirect_url;
      } else if (sessionData?.url) {
        paymentUrl = sessionData.url;
      }

      if (!paymentUrl) {
        throw new Error('No payment URL available from session data');
      }

      // Open DirectPay modal
      setDirectPayUrl(paymentUrl);
      setShowDirectPayModal(true);
      setDirectPayLoading(false);
    } catch (error: any) {
      setDirectPayLoading(false);
      const errorMessage = error?.message || 'Failed to initialize DirectPay checkout';
      setDirectPayError(errorMessage);
      message.error(errorMessage);
      logger.error('Error initializing DirectPay checkout', error);
    }
  };

  const handleDirectPaySuccess = async (response: any) => {
    logger.info('DirectPay payment successful', response);

    const hasCardPayload =
      response?.card?.id ||
      response?.data?.card?.id ||
      response?.walletId ||
      response?.card?.walletId ||
      response?.data?.walletId;

    if (hasCardPayload) {
      try {
        await billingApiService.saveDirectPayCardResponse(response);
      } catch (error) {
        logger.error('Failed to persist DirectPay card response from browser payload', error);
      }
    }
    
    // Close modal immediately for better UX
    setShowDirectPayModal(false);
    
    // Show success message
    message.success('Payment processed successfully! Updating your subscription...');

    // Refresh billing info and close upgrade modal
    dispatch(fetchBillingInfo());
    
    // Refresh user session after a short delay
    setTimeout(() => {
      dispatch(toggleUpgradeModal());
      authApiService.verify().then((authResponse) => {
        if (authResponse.authenticated) {
          setSession(authResponse.user);
          dispatch(setUser(authResponse.user));
        }
      });
    }, 1500);
  };

  const handleDirectPayError = (error: any) => {
    logger.error('DirectPay payment error', error);
    setShowDirectPayModal(false);
    const errorMsg = error?.message || 'Payment failed. Please try again.';
    setDirectPayError(errorMsg);
    message.error(errorMsg);
  };

  const handleDirectPayCancel = () => {
    setShowDirectPayModal(false);
    message.info('Payment was cancelled.');
  };

  const handleUpgradeNow = async (e: React.MouseEvent, planKey: 'pro' | 'startup') => {
    e.stopPropagation();
    handlePlanSelect(planKey);
    setCheckoutPlan(planKey);
    const valid = planKey === 'pro' ? hasValidProPricing : hasValidPricing;
    if (valid) {
      await initializeDirectPayCheckout(planKey);
    } else {
      window.open('mailto:sales@worklenz.com', '_blank');
    }
    setCheckoutPlan(null);
  };

  return (
    <>
      <div className="upgrade-plans">
        <Typography.Title level={2} style={{ textAlign: 'center' as const, marginBottom: '2rem' }}>
          {t('modalTitle')}
        </Typography.Title>

      {lkrPricingLoading && (
        <Typography.Paragraph style={{ marginBottom: '1rem' }}>
          {t('loadingPricing', { defaultValue: 'Loading pricing...' })}
        </Typography.Paragraph>
      )}

      {lkrPricingError && (
        <Typography.Paragraph type="danger" style={{ marginBottom: '1rem' }}>
          {t('pricingError', { defaultValue: lkrPricingError })}
        </Typography.Paragraph>
      )}

      {directPayError && (
        <Typography.Paragraph type="danger" style={{ marginBottom: '1rem' }}>
          {directPayError}
        </Typography.Paragraph>
      )}

      {/* Plan Cards - Centered and Responsive */}
      <Row justify="center" gutter={[24, 32]}>
        {/* Free Plan */}
        <Col xs={24} sm={20} md={8} lg={8} xl={8} style={{ minWidth: 260, maxWidth: 320 }}>
          <Card
            hoverable
            style={getCardStyle(isPlanSelected('free'))}
            onClick={() => handlePlanSelect('free')}
            title={
              <div style={cardStyles.title}>
                {plans.free.title}
                {plans.free.tag && <Tag color="orange">{plans.free.tag}</Tag>}
              </div>
            }
            styles={{
              body: {
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                padding: 0
              }
            }}
          >
            <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', height: '100%', flex: 1 }}>
              <div style={{ flex: 1 }}>
                <div style={{ marginBottom: '16px' }}>
                  <Typography.Title level={1} style={cardStyles.price}>
                    {userCurrency} {plans.free.price}
                  </Typography.Title>
                  <Typography.Text type="secondary" style={cardStyles.subtitle}>{plans.free.subtitle}</Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: '14px', marginTop: '8px', display: 'block' }}>
                    {plans.free.tagline}
                  </Typography.Text>
                </div>
                <div style={cardStyles.featuresContainer}>
                  {plans.free.features.map((f, index) => renderFeature(f, index))}
                </div>
              </div>
              <div style={{ marginTop: 'auto', paddingTop: '20px', textAlign: 'center' as const }}>
                <Button
                  type="primary"
                  size="large"
                  loading={switchingToFreePlan}
                  onClick={(e) => {
                    e.stopPropagation();
                    switchToFreePlan();
                  }}
                  style={{ width: '100%' }}
                >
                  {t('switchToFreePlan')}
                </Button>
              </div>
            </div>
          </Card>
        </Col>

        {/* Pro Plan */}
        <Col xs={24} sm={20} md={8} lg={8} xl={8} style={{ minWidth: 260, maxWidth: 320 }}>
          <Card
            hoverable
            style={getCardStyle(isPlanSelected('pro'))}
            onClick={() => handlePlanSelect('pro')}
            title={
              <div style={cardStyles.title}>
                {plans.pro.title}
                <Tag color="blue">{plans.pro.tag}</Tag>
              </div>
            }
            styles={{
              body: {
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                padding: 0
              }
            }}
          >
            <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', height: '100%', flex: 1 }}>
              <div style={{ flex: 1 }}>
                <div style={{ marginBottom: '16px' }}>
                  {hasValidProPricing ? (
                    <>
                      <Typography.Title level={1} style={cardStyles.price}>
                        {userCurrency} {plans.pro.priceMonthly}
                      </Typography.Title>
                      <Typography.Text type="secondary" style={cardStyles.subtitle}>/month</Typography.Text>
                      <Typography.Text type="secondary" style={{ fontSize: '14px', marginTop: '8px', display: 'block' }}>
                        {plans.pro.tagline}
                      </Typography.Text>
                    </>
                  ) : (
                    <div style={{ textAlign: 'center' as const }}>
                      <Typography.Title level={3} style={{ margin: 0, color: '#8c8c8c' }}>
                        Contact Sales
                      </Typography.Title>
                      <Typography.Text type="secondary" style={{ fontSize: '14px' }}>
                        Custom pricing available
                      </Typography.Text>
                    </div>
                  )}
                </div>
                <div style={cardStyles.featuresContainer}>
                  {plans.pro.features.map((f, index) => renderFeature(f, index))}
                </div>
              </div>
              <div style={{ marginTop: 'auto', paddingTop: '20px', textAlign: 'center' as const }}>
                <Button
                  type="primary"
                  size="large"
                  loading={directPayLoading && checkoutPlan === 'pro'}
                  onClick={(e) => handleUpgradeNow(e, 'pro')}
                  style={{ width: '100%' }}
                >
                  {hasValidProPricing
                    ? t('upgradeNow', { defaultValue: 'Upgrade Now' })
                    : t('contactSales', { defaultValue: 'Contact Sales' })}
                </Button>
              </div>
            </div>
          </Card>
        </Col>

        {/* Business Plan */}
        <Col xs={24} sm={20} md={8} lg={8} xl={8} style={{ minWidth: 260, maxWidth: 320 }}>
          <Card
            hoverable
            style={getCardStyle(isPlanSelected('startup'))}
            onClick={() => handlePlanSelect('startup')}
            title={
              <div style={cardStyles.title}>
                {plans.startup.title}
                <Tag color="volcano">{plans.startup.tag}</Tag>
              </div>
            }
            styles={{
              body: {
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                padding: 0
              }
            }}
          >
            <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', height: '100%', flex: 1 }}>
              <div style={{ flex: 1 }}>
                <div style={{ marginBottom: '16px' }}>
                  {hasValidPricing ? (
                    <>
                      <Typography.Title level={1} style={cardStyles.price}>
                        {userCurrency} {plans.startup.priceMonthly}
                      </Typography.Title>
                      <Typography.Text type="secondary" style={cardStyles.subtitle}>/month</Typography.Text>
                      {businessMonthlyPrice > 0 && (
                        <Typography.Text type="secondary" style={{ fontSize: '14px', marginTop: '8px', display: 'block' }}>
                          {plans.startup.tagline}
                        </Typography.Text>
                      )}
                    </>
                  ) : (
                    <div style={{ textAlign: 'center' as const }}>
                      <Typography.Title level={3} style={{ margin: 0, color: '#8c8c8c' }}>
                        Contact Sales
                      </Typography.Title>
                      <Typography.Text type="secondary" style={{ fontSize: '14px' }}>
                        Custom pricing available
                      </Typography.Text>
                    </div>
                  )}
                </div>
                <div style={cardStyles.featuresContainer}>
                  {plans.startup.features.map((f, index) => renderFeature(f, index))}
                </div>
              </div>
              <div style={{ marginTop: 'auto', paddingTop: '20px', textAlign: 'center' as const }}>
                <Button
                  type="primary"
                  size="large"
                  loading={directPayLoading && checkoutPlan === 'startup'}
                  onClick={(e) => handleUpgradeNow(e, 'startup')}
                  style={{ width: '100%' }}
                >
                  {hasValidPricing
                    ? t('upgradeNow', { defaultValue: 'Upgrade Now' })
                    : t('contactSales', { defaultValue: 'Contact Sales' })}
                </Button>
              </div>
            </div>
          </Card>
        </Col>
      </Row>
      </div>

      {/* DirectPay Modal */}
      <DirectPayModal
        isOpen={showDirectPayModal}
        paymentUrl={directPayUrl}
        onSuccess={handleDirectPaySuccess}
        onError={handleDirectPayError}
        onCancel={handleDirectPayCancel}
      />
    </>
  );
};

export default UpgradePlansLKR;
