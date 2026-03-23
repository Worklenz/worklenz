// import {
//   Button,
//   Card,
//   Typography,
//   Space,
//   Flex,
//   Dropdown,
//   Divider,
//   Tag,
//   Alert,
//   List,
// } from '@/shared/antd-imports';
// import { useTranslation } from 'react-i18next';
// import { useNavigate } from 'react-router-dom';
// import { useAuthService } from '@/hooks/useAuth';
// import { useAppDispatch } from '@/hooks/useAppDispatch';
// import { useAppSelector } from '@/hooks/useAppSelector';
// import { fetchTeams, setActiveTeam } from '@/features/teams/teamSlice';
// import { verifyAuthentication } from '@/features/auth/authSlice';
// import { setUser } from '@/features/user/userSlice';
// import { createAuthService } from '@/services/auth/auth.service';
// import { supportApiService } from '@/api/support/support.api.service';
// import { ISUBSCRIPTION_TYPE } from '@/shared/constants';
// import { useState, useEffect } from 'react';
// import {
//   ClockCircleOutlined,
//   CrownOutlined,
//   CustomerServiceOutlined,
//   BankOutlined,
//   CaretDownFilled,
//   CheckCircleFilled,
//   InfoCircleOutlined,
// } from '@ant-design/icons';
// import CustomAvatar from '@/components/CustomAvatar';
// import { colors } from '@/styles/colors';

// const { Title, Text, Paragraph } = Typography;

// const LicenseExpired = () => {
//   const navigate = useNavigate();
//   const dispatch = useAppDispatch();
//   const { t } = useTranslation('common');
//   const authService = useAuthService();
//   const authServiceInstance = createAuthService(navigate);
//   const [isContactingSupport, setIsContactingSupport] = useState(false);
//   const [messageSent, setMessageSent] = useState(false);

//   const teamsList = useAppSelector(state => state.teamReducer.teamsList);
//   const themeMode = useAppSelector(state => state.themeReducer.mode);
//   const session = authService?.getCurrentSession();
//   const subscriptionType =
//     (session?.subscription_type as ISUBSCRIPTION_TYPE) || ISUBSCRIPTION_TYPE.TRIAL;

//   useEffect(() => {
//     dispatch(fetchTeams());
//   }, [dispatch]);

//   const isActiveTeam = (teamId: string): boolean => {
//     if (!teamId || !session?.team_id) return false;
//     return teamId === session.team_id;
//   };

//   const handleVerifyAuth = async () => {
//     const result = await dispatch(verifyAuthentication()).unwrap();
//     if (result.authenticated) {
//       dispatch(setUser(result.user));
//       authServiceInstance.setCurrentSession(result.user);
//     }
//   };

//   const handleTeamSelect = async (id: string) => {
//     if (!id) return;
//     try {
//       await dispatch(setActiveTeam(id));
//       await handleVerifyAuth();
//       // Redirect to home page after switching teams
//       navigate('/worklenz/home');
//       // Force a full reload to ensure the new team session is properly loaded
//       window.location.href = '/worklenz/home';
//     } catch (error) {
//       console.error('Failed to switch team:', error);
//     }
//   };

//   const handleUpgrade = async () => {
//     if (subscriptionType === ISUBSCRIPTION_TYPE.CUSTOM) {
//       if (messageSent) return;

//       try {
//         setIsContactingSupport(true);
//         await supportApiService.contactSupport({
//           subscription_type: subscriptionType,
//           reason: 'Custom plan renewal/support request',
//         });
//         setMessageSent(true);
//       } catch (error) {
//         console.error('Failed to contact support:', error);
//       } finally {
//         setIsContactingSupport(false);
//       }
//     } else {
//       navigate('/worklenz/admin-center/billing');
//     }
//   };

//   const getTitle = () => {
//     switch (subscriptionType) {
//       case ISUBSCRIPTION_TYPE.TRIAL:
//         return t('license-expired-trial-title');
//       case ISUBSCRIPTION_TYPE.CUSTOM:
//         return t('license-expired-custom-title');
//       default:
//         return t('license-expired-title');
//     }
//   };

