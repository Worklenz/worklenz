import React, { useEffect, useMemo, useState } from 'react';
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
  Tooltip,
  Typography,
  message,
} from '@/shared/antd-imports';
import { CheckCircleFilled, LockOutlined, MinusOutlined, PlusOutlined } from '@ant-design/icons';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { fetchBillingInfo, toggleUpgradeModal } from '@/features/admin-center/admin-center.slice';
import { setUser } from '@/features/user/userSlice';
import { setSession } from '@/utils/session-helper';
import { useAuthService } from '@/hooks/useAuth';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { MixpanelBillingEvents } from '@/types/mixpanel-events.types';
import { authApiService } from '@/api/auth/auth.api.service';
import { adminCenterApiService } from '@/api/admin-center/admin-center.api.service';
import {
  billingApiService,
  type IPerUserPlan,
  type IPerUserPlansResponse,
} from '@/api/admin-center/billing.api.service';
import {
  ILegacyCheckoutEvent,
  isPaddleBillingCheckout,
  openPaddleBillingCheckout,
} from '@/utils/paddle-billing-checkout';
import logger from '@/utils/errorLogger';
import './per-user-upgrade-plans.css';
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
// Extra refreshes before the modal closes, to pick up the webhook-written subscription sooner.
const POST_CHECKOUT_REFRESH_STEPS_MS = [3000, 6000];
const MAX_SEATS = 10000;
const FREE_USER_LIMIT = 5;
const MOST_POPULAR_KEY = 'pro';

interface PerUserUpgradePlansProps {
  data: IPerUserPlansResponse;
}

interface SeatStepperProps {
  value: number;
  min: number;
  labelId: string;
  onChange: (value: number) => void;
}

/** Compact "- 5 +" control. Values below the minimum are not accepted. */
const SeatStepper: React.FC<SeatStepperProps> = ({ value, min, labelId, onChange }) => {
  const { t } = useTranslation('per-user-pricing');
  const clamp = (next: number) => Math.min(MAX_SEATS, Math.max(min, Math.floor(next) || min));
  return (
    <Space.Compact>
      <Button
        aria-label={t('decreaseUsers')}
        icon={<MinusOutlined />}
        disabled={value <= min}
        onClick={() => onChange(clamp(value - 1))}
      />
      <InputNumber
        className="seat-stepper-input"
        controls={false}
        min={min}
        max={MAX_SEATS}
        precision={0}
        value={value}
        aria-labelledby={labelId}
        style={{ width: 72 }}
        onChange={next => typeof next === 'number' && onChange(clamp(next))}
        onBlur={() => onChange(clamp(value))}
      />
      <Button
        aria-label={t('increaseUsers')}
        icon={<PlusOutlined />}
        disabled={value >= MAX_SEATS}
        onClick={() => onChange(clamp(value + 1))}
      />
    </Space.Compact>
  );
};

/**
 * Upgrade modal content for per-user plans sold on Paddle Billing. Shown instead of the legacy
 * plan cards once those plans are activated (see UpgradePlansSwitch).
 */
