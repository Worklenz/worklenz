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

const UpgradePlansLKR: React.FC = () => {
  const dispatch = useAppDispatch();
  const themeMode = useAppSelector((state: RootState) => state.themeReducer.mode);
  const { t } = useTranslation(['admin-center/current-bill', 'pricing-modal']);
  const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const userCurrency = timeZoneCurrencyMap[userTimeZone] || 'LKR';

  const [selectedPlan, setSelectedPlan] = useState<ILocalPlans[keyof ILocalPlans]>(ILocalPlans.ANNUAL);
  const [switchingToFreePlan, setSwitchingToFreePlan] = useState(false);
  const [directPayLoading, setDirectPayLoading] = useState<boolean>(false);
  const [directPayError, setDirectPayError] = useState<string | null>(null);

  const [lkrPricingLoading, setLkrPricingLoading] = useState<boolean>(true);
  const [lkrPricingError, setLkrPricingError] = useState<string | null>(null);
  const [freePrice, setFreePrice] = useState<number>(0);
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
      textAlign: 'left',
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
          const { free, business } = response.body;
          setFreePrice(free?.price ?? 0);
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

  const renderFeature = (text: string) => (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '12px' }}>
      <CheckCircleFilled style={cardStyles.checkIcon} />
      <Typography.Text style={cardStyles.featureText}>{t(text)}</Typography.Text>
    </div>
  );

  const isPlanSelected = (planKey: 'free' | 'startup') => {
    if (planKey === 'free') return selectedPlan === ILocalPlans.FREE;
    return selectedPlan === ILocalPlans.ANNUAL || selectedPlan === ILocalPlans.MONTHLY;
  };

  const initializeDirectPayCheckout = async () => {
    try {
      setDirectPayLoading(true);
      setDirectPayError(null);

      // Calculate amount based on selected plan (monthly price)
      const amount = selectedPlan === ILocalPlans.ANNUAL 
        ? businessAnnualPrice 
        : businessMonthlyPrice;

      if (!amount || amount <= 0) {
        throw new Error('Invalid pricing. Please contact support.');
      }

      // Create card add session with initial payment enabled
      // This will add the card AND collect payment in one flow
      const response = await billingApiService.createCardAddSession(amount, true);

      if (!response.done || !response.body) {
        throw new Error(response.message || 'Failed to create card add session');
      }

      const { sessionData, stage } = response.body;

      // DirectPay session response contains a URL or data for SDK
      // Based on the PDF, we need to use the SDK or redirect to the session URL
      // For now, we'll check if sessionData has a URL or use the SDK approach
      
      // If sessionData contains a redirect URL, use it
      // Otherwise, we'll need to use the DirectPay SDK
      let checkoutUrl: string;
      
      if (sessionData?.redirect_url || sessionData?.url) {
        checkoutUrl = sessionData.redirect_url || sessionData.url;
      } else if (sessionData?.session_id) {
        // Use session ID to construct URL
        const baseUrl = stage === 'PROD' || stage === 'prod'
          ? 'https://gateway.directpay.lk'
          : 'https://test-gateway.directpay.lk';
        checkoutUrl = `${baseUrl}/payment/session/${sessionData.session_id}`;
      } else {
        // Fallback: try to use the SDK approach
        // Load DirectPay SDK and initialize
        await loadDirectPaySDK(sessionData, stage);
        setDirectPayLoading(false);
        return;
      }

      // Open DirectPay checkout in a popup window
      const width = 600;
      const height = 700;
      const left = (window.screen.width - width) / 2;
      const top = (window.screen.height - height) / 2;

      const checkoutWindow = window.open(
        checkoutUrl,
        'DirectPayCheckout',
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
      );

      if (!checkoutWindow) {
        throw new Error('Popup blocked. Please allow popups for this site.');
      }

      // Listen for messages from DirectPay checkout window
      const handleMessage = (event: MessageEvent) => {
        // Verify origin for security
        if (!event.origin.includes('directpay.lk') && !event.origin.includes('test-gateway.directpay.lk')) {
          return;
        }

        if (event.data) {
          // Handle card add response
          if (event.data.card && event.data.walletId) {
            checkoutWindow?.close();
            window.removeEventListener('message', handleMessage);
            
            if (event.data.status === 200 && event.data.card.status === 'SUCCESS') {
              message.success('Card added and payment processed successfully!');
              // Refresh billing info and close modal
              dispatch(fetchBillingInfo());
              setTimeout(() => {
                dispatch(toggleUpgradeModal());
                // Refresh user session
                authApiService.verify().then((authResponse) => {
                  if (authResponse.authenticated) {
                    setSession(authResponse.user);
                    dispatch(setUser(authResponse.user));
                  }
                });
              }, 2000);
            } else {
              setDirectPayError('Card add or payment failed. Please try again.');
              message.error('Card add or payment failed. Please try again.');
            }
          } else if (event.data.status) {
            // Handle transaction response
            checkoutWindow?.close();
            window.removeEventListener('message', handleMessage);

            if (event.data.status === 'SUCCESS' || event.data.status === 200) {
              message.success('Payment processed successfully!');
              dispatch(fetchBillingInfo());
              setTimeout(() => {
                dispatch(toggleUpgradeModal());
                authApiService.verify().then((authResponse) => {
                  if (authResponse.authenticated) {
                    setSession(authResponse.user);
                    dispatch(setUser(authResponse.user));
                  }
                });
              }, 2000);
            } else if (event.data.status === 'FAILED') {
              setDirectPayError(event.data.message || 'Payment failed. Please try again.');
              message.error('Payment failed. Please try again.');
            } else if (event.data.status === 'CANCELLED') {
              message.info('Payment was cancelled.');
            }
          }
        }
      };

      window.addEventListener('message', handleMessage);

      // Check if window was closed manually
      const checkClosed = setInterval(() => {
        if (checkoutWindow.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', handleMessage);
          setDirectPayLoading(false);
        }
      }, 1000);

      setDirectPayLoading(false);
    } catch (error: any) {
      setDirectPayLoading(false);
      const errorMessage = error?.message || 'Failed to initialize DirectPay checkout';
      setDirectPayError(errorMessage);
      message.error(errorMessage);
      logger.error('Error initializing DirectPay checkout', error);
    }
  };

  // Helper function to load DirectPay SDK if needed
  const loadDirectPaySDK = async (sessionData: any, stage: string) => {
    return new Promise<void>((resolve, reject) => {
      // Check if SDK is already loaded
      if ((window as any).DirectPay) {
        initializeDirectPaySDK(sessionData, stage);
        resolve();
        return;
      }

      // Load the SDK
      const script = document.createElement('script');
      script.src = 'https://cdn.directpay.lk/dev/v1/directpayCardPayment.js?v=1';
      script.type = 'text/javascript';
      script.async = true;

      script.onload = () => {
        initializeDirectPaySDK(sessionData, stage);
        resolve();
      };

      script.onerror = () => {
        reject(new Error('Failed to load DirectPay SDK'));
      };

      document.head.appendChild(script);
    });
  };

  // Initialize DirectPay SDK with session data
  const initializeDirectPaySDK = (sessionData: any, stage: string) => {
    try {
      // This would use the DirectPay SDK to open the card add UI
      // The exact implementation depends on the SDK API
      // For now, we'll log and show an error
      logger.error('DirectPay SDK initialization not fully implemented', { sessionData, stage });
      setDirectPayError('SDK initialization required. Please contact support.');
      message.error('Payment initialization failed. Please try again or contact support.');
    } catch (error) {
      logger.error('Error initializing DirectPay SDK', error);
      setDirectPayError('Failed to initialize payment SDK');
      message.error('Failed to initialize payment SDK');
    }
  };

  const handleUpgradeNow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasValidPricing) {
      await initializeDirectPayCheckout();
    } else {
      window.open('mailto:sales@worklenz.com', '_blank');
    }
  };

  return (
    <div className="upgrade-plans">
      <Typography.Title level={2} style={{ textAlign: 'center', marginBottom: '2rem' }}>
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
        <Col xs={24} sm={20} md={10} lg={8} xl={8}>
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
            bodyStyle={{ 
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              padding: 0
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
                  {plans.free.features.map((f) => renderFeature(f))}
                </div>
              </div>
              <div style={{ marginTop: 'auto', paddingTop: '20px', textAlign: 'center' }}>
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

        {/* Startup Plan */}
        <Col xs={24} sm={20} md={10} lg={8} xl={8}>
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
            bodyStyle={{ 
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              padding: 0
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
                    <div style={{ textAlign: 'center' }}>
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
                  {plans.startup.features.map((f) => renderFeature(f))}
                </div>
              </div>
              <div style={{ marginTop: 'auto', paddingTop: '20px', textAlign: 'center' }}>
                <Button
                  type="primary"
                  size="large"
                  loading={directPayLoading}
                  onClick={handleUpgradeNow}
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
  );
};

export default UpgradePlansLKR;