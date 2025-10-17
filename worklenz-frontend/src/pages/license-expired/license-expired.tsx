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
    <div className="py-12 px-4 max-w-6xl mx-auto">
      {/* Hero Section with Icon and Title */}
      <div className="text-center mb-10">
        <div
          className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-6"
          style={{
            backgroundColor: themeMode === 'dark' ? '#faad1433' : '#fff7e6',
            border: `2px solid ${themeMode === 'dark' ? '#faad14' : '#ffc53d'}`,
          }}
        >
          <ClockCircleOutlined
            style={{
              fontSize: 40,
              color: '#faad14',
            }}
          />
        </div>
        <Title level={2} className="mb-3">
          {getTitle()}
        </Title>
        <Paragraph
          className="text-lg mb-0"
          style={{ color: themeMode === 'dark' ? '#bfbfbf' : '#595959' }}
        >
          {getSubtitle()}
        </Paragraph>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Features Card */}
        <Card
          bordered
          style={{
            borderColor: themeMode === 'dark' ? '#1890ff' : '#91d5ff',
            backgroundColor: themeMode === 'dark' ? undefined : '#f0f9ff',
          }}
        >
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Flex align="center" gap={12}>
              <div
                className="flex items-center justify-center w-10 h-10 rounded-lg"
                style={{
                  backgroundColor: themeMode === 'dark' ? '#1890ff33' : '#e6f7ff',
                }}
              >
                <CrownOutlined style={{ fontSize: 20, color: '#1890ff' }} />
              </div>
              <Title level={4} className="mb-0">
                {getFeaturesTitle()}
              </Title>
            </Flex>
            <List
              dataSource={features}
              split={false}
              renderItem={(feature) => (
                <List.Item className="py-3 px-0 border-0">
                  <Space align="start" size={12}>
                    <CheckCircleFilled
                      style={{
                        color: '#52c41a',
                        fontSize: 18,
                        marginTop: 2,
                      }}
                    />
                    <Text className="text-base">{feature}</Text>
                  </Space>
                </List.Item>
              )}
            />
          </Space>
        </Card>

        {/* Team Switcher Card or Empty State */}
        {teamsList && teamsList.length > 1 ? (
          <Card
            bordered
            style={{
              borderColor: themeMode === 'dark' ? '#52c41a' : '#b7eb8f',
              backgroundColor: themeMode === 'dark' ? undefined : '#f6ffed',
            }}
          >
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Flex align="center" gap={12}>
                <div
                  className="flex items-center justify-center w-10 h-10 rounded-lg"
                  style={{
                    backgroundColor: themeMode === 'dark' ? '#52c41a33' : '#d9f7be',
                  }}
                >
                  <BankOutlined style={{ fontSize: 20, color: '#52c41a' }} />
                </div>
                <Title level={4} className="mb-0">
                  {t('switch-team-to-continue')}
                </Title>
              </Flex>

              <Text type="secondary" className="text-base">
                {t('switch-team-active-subscription')}
              </Text>

              <Divider className="my-2" />

              <div>
                <Text type="secondary" className="text-sm block mb-2">
                  {t('current-team')}:
                </Text>
                <Text strong className="text-base">
                  {session?.team_name || t('select-team')}
                </Text>
              </div>

              <Dropdown
                menu={{ items: dropdownItems }}
                trigger={['click']}
                placement="bottomLeft"
              >
                <Button size="large" block icon={<BankOutlined />}>
                  <Flex gap={8} align="center" justify="space-between" style={{ width: '100%' }}>
                    <span>{t('select-team')}</span>
                    <CaretDownFilled />
                  </Flex>
                </Button>
              </Dropdown>
            </Space>
          </Card>
        ) : (
          <Card
            bordered
            style={{
              borderColor: themeMode === 'dark' ? '#d9d9d9' : '#f0f0f0',
            }}
          >
            <Space direction="vertical" size="large" style={{ width: '100%' }} className="text-center py-8">
              <div
                className="inline-flex items-center justify-center w-16 h-16 rounded-full mx-auto"
                style={{
                  backgroundColor: themeMode === 'dark' ? '#1890ff22' : '#e6f7ff',
                }}
              >
                <InfoCircleOutlined style={{ fontSize: 32, color: '#1890ff' }} />
              </div>
              <div>
                <Title level={5} className="mb-2">
                  {t('upgrade-to-continue')}
                </Title>
                <Text type="secondary">{t('trial-alert-admin-note')}</Text>
              </div>
            </Space>
          </Card>
        )}
      </div>

      {/* CTA Section */}
      <Card className="text-center">
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Button
              type="primary"
              size="large"
              onClick={handleUpgrade}
              loading={isContactingSupport && subscriptionType === ISUBSCRIPTION_TYPE.CUSTOM}
              icon={!isContactingSupport ? getUpgradeIcon() : undefined}
              className="px-12 h-12 text-lg font-semibold"
            >
              {subscriptionType === ISUBSCRIPTION_TYPE.CUSTOM
                ? messageSent
                  ? t('license-expired-message-sent')
                  : isContactingSupport
                    ? t('license-expired-contacting-support')
                    : getUpgradeText()
                : getUpgradeText()}
            </Button>
          </div>

          <Alert
            message={
              <Space>
                <InfoCircleOutlined />
                <Text strong>{t('note')}</Text>
              </Space>
            }
            description={t('trial-alert-admin-note')}
            type="info"
            showIcon={false}
            style={{
              textAlign: 'left',
            }}
          />
        </Space>
      </Card>
    </div>
  );
};

export default LicenseExpired;
