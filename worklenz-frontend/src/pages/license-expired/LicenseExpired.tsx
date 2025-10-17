import {
  Button,
  Card,
  Typography,
  Space,
  Flex,
  Dropdown,
  Divider,
  Tag,
  Alert,
  List,
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
  InfoCircleOutlined,
} from '@ant-design/icons';
import CustomAvatar from '@/components/CustomAvatar';
import { colors } from '@/styles/colors';

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
    try {
      await dispatch(setActiveTeam(id));
      await handleVerifyAuth();
      // Redirect to home page after switching teams
      navigate('/worklenz/home');
      // Force a full reload to ensure the new team session is properly loaded
      window.location.href = '/worklenz/home';
    } catch (error) {
      console.error('Failed to switch team:', error);
    }
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

  const renderTeamCard = (team: any) => (
    <div
      onClick={() => handleTeamSelect(team.id)}
      style={{
        cursor: 'pointer',
        padding: '8px 12px',
        backgroundColor: isActiveTeam(team.id)
          ? (themeMode === 'dark' ? 'rgba(24, 144, 255, 0.15)' : '#e6f7ff')
          : 'transparent',
        borderRadius: '6px',
        transition: 'all 0.2s ease',
      }}
      className="hover:bg-gray-100 dark:hover:bg-gray-800"
    >
      <Flex gap={8} align="center" justify="space-between">
        <Flex gap={8} align="center" style={{ flex: 1, minWidth: 0 }}>
          <CustomAvatar avatarName={team.name || ''} size={28} />
          <Flex vertical style={{ flex: 1, minWidth: 0 }}>
            <Typography.Text
              style={{
                fontSize: 13,
                fontWeight: isActiveTeam(team.id) ? 600 : 400,
                color: themeMode === 'dark'
                  ? isActiveTeam(team.id) ? '#fff' : 'rgba(255, 255, 255, 0.85)'
                  : isActiveTeam(team.id) ? '#000' : 'rgba(0, 0, 0, 0.85)',
                lineHeight: '18px',
              }}
              ellipsis
            >
              {team.name}
            </Typography.Text>
            <Typography.Text
              style={{
                fontSize: 11,
                color: themeMode === 'dark' ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.45)',
                lineHeight: '16px',
              }}
              ellipsis
            >
              {team.owns_by}
            </Typography.Text>
          </Flex>
        </Flex>
        {isActiveTeam(team.id) && (
          <CheckCircleFilled
            style={{
              fontSize: 14,
              color: '#1890ff',
              flexShrink: 0,
            }}
          />
        )}
      </Flex>
    </div>
  );

  const dropdownItems =
    teamsList?.map((team) => ({
      key: team.id || '',
      label: renderTeamCard(team),
      type: 'item' as const,
    })) || [];

  return (
    <div className="py-8 px-4 md:px-6 max-w-6xl mx-auto h-[calc(100vh-80px)] flex flex-col">
      {/* Hero Section with Icon and Title */}
      <div className="text-center mb-8">
        <div
          className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
          style={{
            backgroundColor: themeMode === 'dark' ? 'rgba(250, 173, 20, 0.15)' : '#fff7e6',
            border: `3px solid ${themeMode === 'dark' ? 'rgba(250, 173, 20, 0.4)' : '#ffc53d'}`,
            boxShadow: themeMode === 'dark'
              ? '0 4px 12px rgba(250, 173, 20, 0.1)'
              : '0 4px 12px rgba(250, 173, 20, 0.15)',
          }}
        >
          <ClockCircleOutlined
            style={{
              fontSize: 32,
              color: '#faad14',
            }}
          />
        </div>
        <Title level={2} className="mb-3 text-2xl md:text-3xl" style={{ fontWeight: 600 }}>
          {getTitle()}
        </Title>
        <Paragraph
          className="text-base md:text-lg mb-0 max-w-2xl mx-auto"
          style={{
            color: themeMode === 'dark' ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.65)',
            lineHeight: '1.6',
          }}
        >
          {getSubtitle()}
        </Paragraph>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 min-h-0">
        {/* Features Card */}
        <Card
          variant="borderless"
          className="flex flex-col"
          style={{
            backgroundColor: themeMode === 'dark'
              ? 'rgba(24, 144, 255, 0.05)'
              : '#f0f9ff',
            height: '100%',
            borderRadius: '12px',
            boxShadow: themeMode === 'dark'
              ? '0 2px 8px rgba(0, 0, 0, 0.3)'
              : '0 2px 8px rgba(0, 0, 0, 0.06)',
          }}
          styles={{
            body: {
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
            }
          }}
        >
          <Space direction="vertical" size="middle" style={{ width: '100%', height: '100%' }}>
            <Flex align="center" gap={10}>
              <div
                className="flex items-center justify-center w-10 h-10 rounded-lg"
                style={{
                  backgroundColor: themeMode === 'dark' ? 'rgba(24, 144, 255, 0.2)' : '#e6f7ff',
                  border: themeMode === 'dark' ? '1px solid rgba(24, 144, 255, 0.3)' : 'none',
                }}
              >
                <CrownOutlined style={{ fontSize: 18, color: '#1890ff' }} />
              </div>
              <Title level={4} className="mb-0 text-lg" style={{ fontWeight: 600 }}>
                {getFeaturesTitle()}
              </Title>
            </Flex>
            <List
              dataSource={features}
              split={false}
              renderItem={(feature) => (
                <List.Item className="py-3 px-0 border-0">
                  <Space align="start" size={10}>
                    <CheckCircleFilled
                      style={{
                        color: '#52c41a',
                        fontSize: 16,
                        marginTop: 3,
                      }}
                    />
                    <Text
                      className="text-base leading-relaxed"
                      style={{
                        color: themeMode === 'dark' ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.85)'
                      }}
                    >
                      {feature}
                    </Text>
                  </Space>
                </List.Item>
              )}
            />
          </Space>
        </Card>

        {/* CTA and Action Card */}
        <Card
          variant="borderless"
          className="flex flex-col justify-between"
          style={{
            height: '100%',
            borderRadius: '12px',
            backgroundColor: themeMode === 'dark' ? 'rgba(255, 255, 255, 0.02)' : '#ffffff',
            boxShadow: themeMode === 'dark'
              ? '0 2px 8px rgba(0, 0, 0, 0.3)'
              : '0 2px 8px rgba(0, 0, 0, 0.06)',
          }}
          styles={{
            body: {
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
            }
          }}
        >
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            {/* Primary CTA */}
            <div className="text-center">
              <Button
                type="primary"
                size="large"
                onClick={handleUpgrade}
                loading={isContactingSupport && subscriptionType === ISUBSCRIPTION_TYPE.CUSTOM}
                icon={!isContactingSupport ? getUpgradeIcon() : undefined}
                block
                className="h-12 text-base font-semibold"
                style={{
                  borderRadius: '8px',
                  boxShadow: '0 2px 4px rgba(24, 144, 255, 0.2)',
                }}
              >
                {subscriptionType === ISUBSCRIPTION_TYPE.CUSTOM
                  ? messageSent
                    ? t('license-expired-message-sent')
                    : isContactingSupport
                      ? t('license-expired-contacting-support')
                      : getUpgradeText()
                  : getUpgradeText()}
              </Button>

              <Divider className="my-4" style={{ margin: '16px 0' }}>{t('or')}</Divider>

              <Text
                type="secondary"
                style={{
                  cursor: 'pointer',
                  fontSize: '14px',
                  transition: 'color 0.2s',
                }}
                className="hover:underline inline-block"
                onClick={() => navigate('/worklenz/admin-center/billing')}
              >
                {t('switch-to-free-plan')}
              </Text>
            </div>

            {/* Team Switcher or Info */}
            {teamsList && teamsList.length > 1 ? (
              <>
                <Divider style={{ margin: '20px 0' }} />
                <div className="space-y-3">
                  <Flex align="center" gap={10}>
                    <div
                      className="flex items-center justify-center w-8 h-8 rounded-lg"
                      style={{
                        backgroundColor: themeMode === 'dark' ? 'rgba(82, 196, 26, 0.15)' : '#f6ffed',
                        border: themeMode === 'dark' ? '1px solid rgba(82, 196, 26, 0.3)' : 'none',
                      }}
                    >
                      <BankOutlined style={{ fontSize: 14, color: '#52c41a' }} />
                    </div>
                    <Title level={5} className="mb-0 text-base" style={{ fontWeight: 600 }}>
                      {t('switch-team-to-continue')}
                    </Title>
                  </Flex>

                  <Text
                    type="secondary"
                    className="text-sm block"
                    style={{
                      color: themeMode === 'dark' ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.45)',
                    }}
                  >
                    {t('switch-team-active-subscription')}
                  </Text>

                  <div
                    style={{
                      padding: '12px',
                      borderRadius: '8px',
                      backgroundColor: themeMode === 'dark' ? 'rgba(255, 255, 255, 0.04)' : '#fafafa',
                    }}
                  >
                    <Text
                      type="secondary"
                      className="text-xs block mb-1"
                      style={{ fontWeight: 500 }}
                    >
                      {t('current-team')}:
                    </Text>
                    <Text strong className="text-sm">
                      {session?.team_name || t('select-team')}
                    </Text>
                  </div>

                  <Dropdown
                    menu={{
                      items: dropdownItems,
                      style: {
                        maxWidth: '280px',
                        maxHeight: '280px',
                        overflowY: 'auto',
                        padding: '4px',
                      }
                    }}
                    trigger={['click']}
                    placement="bottomLeft"
                    overlayStyle={{ maxWidth: '280px' }}
                  >
                    <Button
                      size="middle"
                      block
                      icon={<BankOutlined />}
                      style={{
                        height: '40px',
                        borderRadius: '8px',
                      }}
                    >
                      <Flex gap={8} align="center" justify="space-between" style={{ width: '100%' }}>
                        <span className="text-sm">{t('select-team')}</span>
                        <CaretDownFilled />
                      </Flex>
                    </Button>
                  </Dropdown>
                </div>
              </>
            ) : (
              <>

              </>
            )}
          </Space>
        </Card>
      </div>
    </div>
  );
};

export default LicenseExpired;
