import React, { useState, useCallback, useRef, useMemo, useEffect, useLayoutEffect } from 'react';
import { message, theme } from '@/shared/antd-imports';
import { WorklenzLogoLoader } from '@/components/worklenz-loader/worklenz-loader';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSocket } from '@/socket/socketContext';
import dayjs from 'dayjs';
import GanttTimeline from './components/gantt-timeline/GanttTimeline';
import GanttTaskList from './components/gantt-task-list/GanttTaskList';
import GanttChart from './components/gantt-chart/GanttChart';
import GanttToolbar from './components/gantt-toolbar/GanttToolbar';
import ManagePhaseModal from '@components/task-management/ManagePhaseModal';
import ManageStatusModal from '@components/task-management/ManageStatusModal';
import PhaseDetailsModal from './components/phase-details-modal/PhaseDetailsModal';
import { GanttProvider } from './context/gantt-context';
import { GanttViewMode, GanttGroupingMode } from './types/gantt-types';
import {
  roadmapApi,
  useGetRoadmapTasksQuery,
  useGetProjectPhasesQuery,
  useReorderPhasesMutation,
  transformToGanttTasks,
  transformToGanttTasksByStatus,
  transformToGanttTasksByPriority,
  transformToGanttPhases,
} from './services/roadmap-api.service';
import { UnifiedTimelineCalculator } from './utils/unified-timeline-calculator';
import { formatDateLocal } from './utils/date-utils';
import { getColumnWidth } from './constants/gantt-constants';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  setShowTaskDrawer,
  setSelectedTaskId,
  setTaskFormViewModel,
  fetchTask,
} from '@features/task-drawer/task-drawer.slice';
import { fetchTasksV3 } from '@/features/task-management/task-management.slice';
import { fetchTaskGroups } from '@/features/tasks/tasks.slice';
import { fetchPriorities } from '@/features/taskAttributes/taskPrioritySlice';
import { fetchStatuses, fetchStatusesCategories } from '@/features/taskAttributes/taskStatusSlice';
import { statusApiService } from '@/api/taskAttributes/status/status.api.service';
import { ITaskStatusCreateRequest } from '@/types/tasks/task-status-create-request';
import { DEFAULT_TASK_NAME } from '@/shared/constants';
import { SocketEvents } from '@/shared/socket-events';
import { useResizablePanel } from './hooks/useResizablePanel';
import './gantt-styles.css';
import './components/gantt-task-list/gantt-task-list-resize.css';

