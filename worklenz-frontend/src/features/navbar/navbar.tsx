import { useEffect, useState, useMemo, useCallback, memo } from 'react';
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
import { TrialDaysBadge } from './trial-badge/TrialDaysBadge';

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
import { useAppSelector } from '@/hooks/useAppSelector';
import { RootState } from '@/app/store';
import {
  toggleUpgradeModal,
  fetchOrganizationDetails,
} from '@/features/admin-center/admin-center.slice';
import { isTeamLeadRole } from '@/types/roles/role.types';
import { ConnectionStatusIndicator } from '@/components/connection-status/ConnectionStatusIndicator';
import { useAuthStatus } from '@/hooks/useAuthStatus';
import { evt_paywall_hit } from '@/shared/worklenz-analytics-events';

const Navbar = () => {
  const dispatch = useAppDispatch();
  const [current, setCurrent] = useState<string>('home');
  const [daysUntilExpiry, setDaysUntilExpiry] = useState<number | null>(null);

  const location = useLocation();
  const { isDesktop, isMobile, isTablet } = useResponsive();
  const { t } = useTranslation('navbar');
  const { t: tCommon } = useTranslation('common');

  // Get auth service and memoize derived values
  const authService = useAuthService();
  const currentSession = useMemo(() => authService.getCurrentSession(), [authService]);
  const isOwnerOrAdmin = useMemo(() => authService.isOwnerOrAdmin(), [authService]);

  const { setIdentity, trackMixpanelEvent } = useMixpanelTracking();
  const { isLicenseExpired } = useAuthStatus();
  const [navRoutesList, setNavRoutesList] = useState<NavRoutesType[]>(navRoutes);
  const showUpgradeTypes = useMemo(() => [ISUBSCRIPTION_TYPE.TRIAL], []);
  const organization = useAppSelector((state: RootState) => state.adminCenterReducer.organization);

  useEffect(() => {
    authApiService
      .verify()
      .then(authorizeResponse => {
        if (authorizeResponse.authenticated) {
          authService.setCurrentSession(authorizeResponse.user);
          setIdentity(authorizeResponse.user);
        }
      })
      .catch(error => {
        logger.error('Error during authorization', error);
      });
  }, [authService, setIdentity]);

  // Fetch organization details for navbar logo if not already loaded
  useEffect(() => {
    if (currentSession && !organization && isOwnerOrAdmin) {
      dispatch(fetchOrganizationDetails());
    }
  }, [currentSession, organization, isOwnerOrAdmin, dispatch]);

  useEffect(() => {
    // Shared loader — used by all event sources below
    const loadNavRoutes = () => {
      const updated: NavRoutesType[] = getJSONFromLocalStorage('navRoutes') || navRoutes;
      setNavRoutesList(updated);
    };

    // Initial load
    loadNavRoutes();

    // Same-tab updates: fires when PinRouteToNavbarButton calls
    // window.dispatchEvent(new Event('navRoutesUpdated'))
    window.addEventListener('navRoutesUpdated', loadNavRoutes);

    // Cross-tab / testing environment updates: the native 'storage' event fires
    // automatically when localStorage is written from a DIFFERENT tab or context.
    // It does NOT fire in the same tab that wrote — that's covered by the custom
    // event above — so together these two cover every possible scenario.
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'navRoutes') loadNavRoutes();
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('navRoutesUpdated', loadNavRoutes);
      window.removeEventListener('storage', handleStorageChange);
    };
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
    const isSelfHosted = currentSession?.subscription_type === ISUBSCRIPTION_TYPE.SELF_HOSTED;

    const isTeamLead = currentSession?.role_name ? isTeamLeadRole(currentSession.role_name) : false;

    return navRoutesList
      .filter(route => {
        if (route.adminOnly && !isOwnerOrAdmin) return false;
        if (route.selfHostedExcluded && isSelfHosted) return false;
        if (route.teamLeadOnly && !isTeamLead) return false;
        return true;
      })
      .map((route, index) => {
        const isBusinessRoute = route.businessPlanRequired;
        const isFreePlanRoute = !route.freePlanFeature;
        const shouldDisable =
          (isBusinessRoute && !hasBusinessAccess) || (isFreePlanRoute && isFreePlan);

        return {
          key: route.path.split('/').pop() || route.name,
          disabled: false,
          label: shouldDisable ? (
            <Tooltip
              title={
                isFreePlanRoute && isFreePlan
                  ? tCommon('upgrade-plan')
                  : tCommon('business-plan-upgrade')
              }
              placement="bottom"
            >
              <span style={{ cursor: 'pointer', fontWeight: 600 }}>
                {t(route.name, {
                  defaultValue: route.name.charAt(0).toUpperCase() + route.name.slice(1),
                })}
                <CrownOutlined style={{ fontSize: '14px', color: '#faad14', marginLeft: '4px' }} />
              </span>
            </Tooltip>
          ) : (
            <Link to={route.path} style={{ fontWeight: 600 }}>
              {t(route.name, {
                defaultValue: route.name.charAt(0).toUpperCase() + route.name.slice(1),
              })}
            </Link>
          ),
        };
      });
  }, [navRoutesList, t, isOwnerOrAdmin, currentSession, tCommon, dispatch]);

  const currentRoute = useMemo(() => {
    const afterWorklenzString = location.pathname.split('/worklenz/')[1];
    const pathKey = afterWorklenzString?.split('/')[0];
    return pathKey ?? 'home';
  }, [location.pathname]);

  useEffect(() => {
    if (currentRoute !== current) {
      setCurrent(currentRoute);
    }
  }, [currentRoute, current]);

  const handleMenuClick = useCallback(
    (menuInfo: { key: string }) => {
      const { key } = menuInfo;
      const hasBusinessAccess = hasBusinessFeatureAccess(currentSession);
      const isFreePlan = currentSession?.subscription_type === ISUBSCRIPTION_TYPE.FREE;

      const clickedRoute = navRoutesList.find(r => {
        const routeKey = r.path.split('/').pop() || r.name;
        return routeKey === key || r.name === key;
      });

      if (clickedRoute) {
        if (clickedRoute.name === 'client-portal') {
          trackMixpanelEvent('client_portal_nav_clicked', {
            source: 'navbar',
            user_type: isFreePlan ? 'free' : currentSession?.subscription_type?.toLowerCase(),
            is_admin: isOwnerOrAdmin,
          });
        }

        const isBusinessRoute = clickedRoute.businessPlanRequired;
        const isFreePlanRoute = !clickedRoute.freePlanFeature;
        const shouldOpenModal =
          (isBusinessRoute && !hasBusinessAccess) || (isFreePlanRoute && isFreePlan);

        if (shouldOpenModal) {
          if (isLicenseExpired && clickedRoute.name === 'client-portal') {
            trackMixpanelEvent(evt_paywall_hit, {
              feature_blocked: 'client_portal',
              user_type: currentSession?.subscription_type?.toLowerCase(),
              trial_expired: true,
              source: 'navbar',
            });
          }
          dispatch(toggleUpgradeModal());
        }
      }
    },
    [currentSession, navRoutesList, trackMixpanelEvent, isOwnerOrAdmin, dispatch]
  );

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
          {isDesktop && (
            <Menu
              selectedKeys={[current]}
              mode="horizontal"
              style={{ flex: 10, maxWidth: 720, minWidth: 0, border: 'none' }}
              items={navlinkItems}
              onClick={handleMenuClick}
            />
          )}

          <Flex gap={20} align="center">
            <ConfigProvider wave={{ disabled: true }}>
              {isDesktop && (
                <Flex>
                  <Flex gap={20} align="center">
                    <TrialDaysBadge />
                    {isOwnerOrAdmin &&
                      showUpgradeTypes.includes(
                        currentSession?.subscription_type as ISUBSCRIPTION_TYPE
                      ) && <UpgradePlanButton showModal redirectToBilling={false} />}
                    {isOwnerOrAdmin && <InviteButton />}
                    <Flex align="center">
                      <ConnectionStatusIndicator />
                      <SwitchTeamButton />
                      <NotificationButton />
                      <TimerButton />
                      {/* <HelpButton /> */}
                      <ProfileButton isOwnerOrAdmin={isOwnerOrAdmin} />
                    </Flex>
                  </Flex>
                </Flex>
              )}
              {isTablet && !isDesktop && (
                <Flex gap={12} align="center">
                  <TrialDaysBadge />
                  <SwitchTeamButton />
                  <NotificationButton />
                  <ProfileButton isOwnerOrAdmin={isOwnerOrAdmin} />
                  <MobileMenuButton />
                </Flex>
              )}
              {isMobile && (
                <Flex gap={12} align="center">
                  <TrialDaysBadge />
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

export default memo(Navbar);
