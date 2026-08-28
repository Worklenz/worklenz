import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { theme } from '@/shared/antd-imports';

import NavRail from '@/components/nav-rail/NavRail';
import { useAppSelector } from '../hooks/useAppSelector';
import { useNavPreferences } from '@/features/navigation/useNavPreferences';
import {
  NAV_RAIL_BG_DARK,
  NAV_RAIL_BG_LIGHT,
  NAV_RAIL_COLLAPSED_WIDTH,
  NAV_RAIL_DIVIDER_DARK,
  NAV_RAIL_DIVIDER_LIGHT,
  NAV_RAIL_EXPANDED_WIDTH,
} from '@/components/nav-rail/nav-rail-constants';
import type { NavItem, SurfaceKey } from '@/features/navigation/nav-registry.types';
import '@/components/nav-rail/nav-rail.css';

interface SimpleRailLayoutProps {
  surfaceKey: SurfaceKey;
  // When provided, renders this instead of the routed <Outlet /> in the
  // content pane — used to show a gated/preview state (e.g. business-plan
  // upgrade preview) while keeping the rail navigation itself visible.
  contentOverride?: React.ReactNode;
}

// A thin left rail for pages whose sub-views are separate routes rather than
// local view-switching (Projects, Team Lead Reports) — some rail items are
// real, routed sub-pages (e.g. Projects > Time Entries), the rest are
// prototypes (`soon: true`). The panel itself uses the same chrome (width,
// background, collapse) as Home/Planner/Reporting/Client Portal so every
// page reads as one consistent shell.
const SimpleRailLayout: React.FC<SimpleRailLayoutProps> = memo(({ surfaceKey, contentOverride }) => {
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const isDark = themeMode === 'dark';
  const { token } = theme.useToken();
  const location = useLocation();
  const navigate = useNavigate();
  const { surface, resolved, pin, unpin, isPinned, reorder, toggleCollapsed } =
    useNavPreferences(surfaceKey);

  // Surfaces mounted here (Projects, Team Lead Reports, Finance, ...) mix
  // plain-string labels with i18n-descriptor ones — derive whichever
  // namespaces this particular surface actually uses so `t()` below can
  // resolve them, instead of hardcoding one namespace for every surface.
  const i18nNamespaces = useMemo(
    () =>
      Array.from(
        new Set(
          surface.groups.flatMap(group =>
            group.items
              .map(item => (typeof item.label === 'string' ? null : item.label.i18nNs))
              .filter((ns): ns is string => Boolean(ns))
          )
        )
      ),
    [surface]
  );
  const { t } = useTranslation(i18nNamespaces.length ? i18nNamespaces : undefined);
  const renderLabel = useCallback(
    (item: NavItem) => {
      if (typeof item.label === 'string') return item.label;
      return t(item.label.i18nKey, { ns: item.label.i18nNs, defaultValue: item.label.defaultValue });
    },
    [t]
  );

  const railBg = isDark ? NAV_RAIL_BG_DARK : NAV_RAIL_BG_LIGHT;
  const railDividerColor = isDark ? NAV_RAIL_DIVIDER_DARK : NAV_RAIL_DIVIDER_LIGHT;
  const sidebarWidth = resolved.collapsed ? NAV_RAIL_COLLAPSED_WIDTH : NAV_RAIL_EXPANDED_WIDTH;

  const basePath = `/worklenz/${surfaceKey}`;

  const activeKey = useMemo(() => {
    const rest = location.pathname.startsWith(basePath)
      ? location.pathname.slice(basePath.length).replace(/^\//, '')
      : '';
    return rest || surface.defaultItemKey;
  }, [location.pathname, basePath, surface.defaultItemKey]);

  const handleSelect = useCallback(
    (itemKey: string) => {
      navigate(itemKey === surface.defaultItemKey ? basePath : `${basePath}/${itemKey}`);
    },
    [navigate, basePath, surface.defaultItemKey]
  );

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 52px)', overflow: 'hidden', background: railBg }}>
      <div
        className="nav-rail-width-transition"
        style={{
          width: sidebarWidth,
          minWidth: sidebarWidth,
          flexShrink: 0,
          background: railBg,
          height: '100%',
          overflow: 'auto',
        }}
      >
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
      </div>

      <div
        style={{
          flex: 1,
          minWidth: 0,
          overflow: 'auto',
          padding: 24,
          background: token.colorBgContainer,
          borderTopLeftRadius: 12,
          borderTop: `1px solid ${railDividerColor}`,
          borderLeft: `1px solid ${railDividerColor}`,
        }}
      >
        {contentOverride ?? <Outlet />}
      </div>
    </div>
  );
});

SimpleRailLayout.displayName = 'SimpleRailLayout';

export default SimpleRailLayout;