//   const getSubtitle = () => {
//     switch (subscriptionType) {
//       case ISUBSCRIPTION_TYPE.TRIAL:
//         return t('license-expired-trial-subtitle');
//       case ISUBSCRIPTION_TYPE.CUSTOM:
//         return t('license-expired-custom-subtitle');
//       default:
//         return t('license-expired-subtitle');
//     }
//   };

//   const getFeaturesTitle = () => {
//     switch (subscriptionType) {
//       case ISUBSCRIPTION_TYPE.TRIAL:
//         return t('license-expired-trial-features');
//       case ISUBSCRIPTION_TYPE.CUSTOM:
//         return t('license-expired-custom-features');
//       default:
//         return t('license-expired-features');
//     }
//   };

//   const getUpgradeText = () => {
//     switch (subscriptionType) {
//       case ISUBSCRIPTION_TYPE.TRIAL:
//         return t('license-expired-trial-upgrade');
//       case ISUBSCRIPTION_TYPE.CUSTOM:
//         return t('license-expired-custom-upgrade');
//       default:
//         return t('license-expired-upgrade');
//     }
//   };

//   const getUpgradeIcon = () => {
//     switch (subscriptionType) {
//       case ISUBSCRIPTION_TYPE.CUSTOM:
//         return <CustomerServiceOutlined />;
//       default:
//         return <CrownOutlined />;
//     }
//   };

//   const features = [
//     t('license-expired-feature-1'),
//     t('license-expired-feature-2'),
//     t('license-expired-feature-3'),
//     t('license-expired-feature-4'),
//   ];

//   const renderTeamCard = (team: any) => (
//     <div
//       onClick={() => handleTeamSelect(team.id)}
//       style={{
//         cursor: 'pointer',
//         padding: '8px 12px',
//         backgroundColor: isActiveTeam(team.id)
//           ? themeMode === 'dark'
//             ? 'rgba(24, 144, 255, 0.15)'
//             : '#e6f7ff'
//           : 'transparent',
//         borderRadius: '6px',
//         transition: 'all 0.2s ease',
//       }}
//       className="hover:bg-gray-100 dark:hover:bg-gray-800"
//     >
//       <Flex gap={8} align="center" justify="space-between">
//         <Flex gap={8} align="center" style={{ flex: 1, minWidth: 0 }}>
//           <CustomAvatar avatarName={team.name || ''} size={28} />
//           <Flex vertical style={{ flex: 1, minWidth: 0 }}>
//             <Typography.Text
//               style={{
//                 fontSize: 13,
//                 fontWeight: isActiveTeam(team.id) ? 600 : 400,
//                 color:
//                   themeMode === 'dark'
//                     ? isActiveTeam(team.id)
//                       ? '#fff'
//                       : 'rgba(255, 255, 255, 0.85)'
//                     : isActiveTeam(team.id)
//                       ? '#000'
//                       : 'rgba(0, 0, 0, 0.85)',
//                 lineHeight: '18px',
//               }}
//               ellipsis
//             >
//               {team.name}
//             </Typography.Text>
//             <Typography.Text
//               style={{
//                 fontSize: 11,
//                 color: themeMode === 'dark' ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.45)',
//                 lineHeight: '16px',
//               }}
//               ellipsis
//             >
//               {team.owns_by}
//             </Typography.Text>
//           </Flex>
//         </Flex>
//         {isActiveTeam(team.id) && (
//           <CheckCircleFilled
//             style={{
//               fontSize: 14,
//               color: '#1890ff',
//               flexShrink: 0,
//             }}
//           />
//         )}
//       </Flex>
//     </div>
//   );

//   const dropdownItems =
//     teamsList?.map(team => ({
//       key: team.id || '',
//       label: renderTeamCard(team),
//       type: 'item' as const,
//     })) || [];

