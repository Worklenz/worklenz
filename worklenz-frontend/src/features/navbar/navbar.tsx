import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Col, ConfigProvider, Flex, Menu, Alert } from '@/components/ui';
import { createPortal } from 'react-dom';

import InviteTeamMembers from '../../components/common/invite-team-members/invite-team-members';
import InviteButton from './invite/invite-button';
import MobileMenuButton from './mobileMenu/mobile-menu-button';
import NavbarLogo from './navbar-logo';
import NotificationButton from '../../components/navbar/notifications/notifications-drawer/notification/notification-button';
import ProfileButton from './user-profile/profile-button';
import SwitchTeamButton from './switchTeam/switch-team-button';
import UpgradePlanButton from './upgradePlan/upgrade-plan-button';
import NotificationDrawer from '../../components/navbar/notifications/notifications-drawer/notification/notfication-drawer';

import { useResponsive } from '@/hooks/use-responsive';
import { getJSONFromLocalStorage } from '@/utils/local-storage-functions';
import { navRoutes, NavRoutesType } from './nav-routes';
import { useAuthService } from '@/hooks/use-auth';
import { authApiService } from '@/api/auth/auth.api.service';
import { ISUBSCRIPTION_TYPE } from '@/shared/constants';
import logger from '@/utils/error-logger';
import HelpButton from './help/help-button';

const Navbar = React.memo(() => {
  const [current, setCurrent] = useState<string>('home');
  const currentSession = useAuthService().getCurrentSession();
  const [daysUntilExpiry, setDaysUntilExpiry] = useState<number | null>(null);

  const location = useLocation();
  const { isDesktop, isMobile, isTablet } = useResponsive();
  const { t } = useTranslation('navbar');
  const authService = useAuthService();
  const [navRoutesList, setNavRoutesList] = useState<NavRoutesType[]>(navRoutes);
  const [isOwnerOrAdmin, setIsOwnerOrAdmin] = useState<boolean>(authService.isOwnerOrAdmin());

  // Memoize constants to avoid recreating arrays
  const showUpgradeTypes = useMemo(() => [ISUBSCRIPTION_TYPE.TRIAL], []);

  // Memoize authorization check to avoid unnecessary API calls
  const handleAuthorization = useCallback(async () => {
    try {
      const authorizeResponse = await authApiService.verify();
      if (authorizeResponse.authenticated) {
        authService.setCurrentSession(authorizeResponse.user);
        setIsOwnerOrAdmin(!!(authorizeResponse.user.is_admin || authorizeResponse.user.owner));
      }
    } catch (error) {
      logger.error('Error during authorization', error);
    }
  }, [authService]);

  useEffect(() => {
    handleAuthorization();
  }, [handleAuthorization]);

  // Memoize nav routes loading
  const loadNavRoutes = useCallback(() => {
    const storedNavRoutesList: NavRoutesType[] = getJSONFromLocalStorage('navRoutes') || navRoutes;
    setNavRoutesList(storedNavRoutesList);
  }, []);

  useEffect(() => {
    loadNavRoutes();
  }, [loadNavRoutes]);

  // Memoize expiry date calculation to avoid recalculating on every render
  const calculateDaysUntilExpiry = useCallback((trialExpireDate: string) => {
    const today = new Date();
    const expiryDate = new Date(trialExpireDate);
    const diffTime = expiryDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }, []);

  useEffect(() => {
    if (currentSession?.trial_expire_date) {
      const days = calculateDaysUntilExpiry(currentSession.trial_expire_date);
      setDaysUntilExpiry(days);
    }
  }, [currentSession?.trial_expire_date, calculateDaysUntilExpiry]);

  // Memoize navigation items to avoid recreating on every render
  const navlinkItems = useMemo(
    () =>
      navRoutesList
        .filter(route => {
          if (!route.freePlanFeature && currentSession?.subscription_type === ISUBSCRIPTION_TYPE.FREE) return false;
          if (route.adminOnly && !isOwnerOrAdmin) return false;       
          
          return true;
        })
        .map((route, index) => ({
          key: route.path.split('/').pop() || index,
          label: (
            <Link to={route.path} style={{ fontWeight: 600 }}>
              {t(route.name)}
            </Link>
          ),
        })),
    [navRoutesList, t, isOwnerOrAdmin, currentSession?.subscription_type]
  );

  // Memoize current path calculation
  const updateCurrentPath = useCallback(() => {
    const afterWorklenzString = location.pathname.split('/worklenz/')[1];
    const pathKey = afterWorklenzString?.split('/')[0];
    setCurrent(pathKey ?? 'home');
  }, [location.pathname]);

  useEffect(() => {
    updateCurrentPath();
  }, [updateCurrentPath]);

  // Memoize style objects to prevent recreation
  const containerStyle = useMemo(() => ({
    width: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    paddingInline: isDesktop ? 48 : 24,
    gap: 12,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  }), [isDesktop]);

  const flexStyle = useMemo(() => ({
    width: '100%',
    display: 'flex',
    gap: 12,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  }), []);

  const menuStyle = useMemo(() => ({
    flex: 10,
    maxWidth: 720,
    minWidth: 0,
    border: 'none',
  }), []);

  const innerFlexStyle = useMemo(() => ({
    width: '100%' as const,
  }), []);

  // Memoize conditional rendering logic
  const shouldShowUpgrade = useMemo(() => 
    isOwnerOrAdmin && showUpgradeTypes.includes(currentSession?.subscription_type as ISUBSCRIPTION_TYPE),
    [isOwnerOrAdmin, showUpgradeTypes, currentSession?.subscription_type]
  );

  // Memoize portal elements to prevent recreation
  const inviteTeamMembersPortal = useMemo(() => 
    isOwnerOrAdmin ? createPortal(<InviteTeamMembers />, document.body, 'invite-team-members') : null,
    [isOwnerOrAdmin]
  );

  const notificationDrawerPortal = useMemo(() => 
    createPortal(<NotificationDrawer />, document.body, 'notification-drawer'),
    []
  );

  return (
    <Col style={containerStyle}>
      <Flex style={flexStyle}>
        {/* logo */}
        <NavbarLogo />

        <Flex
          align="center"
          justify={isDesktop ? 'space-between' : 'flex-end'}
          style={innerFlexStyle}
        >
          {/* navlinks menu  */}
          {isDesktop && (
            <Menu
              selectedKeys={[current]}
              mode="horizontal"
              style={menuStyle}
              items={navlinkItems}
            />
          )}

          <Flex gap={20} align="center">
            <ConfigProvider wave={{ disabled: true }}>
              {isDesktop && (
                <Flex gap={20} align="center">
                  {shouldShowUpgrade && <UpgradePlanButton />}
                  {isOwnerOrAdmin && <InviteButton />}
                  <Flex align="center">
                    <SwitchTeamButton />
                    <NotificationButton />
                    {/* <TimerButton /> */}
                    <HelpButton />
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

      {inviteTeamMembersPortal}
      {notificationDrawerPortal}
    </Col>
  );
});

Navbar.displayName = 'Navbar';

export default Navbar;
