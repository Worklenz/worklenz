import './brand-tint.css';
import React from 'react';
import { Drawer, Layout, Skeleton, theme } from '@/shared/antd-imports';
import { Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useResponsive } from '@/hooks/useResponsive';
import { useClientAccess } from '@/hooks/useClientAccess';
import { useGetOrganizationSettingsQuery } from '@/store/api';
import { setLanguage, setOrgBranding, setTheme } from '@/store/slices/uiSlice';
import { IconRailSidebar } from './IconRailSidebar';
import {
  CONTENT_CORNER_RADIUS,
  railBackground,
  RAIL_COLLAPSED_WIDTH,
  RAIL_DIVIDER_DARK,
  RAIL_DIVIDER_LIGHT,
  RAIL_EXPANDED_WIDTH,
  useRailCollapsed,
} from './navigation';
import { TOP_BAR_HEIGHT, TopBar } from './TopBar';

const ClientLayout: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { token } = theme.useToken();
  const { t, i18n } = useTranslation();
  const { isMobile } = useResponsive();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const { collapsed, toggle: toggleCollapsed } = useRailCollapsed();
  const isDark = useAppSelector(state => state.ui.theme) === 'dark';
  const railBg = railBackground(isDark, token.colorPrimary);
  const dividerColor = isDark ? RAIL_DIVIDER_DARK : RAIL_DIVIDER_LIGHT;
  // Hover and selected surfaces everywhere (menus, lists, settings nav) share the branding colour at a fixed
  // strength. Set on :root because dropdowns render outside this tree.
  React.useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--portal-brand-tint', `color-mix(in srgb, ${token.colorPrimary} ${isDark ? 32 : 18}%, transparent)`);
    root.style.setProperty('--portal-brand-tint-soft', `color-mix(in srgb, ${token.colorPrimary} ${isDark ? 18 : 10}%, transparent)`);
  }, [token.colorPrimary, isDark]);
  const railWidth = collapsed ? RAIL_COLLAPSED_WIDTH : RAIL_EXPANDED_WIDTH;

  const { isAuthenticated, teamEpoch } = useAppSelector(state => state.auth);
  const currentLanguage = useAppSelector(state => state.ui.language);
  const { me, isLoading: isAccessLoading } = useClientAccess();

  React.useEffect(() => {
    if (!isAuthenticated) navigate('/auth/login', { replace: true });
  }, [isAuthenticated, navigate]);

  // Branding (logo, colour, title) from the operator's settings. A returning viewer's own theme
  // choice (in localStorage) is never overwritten by the operator's default.
  const { data: settingsData } = useGetOrganizationSettingsQuery();
  const showPoweredBy = !!settingsData?.body && settingsData.body.show_powered_by !== false;
  React.useEffect(() => {
    if (!settingsData?.body) return;
    dispatch(
      setOrgBranding({
        primaryColor: settingsData.body.primary_color || null,
        portalTitle: settingsData.body.portal_title || null,
      })
    );
    if (!localStorage.getItem('theme') && settingsData.body.portal_theme) {
      dispatch(setTheme(settingsData.body.portal_theme));
    }
  }, [settingsData, dispatch]);

  // The language saved on the account follows the person across devices.
  React.useEffect(() => {
    if (me?.language && me.language !== currentLanguage) dispatch(setLanguage(me.language));
    // Only when the account's value arrives or changes; a local choice is saved to the account from Settings.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.language]);

  React.useEffect(() => {
    if (currentLanguage && i18n.language !== currentLanguage) void i18n.changeLanguage(currentLanguage);
  }, [currentLanguage, i18n]);

  return (
    <Layout style={{ minHeight: '100vh', background: railBg }}>
      <TopBar onOpenMenu={() => setMenuOpen(true)} />

      {isMobile ? (
        <Drawer
          placement="left"
          width={260}
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          title={t('navigation.title', { defaultValue: 'Menu' })}
          styles={{ body: { padding: 0 } }}
        >
          <IconRailSidebar stacked onNavigate={() => setMenuOpen(false)} />
        </Drawer>
      ) : (
        <aside
          style={{
            position: 'fixed',
            top: TOP_BAR_HEIGHT,
            bottom: 0,
            left: 0,
            width: railWidth,
            overflowY: 'auto',
            overflowX: 'hidden',
            background: railBg,
            zIndex: 900,
            transition: 'width 0.18s ease',
          }}
        >
          <IconRailSidebar collapsed={collapsed} onToggleCollapse={toggleCollapsed} />
        </aside>
      )}

      {/* A plain <main>: the global `.ant-layout-content` rule forces its margin on small screens. */}
      <main
        style={{
          marginTop: TOP_BAR_HEIGHT,
          marginLeft: isMobile ? 0 : railWidth,
          minHeight: `calc(100vh - ${TOP_BAR_HEIGHT}px)`,
          display: 'flex',
          flexDirection: 'column',
          padding: isMobile ? 16 : 24,
          background: token.colorBgContainer,
          // Curved top-left corner where the content pane meets the header/rail panel.
          borderTopLeftRadius: isMobile ? 0 : CONTENT_CORNER_RADIUS,
          borderTop: `1px solid ${dividerColor}`,
          borderLeft: isMobile ? undefined : `1px solid ${dividerColor}`,
          transition: 'margin-left 0.18s ease',
        }}
      >
        {/* Full-width inner pages: the content fills the pane instead of a centred 1280px column. */}
        {/* Wait for the person's role: until it arrives every control would read as locked. */}
        {/* Keyed by the team so a switch remounts the page: no state from the old team survives. */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {isAccessLoading ? <Skeleton active paragraph={{ rows: 6 }} /> : <Outlet key={teamEpoch} />}
        </div>

        {/* Hidden until the settings arrive (no flash) and when the operator switched it off. */}
        {showPoweredBy && (
          <footer style={{ marginTop: 24, textAlign: 'right', fontSize: 12, color: token.colorTextSecondary }}>
            {t('app.poweredBy', { defaultValue: 'Powered by' })}{' '}
            <a
              href="https://worklenz.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'inherit', fontWeight: 600 }}
            >
              {t('app.worklenz', { defaultValue: 'Worklenz' })}
            </a>
          </footer>
        )}
      </main>
    </Layout>
  );
};

export default ClientLayout;
