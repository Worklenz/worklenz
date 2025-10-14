import {
  Button,
  Card,
  Typography,
  Space,
  Flex,
  Dropdown,
  Divider,
  Tag,
} from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuthService } from '@/hooks/useAuth';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { fetchTeams, setActiveTeam } from '@/features/teams/teamSlice';
import { verifyAuthentication } from '@/features/auth/authSlice';
import { setUser } from '@/features/user/userSlice';
import { createAuthService } from '@/services/auth/auth.service';
import { supportApiService } from '@/api/support/support.api.service';
import { ISUBSCRIPTION_TYPE } from '@/shared/constants';
import { useState, useEffect } from 'react';
import {
  ClockCircleOutlined,
  CrownOutlined,
  CustomerServiceOutlined,
  BankOutlined,
  CaretDownFilled,
  CheckCircleFilled,
  RocketOutlined,
} from '@ant-design/icons';
import CustomAvatar from '@/components/CustomAvatar';
import { colors } from '@/styles/colors';
import './license-expired.css';

const { Title, Text, Paragraph } = Typography;

const LicenseExpired = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { t } = useTranslation('common');
  const authService = useAuthService();
  const authServiceInstance = createAuthService(navigate);
  const [isContactingSupport, setIsContactingSupport] = useState(false);
  const [messageSent, setMessageSent] = useState(false);

  const teamsList = useAppSelector(state => state.teamReducer.teamsList);
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const session = authService?.getCurrentSession();
  const subscriptionType = (session?.subscription_type as ISUBSCRIPTION_TYPE) || ISUBSCRIPTION_TYPE.TRIAL;

  useEffect(() => {
    dispatch(fetchTeams());
  }, [dispatch]);

  const isActiveTeam = (teamId: string): boolean => {
    if (!teamId || !session?.team_id) return false;
    return teamId === session.team_id;
  };

  const handleVerifyAuth = async () => {
    const result = await dispatch(verifyAuthentication()).unwrap();
    if (result.authenticated) {
      dispatch(setUser(result.user));
      authServiceInstance.setCurrentSession(result.user);
    }
  };

  const handleTeamSelect = async (id: string) => {
    if (!id) return;
    await dispatch(setActiveTeam(id));
    await handleVerifyAuth();
    window.location.reload();
  };

  const handleUpgrade = async () => {
    if (subscriptionType === ISUBSCRIPTION_TYPE.CUSTOM) {
      if (messageSent) return;

      try {
        setIsContactingSupport(true);
        await supportApiService.contactSupport({
          subscription_type: subscriptionType,
          reason: 'Custom plan renewal/support request',
        });
        setMessageSent(true);
      } catch (error) {
        console.error('Failed to contact support:', error);
      } finally {
        setIsContactingSupport(false);
      }
    } else {
      navigate('/worklenz/admin-center/billing');
    }
  };

  const getTitle = () => {
    switch (subscriptionType) {
      case ISUBSCRIPTION_TYPE.TRIAL:
        return t('license-expired-trial-title');
      case ISUBSCRIPTION_TYPE.CUSTOM:
        return t('license-expired-custom-title');
      default:
        return t('license-expired-title');
    }
  };

  const getSubtitle = () => {
    switch (subscriptionType) {
      case ISUBSCRIPTION_TYPE.TRIAL:
        return t('license-expired-trial-subtitle');
      case ISUBSCRIPTION_TYPE.CUSTOM:
        return t('license-expired-custom-subtitle');
      default:
        return t('license-expired-subtitle');
    }
  };

  const getFeaturesTitle = () => {
    switch (subscriptionType) {
      case ISUBSCRIPTION_TYPE.TRIAL:
        return t('license-expired-trial-features');
      case ISUBSCRIPTION_TYPE.CUSTOM:
        return t('license-expired-custom-features');
      default:
        return t('license-expired-features');
    }
  };

  const getUpgradeText = () => {
    switch (subscriptionType) {
      case ISUBSCRIPTION_TYPE.TRIAL:
        return t('license-expired-trial-upgrade');
      case ISUBSCRIPTION_TYPE.CUSTOM:
        return t('license-expired-custom-upgrade');
      default:
        return t('license-expired-upgrade');
    }
  };

  const getUpgradeIcon = () => {
    switch (subscriptionType) {
      case ISUBSCRIPTION_TYPE.CUSTOM:
        return <CustomerServiceOutlined />;
      default:
        return <CrownOutlined />;
    }
  };

  const features = [
    t('license-expired-feature-1'),
    t('license-expired-feature-2'),
    t('license-expired-feature-3'),
    t('license-expired-feature-4'),
  ];

  const renderTeamCard = (team: any, index: number) => (
    <Card
      className="team-switch-card"
      onClick={() => handleTeamSelect(team.id)}
      bordered={false}
      style={{
        width: '100%',
        cursor: 'pointer',
        backgroundColor: themeMode === 'dark' ? '#262626' : '#fff',
        color: themeMode === 'dark' ? '#fff' : '#000',
      }}
    >
      <Flex vertical>
        <Flex gap={12} align="center" justify="space-between" style={{ padding: '4px 12px' }}>
          <Flex gap={8} align="center">
            <CustomAvatar avatarName={team.name || ''} />
            <Flex vertical>
              <Typography.Text
                style={{
                  fontSize: 11,
                  fontWeight: 300,
                  color: '#8c8c8c',
                }}
              >
                {t('owned-by')} {team.owns_by}
              </Typography.Text>
              <Typography.Text
                style={{
                  color: themeMode === 'dark' ? '#fff' : '#000',
                }}
              >
                {team.name}
              </Typography.Text>
            </Flex>
          </Flex>
          <CheckCircleFilled
            style={{
              fontSize: 16,
              color: isActiveTeam(team.id)
                ? colors.limeGreen
                : themeMode === 'dark'
                  ? '#434343'
                  : colors.lightGray,
            }}
          />
        </Flex>
        {index < teamsList.length - 1 && (
          <Divider
            style={{
              margin: 0,
              borderColor: themeMode === 'dark' ? '#303030' : '#f0f0f0',
            }}
          />
        )}
      </Flex>
    </Card>
  );

  const dropdownItems =
    teamsList?.map((team, index) => ({
      key: team.id || '',
      label: renderTeamCard(team, index),
      type: 'item' as const,
    })) || [];

  return (
    <div className="license-expired-page">
      <div className="license-expired-container">
        <div className="license-expired-content">
          {/* Header Section */}
          <div className="license-expired-header">
            <div className="icon-wrapper">
              <ClockCircleOutlined className="main-icon" />
            </div>
            <Title level={1} className="page-title">
              {getTitle()}
            </Title>
            <Paragraph className="page-subtitle">
              {getSubtitle()}
            </Paragraph>
          </div>

          {/* Main Content Grid */}
          <div className="content-grid">
            {/* Features Card */}
            <Card className="features-card" bordered={false}>
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Flex align="center" gap={8}>
                  <RocketOutlined style={{ fontSize: 20, color: '#1890ff' }} />
                  <Text strong className="features-title">
                    {getFeaturesTitle()}
                  </Text>
                </Flex>
                <div className="features-list">
                  {features.map((feature, index) => (
                    <div key={index} className="feature-item">
                      <CheckCircleFilled className="feature-icon" />
                      <Text className="feature-text">{feature}</Text>
                    </div>
                  ))}
                </div>
              </Space>
            </Card>

            {/* Team Switcher Card - Show if multiple teams exist */}
            {teamsList && teamsList.length > 1 && (
              <Card className="team-switcher-card" bordered={false}>
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                  <Flex align="center" gap={8}>
                    <BankOutlined style={{ fontSize: 20, color: '#52c41a' }} />
                    <Text strong className="card-title">
                      {t('switch-team-to-continue')}
                    </Text>
                  </Flex>
                  <Text type="secondary" className="card-description">
                    {t('switch-team-active-subscription')}
                  </Text>
                  <div className="team-selector">
                    <Text type="secondary" className="current-team-label">
                      {t('current-team')}: <Text strong>{session?.team_name || t('select-team')}</Text>
                    </Text>
                    <Dropdown
                      overlayClassName="team-dropdown-overlay"
                      menu={{ items: dropdownItems }}
                      trigger={['click']}
                      placement="bottomLeft"
                    >
                      <Button className="team-dropdown-button" size="large">
                        <Flex gap={8} align="center" justify="space-between" style={{ width: '100%' }}>
                          <Text strong>{t('select-team')}</Text>
                          <CaretDownFilled />
                        </Flex>
                      </Button>
                    </Dropdown>
                  </div>
                </Space>
              </Card>
            )}
          </div>

          {/* Action Section */}
          <div className="action-section">
            <Button
              type="primary"
              size="large"
              onClick={handleUpgrade}
              loading={isContactingSupport && subscriptionType === ISUBSCRIPTION_TYPE.CUSTOM}
              icon={!isContactingSupport ? getUpgradeIcon() : undefined}
              className="upgrade-button"
            >
              {subscriptionType === ISUBSCRIPTION_TYPE.CUSTOM
                ? messageSent
                  ? t('license-expired-message-sent')
                  : isContactingSupport
                    ? t('license-expired-contacting-support')
                    : getUpgradeText()
                : getUpgradeText()}
            </Button>

            <div className="admin-note">
              <Tag color="blue" className="note-tag">
                {t('note')}
              </Tag>
              <Text type="secondary" className="note-text">
                {t('trial-alert-admin-note')}
              </Text>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LicenseExpired;
