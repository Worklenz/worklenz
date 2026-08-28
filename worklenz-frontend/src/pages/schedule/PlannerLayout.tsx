import React, { Suspense, lazy, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { evt_schedule_page_visit } from '@/shared/worklenz-analytics-events';
import ScheduleSettingsDrawer from '@/features/schedule/ScheduleSettingsDrawer';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import ScheduleDrawer from '@/features/schedule/ScheduleDrawer';
import PlannerLeftSidebar, { PlannerView } from '@/features/schedule/PlannerLeftSidebar';
import { createPortal } from 'react-dom';
import { useScheduleSocketHandlers } from '@/hooks/useScheduleSocketHandlers';
import { useTaskSocketHandlers } from '@/hooks/useTaskSocketHandlers';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { setShowTaskDrawer } from '@/features/task-drawer/task-drawer.slice';
import { themeWiseColor } from '@/utils/themeWiseColor';
import { useNavPreferences } from '@/features/navigation/useNavPreferences';
import {
  NAV_RAIL_BG_DARK,
  NAV_RAIL_BG_LIGHT,
  NAV_RAIL_DIVIDER_DARK,
  NAV_RAIL_DIVIDER_LIGHT,
} from '@/components/nav-rail/nav-rail-constants';
import { useAuthService } from '@/hooks/useAuth';
import { hasBusinessFeatureAccess } from '@/ee/utils/subscription-utils';
import FeatureUpgradePreview from '@/components/upgrade/FeatureUpgradePreview';
import PlannerSchedulePreviewMockup from '@/components/upgrade/mockups/PlannerSchedulePreviewMockup';
import PlannerTimelinePreviewMockup from '@/components/upgrade/mockups/PlannerTimelinePreviewMockup';
import PlannerWorkloadPreviewMockup from '@/components/upgrade/mockups/PlannerWorkloadPreviewMockup';

// Lazy load TaskDrawer
const TaskDrawer = lazy(() => import('@/components/task-drawer/task-drawer'));
const StatusDrawer = lazy(
  () => import('@/components/project-task-filters/create-status-drawer/create-status-drawer')
);

const PLANNER_BASE_PATH = '/worklenz/planner';

// Shell for the Planner section: left rail plus drawers rendered outside the
// routed sub-views. Each sub-view (Schedule, Timeline, Workload) is a routed
// child rendered through <Outlet/> so every view gets its own URL (see
// main-routes.tsx); TaskDrawer is closed explicitly on sidebar navigation in
// handleViewChange since it wouldn't otherwise unmount on its own.
const PlannerLayout: React.FC = () => {
  const { trackMixpanelEvent } = useMixpanelTracking();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const showTaskDrawer = useAppSelector(state => state.taskDrawerReducer.showTaskDrawer);
  const dispatch = useAppDispatch();
  const location = useLocation();
  const navigate = useNavigate();
  const { resolved: plannerNavResolved } = useNavPreferences('planner');
  const authService = useAuthService();
  const hasBusinessAccess = hasBusinessFeatureAccess(authService.getCurrentSession());
  const { t } = useTranslation(['upgrade-preview', 'planner-sidebar']);

  // Planner is a business-plan feature. Rather than redirecting locked users
  // away entirely, the left rail stays visible/clickable and the content pane
  // shows a blurred preview of whichever view (Schedule/Timeline/Workload) is
  // active, each with its own demo mockup — matching how Finance and Client
  // Portal handle their own locked content.
  const PLANNER_PREVIEWS = useMemo(
    () => ({
      schedule: {
        title: t('schedule', { ns: 'planner-sidebar', defaultValue: 'Schedule' }),
        description: t('cards.planner.schedule.description', {
          ns: 'upgrade-preview',
          defaultValue: "See your whole team's schedule and assign work at a glance.",
        }),
        features: t('cards.planner.schedule.features', { ns: 'upgrade-preview', returnObjects: true, defaultValue: [] }) as string[],
        mockup: <PlannerSchedulePreviewMockup />,
      },
      timeline: {
        title: t('timeline', { ns: 'planner-sidebar', defaultValue: 'Timeline' }),
        description: t('cards.planner.timeline.description', {
          ns: 'upgrade-preview',
          defaultValue: 'Plan every project on one zoomable timeline.',
        }),
        features: t('cards.planner.timeline.features', { ns: 'upgrade-preview', returnObjects: true, defaultValue: [] }) as string[],
        mockup: <PlannerTimelinePreviewMockup />,
      },
      workload: {
        title: t('workload', { ns: 'planner-sidebar', defaultValue: 'Workload' }),
        description: t('cards.planner.workload.description', {
          ns: 'upgrade-preview',
          defaultValue: 'Balance capacity across your team before you over-commit them.',
        }),
        features: t('cards.planner.workload.features', { ns: 'upgrade-preview', returnObjects: true, defaultValue: [] }) as string[],
        mockup: <PlannerWorkloadPreviewMockup />,
      },
    }),
    [t]
  );

  // Initialize schedule socket handlers for real-time updates
  useScheduleSocketHandlers();
  // Also mount the task list's shared socket handlers here — the Task Drawer is rendered
  // in this layout (below) but this hook is otherwise only mounted by the task list/kanban
  // components, so without this, external field changes (estimation, status, etc.) never
  // live-sync into a drawer opened from a Planner page.
  useTaskSocketHandlers();

  useDocumentTitle('Planner');

  useEffect(() => {
    trackMixpanelEvent(evt_schedule_page_visit);
  }, [trackMixpanelEvent]);

  const contentBg = themeWiseColor('#fff', '#1f1f1f', themeMode);
  // Backs the small area the content pane's rounded corner cuts away — must
  // match the rail's own background (not the content's), or that cutout
  // exposes a mismatched patch right at the curve instead of a clean seam.
  const railPanelBg = themeWiseColor(NAV_RAIL_BG_LIGHT, NAV_RAIL_BG_DARK, themeMode);
  // Matches PlannerLeftSidebar.tsx's own dividerColor exactly, so the
  // sidebar's border-right and the content's rounded top-left corner read as
  // one continuous line rather than two adjacent colors.
  const railDividerColor = themeWiseColor(NAV_RAIL_DIVIDER_LIGHT, NAV_RAIL_DIVIDER_DARK, themeMode);

  const activeView = useMemo(() => {
    const rest = location.pathname.startsWith(PLANNER_BASE_PATH)
      ? location.pathname.slice(PLANNER_BASE_PATH.length).replace(/^\//, '')
      : '';
    return (rest || plannerNavResolved.activeDefaultKey) as PlannerView;
  }, [location.pathname, plannerNavResolved.activeDefaultKey]);

  const handleViewChange = useCallback(
    (view: PlannerView) => {
      // TaskDrawer is portaled outside the <Outlet/> below, so it survives the
      // Schedule/Timeline/Workload swap on its own — close it explicitly so it
      // doesn't stay open over a sub-view the user has already navigated away
      // from (same fix as project-view.tsx's tab switching).
      if (showTaskDrawer) {
        dispatch(setShowTaskDrawer(false));
      }
      navigate(`${PLANNER_BASE_PATH}/${view}`);
    },
    [navigate, showTaskDrawer, dispatch]
  );

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 52px)', overflow: 'hidden', background: railPanelBg }}>
      <PlannerLeftSidebar activeView={activeView} onViewChange={handleViewChange} />

      <div
        style={{
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          paddingLeft: 24,
          paddingRight: 24,
          paddingBottom: 24,
          background: contentBg,
          borderTopLeftRadius: 12,
          borderTop: `1px solid ${railDividerColor}`,
          borderLeft: `1px solid ${railDividerColor}`,
        }}
      >
        {hasBusinessAccess ? (
          <Outlet />
        ) : (
          // Real Schedule/Timeline/Workload views add their own 16px top
          // inset via paddingTop on their root (this content pane itself has
          // no paddingTop — see comment above `railPanelBg`); horizontal
          // inset comes entirely from this pane's own paddingLeft/Right
          // above. Match the top inset here so the locked preview doesn't
          // start flush against the top edge.
          <div style={{ height: '100%', padding: '16px 0 0', boxSizing: 'border-box' }}>
            <FeatureUpgradePreview
              key={activeView}
              {...(PLANNER_PREVIEWS[activeView as keyof typeof PLANNER_PREVIEWS] ??
                PLANNER_PREVIEWS.schedule)}
            />
          </div>
        )}
      </div>

      <ScheduleSettingsDrawer />
      <ScheduleDrawer />
      <Suspense fallback={null}>
        <StatusDrawer />
      </Suspense>
      {/* Task Drawer for opening individual tasks */}
      {createPortal(
        <Suspense fallback={null}>
          <TaskDrawer />
        </Suspense>,
        document.body,
        'schedule-task-drawer'
      )}
    </div>
  );
};

export default PlannerLayout;
