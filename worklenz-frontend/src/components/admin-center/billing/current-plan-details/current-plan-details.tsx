import React, { useState } from 'react';
import { adminCenterApiService } from '@/api/admin-center/admin-center.api.service';
import {
  evt_billing_pause_plan,
  evt_billing_resume_plan,
  evt_billing_add_more_seats,
} from '@/shared/worklenz-analytics-events';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import logger from '@/utils/errorLogger';
import { Button, Card, Flex, Modal, Space, Tooltip, Typography, Statistic, Select, Form, Row, Col } from 'antd/es';
import RedeemCodeDrawer from '../drawers/redeem-code-drawer/redeem-code-drawer';
import {
  fetchBillingInfo,
  toggleRedeemCodeDrawer,
  toggleUpgradeModal,
} from '@/features/admin-center/admin-center.slice';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useTranslation } from 'react-i18next';
import { WarningTwoTone, PlusOutlined } from '@ant-design/icons';
import { calculateTimeGap } from '@/utils/calculate-time-gap';
import { formatDate } from '@/utils/timeUtils';
import UpgradePlansLKR from '../drawers/upgrade-plans-lkr/upgrade-plans-lkr';
import UpgradePlans from '../drawers/upgrade-plans/upgrade-plans';
import { ISUBSCRIPTION_TYPE, SUBSCRIPTION_STATUS } from '@/shared/constants';
import { billingApiService } from '@/api/admin-center/billing.api.service';

