import React, { useEffect, useState, useMemo, useCallback, Suspense, useRef } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { createPortal } from 'react-dom';

// Centralized Ant Design imports
import {
  Button,
  ConfigProvider,
  Flex,
  Tabs,
  Tooltip,
  PushpinFilled,
  PushpinOutlined,
  message,
} from '@/shared/antd-imports';
import { CrownOutlined } from '@ant-design/icons';

import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { toggleUpgradeModal } from '@/features/admin-center/admin-center.slice';
import { hasBusinessFeatureAccess } from '@/ee/utils/subscription-utils';
import { hasFinanceViewPermission } from '@/utils/finance-permissions';
import { getProject, setProjectId, setProjectView } from '@/features/project/project.slice';
import {
  fetchStatuses,
  fetchStatusesCategories,
  resetStatuses,
} from '@/features/taskAttributes/taskStatusSlice';
import { projectsApiService } from '@/api/projects/projects.api.service';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import ProjectViewHeader from './project-view-header';
import './project-view.css';
import { resetTaskListData, restoreFilters, setTaskListProjectId, fetchTaskAssignees, fetchLabelsByProject, startFilterRestoration, endFilterRestoration, restoreStatusFilters } from '@/features/tasks/tasks.slice';
import { resetBoardData } from '@/features/board/board-slice';
import { resetTaskManagement, fetchTasksV3 } from '@/features/task-management/task-management.slice';
import { store } from '@/app/store';
import { resetGrouping, initGroupingFromServer, selectCurrentGrouping } from '@/features/task-management/grouping.slice';
import { resetSelection } from '@/features/task-management/selection.slice';
import { resetFields, setProjectContext } from '@/features/task-management/taskListFields.slice';
import { fetchLabels } from '@/features/taskAttributes/taskLabelSlice';
import { deselectAll } from '@/features/projects/bulkActions/bulkActionSlice';
import {
  tabItems,
  updateTabLabels,
  getFilteredTabItems,
} from '@/lib/project/project-view-constants';
import {
  setSelectedTaskId,
  setShowTaskDrawer,
  resetTaskDrawer,
} from '@/features/task-drawer/task-drawer.slice';
import { resetState as resetEnhancedKanbanState, initKanbanGroupingFromServer, IGroupBy } from '@/features/enhanced-kanban/enhanced-kanban.slice';
import { setProjectId as setInsightsProjectId } from '@/features/projects/insights/project-insights.slice';
import { SuspenseFallback } from '@/components/suspense-fallback/suspense-fallback';
import ProjectViewSkeleton from './project-view-skeleton';
import { ProjectSetupBanner } from '@/components/projects/project-setup-banner/project-setup-banner';
import { useTranslation } from 'react-i18next';
import alertService from '@/services/alerts/alertService';
import { useTimerInitialization } from '@/hooks/useTimerInitialization';
import { useAuthService } from '@/hooks/useAuth';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import useTaskCreationPermission from '@/hooks/useTaskCreationPermission';
import { verifyAuthentication } from '@/features/auth/authSlice';
import { setUser } from '@/features/user/userSlice';
import { projectsApi } from '@/api/projects/projects.v1.api.service';
import { setProjectMemberDefaultView } from '@/features/projects/projectsSlice';

// Import critical components synchronously to avoid suspense interruptions
import TaskDrawer from '@components/task-drawer/task-drawer';
import { fetchPhasesByProjectId } from '@/features/projects/singleProject/phase/phases.slice';
import { fetchTaskListColumns } from '@/features/task-management/task-management.slice';

// Lazy load non-critical components with better error handling
const DeleteStatusDrawer = React.lazy(
  () => import('@/components/project-task-filters/delete-status-drawer/delete-status-drawer')
);
const PhaseDrawer = React.lazy(() => import('@/features/projects/singleProject/phase/PhaseDrawer'));
const StatusDrawer = React.lazy(
  () => import('@/components/project-task-filters/create-status-drawer/create-status-drawer')
);
const InviteProjectMembers = React.lazy(
  () => import('@/components/common/invite-project-members/InviteProjectMembers')
);

