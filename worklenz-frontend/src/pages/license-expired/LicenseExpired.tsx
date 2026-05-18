//UI upgrade - 23/03/2026
import {
  Typography,
  Flex,
  Dropdown,
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
  FieldTimeOutlined,
  CheckCircleFilled,
  FolderOutlined,
  BarChartOutlined,
  TeamOutlined,
  ThunderboltOutlined

} from '@ant-design/icons';
import CustomAvatar from '@/components/CustomAvatar';

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
  const isDark = themeMode === 'dark';

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
      navigate('/worklenz/home');
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
        console.error('Failed to contact support', error);
      } finally {
        setIsContactingSupport(false);
      }
    } else {
      navigate('/worklenz/admin-center/billing');
    }
  };

  const getTitle = () => {
    switch (subscriptionType) {
      case ISUBSCRIPTION_TYPE.TRIAL: return t('license-expired-trial-title');
      case ISUBSCRIPTION_TYPE.CUSTOM: return t('license-expired-custom-title');
      default: return t('license-expired-title');
    }
  };

  const getSubTitle = () => {
    switch (subscriptionType) {
      case ISUBSCRIPTION_TYPE.TRIAL: return t('license-expired-trial-subtitle');
      case ISUBSCRIPTION_TYPE.CUSTOM: return t('license-expired-custom-subtitle');
      default: return t('license-expired-subtitle');
    }
  };

  const getUpgradeText = () => {
    if (subscriptionType === ISUBSCRIPTION_TYPE.CUSTOM) {
      if (messageSent) return t('license-expired-message-sent');
      if (isContactingSupport) return t('licennse-expired-contacting-support');
      return t('license-expired-custom-upgrade');
    }
    return t('license-expired-trial-upgrade') || 'Upgrade Now';
  };


  // Theme tokens
  const bg = isDark ? '#1a1b2e' : '#e8eaf6';
  const cardBg = isDark ? '#1f2035' : '#ffffff';
  const cardShadow = isDark ? '0 8px 40px rgba(0,0,0,0.5)' : '0 8px 40px rgba(100,110,200,0.13)';
  const titleColor = isDark ? '#ffffff' : '#1a1a2e';
  const subtitleColor = isDark ? 'rgba(255,255,255,0.55)' : '#6b7aad';
  const dividerColor = isDark ? 'rgba(255,255,255,0.08)' : '#e4e7f5';
  const pillBg = isDark ? 'rgba(255,255,255,0.05)' : '#f5f6fc';
  const pillBorder = isDark ? 'rgba(255,255,255,0.1)' : '#e2e5f2';
  const pillText = isDark ? 'rgba(255,255,255,0.85)' : '#3d4a6b';
  const freePlanBorder = isDark ? 'rgba(255,255,255,0.15)' : '#d8ddf0';
  const freePlanText = isDark ? 'rgba(255,255,255,0.6)' : '#6b7aad';
  const switchLabelColor = isDark ? 'rgba(255,255,255,0.35)' : '#9aa3c8';
  const teamRowBg = isDark ? 'rgba(255,255,255,0.04)' : '#f8f9fe';
  const teamRowBorder = isDark ? 'rgba(255,255,255,0.08)' : '#e4e7f5';
  const teamNameColor = isDark ? '#ffffff' : '#1a1a2e';
  const dropdownBg = isDark ? 'rgba(255,255,255,0.03)' : '#ffffff';
  const dropdownBorder = isDark ? 'rgba(255,255,255,0.1)' : '#d8ddf0';
  const dropdownText = isDark ? 'rgba(255,255,255,0.45)' : '#9aa3c8';
  const footerColor = isDark ? 'rgba(255,255,255,0.4)' : '#8892b8';
  const footerLinkColor = isDark ? '#69b1ff' : '#1677ff';
