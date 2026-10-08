import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Card,
  Col,
  Flex,
  InputNumber,
  Modal,
  Row,
  Segmented,
  Space,
  Tag,
  Typography,
  message,
} from '@/shared/antd-imports';
import { CheckOutlined } from '@ant-design/icons';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { fetchBillingInfo, toggleUpgradeModal } from '@/features/admin-center/admin-center.slice';
import { setUser } from '@/features/user/userSlice';
import { setSession } from '@/utils/session-helper';
import { useAuthService } from '@/hooks/useAuth';
import { authApiService } from '@/api/auth/auth.api.service';
import { adminCenterApiService } from '@/api/admin-center/admin-center.api.service';
import {
  billingApiService,
  type IPerUserPlan,
  type IPerUserPlansResponse,
} from '@/ee/api/admin-center/billing.api.service';
import {
  ILegacyCheckoutEvent,
  isPaddleBillingCheckout,
  openPaddleBillingCheckout,
} from '@/ee/utils/paddle-billing-checkout';
import logger from '@/utils/errorLogger';
import {
  IPlanGroup,
  PricingFrequency,
  annualSavingsPercent,
  formatUsd,
  groupPlans,
  perUserMonthlyPrice,
  periodTotal,
  pickPlan,
} from './per-user-pricing';

// Same grace period as the legacy checkout: the subscription is created by a webhook, so wait a
// moment before reloading billing info.
const POST_CHECKOUT_REFRESH_DELAY_MS = 10000;
const MAX_SEATS = 10000;

interface PerUserUpgradePlansProps {
  data: IPerUserPlansResponse;
}

/**
 * Upgrade modal content for per-user plans sold on Paddle Billing. Shown instead of the legacy
 * plan cards once those plans are activated (see UpgradePlansSwitch).
 */