const PerUserUpgradePlans: React.FC<PerUserUpgradePlansProps> = ({ data }) => {
  const { t } = useTranslation('per-user-pricing');
  const dispatch = useAppDispatch();
  const authService = useAuthService();
  const { trackMixpanelEvent } = useMixpanelTracking();
  const currentSession = authService.getCurrentSession();
  const billingInfo = useAppSelector(state => state.adminCenterReducer.billingInfo);

  const groups = useMemo(() => groupPlans(data.plans), [data.plans]);
  const activeUsers = Math.max(1, billingInfo?.total_used ?? 1);

  const maxAnnualSavings = Math.max(0, ...groups.map(group => annualSavingsPercent(group) ?? 0));

  const [frequency, setFrequency] = useState<PricingFrequency>('monthly');
  // Seats already paid for on a Paddle Billing subscription; the stepper starts there.
  const purchasedSeats = data.has_billing_subscription ? billingInfo?.total_seats || 0 : 0;
  const [seats, setSeats] = useState<number>(Math.max(activeUsers, purchasedSeats));
  // Billing info can arrive after this mounts: never leave the seat count below the team's usage.
  useEffect(() => {
    setSeats(current => Math.max(current, activeUsers));
  }, [activeUsers]);
  // Once the purchased seats are known, start from them (until the user edits the count).
  const [seatsEdited, setSeatsEdited] = useState(false);
  useEffect(() => {
    if (!seatsEdited && purchasedSeats) setSeats(Math.max(activeUsers, purchasedSeats));
  }, [purchasedSeats, activeUsers, seatsEdited]);
  const [expansionSeats, setExpansionSeats] = useState<number>(1);
  const [busyPlanId, setBusyPlanId] = useState<string | null>(null);
  const [switchingToFree, setSwitchingToFree] = useState(false);

  const isFreeUser = currentSession?.subscription_type === 'FREE';
  const exceedsFreeLimit = activeUsers > FREE_USER_LIMIT;
  // AppSumo customers keep their codes' plan, so a Free downgrade is not offered to them.
  const showFreeCard = !data.has_ltd_codes;
  // The team's current plan, in either billing period, gets the highlight; "Most popular" only
  // takes it when no listed plan is the current one.
  const currentGroupKey =
    groups.find(
      group =>
        !!billingInfo?.plan_id &&
        (group.monthly?.id === billingInfo.plan_id || group.annual?.id === billingInfo.plan_id)
    )?.key ?? null;
  const hasCurrentCard = currentGroupKey !== null || isFreeUser;
  const cardCount = groups.length;
  const cardColumns = cardCount >= 4 ? 6 : cardCount === 3 ? 8 : 12;

  const trackingProps = (plan?: IPerUserPlan, seatCount?: number) => ({
    pricing_model: 'per_user',
    current_plan: billingInfo?.plan_name,
    team_size: activeUsers,
    billing_frequency: frequency,
    ...(plan ? { plan_key: plan.plan_key, plan_id: plan.id, seats: seatCount } : {}),
  });

  useEffect(() => {
    trackMixpanelEvent(MixpanelBillingEvents.PRICING_MODAL_OPENED, { pricing_model: 'per_user' });
    // Once per time the modal content is shown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finishCheckout = (plan: IPerUserPlan, seatCount: number) => {
    trackMixpanelEvent(MixpanelBillingEvents.CHECKOUT_COMPLETED, trackingProps(plan, seatCount));
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
    // Refresh a few times on the way: the new seat count only lands once the webhook is processed.
    POST_CHECKOUT_REFRESH_STEPS_MS.forEach(delay =>
      setTimeout(() => dispatch(fetchBillingInfo()), delay)
    );
    setTimeout(() => {
      dispatch(fetchBillingInfo());
      dispatch(toggleUpgradeModal());
      setBusyPlanId(null);
    }, POST_CHECKOUT_REFRESH_DELAY_MS);
  };

  const handleCheckoutEvent =
    (plan: IPerUserPlan, seatCount: number) => (event: ILegacyCheckoutEvent) => {
      switch (event.event) {
        case 'Checkout.Loaded':
          setBusyPlanId(null);
          break;
        case 'Checkout.Complete':
          finishCheckout(plan, seatCount);
          break;
        case 'Checkout.Close':
          setBusyPlanId(null);
          trackMixpanelEvent(
            MixpanelBillingEvents.CHECKOUT_ABANDONED,
            trackingProps(plan, seatCount)
          );
          break;
        case 'Checkout.Error':
          setBusyPlanId(null);
          message.error(t('messages.checkoutError', { message: event.error?.message ?? '' }));
          trackMixpanelEvent(MixpanelBillingEvents.CHECKOUT_FAILED, {
            ...trackingProps(plan, seatCount),
            error: event.error?.message,
          });
          logger.error('Paddle Billing checkout error', event.error);
          break;
      }
    };

  const startCheckout = async (plan: IPerUserPlan, seatCount: number, replaceLegacy: boolean) => {
    setBusyPlanId(plan.id);
    trackMixpanelEvent(MixpanelBillingEvents.CHECKOUT_INITIATED, trackingProps(plan, seatCount));
    try {
      const response = await billingApiService.upgradeToPaidPlan(
        plan.id,
        'per_user',
        seatCount,
        replaceLegacy
      );
      if (!response.done || !isPaddleBillingCheckout(response.body)) {
        throw new Error(response.message || 'Unexpected checkout response');
      }
      await openPaddleBillingCheckout(response.body, handleCheckoutEvent(plan, seatCount));
    } catch (error) {
      setBusyPlanId(null);
      message.error(t('messages.error'));
      trackMixpanelEvent(MixpanelBillingEvents.CHECKOUT_FAILED, trackingProps(plan, seatCount));
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

  const updateSeats = async (plan: IPerUserPlan, seatCount: number) => {
    setBusyPlanId(plan.id);
    try {
      const response = await billingApiService.purchaseMoreSeats(seatCount);
      if (!response.done) throw new Error(response.message || 'Seat update failed');
      trackMixpanelEvent(MixpanelBillingEvents.PLAN_SELECTED, {
        ...trackingProps(plan, seatCount),
        change: 'seats',
      });
      message.success(t('messages.seatsUpdated'));
      // The new seat count lands once the webhook is processed.
      dispatch(fetchBillingInfo());
      POST_CHECKOUT_REFRESH_STEPS_MS.forEach(delay =>
        setTimeout(() => dispatch(fetchBillingInfo()), delay)
      );
    } catch (error) {
      message.error(t('messages.error'));
      logger.error('Failed to update seats', error);
    } finally {
      setBusyPlanId(null);
    }
  };

  const switchToFree = async () => {
    const teamId = currentSession?.team_id;
    if (!teamId) return;
    setSwitchingToFree(true);
    try {
      const response = await adminCenterApiService.switchToFreePlan(teamId);
      if (!response.done) throw new Error(response.message || 'Switch to Free failed');
      trackMixpanelEvent(MixpanelBillingEvents.FREE_PLAN_SWITCH_COMPLETED, trackingProps());
      dispatch(fetchBillingInfo());
      dispatch(toggleUpgradeModal());
      const verified = await authApiService.verify();
      if (verified.authenticated) {
        setSession(verified.user);
        dispatch(setUser(verified.user));
        window.location.href = '/worklenz/admin-center/billing';
      }
    } catch (error) {
      message.error(t('messages.error'));
      logger.error('Failed to switch to the Free plan', error);
    } finally {
      setSwitchingToFree(false);
    }
  };

  const confirmSwitchToFree = () => {
    Modal.confirm({
      title: t('freeConfirm.title'),
      content: t('freeConfirm.content'),
      okText: t('freeConfirm.ok'),
      cancelText: t('freeConfirm.cancel'),
      zIndex: 1100, // above the upgrade modal (1050)
      onOk: switchToFree,
    });
  };

  const handleSelect = (plan: IPerUserPlan, seatCount: number) => {
    trackMixpanelEvent(MixpanelBillingEvents.PLAN_SELECTED, trackingProps(plan, seatCount));
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
    // Exact plan (this billing period): disables the button. Same tier in the other period only
    // marks the card, so switching billing period stays possible.
    const isCurrent = !!plan && billingInfo?.plan_id === plan.id;
    const isCurrentTier = group.key === currentGroupKey;
    const isPopular = group.key === MOST_POPULAR_KEY;
    // Same plan, different seat count: the button updates seats instead of being disabled.
    const seatsChanged =
      isCurrent && !isExpansion && purchasedSeats > 0 && cardSeats !== purchasedSeats;
    const isHighlighted = isCurrentTier || (isPopular && !hasCurrentCard);
    const nameId = `per-user-plan-${group.key}`;

    return (
      <Col xs={24} md={12} xl={cardColumns} key={group.key}>
        <Card
          role="group"
          aria-labelledby={nameId}
          style={{
            height: '100%',
            borderColor: isHighlighted ? '#1890ff' : undefined,
            boxShadow: isHighlighted ? '0 4px 16px rgba(24, 144, 255, 0.18)' : undefined,
          }}
          styles={{ body: { height: '100%' } }}
        >
          <Flex vertical gap={12} style={{ height: '100%' }}>
            <Flex vertical gap={8}>
              <Flex justify="space-between" align="center">
                <Typography.Title level={3} id={nameId} style={{ margin: 0 }}>
                  {t(`plans.${planCopy}.name`)}
                </Typography.Title>
                {isCurrentTier ? (
                  <Tag color="green">{t('currentPlan')}</Tag>
                ) : (
                  isPopular && <Tag color="blue">{t('mostPopular')}</Tag>
                )}
              </Flex>
              <Typography.Text type="secondary" style={{ minHeight: 22 }}>
                {t(`plans.${planCopy}.description`)}
              </Typography.Text>

              {plan ? (
                <>
                  <Flex align="baseline" gap={6} wrap>
                    <Typography.Text style={{ fontSize: 36, fontWeight: 600 }}>
                      {formatUsd(perUserMonthlyPrice(plan))}
                    </Typography.Text>
                    <Typography.Text type="secondary">{t('perUserPerMonth')}</Typography.Text>
                    {plan.billing_type === 'year' && group.monthly && (
                      <Typography.Text type="secondary" delete>
                        {formatUsd(group.monthly.price)}
                      </Typography.Text>
                    )}
                  </Flex>
                  {/* One fixed slot for both billing periods, so the cards don't jump when toggling */}
                  <div style={{ minHeight: 24 }}>
                    {plan.billing_type === 'year' ? (
                      <Typography.Text type="secondary">
                        {t('billedAnnually', { total: formatUsd(plan.price) })}
                      </Typography.Text>
                    ) : (
                      savings && (
                        <Tag
                          color="blue"
                          role="button"
                          tabIndex={0}
                          style={{ width: 'fit-content', margin: 0, cursor: 'pointer' }}
                          onClick={() => setFrequency('annual')}
                          onKeyDown={event => event.key === 'Enter' && setFrequency('annual')}
                        >
                          {t('saveUpTo', { percent: savings })}
                        </Tag>
                      )
                    )}
                  </div>
                </>
              ) : (
                <Typography.Text type="secondary">{t('unavailable')}</Typography.Text>
              )}

              {isExpansion && (
                <Flex align="center" gap={8}>
                  <Typography.Text id={`${nameId}-seats`}>{t('seats')}</Typography.Text>
                  <SeatStepper
                    value={expansionSeats}
                    min={1}
                    labelId={`${nameId}-seats`}
                    onChange={setExpansionSeats}
                  />
                </Flex>
              )}

              <Flex vertical gap={12}>
                {/* Reserved even when empty, so the buttons line up across cards */}
                <Typography.Text strong style={{ fontSize: 15, minHeight: 22 }}>
                  {plan &&
                    cardSeats > 1 &&
                    t(plan.billing_type === 'year' ? 'totalAnnual' : 'totalMonthly', {
                      total: formatUsd(periodTotal(plan, cardSeats)),
                      count: cardSeats,
                    })}
                </Typography.Text>
                <Button
                  type={
                    (isHighlighted && !isCurrent) || seatsChanged || isExpansion
                      ? 'primary'
                      : 'default'
                  }
                  size="large"
                  block
                  disabled={!plan || (isCurrent && !seatsChanged)}
                  loading={!!plan && busyPlanId === plan.id}
                  onClick={() =>
                    plan &&
                    (seatsChanged ? updateSeats(plan, cardSeats) : handleSelect(plan, cardSeats))
                  }
                >
                  {seatsChanged
                    ? t('updateSeats')
                    : isCurrent
                      ? t('currentPlan')
                      : data.has_billing_subscription
                        ? t('switch')
                        : t('select')}
                </Button>
              </Flex>
              <Space direction="vertical" size={6} style={{ marginTop: 4 }}>
                {Array.isArray(features) &&
                  features.map(feature => (
                    <Typography.Text key={feature}>
                      <CheckCircleFilled style={{ color: '#52c41a', marginRight: 8 }} />
                      {feature}
                    </Typography.Text>
                  ))}
              </Space>
            </Flex>
          </Flex>
        </Card>
      </Col>
    );
  };

  // Free is a downgrade path, not a purchase option, so it sits below the paid cards as a slim
  // strip instead of competing with them.
  const renderFreeBanner = () => {
    const features = t('plans.free.features', { returnObjects: true }) as string[];
    return (
      <Card role="group" aria-labelledby="per-user-plan-free" size="small" style={{ marginTop: 16 }}>
        <Flex justify="space-between" align="center" gap={16} wrap>
          <Flex vertical gap={2}>
            <Flex align="center" gap={8}>
              <Typography.Text strong id="per-user-plan-free">
                {t('plans.free.name')}
              </Typography.Text>
              <Typography.Text type="secondary">
                {formatUsd(0)} {t('freeForever')}
              </Typography.Text>
              {isFreeUser && <Tag color="green">{t('currentPlan')}</Tag>}
            </Flex>
            <Typography.Text type="secondary">
              {t('plans.free.description')}
              {Array.isArray(features) && ` ${features.join(' · ')}`}
            </Typography.Text>
          </Flex>
          <Tooltip
            title={
              exceedsFreeLimit && !isFreeUser
                ? t('freeLimitHint', { count: FREE_USER_LIMIT })
                : undefined
            }
          >
            <Button
              disabled={isFreeUser || exceedsFreeLimit}
              loading={switchingToFree}
              onClick={confirmSwitchToFree}
            >
              {isFreeUser ? t('currentPlan') : t('switchToFree')}
            </Button>
          </Tooltip>
        </Flex>
      </Card>
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
        <Flex align="center" gap={8}>
          <Segmented<PricingFrequency>
            aria-label={t('billingPeriod')}
            value={frequency}
            onChange={next => {
              setFrequency(next);
              trackMixpanelEvent(MixpanelBillingEvents.BILLING_FREQUENCY_CHANGED, {
                ...trackingProps(),
                billing_frequency: next,
              });
            }}
            options={[
              { label: t('monthly'), value: 'monthly' },
              { label: t('annual'), value: 'annual' },
            ]}
          />
          {maxAnnualSavings > 0 && frequency === 'monthly' && (
            <Tag color="green" style={{ margin: 0 }}>
              {t('annualBadge', { percent: maxAnnualSavings })}
            </Tag>
          )}
        </Flex>
        <Flex align="center" gap={8} wrap>
          <Typography.Text id="per-user-seats-label">{t('seats')}</Typography.Text>
          <SeatStepper
            value={seats}
            min={activeUsers}
            labelId="per-user-seats-label"
            onChange={next => {
              setSeatsEdited(true);
              setSeats(next);
            }}
          />
          <Typography.Text type="secondary">
            {t('seatsHelp', { count: activeUsers })}
          </Typography.Text>
        </Flex>
      </Flex>

      <div>
        <Row gutter={[16, 16]} justify="center">
          {groups.map(renderCard)}
        </Row>

        {showFreeCard && renderFreeBanner()}
      </div>

      <Flex vertical align="center" gap={4} style={{ marginTop: 16 }}>
        <Typography.Text style={{ fontSize: 13 }}>
          <LockOutlined style={{ marginRight: 6 }} />
          {t('trustLine')}
        </Typography.Text>
      </Flex>
    </div>
  );
};

export default PerUserUpgradePlans;
