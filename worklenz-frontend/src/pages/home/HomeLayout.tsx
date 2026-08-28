import React, { memo, useCallback, useEffect, useMemo } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { theme } from '@/shared/antd-imports';
import { createPortal } from 'react-dom';

import { ProjectSettingsModal } from '@/components/projects/project-settings-modal/project-settings-modal';
import HomeLeftSidebar, { HomeView } from './home-left-sidebar/HomeLeftSidebar';

import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useNavPreferences } from '@/features/navigation/useNavPreferences';
import { useTaskSocketHandlers } from '@/hooks/useTaskSocketHandlers';
import {
  NAV_RAIL_BG_DARK,
  NAV_RAIL_BG_LIGHT,
  NAV_RAIL_DIVIDER_DARK,
  NAV_RAIL_DIVIDER_LIGHT,
} from '@/components/nav-rail/nav-rail-constants';

import { fetchProjectStatuses } from '@/features/projects/lookups/projectStatuses/projectStatusesSlice';
import { fetchProjectCategories } from '@/features/projects/lookups/projectCategories/projectCategoriesSlice';
import { fetchProjectHealth } from '@/features/projects/lookups/projectHealth/projectHealthSlice';
import { fetchProjects } from '@/features/home-page/home-page.slice';

const HOME_BASE_PATH = '/worklenz/home';

const TaskDrawer = React.lazy(() => import('@/components/task-drawer/task-drawer'));
const SurveyPromptModal = React.lazy(() =>
  import('@/components/survey/SurveyPromptModal').then(m => ({ default: m.SurveyPromptModal }))
);

// Shell for the Home section: left rail, drawers/portals that must survive
// navigation between sub-views, and the section-wide lookups fetch. Each
// sub-view (Overview, My Tasks, Calendar, ...) is a routed child rendered
// through <Outlet/> rather than a locally-switched component, so every view
// gets its own URL (see main-routes.tsx).
const HomeLayout = memo(() => {
  const dispatch = useAppDispatch();
  const location = useLocation();
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  // Matches HomeLeftSidebar.tsx's own dividerColor exactly, so the sidebar's
  // border-right and the content's rounded top-left corner read as one
  // continuous line rather than two adjacent colors.
  const RAIL_DIVIDER_COLOR = themeMode === 'dark' ? NAV_RAIL_DIVIDER_DARK : NAV_RAIL_DIVIDER_LIGHT;
  // Backs the small area the content pane's rounded corner cuts away — must
  // match the rail's own background (not the content's), or that cutout
  // exposes a mismatched patch right at the curve instead of a clean seam.
  const railPanelBg = themeMode === 'dark' ? NAV_RAIL_BG_DARK : NAV_RAIL_BG_LIGHT;
  const { resolved: homeNavResolved } = useNavPreferences('home');

  useDocumentTitle('Home');

  useEffect(() => {
    const preloadTaskDrawer = async () => {
      try {
        await import('@/components/task-drawer/task-drawer');
      } catch (error) {
        console.warn('Failed to preload TaskDrawer:', error);
      }
    };
    preloadTaskDrawer();
  }, []);

  const fetchLookups = useCallback(async () => {
    const fetchPromises = [
      dispatch(fetchProjectHealth()),
      dispatch(fetchProjectCategories()),
      dispatch(fetchProjectStatuses()),
      dispatch(fetchProjects()),
    ].filter(Boolean);
    await Promise.all(fetchPromises);
  }, [dispatch]);

  useEffect(() => {
    fetchLookups();
  }, [fetchLookups]);

  const activeView = useMemo(() => {
    const rest = location.pathname.startsWith(HOME_BASE_PATH)
      ? location.pathname.slice(HOME_BASE_PATH.length).replace(/^\//, '')
      : '';
    return (rest || homeNavResolved.activeDefaultKey) as HomeView;
  }, [location.pathname, homeNavResolved.activeDefaultKey]);

  useTaskSocketHandlers();

  const handleViewChange = useCallback(
    (view: HomeView) => {
      navigate(`${HOME_BASE_PATH}/${view}`);
    },
    [navigate]
  );

  return (
    <>
      <div style={{ display: 'flex', height: 'calc(100vh - 52px)', overflow: 'hidden', background: railPanelBg }}>
        {/* Left sidebar */}
        <HomeLeftSidebar activeView={activeView} onViewChange={handleViewChange} />

        {/* Main content — the rounded top-left corner + matching border is the
            other half of the curve started by the sidebar's border-right;
            together they read as one continuous line bending around the
            corner, instead of two straight lines crossing at a hard angle. */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            overflow: 'auto',
            background: token.colorBgContainer,
            borderTopLeftRadius: 12,
            borderTop: `1px solid ${RAIL_DIVIDER_COLOR}`,
            borderLeft: `1px solid ${RAIL_DIVIDER_COLOR}`,
          }}
        >
          <Outlet />
        </div>
      </div>

      {createPortal(<TaskDrawer />, document.body, 'home-task-drawer')}
      {createPortal(<ProjectSettingsModal onClose={() => {}} />, document.body, 'project-settings-modal')}
      {createPortal(<SurveyPromptModal />, document.body, 'survey-modal')}
    </>
  );
});

HomeLayout.displayName = 'HomeLayout';

export default HomeLayout;