const CurrentPlanDetails = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('admin-center/current-bill');
  const { trackMixpanelEvent } = useMixpanelTracking();

  const [pausingPlan, setPausingPlan] = useState(false);
  const [cancellingPlan, setCancellingPlan] = useState(false);
  const [addingSeats, setAddingSeats] = useState(false);
  const [isMoreSeatsModalVisible, setIsMoreSeatsModalVisible] = useState(false);
  const [selectedSeatCount, setSelectedSeatCount] = useState<number | string>(5);

  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const { loadingBillingInfo, billingInfo, freePlanSettings, isUpgradeModalOpen } = useAppSelector(
    state => state.adminCenterReducer
  );

  const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  type SeatOption = { label: string; value: number | string };
  const seatCountOptions: SeatOption[] = [1, 2, 3, 4, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90]
    .map(value => ({ label: value.toString(), value }));
  seatCountOptions.push({ label: '100+', value: '100+' });

  const handleSubscriptionAction = async (action: 'pause' | 'resume') => {
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
        }, 8000);
        return; // Exit function to prevent finally block from executing
      }
    } catch (error) {
      logger.error(`Error ${action}ing subscription`, error);
      setLoadingState(false); // Only set to false on error
    }
  };

  const handleAddMoreSeats = () => {
    setIsMoreSeatsModalVisible(true);
  };

  const handlePurchaseMoreSeats = async () => {
    if (selectedSeatCount.toString() === '100+' || !billingInfo?.total_seats) return;

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
  };

  const calculateRemainingSeats = () => {
    if (billingInfo?.total_seats && billingInfo?.total_used) {
      return billingInfo.total_seats - billingInfo.total_used;
    }
    return 0;
  };

  const checkSubscriptionStatus = (allowedStatuses: any[]) => {
    if (!billingInfo?.status || billingInfo.is_ltd_user) return false;
    return allowedStatuses.includes(billingInfo.status);
  };

  const shouldShowRedeemButton = () => {
    if (billingInfo?.trial_in_progress) return true;
    return billingInfo?.ltd_users ? billingInfo.ltd_users < 50 : false;
  };

  const showChangeButton = () => {
    return checkSubscriptionStatus([SUBSCRIPTION_STATUS.ACTIVE, SUBSCRIPTION_STATUS.PASTDUE]);
  };

  const showPausePlanButton = () => {
    return checkSubscriptionStatus([SUBSCRIPTION_STATUS.ACTIVE, SUBSCRIPTION_STATUS.PASTDUE]);
  };

  const showResumePlanButton = () => {
    return checkSubscriptionStatus([SUBSCRIPTION_STATUS.PAUSED]);
  };

  const shouldShowAddSeats = () => {
    if (!billingInfo) return false;
    return billingInfo.subscription_type === ISUBSCRIPTION_TYPE.PADDLE && 
           billingInfo.status === SUBSCRIPTION_STATUS.ACTIVE;
  };

  const renderExtra = () => {
    if (!billingInfo || billingInfo.is_custom) return null;

    return (
      <Space>
        {showPausePlanButton() && (
          <Button
            type="link"
            danger
            loading={pausingPlan}
            onClick={() => handleSubscriptionAction('pause')}
          >
            {t('pausePlan')}
          </Button>
        )}

        {showResumePlanButton() && (
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

        {showChangeButton() && (
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
  };

  const renderLtdDetails = () => {
    if (!billingInfo || billingInfo.is_custom) return null;
    return (
      <Flex vertical>
        <Typography.Text strong>{billingInfo.plan_name}</Typography.Text>
        <Typography.Text>{t('ltdUsers', { ltd_users: billingInfo.ltd_users })}</Typography.Text>
      </Flex>
    );
  };

  const renderTrialDetails = () => {
    const checkIfTrialExpired = () => {
      if (!billingInfo?.trial_expire_date) return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Set to start of day for comparison
      const trialExpireDate = new Date(billingInfo.trial_expire_date);
      trialExpireDate.setHours(0, 0, 0, 0); // Set to start of day for comparison
      return today > trialExpireDate;
    };

    const getExpirationMessage = (expireDate: string) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Set to start of day for comparison
      
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const expDate = new Date(expireDate);
      expDate.setHours(0, 0, 0, 0); // Set to start of day for comparison
      
      if (expDate.getTime() === today.getTime()) {
        return t('expirestoday', 'today');
      } else if (expDate.getTime() === tomorrow.getTime()) {
        return t('expirestomorrow', 'tomorrow');
      } else if (expDate < today) {
        const diffTime = Math.abs(today.getTime() - expDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return t('expiredDaysAgo', '{{days}} days ago', { days: diffDays });
      } else {
        return calculateTimeGap(expireDate);
      }
    };

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
                  trial_expire_string: getExpirationMessage(trialExpireDate)
                })
              : t('trialInProgress', {
                  trial_expire_string: getExpirationMessage(trialExpireDate)
                })
            }
          </Typography.Text>
        </Tooltip>
      </Flex>
    );
  };

  const renderFreePlan = () => (
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
  );

  const renderPaddleSubscriptionInfo = () => {
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
        
        {shouldShowAddSeats() && billingInfo?.total_seats && (
          <div style={{ marginTop: '16px' }}>
            <Row gutter={16} align="middle">
              <Col span={6}>
                <Statistic 
                  title={t('totalSeats')} 
                  value={billingInfo.total_seats} 
                  valueStyle={{ fontSize: '24px', fontWeight: 'bold' }}
                />
              </Col>
              <Col span={8}>
                <Button 
                  type="primary" 
                  icon={<PlusOutlined />} 
                  onClick={handleAddMoreSeats}
                  style={{ backgroundColor: '#1890ff', borderColor: '#1890ff' }}
                >
                  {t('addMoreSeats')}
                </Button>
              </Col>
              <Col span={6}>
                <Statistic 
                  title={t('availableSeats')} 
                  value={calculateRemainingSeats()} 
                  valueStyle={{ fontSize: '24px', fontWeight: 'bold' }}
                />
              </Col>
            </Row>
          </div>
        )}
      </Flex>
    );
  };

  const renderCreditSubscriptionInfo = () => {
    return <Flex vertical>
      <Typography.Text strong>{t('creditPlan','Credit Plan')}</Typography.Text>
    </Flex>
  };

  const renderCustomSubscriptionInfo = () => {
    return <Flex vertical>
      <Typography.Text strong>{t('customPlan','Custom Plan')}</Typography.Text>
      <Typography.Text>{t('planValidTill','Your plan is valid till {{date}}',{date: billingInfo?.valid_till_date})}</Typography.Text>
    </Flex>
  };

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
          {billingInfo?.subscription_type === ISUBSCRIPTION_TYPE.LIFE_TIME_DEAL && renderLtdDetails()}
          {billingInfo?.subscription_type === ISUBSCRIPTION_TYPE.TRIAL && renderTrialDetails()}
          {billingInfo?.subscription_type === ISUBSCRIPTION_TYPE.FREE && renderFreePlan()}
          {billingInfo?.subscription_type === ISUBSCRIPTION_TYPE.PADDLE && renderPaddleSubscriptionInfo()}
          {billingInfo?.subscription_type === ISUBSCRIPTION_TYPE.CREDIT && renderCreditSubscriptionInfo()}
          {billingInfo?.subscription_type === ISUBSCRIPTION_TYPE.CUSTOM && renderCustomSubscriptionInfo()}
        </div>

        {shouldShowRedeemButton() && (
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
            <Typography.Paragraph style={{ fontSize: '16px', margin: '0 0 16px 0', fontWeight: 500 }}>
              {t('purchaseSeatsText','To continue, you\'ll need to purchase additional seats.')}
            </Typography.Paragraph>
            
            <Typography.Paragraph style={{ margin: '0 0 16px 0' }}>
              {t('currentSeatsText','You currently have {{seats}} seats available.',{seats: billingInfo?.total_seats})}
            </Typography.Paragraph>
            
            <Typography.Paragraph style={{ margin: '0 0 24px 0' }}>
              {t('selectSeatsText','Please select the number of additional seats to purchase.')}
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
              {selectedSeatCount.toString() !== '100+' ? (
                <Button 
                  type="primary" 
                  loading={addingSeats}
                  onClick={handlePurchaseMoreSeats}
                  style={{ 
                    minWidth: '100px', 
                    backgroundColor: '#1890ff',
                    borderColor: '#1890ff',
                    borderRadius: '2px'
                  }}
                >
                  {t('purchase','Purchase')}
                </Button>
              ) : (
                <Button 
                  type="primary" 
                  size="middle"
                >
                  {t('contactSales','Contact sales')}
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