//   return (
//     <div className="py-8 px-4 md:px-6 max-w-6xl mx-auto h-[calc(100vh-80px)] flex flex-col">
//       {/* Hero Section with Icon and Title */}
//       <div className="text-center mb-8">
//         <div
//           className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
//           style={{
//             backgroundColor: themeMode === 'dark' ? 'rgba(250, 173, 20, 0.15)' : '#fff7e6',
//             border: `3px solid ${themeMode === 'dark' ? 'rgba(250, 173, 20, 0.4)' : '#ffc53d'}`,
//             boxShadow:
//               themeMode === 'dark'
//                 ? '0 4px 12px rgba(250, 173, 20, 0.1)'
//                 : '0 4px 12px rgba(250, 173, 20, 0.15)',
//           }}
//         >
//           <ClockCircleOutlined
//             style={{
//               fontSize: 32,
//               color: '#faad14',
//             }}
//           />
//         </div>
//         <Title level={2} className="mb-3 text-2xl md:text-3xl" style={{ fontWeight: 600 }}>
//           {getTitle()}
//         </Title>
//         <Paragraph
//           className="text-base md:text-lg mb-0 max-w-2xl mx-auto"
//           style={{
//             color: themeMode === 'dark' ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.65)',
//             lineHeight: '1.6',
//           }}
//         >
//           {getSubtitle()}
//         </Paragraph>
//       </div>

//       {/* Main Content Grid */}
//       <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 min-h-0">
//         {/* Features Card */}
//         <Card
//           variant="borderless"
//           className="flex flex-col"
//           style={{
//             backgroundColor: themeMode === 'dark' ? 'rgba(24, 144, 255, 0.05)' : '#f0f9ff',
//             height: '100%',
//             borderRadius: '12px',
//             boxShadow:
//               themeMode === 'dark'
//                 ? '0 2px 8px rgba(0, 0, 0, 0.3)'
//                 : '0 2px 8px rgba(0, 0, 0, 0.06)',
//           }}
//           styles={{
//             body: {
//               height: '100%',
//               display: 'flex',
//               flexDirection: 'column',
//             },
//           }}
//         >
//           <Space direction="vertical" size="middle" style={{ width: '100%', height: '100%' }}>
//             <Flex align="center" gap={10}>
//               <div
//                 className="flex items-center justify-center w-10 h-10 rounded-lg"
//                 style={{
//                   backgroundColor: themeMode === 'dark' ? 'rgba(24, 144, 255, 0.2)' : '#e6f7ff',
//                   border: themeMode === 'dark' ? '1px solid rgba(24, 144, 255, 0.3)' : 'none',
//                 }}
//               >
//                 <CrownOutlined style={{ fontSize: 18, color: '#1890ff' }} />
//               </div>
//               <Title level={4} className="mb-0 text-lg" style={{ fontWeight: 600 }}>
//                 {getFeaturesTitle()}
//               </Title>
//             </Flex>
//             <List
//               dataSource={features}
//               split={false}
//               renderItem={feature => (
//                 <List.Item className="py-3 px-0 border-0">
//                   <Space align="start" size={10}>
//                     <CheckCircleFilled
//                       style={{
//                         color: '#52c41a',
//                         fontSize: 16,
//                         marginTop: 3,
//                       }}
//                     />
//                     <Text
//                       className="text-base leading-relaxed"
//                       style={{
//                         color:
//                           themeMode === 'dark'
//                             ? 'rgba(255, 255, 255, 0.85)'
//                             : 'rgba(0, 0, 0, 0.85)',
//                       }}
//                     >
//                       {feature}
//                     </Text>
//                   </Space>
//                 </List.Item>
//               )}
//             />
//           </Space>
//         </Card>

//         {/* CTA and Action Card */}
//         <Card
//           variant="borderless"
//           className="flex flex-col justify-between"
//           style={{
//             height: '100%',
//             borderRadius: '12px',
//             backgroundColor: themeMode === 'dark' ? 'rgba(255, 255, 255, 0.02)' : '#ffffff',
//             boxShadow:
//               themeMode === 'dark'
//                 ? '0 2px 8px rgba(0, 0, 0, 0.3)'
//                 : '0 2px 8px rgba(0, 0, 0, 0.06)',
//           }}
//           styles={{
//             body: {
//               height: '100%',
//               display: 'flex',
//               flexDirection: 'column',
//             },
//           }}
//         >
//           <Space direction="vertical" size="middle" style={{ width: '100%' }}>
//             {/* Primary CTA */}
//             <div className="text-center">
//               <Button
//                 type="primary"
//                 size="large"
//                 onClick={handleUpgrade}
//                 loading={isContactingSupport && subscriptionType === ISUBSCRIPTION_TYPE.CUSTOM}
//                 icon={!isContactingSupport ? getUpgradeIcon() : undefined}
//                 block
//                 className="h-12 text-base font-semibold"
//                 style={{
//                   borderRadius: '8px',
//                   boxShadow: '0 2px 4px rgba(24, 144, 255, 0.2)',
//                 }}
//               >
//                 {subscriptionType === ISUBSCRIPTION_TYPE.CUSTOM
//                   ? messageSent
//                     ? t('license-expired-message-sent')
//                     : isContactingSupport
//                       ? t('license-expired-contacting-support')
//                       : getUpgradeText()
//                   : getUpgradeText()}
//               </Button>

