import { useEffect, useState, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Col, ConfigProvider, Flex, Menu, Tooltip, Button } from '@/shared/antd-imports';
import { CrownOutlined } from '@ant-design/icons';
import { createPortal } from 'react-dom';

import InviteTeamMembers from '../../components/common/invite-team-members/InviteTeamMembers';
import InviteButton from './invite/InviteButton';
import MobileMenuButton from './mobile-menu/MobileMenuButton';
import NavbarLogo from './NavbarLogo';
import NotificationButton from '../../components/navbar/notifications/notifications-drawer/notification/notification-button';
import ProfileButton from './user-profile/ProfileButton';
import SwitchTeamButton from './switch-team/SwitchTeamButton';
import UpgradePlanButton from './upgrade-plan/UpgradePlanButton';
import NotificationDrawer from '../../components/navbar/notifications/notifications-drawer/notification/notfication-drawer';

import { useResponsive } from '@/hooks/useResponsive';
import { getJSONFromLocalStorage } from '@/utils/localStorageFunctions';
import { navRoutes, NavRoutesType } from './navRoutes';
import { useAuthService } from '@/hooks/useAuth';
import { authApiService } from '@/api/auth/auth.api.service';
import { ISUBSCRIPTION_TYPE } from '@/shared/constants';
import logger from '@/utils/errorLogger';
import TimerButton from './timers/TimerButton';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { hasBusinessFeatureAccess } from '@/utils/subscription-utils';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { toggleUpgradeModal } from '@/features/admin-center/admin-center.slice';

