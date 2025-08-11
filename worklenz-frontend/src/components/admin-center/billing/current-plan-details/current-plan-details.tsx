import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { adminCenterApiService } from '@/api/admin-center/admin-center.api.service';
import {
  evt_billing_pause_plan,
  evt_billing_resume_plan,
  evt_billing_add_more_seats,
} from '@/shared/worklenz-analytics-events';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import logger from '@/utils/errorLogger';
import {
  Button,
  Card,
  Flex,
  Modal,
  Space,
  Tooltip,
  Typography,
  Statistic,
  Select,
  Row,
  Col,
} from '@/shared/antd-imports';
import RedeemCodeDrawer from '../drawers/redeem-code-drawer/redeem-code-drawer';
import {
  fetchBillingInfo,
  toggleRedeemCodeDrawer,
  toggleUpgradeModal,
} from '@/features/admin-center/admin-center.slice';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useTranslation } from 'react-i18next';
import { WarningTwoTone, PlusOutlined } from '@/shared/antd-imports';
import { calculateTimeGap } from '@/utils/calculate-time-gap';
import { formatDate } from '@/utils/timeUtils';
import UpgradePlansLKR from '../drawers/upgrade-plans-lkr/upgrade-plans-lkr';
import UpgradePlans from '../drawers/upgrade-plans/upgrade-plans';
import { ISUBSCRIPTION_TYPE, SUBSCRIPTION_STATUS } from '@/shared/constants';
import { billingApiService } from '@/api/admin-center/billing.api.service';

type SubscriptionAction = 'pause' | 'resume';
type SeatOption = { label: string; value: number | string };

const SEAT_COUNT_LIMIT = '100+';
const BILLING_DELAY_MS = 8000;
const LTD_USER_LIMIT = 50;
const BUTTON_STYLE = {
  backgroundColor: '#1890ff',
  borderColor: '#1890ff',
};
const STATISTIC_VALUE_STYLE = {
  fontSize: '24px',
  fontWeight: 'bold' as const,
};

