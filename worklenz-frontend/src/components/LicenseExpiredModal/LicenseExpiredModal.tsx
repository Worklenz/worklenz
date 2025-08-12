import { Modal, Button, Typography, Space, Card, Tag, Dropdown, Flex, Divider } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ClockCircleOutlined, CrownOutlined, CustomerServiceOutlined, BankOutlined, CaretDownFilled, CheckCircleFilled } from '@ant-design/icons';
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

export const LicenseExpiredModal = ({ open, subscriptionType = ISUBSCRIPTION_TYPE.TRIAL }: LicenseExpiredModalProps) => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { t } = useTranslation('common');
  const authService = useAuthService();
  const authServiceInstance = createAuthService(navigate);
  const [visible, setVisible] = useState(open);
  const [isContactingSupport, setIsContactingSupport] = useState(false);
  const [messageSent, setMessageSent] = useState(false);
  
  // Team switching state
  const teamsList = useAppSelector(state => state.teamReducer.teamsList);
  const session = authService?.getCurrentSession();

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
      style={{ width: 230, cursor: 'pointer' }}
    >
      <Flex vertical>
        <Flex gap={12} align="center" justify="space-between" style={{ padding: '4px 12px' }}>
          <Flex gap={8} align="center">
            <CustomAvatar avatarName={team.name || ''} />
            <Flex vertical>
              <Typography.Text style={{ fontSize: 11, fontWeight: 300 }}>
                {t('owned-by')} {team.owns_by}
              </Typography.Text>
              <Typography.Text>{team.name}</Typography.Text>
            </Flex>
          </Flex>
          <CheckCircleFilled
            style={{
              fontSize: 16,
              color: isActiveTeam(team.id) ? colors.limeGreen : colors.lightGray,
            }}
          />
        </Flex>
        {index < teamsList.length - 1 && <Divider style={{ margin: 0 }} />}
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
          reason: 'Custom plan renewal/support request'
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
      width={650}
      maskClosable={false}
      keyboard={false}
      mask={true}
      maskStyle={{
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(4px)'
      }}
      style={{ 
        zIndex: 1050
      }}
      wrapClassName="license-expired-modal-wrap"
    >
      <div style={{ padding: '20px 0' }}>
        <Space direction="vertical" size="large" style={{ width: '100%', textAlign: 'center' }}>
          {/* Team Switcher - Show prominently if multiple teams exist */}
          {teamsList && teamsList.length > 1 && (
            <Card
              style={{
                backgroundColor: '#f0f8ff',
                border: '2px solid #1890ff',
                marginBottom: 20,
                boxShadow: '0 2px 8px rgba(24, 144, 255, 0.15)'
              }}
              bodyStyle={{ padding: '16px' }}
            >
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <Text strong style={{ fontSize: 15, color: '#1890ff' }}>
                  {t('switch-team-to-continue')}
                </Text>
                <Dropdown
                  overlayClassName="switch-team-dropdown"
                  menu={{ items: dropdownItems }}
                  trigger={['click']}
                  placement="bottom"
                  overlayStyle={{ zIndex: 1060 }}
                >
                  <Button
                    size="large"
                    style={{
                      width: '100%',
                      height: 45,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0 16px',
                      border: '1px solid #1890ff',
                      backgroundColor: 'white'
                    }}
                  >
                    <Flex gap={12} align="center">
                      <BankOutlined style={{ fontSize: 18, color: '#1890ff' }} />
                      <Typography.Text strong style={{ fontSize: 14 }}>
                        {t('current-team')}: {session?.team_name || t('select-team')}
                      </Typography.Text>
                    </Flex>
                    <CaretDownFilled style={{ color: '#1890ff' }} />
                  </Button>
                </Dropdown>
                <Text type="secondary" style={{ fontSize: 12, textAlign: 'center', display: 'block' }}>
                  {t('switch-team-active-subscription')}
                </Text>
              </Space>
            </Card>
          )}

          {/* Icon and Title */}
          <div>
            <ClockCircleOutlined style={{ fontSize: 64, color: '#1890ff', marginBottom: 16 }} />
            <Title level={2} style={{ margin: 0, marginBottom: 8 }}>
              {getTitle()}
            </Title>
            <Paragraph type="secondary" style={{ fontSize: 16, marginBottom: 0 }}>
              {getSubtitle()}
            </Paragraph>
          </div>

          {/* Features Card */}
          <Card 
            style={{ 
              backgroundColor: '#e6f7ff', 
              border: '1px solid #91d5ff',
              marginTop: 24 
            }}
            bodyStyle={{ padding: '20px' }}
          >
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Text strong style={{ fontSize: 16, color: '#1890ff' }}>
                {getFeaturesTitle()}
              </Text>
              <Space direction="vertical" size="small" align="start" style={{ width: '100%', marginTop: 12 }}>
                {features.map((feature, index) => (
                  <Text key={index} style={{ fontSize: 14 }}>
                    {feature}
                  </Text>
                ))}
              </Space>
            </Space>
          </Card>

          {/* Upgrade Button */}
          <Button
            type="primary"
            size="large"
            onClick={handleUpgrade}
            loading={isContactingSupport && subscriptionType === ISUBSCRIPTION_TYPE.CUSTOM}
            icon={!isContactingSupport ? getUpgradeIcon() : undefined}
            style={{ 
              minWidth: 200, 
              height: 48,
              fontSize: 16,
              marginTop: 8,
              background: subscriptionType === ISUBSCRIPTION_TYPE.CUSTOM 
                ? 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)'
                : 'linear-gradient(135deg, #1890ff 0%, #40a9ff 100%)',
              border: 'none',
              boxShadow: '0 4px 6px rgba(50, 50, 93, 0.11), 0 1px 3px rgba(0, 0, 0, 0.08)'
            }}
          >
            {subscriptionType === ISUBSCRIPTION_TYPE.CUSTOM 
              ? (messageSent 
                  ? t('license-expired-message-sent') 
                  : (isContactingSupport 
                      ? t('license-expired-contacting-support') 
                      : getUpgradeText()
                    )
                )
              : getUpgradeText()
            }
          </Button>

          {/* Note */}
          <Text type="secondary" style={{ fontSize: 12, marginTop: 8 }}>
            <Tag color="blue" style={{ marginRight: 4 }}>Note</Tag>
            {t('trial-alert-admin-note')}
          </Text>
        </Space>
      </div>
    </Modal>
  );
};