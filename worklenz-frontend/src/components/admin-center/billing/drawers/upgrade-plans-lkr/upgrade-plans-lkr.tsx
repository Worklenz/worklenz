import {
  Button,
  Card,
  Col,
  Form,
  Input,
  notification,
  Row,
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

const UpgradePlansLKR: React.FC = () => {
  const dispatch = useAppDispatch();
  const themeMode = useAppSelector((state: RootState) => state.themeReducer.mode);
  const [selectedPlan, setSelectedPlan] = useState(2);
  const { t } = useTranslation('admin-center/current-bill');
  const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const userCurrency = timeZoneCurrencyMap[userTimeZone] || 'USD';
  const [switchingToFreePlan, setSwitchingToFreePlan] = useState(false);
  const currentSession = useAuthService().getCurrentSession();

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
      padding: '20px 30px 0',
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

  const handlePlanSelect = (planIndex: number) => {
    setSelectedPlan(planIndex);
  };

  const handleSeatsChange = (values: { seats: number }) => {
    if (values.seats <= 15) {
      setSelectedPlan(2);
    } else if (values.seats > 15 && values.seats <= 200) {
      setSelectedPlan(3);
    } else if (values.seats > 200) {
      setSelectedPlan(4);
    }
  };

  const isSelected = (planIndex: number) =>
    selectedPlan === planIndex ? { border: '2px solid #1890ff' } : {};

  const handleSubmit = () => {
    notification.success({
      message: t('submitSuccess'),
      description: t('submitSuccessDescription'),
      placement: 'topRight',
    });
    dispatch(toggleUpgradeModal());
  };

  const renderFeature = (text: string) => (
    <div>
      <CheckCircleFilled style={cardStyles.checkIcon} />
      &nbsp;
      <span>{text}</span>
    </div>
  );

  const renderPlanCard = (
    planIndex: number,
    title: string,
    price: string | number,
    subtitle: string,
    users: string,
    features: string[],
    tag?: string
  ) => (
    <Col span={6} style={{ padding: '0 4px' }}>
      <Card
        style={{ ...isSelected(planIndex), height: '100%' }}
        hoverable
        title={
          <span style={cardStyles.title}>
            {title}
            {tag && <Tag color="volcano">{tag}</Tag>}
          </span>
        }
        onClick={() => handlePlanSelect(planIndex)}
      >
        <div style={cardStyles.priceContainer}>
          <Typography.Title level={1}>
            {userCurrency} {price}
          </Typography.Title>
          <span>{subtitle}</span>
          <Typography.Title level={5}>{users}</Typography.Title>
        </div>

        <div style={cardStyles.featureList}>
          {features.map((feature, index) => renderFeature(t(feature)))}
        </div>
      </Card>
    </Col>
  );

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

  return (
    <div className="upgrade-plans" style={{ marginTop: '1.5rem', textAlign: 'center' }}>
      <Typography.Title level={2}>{t('modalTitle')}</Typography.Title>

      {selectedPlan !== 1 && (
        <Row justify="center">
          <Form initialValues={{ seats: 15 }} onValuesChange={handleSeatsChange}>
            <Form.Item name="seats" label={t('seatLabel')}>
              <Input type="number" min={15} step={5} />
            </Form.Item>
          </Form>
        </Row>
      )}

      <Row>
        {renderPlanCard(1, t('freePlan'), 0.0, t('freeSubtitle'), t('freeUsers'), [
          'freeText01',
          'freeText02',
          'freeText03',
        ])}

        {renderPlanCard(2, t('startup'), 4990, t('startupSubtitle'), t('startupUsers'), [
          'startupText01',
          'startupText02',
          'startupText03',
          'startupText04',
          'startupText05',
        ])}

        {renderPlanCard(
          3,
          t('business'),
          300,
          t('businessSubtitle'),
          '16 - 200 users',
          ['startupText01', 'startupText02', 'startupText03', 'startupText04', 'startupText05'],
          t('tag')
        )}

        {renderPlanCard(4, t('enterprise'), 250, t('businessSubtitle'), t('enterpriseUsers'), [
          'startupText01',
          'startupText02',
          'startupText03',
          'startupText04',
          'startupText05',
        ])}
      </Row>

      {selectedPlan === 1 ? (
        <Row justify="center" style={{ marginTop: '1.5rem' }}>
          <Button type="primary" loading={switchingToFreePlan} onClick={switchToFreePlan}>
            {t('switchToFreePlan')}
          </Button>
        </Row>
      ) : (
        <div
          style={{
            backgroundColor: themeMode === 'dark' ? '#141414' : '#e2e3e5',
            padding: '1rem',
            marginTop: '1.5rem',
          }}
        >
          <Typography.Title level={4}>{t('footerTitle')}</Typography.Title>
          <Form onFinish={handleSubmit}>
            <Row justify="center" style={{ height: '32px' }}>
              <Form.Item
                style={{ margin: '0 24px 0 0' }}
                name="contactNumber"
                label={t('footerLabel')}
                rules={[{ required: true }]}
              >
                <Input type="number" placeholder="07xxxxxxxx" maxLength={10} minLength={10} />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit">
                  {t('footerButton')}
                </Button>
              </Form.Item>
            </Row>
          </Form>
        </div>
      )}
    </div>
  );
};

export default UpgradePlansLKR;