const CurrentPlanDetails = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('admin-center/current-bill');
  const { trackMixpanelEvent } = useMixpanelTracking();

  const [pausingPlan, setPausingPlan] = useState(false);
  const [cancellingPlan, setCancellingPlan] = useState(false);
  const [addingSeats, setAddingSeats] = useState(false);
  const [isMoreSeatsModalVisible, setIsMoreSeatsModalVisible] = useState(false);
  const [selectedSeatCount, setSelectedSeatCount] = useState<number | string>(1);

  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const { loadingBillingInfo, billingInfo, freePlanSettings, isUpgradeModalOpen } = useAppSelector(
    state => state.adminCenterReducer
  );

  const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  const seatCountOptions: SeatOption[] = useMemo(() => {
    const options: SeatOption[] = [
      1, 2, 3, 4, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90,
    ].map(value => ({ label: value.toString(), value }));
    options.push({ label: SEAT_COUNT_LIMIT, value: SEAT_COUNT_LIMIT });
    return options;
  }, []);

  const handleSubscriptionAction = useCallback(async (action: SubscriptionAction) => {
    const isResume = action === 'resume';
    const setLoadingState = isResume ? setCancellingPlan : setPausingPlan;
    const apiMethod = isResume
      ? adminCenterApiService.resumeSubscription
      : adminCenterApiService.pauseSubscription;
    const eventType = isResume ? evt_billing_resume_plan : evt_billing_pause_plan;

    try {
      setLoadingState(true);
      const res = await apiMethod();
      if (res.done) {
        setTimeout(() => {
          setLoadingState(false);
          dispatch(fetchBillingInfo());
          trackMixpanelEvent(eventType);
        }, BILLING_DELAY_MS);
        return;
      }
    } catch (error) {
      logger.error(`Error ${action}ing subscription`, error);
      setLoadingState(false);
    }
  }, [dispatch, trackMixpanelEvent]);

  const handleAddMoreSeats = useCallback(() => {
    setIsMoreSeatsModalVisible(true);
  }, []);

  const handlePurchaseMoreSeats = useCallback(async () => {
    if (selectedSeatCount.toString() === SEAT_COUNT_LIMIT || !billingInfo?.total_seats) return;

    try {
      setAddingSeats(true);
      const totalSeats = Number(selectedSeatCount) + (billingInfo?.total_seats || 0);
      const res = await billingApiService.purchaseMoreSeats(totalSeats);
      if (res.done) {
        setIsMoreSeatsModalVisible(false);
        dispatch(fetchBillingInfo());
        trackMixpanelEvent(evt_billing_add_more_seats);
      }
    } catch (error) {
      logger.error('Error adding more seats', error);
    } finally {
      setAddingSeats(false);
    }
  }, [selectedSeatCount, billingInfo?.total_seats, dispatch, trackMixpanelEvent]);

  const calculateRemainingSeats = useMemo(() => {
    if (billingInfo?.total_seats && billingInfo?.total_used) {
      return billingInfo.total_seats - billingInfo.total_used;
    }
    return 0;
  }, [billingInfo?.total_seats, billingInfo?.total_used]);

  // Calculate intelligent default for seat selection based on current usage
  const getDefaultSeatCount = useMemo(() => {
    const currentUsed = billingInfo?.total_used || 0;
    const availableSeats = calculateRemainingSeats;
    
    // If only 1 user and no available seats, suggest 1 additional seat
    if (currentUsed === 1 && availableSeats === 0) {
      return 1;
    }
    
    // If they have some users but running low on seats, suggest enough for current users
    if (availableSeats < currentUsed && currentUsed > 0) {
      return Math.max(1, currentUsed - availableSeats);
    }
    
    // Default fallback
    return Math.max(1, Math.min(5, currentUsed || 1));
  }, [billingInfo?.total_used, calculateRemainingSeats]);

  // Update selected seat count when billing info changes
  useEffect(() => {
    setSelectedSeatCount(getDefaultSeatCount);
  }, [getDefaultSeatCount]);

  const checkSubscriptionStatus = useCallback((allowedStatuses: string[]) => {
    if (!billingInfo?.status || billingInfo.is_ltd_user) return false;
    return allowedStatuses.includes(billingInfo.status);
  }, [billingInfo?.status, billingInfo?.is_ltd_user]);

  const shouldShowRedeemButton = useMemo(() => {
    if (billingInfo?.trial_in_progress) return true;
    return billingInfo?.ltd_users ? billingInfo.ltd_users < LTD_USER_LIMIT : false;
  }, [billingInfo?.trial_in_progress, billingInfo?.ltd_users]);

  const showChangeButton = useMemo(() => {
    return checkSubscriptionStatus([SUBSCRIPTION_STATUS.ACTIVE, SUBSCRIPTION_STATUS.PASTDUE]);
  }, [checkSubscriptionStatus]);

  const showPausePlanButton = useMemo(() => {
    return checkSubscriptionStatus([SUBSCRIPTION_STATUS.ACTIVE, SUBSCRIPTION_STATUS.PASTDUE]);
  }, [checkSubscriptionStatus]);

  const showResumePlanButton = useMemo(() => {
    return checkSubscriptionStatus([SUBSCRIPTION_STATUS.PAUSED]);
  }, [checkSubscriptionStatus]);

  const shouldShowAddSeats = useMemo(() => {
    if (!billingInfo) return false;
    return (
      billingInfo.subscription_type === ISUBSCRIPTION_TYPE.PADDLE &&
      billingInfo.status === SUBSCRIPTION_STATUS.ACTIVE
    );
  }, [billingInfo]);

  const renderExtra = useCallback(() => {
    if (!billingInfo || billingInfo.is_custom) return null;

    return (
      <Space>
        {showPausePlanButton && (
          <Button
            type="link"
            danger
            loading={pausingPlan}
            onClick={() => handleSubscriptionAction('pause')}
          >
            {t('pausePlan')}
          </Button>
        )}

        {showResumePlanButton && (
          <Button
            type="primary"
            loading={cancellingPlan}
            onClick={() => handleSubscriptionAction('resume')}
          >
            {t('resumePlan')}
          </Button>
        )}

        {billingInfo.trial_in_progress && (
          <Button type="primary" onClick={() => dispatch(toggleUpgradeModal())}>
            {t('upgradePlan')}
          </Button>
        )}

        {showChangeButton && (
          <Button
            type="primary"
            loading={pausingPlan || cancellingPlan}
            onClick={() => dispatch(toggleUpgradeModal())}
          >
            {t('changePlan')}
          </Button>
        )}
      </Space>
    );
  }, [
    billingInfo,
    showPausePlanButton,
    showResumePlanButton,
    showChangeButton,
    pausingPlan,
    cancellingPlan,
    handleSubscriptionAction,
    dispatch,
    t,
  ]);

  const renderLtdDetails = useCallback(() => {
    if (!billingInfo || billingInfo.is_custom) return null;
    return (
      <Flex vertical>
        <Typography.Text strong>{billingInfo.plan_name}</Typography.Text>
        <Typography.Text>{t('ltdUsers', { ltd_users: billingInfo.ltd_users })}</Typography.Text>
      </Flex>
    );
  }, [billingInfo, t]);

  const checkIfTrialExpired = useCallback(() => {
    if (!billingInfo?.trial_expire_date) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const trialExpireDate = new Date(billingInfo.trial_expire_date);
    trialExpireDate.setHours(0, 0, 0, 0);
    return today > trialExpireDate;
  }, [billingInfo?.trial_expire_date]);

  const getExpirationMessage = useCallback((expireDate: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const expDate = new Date(expireDate);
    expDate.setHours(0, 0, 0, 0);

    if (expDate.getTime() === today.getTime()) {
      return t('expirestoday', 'today');
    } else if (expDate.getTime() === tomorrow.getTime()) {
      return t('expirestomorrow', 'tomorrow');
    } else if (expDate < today) {
      const diffTime = Math.abs(today.getTime() - expDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        return t('expiredDayAgo', '{{days}} day ago', { days: diffDays });
      }
      return t('expiredDaysAgo', '{{days}} days ago', { days: diffDays });
    } else {
      return calculateTimeGap(expireDate);
    }
  }, [t]);

  const renderTrialDetails = useCallback(() => {
    const isExpired = checkIfTrialExpired();
    const trialExpireDate = billingInfo?.trial_expire_date || '';

    return (
      <Flex vertical>
        <Typography.Text strong>
          {t('trialPlan')}
          {isExpired && <WarningTwoTone twoToneColor="#faad14" style={{ marginLeft: 8 }} />}
        </Typography.Text>
        <Tooltip title={formatDate(new Date(trialExpireDate))}>
          <Typography.Text>
            {isExpired
              ? t('trialExpired', {
                  trial_expire_string: getExpirationMessage(trialExpireDate),
                })
              : t('trialInProgress', {
                  trial_expire_string: getExpirationMessage(trialExpireDate),
                })}
          </Typography.Text>
        </Tooltip>
      </Flex>
    );
  }, [billingInfo?.trial_expire_date, checkIfTrialExpired, getExpirationMessage, t]);

  const renderFreePlan = useCallback(() => (
    <Flex vertical>
      <Typography.Text strong>{t('freePlan')}</Typography.Text>
      <Typography.Text>
        <br />-{' '}
        {freePlanSettings?.team_member_limit === 0
          ? t('unlimitedTeamMembers')
          : `${freePlanSettings?.team_member_limit} ${t('teamMembers')}`}
        <br />- {freePlanSettings?.projects_limit} {t('projects')}
        <br />- {freePlanSettings?.free_tier_storage} MB {t('storage')}
      </Typography.Text>
    </Flex>
  ), [freePlanSettings, t]);

  const renderPaddleSubscriptionInfo = useCallback(() => {
    return (
      <Flex vertical>
        <Typography.Text strong>{billingInfo?.plan_name}</Typography.Text>
        <Flex>
          <Typography.Text>{billingInfo?.default_currency}</Typography.Text>&nbsp;
          <Typography.Text>
            {billingInfo?.billing_type === 'year'
              ? billingInfo.unit_price_per_month
              : billingInfo?.unit_price}
            &nbsp;{t('perMonthPerUser')}
          </Typography.Text>
        </Flex>

        {shouldShowAddSeats && billingInfo?.total_seats && (
          <div style={{ marginTop: '16px' }}>
            <Row gutter={16} align="middle">
              <Col span={6}>
                <Statistic
                  title={t('totalSeats') as string}
                  value={billingInfo.total_seats}
                  valueStyle={STATISTIC_VALUE_STYLE}
                />
              </Col>
              <Col span={8}>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={handleAddMoreSeats}
                  style={BUTTON_STYLE}
                >
                  {t('addMoreSeats')}
                </Button>
              </Col>
              <Col span={6}>
                <Statistic
                  title={t('availableSeats') as string}
                  value={calculateRemainingSeats}
                  valueStyle={STATISTIC_VALUE_STYLE}
                />
              </Col>
            </Row>
          </div>
        )}
      </Flex>
    );
  }, [billingInfo, shouldShowAddSeats, handleAddMoreSeats, calculateRemainingSeats, t]);

  const renderCreditSubscriptionInfo = useCallback(() => {
    return (
      <Flex vertical>
        <Typography.Text strong>{t('creditPlan', 'Credit Plan')}</Typography.Text>
      </Flex>
    );
  }, [t]);

  const renderCustomSubscriptionInfo = useCallback(() => {
    return (
      <Flex vertical>
        <Typography.Text strong>{t('customPlan', 'Custom Plan')}</Typography.Text>
        <Typography.Text>
          {t('planValidTill', 'Your plan is valid till {{date}}', {
            date: billingInfo?.valid_till_date,
          })}
        </Typography.Text>
      </Flex>
    );
  }, [billingInfo?.valid_till_date, t]);

  const renderSubscriptionContent = useCallback(() => {
    if (!billingInfo) return null;

    switch (billingInfo.subscription_type) {
      case ISUBSCRIPTION_TYPE.LIFE_TIME_DEAL:
        return renderLtdDetails();
      case ISUBSCRIPTION_TYPE.TRIAL:
        return renderTrialDetails();
      case ISUBSCRIPTION_TYPE.FREE:
        return renderFreePlan();
      case ISUBSCRIPTION_TYPE.PADDLE:
        return renderPaddleSubscriptionInfo();
      case ISUBSCRIPTION_TYPE.CREDIT:
        return renderCreditSubscriptionInfo();
      case ISUBSCRIPTION_TYPE.CUSTOM:
        return renderCustomSubscriptionInfo();
      default:
        return null;
    }
  }, [
    billingInfo,
    renderLtdDetails,
    renderTrialDetails,
    renderFreePlan,
    renderPaddleSubscriptionInfo,
    renderCreditSubscriptionInfo,
    renderCustomSubscriptionInfo,
  ]);

  return (
    <Card
      style={{ height: '100%' }}
      title={
        <Typography.Text
          style={{
            color: themeMode === 'dark' ? '#ffffffd9' : '#000000d9',
            fontWeight: 500,
            fontSize: '16px',
          }}
        >
          {t('currentPlanDetails')}
        </Typography.Text>
      }
      loading={loadingBillingInfo}
      extra={renderExtra()}
    >
      <Flex vertical>
        <div style={{ marginBottom: '14px' }}>
          {renderSubscriptionContent()}
        </div>

        {shouldShowRedeemButton && (
          <>
            <Button
              type="link"
              style={{ margin: 0, padding: 0, width: '90px' }}
              onClick={() => dispatch(toggleRedeemCodeDrawer())}
            >
              {t('redeemCode')}
            </Button>
            <RedeemCodeDrawer />
          </>
        )}
        <Modal
          open={isUpgradeModalOpen}
          onCancel={() => dispatch(toggleUpgradeModal())}
          width={1000}
          centered
          okButtonProps={{ hidden: true }}
          cancelButtonProps={{ hidden: true }}
        >
          {browserTimeZone === 'Asia/Colombo' ? <UpgradePlansLKR /> : <UpgradePlans />}
        </Modal>

        <Modal
          title={t('addMoreSeats')}
          open={isMoreSeatsModalVisible}
          onCancel={() => setIsMoreSeatsModalVisible(false)}
          footer={null}
          width={500}
          centered
        >
          <Flex vertical gap="middle" style={{ marginTop: '8px' }}>
            <Typography.Paragraph
              style={{ fontSize: '16px', margin: '0 0 16px 0', fontWeight: 500 }}
            >
              {billingInfo?.total_used === 1 
                ? t('purchaseSeatsTextSingle', "Add more seats to invite team members to your workspace.")
                : t('purchaseSeatsText', "To continue, you'll need to purchase additional seats.")
              }
            </Typography.Paragraph>

            <Typography.Paragraph style={{ margin: '0 0 16px 0' }}>
              {t('currentSeatsText', 'You currently have {{seats}} seats available.', {
                seats: billingInfo?.total_seats,
              })}
              {billingInfo?.total_used === 1 && (
                <span style={{ color: '#666', marginLeft: '8px' }}>
                  ({t('singleUserNote', 'Currently used by 1 team member')})
                </span>
              )}
            </Typography.Paragraph>

            <Typography.Paragraph style={{ margin: '0 0 24px 0' }}>
              {billingInfo?.total_used === 1
                ? t('selectSeatsTextSingle', 'Select how many additional seats you need for new team members.')
                : t('selectSeatsText', 'Please select the number of additional seats to purchase.')
              }
            </Typography.Paragraph>

            <div style={{ marginBottom: '24px' }}>
              <span style={{ color: '#ff4d4f', marginRight: '4px' }}>*</span>
              <span style={{ marginRight: '8px' }}>Seats:</span>
              <Select
                value={selectedSeatCount}
                onChange={setSelectedSeatCount}
                options={seatCountOptions}
                style={{ width: '300px' }}
              />

            </div>

            <Flex justify="end">
              {selectedSeatCount.toString() !== SEAT_COUNT_LIMIT ? (
                <Button
                  type="primary"
                  loading={addingSeats}
                  onClick={handlePurchaseMoreSeats}
                  style={{
                    minWidth: '100px',
                    ...BUTTON_STYLE,
                    borderRadius: '2px',
                  }}
                >
                  {t('purchase', 'Purchase')}
                </Button>
              ) : (
                <Button type="primary" size="middle">
                  {t('contactSales', 'Contact sales')}
                </Button>
              )}
            </Flex>
          </Flex>
        </Modal>
      </Flex>
    </Card>
  );
};

export default CurrentPlanDetails;
