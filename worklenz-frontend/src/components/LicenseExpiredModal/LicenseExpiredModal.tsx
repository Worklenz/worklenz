import {
  Modal,
  Button,
  Typography,
  Space,
  Card,
  Tag,
  Dropdown,
  Flex,
  Divider,
} from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  ClockCircleOutlined,
  CrownOutlined,
  CustomerServiceOutlined,
  BankOutlined,
  CaretDownFilled,
  CheckCircleFilled,
} from '@ant-design/icons';
import { ISUBSCRIPTION_TYPE } from '@/shared/constants';
import { supportApiService } from '@/api/support/support.api.service';
import { useAuthService } from '@/hooks/useAuth';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { fetchTeams, setActiveTeam } from '@/features/teams/teamSlice';
import { verifyAuthentication } from '@/features/auth/authSlice';
import { setUser } from '@/features/user/userSlice';
import CustomAvatar from '@/components/CustomAvatar';
import { colors } from '@/styles/colors';
import { createAuthService } from '@/services/auth/auth.service';
import './LicenseExpiredModal.css';

const { Title, Text, Paragraph } = Typography;

interface LicenseExpiredModalProps {
  open: boolean;
  subscriptionType?: ISUBSCRIPTION_TYPE;
}

export const LicenseExpiredModal = ({
  open,
  subscriptionType = ISUBSCRIPTION_TYPE.TRIAL,
}: LicenseExpiredModalProps) => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { t } = useTranslation('common');
  const authService = useAuthService();
  const authServiceInstance = createAuthService(navigate);
  const isOwnerOrAdmin = authService?.isOwnerOrAdmin() ?? false;
  const [visible, setVisible] = useState(open);
  const [isContactingSupport, setIsContactingSupport] = useState(false);
  const [messageSent, setMessageSent] = useState(false);

  // Team switching state
  const teamsList = useAppSelector(state => state.teamReducer.teamsList);
  const session = authService?.getCurrentSession();
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  useEffect(() => {
    setVisible(open);
    // Fetch teams when modal opens
    if (open) {
      dispatch(fetchTeams());
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [open, dispatch]);

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

  const renderTeamCard = (team: any, index: number) => (
    <Card
      className="switch-team-card"
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
                  color: themeMode === 'dark' ? '#8c8c8c' : '#8c8c8c',
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

  const handleUpgrade = async () => {
    if (subscriptionType === ISUBSCRIPTION_TYPE.CUSTOM) {
      if (messageSent) return; // Prevent multiple clicks after message is sent

      try {
        setIsContactingSupport(true);

        // Get current session data
        const currentSession = authService?.getCurrentSession();

        await supportApiService.contactSupport({
          subscription_type: subscriptionType,
          reason: 'Custom plan renewal/support request',
        });

        setMessageSent(true);
        // Success message is handled by the API client interceptor
      } catch (error) {
        console.error('Failed to contact support:', error);
        // Error message is handled by the API client interceptor
      } finally {
        setIsContactingSupport(false);
      }
    } else {
      navigate('/worklenz/admin-center/billing');
    }
  };

  // Get subscription-specific translations
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

  return (
    <Modal
      open={visible}
      closable={false}
      footer={null}
      centered
      width={900}
      maskClosable={false}
      keyboard={false}
      mask={true}
      maskStyle={{
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(4px)',
      }}
      style={{
        zIndex: 1050,
      }}
      wrapClassName="license-expired-modal-wrap"
    >
      <div className="license-modal-container">
        {/* Main Content Section */}
        <div className="license-modal-main-content">
          <div className="license-modal-header">
            <ClockCircleOutlined className="license-modal-icon" />
            <Title level={2} className="license-modal-title">
              {getTitle()}
            </Title>
            <Paragraph type="secondary" className="license-modal-subtitle">
              {getSubtitle()}
            </Paragraph>
          </div>

          {/* Features Card */}
          <Card className="license-modal-features-card">
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Text strong className="license-modal-features-title">
                {getFeaturesTitle()}
              </Text>
              <div className="license-modal-features-list">
                {features.map((feature, index) => (
                  <div key={index} className="license-modal-feature-item">
                    <CheckCircleFilled className="license-modal-feature-icon" />
                    <Text className="license-modal-feature-text">{feature}</Text>
                  </div>
                ))}
              </div>
            </Space>
          </Card>

          {/* Upgrade Button (billing-authorized roles only) */}
          {isOwnerOrAdmin ? (
            <Button
              type="primary"
              size="large"
              onClick={handleUpgrade}
              loading={isContactingSupport && subscriptionType === ISUBSCRIPTION_TYPE.CUSTOM}
              icon={!isContactingSupport ? getUpgradeIcon() : undefined}
              className="license-modal-upgrade-btn"
            >
              {subscriptionType === ISUBSCRIPTION_TYPE.CUSTOM
                ? messageSent
                  ? t('license-expired-message-sent', { defaultValue: 'Message Sent ✓' })
                  : isContactingSupport
                    ? t('license-expired-contacting-support', {
                        defaultValue: 'Contacting Support...',
                      })
                    : getUpgradeText()
                : getUpgradeText()}
            </Button>
          ) : (
            <Paragraph type="secondary" style={{ textAlign: 'center', marginBottom: 0 }}>
              {t('license-expired-contact-owner', {
                defaultValue:
                  "Your team's subscription has expired. Please contact your team owner to renew.",
              })}
            </Paragraph>
          )}

          {/* Note */}
          <div className="license-modal-note">
            <Tag color="blue" style={{ marginRight: 8 }}>
              {t('note', { defaultValue: 'Note' })}
            </Tag>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('trial-alert-admin-note', {
                defaultValue: 'You can still access the Admin Center to manage your subscription',
              })}
            </Text>
          </div>
        </div>

        {/* Team Switcher Sidebar - Show if multiple teams exist */}
        {teamsList && teamsList.length > 1 && (
          <>
            <Divider type="vertical" className="license-modal-divider" />
            <div className="license-modal-sidebar">
              <div className="license-modal-sidebar-header">
                <BankOutlined className="license-modal-sidebar-icon" />
                <Text strong className="license-modal-sidebar-title">
                  {t('switch-team-to-continue')}
                </Text>
                <Text type="secondary" className="license-modal-sidebar-subtitle">
                  {t('switch-team-active-subscription')}
                </Text>
              </div>

              <div className="license-modal-teams-section">
                <Text type="secondary" className="license-modal-current-team">
                  {t('current-team')}: <Text strong>{session?.team_name || t('select-team')}</Text>
                </Text>

                <Dropdown
                  overlayClassName="switch-team-dropdown"
                  menu={{ items: dropdownItems }}
                  trigger={['click']}
                  placement="bottomLeft"
                  overlayStyle={{ zIndex: 1060 }}
                >
                  <Button className="license-modal-team-dropdown">
                    <Flex gap={8} align="center" justify="space-between" style={{ width: '100%' }}>
                      <Text strong style={{ fontSize: 14 }}>
                        {t('select-team')}
                      </Text>
                      <CaretDownFilled style={{ fontSize: 12 }} />
                    </Flex>
                  </Button>
                </Dropdown>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