const ProjectViewGantt: React.FC = React.memo(() => {
  const { projectId } = useParams<{ projectId: string }>();
  const dispatch = useAppDispatch();
  const { socket } = useSocket();
  const { t } = useTranslation('gantt');
  const { token } = theme.useToken();
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  // Resizable panel hook
  const { panelWidth, handleMouseDown, isDragging } = useResizablePanel({
    projectId: projectId || '',
  });
  
  const [viewMode, setViewMode] = useState<GanttViewMode>('day');
  const [groupingMode, setGroupingMode] = useState<GanttGroupingMode>(() => {
    // Load grouping mode from localStorage
    const saved = localStorage.getItem(`roadmap-grouping-${projectId}`);
    return (saved as GanttGroupingMode) || 'phase';
  });
  const [showPhaseModal, setShowPhaseModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showPhaseDetailsModal, setShowPhaseDetailsModal] = useState(false);
  const [selectedPhase, setSelectedPhase] = useState<any>(null);
  // Expanded/collapsed state is remembered per grouping mode (Phase/Status/Priority
  // each have their own set of section ids), so switching the grouping toggle or
  // navigating away to another project tab and back restores exactly what the user
  // left expanded/collapsed instead of resetting.
  const getExpandedStorageKey = (pid: string | undefined, mode: GanttGroupingMode) =>
    `roadmap-expanded-${pid}-${mode}`;
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(() => {
    const saved = localStorage.getItem(getExpandedStorageKey(projectId, groupingMode));
    if (saved !== null) {
      try {
        return new Set(JSON.parse(saved));
      } catch (e) {
        // If parsing fails, fall back to default
      }
    }
    // No saved state yet for this grouping mode (first ever visit) — the
    // initialization effect below will expand just the first section by default.
    return new Set();
  });
  const [animatingTasks, setAnimatingTasks] = useState<Set<string>>(new Set());
  const [prevExpandedTasks, setPrevExpandedTasks] = useState<Set<string>>(new Set());
  const [expandedSectionPositions, setExpandedSectionPositions] = useState<Map<string, number>>(new Map());
  const [isInitialized, setIsInitialized] = useState(false);
  const [highlightedDateRange, setHighlightedDateRange] = useState<{ start: Date; end: Date } | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const taskListRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Get statuses and priorities from Redux
  const statuses = useAppSelector(state => state.taskStatusReducer?.status || []);
  const statusCategories = useAppSelector(state => state.taskStatusReducer?.statusCategories || []);
  const priorities = useAppSelector(state => state.priorityReducer?.priorities || []);
  const currentProject = useAppSelector(state => state.projectReducer?.project);

  // RTK Query hooks
  const {
    data: tasksResponse,
    error: tasksError,
    isLoading: tasksLoading,
    refetch: refetchTasks,
  } = useGetRoadmapTasksQuery(
    { projectId: projectId || '', groupBy: groupingMode },
    {
      skip: !projectId,
      // No socket listener covers another user's edits landing on this
      // project while this view is open (the socket usage here is all
      // emit+once for this user's own actions) — polling is the only thing
      // that surfaces those, so it stays on despite the cache tuning below.
      pollingInterval: 30000,
    }
  );

  const {
    data: phasesResponse,
    error: phasesError,
    isLoading: phasesLoading,
    refetch: refetchPhases,
  } = useGetProjectPhasesQuery(
    { projectId: projectId || '' },
    {
      skip: !projectId,
      pollingInterval: 30000,
    }
  );

  const [reorderPhases, { isLoading: isReordering }] = useReorderPhasesMutation();

  // Transform API data to component format based on grouping mode
  const tasks = useMemo(() => {
    if (tasksResponse?.body) {
      const apiTasks = tasksResponse.body;
      const projectColor = currentProject?.color_code;
      
      switch (groupingMode) {
        case 'phase':
          if (phasesResponse?.body) {
            const transformedTasks = transformToGanttTasks(apiTasks, phasesResponse.body, projectColor);
            const result: any[] = [];

            // For roadmap view: show phases and their child tasks in timeline
            transformedTasks.forEach(task => {
              if (task.type === 'milestone' || task.is_milestone) {
                const taskCopy = {
                  ...task,
                  start_date: task.start_date ? new Date(task.start_date) : null,
                  end_date: task.end_date ? new Date(task.end_date) : null,
                  children: task.children ? [...task.children] : undefined,
                };

                result.push(taskCopy);
                
                // Add child tasks for timeline display (but not for task list)
                if (task.children && task.children.length > 0) {
                  task.children.forEach((child: any) => {
                    result.push({
                      ...child,
                      start_date: child.start_date ? new Date(child.start_date) : null,
                      end_date: child.end_date ? new Date(child.end_date) : null,
                      phase_id: task.phase_id,
                      parent_phase_id: task.phase_id,
                    });
                  });
                }
              }
            });

            return result;
          }
          return [];
          
        case 'status':
          // Use hardcoded categories if statusCategories is empty
          const categories = statusCategories && statusCategories.length > 0 
            ? statusCategories 
            : [
                { id: 'todo', name: 'Todo', color_code: '#94A3B8' },
                { id: 'doing', name: 'Doing', color_code: '#3B82F6' },
                { id: 'done', name: 'Done', color_code: '#10B981' }
              ];
          
          const transformedStatusTasks = transformToGanttTasksByStatus(
            apiTasks,
            categories.map(c => ({ id: c.id || '', name: c.name || '', color_code: c.color_code })),
            statuses,
            projectColor,
            themeMode
          );
          
          // Include both section headers and individual tasks
          const statusResult: any[] = [];
          transformedStatusTasks.forEach(group => {
            statusResult.push(group); // Add the status category group (section header)
            
            // Add individual tasks
            if (group.children && group.children.length > 0) {
              group.children.forEach((task: any) => {
                statusResult.push({
                  ...task,
                  parent_status_id: group.status,
                });
              });
            }
          });
          
          return statusResult;
          
        case 'priority':
          const transformedPriorityTasks = transformToGanttTasksByPriority(
            apiTasks,
            projectColor,
            priorities,
            themeMode
          );
          
          // Include both section headers and individual tasks
          const priorityResult: any[] = [];
          transformedPriorityTasks.forEach(group => {
            priorityResult.push(group); // Add the priority group (section header)
            
            // Add individual tasks
            if (group.children && group.children.length > 0) {
              group.children.forEach((task: any) => {
                priorityResult.push({
                  ...task,
                  parent_priority: group.priority,
                });
              });
            }
          });
          
          return priorityResult;
          
        default:
          return [];
      }
    }
    return [];
  }, [tasksResponse, phasesResponse, statusCategories, statuses, groupingMode, currentProject, priorities, themeMode])

  // Ids of top-level sections that actually exist right now (phase/status/priority
  // groups) for the active grouping mode. Used below instead of raw `expandedTasks.size`
  // to decide whether "nothing is expanded" — a restored localStorage set can be
  // non-empty yet contain only stale ids (e.g. a phase that was since renamed/deleted,
  // which gets a new id), which made `.size === 0` false even though no section was
  // actually visibly open. Phase ids churn far more than Status/Priority ids (which are
  // stable category/constant values), which is why the "expand first section by default"
  // fallback below was reliably kicking in for Status but silently skipping for Phase/
  // Priority whenever a stale id happened to be left over from an earlier session.
  const currentSectionIds = useMemo(
    () => new Set(tasks.filter(task => task.type === 'milestone' || task.is_milestone).map(task => task.id)),
    [tasks]
  );
  const hasAnyValidExpandedSection = useMemo(
    () => Array.from(expandedTasks).some(id => currentSectionIds.has(id)),
    [expandedTasks, currentSectionIds]
  );

  const phases = useMemo(() => {
    if (phasesResponse?.body) {
      return transformToGanttPhases(phasesResponse.body);
    }
    return [];
  }, [phasesResponse]);

  const dateRange = useMemo(() => {
    const today = new Date();

    // Always-scrollable fixed window: 2 years before and 2 years after today, aligned to
    // whole months, regardless of task dates — guarantees "Today" (button and initial
    // auto-scroll) always lands inside range, and gives 2 years of scroll room in either
    // direction even for a brand-new project or one whose tasks sit far in the past/future.
    const minStart = new Date(today.getFullYear() - 2, today.getMonth(), 1);
    const maxEnd = new Date(today.getFullYear() + 2, today.getMonth() + 1, 0);
    maxEnd.setHours(23, 59, 59, 999);

    if (tasks.length > 0) {
      const taskRange = UnifiedTimelineCalculator.createAlignedDateRange(tasks, viewMode, true);
      return {
        start: taskRange.start < minStart ? taskRange.start : minStart,
        end: taskRange.end > maxEnd ? taskRange.end : maxEnd,
      };
    }

    return { start: minStart, end: maxEnd };
  }, [tasks, viewMode]);

  // Measured once here (the container GanttTimeline's header and GanttChart's grid both
  // render into — see containerRef on the wrapping div below) so the "stretch pxPerDay to
  // fill a wide viewport" decision is made in exactly one place, before the shared
  // timelineCalculator is built. Computing it independently in each child (as
  // useGanttDimensions used to) is what let the header and grid drift apart at Week/Month
  // zoom — each was stretching its own column width against a different column *count*.
  const [ganttContainerWidth, setGanttContainerWidth] = useState(0);
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const updateWidth = () => {
      const width = node.offsetWidth;
      setGanttContainerWidth(prev => (prev !== width ? width : prev));
    };

    updateWidth();

    // ResizeObserver instead of only window.resize — the task-list panel divider
    // (useResizablePanel) resizes this container purely via mousemove-driven local state,
    // which never fires a window resize event, so window.resize alone left the "stretch
    // pxPerDay to fill the container" decision (see timelineCalculator memo below) stale
    // until the next zoom change.
    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(node);
    return () => resizeObserver.disconnect();
  }, []);

  const timelineCalculator = useMemo(() => {
    if (!dateRange) return null;

    const baseColumnWidth = getColumnWidth(viewMode);
    const totalDays = Math.max(
      1,
      Math.round((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24))
    );
    const naturalWidth = totalDays * baseColumnWidth;

    // Day/Week keep their natural per-day width (so scrolling stays meaningful at a
    // readable column size); Month/Quarter/Year stretch to fill a wide container instead
    // of leaving blank space to the right of a short range — matches Planner Timeline's
    // own pxPerDay stretch behavior exactly.
    const shouldStretch = viewMode !== 'day' && viewMode !== 'week';
    const pxPerDay =
      shouldStretch && ganttContainerWidth > naturalWidth
        ? ganttContainerWidth / totalDays
        : baseColumnWidth;

    return new UnifiedTimelineCalculator(viewMode, dateRange, pxPerDay);
  }, [viewMode, dateRange, ganttContainerWidth]);

  // Computed once here instead of independently in GanttTimeline.tsx and GanttChart.tsx
  // (previously via two separate useGanttDimensions calls, each with its own React state
  // against the same containerRef/totalWidth) — same reasoning as ganttContainerWidth
  // above: one shared computation instead of two that can disagree.
  const shouldScroll = useMemo(() => {
    if (!timelineCalculator) return false;
    return timelineCalculator.getTotalWidth() > ganttContainerWidth;
  }, [timelineCalculator, ganttContainerWidth]);

  const loading = tasksLoading || phasesLoading;

  useEffect(() => {
    dispatch(fetchPriorities());
    if (projectId) {
      dispatch(fetchStatuses(projectId));
      dispatch(fetchStatusesCategories());
    }
  }, [dispatch, projectId]);

  // Save grouping mode to localStorage when it changes
  useEffect(() => {
    if (projectId) {
      localStorage.setItem(`roadmap-grouping-${projectId}`, groupingMode);
    }
  }, [groupingMode, projectId]);

  // On true first-ever visit to a given grouping mode (no saved expand state for it
  // at all. There's always at least one section open by default — if nothing is
  // expanded (first-ever visit to this grouping mode, or everything got collapsed),
  // the first top-level section is forced open. Any other, non-empty state is left
  // exactly as the user last set it.
  useEffect(() => {
    if (!isInitialized && tasks.length > 0) {
      if (!hasAnyValidExpandedSection) {
        const firstSection = tasks.find(task => task.type === 'milestone' || task.is_milestone);

        if (firstSection) {
          const newExpanded = new Set([firstSection.id]);
          setExpandedTasks(newExpanded);
          if (projectId) {
            localStorage.setItem(
              getExpandedStorageKey(projectId, groupingMode),
              JSON.stringify(Array.from(newExpanded))
            );
          }
        }
      }

      setIsInitialized(true);
    }
  }, [isInitialized, tasks, groupingMode, projectId, hasAnyValidExpandedSection]);

  // Save expanded tasks to localStorage whenever they change, namespaced per grouping mode
  useEffect(() => {
    if (projectId && isInitialized) {
      localStorage.setItem(
        getExpandedStorageKey(projectId, groupingMode),
        JSON.stringify(Array.from(expandedTasks))
      );
    }
  }, [expandedTasks, projectId, groupingMode, isInitialized]);

  // Auto-scroll to today on load (only once). Works in any view mode — the manual
  // "Today" toolbar button (handleScrollToToday below) uses the identical
  // timelineCalculator-based positioning with no view-mode restriction, so this now
  // matches that behavior exactly.
  const autoScrolledRef = useRef(false);
  useEffect(() => {
    if (!isInitialized || !dateRange || !timelineCalculator || autoScrolledRef.current) return;

    // Get today's date at midnight
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if today is within date range
    const rangeStart = new Date(dateRange.start);
    rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd = new Date(dateRange.end);
    rangeEnd.setHours(23, 59, 59, 999);

    if (today < rangeStart || today > rangeEnd) return;

    let rafId: number | undefined;

    // Retry across animation frames instead of a single fixed delay — the container
    // isn't laid out (clientWidth still 0) until the row list has actually painted, which
    // can take longer than a flat timeout on a slower load. Gives up after ~20 frames
    // (roughly 300ms) and scrolls with whatever viewport width is available by then.
    const tryScroll = (attempt: number) => {
      if (!chartRef.current || !timelineRef.current) {
        if (attempt < 20) rafId = requestAnimationFrame(() => tryScroll(attempt + 1));
        return;
      }

      const viewportWidth = chartRef.current.clientWidth;

      if (viewportWidth === 0 && attempt < 20) {
        rafId = requestAnimationFrame(() => tryScroll(attempt + 1));
        return;
      }

      // Same daysSinceRangeStart * pxPerDay formula every grid column/task bar is
      // positioned with (see centerOnToday's comment for why this replaced a
      // chartRef.scrollWidth-based ratio).
      const { left: todayPosition } = timelineCalculator.calculateTaskPosition(today, today);
      const scrollPosition = Math.max(0, todayPosition - viewportWidth / 2);

      // Only the chart is driven directly — handleChartScroll mirrors its scrollLeft
      // onto timelineRef on every 'scroll' event (see centerOnToday's comment below for
      // why calling scrollTo on both independently is unsafe once that sync exists).
      chartRef.current.scrollTo({ left: scrollPosition, behavior: 'auto' });

      setHighlightedDateRange({ start: today, end: today });
      autoScrolledRef.current = true;
    };

    rafId = requestAnimationFrame(() => tryScroll(0));

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [isInitialized, dateRange, timelineCalculator]);

  useEffect(() => {
    const currentExpanded = expandedTasks;
    const previousExpanded = prevExpandedTasks;

   const newlyExpanded = new Set(Array.from(currentExpanded).filter(id => !previousExpanded.has(id)));
const newlyCollapsed = new Set(Array.from(previousExpanded).filter(id => !currentExpanded.has(id)));

    if (newlyExpanded.size > 0 || newlyCollapsed.size > 0) {
     setAnimatingTasks(new Set(Array.from(newlyExpanded).concat(Array.from(newlyCollapsed))));
      const timeout = setTimeout(() => {
        setAnimatingTasks(new Set());
      }, 400);

      setPrevExpandedTasks(new Set(Array.from(currentExpanded)));

      return () => clearTimeout(timeout);
    }
  }, [expandedTasks, prevExpandedTasks]);

  const handleViewModeChange = useCallback((mode: GanttViewMode) => {
    setViewMode(mode);
  }, []);

  const handleGroupingModeChange = useCallback((mode: GanttGroupingMode) => {
    setGroupingMode(mode);
    setIsInitialized(false);
    // Restore whatever was previously saved for this specific grouping mode, if any —
    // the initialization effect only falls back to "expand first section" when
    // nothing was ever saved for this mode.
    const saved = localStorage.getItem(getExpandedStorageKey(projectId, mode));
    if (saved !== null) {
      try {
        setExpandedTasks(new Set(JSON.parse(saved)));
        return;
      } catch (e) {
        // fall through to default below
      }
    }
    setExpandedTasks(new Set());
  }, [projectId]);

  // Check if all phases are collapsed
  const isAllCollapsed = useMemo(() => {
    const allPhases = tasks.filter(task => task.type === 'milestone' || task.is_milestone);
    return allPhases.length > 0 && !hasAnyValidExpandedSection;
  }, [tasks, hasAnyValidExpandedSection]);

  // Shared centering math for both the manual "Today" toolbar button and the
  // automatic zoom-in/out re-center effect below — kept in one place so the two can't
  // drift apart the way the header/grid column math once did.
  const centerOnToday = useCallback(
    (behavior: ScrollBehavior, showOutOfRangeMessage: boolean) => {
      if (!chartRef.current || !dateRange || !timelineCalculator) return;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const rangeStart = new Date(dateRange.start);
      rangeStart.setHours(0, 0, 0, 0);
      const rangeEnd = new Date(dateRange.end);
      rangeEnd.setHours(23, 59, 59, 999);

      if (today < rangeStart || today > rangeEnd) {
        if (showOutOfRangeMessage) message.info('Today is outside the current date range');
        return;
      }

      // Position via timelineCalculator's own daysSinceRangeStart * pxPerDay formula —
      // the same one used to place every grid column and task bar — instead of a
      // chartRef.scrollWidth-based ratio. scrollWidth reflects the chart's actual
      // rendered content width, which briefly reports the *previous* zoom level's width
      // while `.gantt-chart-scroll .relative`'s CSS transition is still animating it
      // toward the new one; reading it synchronously right after a zoom change (or
      // scrolling to a target computed from the eventual width while the DOM is still
      // mid-transition, which the browser then clamps scrollLeft against and never
      // un-clamps once the transition settles) is what left Week/Month zoom unable to
      // land on today. timelineCalculator's value has no such lag since it's pure JS,
      // not a DOM read.
      const { left: todayPosition } = timelineCalculator.calculateTaskPosition(today, today);
      const viewportWidth = chartRef.current.clientWidth;
      const scrollPosition = Math.max(0, todayPosition - viewportWidth / 2);

      // Only the chart is driven directly — handleChartScroll already mirrors its
      // scrollLeft onto timelineRef on every 'scroll' event. Also calling
      // timelineRef.scrollTo() here used to kick off a second, independent native
      // smooth-scroll animation racing the chart's; each side's own scroll events would
      // then yank the other element's scrollLeft to whatever intermediate position it
      // was at mid-animation (via handleChartScroll/handleTimelineScroll), interrupting
      // its native smooth-scroll and leaving it resting at a mistimed, wrong-looking
      // position instead of the intended today column — reproducible on the "Today"
      // button (behavior: 'smooth') since 'auto' scrolls land instantly with no window
      // for the two animations to race.
      chartRef.current.scrollTo({ left: scrollPosition, behavior });

      setHighlightedDateRange({ start: today, end: today });
    },
    [dateRange, timelineCalculator]
  );

  const handleScrollToToday = useCallback(() => {
    centerOnToday('smooth', true);
  }, [centerOnToday]);

  // Zooming (the toolbar's Zoom In/Out buttons) changes pxPerDay and therefore the
  // chart's total scrollable width. Without this, the browser preserves the same
  // absolute scrollLeft across that width change, which silently drifts the visible
  // range away from today (or off the edge) every time the zoom level changes.
  //
  // useLayoutEffect (not useEffect) is required here: it runs synchronously after the new
  // totalWidth has committed to the DOM but before the browser paints, so the corrected
  // scrollLeft is what the user actually sees on the very first frame of the new zoom
  // level. A passive useEffect would let the browser paint once with its own auto-clamped
  // scrollLeft first (often nowhere near any visible task bar on a big zoom-out) and only
  // fix it a frame later — that one-frame flash of a wrong/empty-looking viewport is what
  // read as "the grid goes invisible when zooming." Being synchronous also sidesteps
  // React.StrictMode's dev-only double-invoke cleanly: invocation 1 updates the ref and
  // recenters immediately, so invocation 2's guard just sees the ref already matches and
  // bails — no cancellable async work to race against.
  const prevViewModeRef = useRef(viewMode);
  useLayoutEffect(() => {
    if (prevViewModeRef.current === viewMode) return;
    prevViewModeRef.current = viewMode;
    centerOnToday('auto', false);
  }, [viewMode, centerOnToday]);

  const handleToggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      rootRef.current?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  // Guard against the two panels' scroll handlers re-triggering each other in a loop:
  // syncing one panel's scrollTop onto the other fires that other panel's own onScroll,
  // which would otherwise try to sync back again. Explicit flag instead of relying on
  // the second call being a same-value no-op, which is fragile against browsers/timing
  // where the two panels' scrollable heights aren't pixel-identical.
  const isSyncingScrollRef = useRef(false);

  const handleChartScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (isSyncingScrollRef.current) return;
    isSyncingScrollRef.current = true;

    const target = e.target as HTMLDivElement;

    if (timelineRef.current) {
      timelineRef.current.scrollLeft = target.scrollLeft;
    }

    if (taskListRef.current) {
      taskListRef.current.scrollTop = target.scrollTop;
    }

    requestAnimationFrame(() => {
      isSyncingScrollRef.current = false;
    });
  }, []);

  const handleTaskListScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (isSyncingScrollRef.current) return;
    isSyncingScrollRef.current = true;

    const target = e.target as HTMLDivElement;

    if (chartRef.current) {
      chartRef.current.scrollTop = target.scrollTop;
    }

    requestAnimationFrame(() => {
      isSyncingScrollRef.current = false;
    });
  }, []);

  // Mirrors handleChartScroll in the other direction — the date header (GanttTimeline) is
  // independently overflow-x-auto/scrollable (trackpad horizontal swipe, shift+wheel while
  // hovering the header), and without this the header could scroll away from the grid with
  // nothing to bring it back. Same isSyncingScrollRef re-entrancy guard as the other panels.
  const handleTimelineScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (isSyncingScrollRef.current) return;
    isSyncingScrollRef.current = true;

    const target = e.target as HTMLDivElement;

    if (chartRef.current) {
      chartRef.current.scrollLeft = target.scrollLeft;
    }

    requestAnimationFrame(() => {
      isSyncingScrollRef.current = false;
    });
  }, []);

  const handleRefresh = useCallback(() => {
    refetchTasks();
    refetchPhases();

    if (projectId) {
      dispatch(fetchStatuses(projectId));
      dispatch(fetchStatusesCategories());
      dispatch(fetchTasksV3(projectId));
      dispatch(fetchTaskGroups(projectId));
    }
  }, [refetchTasks, refetchPhases, dispatch, projectId]);

  const handleCreatePhase = useCallback(() => {
    setShowPhaseModal(true);
  }, []);

  const handleCreateStatus = useCallback(() => {
    setShowStatusModal(true);
  }, []);

  const handleCreateTask = useCallback(
    (phaseId?: string) => {
      const newTaskViewModel = {
        id: null,
        name: DEFAULT_TASK_NAME,
        project_id: projectId,
        phase_id: phaseId || null,
      };

      dispatch(setSelectedTaskId(null));
      dispatch(setTaskFormViewModel(newTaskViewModel));
      dispatch(setShowTaskDrawer(true));
    },
    [dispatch, projectId]
  );

  const handleTaskClick = useCallback(
    (taskId: string) => {
      dispatch(setSelectedTaskId(taskId));
      dispatch(setTaskFormViewModel(null));
      dispatch(setShowTaskDrawer(true));

      if (projectId) {
        dispatch(fetchTask({ taskId, projectId }));
      }
    },
    [dispatch, projectId]
  );

  const handleClosePhaseModal = useCallback(() => {
    setShowPhaseModal(false);
    refetchTasks();
    refetchPhases();
  }, [refetchTasks, refetchPhases]);

  const handleCloseStatusModal = useCallback(() => {
    setShowStatusModal(false);
    refetchTasks();
    // Also refresh statuses from Redux
    if (projectId) {
      dispatch(fetchStatuses(projectId));
      dispatch(fetchStatusesCategories());
    }
  }, [refetchTasks, dispatch, projectId]);

  const handlePhaseClick = useCallback((phase: any) => {
    // Enrich children with assignees from the raw tasks response
    if (phase.children && tasksResponse?.body) {
      const rawTasks = tasksResponse.body;
      const enrichedChildren = phase.children.map((child: any) => {
        const rawTask = rawTasks.find((t: any) => t.id === child.id);
        return rawTask ? { ...child, assignees: rawTask.assignees || [] } : child;
      });
      setSelectedPhase({ ...phase, children: enrichedChildren });
    } else {
      setSelectedPhase(phase);
    }
    setShowPhaseDetailsModal(true);
  }, [tasksResponse]);

  const handleClosePhaseDetailsModal = useCallback(() => {
    setShowPhaseDetailsModal(false);
    setSelectedPhase(null);
  }, []);

  const handlePhaseUpdate = useCallback(
    (updatedPhase: any) => {
      refetchTasks();
      refetchPhases();
      // Also refresh the task-management slice so Task List updates immediately
      if (projectId) {
        dispatch(fetchTasksV3(projectId));
        dispatch(fetchTaskGroups(projectId));
      }
    },
    [refetchTasks, refetchPhases, dispatch, projectId]
  );

  const handlePhaseReorder = useCallback(
    async (oldIndex: number, newIndex: number) => {
      if (!projectId || !phasesResponse?.body) {
        message.error('Unable to reorder phases: missing project data');
        return;
      }

      const currentPhases = [...phasesResponse.body];
      const reorderedPhases = [...currentPhases];
      const [moved] = reorderedPhases.splice(oldIndex, 1);
      reorderedPhases.splice(newIndex, 0, moved);

      const phase_orders = reorderedPhases.map((phase, index) => ({
        phase_id: phase.id,
        sort_index: reorderedPhases.length - index,
      }));

      try {
        await reorderPhases({
          project_id: projectId,
          phase_orders,
        }).unwrap();

        refetchPhases();
        refetchTasks();
        // Refresh task-management slice so Task List view reflects new phase ordering
        if (projectId) {
          dispatch(fetchTasksV3(projectId));
          dispatch(fetchTaskGroups(projectId));
        }
      } catch (error: any) {
        message.error(error?.data?.message || 'Failed to reorder phases');
      }
    },
    [projectId, phasesResponse?.body, reorderPhases, refetchPhases, refetchTasks, dispatch]
  );

  // Persists via the same status-order API the Task List/Board views use
  // (statusApiService.updateStatusOrder), so the new order is shared across views
  // instead of being Roadmap-only.
  const handleStatusReorder = useCallback(
    async (oldIndex: number, newIndex: number) => {
      if (!projectId || !statuses.length) {
        message.error('Unable to reorder statuses: missing project data');
        return;
      }

      const reorderedStatuses = [...statuses];
      const [moved] = reorderedStatuses.splice(oldIndex, 1);
      reorderedStatuses.splice(newIndex, 0, moved);

      const status_order = reorderedStatuses
        .map((status: any) => status.id)
        .filter((id: string | undefined): id is string => !!id);

      try {
        const requestBody: ITaskStatusCreateRequest = { status_order };
        const response = await statusApiService.updateStatusOrder(requestBody, projectId);

        if (!response.done) {
          message.error('Failed to update status order');
          return;
        }

        dispatch(fetchStatuses(projectId));
        refetchTasks();
        // Refresh task-management slice so Task List view reflects the new status order
        dispatch(fetchTasksV3(projectId));
        dispatch(fetchTaskGroups(projectId));
      } catch (error: any) {
        message.error(error?.data?.message || 'Failed to update status order');
      }
    },
    [projectId, statuses, dispatch, refetchTasks]
  );

  const authUser = useAppSelector(state => state.auth?.user);

  const handleCreateQuickTask = useCallback(
    (taskName: string, phaseId?: string, startDate?: Date, endDate?: Date, parentTaskId?: string) => {
      if (!socket || !projectId || !taskName.trim() || !authUser) {
        return;
      }

      const taskData: any = {
        project_id: projectId,
        name: taskName.trim(),
        reporter_id: authUser.id,
        team_id: authUser.team_id,
        start_date: startDate ? formatDateLocal(startDate) : null,
        end_date: endDate ? formatDateLocal(endDate) : null,
      };

      if (parentTaskId) {
        taskData.parent_task_id = parentTaskId;
      }

      // Check if this is a status ID (format: status-{id}), a priority ID (format:
      // priority-{value}), or a phase ID
      let statusAssignedFromSection = false;
      let priorityAssignedFromSection = false;

      if (phaseId && phaseId.startsWith('status-')) {
        const statusId = phaseId.replace('status-', '');
        const matchedStatus = statuses.find((s: any) => s.id === statusId || s.category_id === statusId);

        if (matchedStatus?.id) {
          taskData.status_id = matchedStatus.id;
          statusAssignedFromSection = true;
        }
      } else if (phaseId && phaseId.startsWith('priority-')) {
        // Priority view: assign the priority the section represents. Phase is
        // intentionally left unset (Unmapped) and status falls through to the
        // "To Do" default below — matching how Phase/Status view creation already
        // defaults whichever field its own grouping doesn't already imply.
        const priorityValue = Number(phaseId.replace('priority-', ''));
        const priorityNameByValue: Record<number, string> = {
          3: 'Critical',
          2: 'High',
          1: 'Medium',
          0: 'Low',
        };
        const priorityName = priorityNameByValue[priorityValue];
        const matchedPriority = priorities.find(
          (p: any) => p.name?.toLowerCase() === priorityName?.toLowerCase()
        );

        if (matchedPriority?.id) {
          taskData.priority_id = matchedPriority.id;
          priorityAssignedFromSection = true;
        }
      } else if (phaseId) {
        // Regular phase ID
        taskData.phase_id = phaseId;
      }

      // Default status "To Do" and priority "Medium" so tasks quick-created from a
      // Phase (or any section that doesn't already imply a status/priority) show up
      // consistently elsewhere in the app instead of with a blank status/priority.
      if (!statusAssignedFromSection) {
        const defaultStatus =
          statuses.find((s: any) => s.default_status) ||
          statuses.find((s: any) => {
            const categoryName = (s.category_name || '').toLowerCase();
            return categoryName === 'to do' || categoryName === 'todo';
          });
        if (defaultStatus?.id) {
          taskData.status_id = defaultStatus.id;
        }
      }

      if (!priorityAssignedFromSection) {
        const defaultPriority = priorities.find((p: any) => p.name?.toLowerCase() === 'medium');
        if (defaultPriority?.id) {
          taskData.priority_id = defaultPriority.id;
        }
      }

      // Listen for this specific creation's own response directly, rather than relying on
      // a separately-registered background listener — guarantees the new task/subtask
      // (from either the timeline rollover or the task-name column) appears immediately
      // once created, without waiting for the 30s poll or a manual page reload.
      socket.once(SocketEvents.QUICK_TASK.toString(), (response: any) => {
        if (response && !response.error) {
          message.success(`Task "${response.name}" created successfully`);
          refetchTasks();
          refetchPhases();
          // Refresh task-management slice so Task List view updates in real-time too
          if (projectId) {
            dispatch(fetchTasksV3(projectId));
            dispatch(fetchTaskGroups(projectId));
          }
        } else {
          message.error(response?.message || 'Failed to create task');
        }
      });

      socket.emit(SocketEvents.QUICK_TASK.toString(), JSON.stringify(taskData));
    },
    [socket, projectId, authUser, statuses, priorities, refetchTasks, refetchPhases, dispatch]
  );

  // Resolves a Roadmap group id (phase-{id} / status-{id} / priority-{value}) to the
  // real backend id needed for a TASK_SORT_ORDER_CHANGE group-membership update.
  // Mirrors the same id-resolution rules handleCreateQuickTask already uses above.
  const resolveGroupBackendId = useCallback(
    (groupId: string): string | null => {
      if (groupId.startsWith('phase-')) {
        return groupId === 'phase-unmapped' ? null : groupId.replace('phase-', '');
      }
      if (groupId.startsWith('status-')) {
        const statusId = groupId.replace('status-', '');
        const matched = statuses.find((s: any) => s.id === statusId || s.category_id === statusId);
        return matched?.id || null;
      }
      if (groupId.startsWith('priority-')) {
        const priorityValue = Number(groupId.replace('priority-', ''));
        const priorityNameByValue: Record<number, string> = {
          3: 'Critical',
          2: 'High',
          1: 'Medium',
          0: 'Low',
        };
        const priorityName = priorityNameByValue[priorityValue];
        const matched = priorities.find((p: any) => p.name?.toLowerCase() === priorityName?.toLowerCase());
        return matched?.id || null;
      }
      return null;
    },
    [statuses, priorities]
  );

  // Persists a task drag-and-drop reorder from GanttTaskList — same-group and
  // cross-group, for whichever grouping mode is currently active. Roadmap shares
  // the same phase_sort_order/status_sort_order/priority_sort_order columns Task
  // List's own drag-and-drop uses (see useDragAndDrop.ts's emitTaskSortChange,
  // whose bulk-recompute approach this mirrors), so reordering in either view is
  // reflected in both — rather than tracking a Roadmap-only position separately.
  const handleTaskReorder = useCallback(
    (taskId: string, sourceGroupId: string, targetGroupId: string, anchorTaskId: string | null) => {
      if (!projectId) return;

      const topLevelGroups = tasks.filter(t => t.type === 'milestone' || t.is_milestone);
      const sourceGroup = topLevelGroups.find(g => g.id === sourceGroupId);
      const targetGroup = topLevelGroups.find(g => g.id === targetGroupId);
      if (!sourceGroup || !targetGroup) return;

      // Splice the dragged task out of its source group and into the target
      // group at the anchor position (anchorTaskId = task it should land
      // immediately before, null = end of group) — same shape as
      // useDragAndDrop.ts's reorderTasksInGroup, just operating on the Roadmap's
      // phase/status/priority milestone tree instead of groups[].taskIds.
      const sourceChildren = [...(sourceGroup.children || [])];
      const draggedIndex = sourceChildren.findIndex(t => t.id === taskId);
      if (draggedIndex === -1) return;
      const [draggedTask] = sourceChildren.splice(draggedIndex, 1);

      const targetChildren = sourceGroupId === targetGroupId ? sourceChildren : [...(targetGroup.children || [])];
      const insertAt = anchorTaskId ? targetChildren.findIndex(t => t.id === anchorTaskId) : -1;
      targetChildren.splice(insertAt === -1 ? targetChildren.length : insertAt, 0, draggedTask);

      const childrenByGroup = new Map<string, typeof sourceChildren>();
      topLevelGroups.forEach(g => childrenByGroup.set(g.id, g.children || []));
      childrenByGroup.set(sourceGroupId, sourceChildren);
      childrenByGroup.set(targetGroupId, targetChildren); // wins over the line above when same-group

      // Recompute sequential sort orders across every group in this grouping
      // mode's column — recalculating everyone, not just the moved task, avoids
      // duplicate/tied sort values, same as Task List's own emitTaskSortChange.
      const taskUpdates: Array<{
        task_id: string;
        sort_order: number;
        phase_id?: string | null;
        status_id?: string | null;
        priority_id?: string | null;
      }> = [];
      let sortOrder = 0;
      topLevelGroups.forEach(group => {
        (childrenByGroup.get(group.id) || []).forEach(child => {
          taskUpdates.push({ task_id: child.id, sort_order: sortOrder });
          sortOrder++;
        });
      });

      const isCrossGroup = sourceGroupId !== targetGroupId;
      // from_group/to_group must be the real backend ids (or 'unmapped'), not the
      // Roadmap-internal synthetic group ids — the backend uses these directly for
      // dependency-completion checks, auto-assign-on-status-change, and activity
      // log entries (logPhaseChange/logStatusChange/logPriorityChange).
      const sourceBackendId = resolveGroupBackendId(sourceGroupId);
      const targetBackendId = resolveGroupBackendId(targetGroupId);
      if (isCrossGroup) {
        const fieldKey =
          groupingMode === 'phase' ? 'phase_id' : groupingMode === 'status' ? 'status_id' : 'priority_id';
        const movedUpdate = taskUpdates.find(u => u.task_id === taskId);
        if (movedUpdate) movedUpdate[fieldKey] = targetBackendId;
      }

      // Optimistic reorder for the common same-group case — moves the task in
      // both panels instantly, since GanttTaskList and GanttChart both derive
      // from this same query cache entry. Cross-group moves fall back to the
      // refetch-confirmed latency phase-header reordering already has today,
      // rather than re-deriving the transform's status/priority bucketing logic
      // client-side.
      if (!isCrossGroup) {
        dispatch(
          roadmapApi.util.updateQueryData('getRoadmapTasks', { projectId, groupBy: groupingMode }, draft => {
            const fromIdx = draft.body.findIndex(t => t.id === taskId);
            if (fromIdx === -1) return;
            const [moved] = draft.body.splice(fromIdx, 1);
            const toIdx = anchorTaskId ? draft.body.findIndex(t => t.id === anchorTaskId) : -1;
            draft.body.splice(toIdx === -1 ? draft.body.length : toIdx, 0, moved);
          })
        );
      }

      // Status-grouped moves can be rejected outright by the dependency-completion
      // check (echoes `{ completed_deps: false }` instead of the usual task-rows
      // array) — nothing was written in that case, so just refetch to resync.
      socket?.once(SocketEvents.TASK_SORT_ORDER_CHANGE.toString(), () => {
        refetchTasks();
        if (isCrossGroup) refetchPhases();
      });
      socket?.emit(SocketEvents.TASK_SORT_ORDER_CHANGE.toString(), {
        project_id: projectId,
        group_by: groupingMode,
        task_updates: taskUpdates,
        from_group: sourceBackendId || 'unmapped',
        to_group: targetBackendId || 'unmapped',
        task: { id: taskId, project_id: projectId, status: '', priority: '' },
        team_id: authUser?.team_id || '',
      });
    },
    [projectId, tasks, dispatch, socket, refetchTasks, refetchPhases, groupingMode, resolveGroupBackendId, authUser]
  );

  const handleTaskNameClick = useCallback(
    (task: any) => {
      if (chartRef.current && task.start_date && dateRange) {
        const totalTimeSpan = dateRange.end.getTime() - dateRange.start.getTime();
        const timeFromStart = new Date(task.start_date).getTime() - dateRange.start.getTime();

        const chartElement = chartRef.current;
        const chartWidth = chartElement.scrollWidth;
        const viewportWidth = chartElement.clientWidth;

        const taskPosition = (timeFromStart / totalTimeSpan) * chartWidth;
        const scrollPosition = Math.max(0, taskPosition - viewportWidth / 2);

        chartElement.scrollTo({
          left: scrollPosition,
          behavior: 'smooth',
        });

        if (timelineRef.current) {
          timelineRef.current.scrollTo({
            left: scrollPosition,
            behavior: 'smooth',
          });
        }

        // Highlight the task's own date span in the header, matching how the "Today"
        // button focuses its column, so the scroll reads as landing on this task's bar.
        if (task.end_date) {
          setHighlightedDateRange({ start: new Date(task.start_date), end: new Date(task.end_date) });
        }
      } else if (!task.start_date) {
        message.info(`Task "${task.name}" has no start date set`);
      }
    },
    [dateRange]
  );

  const handleSectionPositionUpdate = useCallback((sectionId: string, top: number) => {
    setExpandedSectionPositions(prev => {
      const newMap = new Map(prev);
      newMap.set(sectionId, top);
      return newMap;
    });
  }, []);

  // Get expanded sections with their task data
  const expandedSectionsData = useMemo(() => {
    return Array.from(expandedTasks).map(sectionId => {
      const sectionTask = tasks.find(t => {
        const isPhase = t.type === 'milestone' || t.is_milestone;
        if (!isPhase) return false;
        
        const phaseId = t.id === 'phase-unmapped'
          ? 'unmapped'
          : t.phase_id || t.id.replace('phase-', '');
        
        return phaseId === sectionId;
      });

      return {
        sectionId,
        task: sectionTask,
        top: expandedSectionPositions.get(sectionId) || 0,
      };
    }).filter(item => item.task);
  }, [expandedTasks, tasks, expandedSectionPositions]);

  if (tasksError || phasesError) {
    message.error('Failed to load Gantt chart data');
  }

  if (loading) {
    return (
      <div
        style={{
          height: 'calc(100vh - 176px)', // matches the loaded view's own height below, so
          // centering doesn't depend on an ancestor happening to have an explicit height
          // (h-full alone collapsed to content height here, leaving the loader pinned near
          // the top instead of vertically centered).
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <WorklenzLogoLoader />
      </div>
    );
  }

  return (
    <GanttProvider
      value={{
        tasks,
        phases,
        viewMode,
        groupingMode,
        projectId: projectId || '',
        dateRange,
        onRefresh: handleRefresh,
        timelineCalculator,
        highlightedDateRange,
        setHighlightedDateRange,
        shouldScroll,
      }}
    >
      <div
        ref={rootRef}
        className={`gantt-scroll-container${isDragging ? ' resizing' : ''}`}
        style={{
          height: 'calc(100vh - 186px)', // Adjust based on your header height
          overflowY: 'hidden',
          overflowX: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          className="flex flex-col flex-1"
          style={{
            minHeight: 0,
            gap: '8px',
          }}
        >
          <GanttToolbar
            viewMode={viewMode}
            groupingMode={groupingMode}
            onViewModeChange={handleViewModeChange}
            onGroupingModeChange={handleGroupingModeChange}
            dateRange={dateRange}
            onScrollToToday={handleScrollToToday}
            onToggleFullscreen={handleToggleFullscreen}
          />
          <div
            className="flex flex-1 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700"
            style={{ minHeight: 0 }}
          >
            <div className="relative flex w-full h-full">
              <div
                className={`gantt-left-panel flex flex-col flex-shrink-0${isDragging ? ' resizing' : ''}`}
                style={{
                  width: `${panelWidth}px`,
                  backgroundColor: token.colorBgContainer,
                  borderRight: `1px solid ${token.colorBorderSecondary}`,
                  zIndex: 20,
                }}
              >
                <GanttTaskList
                  tasks={tasks}
                  projectId={projectId || ''}
                  viewMode={viewMode}
                  onTaskClick={handleTaskClick}
                  onPhaseClick={handlePhaseClick}
                  onCreateTask={handleCreateTask}
                  onCreateQuickTask={handleCreateQuickTask}
                  onCreatePhase={handleCreatePhase}
                  onCreateStatus={handleCreateStatus}
                  onPhaseReorder={handlePhaseReorder}
                  onStatusReorder={handleStatusReorder}
                  onTaskReorder={handleTaskReorder}
                  groupingMode={groupingMode}
                  ref={taskListRef}
                  onScroll={handleTaskListScroll}
                  expandedTasks={expandedTasks}
                  onExpandedTasksChange={setExpandedTasks}
                  animatingTasks={animatingTasks}
                  onTaskNameClick={handleTaskNameClick}
                  onSectionPositionUpdate={handleSectionPositionUpdate}
                />
                {/* Resize handle */}
                <div
                  className={`gantt-resize-handle${isDragging ? ' dragging active' : ''}`}
                  onMouseDown={handleMouseDown}
                  title="Drag to resize (min: 180px, max: 480px)"
                />
              </div>

              <div
                className="flex-1 flex flex-col overflow-hidden gantt-timeline-container"
                style={{ marginLeft: '0px' }}
                ref={containerRef}
              >
                <GanttTimeline
                  viewMode={viewMode}
                  ref={timelineRef}
                  containerRef={containerRef}
                  dateRange={dateRange}
                  onScroll={handleTimelineScroll}
                />
                <GanttChart
                  tasks={tasks}
                  viewMode={viewMode}
                  ref={chartRef}
                  onScroll={handleChartScroll}
                  onPhaseClick={handlePhaseClick}
                  onTaskClick={handleTaskClick}
                  containerRef={containerRef}
                  dateRange={dateRange}
                  phases={phases}
                  expandedTasks={expandedTasks}
                  animatingTasks={animatingTasks}
                  isAllCollapsed={isAllCollapsed}
                  onExpandedTasksChange={setExpandedTasks}
                  onCreateQuickTask={handleCreateQuickTask}
                  projectId={projectId || ''}
                  onRefresh={handleRefresh}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <ManagePhaseModal
        open={showPhaseModal}
        onClose={handleClosePhaseModal}
        projectId={projectId}
      />

      <ManageStatusModal
        open={showStatusModal}
        onClose={handleCloseStatusModal}
        projectId={projectId}
      />

      <PhaseDetailsModal
        open={showPhaseDetailsModal}
        onClose={handleClosePhaseDetailsModal}
        phase={selectedPhase}
        onPhaseUpdate={handlePhaseUpdate}
      />
    </GanttProvider>
  );
});

ProjectViewGantt.displayName = 'ProjectViewGantt';

export default ProjectViewGantt;
