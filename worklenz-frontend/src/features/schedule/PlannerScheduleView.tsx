import React, { useMemo, useState, useEffect, useRef } from 'react';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(isoWeek);
import { useTranslation } from 'react-i18next';
import { Button, Flex, Space, theme, Tooltip, Popover } from '@/shared/antd-imports';
import { SettingOutlined, ReloadOutlined } from '@ant-design/icons';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { themeWiseColor } from '@/utils/themeWiseColor';
import CustomAvatar from '@/components/CustomAvatar';
import PlannerMultiFilterDropdown from '@/features/schedule/PlannerMultiFilterDropdown';
import PlannerAddTaskModal from '@/features/schedule/PlannerAddTaskModal';
import {
  scheduleApi,
  useFetchScheduleMembersQuery,
  useFetchTaskTimelineQuery,
} from '@/api/schedule/scheduleApi';
import { projectsApiService } from '@/api/projects/projects.api.service';
import { getTeamMembers } from '@/features/team-members/team-members.slice';
import { selectShowWeekends } from '@/features/schedule/scheduleSliceRTK';
import { toggleSettingsDrawer, getWorking } from '@/features/schedule/scheduleSlice';
import { fetchProjectStatuses } from '@/features/projects/lookups/projectStatuses/projectStatusesSlice';
import { fetchProjectPriorities } from '@/features/projects/priority/projectPrioritySlice';
import { setSelectedTaskId, setShowTaskDrawer } from '@/features/task-drawer/task-drawer.slice';
import { setProjectId } from '@/features/project/project.slice';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { useAuthService } from '@/hooks/useAuth';
import { getUserSession } from '@/utils/session-helper';
import { WorklenzLogoLoader } from '@/components/worklenz-loader/worklenz-loader';
import { getEnglishWeekdayName } from '@/utils/dateUtils';

type ZoomLevel = 'days' | 'weeks' | 'months';

const ZOOM_CFG: Record<ZoomLevel, { label: string; colWidth: number; weeksSpan: number; dense: 'full' | 'compact' | 'bar' }> = {
  days: { label: 'Days', colWidth: 190, weeksSpan: 1, dense: 'full' },
  weeks: { label: 'Weeks', colWidth: 64, weeksSpan: 3, dense: 'compact' },
  months: { label: 'Months', colWidth: 30, weeksSpan: 10, dense: 'bar' },
};

const WEEKDAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Vertical drag-to-resize (chip's bottom-edge handle, Days/Weeks zoom only): dragging
// changes a task's total_minutes by 0.5h per quantized step. RESIZE_PX_PER_HOUR doubles as
// both "px of drag = 1h" and "px the chip grows per hour" so the live-drag height and the
// eventual post-commit render use the same scale and never visibly jump.
const RESIZE_PX_PER_HOUR: Record<'full' | 'compact', number> = { full: 24, compact: 14 };
const CHIP_BASE_HEIGHT: Record<'full' | 'compact', number> = { full: 46, compact: 18 }; // unchanged default card size — only ROW_HEIGHT_FLOOR is doubled
const RESIZE_BASE_HOURS = 1; // chip stays at CHIP_BASE_HEIGHT for <=1h/day
const MIN_TOTAL_MINUTES = 30; // 0.5h floor, mirrors PlannerAddTaskModal's est-hours min={0.5}
const MAX_TOTAL_MINUTES = 24 * 60; // 24h ceiling
const ROW_HEIGHT_FLOOR = 112; // doubled from the previous hardcoded 56

const getChipHeight = (hours: number, dense: 'full' | 'compact') =>
  CHIP_BASE_HEIGHT[dense] + Math.max(0, hours - RESIZE_BASE_HOURS) * RESIZE_PX_PER_HOUR[dense];

// tasks.total_minutes is a Postgres NUMERIC column, returned by node-postgres as a string
// when not explicitly cast (task-timeline-controller.ts now casts it, but this stays as
// cheap defensive insurance) — using it raw in `+` arithmetic silently does string
// concatenation instead of addition (e.g. "125" + (-30) => "125-30" => NaN via Math.max).
const asMinutes = (v: unknown): number => Number(v) || 0;

// Same 80% / 100% thresholds and bucket set as PlannerWorkloadView's Utilization
// filter, kept as its own local copy (same pattern as this file's other
// intentionally-duplicated helpers) rather than a shared import.
const UTIL_LEVELS: { value: string; label: string; test: (pct: number) => boolean }[] = [
  { value: 'available', label: 'Available (<80%)', test: pct => pct < 80 },
  { value: 'near', label: 'Near capacity (80–100%)', test: pct => pct >= 80 && pct <= 100 },
  { value: 'over', label: 'Over-allocated (>100%)', test: pct => pct > 100 },
];

const PlannerScheduleView: React.FC = () => {
  const { t } = useTranslation('schedule');
  const dispatch = useAppDispatch();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const { token } = theme.useToken();
  const showWeekends = useAppSelector(selectShowWeekends);
  const workingHours = useAppSelector(state => state.scheduleReducer.workingHours) || 8;
  const workingDaysRaw = useAppSelector(state => state.scheduleReducer.workingDays);
  const showTaskDrawer = useAppSelector(state => state.taskDrawerReducer.showTaskDrawer);

  // Org-configured working days (e.g. ['monday', ..., 'friday']) — falls back to Mon-Fri
  // when settings haven't loaded yet, so estimate-splitting works before the user ever
  // opens the settings drawer (which is what normally triggers the getWorking() fetch).
  const workingDaySet = useMemo(() => {
    const days = (workingDaysRaw?.length ? workingDaysRaw : ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'])
      .map((d: string) => d.toLowerCase());
    return new Set(days);
  }, [workingDaysRaw]);
  const isWorkingDay = (date: dayjs.Dayjs) => workingDaySet.has(getEnglishWeekdayName(date).toLowerCase());

  const [zoom, setZoom] = useState<ZoomLevel>('days');
  const [anchor, setAnchor] = useState(0); // day offset from the base week (Monday of current week)
  const [isRefreshing, setIsRefreshing] = useState(false);
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const bodyScrollRef = useRef<HTMLDivElement>(null);
  const leftBodyScrollRef = useRef<HTMLDivElement>(null);
  const gridWrapperRef = useRef<HTMLDivElement>(null);
  const [gridWidth, setGridWidth] = useState(0);

  // The member column (left) and the day grid (right) are two entirely separate,
  // non-overlapping panels — not a position:sticky column inside the horizontally
  // scrolling grid. A sticky column whose scroll offset is mirrored from another pane
  // via JS (rather than native scrolling) is prone to repaint/ghosting glitches in
  // Chromium, which is what caused the member column to look transparent with scrolled
  // date headers bleeding through. Splitting the panels removes the sticky positioning
  // (and the bug) entirely; only plain scrollTop/scrollLeft mirroring remains.
  //
  // Row height is content-driven on the right (tallest stacked day cell wins) and must
  // match on the left (member avatar/name), so each right-panel row reports its actual
  // rendered height here via ResizeObserver, and the left panel applies that height
  // directly rather than trying to recompute it from chip counts.
  const [rowHeights, setRowHeights] = useState<Record<string, number>>({});
  const rowObserverRef = useRef<ResizeObserver | null>(null);
  useEffect(() => {
    const observer = new ResizeObserver(entries => {
      setRowHeights(prev => {
        let changed = false;
        const next = { ...prev };
        entries.forEach(entry => {
          const id = (entry.target as HTMLElement).dataset.memberRowId;
          if (!id) return;
          const h = Math.ceil(entry.contentRect.height);
          if (next[id] !== h) {
            next[id] = h;
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    });
    rowObserverRef.current = observer;
    return () => observer.disconnect();
  }, []);
  const registerRowRef = (memberId: string) => (el: HTMLDivElement | null) => {
    if (!el || !rowObserverRef.current) return;
    el.dataset.memberRowId = memberId;
    rowObserverRef.current.observe(el);
  };

  const { socket } = useSocket();
  const currentSession = useAuthService().getCurrentSession();
  // Chip drag-and-drop: same row (member unchanged) + different day column = due-date
  // change; same day column (date unchanged) + different member row = reassignment.
  // Dragging to a different member AND a different day does both at once.
  const dragInfo = useRef<{ taskId: string; projectId: string; memberId: string; date: string } | null>(null);

  // Vertical drag-to-resize (chip bottom-edge handle) — separate gesture from the
  // whole-chip native HTML5 drag above. suppressChipDragRef is set true for the duration
  // of a resize gesture (from the handle's onMouseDown) so the chip's own onDragStart can
  // cancel the browser's native drag-detection; stopPropagation() alone doesn't stop that
  // walk-up-the-DOM detection, only an explicit preventDefault() inside onDragStart does.
  const suppressChipDragRef = useRef(false);

  // Set true for the duration of a resize gesture (vertical estimate-resize or horizontal
  // date-resize) so the day-cell's own onClick (which opens the Add Task popup) doesn't
  // fire off the resize's terminal mouseup. A resize gesture ends wherever the cursor
  // happens to be, which is very often the bare cell rather than the chip (the chip only
  // occupies part of the cell, and resizing moves the pointer off it) — the browser then
  // dispatches a normal click at that point, which bubbles straight to the cell's onClick
  // since there's no chip in between to stopPropagation() it. This is what caused
  // https://github.com/Worklenz/worklenz-business/issues/1861 (Add Task popup opening on
  // drag). Self-consumed by the cell's onClick so it only ever blocks the one click caused
  // by this gesture; each resize's onMouseUp also clears it on a zero-delay timeout as a
  // fallback for when no click fires at all (e.g. the gesture ends back over the chip,
  // whose own onClick already stops propagation before reaching the cell). The passive
  // "+ Add new" rollover hint is untouched by this — it's pure CSS :hover, which keeps
  // tracking the live cursor position over whichever cell is underneath throughout the
  // drag, since this gesture uses plain mousemove tracking rather than native HTML5 DnD.
  const suppressCellClickRef = useRef(false);

  const resizeGestureRef = useRef<{
    taskId: string;
    parentTaskId: string | null;
    startY: number;
    baseTotalMinutes: number;
    dense: 'full' | 'compact';
    step: number;
    onMouseMove: (e: MouseEvent) => void;
    onMouseUp: () => void;
  } | null>(null);
  // Live-preview override for the task currently being resized — state (not a ref, unlike
  // dragInfo) because every day-cell showing this task must re-render to reflect the new
  // height/hours as the user drags, before the change is committed via socket.
  const [pendingEstimate, setPendingEstimate] = useState<{ taskId: string; totalMinutes: number } | null>(null);

  // Horizontal drag-to-resize (chip left/right edge, Days/Weeks zoom only) — dragging the
  // left edge changes start_date, the right edge changes end_date, via the same
  // TASK_START_DATE_CHANGE/TASK_END_DATE_CHANGE events handleChipDrop already uses.
  // Estimated time isn't touched here — it's already split evenly across the (new) working
  // days by hoursForTaskOnDay/workingDaysInRange once the date range changes, so widening or
  // narrowing the range live-changes the per-day split for free, no separate math needed.
  const hResizeGestureRef = useRef<{
    taskId: string;
    parentTaskId: string | null;
    edge: 'start' | 'end';
    startX: number;
    baseStartDate: string;
    baseEndDate: string;
    dayPx: number;
    dayDelta: number;
    onMouseMove: (e: MouseEvent) => void;
    onMouseUp: () => void;
  } | null>(null);
  const [pendingDateRange, setPendingDateRange] = useState<{
    taskId: string;
    start_date: string;
    end_date: string;
  } | null>(null);

  // Filters — each is a multi-select; an empty array means "no restriction" (all)
  const [filterRoles, setFilterRoles] = useState<string[]>([]);
  const [filterMembers, setFilterMembers] = useState<string[]>([]);
  const [filterProjects, setFilterProjects] = useState<string[]>([]);
  const [filterClients, setFilterClients] = useState<string[]>([]);
  const [filterStatuses, setFilterStatuses] = useState<string[]>([]);
  const [filterPriorities, setFilterPriorities] = useState<string[]>([]);
  const [filterUtilLevels, setFilterUtilLevels] = useState<string[]>([]);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const anyFilterActive =
    filterRoles.length > 0 ||
    filterMembers.length > 0 ||
    filterProjects.length > 0 ||
    filterClients.length > 0 ||
    filterStatuses.length > 0 ||
    filterPriorities.length > 0 ||
    filterUtilLevels.length > 0;
  const clearAllFilters = () => {
    setFilterRoles([]);
    setFilterMembers([]);
    setFilterProjects([]);
    setFilterClients([]);
    setFilterStatuses([]);
    setFilterPriorities([]);
    setFilterUtilLevels([]);
  };

  // Add-task modal — opened by clicking an empty (or occupied) grid cell,
  // pre-seeded with the clicked member + date. See PlannerAddTaskModal.
  const [addTaskCell, setAddTaskCell] = useState<{ memberId: string; date: dayjs.Dayjs } | null>(null);
  const openCreateTask = (memberId: string, date: dayjs.Dayjs) => {
    dispatch(setShowTaskDrawer(false));
    setAddTaskCell({ memberId, date });
  };
  const closeCreateTask = () => setAddTaskCell(null);

  const cfg = ZOOM_CFG[zoom];

  // Monday of the current week — stable anchor origin, matching how the prototype
  // walks whole weeks so weekend-toggling changes which columns show, not the scan size.
  const baseDate = useMemo(() => dayjs().startOf('isoWeek'), []);

  const days = useMemo(() => {
    const rawSpanDays = cfg.weeksSpan * 7;
    const list: { offset: number; date: dayjs.Dayjs }[] = [];
    for (let i = 0; i < rawSpanDays; i++) {
      const date = baseDate.add(anchor + i, 'day');
      const dow = date.day(); // 0 Sun .. 6 Sat
      if (!showWeekends && (dow === 0 || dow === 6)) continue;
      list.push({ offset: anchor + i, date });
    }
    return list;
  }, [baseDate, anchor, cfg.weeksSpan, showWeekends]);

  // Measure the grid pane so day columns can stretch to fill leftover width instead of
  // leaving a blank gap — both header and body read this same value, so they always
  // agree on column width (unlike flex-grow, which drifted between the two panes).
  useEffect(() => {
    const el = gridWrapperRef.current;
    if (!el) return;
    const observer = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width;
      if (width) setGridWidth(width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // gridWrapperRef now wraps only the right (day-grid) panel, so gridWidth already is
  // the space available for day columns — no need to subtract the member column's width.
  const colWidth = useMemo(() => {
    if (!gridWidth || !days.length) return cfg.colWidth;
    const natural = days.length * cfg.colWidth;
    return gridWidth > natural ? gridWidth / days.length : cfg.colWidth;
  }, [gridWidth, days.length, cfg.colWidth]);

  // Consecutive-day groups sharing a month, used to render a spanning "September 2026"
  // header row above the per-day columns in the Months zoom level.
  const monthGroups = useMemo(() => {
    const groups: { key: string; label: string; count: number }[] = [];
    days.forEach(d => {
      const key = d.date.format('YYYY-MM');
      const last = groups[groups.length - 1];
      if (last && last.key === key) {
        last.count += 1;
      } else {
        groups.push({ key, label: d.date.format('MMM YYYY'), count: 1 });
      }
    });
    return groups;
  }, [days]);

  // Consecutive-day groups sharing an ISO week, used to render a spanning "Week 32"
  // header row above the per-day columns in the Weeks zoom level (mirrors monthGroups).
  const weekGroups = useMemo(() => {
    const weekLabel = t('week', { defaultValue: 'Week' });
    const groups: { key: string; label: string; count: number }[] = [];
    days.forEach(d => {
      const key = `${d.date.year()}-${d.date.isoWeek()}`;
      const last = groups[groups.length - 1];
      if (last && last.key === key) {
        last.count += 1;
      } else {
        groups.push({ key, label: `${weekLabel} ${d.date.isoWeek()}`, count: 1 });
      }
    });
    return groups;
  }, [days, t]);

  const rangeLabel = useMemo(() => {
    if (!days.length) return '';
    const weekLabel = t('week', { defaultValue: 'Week' });
    const first = days[0].date;
    const last = days[days.length - 1].date;
    const sameMonth = first.month() === last.month() && first.year() === last.year();
    const monthPart = sameMonth
      ? first.format('MMMM YYYY')
      : `${first.format('MMM')} - ${last.format('MMM YYYY')}`;
    const weekPart =
      first.isoWeek() === last.isoWeek()
        ? `${weekLabel} ${first.isoWeek()}`
        : `${weekLabel} ${first.isoWeek()} - ${last.isoWeek()}`;
    return `${monthPart}, ${weekPart}`;
  }, [days, t]);

  // ── Data ──
  const { data: teamDataResponse, isLoading: teamLoading, refetch: refetchMembers } =
    useFetchScheduleMembersQuery();
  const teamData = teamDataResponse?.body || [];

  const startDate = days[0]?.date.format('YYYY-MM-DD');
  const endDate = days[days.length - 1]?.date.format('YYYY-MM-DD');

  // Project source: fetch projects filtered by BOTH status and priority together, so the
  // two filters combine as an AND (matching how the rest of the app treats multiple active
  // filters) instead of one silently overriding the other. When neither is selected, this
  // fetches all projects.
  const [projectList, setProjectList] = useState<any[]>([]);
  // Tracks whether the initial project fetch has resolved at least once, distinct from
  // projectList.length === 0 — a team with genuinely zero projects would otherwise leave
  // shouldSkipTaskQuery permanently true below and never load the task timeline.
  const [projectListLoaded, setProjectListLoaded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const statusParam = filterStatuses.length ? filterStatuses.join(' ') : null;
    const priorityParam = filterPriorities.length ? filterPriorities.join(' ') : null;
    projectsApiService
      .getProjects(1, 999, null, null, null, null, statusParam, null, priorityParam)
      .then(res => {
        if (!cancelled) {
          setProjectList(res.body?.data || []);
          setProjectListLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [filterStatuses, filterPriorities]);

  // When the Project Status or Priority filter changes, clear the explicit project
  // selection — the set of projects it was chosen from has just changed.
  useEffect(() => {
    setFilterProjects([]);
  }, [filterStatuses, filterPriorities]);

  // Project source: fetch projects filtered ONLY by client when client filter is active
  // When no client filter is selected, fetch all projects
  const [clientProjectList, setClientProjectList] = useState<any[]>([]);
  useEffect(() => {
    let cancelled = false;
    // Fetch all projects then filter by client name
    if (filterClients.length > 0) {
      projectsApiService
        .getProjects(1, 999, null, null, null, null, null, null, null)
        .then(res => {
          if (!cancelled) {
            // Filter projects by client name
            const clientNames = filterClients;
            const filtered = (res.body?.data || []).filter((p: any) => 
              clientNames.includes(p.client_name)
            );
            setClientProjectList(filtered);
          }
        });
    }
    return () => {
      cancelled = true;
    };
  }, [filterClients]);

  // When project client filter changes, clear the project selection
  // because the available projects have changed
  useEffect(() => {
    if (filterClients.length > 0) {
      setFilterProjects([]);
    }
  }, [filterClients]);

  // When project status/priority is filtered, automatically include those (AND-combined)
  // filtered projects in the task query so only tasks from matching projects are shown.
  // Client filter takes precedence if active, followed by status/priority, then explicit projects
  const effectiveProjectIds = useMemo(() => {
    // If client filter is active, use ONLY the client-filtered projects
    if (filterClients.length > 0 && clientProjectList.length > 0) {
      return clientProjectList.map((p: any) => p.id);
    }
    // If status or priority filter is active, use the combined filtered projects
    if ((filterStatuses.length > 0 || filterPriorities.length > 0) && projectList.length > 0) {
      return projectList.map((p: any) => p.id);
    }
    // If explicit project filter is set, use those
    if (filterProjects && filterProjects.length > 0) {
      return filterProjects;
    }
    // Otherwise no project filtering
    return [];
  }, [filterClients, clientProjectList, filterStatuses, filterPriorities, projectList, filterProjects]);

  // Project source: fetch projects filtered ONLY by client when client filter is active
  // When no client filter is selected, fetch all projects
  // Skip the query until we have loaded the initial project list, so we fetch the correct tasks on first load
  // This prevents loading all tasks initially and then filtering - instead we filter first time
  const shouldSkipTaskQuery = !startDate || !endDate || !projectListLoaded ||
    (filterClients.length > 0 && clientProjectList.length === 0);

  const {
    data: taskTimelineResponse,
    isLoading: tasksLoading,
    isFetching: tasksFetching,
    refetch: refetchTasks,
  } = useFetchTaskTimelineQuery(
    {
      startDate,
      endDate,
      projectId: effectiveProjectIds.length ? effectiveProjectIds.join(',') : undefined,
      memberId: filterMembers.length ? filterMembers.join(',') : undefined,
      // Don't pass priorityId if we're filtering by projects (which already filters by project priority)
      // Only pass priorityId if we're filtering individual tasks by priority (when no project/status filter is active)
      priorityId: (effectiveProjectIds.length === 0 && filterPriorities.length > 0) ? filterPriorities.join(',') : undefined,
    },
    { skip: shouldSkipTaskQuery }
  );

  const drawerTaskId = useAppSelector(state => state.taskDrawerReducer.selectedTaskId);
  const drawerTaskName = useAppSelector(
    state => state.taskDrawerReducer.taskFormViewModel?.task?.name ?? null
  );

  const [taskNameOverrides, setTaskNameOverrides] = React.useState<Record<string, string>>({});


  useEffect(() => {
    setTaskNameOverrides({});
  }, [taskTimelineResponse]);

  useEffect(() => {
    if (!socket) return;
    const handleTaskNameChange = (data: { id: string; name: string }) => {
      if (!data?.id || !data?.name) return;
      setTaskNameOverrides(prev => ({ ...prev, [data.id]: data.name }));
    };
    socket.on(SocketEvents.TASK_NAME_CHANGE.toString(), handleTaskNameChange);
    return () => {
      socket.off(SocketEvents.TASK_NAME_CHANGE.toString(), handleTaskNameChange);
    };
  }, [socket]);


  const rawTasks = taskTimelineResponse?.body || [];
  const tasks = React.useMemo(
    () =>
      rawTasks.map((t: any) => {
        if (drawerTaskId && t.id === drawerTaskId && drawerTaskName) {
          return { ...t, name: drawerTaskName };
        }
        if (taskNameOverrides[t.id]) {
          return { ...t, name: taskNameOverrides[t.id] };
        }
        return t;
      }),
    [rawTasks, taskNameOverrides, drawerTaskId, drawerTaskName]
  );

  // Drop the resize live-preview once the refetched tasks[] genuinely reflects the
  // committed value — hoursForTaskOnDay then reads identically whether or not
  // pendingEstimate exists, so this transition is invisible. Guarded against an active
  // gesture so an unrelated tasks refetch can't clear the preview mid-drag.
  useEffect(() => {
    if (!pendingEstimate || resizeGestureRef.current) return;
    const match = tasks.find((t: any) => t.id === pendingEstimate.taskId);
    if (match && asMinutes(match.total_minutes) === pendingEstimate.totalMinutes) {
      setPendingEstimate(null);
    }
  }, [tasks, pendingEstimate]);

  // Safety net: if the server silently rejects the write (e.g. a restricted user — the
  // backend handler returns early with no ack in that case), don't let the live preview
  // lie forever. Re-arms on every pendingEstimate change, so it only fires ~8s after
  // dragging has actually stopped.
  useEffect(() => {
    if (!pendingEstimate) return;
    const timer = setTimeout(() => setPendingEstimate(null), 8000);
    return () => clearTimeout(timer);
  }, [pendingEstimate]);

  const { teamMembers } = useAppSelector(state => state.teamMembersReducer);
  useEffect(() => {
    dispatch(getTeamMembers({ index: 0, size: 200, field: null, order: null, search: null, all: true }));
    dispatch(getWorking());
  }, [dispatch]);

  const roleByMemberId = useMemo(() => {
    const map: Record<string, string> = {};
    (teamMembers?.data || []).forEach((m: any) => {
      if (m.id && m.job_title) map[m.id] = m.job_title;
    });
    return map;
  }, [teamMembers]);

  const roles = useMemo(
    () => Array.from(new Set(Object.values(roleByMemberId))).filter(Boolean),
    [roleByMemberId]
  );

  const projectStatuses = useAppSelector(state => state.projectStatusesReducer.projectStatuses);
  const projectStatusesInitialized = useAppSelector(state => state.projectStatusesReducer.initialized);
  const projectPriorities = useAppSelector(state => state.projectPriorityReducer.priorities);
  const projectPrioritiesInitialized = useAppSelector(state => state.projectPriorityReducer.initialized);
  useEffect(() => {
    if (!projectStatusesInitialized) dispatch(fetchProjectStatuses());
    if (!projectPrioritiesInitialized) dispatch(fetchProjectPriorities());
  }, [dispatch, projectStatusesInitialized, projectPrioritiesInitialized]);

  const clientByProjectId = useMemo(() => {
    const map: Record<string, string> = {};
    const projectsToUse = filterClients.length > 0 ? clientProjectList : projectList;
    projectsToUse.forEach((p: any) => {
      if (p.id && p.client_name) map[p.id] = p.client_name;
    });
    return map;
  }, [projectList, clientProjectList, filterClients]);

  const clients = useMemo(
    () => {
      const projectsToUse = filterClients.length > 0 ? clientProjectList : projectList;
      return Array.from(new Set(projectsToUse.map((p: any) => p.client_name).filter(Boolean)));
    },
    [projectList, clientProjectList, filterClients]
  );

  // When a Status/Priority/Client filter is active, show the filtered projects
  const filteredProjectOptions = useMemo(() => {
    if (filterClients.length > 0 && clientProjectList.length > 0) {
      return clientProjectList.map((p: any) => ({ value: p.id, label: p.name }));
    }
    return projectList.map((p: any) => ({ value: p.id, label: p.name }));
  }, [filterClients, clientProjectList, projectList]);

  const statusOrPriorityActive = filterStatuses.length > 0 || filterPriorities.length > 0;
  const clientFilterActive = filterClients.length > 0;
  const filteredProjectIds = useMemo(() => {
    if (clientFilterActive && clientProjectList.length > 0) {
      return new Set(clientProjectList.map((p: any) => p.id));
    }
    return new Set(projectList.map((p: any) => p.id));
  }, [clientFilterActive, clientProjectList, projectList]);

  const members = useMemo(() => {
    return teamData.filter((member: any) => {
      const memberId = member.team_member_id || member.id;
      if (filterMembers.length && !filterMembers.includes(memberId)) return false;
      if (filterRoles.length && !filterRoles.includes(roleByMemberId[memberId])) return false;

      // When a Status/Priority/Client filter is active, only show members assigned to a
      // project in the (already filtered) filtered project set.
      if (statusOrPriorityActive || clientFilterActive) {
        const hasMatchingProject = (member.projects || []).some((p: any) => filteredProjectIds.has(p.id));
        if (!hasMatchingProject) return false;
      }

      if (filterProjects.length) {
        const hasProject = (member.projects || []).some((p: any) => filterProjects.includes(p.id));
        if (!hasProject) return false;
      }
      return true;
    });
  }, [
    teamData,
    filterRoles,
    filterMembers,
    filterProjects,
    statusOrPriorityActive,
    clientFilterActive,
    filteredProjectIds,
    roleByMemberId,
  ]);

  // A task's effective start/end date — the live drag preview if one is in progress for
  // this task, otherwise its real dates. Threaded through both tasksFor (so day-cells
  // start/stop showing the chip live as the range is dragged) and hoursForTaskOnDay (so the
  // per-day estimate split recomputes live too).
  const taskDateRange = (task: any) => {
    if (pendingDateRange && pendingDateRange.taskId === task.id) {
      return { start: pendingDateRange.start_date, end: pendingDateRange.end_date };
    }
    return { start: task.start_date ? task.start_date.slice(0, 10) : null, end: task.end_date ? task.end_date.slice(0, 10) : null };
  };

  // Tasks assigned to `memberId` whose start/end range covers `date` — a task's date range
  // can legitimately span a non-working day (e.g. "starts Mon, due next Mon" spans a
  // weekend), but no card is ever shown for a non-working day itself: only the Schedule
  // Settings drawer's marked working days get a chip, whether that's a traditional weekend
  // or a custom non-working day. Matches hoursForTaskOnDay/workingDaysInRange below, which
  // already exclude non-working days from the estimate split the same way.
  const tasksFor = (memberId: string, date: dayjs.Dayjs) => {
    if (!isWorkingDay(date)) return [];
    const dateStr = date.format('YYYY-MM-DD');
    return tasks.filter((task: any) => {
      if (!task.assignees?.some((a: any) => a.id === memberId)) return false;
      const { start, end } = taskDateRange(task);
      if (!start || !end) return false;
      return dateStr >= start && dateStr <= end;
    });
  };

  // Estimate is split equally across the working days between start and due date
  // (inclusive) — calendar days that fall on a non-working day (per Schedule Settings,
  // e.g. weekends) don't count toward the divisor and get 0h, so the total across the
  // visible days always adds back up to the task's actual estimate, never more.
  const workingDaysInRange = (start: dayjs.Dayjs, end: dayjs.Dayjs) => {
    const spanDays = Math.max(1, end.diff(start, 'day') + 1);
    let count = 0;
    for (let i = 0; i < spanDays; i++) {
      if (isWorkingDay(start.add(i, 'day'))) count++;
    }
    return count;
  };

  const hoursForTaskOnDay = (task: any, date: dayjs.Dayjs) => {
    if (!isWorkingDay(date)) return 0;
    const { start: startStr, end: endStr } = taskDateRange(task);
    const start = dayjs(startStr);
    const end = dayjs(endStr);
    const workingSpan = Math.max(1, workingDaysInRange(start, end));
    const totalMinutes =
      pendingEstimate && pendingEstimate.taskId === task.id ? pendingEstimate.totalMinutes : asMinutes(task.total_minutes);
    return totalMinutes / 60 / workingSpan;
  };

  // Shared hover-tooltip content (project, est time, status, phase, assignees) —
  // used both by visible grid chips and by the "+N" collapsed task list rows,
  // so hovering a task shows the same details either way.
  const renderTaskTooltipTitle = (task: any, date: dayjs.Dayjs) => {
    const hours = hoursForTaskOnDay(task, date);
    const overCapacity = hours > workingHours;
    return (
      <div style={{ minWidth: 180 }}>
        {overCapacity && (
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: '#ff4d4f',
              background: 'rgba(255,77,79,.12)',
              borderRadius: 3,
              padding: '3px 6px',
              marginBottom: 6,
            }}
          >
            ⚠ {t('exceedsWorkingHours', { defaultValue: 'Exceeds working hours' })} ({hours.toFixed(1)}h / {workingHours}h)
          </div>
        )}
        <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6 }}>{task.name}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12 }}>
          <div>
            <span style={{ opacity: 0.65 }}>{t('project', { defaultValue: 'Project' })}: </span>
            {task.project_name || '-'}
          </div>
          {isWorkingDay(date) && (
            <div>
              <span style={{ opacity: 0.65 }}>{t('estHoursPerDay', { defaultValue: 'Estimated Hours' })}: </span>
              <span style={{ color: overCapacity ? '#ff4d4f' : undefined, fontWeight: overCapacity ? 700 : undefined }}>
                {hours.toFixed(1)}h
              </span>
            </div>
          )}
          <div>
            <span style={{ opacity: 0.65 }}>{t('status', { defaultValue: 'Status' })}: </span>
            {task.status_name ? (
              <span
                style={{
                  display: 'inline-block',
                  padding: '0 6px',
                  borderRadius: 3,
                  background: task.status_color || '#888',
                  color: '#fff',
                  fontSize: 12,
                }}
              >
                {task.status_name}
              </span>
            ) : (
              '-'
            )}
          </div>
          <div>
            <span style={{ opacity: 0.65 }}>{t('phase', { defaultValue: 'Phase' })}: </span>
            {task.phase_name || '-'}
          </div>
          <div>
            <span style={{ opacity: 0.65 }}>{t('assignees', { defaultValue: 'Assignees' })}: </span>
            {task.assignees?.length ? task.assignees.map((a: any) => a.name).join(', ') : '-'}
          </div>
        </div>
      </div>
    );
  };

  const dayEstTotal = (memberId: string, date: dayjs.Dayjs) =>
    tasksFor(memberId, date).reduce((sum, t) => sum + hoursForTaskOnDay(t, date), 0);

  const memberTotalHours = (memberId: string) =>
    days.reduce((sum, d) => sum + dayEstTotal(memberId, d.date), 0);

  // Same Utilization bucketing as PlannerWorkloadView: hours scheduled over the
  // visible range ÷ capacity (working days shown × working hours/day).
  const workingDaysVisible = useMemo(() => days.filter(d => isWorkingDay(d.date)).length, [days, workingDaySet]);

  const visibleMembers = useMemo(() => {
    if (!filterUtilLevels.length) return members;
    const cap = workingDaysVisible * workingHours;
    return members.filter((m: any) => {
      const memberId = m.team_member_id || m.id;
      const pct = cap ? (memberTotalHours(memberId) / cap) * 100 : 0;
      return filterUtilLevels.some(level => UTIL_LEVELS.find(l => l.value === level)?.test(pct));
    });
  }, [members, filterUtilLevels, workingDaysVisible, workingHours, tasks]);

  // ── Handlers ──
  const handlePrevious = () => setAnchor(a => a - cfg.weeksSpan * 7);
  const handleNext = () => setAnchor(a => a + cfg.weeksSpan * 7);
  const handleCurrent = () => setAnchor(0);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    dispatch(
      scheduleApi.util.invalidateTags([
        'DateList',
        'Members',
        'MemberProjects',
        'Capacity',
        'Workload',
        'CapacityReport',
        'Conflicts',
        'TaskTimeline',
        'TimeOff',
      ])
    );
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const handleOpenSettings = () => {
    dispatch(getWorking());
    dispatch(toggleSettingsDrawer());
  };

  const handleChipDrop = (targetMemberId: string, targetDate: dayjs.Dayjs) => {
    const info = dragInfo.current;
    dragInfo.current = null;
    if (!info) return;

    const targetDateStr = targetDate.format('YYYY-MM-DD');
    const dateChanged = info.date !== targetDateStr;
    const memberChanged = info.memberId !== targetMemberId;
    if (!dateChanged && !memberChanged) return;

    if (dateChanged) {
      const timeZone = getUserSession()?.timezone_name || Intl.DateTimeFormat().resolvedOptions().timeZone;
      socket?.emit(
        SocketEvents.TASK_START_DATE_CHANGE.toString(),
        JSON.stringify({ task_id: info.taskId, start_date: targetDateStr, parent_task: null, time_zone: timeZone })
      );
      socket?.emit(
        SocketEvents.TASK_END_DATE_CHANGE.toString(),
        JSON.stringify({ task_id: info.taskId, end_date: targetDateStr, parent_task: null, time_zone: timeZone })
      );
    }

    if (memberChanged) {
      socket?.emit(
        SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(),
        JSON.stringify({
          team_member_id: info.memberId,
          project_id: info.projectId,
          task_id: info.taskId,
          reporter_id: currentSession?.id,
          mode: 1,
        })
      );
      socket?.emit(
        SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(),
        JSON.stringify({
          team_member_id: targetMemberId,
          project_id: info.projectId,
          task_id: info.taskId,
          reporter_id: currentSession?.id,
          mode: 0,
        })
      );
    }

    dispatch(
      scheduleApi.util.invalidateTags(['TaskTimeline', 'MemberProjects', 'Members', 'Workload', 'Capacity'])
    );
  };

  // Vertical drag-to-resize: dragging the chip's bottom-edge handle up/down changes the
  // task's overall total_minutes by 0.5h per quantized step (RESIZE_PX_PER_HOUR px). The
  // gesture's mousemove/mouseup closures are created once here and stored on the ref (not
  // redeclared per-render) so document.removeEventListener always matches the exact
  // function reference passed to addEventListener — same pattern as useColumnResizeHandler.
  const startChipResize = (e: React.MouseEvent, task: any, dense: 'full' | 'compact') => {
    e.preventDefault();
    e.stopPropagation();
    suppressChipDragRef.current = true;
    suppressCellClickRef.current = true;

    // Chain off the live preview (if one is already pending for this task) rather than
    // task.total_minutes directly — the RTK Query cache doesn't reflect a just-committed
    // drag until the server acks and the grid refetches, so starting a second drag before
    // that round-trip completes would otherwise base it on a stale pre-commit value.
    const liveTotalMinutes =
      pendingEstimate && pendingEstimate.taskId === task.id ? pendingEstimate.totalMinutes : asMinutes(task.total_minutes);

    const gesture: NonNullable<typeof resizeGestureRef.current> = {
      taskId: task.id,
      parentTaskId: task.parent_task_id ?? null,
      startY: e.clientY,
      baseTotalMinutes: liveTotalMinutes,
      dense,
      step: 0,
      onMouseMove: (moveEvent: MouseEvent) => {
        const g = resizeGestureRef.current;
        if (!g) return;
        const deltaY = moveEvent.clientY - g.startY; // down = positive = grow
        const nextStep = Math.round((deltaY / RESIZE_PX_PER_HOUR[g.dense]) * 2);
        if (nextStep === g.step) return;
        g.step = nextStep;
        const nextMinutes = Math.min(
          MAX_TOTAL_MINUTES,
          Math.max(MIN_TOTAL_MINUTES, g.baseTotalMinutes + nextStep * 30)
        );
        setPendingEstimate({ taskId: g.taskId, totalMinutes: nextMinutes });
      },
      onMouseUp: () => {
        const g = resizeGestureRef.current;
        resizeGestureRef.current = null;
        if (g) {
          document.removeEventListener('mousemove', g.onMouseMove);
          document.removeEventListener('mouseup', g.onMouseUp);
        }
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        suppressChipDragRef.current = false;
        // Zero-delay fallback: runs after the browser's own terminal click (if any) has
        // already been dispatched and consumed the flag, so this only ever catches the
        // no-click case.
        setTimeout(() => { suppressCellClickRef.current = false; }, 0);

        if (!g || g.step === 0) {
          setPendingEstimate(null);
          return;
        }

        const finalMinutes = Math.min(
          MAX_TOTAL_MINUTES,
          Math.max(MIN_TOTAL_MINUTES, g.baseTotalMinutes + g.step * 30)
        );

        // Patch this view's own TaskTimeline cache entry (no full refetch) once — and only
        // once — the server has actually applied the write. Patching unconditionally on
        // mouseup (as this used to) meant a silently-rejected write (e.g. a restricted
        // user — same case the 8s pendingEstimate timeout below guards against) left the
        // cache permanently asserting a value that was never persisted, since nothing
        // afterward re-verified it against the server. Waiting for the ack mirrors
        // PlannerAddTaskModal.scheduleAndAssign's per-task-id ack filtering.
        let acked = false;
        const eventName = SocketEvents.TASK_TIME_ESTIMATION_CHANGE.toString();
        const onAck = (data: { id?: string }) => {
          if (acked || data?.id !== g.taskId) return;
          acked = true;
          socket?.off(eventName, onAck);
          dispatch(
            scheduleApi.util.updateQueryData('fetchTaskTimeline', { startDate, endDate }, draft => {
              const item = draft.body?.find(t => t.id === g.taskId);
              if (item) item.total_minutes = finalMinutes;
            })
          );
        };
        socket?.on(eventName, onAck);
        // If the ack never arrives, stop listening rather than leaking the handler — the
        // pendingEstimate timeout below already reverts the live preview in that case, and
        // since the cache was never patched, the chip correctly falls back to the task's
        // real, untouched value (same self-healing behavior as handleChipDrop's
        // invalidateTags path).
        setTimeout(() => {
          if (!acked) socket?.off(eventName, onAck);
        }, 8000);
        socket?.emit(
          eventName,
          JSON.stringify({
            task_id: g.taskId,
            total_hours: Math.floor(finalMinutes / 60),
            total_minutes: finalMinutes % 60,
            parent_task: g.parentTaskId,
          })
        );
        // pendingEstimate is intentionally left set here — the effect above clears it once
        // tasks[] reflects this value (via the ack-triggered patch above, or the eventual
        // refetch other tabs/users get through useScheduleSocketHandlers.ts's existing
        // invalidateTags-on-echo handling), avoiding a visual jump in the meantime.
      },
    };

    resizeGestureRef.current = gesture;
    document.addEventListener('mousemove', gesture.onMouseMove);
    document.addEventListener('mouseup', gesture.onMouseUp);
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  };

  // If the component unmounts mid-drag (e.g. navigating away from Planner), remove the
  // still-active document listeners rather than leaking them into the rest of the app.
  useEffect(() => {
    return () => {
      const g = resizeGestureRef.current;
      if (g) {
        document.removeEventListener('mousemove', g.onMouseMove);
        document.removeEventListener('mouseup', g.onMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
  }, []);

  // Horizontal drag-to-resize: dragging a chip's left/right edge changes start_date/
  // end_date by whole days. dayPx is captured at gesture start from the current colWidth
  // (already "pixels per day" at every zoom level, including Weeks, since each entry in
  // `days` is always one calendar day — only the column width shrinks by zoom) so the
  // edge tracks the cursor 1:1 regardless of zoom.
  const startChipDateResize = (e: React.MouseEvent, task: any, edge: 'start' | 'end') => {
    e.preventDefault();
    e.stopPropagation();
    suppressChipDragRef.current = true;
    suppressCellClickRef.current = true;

    const { start: liveStart, end: liveEnd } = taskDateRange(task);

    const gesture: NonNullable<typeof hResizeGestureRef.current> = {
      taskId: task.id,
      parentTaskId: task.parent_task_id ?? null,
      edge,
      startX: e.clientX,
      baseStartDate: liveStart || dayjs().format('YYYY-MM-DD'),
      baseEndDate: liveEnd || dayjs().format('YYYY-MM-DD'),
      dayPx: colWidth,
      dayDelta: 0,
      onMouseMove: (moveEvent: MouseEvent) => {
        const g = hResizeGestureRef.current;
        if (!g) return;
        const deltaX = moveEvent.clientX - g.startX; // right = positive
        const nextDelta = Math.round(deltaX / g.dayPx);
        if (nextDelta === g.dayDelta) return;
        g.dayDelta = nextDelta;

        let newStart = dayjs(g.baseStartDate);
        let newEnd = dayjs(g.baseEndDate);
        if (g.edge === 'start') {
          newStart = newStart.add(nextDelta, 'day');
          if (newStart.isAfter(newEnd)) newStart = newEnd; // can't push start past end
        } else {
          newEnd = newEnd.add(nextDelta, 'day');
          if (newEnd.isBefore(newStart)) newEnd = newStart; // can't push end before start
        }
        setPendingDateRange({
          taskId: g.taskId,
          start_date: newStart.format('YYYY-MM-DD'),
          end_date: newEnd.format('YYYY-MM-DD'),
        });
      },
      onMouseUp: () => {
        const g = hResizeGestureRef.current;
        hResizeGestureRef.current = null;
        if (g) {
          document.removeEventListener('mousemove', g.onMouseMove);
          document.removeEventListener('mouseup', g.onMouseUp);
        }
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        suppressChipDragRef.current = false;
        // Zero-delay fallback: runs after the browser's own terminal click (if any) has
        // already been dispatched and consumed the flag, so this only ever catches the
        // no-click case.
        setTimeout(() => { suppressCellClickRef.current = false; }, 0);

        if (!g || g.dayDelta === 0) {
          setPendingDateRange(null);
          return;
        }

        let newStart = dayjs(g.baseStartDate);
        let newEnd = dayjs(g.baseEndDate);
        if (g.edge === 'start') {
          newStart = newStart.add(g.dayDelta, 'day');
          if (newStart.isAfter(newEnd)) newStart = newEnd;
        } else {
          newEnd = newEnd.add(g.dayDelta, 'day');
          if (newEnd.isBefore(newStart)) newEnd = newStart;
        }
        const newStartStr = newStart.format('YYYY-MM-DD');
        const newEndStr = newEnd.format('YYYY-MM-DD');

        const timeZone = getUserSession()?.timezone_name || Intl.DateTimeFormat().resolvedOptions().timeZone;
        const eventName = (
          g.edge === 'start' ? SocketEvents.TASK_START_DATE_CHANGE : SocketEvents.TASK_END_DATE_CHANGE
        ).toString();

        // Same ack-gated patch as the vertical resize's commit step above — only assert the
        // new date into the cache once the server confirms it, so a silently-rejected write
        // (restricted user) self-heals back to the task's real dates via the 8s
        // pendingDateRange timeout below instead of leaving a never-persisted value cached.
        let acked = false;
        const onAck = (data: { id?: string }) => {
          if (acked || data?.id !== g.taskId) return;
          acked = true;
          socket?.off(eventName, onAck);
          dispatch(
            scheduleApi.util.updateQueryData('fetchTaskTimeline', { startDate, endDate }, draft => {
              const item = draft.body?.find(t => t.id === g.taskId);
              if (item) {
                if (g.edge === 'start') item.start_date = newStartStr;
                else item.end_date = newEndStr;
              }
            })
          );
        };
        socket?.on(eventName, onAck);
        setTimeout(() => {
          if (!acked) socket?.off(eventName, onAck);
        }, 8000);

        if (g.edge === 'start') {
          socket?.emit(
            eventName,
            JSON.stringify({ task_id: g.taskId, start_date: newStartStr, parent_task: g.parentTaskId, time_zone: timeZone })
          );
        } else {
          socket?.emit(
            eventName,
            JSON.stringify({ task_id: g.taskId, end_date: newEndStr, parent_task: g.parentTaskId, time_zone: timeZone })
          );
        }
        // pendingDateRange intentionally left set — cleared by the effect below once
        // tasks[] reflects it (via the ack-triggered patch above), avoiding a visual jump
        // in the meantime.
      },
    };

    hResizeGestureRef.current = gesture;
    document.addEventListener('mousemove', gesture.onMouseMove);
    document.addEventListener('mouseup', gesture.onMouseUp);
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
  };

  // Drop the date-range live-preview once tasks[] genuinely reflects the committed value —
  // mirrors the equivalent pendingEstimate effect above.
  useEffect(() => {
    if (!pendingDateRange || hResizeGestureRef.current) return;
    const match = tasks.find((t: any) => t.id === pendingDateRange.taskId);
    if (
      match &&
      (match.start_date || '').slice(0, 10) === pendingDateRange.start_date &&
      (match.end_date || '').slice(0, 10) === pendingDateRange.end_date
    ) {
      setPendingDateRange(null);
    }
  }, [tasks, pendingDateRange]);

  useEffect(() => {
    if (!pendingDateRange) return;
    const timer = setTimeout(() => setPendingDateRange(null), 8000);
    return () => clearTimeout(timer);
  }, [pendingDateRange]);

  // Same unmount-safety reasoning as the vertical resize's cleanup effect above.
  useEffect(() => {
    return () => {
      const g = hResizeGestureRef.current;
      if (g) {
        document.removeEventListener('mousemove', g.onMouseMove);
        document.removeEventListener('mouseup', g.onMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
  }, []);

  // Shared by both the visible-chip and popover-hidden-chip blocks below — cancels the
  // browser's native drag-start (which walks up the DOM from the mousedown target to the
  // nearest draggable=true ancestor) when the gesture actually originated on the resize
  // handle, so resizing never also triggers the whole-chip move/reassign drag.
  const makeChipDragStartHandler =
    (task: any, memberId: string, date: dayjs.Dayjs) => (e: React.DragEvent) => {
      if (suppressChipDragRef.current) {
        e.preventDefault();
        return;
      }
      e.stopPropagation();
      dragInfo.current = { taskId: task.id, projectId: task.project_id, memberId, date: date.format('YYYY-MM-DD') };
    };

  // Small grip strip anchored to the chip's bottom edge (chip needs position:relative).
  // Days ('full') and Weeks ('compact') zoom only — Months ('bar') chips are 8px slivers
  // with no room for a handle and are left untouched.
  const renderResizeHandle = (task: any, dense: 'full' | 'compact', color: string, handleHeight: number) => (
    <div
      onMouseDown={e => startChipResize(e, task, dense)}
      onClick={e => e.stopPropagation()}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: handleHeight,
        cursor: 'ns-resize',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div className="planner-chip-grip" style={{ width: 20, height: 3, borderRadius: 2, background: `${color}80` }} />
    </div>
  );

  // Left/right edge grip — rendered only on the chip instance in the task's first day cell
  // (edge 'start') or last day cell (edge 'end'), since a multi-day task is drawn as a
  // separate chip in every day column it spans rather than one continuous bar. Days/Weeks
  // zoom only, same scoping as renderResizeHandle above.
  const renderDateResizeHandle = (task: any, edge: 'start' | 'end', color: string) => (
    <div
      onMouseDown={e => startChipDateResize(e, task, edge)}
      onClick={e => e.stopPropagation()}
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        [edge === 'start' ? 'left' : 'right']: 0,
        width: 8,
        cursor: 'ew-resize',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div className="planner-chip-grip" style={{ width: 3, height: 16, borderRadius: 2, background: `${color}80` }} />
    </div>
  );

  const bg = themeWiseColor('#fff', '#141414', themeMode);
  const cardBg = themeWiseColor('#fff', '#1f1f1f', themeMode);
  const borderColor = themeWiseColor('#e8e8e8', '#303030', themeMode);
  const todayStr = dayjs().format('YYYY-MM-DD');

  // Matches src/pages/home/home-continue-card/HomeContinueCard.tsx's tab-pill group
  // (same border/radius/active-fill pattern) so Planner's zoom toggle reads as the same
  // control family as Home.
  const zoomBtnStyle = (active: boolean, isLast: boolean): React.CSSProperties => ({
    padding: '5px 12px',
    border: 'none',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 500,
    borderRight: isLast ? 'none' : `1px solid ${token.colorBorderSecondary}`,
    background: active ? token.colorPrimary : 'transparent',
    color: active ? token.colorWhite ?? '#fff' : token.colorText,
    transition: 'all .15s',
    whiteSpace: 'nowrap',
  });

  // Closing the task drawer on any click within the Planner page (filters, date-nav,
  // grid cells/chips, empty space) — the drawer itself and the add-task modal are both
  // rendered via portals outside this subtree, so clicks inside them never reach here.
  const closeTaskDrawerOnOutsideClick = () => {
    if (showTaskDrawer) dispatch(setShowTaskDrawer(false));
  };

  // Matches the LEFT/RIGHT panels' actual header stack height (see the same
  // cfg.dense==='bar' / zoom==='weeks' conditional rows in both panels below) so the
  // empty-state overlay can start right below the header instead of covering it —
  // Workload keeps its grid header visible under its empty state, and Schedule should too.
  const headerHeight = (cfg.dense === 'bar' ? 24 : 0) + (zoom === 'weeks' ? 24 : 0) + 40;

  // Shown as a centered overlay (see the position:absolute/inset:0 wrapper next to the
  // loading spinner below) when a filter leaves no members to display — same
  // friendly-and-positive copy as PlannerWorkloadView's emptyStateBlock, so Schedule and
  // Workload read as one consistent Planner. Centered over the whole grid (both the
  // member column and the day grid), same reasoning as the loading spinner: rendering it
  // inside just one of the two panels would center it in that sliver, not on screen.
  const emptyStateBlock = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>
          {anyFilterActive
            ? t('scheduleEmptyFilteredTitle', { defaultValue: "You're all caught up here" })
            : t('scheduleEmptyTitle', { defaultValue: 'Nothing to show yet' })}
        </div>
        <div style={{ fontSize: 12, opacity: 0.55, maxWidth: 340 }}>
          {anyFilterActive
            ? t('scheduleEmptyFilteredDesc', {
                defaultValue: 'No one matches the current filters. Try widening Role, Members, Projects, Clients, Status, Priority, or Utilization.',
              })
            : t('scheduleEmptyMembersDesc', { defaultValue: 'No team members to show yet.' })}
        </div>
        {anyFilterActive && (
          <Button size="small" style={{ marginTop: 6 }} onClick={clearAllFilters}>
            {t('clearFilters', { defaultValue: 'Clear filters' })}
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <div
      onClick={closeTaskDrawerOnOutsideClick}
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        paddingTop: 16,
        boxSizing: 'border-box',
        minHeight: 0,
      }}
    >
      {/* Resize-handle grip marks (bottom/left/right) stay hidden until the card is
          hovered, so the grid doesn't show three grab marks on every card at all times. */}
      <style>{`
        .planner-chip-grip { opacity: 0; transition: opacity .12s ease; }
        .planner-chip:hover .planner-chip-grip { opacity: 1; }
        .planner-add-hint { opacity: 0; transition: opacity .12s ease; }
        .planner-day-cell:hover .planner-add-hint { opacity: 1; }
        .planner-add-hint-inline { max-height: 0; margin-top: 0; overflow: hidden; transition: opacity .12s ease, max-height .15s ease, margin-top .15s ease; }
        .planner-day-cell:hover .planner-add-hint-inline { max-height: 20px; margin-top: 4px; }
      `}</style>

      {/* Filters + date-nav box — boxed toolbar, mirrors the task list view's
          rounded/bordered filter bar (see ImprovedTaskFiltersContainer). */}
      <div
        style={{
          background: cardBg,
          border: `1px solid ${borderColor}`,
          borderRadius: 8,
          flexShrink: 0,
        }}
      >
      {/* Filters row */}
      <Flex align="center" gap={8} wrap="wrap" style={{ padding: '10px 12px' }}>
        <PlannerMultiFilterDropdown
          label={t('allRoles', { defaultValue: 'Role' })}
          options={roles.map(r => ({ value: r, label: r }))}
          selected={filterRoles}
          onChange={setFilterRoles}
        />
        <PlannerMultiFilterDropdown
          label={t('allMembers', { defaultValue: 'Members' })}
          options={teamData.map((m: any) => ({ value: m.team_member_id || m.id, label: m.name }))}
          selected={filterMembers}
          onChange={setFilterMembers}
        />
        {(!showMoreFilters ? true : true) && (
          <>
            <PlannerMultiFilterDropdown
              label={t('allProjects', { defaultValue: 'Projects' })}
              options={filteredProjectOptions}
              selected={filterProjects}
              onChange={setFilterProjects}
            />
            <PlannerMultiFilterDropdown
              label={t('allClients', { defaultValue: 'Clients' })}
              options={clients.map(c => ({ value: c as string, label: c as string }))}
              selected={filterClients}
              onChange={setFilterClients}
            />
            <PlannerMultiFilterDropdown
              label={t('allStatuses', { defaultValue: 'Project Status' })}
              options={projectStatuses.map((s: any) => ({ value: s.id, label: s.name }))}
              selected={filterStatuses}
              onChange={setFilterStatuses}
            />
            <PlannerMultiFilterDropdown
              label={t('allPriorities', { defaultValue: 'Priority' })}
              options={projectPriorities.map((p: any) => ({ value: p.id, label: p.name }))}
              selected={filterPriorities}
              onChange={setFilterPriorities}
            />
            <PlannerMultiFilterDropdown
              label={t('allUtilLevels', { defaultValue: 'Utilization' })}
              options={UTIL_LEVELS.map(l => ({ value: l.value, label: l.label }))}
              selected={filterUtilLevels}
              onChange={setFilterUtilLevels}
            />
          </>
        )}
      </Flex>

      {/* Date-nav + zoom row */}
      <Flex
        align="center"
        gap={8}
        wrap="wrap"
        style={{ padding: '8px 12px', borderTop: `1px solid ${borderColor}` }}
      >
        <span style={{ fontSize: 14, fontWeight: 600, marginRight: 8 }}>{rangeLabel}</span>
        <Button
          size="small"
          style={{ fontSize: 12, borderRadius: 7 }}
          onClick={handlePrevious}
          title={t('previous', { defaultValue: 'Previous' })}
        >
          ‹
        </Button>
        <Button size="small" style={{ fontSize: 12, borderRadius: 7 }} onClick={handleCurrent}>
          {t('today', { defaultValue: 'Today' })}
        </Button>
        <Button
          size="small"
          style={{ fontSize: 12, borderRadius: 7 }}
          onClick={handleNext}
          title={t('next', { defaultValue: 'Next' })}
        >
          ›
        </Button>

        <div
          style={{
            marginLeft: 'auto',
            display: 'inline-flex',
            border: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: 7,
            overflow: 'hidden',
          }}
        >
          {Object.entries(ZOOM_CFG).map(([k, z], idx, arr) => (
            <button
              key={k}
              onClick={() => setZoom(k as ZoomLevel)}
              style={zoomBtnStyle(zoom === k, idx === arr.length - 1)}
            >
              {t(`zoom${k.charAt(0).toUpperCase()}${k.slice(1)}`, { defaultValue: z.label })}
            </button>
          ))}
        </div>

        <Space size={4}>
          <Button
            size="small"
            icon={<ReloadOutlined />}
            onClick={handleRefresh}
            loading={isRefreshing}
            shape="circle"
            title={t('refreshSchedule', { defaultValue: 'Refresh Schedule' })}
          />
          <Button
            size="small"
            shape="circle"
            onClick={handleOpenSettings}
            title={t('settings', { defaultValue: 'Settings' })}
          >
            <SettingOutlined />
          </Button>
        </Space>
      </Flex>
      </div>

      {/* Calendar box — boxed to match the filters box above (mirrors the task list
          view's bordered/rounded table container). */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          border: `1px solid ${borderColor}`,
          borderRadius: 8,
          overflow: 'hidden',
          background: cardBg,
        }}
      >
      {/* Grid — the member column (left) and the day grid (right) are two separate
          panels rather than a position:sticky column inside the scrolling grid (see
          the note by rowHeights above for why). */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', position: 'relative' }}>
        {/* Loading spinner centered over the whole grid (both panels) — rendering it
            inside just the narrow 240px member column instead would center it in that
            sliver, not on screen. */}
        {teamLoading && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 5,
              background: bg,
            }}
          >
            <WorklenzLogoLoader />
          </div>
        )}

        {/* Empty state, same overlay technique as the loading spinner above — centered
            over the whole grid body (both panels), not just the narrow member column or
            wherever the day-grid happens to be scrolled to. Starts below headerHeight so
            the member/day column headers stay visible, same as Workload's empty state. */}
        {!teamLoading && visibleMembers.length === 0 && (
          <div
            style={{
              position: 'absolute',
              top: headerHeight,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 5,
              background: bg,
            }}
          >
            {emptyStateBlock}
          </div>
        )}

        {/* LEFT: member column */}
        <div
          style={{
            width: 240,
            minWidth: 240,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            borderRight: `1px solid ${borderColor}`,
            background: cardBg,
          }}
        >
          {cfg.dense === 'bar' && <div style={{ height: 24, minHeight: 24, borderBottom: `1px solid ${borderColor}` }} />}
          {zoom === 'weeks' && <div style={{ height: 24, minHeight: 24, borderBottom: `1px solid ${borderColor}` }} />}
          <div
            style={{
              height: 40,
              minHeight: 40,
              display: 'flex',
              alignItems: 'center',
              padding: '0 16px',
              fontSize: 12,
              fontWeight: 600,
              opacity: 0.45,
              textTransform: 'uppercase',
              borderBottom: `1px solid ${borderColor}`,
            }}
          >
            {t('member', { defaultValue: 'Member' })}
          </div>
          <div
            ref={leftBodyScrollRef}
            onScroll={() => {
              if (bodyScrollRef.current && leftBodyScrollRef.current) {
                bodyScrollRef.current.scrollTop = leftBodyScrollRef.current.scrollTop;
              }
            }}
            style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', scrollbarWidth: 'none' }}
          >
            {teamLoading || visibleMembers.length === 0 ? null : (
              visibleMembers.map((m: any) => {
                const memberId = m.team_member_id || m.id;
                const totalHours = memberTotalHours(memberId);
                const totalHoursLabel = `${Math.floor(totalHours)}h ${Math.round((totalHours % 1) * 60)
                  .toString()
                  .padStart(2, '0')}min`;

                return (
                  <div
                    key={memberId}
                    style={{
                      height: rowHeights[memberId] ?? ROW_HEIGHT_FLOOR,
                      minHeight: ROW_HEIGHT_FLOOR,
                      borderBottom: `1px solid ${borderColor}`,
                      padding: '10px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <CustomAvatar avatarName={m.name || '?'} avatarUrl={m.avatar_url} size={30} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 12 }}>{m.name}</div>
                      <div style={{ fontSize: 12, opacity: 0.45 }}>{totalHoursLabel}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT: day grid */}
        <div ref={gridWrapperRef} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Header */}
          <div
            ref={headerScrollRef}
            style={{
              overflowX: 'auto',
              overflowY: 'hidden',
              scrollbarWidth: 'none',
              background: cardBg,
              borderBottom: `1px solid ${borderColor}`,
              flexShrink: 0,
            }}
          >
            {cfg.dense === 'bar' && (
              <div style={{ display: 'flex', width: days.length * colWidth, height: 24, minHeight: 24, borderBottom: `1px solid ${borderColor}` }}>
                {monthGroups.map(g => (
                  <div
                    key={g.key}
                    style={{
                      width: g.count * colWidth,
                      minWidth: g.count * colWidth,
                      textAlign: 'center',
                      fontSize: 12,
                      fontWeight: 600,
                      opacity: 0.55,
                      borderRight: `1px solid ${borderColor}`,
                    }}
                  >
                    {g.label}
                  </div>
                ))}
              </div>
            )}
            {zoom === 'weeks' && (
              <div style={{ display: 'flex', width: days.length * colWidth, height: 24, minHeight: 24, borderBottom: `1px solid ${borderColor}` }}>
                {weekGroups.map(g => (
                  <div
                    key={g.key}
                    style={{
                      width: g.count * colWidth,
                      minWidth: g.count * colWidth,
                      textAlign: 'center',
                      fontSize: 12,
                      fontWeight: 600,
                      opacity: 0.55,
                      borderRight: `1px solid ${borderColor}`,
                    }}
                  >
                    {g.label}
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', width: days.length * colWidth, height: 40, minHeight: 40 }}>
              {days.map(d => {
                const dateStr = d.date.format('YYYY-MM-DD');
                const isToday = dateStr === todayStr;
                const isNonWorkingDay = !isWorkingDay(d.date);
                return (
                  <div
                    key={d.offset}
                    style={{
                      width: colWidth,
                      minWidth: colWidth,
                      flexShrink: 0,
                      textAlign: 'center',
                      padding: '6px 4px',
                      borderRight: `1px solid ${borderColor}`,
                      background: isToday ? token.colorPrimaryBg : isNonWorkingDay ? token.colorFillQuaternary : cardBg,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: isToday ? token.colorPrimary : undefined,
                      }}
                    >
                      {cfg.dense === 'bar' ? d.date.date() : `${WEEKDAY[(d.date.day() + 6) % 7]} ${d.date.date()}`}
                    </div>
                    {cfg.dense !== 'bar' && <div style={{ fontSize: 12, opacity: 0.45 }}>{d.date.format('MMM')}</div>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Body */}
          <div
            ref={bodyScrollRef}
            onScroll={() => {
              if (headerScrollRef.current && bodyScrollRef.current) {
                headerScrollRef.current.scrollLeft = bodyScrollRef.current.scrollLeft;
              }
              if (leftBodyScrollRef.current && bodyScrollRef.current) {
                leftBodyScrollRef.current.scrollTop = bodyScrollRef.current.scrollTop;
              }
            }}
            style={{ flex: 1, minHeight: 0, overflow: 'auto' }}
          >
          <div style={{ minWidth: days.length * colWidth, minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Rows */}
            <div style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column' }}>
              {!teamLoading && visibleMembers.length > 0 &&
              visibleMembers.map((m: any) => {
                const memberId = m.team_member_id || m.id;

                return (
                  // No flex-grow / fixed minHeight here on purpose — the row's height must
                  // come from its tallest child (the day cell with the most stacked task
                  // chips), which the left panel's row then matches via rowHeights
                  // (measured through the ResizeObserver registered below).
                  <div
                    key={memberId}
                    ref={registerRowRef(memberId)}
                    style={{ display: 'flex', minHeight: ROW_HEIGHT_FLOOR, borderBottom: `1px solid ${borderColor}` }}
                  >
                    {days.map(d => {
                      const dayTasks = tasksFor(memberId, d.date);
                      const used = dayEstTotal(memberId, d.date);
                      const over = used > workingHours;
                      const nonWorkingDay = !isWorkingDay(d.date);

                      // When more than 4 tasks stack in one cell, only the first 3
                      // render as full chips; the rest collapse behind a "+N" badge
                      // (hover to see the list, click a task there for the normal flow).
                      const maxVisible = 3;
                      const isCollapsed = dayTasks.length > 4;
                      const visibleTasks = isCollapsed ? dayTasks.slice(0, maxVisible) : dayTasks;
                      const hiddenTasks = isCollapsed ? dayTasks.slice(maxVisible) : [];

                      const openTaskDrawer = (task: any) => {
                        dispatch(setProjectId(task.project_id));
                        dispatch(setSelectedTaskId(task.id));
                        dispatch(setShowTaskDrawer(true));
                      };

                      return (
                        <div
                          key={d.offset}
                          className="planner-day-cell"
                          onClick={() => {
                            // A resize gesture's terminal mouseup landed here — consume the
                            // flag and swallow this click rather than opening Add Task.
                            if (suppressCellClickRef.current) {
                              suppressCellClickRef.current = false;
                              return;
                            }
                            openCreateTask(memberId, d.date);
                          }}
                          onDragOver={e => e.preventDefault()}
                          onDrop={e => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleChipDrop(memberId, d.date);
                          }}
                          style={{
                            width: colWidth,
                            minWidth: colWidth,
                            flexShrink: 0,
                            borderRight: `1px solid ${borderColor}`,
                            background: over
                              ? 'rgba(255,77,79,.06)'
                              : nonWorkingDay
                                ? token.colorFillQuaternary
                                : undefined,
                            padding: cfg.dense === 'full' ? '6px 5px' : '4px 3px',
                            display: 'flex',
                            flexDirection: 'column',
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                            {dayTasks.length === 0 && (
                              <div
                                className="planner-add-hint"
                                style={{
                                  flex: 1,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: cfg.dense === 'bar' ? 10 : 12,
                                  color: token.colorTextTertiary,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {cfg.dense === 'bar' ? '+' : `+ ${t('addNew', { defaultValue: 'Add new' })}`}
                              </div>
                            )}
                            {visibleTasks.map((task: any) => {
                              const color = task.project_color || token.colorPrimary;
                              const hours = hoursForTaskOnDay(task, d.date);
                              const dateStr = d.date.format('YYYY-MM-DD');
                              const taskRange = taskDateRange(task);
                              const isFirstDay = dateStr === taskRange.start;
                              const isLastDay = dateStr === taskRange.end;
                              return (
                                <Tooltip
                                  key={task.id}
                                  // The Task Drawer opens docked to the right edge of the screen. When it's
                                  // open, flip the tooltip to the left so it grows away from the drawer
                                  // instead of extending over it (issue #1883).
                                  placement={showTaskDrawer ? 'left' : 'right'}
                                  autoAdjustOverflow
                                  color={themeMode === 'dark' ? undefined : '#fff'}
                                  overlayInnerStyle={
                                    themeMode === 'dark'
                                      ? undefined
                                      : { color: token.colorText, boxShadow: '0 2px 8px rgba(0,0,0,.15)' }
                                  }
                                  title={renderTaskTooltipTitle(task, d.date)}
                                >
                                <div
                                  className="planner-chip"
                                  onClick={e => {
                                    e.stopPropagation();
                                    openTaskDrawer(task);
                                  }}
                                  draggable
                                  onDragStart={makeChipDragStartHandler(task, memberId, d.date)}
                                  style={{
                                    position: 'relative',
                                    cursor: 'grab',
                                    borderRadius: 4,
                                    background: `${color}18`,
                                    border: `1px solid ${color}40`,
                                    borderLeft: `3px solid ${color}`,
                                    padding: cfg.dense === 'full' ? '3px 6px' : cfg.dense === 'compact' ? '2px 4px' : 0,
                                    height: cfg.dense === 'bar' ? 8 : undefined,
                                    minHeight:
                                      cfg.dense === 'full' || cfg.dense === 'compact'
                                        ? getChipHeight(hours, cfg.dense)
                                        : undefined,
                                    overflow: 'hidden',
                                    display: cfg.dense === 'full' ? 'flex' : undefined,
                                    flexDirection: cfg.dense === 'full' ? 'column' : undefined,
                                  }}
                                >
                                  {cfg.dense === 'full' && (
                                    <>
                                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                                        {isWorkingDay(d.date) && (
                                          <span style={{ fontSize: 12, fontWeight: 700, color }}>
                                            {hours.toFixed(1)}h{hours > workingHours && ' ⚠'}
                                          </span>
                                        )}
                                        <span
                                          style={{
                                            fontSize: 12,
                                            opacity: 0.5,
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                          }}
                                        >
                                          {t('project', { defaultValue: 'Project' })}: {task.project_name}
                                        </span>
                                      </div>
                                      <div
                                        style={{
                                          fontSize: 12,
                                          lineHeight: 1.3,
                                          marginTop: 2,
                                          whiteSpace: 'nowrap',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                        }}
                                      >
                                        {t('task', { defaultValue: 'Task' })}: {task.name}
                                      </div>
                                    </>
                                  )}
                                  {cfg.dense === 'compact' && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 3, overflow: 'hidden' }}>
                                      {isWorkingDay(d.date) && (
                                        <span style={{ fontSize: 12, fontWeight: 700, color, flexShrink: 0 }}>{hours.toFixed(1)}h</span>
                                      )}
                                      <span
                                        style={{
                                          fontSize: 12,
                                          color,
                                          fontWeight: 500,
                                          whiteSpace: 'nowrap',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                        }}
                                      >
                                        {t('task', { defaultValue: 'Task' })}: {task.name}
                                      </span>
                                    </div>
                                  )}
                                  {(cfg.dense === 'full' || cfg.dense === 'compact') &&
                                    renderResizeHandle(task, cfg.dense, color, cfg.dense === 'full' ? 8 : 6)}
                                  {(cfg.dense === 'full' || cfg.dense === 'compact') &&
                                    isFirstDay &&
                                    renderDateResizeHandle(task, 'start', color)}
                                  {(cfg.dense === 'full' || cfg.dense === 'compact') &&
                                    isLastDay &&
                                    renderDateResizeHandle(task, 'end', color)}
                                </div>
                                </Tooltip>
                              );
                            })}
                            {hiddenTasks.length > 0 && (
                              <Popover
                                trigger="hover"
                                placement={showTaskDrawer ? 'left' : 'right'}
                                overlayInnerStyle={{ padding: 6 }}
                                content={
                                  <div
                                    style={{
                                      minWidth: 180,
                                      maxHeight: 220,
                                      overflowY: 'auto',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: 2,
                                    }}
                                  >
                                    {hiddenTasks.map((task: any) => {
                                      const hDateStr = d.date.format('YYYY-MM-DD');
                                      const hTaskRange = taskDateRange(task);
                                      const hIsFirstDay = hDateStr === hTaskRange.start;
                                      const hIsLastDay = hDateStr === hTaskRange.end;
                                      return (
                                      <Tooltip
                                        key={task.id}
                                        placement={showTaskDrawer ? 'left' : 'right'}
                                        autoAdjustOverflow
                                        color={themeMode === 'dark' ? undefined : '#fff'}
                                        overlayInnerStyle={
                                          themeMode === 'dark'
                                            ? undefined
                                            : { color: token.colorText, boxShadow: '0 2px 8px rgba(0,0,0,.15)' }
                                        }
                                        title={renderTaskTooltipTitle(task, d.date)}
                                      >
                                        <div
                                          className="planner-chip"
                                          onClick={e => {
                                            e.stopPropagation();
                                            openTaskDrawer(task);
                                          }}
                                          draggable
                                          onDragStart={makeChipDragStartHandler(task, memberId, d.date)}
                                          style={{
                                            position: 'relative',
                                            padding: cfg.dense === 'bar' ? '5px 8px' : '5px 8px 9px',
                                            fontSize: 12,
                                            borderRadius: 4,
                                            cursor: 'grab',
                                            borderLeft: `3px solid ${task.project_color || token.colorPrimary}`,
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                          }}
                                        >
                                          {isWorkingDay(d.date) && (
                                            <span style={{ fontWeight: 700 }}>
                                              {hoursForTaskOnDay(task, d.date).toFixed(1)}h{' '}
                                            </span>
                                          )}
                                          {t('task', { defaultValue: 'Task' })}: {task.name}
                                          {cfg.dense !== 'bar' &&
                                            renderResizeHandle(
                                              task,
                                              cfg.dense as 'full' | 'compact',
                                              task.project_color || token.colorPrimary,
                                              6
                                            )}
                                          {cfg.dense !== 'bar' &&
                                            hIsFirstDay &&
                                            renderDateResizeHandle(task, 'start', task.project_color || token.colorPrimary)}
                                          {cfg.dense !== 'bar' &&
                                            hIsLastDay &&
                                            renderDateResizeHandle(task, 'end', task.project_color || token.colorPrimary)}
                                        </div>
                                      </Tooltip>
                                      );
                                    })}
                                  </div>
                                }
                              >
                                <div
                                  onClick={e => e.stopPropagation()}
                                  style={{
                                    fontSize: 12,
                                    fontWeight: 700,
                                    textAlign: 'center',
                                    padding: '3px 4px',
                                    borderRadius: 4,
                                    cursor: 'pointer',
                                    background: token.colorFillSecondary,
                                    color: token.colorTextSecondary,
                                  }}
                                >
                                  +{hiddenTasks.length}
                                </div>
                              </Popover>
                            )}
                            {dayTasks.length > 0 && (
                              <div
                                className="planner-add-hint planner-add-hint-inline"
                                style={{
                                  fontSize: cfg.dense === 'bar' ? 10 : 12,
                                  color: token.colorTextTertiary,
                                  textAlign: 'center',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  flexShrink: 0,
                                }}
                              >
                                {cfg.dense === 'bar' ? '+' : `+ ${t('addNew', { defaultValue: 'Add new' })}`}
                              </div>
                            )}
                          </div>
                          {!nonWorkingDay && (cfg.dense === 'full' || cfg.dense === 'compact') && (
                            <div
                              style={{
                                fontSize: 12,
                                fontWeight: over ? 700 : 400,
                                opacity: over ? 1 : 0.4,
                                color: over ? '#ff4d4f' : undefined,
                                textAlign: 'center',
                                marginTop: cfg.dense === 'full' ? 6 : 3,
                              }}
                            >
                              {used.toFixed(1)}h / {workingHours}h
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
          </div>
        </div>
        </div>
      </div>
      </div>
      </div>

      <PlannerAddTaskModal
        open={!!addTaskCell}
        defaultDate={addTaskCell?.date ?? null}
        defaultMemberId={addTaskCell?.memberId ?? null}
        onClose={closeCreateTask}
      />
    </div>
  );
};

export default PlannerScheduleView;