const ProjectView = React.memo(() => {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [searchParams] = useSearchParams();
  const { projectId } = useParams();
  const { t, i18n } = useTranslation('project-view');

  // Memoized selectors to prevent unnecessary re-renders
  const selectedProject = useAppSelector(state => state.projectReducer.project);
  const projectLoading = useAppSelector(state => state.projectReducer.projectLoading);
  const showTaskDrawer = useAppSelector(state => state.taskDrawerReducer.showTaskDrawer);

  // State to track translation loading
  const [translationsReady, setTranslationsReady] = useState(false);

  // Optimize document title updates
  useDocumentTitle(selectedProject?.name || t('projectView'));

  // Get auth service and current session
  const authService = useAuthService();
  const currentSession = useMemo(() => authService.getCurrentSession(), [authService]);
  const { trackMixpanelEvent } = useMixpanelTracking();
  const { canCreateTask } = useTaskCreationPermission();
  const { socket } = useSocket();

  // Memoize URL params to prevent unnecessary state updates
  const urlParams = useMemo(() => {
    const filteredTabItems = getFilteredTabItems(currentSession, selectedProject, canCreateTask);
    return {
      tab: searchParams.get('tab') || filteredTabItems[0]?.key || 'tasks-list',
      pinnedTab: searchParams.get('pinned_tab') || '',
      taskId: searchParams.get('task') || '',
    };
  }, [searchParams, currentSession, selectedProject, canCreateTask]);

  const [activeTab, setActiveTab] = useState<string>(urlParams.tab);
  const [pinnedTab, setPinnedTab] = useState<string>(urlParams.pinnedTab);
  const [taskid, setTaskId] = useState<string>(urlParams.taskId);
  const [isInitialized, setIsInitialized] = useState(false);
  // Track whether pinnedTab has been initialised from the URL at least once.
  // After that we own the state locally and must not let urlParams overwrite it.
  const pinnedTabInitializedRef = useRef(false);

  // Use ref to prevent duplicate API calls and error messages
  const isLoadingRef = useRef(false);
  const hasShownErrorRef = useRef(false);

  // Initialize timer state from backend when project view loads
  useTimerInitialization();

  useEffect(() => {
    if (!socket || !projectId) {
      return;
    }

    const joinPayload = {
      type: 'join',
      id: projectId,
    };
    const leavePayload = {
      type: 'leave',
      id: projectId,
    };

    socket.emit(SocketEvents.JOIN_OR_LEAVE_PROJECT_ROOM.toString(), joinPayload);
    const handleReconnect = () => {
      socket.emit(SocketEvents.JOIN_OR_LEAVE_PROJECT_ROOM.toString(), joinPayload);
    };

    socket.on('connect', handleReconnect);

    return () => {
      socket.off('connect', handleReconnect);
      socket.emit(SocketEvents.JOIN_OR_LEAVE_PROJECT_ROOM.toString(), leavePayload);
    };
  }, [socket, projectId]);

  useEffect(() => {
    if (!socket || !projectId) return;

    const notify = (descKey: string) => () =>
      alertService.info(t('projectUpdated'), t(descKey));

    const handlers: Record<string, () => void> = {
      [SocketEvents.PROJECT_DATA_CHANGE.toString()]:       notify('projectDataUpdatedDesc'),
      [SocketEvents.PROJECT_HEALTH_CHANGE.toString()]:     notify('projectHealthUpdatedDesc'),
      [SocketEvents.PROJECT_STATUS_CHANGE.toString()]:     notify('projectStatusUpdatedDesc'),
      [SocketEvents.PROJECT_START_DATE_CHANGE.toString()]: notify('projectDatesUpdatedDesc'),
      [SocketEvents.PROJECT_END_DATE_CHANGE.toString()]:   notify('projectDatesUpdatedDesc'),
      [SocketEvents.PROJECT_CATEGORY_CHANGE.toString()]:   notify('projectCategoryUpdatedDesc'),
    };

    Object.entries(handlers).forEach(([event, handler]) => socket.on(event, handler));
    return () => {
      Object.entries(handlers).forEach(([event, handler]) => socket.off(event, handler));
    };
  }, [socket, projectId, t]);

  // Update local state when URL params change
  useEffect(() => {
    // Validate that the tab from URL is not disabled before setting it
    const filteredTabItems = getFilteredTabItems(currentSession, selectedProject, canCreateTask);
    const requestedTab = filteredTabItems.find(item => item.key === urlParams.tab);

    // `canCreateTask` defaults to `true` until the project data loads, then may flip to
    // `false` and drop permission-gated tabs (e.g. roadmap). Wait for the project to be
    // loaded before redirecting away from an unavailable tab — otherwise the requested
    // tab renders briefly and then jumps, producing a visible URL/tab flash on load.
    const projectReady = !!selectedProject;

    if (projectReady && !requestedTab) {
      // Tab isn't available to this user at all — fall back to the first available tab.
      const firstAvailableTab = filteredTabItems.find(item => !item.disabled);
      if (firstAvailableTab) {
        setActiveTab(firstAvailableTab.key);
      }
    } else if (requestedTab?.disabled) {
      // If tab is disabled, redirect to first available tab and show upgrade modal
      const firstAvailableTab = filteredTabItems.find(item => !item.disabled);
      if (firstAvailableTab) {
        setActiveTab(firstAvailableTab.key);
        // Show upgrade modal after a brief delay to ensure component is mounted
        setTimeout(() => {
          dispatch(toggleUpgradeModal());
        }, 100);
      }
    } else {
      setActiveTab(urlParams.tab);
    }

    // Only initialise pinnedTab from the URL once — after that pinToDefaultTab
    // owns the state directly. Overwriting on every urlParams change causes the
    // first pin click to be silently reverted (the navigate() in pinToDefaultTab
    // triggers urlParams to recompute before the new pinnedTab state settles).
    if (!pinnedTabInitializedRef.current) {
      setPinnedTab(urlParams.pinnedTab);
      pinnedTabInitializedRef.current = true;
    }

    setTaskId(urlParams.taskId);
  }, [urlParams, currentSession, selectedProject, dispatch]);

  // Remove translation preloading since we're using simple load-as-you-go approach
  useEffect(() => {
    updateTabLabels();
    setTranslationsReady(true);
  }, [i18n.language]);

  // Update tab labels when language changes
  useEffect(() => {
    if (translationsReady) {
      updateTabLabels();
    }
  }, [t, translationsReady]);

  // Comprehensive cleanup function for when leaving project view entirely
  const resetAllProjectData = useCallback(() => {
    dispatch(setProjectId(null));
    dispatch(resetStatuses());
    dispatch(deselectAll());
    dispatch(resetTaskListData());
    dispatch(resetBoardData());
    dispatch(resetTaskManagement());
    dispatch(resetGrouping());
    dispatch(resetSelection());
    dispatch(resetFields());
    dispatch(resetEnhancedKanbanState());

    // Reset project insights
    dispatch(setInsightsProjectId(''));

    // Reset task drawer completely
    dispatch(resetTaskDrawer());
  }, [dispatch]);

  // Effect for handling component unmount (leaving project view entirely)
  useEffect(() => {
    // This cleanup only runs when the component unmounts
    return () => {
      resetAllProjectData();
    };
  }, [resetAllProjectData]);

  // Effect for handling route changes (when navigating away from project view)
  useEffect(() => {
    const currentPath = location.pathname;

    // If we're not on a project view path, clean up
    if (!currentPath.includes('/worklenz/projects/') || currentPath === '/worklenz/projects') {
      resetAllProjectData();
    }
  }, [location.pathname, resetAllProjectData]);

  // Reset initialization when project changes - must run first
  useEffect(() => {
    setIsInitialized(false);
    isLoadingRef.current = false;
    hasShownErrorRef.current = false;
    // Allow pinnedTab to be re-read from the URL for the new project
    pinnedTabInitializedRef.current = false;
  }, [projectId]);

  // Optimized project data loading with better error handling and performance tracking
  useEffect(() => {
    if (projectId && !isInitialized && !isLoadingRef.current) {
      const loadProjectData = async () => {
        // Prevent duplicate calls
        if (isLoadingRef.current) {
          return;
        }
        isLoadingRef.current = true;

        try {
          // Clean up previous project data before loading new project
          dispatch(resetTaskListData());
          dispatch(resetBoardData());
          dispatch(resetTaskManagement());
          dispatch(resetEnhancedKanbanState());
          dispatch(deselectAll());

          // Load new project data
          dispatch(setProjectId(projectId));
          dispatch(setTaskListProjectId(projectId));

          // Set project context for field visibility
          dispatch(setProjectContext(projectId));

          const requestedTab = searchParams.get('tab') || 'tasks-list';
          const shouldPreloadTaskList = requestedTab === 'tasks-list';

          // Load project and essential data in parallel
          const [projectResult] = await Promise.allSettled([
            dispatch(getProject(projectId)),
            dispatch(fetchStatuses(projectId)),
            dispatch(fetchLabels()),
            ...(shouldPreloadTaskList
              ? [
                  dispatch(fetchTasksV3(projectId)),
                  dispatch(fetchTaskListColumns(projectId)),
                  dispatch(fetchPhasesByProjectId(projectId)),
                  dispatch(fetchStatusesCategories()),
                  dispatch(fetchTaskAssignees(projectId)),
                  dispatch(fetchLabelsByProject(projectId)),
                ]
              : []),
          ]);

          // Restore persisted filters after loading project data
          // CRITICAL: Restore filters AFTER all project data (statuses, members, labels) is loaded
          // so we can match saved filter IDs to actual entities.
          // This sequence prevents the race condition where useFilterPersistence reads stale
          // old-project filter state while taskReducer hasn't been reset yet, then writes it
          // under the new project's storage key, clobbering the new project's saved filters.
          if (shouldPreloadTaskList) {
            // Step 1: Signal that filter restoration is starting so persistence stays blocked
            // until the new project's saved state has been restored.
            dispatch(startFilterRestoration());

            // Step 2: Restore basic filters from localStorage first.
            // Step 3: Wait for the freshly loaded status list before restoring saved status filters,
            // because the status store is populated asynchronously when the project loads.
            const restoreSavedFilters = async () => {
              dispatch(restoreFilters());

              let allAvailableStatuses = store.getState().taskStatusReducer?.status || [];
              let attempts = 0;

              while (allAvailableStatuses.length === 0 && attempts < 20) {
                await new Promise(resolve => setTimeout(resolve, 50));
                allAvailableStatuses = store.getState().taskStatusReducer?.status || [];
                attempts += 1;
              }

              if (allAvailableStatuses.length > 0) {
                // restoreStatusFilters also calls endFilterRestoration() internally
                dispatch(restoreStatusFilters(allAvailableStatuses));
              } else {
                // If no statuses are available, allow persistence to resume safely.
                dispatch(endFilterRestoration());
              }

              // The initial task request runs before persisted filters are restored.
              // Fetch again so the task list matches the restored filter state.
              dispatch(fetchTasksV3(projectId));
            };

            void restoreSavedFilters();
          }

          // Check if project fetch was rejected (access denied or not found)
          if (projectResult.status === 'rejected') {
            // Redirect to projects list
            navigate('/worklenz/projects');
            return;
          }

          // Check if project fetch was fulfilled
          if (projectResult.status === 'fulfilled') {
            const result = projectResult.value as any;

            // Check if the Redux action was rejected (type ends with '/rejected')
            if (result.type && result.type.includes('/rejected')) {
              const payload = result.payload;

              // Check if it's a 403 error (access denied)
              if (payload?.statusCode === 403) {
                // Access denied (user doesn't have access to the project)
                // Note: Backend now handles team switching automatically, so if we get 403,
                // it means the user truly doesn't have access
                if (!hasShownErrorRef.current) {
                  hasShownErrorRef.current = true;
                  message.error(
                    payload?.message ||
                      t('You do not have permission to access this project', {
                        defaultValue: 'You do not have permission to access this project',
                      })
                  );
                }
                navigate('/worklenz/projects');
                return;
              }

              // For other errors, also redirect
              if (!hasShownErrorRef.current) {
                hasShownErrorRef.current = true;
                message.error(
                  t('Failed to load project', {
                    defaultValue: 'Failed to load project',
                  })
                );
              }
              navigate('/worklenz/projects');
              return;
            }

            // Check if project data is missing
            if (!result.payload) {
              navigate('/worklenz/projects');
              return;
            }

            // Initialize grouping preferences from server data.
            // If the server value differs from what was already in Redux (loaded from
            // localStorage before the project data arrived), re-fetch tasks so the
            // task list reflects the correct saved grouping without requiring a refresh.
            const projectData = result.payload as any;
            const validGroupings = ['status', 'priority', 'phase'] as const;
            type GroupingType = typeof validGroupings[number];

            const taskListGroupBy: GroupingType = validGroupings.includes(projectData?.task_list_group_by)
              ? projectData.task_list_group_by
              : 'status';

            const boardGroupBy: GroupingType = validGroupings.includes(projectData?.board_group_by)
              ? projectData.board_group_by
              : 'status';

            // Read current Redux grouping BEFORE dispatching the init action
            const currentListGrouping = selectCurrentGrouping(store.getState());

            dispatch(initGroupingFromServer({ grouping: taskListGroupBy, projectId }));
            dispatch(initKanbanGroupingFromServer({ groupBy: boardGroupBy as IGroupBy, projectId }));

            // If the task list was already fetched in parallel but with the wrong grouping,
            // re-fetch now that the correct grouping is in Redux state
            if (shouldPreloadTaskList && currentListGrouping !== taskListGroupBy) {
              dispatch(fetchTasksV3(projectId));
            }
          }

          // After successful project load, refresh session to update team info in UI
          // This handles cases where backend automatically switched teams
          try {
            // Store current team ID before refresh
            const currentTeamId = currentSession?.team_id;
            
            const authResult = await dispatch(verifyAuthentication()).unwrap();
            if (authResult.authenticated) {
              dispatch(setUser(authResult.user));
              authService.setCurrentSession(authResult.user);
              
              // Check if team switched - if so, force page reload to update all components
              const newTeamId = authResult.user?.team_id;
              if (currentTeamId && newTeamId && currentTeamId !== newTeamId) {
                window.location.reload();
                return;
              }
            }
          } catch (authError) {
            console.error('Failed to refresh session:', authError);
            // Continue anyway - project is loaded
          }

          setIsInitialized(true);
        } catch (error) {
          console.error('Error loading project data:', error);
          navigate('/worklenz/projects');
        } finally {
          isLoadingRef.current = false;
        }
      };

      loadProjectData();
    }
  }, [dispatch, projectId, isInitialized, navigate, t, searchParams]);

  // Effect for handling task drawer opening from URL params
  useEffect(() => {
    if (taskid && isInitialized) {
      dispatch(setSelectedTaskId(taskid));
      dispatch(setShowTaskDrawer(true));
    }
  }, [dispatch, taskid, isInitialized]);

  // Optimized pin tab function with better error handling
  const pinToDefaultTab = useCallback(
    async (itemKey: string) => {
      if (!itemKey || !projectId) return;

      try {
        const defaultView = itemKey === 'tasks-list' ? 'TASK_LIST' : 'BOARD';
        const res = await projectsApiService.updateDefaultTab({
          project_id: projectId,
          default_view: defaultView,
        });

        if (res.done) {
          // Keep local state and URL in sync immediately after pinning.
          setPinnedTab(itemKey);

          navigate(
            {
              pathname: location.pathname,
              search: new URLSearchParams({
                tab: activeTab,
                pinned_tab: itemKey,
                ...(taskid ? { task: taskid } : {}),
              }).toString(),
            },
            { replace: true }
          );

          tabItems.forEach(item => {
            item.isPinned = item.key === itemKey;
          });

          dispatch(
            setProjectMemberDefaultView({
              projectId,
              defaultView,
            })
          );
          dispatch(projectsApi.util.invalidateTags([{ type: 'Projects', id: 'LIST' }]));
        }
      } catch (error) {
        console.error('Error updating default tab:', error);
      }
    },
    [activeTab, dispatch, location.pathname, navigate, projectId, taskid]
  );

  // Optimized tab change handler
  const handleTabChange = useCallback(
    (key: string) => {
      // Find the tab item to check if it's disabled
      const filteredTabItems = getFilteredTabItems(currentSession, selectedProject, canCreateTask);
      const tabItem = filteredTabItems.find(item => item.key === key);

      if (!tabItem) {
        return;
      }

      // If tab is disabled, open upgrade modal instead of navigating
      // (Finance is never disabled here — its business-plan gating is
      // handled in-page by ProjectViewFinance's blurred preview.)
      if (tabItem?.disabled) {
        dispatch(toggleUpgradeModal());
        return;
      }

      // Track finance tab clicks
      if (key === 'finance') {
        const hasBusinessAccess = hasBusinessFeatureAccess(currentSession);
        const hasFinanceAccess = hasFinanceViewPermission(currentSession, selectedProject);

        trackMixpanelEvent('finance_tab_clicked', {
          source: 'project_view_header',
          project_id: projectId,
          project_name: selectedProject?.name,
          user_type: currentSession?.subscription_type?.toLowerCase(),
          has_business_access: hasBusinessAccess,
          has_finance_permission: hasFinanceAccess,
          is_admin: currentSession?.is_admin || currentSession?.owner,
          tab_disabled: tabItem?.disabled || false,
        });
      }

      // The task drawer is rendered via a portal outside the Tabs tree, so it
      // never unmounts on tab switch — close it explicitly to keep it in sync
      // with the tab/URL change below (mirrors closeTaskDrawerOnOutsideClick
      // in PlannerScheduleView.tsx).
      if (showTaskDrawer) {
        dispatch(setShowTaskDrawer(false));
      }

      setActiveTab(key);
      dispatch(setProjectView(key === 'board' ? 'kanban' : 'list'));

      // Use replace for better performance and history management
      navigate(
        {
          pathname: location.pathname,
          search: new URLSearchParams({
            tab: key,
            pinned_tab: pinnedTab,
          }).toString(),
        },
        { replace: true }
      );
    },
    [
      dispatch,
      location.pathname,
      navigate,
      pinnedTab,
      currentSession,
      selectedProject,
      projectId,
      trackMixpanelEvent,
      canCreateTask,
      showTaskDrawer,
    ]
  );

  // Memoized tab menu items with enhanced styling
  const tabMenuItems = useMemo(() => {
    // Only render tabs when translations are ready
    if (!translationsReady) {
      return [];
    }

    const filteredTabItems = getFilteredTabItems(currentSession, selectedProject, canCreateTask);

    const menuItems = filteredTabItems.map(item => {
      const premiumTabs = ['finance', 'project-insights-member-overview', 'roadmap', 'workload'];
      const isPremiumTab = premiumTabs.includes(item.key);

      return {
        key: item.key,
        disabled: false, // Never disable at Ant Design level - we handle clicks manually
        label: (
          <Tooltip title={item.disabled ? item.disabledReason : undefined} placement="bottom">
            <Flex
              align="center"
              gap={6}
              style={{
                color: 'inherit', // Always use normal color
                opacity: 1, // Always full opacity
                cursor: 'pointer',
              }}
            >
              <span style={{ fontWeight: 500, fontSize: '13px' }}>{item.label}</span>
              {item.disabled && (
                <CrownOutlined style={{ fontSize: '14px', color: '#faad14', marginLeft: '4px' }} />
              )}
              {(item.key === 'tasks-list' || item.key === 'board') && !item.disabled && (
                <ConfigProvider wave={{ disabled: true }}>
                  <Button
                    className="borderless-icon-btn"
                    size="small"
                    type="text"
                    style={{
                      backgroundColor: 'transparent',
                      border: 'none',
                      boxShadow: 'none',
                      padding: '2px',
                      minWidth: 'auto',
                      height: 'auto',
                      lineHeight: 1,
                    }}
                    icon={
                      item.key === pinnedTab ? (
                        <PushpinFilled
                          style={{
                            fontSize: '12px',
                            color: 'currentColor',
                            transform: 'rotate(-45deg)',
                            transition: 'all 0.3s ease',
                          }}
                        />
                      ) : (
                        <PushpinOutlined
                          style={{
                            fontSize: '12px',
                            color: 'currentColor',
                            transition: 'all 0.3s ease',
                          }}
                        />
                      )
                    }
                    onClick={e => {
                      e.stopPropagation();
                      pinToDefaultTab(item.key);
                    }}
                    title={item.key === pinnedTab ? t('unpinTab') : t('pinTab')}
                  />
                </ConfigProvider>
              )}
            </Flex>
          </Tooltip>
        ),
        children: item.element,
      };
    });

    return menuItems;
  }, [pinnedTab, pinToDefaultTab, t, translationsReady, currentSession, selectedProject, canCreateTask]);

  // Optimized secondary components loading with better UX
  const [shouldLoadSecondaryComponents, setShouldLoadSecondaryComponents] = useState(false);

  useEffect(() => {
    if (isInitialized) {
      // Reduce delay and load secondary components after core data is ready
      const timer = setTimeout(() => {
        setShouldLoadSecondaryComponents(true);
      }, 500); // Reduced from 1000ms to 500ms

      return () => clearTimeout(timer);
    }
  }, [isInitialized]);

  // Optimized portal elements with better error boundaries
  const portalElements = useMemo(
    () => (
      <>
        {/* Critical component - load immediately without suspense */}
        {createPortal(<TaskDrawer />, document.body, 'task-drawer')}

        {/* Non-critical components - load after delay with suspense fallback */}
        {shouldLoadSecondaryComponents && (
          <Suspense fallback={<SuspenseFallback />}>
            {/* This drawer's open/close state is a single global flag
                (state.projectMemberReducer.isDrawerOpen), not scoped to this instance.
                Safe today only because this page and the other place InviteProjectMembers
                is rendered inline (Planner/Home's "New Task" modals) sit on mutually
                exclusive routes — if that ever changes, toggling the flag from one place
                would also pop open this instance. */}
            {selectedProject &&
              createPortal(
                <InviteProjectMembers
                  projectId={selectedProject.id || ''}
                  projectName={selectedProject.name || ''}
                />,
                document.body,
                'project-member-drawer'
              )}
            {createPortal(<PhaseDrawer />, document.body, 'phase-drawer')}
            {createPortal(<StatusDrawer />, document.body, 'status-drawer')}
            {createPortal(<DeleteStatusDrawer />, document.body, 'delete-status-drawer')}
          </Suspense>
        )}
      </>
    ),
    [shouldLoadSecondaryComponents]
  );

  // Show skeleton while project is being fetched or translations are loading
  if (projectLoading || !isInitialized || !translationsReady) {
    return <ProjectViewSkeleton />;
  }

  // Detect first-visit via `new_project=1` query param
  const isNewProject = searchParams.get('new_project') === '1';

  return (
    <div style={{ marginBlockEnd: 12, minHeight: '80vh' }}>
      <ProjectViewHeader />

      {/* One-time setup banner for newly created projects */}
      {isNewProject && projectId && (
        <ProjectSetupBanner projectId={projectId} />
      )}

      <Tabs
        className="project-view-tabs"
        activeKey={activeTab}
        onChange={handleTabChange}
        items={tabMenuItems}
        destroyOnHidden={true}
        animated={{
          inkBar: true,
          tabPane: false,
        }}
        size="small"
      />

      {portalElements}
    </div>
  );
});

ProjectView.displayName = 'ProjectView';

export default ProjectView;
