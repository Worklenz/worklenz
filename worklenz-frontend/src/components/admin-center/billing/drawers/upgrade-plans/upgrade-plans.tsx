import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Col,
  Flex,
  Form,
  Row,
  Select,
  Tag,
  Tooltip,
  Typography,
  message,
} from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';

import { adminCenterApiService } from '@/api/admin-center/admin-center.api.service';
import {
  IPricingPlans,
  IUpgradeSubscriptionPlanResponse,
} from '@/types/admin-center/admin-center.types';
import logger from '@/utils/errorLogger';
import { useAppSelector } from '@/hooks/useAppSelector';
import { IPaddlePlans, SUBSCRIPTION_STATUS } from '@/shared/constants';
import { CheckCircleFilled, InfoCircleOutlined } from '@/shared/antd-imports';
import { useAuthService } from '@/hooks/useAuth';
import { fetchBillingInfo, toggleUpgradeModal } from '@/features/admin-center/admin-center.slice';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { billingApiService } from '@/api/admin-center/billing.api.service';
import { authApiService } from '@/api/auth/auth.api.service';
import { setUser } from '@/features/user/userSlice';
import { setSession } from '@/utils/session-helper';
import './upgrade-plans.css';

// Extend Window interface to include Paddle
declare global {
  interface Window {
    Paddle?: {
      Environment: { set: (env: string) => void };
      Setup: (config: { vendor: number; eventCallback: (data: any) => void }) => void;
      Checkout: { open: (params: any) => void };
    };
  }
}

declare const Paddle: any;

