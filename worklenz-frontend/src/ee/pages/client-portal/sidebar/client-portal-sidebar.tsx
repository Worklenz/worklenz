import { useState, useMemo, useCallback } from 'react';
import { Button, Drawer } from '@/shared/antd-imports';
import { MenuOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../../../../hooks/useAppSelector';
import { themeWiseColor } from '../../../../utils/themeWiseColor';
import { useResponsive } from '../../../../hooks/useResponsive';
import { useMixpanelTracking } from '../../../../hooks/useMixpanelTracking';
import { MixpanelEvents, ClientPortalNavigationEventProps } from '../../../../types/mixpanel-events.types';
import { colors } from '../../../../styles/colors';
import NavRail from '@/components/nav-rail/NavRail';
import { useNavPreferences } from '@/features/navigation/useNavPreferences';
import type { NavItem } from '@/features/navigation/nav-registry.types';

const ClientPortalSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation('client-portal-common');
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const isDark = themeMode === 'dark';
  const { isMobile } = useResponsive();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { trackMixpanelEvent } = useMixpanelTracking();

  const { resolved, pin, unpin, isPinned, reorder, toggleCollapsed } = useNavPreferences('client-portal');

  const activeKey = useMemo(() => {
    const afterWorklenzString = location.pathname?.split('/worklenz/client-portal/')[1];
    return afterWorklenzString?.split('/')[0] || '';
  }, [location.pathname]);

  const renderLabel = useCallback(
    (item: NavItem) => {
      if (typeof item.label === 'string') return item.label;
      return t(item.label.i18nKey, { defaultValue: item.label.defaultValue });
    },
    [t]
  );

  const handleSelect = useCallback(
    (itemKey: string) => {
      const navigationProps: ClientPortalNavigationEventProps = {
        from_page: activeKey,
        to_page: itemKey,
        navigation_method: 'sidebar',
        page: 'client_portal',
        source: 'sidebar',
      };
      trackMixpanelEvent(MixpanelEvents.CLIENT_PORTAL_NAVIGATION, navigationProps);
      navigate(`/worklenz/client-portal/${itemKey}`);
      setMobileMenuOpen(false);
    },
    [activeKey, trackMixpanelEvent, navigate]
  );

  const navRail = (
    <NavRail
      resolved={resolved}
      activeKey={activeKey}
      isDark={isDark}
      onSelect={handleSelect}
      isPinned={isPinned}
      onPin={pin}
      onUnpin={unpin}
      onReorder={reorder}
      onToggleCollapse={toggleCollapsed}
      renderLabel={renderLabel}
    />
  );

  if (isMobile) {
    return (
      <>
        <Button
          type="text"
          icon={<MenuOutlined />}
          onClick={() => setMobileMenuOpen(true)}
          style={{
            position: 'fixed',
            top: 68,
            left: 16,
            zIndex: 1001,
            background: themeWiseColor('#fff', colors.darkGray, themeMode),
            border: `1px solid ${themeWiseColor('#f0f0f0', '#303030', themeMode)}`,
            borderRadius: 8,
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
        />
        <Drawer
          title={t('client-portal')}
          placement="left"
          onClose={() => setMobileMenuOpen(false)}
          open={mobileMenuOpen}
          width={280}
          styles={{
            body: { padding: 0 },
            header: { borderBottom: `1px solid ${themeWiseColor('#f0f0f0', '#303030', themeMode)}` },
          }}
        >
          {navRail}
        </Drawer>
      </>
    );
  }

  return (
    <div
      style={{
        background: themeWiseColor('#fff', colors.darkGray, themeMode),
        height: '100%',
      }}
    >
      {navRail}
    </div>
  );
};

export default ClientPortalSidebar;
