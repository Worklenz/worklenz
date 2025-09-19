import { useState, useEffect } from 'react';
import { Card, Button, Typography, Space, Tag, Alert, Spin, Badge, Statistic, Progress, Row, Col } from '@/shared/antd-imports';
import { CheckCircleOutlined, ClockCircleOutlined, RocketOutlined, GiftOutlined, ThunderboltOutlined, SafetyCertificateOutlined, CrownOutlined, StarFilled } from '@ant-design/icons';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { isOnBusinessTrial, getPlanTrialDaysRemaining, isOnPlanTrial } from '@/utils/subscription-utils';
import { useAuthService } from '@/hooks/useAuth';
import { message } from 'antd';
import { PlanTrialApiService, IPlanTrialInfo } from '@/api/admin-center/plan-trial.api.service';
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
  const [loading, setLoading] = useState(false);
  const [eligibilityChecked, setEligibilityChecked] = useState(false);
  const [canStartTrial, setCanStartTrial] = useState(false);
  const [trialInfo, setTrialInfo] = useState<IPlanTrialInfo | null>(null);

  // Check if user is already on Business trial
  const isCurrentlyOnTrial = isOnBusinessTrial(currentSession);
  const trialDaysRemaining = getPlanTrialDaysRemaining(currentSession);
  const hasAnyPlanTrial = isOnPlanTrial(currentSession);

  // Check trial eligibility on mount
  useEffect(() => {
    checkTrialEligibility();
  }, []);

  const checkTrialEligibility = async () => {
    try {
      const response = await PlanTrialApiService.checkBusinessTrialEligibility();
      if (response.done) {
        setTrialInfo(response.body);
        setCanStartTrial(response.body?.can_start_trial || false);
        setEligibilityChecked(true);
      }
    } catch (error) {
      console.error('Failed to check trial eligibility:', error);
      setEligibilityChecked(true);
    }
  };

  const startTrial = async () => {
    setLoading(true);
    try {
      const response = await PlanTrialApiService.startBusinessTrial();
      if (response.done) {
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
    const endDate = currentSession?.plan_trial_end_date ? new Date(currentSession.plan_trial_end_date) : new Date();

    return (
      <Card
        style={{
          marginBottom: 16,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          border: 'none',
          position: 'relative',
          overflow: 'hidden'
        }}
        bodyStyle={{ padding: 24 }}
      >
        {/* Animated background pattern */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity: 0.1,
          background: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,.1) 10px, rgba(255,255,255,.1) 20px)',
          animation: 'slide 20s linear infinite'
        }} />

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
                  <Tag icon={<CheckCircleOutlined />} color="green">Client Portal</Tag>
                  <Tag icon={<CheckCircleOutlined />} color="green">Project Finance</Tag>
                  <Tag icon={<CheckCircleOutlined />} color="green">Advanced Analytics</Tag>
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
                  width: '100%'
                }}
                onClick={() => window.location.href = '/admin-center/billing?upgrade=true'}
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
        boxShadow: '0 4px 20px rgba(102, 126, 234, 0.25)'
      }}
      bodyStyle={{ padding: 24 }}
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {/* Simple badge and title */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Space>
            <Tag color="gold" style={{ margin: 0 }}>LIMITED OFFER</Tag>
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
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
          }}
        >
          Start Free Trial
        </Button>
      </Space>
    </Card>
  );
};