const UpgradePlans = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('admin-center/current-bill');
  const [plans, setPlans] = useState<IPricingPlans>({});
  const [selectedPlan, setSelectedCard] = useState(IPaddlePlans.ANNUAL);
  const [selectedSeatCount, setSelectedSeatCount] = useState(5);
  const [seatCountOptions, setSeatCountOptions] = useState<number[]>([]);
  const [switchingToFreePlan, setSwitchingToFreePlan] = useState(false);

  const [switchingToPaddlePlan, setSwitchingToPaddlePlan] = useState(false);
  const [form] = Form.useForm();
  const currentSession = useAuthService().getCurrentSession();
  const paddlePlans = IPaddlePlans;

  const { billingInfo } = useAppSelector(state => state.adminCenterReducer);
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  const [paddleLoading, setPaddleLoading] = useState(false);
  const [paddleError, setPaddleError] = useState<string | null>(null);

  const populateSeatCountOptions = (currentSeats: number) => {
    if (typeof currentSeats !== 'number') return [];

    const step = 5;
    const maxSeats = 90;
    const minValue = currentSeats;
    const options: { value: number; disabled: boolean }[] = [];

    // Always show 1-5, but disable if less than minValue
    for (let i = 1; i <= 5; i++) {
      options.push({ value: i, disabled: i < minValue });
    }

    // Show all multiples of 5 from 10 to maxSeats
    for (let i = 10; i <= maxSeats; i += step) {
      options.push({ value: i, disabled: i < minValue });
    }

    return options;
  };

  const fetchPricingPlans = async () => {
    try {
      const res = await adminCenterApiService.getPlans();
      if (res.done) {
        setPlans(res.body);
      }
    } catch (error) {
      logger.error('Error fetching pricing plans', error);
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

  const handlePaddleCallback = (data: any) => {
    console.log('Paddle event:', data);

    switch (data.event) {
      case 'Checkout.Loaded':
        setSwitchingToPaddlePlan(false);
        setPaddleLoading(false);
        break;
      case 'Checkout.Complete':
        message.success('Subscription updated successfully!');
        setPaddleLoading(true);
        setTimeout(() => {
          dispatch(fetchBillingInfo());
          dispatch(toggleUpgradeModal());
          setSwitchingToPaddlePlan(false);
          setPaddleLoading(false);
        }, 10000);
        break;
      case 'Checkout.Close':
        setSwitchingToPaddlePlan(false);
        setPaddleLoading(false);
        // User closed the checkout without completing
        // message.info('Checkout was closed without completing the subscription');
        break;
      case 'Checkout.Error':
        setSwitchingToPaddlePlan(false);
        setPaddleLoading(false);
        setPaddleError(data.error?.message || 'An error occurred during checkout');
        message.error('Error during checkout: ' + (data.error?.message || 'Unknown error'));
        logger.error('Paddle checkout error', data.error);
        break;
      default:
        // Handle other events if needed
        break;
    }
  };

  const initializePaddle = (data: IUpgradeSubscriptionPlanResponse) => {
    setPaddleLoading(true);
    setPaddleError(null);

    // Check if Paddle is already loaded
    if (window.Paddle) {
      configurePaddle(data);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.paddle.com/paddle/paddle.js';
    script.type = 'text/javascript';
    script.async = true;

    script.onload = () => {
      configurePaddle(data);
    };

    script.onerror = () => {
      setPaddleLoading(false);
      setPaddleError('Failed to load Paddle checkout');
      message.error('Failed to load payment processor');
      logger.error('Failed to load Paddle script');
    };

    document.getElementsByTagName('head')[0].appendChild(script);
  };

  const configurePaddle = (data: IUpgradeSubscriptionPlanResponse) => {
    try {
      if (data.sandbox) Paddle.Environment.set('sandbox');
      Paddle.Setup({
        vendor: parseInt(data.vendor_id),
        eventCallback: (eventData: any) => {
          void handlePaddleCallback(eventData);
        },
      });
      Paddle.Checkout.open(data.params);
    } catch (error) {
      setPaddleLoading(false);
      setPaddleError('Failed to initialize checkout');
      message.error('Failed to initialize checkout');
      logger.error('Error initializing Paddle', error);
    }
  };

  const upgradeToPaddlePlan = async (planId: string) => {
    try {
      setSwitchingToPaddlePlan(true);
      setPaddleLoading(true);
      setPaddleError(null);

      if (billingInfo?.trial_in_progress && billingInfo.status === SUBSCRIPTION_STATUS.TRIALING) {
        const res = await billingApiService.upgradeToPaidPlan(planId, selectedSeatCount);
        if (res.done) {
          initializePaddle(res.body);
        } else {
          setSwitchingToPaddlePlan(false);
          setPaddleLoading(false);
          setPaddleError('Failed to prepare checkout');
          message.error('Failed to prepare checkout');
        }
      } else if (billingInfo?.status === SUBSCRIPTION_STATUS.ACTIVE) {
        // For existing subscriptions, use changePlan endpoint
        const res = await adminCenterApiService.changePlan(planId);
        if (res.done) {
          message.success('Subscription plan changed successfully!');
          dispatch(fetchBillingInfo());
          dispatch(toggleUpgradeModal());
          setSwitchingToPaddlePlan(false);
          setPaddleLoading(false);
        } else {
          setSwitchingToPaddlePlan(false);
          setPaddleLoading(false);
          setPaddleError('Failed to change plan');
          message.error('Failed to change subscription plan');
        }
      }
    } catch (error) {
      setSwitchingToPaddlePlan(false);
      setPaddleLoading(false);
      setPaddleError('Error upgrading to paid plan');
      message.error('Failed to upgrade to paid plan');
      logger.error('Error upgrading to paddle plan', error);
    }
  };

  const continueWithPaddlePlan = async () => {
    if (selectedPlan && selectedSeatCount.toString() === '100+') {
      message.info('Please contact sales for custom pricing on large teams');
      return;
    }

    try {
      setSwitchingToPaddlePlan(true);
      setPaddleError(null);
      let planId: string | null = null;

      if (selectedPlan === paddlePlans.ANNUAL && plans.annual_plan_id) {
        planId = plans.annual_plan_id;
      } else if (selectedPlan === paddlePlans.MONTHLY && plans.monthly_plan_id) {
        planId = plans.monthly_plan_id;
      }

      if (planId) {
        upgradeToPaddlePlan(planId);
      } else {
        setSwitchingToPaddlePlan(false);
        setPaddleError('Invalid plan selected');
        message.error('Invalid plan selected');
      }
    } catch (error) {
      setSwitchingToPaddlePlan(false);
      setPaddleError('Error processing request');
      message.error('Error processing request');
      logger.error('Error upgrading to paddle plan', error);
    }
  };

  const isSelected = (cardIndex: IPaddlePlans) =>
    selectedPlan === cardIndex ? { border: '2px solid #1890ff' } : {};

  const cardStyles = {
    title: {
      color: themeMode === 'dark' ? '#ffffffd9' : '#000000d9',
      fontWeight: 500,
      fontSize: '16px',
      display: 'flex',
      gap: '4px',
      justifyContent: 'center',
    },
    priceContainer: {
      display: 'grid',
      gridTemplateColumns: 'auto',
      rowGap: '10px',
      padding: '20px 20px 0',
    },
    featureList: {
      display: 'grid',
      gridTemplateRows: 'auto auto auto',
      gridTemplateColumns: '200px',
      rowGap: '7px',
      padding: '10px',
      justifyItems: 'start',
      alignItems: 'start',
    },
    checkIcon: { color: '#52c41a' },
  };

  const calculateAnnualTotal = (price: string | undefined) => {
    if (!price) return;
    return (12 * parseFloat(price) * selectedSeatCount).toFixed(2);
  };

  const calculateMonthlyTotal = (price: string | undefined) => {
    if (!price) return;
    return (parseFloat(price) * selectedSeatCount).toFixed(2);
  };

  useEffect(() => {
    fetchPricingPlans();
    if (billingInfo?.total_used) {
      setSeatCountOptions(populateSeatCountOptions(billingInfo.total_used));
      form.setFieldsValue({ seatCount: selectedSeatCount });
    }
  }, [billingInfo]);

  const renderFeature = (text: string) => (
    <div>
      <CheckCircleFilled style={cardStyles.checkIcon} />
      &nbsp;<span>{text}</span>
    </div>
  );

  useEffect(() => {
    // Cleanup Paddle script when component unmounts
    return () => {
      const paddleScript = document.querySelector('script[src*="paddle.js"]');
      if (paddleScript) {
        paddleScript.remove();
      }
    };
  }, []);

  return (
    <div className="upgrade-plans-responsive">
      <Flex justify="center" align="center">
        <Typography.Title level={2}>
          {billingInfo?.status === SUBSCRIPTION_STATUS.TRIALING
            ? t('selectPlan', 'Select Plan')
            : t('changeSubscriptionPlan', 'Change Subscription Plan')}
        </Typography.Title>
      </Flex>

      <Flex justify="center" align="center">
        <Form form={form}>
          <Form.Item name="seatCount" label={t('noOfSeats', 'Number of Seats')}>
            <Select
              style={{ width: 100 }}
              value={selectedSeatCount}
              options={seatCountOptions.map(option => ({
                value: option.value,
                label: option.value.toString(),
                disabled: option.disabled,
              }))}
              onChange={setSelectedSeatCount}
            />
          </Form.Item>
        </Form>
      </Flex>

      <Flex>
        <Row className="w-full upgrade-plans-row-responsive">
          {/* Free Plan */}
          <Col span={8} style={{ padding: '0 4px' }}>
            <Card
              style={{ ...isSelected(paddlePlans.FREE), height: '100%' }}
              hoverable
              title={<span style={cardStyles.title}>{t('freePlan', 'Free Plan')}</span>}
              onClick={() => setSelectedCard(paddlePlans.FREE)}
            >
              <div style={cardStyles.priceContainer}>
                <Flex justify="space-between" align="center">
                  <Typography.Title level={1}>$ 0.00</Typography.Title>
                  <Typography.Text>{t('freeForever', 'Free Forever')}</Typography.Text>
                </Flex>
                <Flex justify="center" align="center">
                  <Typography.Text strong style={{ fontSize: '16px' }}>
                    {t('bestForPersonalUse', 'Best for Personal Use')}
                  </Typography.Text>
                </Flex>
              </div>

              <div style={cardStyles.featureList}>
                {renderFeature(`${plans.free_tier_storage} ${t('storage', 'Storage')}`)}
                {renderFeature(`${plans.projects_limit} ${t('projects', 'Projects')}`)}
                {renderFeature(`${plans.team_member_limit} ${t('teamMembers', 'Team Members')}`)}
              </div>
            </Card>
          </Col>

          {/* Annual Plan */}
          <Col span={8} style={{ padding: '0 4px' }}>
            <Card
              style={{ ...isSelected(paddlePlans.ANNUAL), height: '100%' }}
              hoverable
              title={
                <span style={cardStyles.title}>
                  {t('annualPlan', 'Annual Plan')}{' '}
                  <Tag color="volcano" style={{ lineHeight: '21px' }}>
                    {t('tag', 'Popular')}
                  </Tag>
                </span>
              }
              onClick={() => setSelectedCard(paddlePlans.ANNUAL)}
            >
              <div style={cardStyles.priceContainer}>
                <Flex justify="space-between" align="center">
                  <Typography.Title level={1}>$ {plans.annual_price}</Typography.Title>
                  <Typography.Text>seat / month</Typography.Text>
                </Flex>
                <Flex justify="center" align="center">
                  <Typography.Text strong style={{ fontSize: '16px' }}>
                    Total ${calculateAnnualTotal(plans.annual_price)}/ year
                    <Tooltip
                      title={
                        '$' + plans.annual_price + ' x 12 months x ' + selectedSeatCount + ' seats'
                      }
                    >
                      <InfoCircleOutlined
                        style={{ color: 'grey', fontSize: '16px', marginLeft: '4px' }}
                      />
                    </Tooltip>
                  </Typography.Text>
                </Flex>
                <Flex justify="center" align="center">
                  <Typography.Text>{t('billedAnnually', 'Billed Annually')}</Typography.Text>
                </Flex>
              </div>

              <div style={cardStyles.featureList} className="mt-4">
                {renderFeature(t('startupText01', 'Unlimited Projects'))}
                {renderFeature(t('startupText02', 'Unlimited Team Members'))}
                {renderFeature(t('startupText03', 'Unlimited Storage'))}
                {renderFeature(t('startupText04', 'Priority Support'))}
                {renderFeature(t('startupText05', 'Advanced Analytics'))}
              </div>
            </Card>
          </Col>

          {/* Monthly Plan */}
          <Col span={8} style={{ padding: '0 4px' }}>
            <Card
              style={{ ...isSelected(paddlePlans.MONTHLY), height: '100%' }}
              hoverable
              title={<span style={cardStyles.title}>{t('monthlyPlan', 'Monthly Plan')}</span>}
              onClick={() => setSelectedCard(paddlePlans.MONTHLY)}
            >
              <div style={cardStyles.priceContainer}>
                <Flex justify="space-between" align="center">
                  <Typography.Title level={1}>$ {plans.monthly_price}</Typography.Title>
                  <Typography.Text>seat / month</Typography.Text>
                </Flex>
                <Flex justify="center" align="center">
                  <Typography.Text strong style={{ fontSize: '16px' }}>
                    Total ${calculateMonthlyTotal(plans.monthly_price)}/ month
                    <Tooltip
                      title={'$' + plans.monthly_price + ' x ' + selectedSeatCount + ' seats'}
                    >
                      <InfoCircleOutlined
                        style={{ color: 'grey', fontSize: '16px', marginLeft: '4px' }}
                      />
                    </Tooltip>
                  </Typography.Text>
                </Flex>
                <Flex justify="center" align="center">
                  <Typography.Text>{t('billedMonthly', 'Billed Monthly')}</Typography.Text>
                </Flex>
              </div>

              <div style={cardStyles.featureList}>
                {renderFeature(t('startupText01', 'Unlimited Projects'))}
                {renderFeature(t('startupText02', 'Unlimited Team Members'))}
                {renderFeature(t('startupText03', 'Unlimited Storage'))}
                {renderFeature(t('startupText04', 'Priority Support'))}
                {renderFeature(t('startupText05', 'Advanced Analytics'))}
              </div>
            </Card>
          </Col>
        </Row>
      </Flex>
      {paddleError && (
        <Row justify="center" className="mt-2">
          <Typography.Text type="danger">{paddleError}</Typography.Text>
        </Row>
      )}
      <Row justify="end" className="mt-4">
        {selectedPlan === paddlePlans.FREE && (
          <Button
            type="primary"
            htmlType="submit"
            loading={switchingToFreePlan}
            onClick={switchToFreePlan}
          >
            Try for free
          </Button>
        )}
        {selectedPlan === paddlePlans.ANNUAL && (
          <Button
            type="primary"
            htmlType="submit"
            loading={switchingToPaddlePlan || paddleLoading}
            onClick={continueWithPaddlePlan}
            disabled={billingInfo?.plan_id === plans.annual_plan_id}
          >
            {billingInfo?.status === SUBSCRIPTION_STATUS.ACTIVE
              ? t('changeToPlan', 'Change to {{plan}}', { plan: t('annualPlan', 'Annual Plan') })
              : t('continueWith', 'Continue with {{plan}}', { plan: t('annualPlan', 'Annual Plan') })}
          </Button>
        )}
        {selectedPlan === paddlePlans.MONTHLY && (
          <Button
            type="primary"
            htmlType="submit"
            loading={switchingToPaddlePlan || paddleLoading}
            onClick={continueWithPaddlePlan}
            disabled={billingInfo?.plan_id === plans.monthly_plan_id}
          >
            {billingInfo?.status === SUBSCRIPTION_STATUS.ACTIVE
              ? t('changeToPlan', 'Change to {{plan}}', { plan: t('monthlyPlan', 'Monthly Plan') })
              : t('continueWith', 'Continue with {{plan}}', { plan: t('monthlyPlan', 'Monthly Plan') })}
          </Button>
        )}
      </Row>
    </div>
  );
};

export default UpgradePlans;
