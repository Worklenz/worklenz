import { useState, useEffect } from 'react';
import { Card, Button, Typography, Space, Tag, Alert, Spin } from '@/shared/antd-imports';
import { CheckCircleOutlined, ClockCircleOutlined, RocketOutlined } from '@ant-design/icons';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { isOnBusinessTrial, getPlanTrialDaysRemaining, isOnPlanTrial } from '@/utils/subscription-utils';
import { useAuthService } from '@/hooks/useAuth';
import { message } from 'antd';
import { PlanTrialApiService, IPlanTrialInfo } from '@/api/admin-center/plan-trial.api.service';

const { Title, Text, Paragraph } = Typography;

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
    return (
      <Alert
        type="info"
        showIcon
        icon={<ClockCircleOutlined />}
        message={
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text strong>Business Plan Trial Active</Text>
              <Tag color="blue">{trialDaysRemaining} days remaining</Tag>
            </div>
            <Text type="secondary">
              You have full access to all Business plan features during your trial
            </Text>
          </Space>
        }
        style={{ marginBottom: 16 }}
      />
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

  // Show trial offer card
  return (
    <Card
      style={{
        marginBottom: 16,
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        border: 'none'
      }}
      bodyStyle={{ padding: 24 }}
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Space>
            <RocketOutlined style={{ fontSize: 24 }} />
            <Title level={4} style={{ margin: 0, color: 'white' }}>
              Try Business Plan Free for 3 Days
            </Title>
          </Space>
          <Tag color="gold" style={{ fontSize: 14, padding: '4px 12px' }}>
            LIMITED TIME
          </Tag>
        </div>

        <Paragraph style={{ color: 'rgba(255,255,255,0.95)', marginBottom: 8 }}>
          Experience all premium Business features including:
        </Paragraph>

        <Space direction="vertical" size="small">
          <Space>
            <CheckCircleOutlined />
            <Text style={{ color: 'white' }}>Client Portal Access</Text>
          </Space>
          <Space>
            <CheckCircleOutlined />
            <Text style={{ color: 'white' }}>Project Finance Management</Text>
          </Space>
          <Space>
            <CheckCircleOutlined />
            <Text style={{ color: 'white' }}>Advanced Analytics & Reports</Text>
          </Space>
          <Space>
            <CheckCircleOutlined />
            <Text style={{ color: 'white' }}>Resource Management Tools</Text>
          </Space>
        </Space>

        <Button
          type="primary"
          size="large"
          onClick={startTrial}
          loading={loading}
          disabled={disabled}
          style={{
            width: '100%',
            height: 44,
            fontSize: 16,
            fontWeight: 600,
            background: 'white',
            color: '#764ba2',
            border: 'none'
          }}
        >
          Start Your 3-Day Free Trial
        </Button>

        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, textAlign: 'center' }}>
          No credit card required • Cancel anytime • One trial per account
        </Text>
      </Space>
    </Card>
  );
};