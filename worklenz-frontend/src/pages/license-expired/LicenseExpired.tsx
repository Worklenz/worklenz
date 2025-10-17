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
        padding: '6px 10px',
        backgroundColor: isActiveTeam(team.id)
          ? (themeMode === 'dark' ? '#1f1f1f' : '#f0f9ff')
          : 'transparent',
      }}
      className="hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
    >
      <Flex gap={6} align="center" justify="space-between">
        <Flex gap={6} align="center" style={{ flex: 1, minWidth: 0 }}>
          <CustomAvatar avatarName={team.name || ''} size={24} />
          <Flex vertical style={{ flex: 1, minWidth: 0 }}>
            <Typography.Text
              style={{
                fontSize: 12,
                fontWeight: isActiveTeam(team.id) ? 500 : 400,
                color: themeMode === 'dark' ? '#fff' : '#000',
                lineHeight: '16px',
              }}
              ellipsis
            >
              {team.name}
            </Typography.Text>
            <Typography.Text
              style={{
                fontSize: 10,
                color: '#8c8c8c',
                lineHeight: '14px',
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
              fontSize: 12,
              color: colors.limeGreen,
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
    <div className="py-6 px-4 md:px-6 max-w-6xl mx-auto h-[calc(100vh-80px)] flex flex-col">
      {/* Hero Section with Icon and Title */}
      <div className="text-center mb-6">
        <div
          className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-3"
          style={{
            backgroundColor: themeMode === 'dark' ? '#faad1433' : '#fff7e6',
            border: `2px solid ${themeMode === 'dark' ? '#faad14' : '#ffc53d'}`,
          }}
        >
          <ClockCircleOutlined
            style={{
              fontSize: 28,
              color: '#faad14',
            }}
          />
        </div>
        <Title level={2} className="mb-2 text-xl md:text-2xl">
          {getTitle()}
        </Title>
        <Paragraph
          className="text-sm md:text-base mb-0 max-w-2xl mx-auto"
          style={{ color: themeMode === 'dark' ? '#bfbfbf' : '#595959' }}
        >
          {getSubtitle()}
        </Paragraph>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-0">
        {/* Features Card */}
        <Card
          bordered={false}
          className="flex flex-col"
          style={{
            backgroundColor: themeMode === 'dark' ? undefined : '#f0f9ff',
            height: '100%',
          }}
        >
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <Flex align="center" gap={8}>
              <div
                className="flex items-center justify-center w-8 h-8 rounded-lg"
                style={{
                  backgroundColor: themeMode === 'dark' ? '#1890ff33' : '#e6f7ff',
                }}
              >
                <CrownOutlined style={{ fontSize: 16, color: '#1890ff' }} />
              </div>
              <Title level={4} className="mb-0 text-base">
                {getFeaturesTitle()}
              </Title>
            </Flex>
            <List
              dataSource={features}
              split={false}
              renderItem={(feature) => (
                <List.Item className="py-2 px-0 border-0">
                  <Space align="start" size={8}>
                    <CheckCircleFilled
                      style={{
                        color: '#52c41a',
                        fontSize: 14,
                        marginTop: 2,
                      }}
                    />
                    <Text className="text-sm leading-relaxed">{feature}</Text>
                  </Space>
                </List.Item>
              )}
            />
          </Space>
        </Card>

        {/* CTA and Action Card */}
        <Card
          bordered={false}
          className="flex flex-col justify-between"
          style={{
            height: '100%',
          }}
        >
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            {/* Primary CTA */}
            <div className="text-center mb-2">
              <Button
                type="primary"
                size="large"
                onClick={handleUpgrade}
                loading={isContactingSupport && subscriptionType === ISUBSCRIPTION_TYPE.CUSTOM}
                icon={!isContactingSupport ? getUpgradeIcon() : undefined}
                block
                className="h-11 text-base font-semibold"
              >
                {subscriptionType === ISUBSCRIPTION_TYPE.CUSTOM
                  ? messageSent
                    ? t('license-expired-message-sent')
                    : isContactingSupport
                      ? t('license-expired-contacting-support')
                      : getUpgradeText()
                  : getUpgradeText()}
              </Button>

              <Divider className="my-2.5">{t('or')}</Divider>

              <Text
                type="secondary"
                style={{ cursor: 'pointer' }}
                className="text-sm hover:underline inline-block"
                onClick={() => navigate('/worklenz/admin-center/billing')}
              >
                {t('switch-to-free-plan')}
              </Text>
            </div>

            {/* Team Switcher or Info */}
            {teamsList && teamsList.length > 1 ? (
              <>
                <Divider className="my-3" />
                <div className="space-y-2.5">
                  <Flex align="center" gap={8}>
                    <BankOutlined style={{ fontSize: 16, color: '#52c41a' }} />
                    <Title level={5} className="mb-0 text-sm">
                      {t('switch-team-to-continue')}
                    </Title>
                  </Flex>

                  <Text type="secondary" className="text-xs block">
                    {t('switch-team-active-subscription')}
                  </Text>

                  <div>
                    <Text type="secondary" className="text-xs block mb-1">
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
                    <Button size="middle" block icon={<BankOutlined />}>
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
