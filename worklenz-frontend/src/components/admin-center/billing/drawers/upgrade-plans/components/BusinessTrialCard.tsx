import { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Typography,
  Space,
  Tag,
  Spin,
  Badge,
  Statistic,
  Row,
  Col,
  message,
} from '@/shared/antd-imports';
import { CheckCircleOutlined, CrownOutlined } from '@ant-design/icons';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  isOnBusinessTrial,
  getPlanTrialDaysRemaining,
  isOnPlanTrial,
} from '@/utils/subscription-utils';
import { useAuthService } from '@/hooks/useAuth';
import { PlanTrialApiService, IPlanTrialInfo } from '@/api/admin-center/plan-trial.api.service';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import {
  MixpanelBillingEvents,
  BusinessTrialEventProps,
  BusinessTrialStartEventProps,
} from '@/types/mixpanel-events.types';
import { ISUBSCRIPTION_TYPE } from '@/shared/constants';
import './BusinessTrialCard.css';

const { Title, Text, Paragraph } = Typography;
const { Countdown } = Statistic;

interface BusinessTrialCardProps {
  onTrialStarted?: () => void;
  disabled?: boolean;
}

export const BusinessTrialCard = ({ onTrialStarted, disabled }: BusinessTrialCardProps) => {
  const dispatch = useAppDispatch();
  const currentSession = useAuthService().getCurrentSession();
  const { trackMixpanelEvent } = useMixpanelTracking();
  const [loading, setLoading] = useState(false);
  const [eligibilityChecked, setEligibilityChecked] = useState(false);
  const [canStartTrial, setCanStartTrial] = useState(false);
  const [trialInfo, setTrialInfo] = useState<IPlanTrialInfo | null>(null);

  // Check if user is already on Business trial
  const isCurrentlyOnTrial = isOnBusinessTrial(currentSession);
  const trialDaysRemaining = getPlanTrialDaysRemaining(currentSession);
  const hasAnyPlanTrial = isOnPlanTrial(currentSession);

  // Helper function to create base trial properties
  const getBaseTrialProperties = (): BusinessTrialEventProps => ({
    user_type: isCurrentlyOnTrial
      ? 'trial'
      : currentSession?.subscription_type === ISUBSCRIPTION_TYPE.PADDLE
        ? 'paid'
        : 'free',
    current_plan: currentSession?.plan_name,
    trial_days_remaining: trialDaysRemaining,
    team_size: currentSession?.team_member_count,
    subscription_status: currentSession?.subscription_type,
    trial_type: 'business_plan' as const,
    trial_duration_days: 7,
    source_component: 'BusinessTrialCard',
    display_location: 'upgrade_plans_modal',
  });

  // Check trial eligibility on mount
  useEffect(() => {
    checkTrialEligibility();
  }, []);

  // Track when active trial status is viewed
  useEffect(() => {
    if (isCurrentlyOnTrial) {
      trackMixpanelEvent(MixpanelBillingEvents.BUSINESS_TRIAL_STATUS_CHECKED, {
        ...getBaseTrialProperties(),
        trial_active: true,
        days_elapsed: 7 - trialDaysRemaining,
        check_source: 'upgrade_modal_active_trial',
      });
    }
  }, [isCurrentlyOnTrial]);

  const checkTrialEligibility = async () => {
    try {
      const response = await PlanTrialApiService.checkBusinessTrialEligibility();
      if (response.done) {
        const canStart = response.body?.can_start_trial || false;
        setTrialInfo(response.body);
        setCanStartTrial(canStart);
        setEligibilityChecked(true);

        // Track eligibility check
        trackMixpanelEvent(MixpanelBillingEvents.BUSINESS_TRIAL_ELIGIBLE, {
          ...getBaseTrialProperties(),
          trial_active: false,
          check_source: 'upgrade_modal_load',
        });

        if (canStart) {
          // Track that offer is being viewed in upgrade modal
          trackMixpanelEvent(
            MixpanelBillingEvents.BUSINESS_TRIAL_OFFER_VIEWED,
            getBaseTrialProperties()
          );
        }
      }
    } catch (error) {
      console.error('Failed to check trial eligibility:', error);
      setEligibilityChecked(true);
    }
  };

  const startTrial = async () => {
    setLoading(true);

    // Track trial start attempt
    const startEventProps: BusinessTrialStartEventProps = {
      ...getBaseTrialProperties(),
      start_method: 'upgrade_button',
      original_plan: currentSession?.plan_name as any,
    };

    try {
      const response = await PlanTrialApiService.startBusinessTrial();
      if (response.done) {
        // Track successful trial start
        trackMixpanelEvent(MixpanelBillingEvents.BUSINESS_TRIAL_STARTED, startEventProps);

        message.success(response.body?.message || 'Business trial started successfully!');

        // Refresh user session to get updated trial status
        window.location.reload();

        if (onTrialStarted) {
          onTrialStarted();
        }
      } else {
        message.error(response.message || 'Failed to start trial');
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Failed to start trial');
    } finally {
      setLoading(false);
    }
  };

  // If user is currently on Business trial
  if (isCurrentlyOnTrial) {
    const endDate = currentSession?.plan_trial_end_date
      ? new Date(currentSession.plan_trial_end_date)
      : new Date();

    return (
      <Card
        style={{
          marginBottom: 16,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          border: 'none',
          position: 'relative',
          overflow: 'hidden',
        }}
        styles={{ body: { padding: 24 } }}
      >
        {/* Animated background pattern */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            opacity: 0.1,
            background:
              'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,.1) 10px, rgba(255,255,255,.1) 20px)',
            animation: 'slide 20s linear infinite',
          }}
        />

        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={16}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div>
                <Badge status="processing" />
                <Text strong style={{ color: 'white', fontSize: 18, marginLeft: 8 }}>
                  Business Plan Trial Active
                </Text>
              </div>

              <Space direction="vertical" size="small">
                <Space>
                  <CrownOutlined style={{ color: '#ffd700', fontSize: 20 }} />
                  <Text style={{ color: 'rgba(255,255,255,0.95)' }}>
                    Enjoy unlimited access to all premium Business features
                  </Text>
                </Space>

                <Space wrap>
                  <Tag icon={<CheckCircleOutlined />} color="green">
                    Client Portal
                  </Tag>
                  <Tag icon={<CheckCircleOutlined />} color="green">
                    Project Finance
                  </Tag>
                  <Tag icon={<CheckCircleOutlined />} color="green">
                    Advanced Analytics
                  </Tag>
                </Space>
              </Space>
            </Space>
          </Col>

          <Col xs={24} sm={8}>
            <div style={{ textAlign: 'center' }}>
              <Countdown
                title={<span style={{ color: 'rgba(255,255,255,0.8)' }}>Time Remaining</span>}
                value={endDate}
                format="D [days] H [hrs]"
                valueStyle={{ color: 'white', fontSize: 24 }}
              />
              <Button
                type="primary"
                size="large"
                style={{
                  marginTop: 16,
                  background: 'white',
                  color: '#764ba2',
                  border: 'none',
                  fontWeight: 600,
                  width: '100%',
                }}
                onClick={() => {
                  // Track upgrade button click from trial status
                  trackMixpanelEvent(MixpanelBillingEvents.BUSINESS_TRIAL_UPGRADE_INITIATED, {
                    ...getBaseTrialProperties(),
                    trial_active: true,
                    days_elapsed: 7 - trialDaysRemaining,
                    check_source: 'upgrade_button_trial_card',
                  });
                  window.location.href = '/admin-center/billing?upgrade=true';
                }}
              >
                Upgrade Now
              </Button>
            </div>
          </Col>
        </Row>
      </Card>
    );
  }

  // If user has another plan trial active
  if (hasAnyPlanTrial && !isCurrentlyOnTrial) {
    return null; // Don't show anything if user has a different plan trial active
  }

  // If eligibility not checked yet
  if (!eligibilityChecked) {
    return (
      <Card style={{ marginBottom: 16 }}>
        <div style={{ textAlign: 'center', padding: 20 }}>
          <Spin />
          <div style={{ marginTop: 12 }}>Checking trial availability...</div>
        </div>
      </Card>
    );
  }

  // If user cannot start trial (already used it)
  if (!canStartTrial) {
    return null; // Don't show the trial card if they've already used it
  }

  // Show trial offer card - Clean, minimal design
  return (
    <Card
      style={{
        marginBottom: 16,
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        border: 'none',
        boxShadow: '0 4px 20px rgba(102, 126, 234, 0.25)',
      }}
      styles={{ body: { padding: 24 } }}
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {/* Simple badge and title */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Space>
            <Tag color="gold" style={{ margin: 0 }}>
              LIMITED OFFER
            </Tag>
            <Text strong style={{ color: 'white', fontSize: 16 }}>
              Try Business Plan Free
            </Text>
          </Space>
          <Tag style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white' }}>
            7 Days • No Card Required
          </Tag>
        </div>

        {/* Compact features list */}
        <Row gutter={[12, 12]}>
          <Col span={12}>
            <Space size="small">
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
              <Text style={{ color: 'white', fontSize: 14 }}>Client Portal</Text>
            </Space>
          </Col>
          <Col span={12}>
            <Space size="small">
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
              <Text style={{ color: 'white', fontSize: 14 }}>Project Finance</Text>
            </Space>
          </Col>
          <Col span={12}>
            <Space size="small">
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
              <Text style={{ color: 'white', fontSize: 14 }}>Advanced Analytics</Text>
            </Space>
          </Col>
          <Col span={12}>
            <Space size="small">
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
              <Text style={{ color: 'white', fontSize: 14 }}>Resource Tools</Text>
            </Space>
          </Col>
        </Row>

        {/* Clear CTA */}
        <Button
          type="primary"
          size="large"
          onClick={startTrial}
          loading={loading}
          disabled={disabled}
          block
          style={{
            height: 44,
            fontSize: 16,
            fontWeight: 600,
            background: 'white',
            color: '#764ba2',
            border: 'none',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
        >
          Start Free Trial
        </Button>
      </Space>
    </Card>
  );
};
