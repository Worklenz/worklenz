import {
  Button,
  Card,
  Col,
  Form,
  Input,
  notification,
  Row,
  Space,
  Tag,
  Typography,
} from '@/shared/antd-imports';
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
import { BillingFrequency } from '../upgrade-plans/types';
import { ILocalPlans } from '@/shared/constants';

const UpgradePlansLKR: React.FC = () => {
  const dispatch = useAppDispatch();
  const themeMode = useAppSelector((state: RootState) => state.themeReducer.mode);
  const { t } = useTranslation(['admin-center/current-bill', 'pricing-modal']);
  const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const userCurrency = timeZoneCurrencyMap[userTimeZone] || 'LKR';

  const [billingFrequency, setBillingFrequency] = useState<BillingFrequency>('annual');
  const [selectedPlan, setSelectedPlan] = useState<ILocalPlans[keyof ILocalPlans]>(ILocalPlans.ANNUAL);
  const [switchingToFreePlan, setSwitchingToFreePlan] = useState(false);

  const currentSession = useAuthService().getCurrentSession();
  const annualSavingsPercent = 20;

  // Pricing data
  const plans = {
    free: {
      title: t('freePlan'),
      price: 0,
      subtitle: t('freeSubtitle'),
      users: t('freeUsers'),
      features: ['freeText01', 'freeText02', 'freeText03'],
      tag: selectedPlan === ILocalPlans.FREE ? t('currentPlan') : undefined,
    },
    startup: {
      title: t('startup'),
      priceMonthly: 549, // Monthly price in LKR
      priceAnnual: 4990, // Annual price in LKR (with discount)
      subtitle: t('startupSubtitle'),
      users: t('startupUsers'),
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
      color: themeMode === 'dark' ? '#ffffffd9' : '#000000d9',
    },
    price: {
      fontSize: '36px',
      fontWeight: 700,
      margin: 0,
      color: themeMode === 'dark' ? '#fff' : '#000',
    },
    subtitle: {
      color: '#8c8c8c',
      fontSize: '14px',
    },
  };

  const getCardStyle = (isSelected: boolean) => ({
    height: '100%',
    cursor: 'pointer',
    border: isSelected ? '2px solid #1890ff' : '1px solid #d9d9d9',
    boxShadow: isSelected ? '0 0 12px rgba(24, 144, 255, 0.25)' : 'none',
    transition: 'all 0.3s',
  });

  const handlePlanSelect = (plan: keyof typeof plans) => {
    if (plan === 'free') {
      setSelectedPlan(ILocalPlans.FREE);
    } else {
      setSelectedPlan(billingFrequency === 'annual' ? ILocalPlans.ANNUAL : ILocalPlans.MONTHLY);
    }
  };

  const onBillingFrequencyChange = (frequency: BillingFrequency) => {
    setBillingFrequency(frequency);
    // Keep selection consistent with frequency
    if (selectedPlan !== ILocalPlans.FREE) {
      setSelectedPlan(frequency === 'annual' ? ILocalPlans.ANNUAL : ILocalPlans.MONTHLY);
    }
  };

  const handleSubmit = () => {
    notification.success({
      message: t('submitSuccess'),
      description: t('submitSuccessDescription'),
      placement: 'topRight',
    });
    dispatch(toggleUpgradeModal());
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

  const renderFeature = (text: string) => (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
      <CheckCircleFilled style={cardStyles.checkIcon} />
      <span style={{ textAlign: 'left', fontSize: '14px' }}>{t(text)}</span>
    </div>
  );

  const isPlanSelected = (planKey: 'free' | 'startup') => {
    if (planKey === 'free') return selectedPlan === ILocalPlans.FREE;
    return selectedPlan === ILocalPlans.ANNUAL || selectedPlan === ILocalPlans.MONTHLY;
  };

  return (
    <div className="upgrade-plans" style={{ padding: '2rem 1rem', textAlign: 'center' }}>
      <Typography.Title level={2}>{t('modalTitle')}</Typography.Title>

      {/* Billing Frequency Toggle */}
      <Space align="center" size="middle" style={{ marginBottom: '2rem' }}>
        <Typography.Text strong>{t('pricing-modal:billingCycle.label')}:</Typography.Text>
        <Button.Group>
          <Button
            type={billingFrequency === 'monthly' ? 'primary' : 'default'}
            onClick={() => onBillingFrequencyChange('monthly')}
          >
            {t('pricing-modal:billingCycle.monthly')}
          </Button>
          <Button
            type={billingFrequency === 'annual' ? 'primary' : 'default'}
            onClick={() => onBillingFrequencyChange('annual')}
          >
            {t('pricing-modal:billingCycle.yearly')}
          </Button>
        </Button.Group>
        {annualSavingsPercent > 0 && (
          <Typography.Text style={{ color: '#52c41a', fontWeight: 600 }}>
            {t('pricing-modal:billing.annualSavingsShortOff', 'Up to {{percent}}% off', {
              percent: annualSavingsPercent,
            })}
          </Typography.Text>
        )}
      </Space>

      {/* Plan Cards - Centered and Responsive */}
      <Row justify="center" gutter={[24, 32]}>
        {/* Free Plan */}
        <Col xs={22} sm={18} md={12} lg={10} xl={8}>
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
          >
            <div style={{ padding: '24px 16px' }}>
              <Typography.Title level={1} style={cardStyles.price}>
                {userCurrency} {plans.free.price}
              </Typography.Title>
              <Typography.Text style={cardStyles.subtitle}>{plans.free.subtitle}</Typography.Text>
              <Typography.Paragraph style={{ margin: '16px 0', color: '#8c8c8c' }}>
                {plans.free.users}
              </Typography.Paragraph>
              <div style={{ textAlign: 'left', marginTop: '24px' }}>
                {plans.free.features.map((f) => renderFeature(f))}
              </div>
            </div>
          </Card>
        </Col>

        {/* Startup Plan */}
        <Col xs={22} sm={18} md={12} lg={10} xl={8}>
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
          >
            <div style={{ padding: '24px 16px' }}>
              <Typography.Title level={1} style={cardStyles.price}>
                {userCurrency}{' '}
                {billingFrequency === 'annual' ? plans.startup.priceAnnual : plans.startup.priceMonthly}
              </Typography.Title>
              <Typography.Text style={cardStyles.subtitle}>
                {billingFrequency === 'annual' ? '/year' : '/month'}
              </Typography.Text>
              <Typography.Paragraph style={{ margin: '16px 0', color: '#8c8c8c' }}>
                {plans.startup.users}
              </Typography.Paragraph>
              <div style={{ textAlign: 'left', marginTop: '24px' }}>
                {plans.startup.features.map((f) => renderFeature(f))}
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Action Section */}
      {selectedPlan === ILocalPlans.FREE ? (
        <Row justify="center" style={{ marginTop: '3rem' }}>
          <Button type="primary" size="large" loading={switchingToFreePlan} onClick={switchToFreePlan}>
            {t('switchToFreePlan')}
          </Button>
        </Row>
      ) : (
        <div
          style={{
            backgroundColor: themeMode === 'dark' ? '#141414' : '#f5f5f5',
            padding: '2rem',
            marginTop: '3rem',
            borderRadius: '8px',
          }}
        >
          <Typography.Title level={4}>{t('footerTitle')}</Typography.Title>
          <Form onFinish={handleSubmit} layout="inline" style={{ justifyContent: 'center' }}>
            <Form.Item
              name="contactNumber"
              label={t('footerLabel')}
              rules={[
                { required: true, message: 'Please enter your contact number' },
                { len: 10, message: 'Must be 10 digits' },
              ]}
            >
              <Input
                type="text"
                placeholder="07xxxxxxxx"
                maxLength={10}
                style={{ width: '200px' }}
              />
            </Form.Item>
            <Form.Item>
              <Button type="primary" size="large" htmlType="submit">
                {t('footerButton')}
              </Button>
            </Form.Item>
          </Form>
        </div>
      )}
    </div>
  );
};

export default UpgradePlansLKR;