const Navbar = () => {
  const dispatch = useAppDispatch();
  const [current, setCurrent] = useState<string>('home');
  const currentSession = useAuthService().getCurrentSession();
  const [daysUntilExpiry, setDaysUntilExpiry] = useState<number | null>(null);

  const location = useLocation();
  const { isDesktop, isMobile, isTablet } = useResponsive();
  const { t } = useTranslation('navbar');
  const { t: tCommon } = useTranslation('common');
  const authService = useAuthService();
  const { setIdentity } = useMixpanelTracking();
  const [navRoutesList, setNavRoutesList] = useState<NavRoutesType[]>(navRoutes);
  const [isOwnerOrAdmin, setIsOwnerOrAdmin] = useState<boolean>(authService.isOwnerOrAdmin());
  const showUpgradeTypes = [ISUBSCRIPTION_TYPE.TRIAL];

  useEffect(() => {
    authApiService
      .verify()
      .then(authorizeResponse => {
        if (authorizeResponse.authenticated) {
          authService.setCurrentSession(authorizeResponse.user);
          setIdentity(authorizeResponse.user);
          setIsOwnerOrAdmin(!!(authorizeResponse.user.is_admin || authorizeResponse.user.owner));
        }
      })
      .catch(error => {
        logger.error('Error during authorization', error);
      });
  }, []);

  useEffect(() => {
    const storedNavRoutesList: NavRoutesType[] = getJSONFromLocalStorage('navRoutes') || navRoutes;
    setNavRoutesList(storedNavRoutesList);
  }, []);

  useEffect(() => {
    if (currentSession?.trial_expire_date) {
      const today = new Date();
      const expiryDate = new Date(currentSession.trial_expire_date);
      const diffTime = expiryDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      setDaysUntilExpiry(diffDays);
    }
  }, [currentSession?.trial_expire_date]);

  const navlinkItems = useMemo(() => {
    const hasBusinessAccess = hasBusinessFeatureAccess(currentSession);
    const isFreePlan = currentSession?.subscription_type === ISUBSCRIPTION_TYPE.FREE;

    return navRoutesList
      .filter(route => {
        if (route.adminOnly && !isOwnerOrAdmin) return false;
        return true;
      })
      .map((route, index) => {
        const isBusinessRoute = route.businessPlanRequired;
        const isFreePlanRoute = !route.freePlanFeature;
        const shouldDisable =
          (isBusinessRoute && !hasBusinessAccess) || (isFreePlanRoute && isFreePlan);

        return {
          key: route.path.split('/').pop() || route.name,
          disabled: false, // Don't disable the menu item so click events work
          label: shouldDisable ? (
            <Tooltip
              title={
                isFreePlanRoute && isFreePlan
                  ? tCommon('upgrade-plan')
                  : tCommon('business-plan-upgrade')
              }
              placement="bottom"
            >
              <span
                className="disabled-navlink disabled-navlink-with-crown"
                style={{
                  cursor: 'pointer',
                  color: '#8c8c8c',
                  opacity: 0.6,
                }}
              >
                {t(route.name)}
                <CrownOutlined style={{ fontSize: '14px', color: '#faad14' }} />
              </span>
            </Tooltip>
          ) : (
            <Link to={route.path} style={{ fontWeight: 600 }}>
              {t(route.name)}
            </Link>
          ),
        };
      });
  }, [navRoutesList, t, isOwnerOrAdmin, currentSession, tCommon, dispatch]);

  useEffect(() => {
    const afterWorklenzString = location.pathname.split('/worklenz/')[1];
    const pathKey = afterWorklenzString.split('/')[0];

    setCurrent(pathKey ?? 'home');
  }, [location]);

  return (
    <Col
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        paddingInline: isDesktop ? 48 : 24,
        gap: 12,
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <Flex
        style={{
          width: '100%',
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* logo */}
        <NavbarLogo />

        <Flex
          align="center"
          justify={isDesktop ? 'space-between' : 'flex-end'}
          style={{ width: '100%' }}
        >
          {/* navlinks menu  */}
          {isDesktop && (
            <Menu
              selectedKeys={[current]}
              mode="horizontal"
              style={{
                flex: 10,
                maxWidth: 720,
                minWidth: 0,
                border: 'none',
              }}
              items={navlinkItems}
              onClick={({ key }) => {
                // Handle clicks on disabled items to open upgrade modal
                const hasBusinessAccess = hasBusinessFeatureAccess(currentSession);
                const isFreePlan = currentSession?.subscription_type === ISUBSCRIPTION_TYPE.FREE;

                const clickedRoute = navRoutesList.find(r => {
                  const routeKey = r.path.split('/').pop() || r.name;
                  return routeKey === key || r.name === key;
                });

                if (clickedRoute) {
                  const isBusinessRoute = clickedRoute.businessPlanRequired;
                  const isFreePlanRoute = !clickedRoute.freePlanFeature;
                  const shouldOpenModal =
                    (isBusinessRoute && !hasBusinessAccess) || (isFreePlanRoute && isFreePlan);

                  if (shouldOpenModal) {
                    dispatch(toggleUpgradeModal());
                  }
                }
              }}
            />
          )}

          <Flex gap={20} align="center">
            <ConfigProvider wave={{ disabled: true }}>
              {isDesktop && (
                <Flex gap={20} align="center">
                  {isOwnerOrAdmin &&
                    showUpgradeTypes.includes(
                      currentSession?.subscription_type as ISUBSCRIPTION_TYPE
                    ) && <UpgradePlanButton />}
                  {isOwnerOrAdmin && <InviteButton />}
                  <Flex align="center">
                    <SwitchTeamButton />
                    <NotificationButton />
                    <TimerButton />
                    {/* <HelpButton /> */}
                    <ProfileButton isOwnerOrAdmin={isOwnerOrAdmin} />
                  </Flex>
                </Flex>
              )}
              {isTablet && !isDesktop && (
                <Flex gap={12} align="center">
                  <SwitchTeamButton />
                  <NotificationButton />
                  <ProfileButton isOwnerOrAdmin={isOwnerOrAdmin} />
                  <MobileMenuButton />
                </Flex>
              )}
              {isMobile && (
                <Flex gap={12} align="center">
                  <NotificationButton />
                  <ProfileButton isOwnerOrAdmin={isOwnerOrAdmin} />
                  <MobileMenuButton />
                </Flex>
              )}
            </ConfigProvider>
          </Flex>
        </Flex>
      </Flex>

      {isOwnerOrAdmin && createPortal(<InviteTeamMembers />, document.body, 'invite-team-members')}
      {createPortal(<NotificationDrawer />, document.body, 'notification-drawer')}
    </Col>
  );
};

export default Navbar;