const iconCircleBg     = isDark ? 'transparent'  : 'transparent';
const iconCircleBorder = isDark ? 'rgba(24,144,255,0.4)'  : '#91caff';

  const featurePills = [
    { icon: <FolderOutlined style={{ fontSize: 18, color: '#f59e0b' }} />, label: t('license-expired-feature-1') || 'Unlimited Projects' },
    { icon: <BarChartOutlined style={{ fontSize: 18, color: '#3b82f6' }} />, label: t('license-expired-feature-2') || 'Analytics & Reports' },
    { icon: <TeamOutlined style={{ fontSize: 18, color: '#374151' }} />, label: t('license-expired-feature-3') || 'Team Collaboration' },
    { icon: <ThunderboltOutlined style={{ fontSize: 18, color: '#f59e0b' }} />, label: t('license-expired-feature-4') || 'Priority Support' },
  ];

  //current active team
  const currentTeam = teamsList?.find(t => isActiveTeam(t.id || ''));
  const teamInitial = (currentTeam?.name || session?.team_name || 'C').charAt(0).toUpperCase();
  const teamDisplayName = currentTeam?.name || session?.team_name;

  //Dropdown items for switching teams
  const dropdownItems = teamsList?.map(team => ({
    key: team.id || '',
    label: (
      <div
        onClick={() => handleTeamSelect(team.id || '')}
        style={{ cursor: 'pointer', padding: '7px 10px', borderRadius: 6 }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = isDark ? 'rgba(255,255,255,0.06)' : '#f0f1f9'}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}
      >
        <Flex gap={8} align="center" justify="space-between">
          <Flex gap={8} align="center" style={{ flex: 1, minWidth: 0 }}>
            <CustomAvatar avatarName={team.name || ''} size={26} />
            <Text ellipsis style={{ fontSize: 13, color: teamNameColor, fontWeight: isActiveTeam(team.id || '') ? 600 : 400 }}>
              {team.name}
            </Text>
          </Flex>
          {isActiveTeam(team.id || '') && (
            <CheckCircleFilled style={{ fontSize: 13, color: '#5c6bc0' }} />
          )}
        </Flex>
      </div>
    ),
    type: 'item' as const,
  })) || [];

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'transparent',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        transition: 'background-color 0.3s ease',
      }}
    >
      {/* Main card*/}
      <div
        style={{
          width: '100%',
          maxWidth: 468,
          backgroundColor: cardBg,
          borderRadius: 18,
          boxShadow: cardShadow,
          overflow: 'hidden',
          transition: 'all 0.3s ease',
        }}
      >
        {/* Top: icon + title + subtitle */}
        <div style={{ padding: '36px 32px 24px', textAlign: 'center' }}>
          {/* Stopwatch icon circle */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 62,
              height: 62,
              borderRadius: '50%',
              backgroundColor: iconCircleBg,
              border: `2px solid ${iconCircleBorder}`,
              marginBottom: 16,
            }}
          >
            <FieldTimeOutlined style={{ fontSize: 28, color: isDark ? '#69b1ff ':'#1677ff'  }} />          </div>

          <Title
            level={3}
            style={{ margin: '0 0 8px', fontWeight: 700, fontSize: 22, color: titleColor }}
          >
            {getTitle()}
          </Title>

          <Paragraph
            style={{
              margin: 0,
              fontSize: 14,
              color: subtitleColor,
              lineHeight: 1.65,
              maxWidth: 310,
              marginInline: 'auto',
            }}
          >
            {getSubTitle()}
          </Paragraph>
        </div>

        {/* Divider */}
        <div style={{ height: 1, backgroundColor: dividerColor }} />

        {/* Bottom section: pills + buttons + switch team */}
        <div style={{ padding: '24px 28px 28px' }}>

          {/* 2×2 Feature pills */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 10,
              marginBottom: 20,
            }}
          >
            {featurePills.map((pill, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  padding: '10px 14px',
                  borderRadius: 10,
                  backgroundColor: pillBg,
                  border: `1px solid ${pillBorder}`,
                }}
              >
                <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                  {pill.icon}
                </span>
                <Text style={{ fontSize: 13, color: pillText, fontWeight: 500 }}>
                  {pill.label}
                </Text>
              </div>
            ))}
          </div>

          {/* Upgrade Now */}
          <button
            onClick={handleUpgrade}
            disabled={isContactingSupport}
            style={{
              width: '100%',
              height: 48,
              borderRadius: 10,
              border: 'none',
              background: '#1677ff',
boxShadow: '0 4px 16px rgba(22,119,255,0.35)',
              color: '#ffffff',
              fontSize: 15,
              fontWeight: 600,
              cursor: isContactingSupport ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              marginBottom: 10,
              transition: 'opacity 0.2s ease',
              opacity: isContactingSupport ? 0.7 : 1,
            }}
            onMouseEnter={e => { if (!isContactingSupport) (e.currentTarget as HTMLElement).style.opacity = '0.9'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
          >
          <span style={{ fontSize: 17, lineHeight: 1 }}>🚀</span>
<span>{getUpgradeText()}</span>

          </button>

          {/* Continue with Free Plan */}
          <button
            onClick={() => navigate('/worklenz/admin-center/billing')}
            style={{
              width: '100%',
              height: 44,
              borderRadius: 10,
              border: `1px solid ${freePlanBorder}`,
              backgroundColor: 'transparent',
              color: freePlanText,
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.2s ease',
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = isDark ? 'rgba(255,255,255,0.04)' : '#f5f6fc'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}
          >
            {t('switch-to-free-plan') || 'Continue with Free Plan'}
          </button>

          {/* OR SWITCH TEAM */}
          {teamsList && teamsList.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <Text
                style={{
                  display: 'block',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: switchLabelColor,
                  marginBottom: 10,
                }}
              >
                {t('or-switch-team') || 'OR SWITCH TEAM'}
              </Text>

              {/* Current team row with Trial Expired badge */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                  borderRadius: 10,
                  backgroundColor: teamRowBg,
                  border: `1px solid ${teamRowBorder}`,
                  marginBottom: 8,
                }}
              >
                {/* Blue square avatar */}
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 8,
             backgroundColor: '#1677ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: 700, fontSize: 16, lineHeight: 1 }}>
                    {teamInitial}
                  </Text>
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    ellipsis
                    style={{ display: 'block', fontSize: 14, fontWeight: 600, color: teamNameColor, lineHeight: 1.3 }}
                  >
                    {teamDisplayName}
                  </Text>
                  <span
                    style={{
                      display: 'inline-block',
                      marginTop: 3,
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '1px 8px',
                      borderRadius: 20,
                      backgroundColor: isDark ? 'rgba(251,146,60,0.15)' : '#fff7ed',
                      color: '#f97316',
                      border: `1px solid ${isDark ? 'rgba(251,146,60,0.3)' : '#fed7aa'}`,
                    }}
                  >
                    {t('trial-expired') || 'Trial Expired'}
                  </span>
                </div>
              </div>

              {/* Switch to another team dropdown trigger */}
              <Dropdown
                menu={{
                  items: dropdownItems,
                  style: {
                    maxHeight: '260px',
                    overflowY: 'auto',
                    padding: '4px',
                    borderRadius: '10px',
                    minWidth: '280px',
                  },
                }}
                trigger={['click']}
                placement="bottomLeft"
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: `1px solid ${dropdownBorder}`,
                    backgroundColor: dropdownBg,
                    cursor: 'pointer',
                    transition: 'background-color 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = isDark ? 'rgba(255,255,255,0.06)' : '#f5f6fc'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = dropdownBg}
                >
                  <Text style={{ fontSize: 13, color: dropdownText }}>
                    {t('switch-to-another-team') || 'Switch to another team...'}
                  </Text>
                  <Text style={{ fontSize: 11, color: dropdownText }}>▾</Text>
                </div>
              </Dropdown>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: 20, textAlign: 'center' }}>
        <Text style={{ fontSize: 13, color: footerColor }}>
          {t('need-help') || 'Need help?'}{' '}
          <a href="mailto:support@worklenz.com" style={{ color: footerLinkColor, textDecoration: 'none' }}>
            {t('contact-support') || 'Contact support'}
          </a>
          {' '}{t('or') || 'or'}{' '}
          <span
            style={{ color: footerLinkColor, cursor: 'pointer', textDecoration: 'none' }}
            onClick={() => navigate('/worklenz/admin-center/billing')}
          >
            {t('view-pricing') || 'view pricing'}
          </span>
        </Text>
      </div>
    </div>
  );
};

export default LicenseExpired;