//               <Divider className="my-4" style={{ margin: '16px 0' }}>
//                 {t('or')}
//               </Divider>

//               <Text
//                 type="secondary"
//                 style={{
//                   cursor: 'pointer',
//                   fontSize: '14px',
//                   transition: 'color 0.2s',
//                 }}
//                 className="hover:underline inline-block"
//                 onClick={() => navigate('/worklenz/admin-center/billing')}
//               >
//                 {t('switch-to-free-plan')}
//               </Text>
//             </div>

//             {/* Team Switcher or Info */}
//             {teamsList && teamsList.length > 1 ? (
//               <>
//                 <Divider style={{ margin: '20px 0' }} />
//                 <div className="space-y-3">
//                   <Flex align="center" gap={10}>
//                     <div
//                       className="flex items-center justify-center w-8 h-8 rounded-lg"
//                       style={{
//                         backgroundColor:
//                           themeMode === 'dark' ? 'rgba(82, 196, 26, 0.15)' : '#f6ffed',
//                         border: themeMode === 'dark' ? '1px solid rgba(82, 196, 26, 0.3)' : 'none',
//                       }}
//                     >
//                       <BankOutlined style={{ fontSize: 14, color: '#52c41a' }} />
//                     </div>
//                     <Title level={5} className="mb-0 text-base" style={{ fontWeight: 600 }}>
//                       {t('switch-team-to-continue')}
//                     </Title>
//                   </Flex>

//                   <Text
//                     type="secondary"
//                     className="text-sm block"
//                     style={{
//                       color:
//                         themeMode === 'dark' ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.45)',
//                     }}
//                   >
//                     {t('switch-team-active-subscription')}
//                   </Text>

//                   <div
//                     style={{
//                       padding: '12px',
//                       borderRadius: '8px',
//                       backgroundColor:
//                         themeMode === 'dark' ? 'rgba(255, 255, 255, 0.04)' : '#fafafa',
//                     }}
//                   >
//                     <Text
//                       type="secondary"
//                       className="text-xs block mb-1"
//                       style={{ fontWeight: 500 }}
//                     >
//                       {t('current-team')}:
//                     </Text>
//                     <Text strong className="text-sm">
//                       {session?.team_name || t('select-team')}
//                     </Text>
//                   </div>

//                   <Dropdown
//                     menu={{
//                       items: dropdownItems,
//                       style: {
//                         maxWidth: '280px',
//                         maxHeight: '280px',
//                         overflowY: 'auto',
//                         padding: '4px',
//                       },
//                     }}
//                     trigger={['click']}
//                     placement="bottomLeft"
//                     overlayStyle={{ maxWidth: '280px' }}
//                   >
//                     <Button
//                       size="middle"
//                       block
//                       icon={<BankOutlined />}
//                       style={{
//                         height: '40px',
//                         borderRadius: '8px',
//                       }}
//                     >
//                       <Flex
//                         gap={8}
//                         align="center"
//                         justify="space-between"
//                         style={{ width: '100%' }}
//                       >
//                         <span className="text-sm">{t('select-team')}</span>
//                         <CaretDownFilled />
//                       </Flex>
//                     </Button>
//                   </Dropdown>
//                 </div>
//               </>
//             ) : (
//               <></>
//             )}
//           </Space>
//         </Card>
//       </div>
//     </div>
//   );
// };

// export default LicenseExpired;





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
  ThunderboltOutlined,
  RocketOutlined,
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
      navigate('worklenz/admin-center/billing');
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