const PerUserUpgradePlans: React.FC<PerUserUpgradePlansProps> = ({ data }) => {
  const { t } = useTranslation('per-user-pricing');
  const dispatch = useAppDispatch();
  const authService = useAuthService();
  const billingInfo = useAppSelector(state => state.adminCenterReducer.billingInfo);

  const groups = useMemo(() => groupPlans(data.plans), [data.plans]);
  const activeUsers = Math.max(1, billingInfo?.total_used ?? 1);

  const [frequency, setFrequency] = useState<PricingFrequency>('monthly');
  const [seats, setSeats] = useState<number>(activeUsers);
  const [expansionSeats, setExpansionSeats] = useState<number>(1);
  const [busyPlanId, setBusyPlanId] = useState<string | null>(null);

  const finishCheckout = () => {
    message.success(t('messages.success'));
    authApiService
      .verify()
      .then(response => {
        if (response.authenticated) {
          setSession(response.user);
          dispatch(setUser(response.user));
          authService.setCurrentSession(response.user);
        }
      })
      .catch(error => logger.error('Error refreshing session after checkout', error));

    // The webhook creates the subscription; give it a moment before reloading billing info.
    // Not cancelled on unmount: the store dispatches are safe, and a user who closes the modal
    // early still needs the refreshed billing info.
    setTimeout(() => {
      dispatch(fetchBillingInfo());
      dispatch(toggleUpgradeModal());
      setBusyPlanId(null);
    }, POST_CHECKOUT_REFRESH_DELAY_MS);
  };

  const handleCheckoutEvent = (event: ILegacyCheckoutEvent) => {
    switch (event.event) {
      case 'Checkout.Loaded':
        setBusyPlanId(null);
        break;
      case 'Checkout.Complete':
        finishCheckout();
        break;
      case 'Checkout.Close':
        setBusyPlanId(null);
        break;
      case 'Checkout.Error':
        setBusyPlanId(null);
        message.error(t('messages.checkoutError', { message: event.error?.message ?? '' }));
        logger.error('Paddle Billing checkout error', event.error);
        break;
    }
  };

  const startCheckout = async (plan: IPerUserPlan, seatCount: number, replaceLegacy: boolean) => {
    setBusyPlanId(plan.id);
    try {
      const response = await billingApiService.upgradeToPaidPlan(plan.id, 'per_user', seatCount, replaceLegacy);
      if (!response.done || !isPaddleBillingCheckout(response.body)) {
        throw new Error(response.message || 'Unexpected checkout response');
      }
      await openPaddleBillingCheckout(response.body, handleCheckoutEvent);
    } catch (error) {
      setBusyPlanId(null);
      message.error(t('messages.error'));
      logger.error('Failed to start Paddle Billing checkout', error);
    }
  };

  const changePlan = async (plan: IPerUserPlan) => {
    setBusyPlanId(plan.id);
    try {
      const response = await adminCenterApiService.changePlan(plan.id);
      if (!response.done) throw new Error(response.message || 'Plan change failed');
      message.success(t('messages.changed'));
      dispatch(fetchBillingInfo());
      dispatch(toggleUpgradeModal());
    } catch (error) {
      message.error(t('messages.error'));
      logger.error('Failed to change plan', error);
    } finally {
      setBusyPlanId(null);
    }
  };

  const handleSelect = (plan: IPerUserPlan, seatCount: number) => {
    if (data.has_billing_subscription) {
      void changePlan(plan);
      return;
    }
    if (data.has_legacy_subscription) {
      Modal.confirm({
        title: t('legacyConfirm.title'),
        content: t('legacyConfirm.content'),
        okText: t('legacyConfirm.ok'),
        cancelText: t('legacyConfirm.cancel'),
        zIndex: 1100, // above the upgrade modal (1050)
        onOk: () => startCheckout(plan, seatCount, true),
      });
      return;
    }
    void startCheckout(plan, seatCount, false);
  };

  const renderCard = (group: IPlanGroup) => {
    const plan = pickPlan(group, frequency);
    const isExpansion = group.key === 'business_appsumo_expansion';
    const planCopy = isExpansion ? 'expansion' : group.key;
    const cardSeats = isExpansion ? expansionSeats : seats;
    const savings = annualSavingsPercent(group);
    const features = t(`plans.${planCopy}.features`, { returnObjects: true }) as string[];
    const isCurrent = !!plan && billingInfo?.plan_id === plan.id;

    return (
      <Col xs={24} md={12} xl={8} key={group.key}>
        <Card style={{ height: '100%' }} styles={{ body: { height: '100%' } }}>
          <Flex vertical gap={12} justify="space-between" style={{ height: '100%' }}>
            <Flex vertical gap={8}>
              <Flex justify="space-between" align="center">
                <Typography.Title level={3} style={{ margin: 0 }}>
                  {t(`plans.${planCopy}.name`)}
                </Typography.Title>
                {isCurrent && <Tag color="green">{t('currentPlan')}</Tag>}
              </Flex>
              <Typography.Text type="secondary">{t(`plans.${planCopy}.description`)}</Typography.Text>

              {plan ? (
                <>
                  <Flex align="baseline" gap={6}>
                    <Typography.Text style={{ fontSize: 36, fontWeight: 600 }}>
                      {formatUsd(perUserMonthlyPrice(plan))}
                    </Typography.Text>
                    <Typography.Text type="secondary">{t('perUserPerMonth')}</Typography.Text>
                  </Flex>
                  {plan.billing_type === 'year' && (
                    <Typography.Text type="secondary">
                      {t('billedAnnually', { total: formatUsd(plan.price) })}
                    </Typography.Text>
                  )}
                  {frequency === 'monthly' && savings && (
                    <Tag color="blue" style={{ width: 'fit-content' }}>
                      {t('saveUpTo', { percent: savings })}
                    </Tag>
                  )}
                </>
              ) : (
                <Typography.Text type="secondary">{t('unavailable')}</Typography.Text>
              )}

              {isExpansion && (
                <Flex align="center" gap={8}>
                  <Typography.Text>{t('seats')}</Typography.Text>
                  <InputNumber
                    min={1}
                    max={MAX_SEATS}
                    value={expansionSeats}
                    onChange={value => setExpansionSeats(value ?? 1)}
                  />
                </Flex>
              )}

              <Space direction="vertical" size={4}>
                {Array.isArray(features) &&
                  features.map(feature => (
                    <Typography.Text key={feature}>
                      <CheckOutlined style={{ color: '#52c41a', marginRight: 8 }} />
                      {feature}
                    </Typography.Text>
                  ))}
              </Space>
            </Flex>

            <Flex vertical gap={8}>
              {plan && (
                <Typography.Text type="secondary">
                  {t(plan.billing_type === 'year' ? 'totalAnnual' : 'totalMonthly', {
                    total: formatUsd(periodTotal(plan, cardSeats)),
                    count: cardSeats,
                  })}
                </Typography.Text>
              )}
              <Button
                type="primary"
                size="large"
                block
                disabled={!plan || isCurrent}
                loading={!!plan && busyPlanId === plan.id}
                onClick={() => plan && handleSelect(plan, cardSeats)}
              >
                {data.has_billing_subscription ? t('switch') : t('select')}
              </Button>
            </Flex>
          </Flex>
        </Card>
      </Col>
    );
  };

  return (
    <div className="upgrade-plans-responsive">
      <Flex vertical align="center" gap={4} style={{ marginBottom: 16 }}>
        <Typography.Title level={2} style={{ margin: 0 }}>
          {t('title')}
        </Typography.Title>
        <Typography.Text type="secondary">{t('subtitle')}</Typography.Text>
      </Flex>

      <Flex justify="center" align="center" gap={24} wrap style={{ marginBottom: 16 }}>
        <Segmented<PricingFrequency>
          value={frequency}
          onChange={setFrequency}
          options={[
            { label: t('monthly'), value: 'monthly' },
            { label: t('annual'), value: 'annual' },
          ]}
        />
        <Flex align="center" gap={8}>
          <Typography.Text>{t('seats')}</Typography.Text>
          <InputNumber min={activeUsers} max={MAX_SEATS} value={seats} onChange={value => setSeats(value ?? activeUsers)} />
          <Typography.Text type="secondary">{t('seatsHelp', { count: activeUsers })}</Typography.Text>
        </Flex>
      </Flex>

      <Row gutter={[16, 16]} justify="center">
        {groups.map(renderCard)}
      </Row>
    </div>
  );
};

export default PerUserUpgradePlans;
