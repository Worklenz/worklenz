import { useEffect, useState, useMemo, useCallback, memo, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Col, ConfigProvider, Flex, Menu, Tooltip } from '@/shared/antd-imports';
import { CrownOutlined } from '@ant-design/icons';
import { createPortal } from 'react-dom';

import InviteTeamMembers from '../../components/common/invite-team-members/InviteTeamMembers';
import MobileMenuButton from './mobile-menu/MobileMenuButton';
import NavbarLogo from './NavbarLogo';
import NotificationButton from '../../components/navbar/notifications/notifications-drawer/notification/notification-button';
import ProfileButton from './user-profile/ProfileButton';
import SwitchTeamButton from './switch-team/SwitchTeamButton';
import UpgradePlanButton from './upgrade-plan/UpgradePlanButton';
import NotificationDrawer from '../../components/navbar/notifications/notifications-drawer/notification/notfication-drawer';
import AddClientDrawer from '@/ee/components/client-portal/AddClientDrawer';
import UpgradePromptModal from '@/components/upgrade/UpgradePromptModal';
import { TrialDaysBadge } from './trial-badge/TrialDaysBadge';

import { useResponsive } from '@/hooks/useResponsive';
import { getJSONFromLocalStorage } from '@/utils/localStorageFunctions';
import { navRoutes, NavRoutesType, isRouteGatedForFreePlan } from './navRoutes';
import { useAuthService } from '@/hooks/useAuth';
import { authApiService } from '@/api/auth/auth.api.service';
import { ISUBSCRIPTION_TYPE } from '@/shared/constants';
import logger from '@/utils/errorLogger';
import TimerButton from './timers/TimerButton';
import QuickActionButton from './quick-actions/QuickActionButton';
import GlobalSearchButton from './global-search/GlobalSearchButton';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { RootState } from '@/app/store';
import { selectCurrentProject } from '@/app/selectors';
import {
  toggleUpgradeModal,
  fetchOrganizationDetails,
} from '@/features/admin-center/admin-center.slice';
import { isTeamLeadRole, ROLE_DEFINITIONS, ROLE_NAMES } from '@/types/roles/role.types';
import { ConnectionStatusIndicator } from '@/components/connection-status/ConnectionStatusIndicator';
import { getSessionRoleName } from '@/utils/role-permissions.utils';

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
  const currentRole = useMemo(() => getSessionRoleName(currentSession), [currentSession]);
  const isFreePlan = currentSession?.subscription_type === ISUBSCRIPTION_TYPE.FREE;
  const canInviteMembers = ROLE_DEFINITIONS[currentRole].canInviteMembers;

  const { setIdentity } = useMixpanelTracking();
  const [navRoutesList, setNavRoutesList] = useState<NavRoutesType[]>(navRoutes);
  const showUpgradeTypes = useMemo(() => [ISUBSCRIPTION_TYPE.TRIAL], []);
  const organization = useAppSelector((state: RootState) => state.adminCenterReducer.organization);
  const currentProject = useAppSelector(selectCurrentProject);
  const guestProjectStateRef = useRef<{ projectId: string | null; isGuest: boolean }>({
    projectId: null,
    isGuest: false,
  });

  useEffect(() => {
    authApiService
      .verify(true)
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
      // Load user customizations (names of routes user wants visible)
      const pinnedRouteNames: string[] = getJSONFromLocalStorage('navRoutesPinned') || [];

      // Start with all default routes
      let routes = [...navRoutes];

      // If user has customizations, show only pinned routes + custom routes
      // Otherwise show all defaults
      if (pinnedRouteNames.length > 0) {
        routes = routes.filter(route => pinnedRouteNames.includes(route.name));
      }

      setNavRoutesList(routes);
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
      if (e.key === 'navRoutesPinned') loadNavRoutes();
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

  // Guest status is a per-project access level (project_members.access_level = GUEST).
  const routeProjectId = location.pathname.match(/\/projects\/([^/]+)/)?.[1] || null;
  const projectId = currentProject?.projectId || currentProject?.project?.id || routeProjectId;
  // currentProject.projectId updates synchronously on navigation, but
  // currentProject.project (and its is_guest flag) only updates once the async
  // fetch resolves — until then project still holds the PREVIOUS project's data,
  // so it must not be trusted just because it's truthy.
  const projectDataMatchesId = Boolean(projectId) && currentProject?.project?.id === projectId;
  const projectIsGuest = projectDataMatchesId ? Boolean(currentProject?.project?.is_guest) : false;
  const guestStatusStorageKey = projectId ? `worklenz.guestProject.${projectId}` : null;
  const storedProjectIsGuest = guestStatusStorageKey
    ? sessionStorage.getItem(guestStatusStorageKey) === 'true'
    : false;

  if (projectId && guestProjectStateRef.current.projectId !== projectId) {
    guestProjectStateRef.current = {
      projectId,
      isGuest: projectDataMatchesId ? projectIsGuest : storedProjectIsGuest,
    };
  } else if (projectId && projectDataMatchesId) {
    guestProjectStateRef.current.isGuest = projectIsGuest;
  }

  useEffect(() => {
    if (!guestStatusStorageKey || !projectDataMatchesId) return;

    if (projectIsGuest) {
      sessionStorage.setItem(guestStatusStorageKey, 'true');
    } else {
      sessionStorage.removeItem(guestStatusStorageKey);
    }
  }, [projectDataMatchesId, guestStatusStorageKey, projectIsGuest]);

  const isGuest = guestProjectStateRef.current.isGuest;
  const shouldHideGuestHome = isGuest;

  // Filtered NavRoutesType[] — shared by the desktop Menu (mapped below into
  // antd's {key, label} item shape) and MobileMenuButton, which needs the
  // original route objects (route.name, route.path, ...) rather than the
  // mapped-down menu items.
  const filteredRoutes = useMemo(() => {
    const isSelfHosted = currentSession?.subscription_type === ISUBSCRIPTION_TYPE.SELF_HOSTED;
    const isTeamLead = currentSession?.role_name ? isTeamLeadRole(currentSession.role_name) : false;

    return navRoutesList.filter(route => {
      if (route.adminOnly && !isOwnerOrAdmin) return false;
      if (route.selfHostedExcluded && isSelfHosted) return false;
      if (route.teamLeadOnly && !isTeamLead) return false;
      if (route.guestExcluded && shouldHideGuestHome) return false; // Hide Home for guest-only users
      return true;
    });
  }, [navRoutesList, isOwnerOrAdmin, currentSession, shouldHideGuestHome]);

  const visibleRoutes = useMemo(() => {
    return filteredRoutes
      .map((route, index) => {
        // Free-plan users are blocked from paid features at the nav level.
        // Business-plan-only sections (Clients, Finance) are no longer
        // blocked here — they navigate normally and show an in-page blurred
        // preview with an upgrade prompt for non-business users instead.
        const shouldDisable = isRouteGatedForFreePlan(route, isFreePlan);

        const defaultLabel = t(route.name);

        return {
          key: route.path.split('/').pop() || route.name,
          disabled: false,
          label: shouldDisable ? (
            <Tooltip title={tCommon('upgrade-plan')} placement="bottom">
              <span style={{ cursor: 'pointer', fontWeight: 500 }}>
                {defaultLabel}
                <CrownOutlined style={{ fontSize: '14px', color: '#faad14', marginLeft: '4px' }} />
              </span>
            </Tooltip>
          ) : (
            <Link to={route.path} style={{ fontWeight: 500 }}>
              {defaultLabel}
            </Link>
          ),
        };
      });
  }, [filteredRoutes, t, tCommon, isFreePlan]);

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

      const clickedRoute = navRoutesList.find(r => {
        const routeKey = r.path.split('/').pop() || r.name;
        return routeKey === key || r.name === key;
      });

      if (clickedRoute) {
        const shouldOpenModal = isRouteGatedForFreePlan(clickedRoute, isFreePlan);

        if (shouldOpenModal) {
          dispatch(toggleUpgradeModal());
        }
      }
    },
    [isFreePlan, navRoutesList, dispatch]
  );

  return (
    <Col
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        paddingInline: isDesktop ? 24 : 16,
        gap: 8,
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <Flex
        style={{
          width: '100%',
          display: 'flex',
          gap: 8,
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
            <ConfigProvider
              theme={{
                components: {
                  Menu: {
                    fontSize: 13.5,
                    itemHeight: 32,
                    itemPaddingInline: 12,
                    itemMarginInline: 1,
                    itemBorderRadius: 6,
                  },
                },
              }}
            >
              <Menu
                selectedKeys={[current]}
                mode="horizontal"
                style={{ flex: 10, maxWidth: 720, minWidth: 0, border: 'none', lineHeight: '32px' }}
                items={visibleRoutes}
                onClick={handleMenuClick}
              />
            </ConfigProvider>
          )}

          <Flex gap={12} align="center">
            <ConfigProvider wave={{ disabled: true }}>
              {isDesktop && (
                <Flex>
                  <Flex gap={12} align="center">
                    <TrialDaysBadge />
                    {isOwnerOrAdmin &&
                      showUpgradeTypes.includes(
                        currentSession?.subscription_type as ISUBSCRIPTION_TYPE
                      ) && <UpgradePlanButton showModal redirectToBilling={false} />}
                    <ConnectionStatusIndicator />
                    <Flex align="center" gap={6}>
                      <QuickActionButton
                        canInviteMembers={canInviteMembers}
                        isInviteRestricted={Boolean(currentSession?.is_expired)}
                        isGuest={isGuest}
                      />
                      {!isGuest && <TimerButton />}
                      <NotificationButton />
                      <GlobalSearchButton />
                      <SwitchTeamButton />
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
                  <MobileMenuButton routes={filteredRoutes} isFreePlan={isFreePlan} />
                </Flex>
              )}
              {isMobile && (
                <Flex gap={12} align="center">
                  <TrialDaysBadge />
                  <NotificationButton />
                  <ProfileButton isOwnerOrAdmin={isOwnerOrAdmin} />
                  <MobileMenuButton routes={filteredRoutes} isFreePlan={isFreePlan} />
                </Flex>
              )}
            </ConfigProvider>
          </Flex>
        </Flex>
      </Flex>

      {canInviteMembers && createPortal(<InviteTeamMembers />, document.body, 'invite-team-members')}
      {createPortal(<NotificationDrawer />, document.body, 'notification-drawer')}
      {createPortal(<AddClientDrawer />, document.body, 'add-client-drawer')}
      {createPortal(<UpgradePromptModal />, document.body, 'upgrade-prompt-modal')}
    </Col>
  );
};

export default memo(Navbar);
