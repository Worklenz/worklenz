import React, { useEffect, useMemo, useRef, useState } from 'react';
import dayjs, { Dayjs } from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(isoWeek);
import { useTranslation } from 'react-i18next';
import {
  Button,
  Flex,
  Drawer,
  Form,
  Input,
  InputNumber,
  Select,
  DatePicker,
  Modal,
  Tooltip,
  Popover,
  Spin,
  Empty,
  message,
  theme,
} from '@/shared/antd-imports';
import { SettingOutlined, SearchOutlined } from '@ant-design/icons';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { themeWiseColor } from '@/utils/themeWiseColor';
import CustomAvatar from '@/components/CustomAvatar';
import { useFetchScheduleMembersQuery, useFetchTaskTimelineQuery, scheduleApi } from '@/api/schedule/scheduleApi';
import { projectsApiService } from '@/api/projects/projects.api.service';
import { getWorking, toggleSettingsDrawer } from '@/features/schedule/scheduleSlice';
import { tasksApiService } from '@/api/tasks/tasks.api.service';
import { fetchProjectStatuses } from '@/features/projects/lookups/projectStatuses/projectStatusesSlice';
import { fetchProjectPriorities } from '@/features/projects/priority/projectPrioritySlice';
import PlannerMultiFilterDropdown from '@/features/schedule/PlannerMultiFilterDropdown';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { useAuthService } from '@/hooks/useAuth';
import { getUserSession } from '@/utils/session-helper';
import { setSelectedTaskId, setShowTaskDrawer } from '@/features/task-drawer/task-drawer.slice';
import { setProjectId } from '@/features/project/project.slice';
import { ITask } from '@/types/tasks/task.types';
import { WorklenzLogoLoader } from '@/components/worklenz-loader/worklenz-loader';
import { getEnglishWeekdayName } from '@/utils/dateUtils';

type Axis = 'member' | 'project';
type Group = 'members' | 'projects';
type RangeKey = 'day' | 'week' | 'month';

const RANGE_CFG: Record<RangeKey, { label: string; spanDays: number }> = {
  day: { label: 'Day', spanDays: 1 },
  week: { label: 'Week', spanDays: 5 },
  month: { label: 'Month', spanDays: 28 },
};

const WEEKDAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const capColor = (pct: number) => (pct > 100 ? '#ff4d4f' : pct >= 80 ? '#faad14' : '#52c41a');

// Same 80% / 100% thresholds as capColor, exposed as filterable buckets for the
// Utilization filter (member axis only — LOAD on the project axis isn't a
// percentage-of-capacity, so bucketing doesn't apply there).
const UTIL_LEVELS: { value: string; label: string; test: (pct: number) => boolean }[] = [
  { value: 'available', label: 'Available (<80%)', test: pct => pct < 80 },
  { value: 'near', label: 'Near capacity (80–100%)', test: pct => pct >= 80 && pct <= 100 },
  { value: 'over', label: 'Over-allocated (>100%)', test: pct => pct > 100 },
];

// Same tab-pill look as PlannerScheduleView.tsx's zoomBtnStyle / PlannerTimelineView.tsx's
// zoomBtnStyle — kept as one shared helper so every pill toggle across Planner's three
// sub-views (Schedule, Timeline, Workload) renders identically.
const pillBtnStyle = (active: boolean, isLast: boolean, token: ReturnType<typeof theme.useToken>['token']): React.CSSProperties => ({
  padding: '5px 12px',
  border: 'none',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 500,
  borderRight: isLast ? 'none' : `1px solid ${token.colorBorderSecondary}`,
  background: active ? token.colorPrimary : 'transparent',
  color: active ? (token.colorWhite ?? '#fff') : token.colorText,
  transition: 'all .15s',
  whiteSpace: 'nowrap',
});

const businessDayCount = (start: Dayjs, end: Dayjs, isWorkingDay: (d: Dayjs) => boolean) => {
  let n = 0;
  const span = Math.max(0, end.diff(start, 'day'));
  for (let i = 0; i <= span; i++) {
    if (isWorkingDay(start.add(i, 'day'))) n++;
  }
  return Math.max(n, 1);
};

interface WlMember {
  id: string;
  name: string;
  avatarUrl?: string;
  role?: string;
  projectIds: string[];
}

interface WlProject {
  id: string;
  name: string;
  color: string;
  client?: string;
}

// One grid entry per (task × assignee). Workload deliberately collapses each task onto a
// single day — the underlying task record still has start/end dates (Schedule's model),
// but Workload's grid, drag/drop and reschedule semantics all operate on one day at a
// time, so `day` here is just the task's start date and "reschedule" overwrites both
// start and end with the same new date rather than preserving a range.
interface WlTask {
  id: string;
  taskId: string;
  memberId: string;
  projectId: string;
  day: string; // YYYY-MM-DD
  title: string;
  estHours: number | null;
  color: string;
  multiAssignee: boolean;
  statusName?: string;
  statusColor?: string;
  phaseName?: string;
  assigneeNames?: string[];
}

// Flat, no-task-attached commitment — see Section 3/9.3 of the build spec. There is no
// backend table for this yet (open question for the real build), so it lives in local
// component state only and does not survive a page refresh.
interface WlBlock {
  id: number;
  memberId: string;
  projectId: string;
  startDay: string;
  endDay: string;
  hours: number;
}

interface RowDef {
  axis: Axis;
  key: string;
  label: string;
  sub?: string;
  avatar: React.ReactNode;
  meterColor?: string;
}

interface AddPopoverCtx {
  axis: Axis;
  rowKey: string;
  rowLabel: string;
  day: string;
}

interface PeekItem {
  task?: WlTask;
  block?: WlBlock;
  focus?: 'assign' | 'date';
}

interface CtxMenuState {
  x: number;
  y: number;
  task: WlTask;
}

interface ToastState {
  message: string;
  undo?: () => void;
}

const FALLBACK_PROJECT_COLORS = ['#1677ff', '#722ed1', '#13a8a8', '#eb2f96', '#fa8c16', '#52c41a'];
const colorForId = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return FALLBACK_PROJECT_COLORS[hash % FALLBACK_PROJECT_COLORS.length];
};

const PlannerWorkloadView: React.FC = () => {
  const { t } = useTranslation('schedule');
  const dispatch = useAppDispatch();
  const { token } = theme.useToken();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const showTaskDrawer = useAppSelector(state => state.taskDrawerReducer.showTaskDrawer);
  const { socket } = useSocket();
  const currentSession = useAuthService().getCurrentSession();
  const timeZone = getUserSession()?.timezone_name || Intl.DateTimeFormat().resolvedOptions().timeZone;

  const bg = themeWiseColor('#fff', '#141414', themeMode);
  const cardBg = themeWiseColor('#fff', '#1f1f1f', themeMode);
  const borderColor = themeWiseColor('#e8e8e8', '#303030', themeMode);
  // Opaque shade for the sticky "Team Total" row — colorFillTertiary is a translucent
  // token meant for overlays, so using it directly let scrolled-past rows show through.
  const totalRowBg = themeWiseColor('#fafafa', '#262626', themeMode);

  // ── Shared workspace settings — same values Schedule/Resources use, not a second copy ──
  const workingHours = useAppSelector(state => state.scheduleReducer.workingHours) || 8;
  const workingDaysRaw = useAppSelector(state => state.scheduleReducer.workingDays);
  const workingDaySet = useMemo(() => {
    const days = (workingDaysRaw?.length
      ? workingDaysRaw
      : ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
    ).map((d: string) => d.toLowerCase());
    return new Set(days);
  }, [workingDaysRaw]);
  const isWorkingDay = (d: Dayjs) => workingDaySet.has(getEnglishWeekdayName(d).toLowerCase());

  // Default estimate for un-estimated tasks — set from the shared Settings drawer
  // (ScheduleSettingsDrawer), same one Schedule's gear icon opens.
  const fallbackEst = useAppSelector(state => state.scheduleReducer.defaultEstimateHours);

  useEffect(() => {
    dispatch(getWorking());
  }, [dispatch]);

  // ── View state ──
  const [group, setGroup] = useState<Group>('members');
  const [range, setRange] = useState<RangeKey>('week');
  const [anchor, setAnchor] = useState(0); // day offset from baseDate

  // Measures the sticky grid header row's actual height (it differs between the
  // day/week header — two lines of text — and the month header — one line), so the
  // empty-state overlay below can start right under it instead of covering it or
  // guessing a fixed pixel value. Re-observes on range change since that's what swaps
  // which header markup is mounted under this ref.
  const gridHeaderRef = useRef<HTMLDivElement>(null);
  const [gridHeaderHeight, setGridHeaderHeight] = useState(0);
  useEffect(() => {
    const el = gridHeaderRef.current;
    if (!el) return;
    const observer = new ResizeObserver(entries => {
      const height = entries[0]?.contentRect.height;
      if (height) setGridHeaderHeight(height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [range]);
  const baseDate = useMemo(() => dayjs().startOf('isoWeek'), []);

  // Day view defaults to today; Week/Month default to baseDate (Monday of this
  // week) — reset on every range switch so a leftover anchor from one view
  // doesn't leak into another (e.g. Day's "today" offset showing up as the
  // start of the week after switching back to Week view).
  useEffect(() => {
    setAnchor(range === 'day' ? dayjs().startOf('day').diff(baseDate, 'day') : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const [blocks, setBlocks] = useState<WlBlock[]>([]);

  const [addPopover, setAddPopover] = useState<AddPopoverCtx | null>(null);
  const [peek, setPeek] = useState<PeekItem | null>(null);
  const [ctxMenu, setCtxMenu] = useState<CtxMenuState | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string, undo?: () => void) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message: msg, undo });
    toastTimer.current = setTimeout(() => setToast(null), 6000);
  };

  const stepAnchor = (dir: 1 | -1) => {
    if (range === 'week') return setAnchor(a => a + dir * 7);
    if (range === 'month') return setAnchor(a => a + dir * 28);
    setAnchor(a => {
      let next = a + dir;
      while (!isWorkingDay(baseDate.add(next, 'day'))) next += dir;
      return next;
    });
  };

  const goToToday = () => {
    // For Day view, "0" is baseDate (start of this week), not necessarily today —
    // jump to today's actual offset instead. Week/Month already show the period
    // containing today when anchored at 0.
    if (range === 'day') {
      setAnchor(dayjs().startOf('day').diff(baseDate, 'day'));
    } else {
      setAnchor(0);
    }
  };

  // Visible business days for Day/Week grid columns
  const days = useMemo(() => {
    if (range === 'month') return [];
    const n = RANGE_CFG[range].spanDays;
    const list: { offset: number; date: Dayjs }[] = [];
    let o = anchor;
    let guard = 0;
    while (list.length < n && guard < 60) {
      const date = baseDate.add(o, 'day');
      if (isWorkingDay(date)) list.push({ offset: o, date });
      o++;
      guard++;
    }
    return list;
  }, [range, anchor, baseDate, workingDaySet]);

  // Weekly buckets for Month view — rollup meters only, no per-day cells / drag / add
  const weekBuckets = useMemo(() => {
    if (range !== 'month') return [];
    const buckets: { label: string; dates: string[] }[] = [];
    for (let w = 0; w < 4; w++) {
      const weekStart = anchor + w * 7;
      const dates: string[] = [];
      for (let i = 0; i < 7; i++) {
        const date = baseDate.add(weekStart + i, 'day');
        if (isWorkingDay(date)) dates.push(date.format('YYYY-MM-DD'));
      }
      const first = dayjs(dates[0] ?? baseDate.add(weekStart, 'day').format('YYYY-MM-DD'));
      const last = dayjs(dates[dates.length - 1] ?? first.format('YYYY-MM-DD'));
      const sameMonth = first.month() === last.month();
      const label = sameMonth ? `${first.format('MMM D')} – ${last.format('D')}` : `${first.format('MMM D')} – ${last.format('MMM D')}`;
      buckets.push({ label, dates });
    }
    return buckets;
  }, [range, anchor, baseDate, workingDaySet]);

  const rangeLabel = useMemo(() => {
    if (range === 'month') {
      const first = baseDate.add(anchor, 'day');
      const last = baseDate.add(anchor + 27, 'day');
      return `${first.format('MMM D')} – ${last.format('MMM D, YYYY')}`;
    }
    if (!days.length) return '';
    const first = days[0].date;
    const last = days[days.length - 1].date;
    if (range === 'day') return first.format('dddd, MMM D');
    return `${first.format('MMM D')} – ${last.format('D, YYYY')}`;
  }, [range, anchor, baseDate, days]);

  const visibleDateStrs = useMemo(
    () => (range === 'month' ? weekBuckets.flatMap(w => w.dates) : days.map(d => d.date.format('YYYY-MM-DD'))),
    [range, days, weekBuckets]
  );
  const startDate = visibleDateStrs[0];
  const endDate = visibleDateStrs[visibleDateStrs.length - 1];

  // ── Data: members & projects (real, shared with the rest of Planner) ──
  const { data: membersResp, isLoading: membersLoading } = useFetchScheduleMembersQuery();
  const wlMembers: WlMember[] = useMemo(
    () =>
      (membersResp?.body || []).map((m: any) => ({
        id: m.team_member_id || m.id,
        name: m.name || '?',
        avatarUrl: m.avatar_url,
        projectIds: (m.projects || []).map((p: any) => p.id).filter(Boolean),
      })),
    [membersResp]
  );

  // ── Project status / priority filters ──
  const [filterStatuses, setFilterStatuses] = useState<string[]>([]);
  const [filterPriorities, setFilterPriorities] = useState<string[]>([]);
  const [filterUtilLevels, setFilterUtilLevels] = useState<string[]>([]);
  const projectStatuses = useAppSelector(state => state.projectStatusesReducer.projectStatuses);
  const projectStatusesInitialized = useAppSelector(state => state.projectStatusesReducer.initialized);
  const projectPriorities = useAppSelector(state => state.projectPriorityReducer.priorities);
  const projectPrioritiesInitialized = useAppSelector(state => state.projectPriorityReducer.initialized);
  useEffect(() => {
    if (!projectStatusesInitialized) dispatch(fetchProjectStatuses());
    if (!projectPrioritiesInitialized) dispatch(fetchProjectPriorities());
  }, [dispatch, projectStatusesInitialized, projectPrioritiesInitialized]);

  // `/home/team-projects` (useGetProjectsByTeamQuery) only returns projects the current
  // user is a member of, even for admins/owners — which silently hid rows from the
  // Projects axis for anyone not on every project. The main Projects-list endpoint
  // applies the same membership restriction only to non-admin/non-owner users, so it
  // returns the full org project list (minus this user's personally-archived ones) for
  // admins/owners, which is what "every active project" in the build spec means here.
  // It also supports server-side status/priority filtering (space-separated IDs), so the
  // Status/Priority dropdowns below just narrow this fetch directly.
  const [orgProjects, setOrgProjects] = useState<any[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setProjectsLoading(true);
    projectsApiService
      .getProjects(
        1,
        999,
        null,
        null,
        null,
        null,
        filterStatuses.length ? filterStatuses.join(' ') : null,
        null,
        filterPriorities.length ? filterPriorities.join(' ') : null
      )
      .then(res => {
        if (!cancelled) setOrgProjects(res.body?.data || []);
      })
      .finally(() => {
        if (!cancelled) setProjectsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filterStatuses, filterPriorities]);
  const wlProjects: WlProject[] = useMemo(
    () =>
      orgProjects
        .filter((p: any) => p.id && p.name)
        .map((p: any) => ({
          id: p.id,
          name: p.name,
          color: p.color_code || colorForId(p.id),
          client: p.client_name || undefined,
        })),
    [orgProjects]
  );

  // When a Status/Priority filter is active, `orgProjects` is already the server-side
  // filtered set — a member row only stays visible if at least one of their assigned
  // projects is in that set (same "narrow rows by matching project" pattern the Projects
  // axis gets for free since its rows come directly from `wlProjects`).
  const statusOrPriorityActive = filterStatuses.length > 0 || filterPriorities.length > 0;
  const anyFilterActive = statusOrPriorityActive || filterUtilLevels.length > 0;
  const clearAllFilters = () => {
    setFilterStatuses([]);
    setFilterPriorities([]);
    setFilterUtilLevels([]);
  };
  const filteredProjectIds = useMemo(() => new Set(wlProjects.map(p => p.id)), [wlProjects]);
  const projectById = useMemo(() => {
    const map: Record<string, WlProject> = {};
    wlProjects.forEach(p => (map[p.id] = p));
    return map;
  }, [wlProjects]);

  // ── Data: scheduled tasks in the visible window ──
  const { data: taskTimelineResp, isLoading: tasksLoading } = useFetchTaskTimelineQuery(
    { startDate, endDate },
    { skip: !startDate || !endDate }
  );

  const wlTasks: WlTask[] = useMemo(() => {
    const raw = taskTimelineResp?.body || [];
    const out: WlTask[] = [];
    raw.forEach((task: any) => {
      const day = (task.start_date || task.end_date || '').slice(0, 10);
      if (!day) return;
      const assignees = task.assignees || [];
      assignees.forEach((a: any) => {
        out.push({
          id: `${task.id}:${a.id}`,
          taskId: task.id,
          memberId: a.id,
          projectId: task.project_id,
          day,
          title: task.name,
          estHours: task.total_minutes ? Math.round((task.total_minutes / 60) * 10) / 10 : null,
          color: task.project_color || projectById[task.project_id]?.color || token.colorPrimary,
          multiAssignee: assignees.length > 1,
          statusName: task.status_name,
          statusColor: task.status_color,
          phaseName: task.phase_name,
          assigneeNames: assignees.map((x: any) => x.name).filter(Boolean),
        });
      });
    });
    return out;
  }, [taskTimelineResp, projectById, token.colorPrimary]);

  const refreshAfterMutation = () => {
    dispatch(scheduleApi.util.invalidateTags(['TaskTimeline', 'Workload', 'MemberProjects']));
  };

  // ── Calculations (Section 6 of the build spec) ──
  const dayLoad = (axis: Axis, rowKey: string, dateStr: string) => {
    const taskH = wlTasks
      .filter(tk => (axis === 'member' ? tk.memberId : tk.projectId) === rowKey && tk.day === dateStr)
      .reduce((s, tk) => s + (tk.estHours ?? fallbackEst), 0);
    const blockH = blocks
      .filter(b => (axis === 'member' ? b.memberId : b.projectId) === rowKey && dateStr >= b.startDay && dateStr <= b.endDay)
      .reduce((s, b) => {
        const date = dayjs(dateStr);
        if (!isWorkingDay(date)) return s;
        const denom = businessDayCount(dayjs(b.startDay), dayjs(b.endDay), isWorkingDay);
        return s + b.hours / denom;
      }, 0);
    return Math.round((taskH + blockH) * 10) / 10;
  };
  const rowLoad = (axis: Axis, rowKey: string, dateStrs: string[]) =>
    Math.round(dateStrs.reduce((s, d) => s + dayLoad(axis, rowKey, d), 0) * 10) / 10;

  // ── Backend writes — reuses the same socket calls PlannerScheduleView /
  // PlannerAddTaskModal already use for task scheduling, so Workload's grid stays in
  // sync with Schedule instead of maintaining a parallel write path. ──
  const emitReschedule = (taskId: string, newDay: string) => {
    socket?.emit(
      SocketEvents.TASK_START_DATE_CHANGE.toString(),
      JSON.stringify({ task_id: taskId, start_date: newDay, parent_task: null, time_zone: timeZone })
    );
    socket?.emit(
      SocketEvents.TASK_END_DATE_CHANGE.toString(),
      JSON.stringify({ task_id: taskId, end_date: newDay, parent_task: null, time_zone: timeZone })
    );
  };

  const emitAssigneeChange = (taskId: string, projectId: string, memberId: string, mode: 0 | 1) => {
    socket?.emit(
      SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(),
      JSON.stringify({
        team_member_id: memberId,
        project_id: projectId,
        task_id: taskId,
        reporter_id: currentSession?.id,
        mode,
      })
    );
  };

  // Schedules an existing unassigned task onto a cell — same date/assignee socket calls
  // as PlannerAddTaskModal's "Assign Unassigned Task" mode uses in Schedule.
  const scheduleTask = (taskId: string, projectId: string, memberId: string, day: string, title: string) => {
    emitReschedule(taskId, day);
    emitAssigneeChange(taskId, projectId, memberId, 0);
    const who = wlMembers.find(m => m.id === memberId)?.name || 'member';
    showToast(`Scheduled "${title}" to ${who}`, () => {
      emitAssigneeChange(taskId, projectId, memberId, 1);
      setTimeout(refreshAfterMutation, 400);
    });
    setTimeout(refreshAfterMutation, 500);
  };

  const rescheduleTask = (wl: WlTask, newDay: string) => {
    emitReschedule(wl.taskId, newDay);
    showToast(`Moved "${wl.title}" to ${dayjs(newDay).format('MMM D')}`, () => {
      emitReschedule(wl.taskId, wl.day);
      setTimeout(refreshAfterMutation, 400);
    });
    setTimeout(refreshAfterMutation, 500);
  };

  const reassignTask = (wl: WlTask, newMemberId: string) => {
    emitAssigneeChange(wl.taskId, wl.projectId, wl.memberId, 1);
    emitAssigneeChange(wl.taskId, wl.projectId, newMemberId, 0);
    const who = wlMembers.find(m => m.id === newMemberId)?.name || 'member';
    showToast(`Moved "${wl.title}" to ${who}`, () => {
      emitAssigneeChange(wl.taskId, wl.projectId, newMemberId, 1);
      emitAssigneeChange(wl.taskId, wl.projectId, wl.memberId, 0);
      setTimeout(refreshAfterMutation, 400);
    });
    setTimeout(refreshAfterMutation, 500);
  };

  const removeTask = (wl: WlTask) => {
    emitAssigneeChange(wl.taskId, wl.projectId, wl.memberId, 1);
    showToast(`Removed "${wl.title}" from schedule`, () => {
      emitAssigneeChange(wl.taskId, wl.projectId, wl.memberId, 0);
      setTimeout(refreshAfterMutation, 400);
    });
    setTimeout(refreshAfterMutation, 500);
  };

  const addBlock = (block: Omit<WlBlock, 'id'>) => {
    const newId = Math.max(0, ...blocks.map(b => b.id)) + 1;
    setBlocks(list => [...list, { id: newId, ...block }]);
    showToast(`Blocked ${block.hours}h on ${projectById[block.projectId]?.name || 'project'}`, () =>
      setBlocks(list => list.filter(b => b.id !== newId))
    );
  };

  // ── Drag and drop (Section 5.3) — scheduling an unassigned task is handled entirely
  // through the "+ Add" popover now, so dragging only ever moves an already-scheduled
  // task chip (reschedule / reassign). ──
  const dragInfo = useRef<WlTask | null>(null);

  const onDropCell = (axis: Axis, rowKey: string, dateStr: string) => {
    const wl = dragInfo.current;
    dragInfo.current = null;
    if (!wl) return;

    const rowChanged = (axis === 'member' ? wl.memberId : wl.projectId) !== rowKey;
    const dayChanged = wl.day !== dateStr;
    if (!rowChanged && !dayChanged) return;

    if (axis === 'project' && rowChanged) {
      showToast("Can't move a task to a different project by drag — edit its Project field instead.");
      return;
    }

    if (dayChanged) rescheduleTask(wl, dateStr);
    if (rowChanged && axis === 'member') reassignTask(wl, rowKey);
  };

  // ── Grid rows ──
  const memberUtilPct = (memberId: string) => {
    const cap = visibleDateStrs.length * workingHours;
    return cap ? (rowLoad('member', memberId, visibleDateStrs) / cap) * 100 : 0;
  };

  const gridRows: RowDef[] = useMemo(() => {
    if (group === 'members') {
      return wlMembers
        .filter(m => !statusOrPriorityActive || m.projectIds.some(id => filteredProjectIds.has(id)))
        .filter(m => {
          if (!filterUtilLevels.length) return true;
          const pct = memberUtilPct(m.id);
          return filterUtilLevels.some(level => UTIL_LEVELS.find(l => l.value === level)?.test(pct));
        })
        .map(m => ({
          axis: 'member' as Axis,
          key: m.id,
          label: m.name,
          avatar: <CustomAvatar avatarName={m.name} avatarUrl={m.avatarUrl} size={30} />,
        }));
    }
    return wlProjects.map(p => ({
      axis: 'project' as Axis,
      key: p.id,
      label: p.name,
      sub: p.client,
      meterColor: p.color,
      avatar: (
        <span
          style={{ width: 12, height: 12, borderRadius: 3, background: p.color, display: 'inline-block', flexShrink: 0 }}
        />
      ),
    }));
  }, [
    group,
    wlMembers,
    wlProjects,
    statusOrPriorityActive,
    filteredProjectIds,
    filterUtilLevels,
    wlTasks,
    blocks,
    fallbackEst,
    visibleDateStrs,
    workingHours,
  ]);

  const loading = membersLoading || projectsLoading;

  // ── Tooltip content ──
  const renderTaskChipTooltip = (wl: WlTask) => {
    const p = projectById[wl.projectId];
    const hours = wl.estHours ?? fallbackEst;
    const overCapacity = hours > workingHours;
    return (
      <div style={{ maxWidth: 220 }}>
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
        <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6 }}>{wl.title}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12 }}>
          <div>
            <span style={{ opacity: 0.65 }}>{t('project', { defaultValue: 'Project' })}: </span>
            {p?.name || '-'}
          </div>
          <div>
            <span style={{ opacity: 0.65 }}>{t('estHoursPerDay', { defaultValue: 'Estimated Hours' })}: </span>
            <span style={{ color: overCapacity ? '#ff4d4f' : undefined, fontWeight: overCapacity ? 700 : undefined }}>
              {hours.toFixed(1)}h{wl.estHours == null ? ' *' : ''}
            </span>
          </div>
          <div>
            <span style={{ opacity: 0.65 }}>{t('status', { defaultValue: 'Status' })}: </span>
            {wl.statusName ? (
              <span
                style={{
                  display: 'inline-block',
                  padding: '0 6px',
                  borderRadius: 3,
                  background: wl.statusColor || '#888',
                  color: '#fff',
                  fontSize: 12,
                }}
              >
                {wl.statusName}
              </span>
            ) : (
              '-'
            )}
          </div>
          <div>
            <span style={{ opacity: 0.65 }}>{t('phase', { defaultValue: 'Phase' })}: </span>
            {wl.phaseName || '-'}
          </div>
          <div>
            <span style={{ opacity: 0.65 }}>{t('assignees', { defaultValue: 'Assignees' })}: </span>
            {wl.assigneeNames?.length ? wl.assigneeNames.join(', ') : '-'}
          </div>
        </div>
      </div>
    );
  };

  const renderBlockChipTooltip = (b: WlBlock) => {
    const m = wlMembers.find(mm => mm.id === b.memberId);
    const p = projectById[b.projectId];
    const denom = businessDayCount(dayjs(b.startDay), dayjs(b.endDay), isWorkingDay);
    return (
      <div style={{ maxWidth: 220 }}>
        <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6 }}>{p?.name || '-'}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12 }}>
          <div>
            <span style={{ opacity: 0.65 }}>{t('type', { defaultValue: 'Type' })}: </span>
            {t('projectBlock', { defaultValue: 'Project block' })}
          </div>
          <div>
            <span style={{ opacity: 0.65 }}>{t('assignee', { defaultValue: 'Assignee' })}: </span>
            {m?.name || '-'}
          </div>
          <div>
            <span style={{ opacity: 0.65 }}>{t('dates', { defaultValue: 'Dates' })}: </span>
            {dayjs(b.startDay).format('MMM D')} – {dayjs(b.endDay).format('MMM D')}
          </div>
          <div>
            <span style={{ opacity: 0.65 }}>{t('hours', { defaultValue: 'Hours' })}: </span>
            {b.hours}h total · {(b.hours / denom).toFixed(1)}h/day
          </div>
        </div>
      </div>
    );
  };

  // ── Cell renderers ──
  const renderTaskChip = (wl: WlTask, axis: Axis) => (
    <Tooltip
      key={wl.id}
      placement={showTaskDrawer ? 'left' : 'right'}
      autoAdjustOverflow
      color={themeMode === 'dark' ? undefined : '#fff'}
      overlayInnerStyle={
        themeMode === 'dark' ? undefined : { color: token.colorText, boxShadow: '0 2px 8px rgba(0,0,0,.15)' }
      }
      title={renderTaskChipTooltip(wl)}
    >
      <div
        draggable
        onDragStart={e => {
          e.stopPropagation();
          dragInfo.current = wl;
        }}
        onClick={e => {
          e.stopPropagation();
          dispatch(setProjectId(wl.projectId));
          dispatch(setSelectedTaskId(wl.taskId));
          dispatch(setShowTaskDrawer(true));
        }}
        onContextMenu={e => {
          e.preventDefault();
          e.stopPropagation();
          setCtxMenu({ x: e.clientX, y: e.clientY, task: wl });
        }}
        style={{
          borderRadius: 4,
          background: `${wl.color}18`,
          borderLeft: `3px solid ${wl.color}`,
          padding: '4px 7px',
          cursor: 'grab',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: wl.color }}>
            {wl.estHours ?? fallbackEst}h{wl.estHours == null ? '*' : ''}
          </span>
          {axis === 'project' && (
            <CustomAvatar avatarName={wlMembers.find(m => m.id === wl.memberId)?.name || '?'} size={14} />
          )}
        </div>
        <div style={{ fontSize: 12, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {wl.title}
        </div>
      </div>
    </Tooltip>
  );

  const renderBlockChip = (b: WlBlock, axis: Axis) => {
    const c = projectById[b.projectId]?.color || token.colorPrimary;
    const denom = businessDayCount(dayjs(b.startDay), dayjs(b.endDay), isWorkingDay);
    return (
      <Tooltip
        key={`b${b.id}`}
        placement={showTaskDrawer ? 'left' : 'right'}
        autoAdjustOverflow
        color={themeMode === 'dark' ? undefined : '#fff'}
        overlayInnerStyle={
          themeMode === 'dark' ? undefined : { color: token.colorText, boxShadow: '0 2px 8px rgba(0,0,0,.15)' }
        }
        title={renderBlockChipTooltip(b)}
      >
        <div
          onClick={e => {
            e.stopPropagation();
            setPeek({ block: b });
          }}
          style={{
            borderRadius: 4,
            borderLeft: `3px solid ${c}`,
            padding: '4px 7px',
            cursor: 'pointer',
            background: `repeating-linear-gradient(45deg, ${c}30 0 4px, ${c}10 4px 8px)`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: c }}>{(b.hours / denom).toFixed(1)}h</span>
            {axis === 'project' && (
              <CustomAvatar avatarName={wlMembers.find(m => m.id === b.memberId)?.name || '?'} size={14} />
            )}
          </div>
          <div style={{ fontSize: 12, opacity: 0.7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {axis === 'member' ? `${projectById[b.projectId]?.name || ''} · block` : 'block'}
          </div>
        </div>
      </Tooltip>
    );
  };

  const renderMeter = (axis: Axis, rowKey: string, dateStrs: string[], meterColor?: string) => {
    const load = rowLoad(axis, rowKey, dateStrs);
    if (axis === 'member') {
      const days = dateStrs.length;
      const cap = days * workingHours;
      const pct = cap ? Math.round((load / cap) * 100) : 0;
      const free = cap - load;
      const color = capColor(pct);
      return (
        <Tooltip
          placement={showTaskDrawer ? 'left' : undefined}
          title={
            <div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{t('utilTooltipTitle', { defaultValue: 'Utilization (UTIL)' })}</div>
              <div>
                {t('utilTooltipFormula', {
                  defaultValue: 'Scheduled hours ÷ capacity for the period, as a percentage.',
                })}
              </div>
              <div style={{ marginTop: 6 }}>
                {load}h {t('scheduled', { defaultValue: 'scheduled' })} ÷ {cap}h {t('capacity', { defaultValue: 'capacity' })} ({days}{' '}
                {t('days', { defaultValue: 'days' })} × {workingHours}h) = <b>{pct}%</b>
              </div>
              <div style={{ marginTop: 4, opacity: 0.85 }}>
                {free >= 0
                  ? t('utilTooltipFree', { defaultValue: '{{hours}}h still free this period.', hours: free })
                  : t('utilTooltipOver', { defaultValue: '{{hours}}h over capacity this period.', hours: -free })}
              </div>
            </div>
          }
        >
          <div style={{ textAlign: 'center', width: '100%', cursor: 'default' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color }}>{pct}%</div>
            <div style={{ fontSize: 12, opacity: 0.55 }}>
              {free >= 0
                ? t('freeHours', { defaultValue: '{{hours}}h free', hours: free })
                : t('overHours', { defaultValue: '{{hours}}h over', hours: -free })}
            </div>
          </div>
        </Tooltip>
      );
    }
    const maxLoad = Math.max(1, ...gridRows.map(r => rowLoad('project', r.key, dateStrs)));
    const pct = Math.round((load / maxLoad) * 100);
    return (
      <Tooltip
        placement={showTaskDrawer ? 'left' : undefined}
        title={
          <div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{t('loadTooltipTitle', { defaultValue: 'Load' })}</div>
            <div>
              {t('loadTooltipFormula', {
                defaultValue: 'Total hours scheduled on this project for the period.',
              })}
            </div>
            <div style={{ marginTop: 6 }}>
              {load}h {t('scheduled', { defaultValue: 'scheduled' })}
            </div>
            <div style={{ marginTop: 4, opacity: 0.85 }}>
              {t('loadTooltipBar', {
                defaultValue: 'The {{pct}}% bar is relative to the busiest project shown here, not a fixed target.',
                pct,
              })}
            </div>
          </div>
        }
      >
        <div style={{ textAlign: 'center', width: '100%', cursor: 'default' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: meterColor || token.colorPrimary }}>{load}h</div>
          <div style={{ fontSize: 12, opacity: 0.55 }}>{pct}%</div>
        </div>
      </Tooltip>
    );
  };

  const stickyLeftStyle: React.CSSProperties = {
    width: 220,
    minWidth: 220,
    flexShrink: 0,
    position: 'sticky',
    left: 0,
    zIndex: 2,
    background: cardBg,
    borderRight: `1px solid ${borderColor}`,
  };
  const stickyRightStyle: React.CSSProperties = {
    width: 90,
    minWidth: 90,
    flexShrink: 0,
    position: 'sticky',
    right: 0,
    zIndex: 2,
    background: cardBg,
    borderLeft: `1px solid ${borderColor}`,
  };

  // Members/Projects axis toggle — sits in the top toolbar row, before the Status filter.
  const groupToggle = (
    <div style={{ display: 'flex', width: 200, flexShrink: 0, border: `1px solid ${token.colorBorderSecondary}`, borderRadius: 7, overflow: 'hidden' }}>
      {(['members', 'projects'] as Group[]).map((g, idx, arr) => (
        <button
          key={g}
          onClick={() => setGroup(g)}
          style={{ ...pillBtnStyle(group === g, idx === arr.length - 1, token), flex: 1, textAlign: 'center' }}
        >
          {g === 'members' ? t('members', { defaultValue: 'Members' }) : t('projects', { defaultValue: 'Projects' })}
        </button>
      ))}
    </div>
  );

  // Shown as a centered overlay (see the position:absolute wrapper next to the loading
  // spinner below) when a filter (Project Status / Project Priority / Utilization)
  // leaves nothing to display, or there's simply nothing to show — same
  // friendly-and-positive copy and full-grid centering as PlannerScheduleView /
  // PlannerTimelineView's emptyStateBlock, so all three Planner tabs read as one
  // consistent surface.
  const emptyStateBlock = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: 32, textAlign: 'center' }}>
      <div style={{ fontSize: 14, fontWeight: 700 }}>
        {anyFilterActive
          ? t('workloadEmptyFilteredTitle', { defaultValue: "You're all caught up here" })
          : t('workloadEmptyTitle', { defaultValue: 'Nothing to show yet' })}
      </div>
      <div style={{ fontSize: 12, opacity: 0.55, maxWidth: 340 }}>
        {anyFilterActive
          ? t('workloadEmptyFilteredDesc', {
              defaultValue: 'No one matches the current filters. Try widening Project Status, Project Priority, or Utilization.',
            })
          : group === 'members'
            ? t('workloadEmptyMembersDesc', { defaultValue: 'No team members to show yet.' })
            : t('workloadEmptyProjectsDesc', { defaultValue: 'No projects to show yet.' })}
      </div>
      {anyFilterActive && (
        <Button size="small" style={{ marginTop: 6 }} onClick={clearAllFilters}>
          {t('clearFilters', { defaultValue: 'Clear filters' })}
        </Button>
      )}
    </div>
  );

  return (
    <div
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
      <style>{`
        .planner-add-hint { opacity: 0; transition: opacity .12s ease; }
        .planner-day-cell:hover .planner-add-hint { opacity: 1; }
        .planner-add-hint-inline { max-height: 0; margin-top: 0; overflow: hidden; transition: opacity .12s ease, max-height .15s ease, margin-top .15s ease; }
        .planner-day-cell:hover .planner-add-hint-inline { max-height: 20px; margin-top: 4px; }
      `}</style>
      {/* ── Toolbar box — same two-row layout, padding, and pill/button styling as
          PlannerScheduleView.tsx / PlannerTimelineView.tsx, so Planner's three
          sub-views read as one consistent chrome. Boxed to mirror the task list
          view's rounded/bordered filter bar (ImprovedTaskFiltersContainer). ── */}
      <div
        style={{
          background: cardBg,
          border: `1px solid ${borderColor}`,
          borderRadius: 8,
          flexShrink: 0,
        }}
      >
      <Flex align="center" gap={8} wrap="wrap" style={{ padding: '10px 12px' }}>
        {groupToggle}
        <PlannerMultiFilterDropdown
          label={t('allProjectStatuses', { defaultValue: 'Project Status' })}
          options={projectStatuses.map((s: any) => ({ value: s.id, label: s.name }))}
          selected={filterStatuses}
          onChange={setFilterStatuses}
        />
        <PlannerMultiFilterDropdown
          label={t('allProjectPriorities', { defaultValue: 'Project Priority' })}
          options={projectPriorities.map((p: any) => ({ value: p.id, label: p.name }))}
          selected={filterPriorities}
          onChange={setFilterPriorities}
        />
        {group === 'members' && (
          <PlannerMultiFilterDropdown
            label={t('allUtilLevels', { defaultValue: 'Utilization' })}
            options={UTIL_LEVELS.map(l => ({ value: l.value, label: l.label }))}
            selected={filterUtilLevels}
            onChange={setFilterUtilLevels}
          />
        )}

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 12, opacity: 0.5, marginLeft: 8 }}>
          <span>
            <span
              style={{
                display: 'inline-block',
                width: 9,
                height: 9,
                borderRadius: 2,
                background: token.colorPrimary,
                marginRight: 4,
              }}
            />
            {t('task', { defaultValue: 'Task' })}
          </span>
          <span>
            <span
              style={{
                display: 'inline-block',
                width: 9,
                height: 9,
                borderRadius: 2,
                marginRight: 4,
                background: `repeating-linear-gradient(45deg, ${token.colorPrimary}60 0 3px, ${token.colorPrimary}20 3px 6px)`,
              }}
            />
            {t('projectBlock', { defaultValue: 'Project block' })}
          </span>
        </div>
      </Flex>

      <Flex
        align="center"
        gap={8}
        wrap="wrap"
        style={{ padding: '8px 12px', borderTop: `1px solid ${borderColor}` }}
      >
        <span style={{ fontSize: 14, fontWeight: 600, marginRight: 8 }}>{rangeLabel}</span>
        <Button size="small" style={{ fontSize: 12, borderRadius: 7 }} onClick={() => stepAnchor(-1)} title={t('previous', { defaultValue: 'Previous' })}>
          ‹
        </Button>
        <Button size="small" style={{ fontSize: 12, borderRadius: 7 }} onClick={goToToday}>
          {t('today', { defaultValue: 'Today' })}
        </Button>
        <Button size="small" style={{ fontSize: 12, borderRadius: 7 }} onClick={() => stepAnchor(1)} title={t('next', { defaultValue: 'Next' })}>
          ›
        </Button>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', border: `1px solid ${token.colorBorderSecondary}`, borderRadius: 7, overflow: 'hidden' }}>
            {(Object.entries(RANGE_CFG) as [RangeKey, typeof RANGE_CFG[RangeKey]][]).map(([k, r], idx, arr) => (
              <button
                key={k}
                onClick={() => setRange(k)}
                style={pillBtnStyle(range === k, idx === arr.length - 1, token)}
              >
                {t(k, { defaultValue: r.label })}
              </button>
            ))}
          </div>
          <Button
            size="small"
            shape="circle"
            icon={<SettingOutlined />}
            onClick={() => dispatch(toggleSettingsDrawer())}
            title={t('workloadSettings', { defaultValue: 'Workload settings' })}
          />
        </div>
      </Flex>
      </div>

      {/* ── Body — unscheduled tasks are assigned via the "+ Add" popover on a grid cell
          rather than a separate backlog panel; see WorkloadAddPopover below. Boxed to
          match the filters box above (mirrors PlannerScheduleView's calendar box / the
          task list view's bordered table container). ── */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          overflow: 'hidden',
          border: `1px solid ${borderColor}`,
          borderRadius: 8,
          background: cardBg,
        }}
      >
        <div style={{ flex: 1, minWidth: 0, overflow: 'auto', position: 'relative' }}>
          {loading && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5, background: bg }}>
              <WorklenzLogoLoader />
            </div>
          )}

          {/* Empty state, same overlay technique as the loading spinner above — centered
              over the whole grid body, not just squeezed into a 220px-tall inline slot.
              Starts below gridHeaderHeight so the sticky day/week/month header stays
              visible, same as Schedule/Timeline's empty state. */}
          {!loading && gridRows.length === 0 && (
            <div
              style={{
                position: 'absolute',
                top: gridHeaderHeight,
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

          {range !== 'month' ? (
            <div>
              {/* Header */}
              <div ref={gridHeaderRef} style={{ display: 'flex', position: 'sticky', top: 0, zIndex: 6, background: cardBg, borderBottom: `1px solid ${borderColor}` }}>
                <div style={{ ...stickyLeftStyle, zIndex: 7, padding: '6px 8px', display: 'flex', alignItems: 'center' }} />
                {days.map(d => (
                  <div
                    key={d.offset}
                    style={{
                      flex: 1,
                      minWidth: 90,
                      textAlign: 'center',
                      padding: '6px 4px',
                      borderRight: `1px solid ${borderColor}`,
                      background: d.date.isSame(dayjs(), 'day') ? token.colorPrimaryBg : undefined,
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 600, color: d.date.isSame(dayjs(), 'day') ? token.colorPrimary : undefined }}>
                      {WEEKDAY[(d.date.day() + 6) % 7]} {d.date.date()}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.45 }}>{d.date.format('MMM')}</div>
                  </div>
                ))}
                <div style={{ ...stickyRightStyle, zIndex: 7, padding: '8px 8px', fontSize: 12, fontWeight: 600, opacity: 0.45, textAlign: 'center' }}>
                  {group === 'members' ? t('util', { defaultValue: 'UTIL' }) : t('load', { defaultValue: 'LOAD' })}
                </div>
              </div>

              {/* Rows */}
              {!loading &&
                gridRows.map(row => (
                  <div key={row.key} style={{ display: 'flex', borderBottom: `1px solid ${borderColor}` }}>
                    <div style={{ ...stickyLeftStyle, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                      {row.avatar}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row.label}
                        </div>
                        {row.sub && (
                          <div style={{ fontSize: 12, opacity: 0.45, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {row.sub}
                          </div>
                        )}
                      </div>
                    </div>
                    {days.map(d => {
                      const dateStr = d.date.format('YYYY-MM-DD');
                      const dayTasks = wlTasks.filter(
                        wl => (row.axis === 'member' ? wl.memberId : wl.projectId) === row.key && wl.day === dateStr
                      );
                      const dayBlocks = blocks.filter(
                        b => (row.axis === 'member' ? b.memberId : b.projectId) === row.key && dateStr >= b.startDay && dateStr <= b.endDay
                      );
                      const used = dayLoad(row.axis, row.key, dateStr);
                      const over = row.axis === 'member' && used > workingHours;
                      return (
                        <div
                          key={d.offset}
                          className="planner-day-cell"
                          onClick={() => setAddPopover({ axis: row.axis, rowKey: row.key, rowLabel: row.label, day: dateStr })}
                          onDragOver={e => e.preventDefault()}
                          onDrop={e => {
                            e.preventDefault();
                            e.stopPropagation();
                            onDropCell(row.axis, row.key, dateStr);
                          }}
                          style={{
                            flex: 1,
                            minWidth: 90,
                            borderRight: `1px solid ${borderColor}`,
                            padding: '6px 5px',
                            background: over ? 'rgba(255,77,79,.06)' : undefined,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 4,
                            position: 'relative',
                            cursor: 'pointer',
                          }}
                        >
                          {dayTasks.length === 0 && dayBlocks.length === 0 && (
                            <div
                              className="planner-add-hint"
                              style={{
                                position: 'absolute',
                                inset: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 12,
                                color: token.colorTextTertiary,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                pointerEvents: 'none',
                              }}
                            >
                              {`+ ${t('addNew', { defaultValue: 'Add new' })}`}
                            </div>
                          )}
                          {dayTasks.map(wl => renderTaskChip(wl, row.axis))}
                          {dayBlocks.map(b => renderBlockChip(b, row.axis))}
                          {(dayTasks.length > 0 || dayBlocks.length > 0) && (
                            <div
                              className="planner-add-hint planner-add-hint-inline"
                              style={{
                                fontSize: 12,
                                color: token.colorTextTertiary,
                                textAlign: 'center',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                flexShrink: 0,
                              }}
                            >
                              {`+ ${t('addNew', { defaultValue: 'Add new' })}`}
                            </div>
                          )}
                          {used > 0 && (
                            <div
                              style={{
                                marginTop: 'auto',
                                fontSize: 12,
                                opacity: over ? 1 : 0.35,
                                color: over ? '#ff4d4f' : undefined,
                                fontWeight: over ? 700 : 400,
                                textAlign: 'center',
                              }}
                            >
                              {row.axis === 'member' ? `${used}h / ${workingHours}h` : `${used}h`}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <div style={{ ...stickyRightStyle, padding: '10px 8px', display: 'flex', alignItems: 'center' }}>
                      {renderMeter(row.axis, row.key, visibleDateStrs, row.meterColor)}
                    </div>
                  </div>
                ))}

              {group === 'members' && !loading && gridRows.length > 0 && (
                <div style={{ display: 'flex', position: 'sticky', bottom: 0, zIndex: 6, background: totalRowBg, borderTop: `2px solid ${borderColor}` }}>
                  <div
                    style={{
                      ...stickyLeftStyle,
                      zIndex: 7,
                      background: totalRowBg,
                      padding: '16px 16px',
                      fontSize: 12,
                      fontWeight: 700,
                      opacity: 0.75,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {t('teamTotal', { defaultValue: 'Team Total' })}
                  </div>
                  {days.map(d => {
                    const dateStr = d.date.format('YYYY-MM-DD');
                    const totalDay = Math.round(wlMembers.reduce((s, m) => s + dayLoad('member', m.id, dateStr), 0) * 10) / 10;
                    return (
                      <div key={d.offset} style={{ flex: 1, minWidth: 90, borderRight: `1px solid ${borderColor}`, padding: '16px 5px', textAlign: 'center' }}>
                        <span style={{ fontSize: 12, fontWeight: 700 }}>{totalDay}h</span>
                      </div>
                    );
                  })}
                  <div style={{ ...stickyRightStyle, background: totalRowBg, padding: '10px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {(() => {
                      const totalLoad = wlMembers.reduce((s, m) => s + rowLoad('member', m.id, visibleDateStrs), 0);
                      const totalCap = wlMembers.length * visibleDateStrs.length * workingHours;
                      const pct = totalCap ? Math.round((totalLoad / totalCap) * 100) : 0;
                      const color = capColor(pct);
                      return (
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color }}>{pct}%</div>
                          <div style={{ fontSize: 12, opacity: 0.6 }}>{Math.round(totalLoad * 10) / 10}h</div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
              <div ref={gridHeaderRef} style={{ display: 'flex', position: 'sticky', top: 0, zIndex: 6, background: cardBg, borderBottom: `1px solid ${borderColor}` }}>
                <div style={{ ...stickyLeftStyle, zIndex: 7, padding: '6px 8px', display: 'flex', alignItems: 'center' }} />
                {weekBuckets.map((w, i) => (
                  <div key={i} style={{ flex: 1, minWidth: 110, textAlign: 'center', padding: '8px 4px', borderRight: `1px solid ${borderColor}`, fontSize: 11, fontWeight: 600, opacity: 0.6 }}>
                    {w.label}
                  </div>
                ))}
              </div>
              {!loading &&
                gridRows.map(row => (
                  <div key={row.key} style={{ display: 'flex', borderBottom: `1px solid ${borderColor}` }}>
                    <div style={{ ...stickyLeftStyle, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                      {row.avatar}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row.label}
                        </div>
                        {row.sub && <div style={{ fontSize: 12, opacity: 0.45 }}>{row.sub}</div>}
                      </div>
                    </div>
                    {weekBuckets.map((w, i) => (
                      <div key={i} style={{ flex: 1, minWidth: 110, borderRight: `1px solid ${borderColor}`, padding: '12px 14px' }}>
                        {renderMeter(row.axis, row.key, w.dates, row.meterColor)}
                      </div>
                    ))}
                  </div>
                ))}
              {!loading && gridRows.length > 0 && (
                <div style={{ padding: '14px 16px', fontSize: 11, opacity: 0.4 }}>
                  {t('monthRollupHint', {
                    defaultValue: 'Month view is a rollup for spotting trouble weeks — switch to Day or Week to reassign or add work.',
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Add popover ── */}
      {addPopover && (
        <WorkloadAddPopover
          ctx={addPopover}
          members={wlMembers}
          projects={wlProjects}
          fallbackEst={fallbackEst}
          onClose={() => setAddPopover(null)}
          onScheduleTask={(taskId, projectId, memberId, day, title) => {
            scheduleTask(taskId, projectId, memberId, day, title);
          }}
          onAddBlock={block => addBlock(block)}
        />
      )}

      {/* ── Peek drawer ── */}
      {peek && (
        <Drawer
          open
          onClose={() => setPeek(null)}
          title={peek.task ? peek.task.title : `${projectById[peek.block!.projectId]?.name || ''} — block`}
          width={380}
        >
          <PeekBody
            peek={peek}
            members={wlMembers}
            projects={wlProjects}
            fallbackEst={fallbackEst}
            onSaveAssignee={memberId => {
              if (peek.task) reassignTask(peek.task, memberId);
              else if (peek.block) setBlocks(list => list.map(b => (b.id === peek.block!.id ? { ...b, memberId } : b)));
              setPeek(null);
            }}
            onSaveDate={dateStr => {
              if (peek.task) rescheduleTask(peek.task, dateStr);
              setPeek(null);
            }}
            onRemove={() => {
              if (peek.task) removeTask(peek.task);
              else if (peek.block) {
                setBlocks(list => list.filter(b => b.id !== peek.block!.id));
                showToast(`Removed block on ${projectById[peek.block.projectId]?.name || ''}`);
              }
              setPeek(null);
            }}
          />
        </Drawer>
      )}

      {/* ── Right-click context menu ── */}
      {ctxMenu && (
        <>
          <div onClick={() => setCtxMenu(null)} style={{ position: 'fixed', inset: 0, zIndex: 497 }} />
          <div
            style={{
              position: 'fixed',
              top: ctxMenu.y,
              left: ctxMenu.x,
              background: cardBg,
              border: `1px solid ${borderColor}`,
              borderRadius: 8,
              boxShadow: '0 8px 24px rgba(0,0,0,.12)',
              padding: 4,
              zIndex: 498,
              minWidth: 180,
            }}
          >
            {[
              { label: t('reassign', { defaultValue: 'Reassign…' }), fn: () => setPeek({ task: ctxMenu.task, focus: 'assign' }) },
              { label: t('reschedule', { defaultValue: 'Reschedule…' }), fn: () => setPeek({ task: ctxMenu.task, focus: 'date' }) },
              { label: t('removeFromView', { defaultValue: 'Remove from view' }), fn: () => removeTask(ctxMenu.task), danger: true },
            ].map(o => (
              <button
                key={o.label}
                onClick={() => {
                  o.fn();
                  setCtxMenu(null);
                }}
                style={{
                  display: 'flex',
                  width: '100%',
                  padding: '8px 10px',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: 13,
                  borderRadius: 5,
                  textAlign: 'left',
                  color: o.danger ? '#ff4d4f' : token.colorText,
                }}
              >
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 600,
            background: token.colorText,
            color: bg,
            borderRadius: 8,
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            fontSize: 13,
            boxShadow: '0 8px 24px rgba(0,0,0,.25)',
          }}
        >
          <span>{toast.message}</span>
          {toast.undo && (
            <button
              onClick={() => {
                toast.undo?.();
                setToast(null);
              }}
              style={{ background: 'transparent', border: 'none', color: '#69b1ff', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
            >
              {t('undo', { defaultValue: 'Undo' })}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ── "+ Add" modal — same three actions as Schedule's PlannerAddTaskModal ("New Task" /
// "Assign Unassigned Task") plus a third Workload-only action, "Book project time" (a
// flat block of hours, Section 5.8). The unassigned-task list is fetched lazily, one
// project at a time (same tasksApiService.getTaskListV3 call + "no assignees/names"
// filter PlannerAddTaskModal's "Assign Unassigned Task" mode uses in Schedule), instead
// of pre-loading every project's unassigned tasks up front. ──
const WorkloadAddPopover: React.FC<{
  ctx: AddPopoverCtx;
  members: WlMember[];
  projects: WlProject[];
  fallbackEst: number;
  onClose: () => void;
  onScheduleTask: (taskId: string, projectId: string, memberId: string, day: string, title: string) => void;
  onAddBlock: (block: Omit<WlBlock, 'id'>) => void;
}> = ({ ctx, members, projects, fallbackEst, onClose, onScheduleTask, onAddBlock }) => {
  const { t } = useTranslation('schedule');
  const { token } = theme.useToken();
  const { socket } = useSocket();
  const currentSession = useAuthService().getCurrentSession();
  const [mode, setMode] = useState<'new' | 'unassigned' | 'block'>('new');
  const [taskProjectId, setTaskProjectId] = useState<string>(ctx.axis === 'project' ? ctx.rowKey : '');
  const [taskDate, setTaskDate] = useState<Dayjs>(dayjs(ctx.day));
  const [unschedTasks, setUnschedTasks] = useState<ITask[]>([]);
  const [unschedLoading, setUnschedLoading] = useState(false);
  const [selUnsched, setSelUnsched] = useState<string>('');
  const [taskSearch, setTaskSearch] = useState('');
  const [otherAxisVal, setOtherAxisVal] = useState<string>(ctx.axis === 'member' ? projects[0]?.id || '' : members[0]?.id || '');
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskEst, setNewTaskEst] = useState(fallbackEst);
  const [newTaskSubmitting, setNewTaskSubmitting] = useState(false);
  const [blockHours, setBlockHours] = useState(8);
  const [blockRange, setBlockRange] = useState<[Dayjs, Dayjs]>([dayjs(ctx.day), dayjs(ctx.day)]);

  useEffect(() => {
    if (mode !== 'unassigned' || !taskProjectId) {
      setUnschedTasks([]);
      return;
    }
    let cancelled = false;
    setSelUnsched('');
    setTaskSearch('');
    setUnschedLoading(true);
    tasksApiService
      .getTaskListV3({
        id: taskProjectId,
        field: null,
        order: null,
        search: null,
        statuses: null,
        members: null,
        projects: null,
        isSubtasksInclude: false,
      } as any)
      .then(res => {
        if (cancelled) return;
        const all: ITask[] = res.body?.allTasks || [];
        setUnschedTasks(all.filter(task => !task.assignees?.length && !(task as any).names?.length));
      })
      .finally(() => {
        if (!cancelled) setUnschedLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, taskProjectId]);

  const visibleUnschedTasks = useMemo(() => {
    const search = taskSearch.trim().toLowerCase();
    if (!search) return unschedTasks;
    return unschedTasks.filter(
      task => task.name?.toLowerCase().includes(search) || task.task_key?.toLowerCase().includes(search)
    );
  }, [unschedTasks, taskSearch]);

  // Same QUICK_TASK creation flow as PlannerAddTaskModal's "New Task" mode, then hands
  // off to the same scheduleTask (reschedule + assign) call the "Assign Unassigned Task"
  // path below uses, so both modes end up placing the task on the grid identically.
  const submitNewTask = () => {
    if (!newTaskName.trim() || !taskProjectId) return;
    setNewTaskSubmitting(true);
    const dateStr = taskDate.format('YYYY-MM-DD');
    const newTask = {
      name: newTaskName.trim(),
      project_id: taskProjectId,
      reporter_id: currentSession?.id,
      team_id: currentSession?.team_id,
      end_date: dateStr,
    };
    socket?.emit(SocketEvents.QUICK_TASK.toString(), JSON.stringify(newTask));
    socket?.once(SocketEvents.QUICK_TASK.toString(), (task: any) => {
      setNewTaskSubmitting(false);
      if (!task || task.error) {
        message.error(
          task?.message ||
            t('taskCreationRestricted', {
              defaultValue: 'Task creation is restricted to Admins and Team Leads only. Please contact your admin for access.',
            })
        );
        return;
      }
      socket?.emit(
        SocketEvents.TASK_TIME_ESTIMATION_CHANGE.toString(),
        JSON.stringify({
          task_id: task.id,
          total_hours: Math.floor(newTaskEst || 0),
          total_minutes: Math.round(((newTaskEst || 0) % 1) * 60),
          parent_task: null,
        })
      );
      const memberId = ctx.axis === 'member' ? ctx.rowKey : otherAxisVal;
      onScheduleTask(task.id, taskProjectId, memberId, dateStr, task.name);
      onClose();
    });
  };

  return (
    <Modal
      open
      onCancel={onClose}
      title={`${t('addFor', { defaultValue: 'Add for' })} ${ctx.rowLabel}`}
      footer={null}
      destroyOnClose
    >
      {/* Same tab-pill toggle (bordered container, filled active pill) as
          PlannerAddTaskModal's mode switch in Schedule, plus a third,
          Workload-only "Book project time" action. */}
      <div
        style={{
          display: 'flex',
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: 7,
          overflow: 'hidden',
          marginBottom: 16,
        }}
      >
        {(
          [
            { label: t('newTask', { defaultValue: 'New Task' }), value: 'new' as const },
            { label: t('assignUnassignedTask', { defaultValue: 'From Unassigned' }), value: 'unassigned' as const },
            { label: t('bookProjectTime', { defaultValue: 'Book project time' }), value: 'block' as const },
          ]
        ).map((opt, idx, arr) => {
          const active = mode === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setMode(opt.value)}
              style={{
                flex: 1,
                padding: '6px 10px',
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 500,
                borderRight: idx === arr.length - 1 ? 'none' : `1px solid ${token.colorBorderSecondary}`,
                background: active ? token.colorPrimary : 'transparent',
                color: active ? (token.colorWhite ?? '#fff') : token.colorText,
                transition: 'all .15s',
                whiteSpace: 'nowrap',
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {mode === 'new' && (
        <>
          {ctx.axis === 'member' && (
            <Form.Item label={t('project', { defaultValue: 'Project' })}>
              <Select
                value={taskProjectId || undefined}
                onChange={setTaskProjectId}
                showSearch
                optionFilterProp="label"
                placeholder={t('selectProject', { defaultValue: 'Select project…' })}
                style={{ width: '100%' }}
                options={projects.map(p => ({ value: p.id, label: p.name }))}
              />
            </Form.Item>
          )}
          <Form.Item label={t('taskName', { defaultValue: 'Task Name' })}>
            <Input
              autoFocus
              value={newTaskName}
              onChange={e => setNewTaskName(e.target.value)}
              placeholder={t('addTask', { defaultValue: 'Enter task name…' })}
              onKeyDown={e => {
                if (e.key === 'Enter') submitNewTask();
              }}
            />
          </Form.Item>
          <Form.Item label={t('date', { defaultValue: 'Date' })}>
            <DatePicker
              value={taskDate}
              onChange={v => setTaskDate(v || dayjs(ctx.day))}
              style={{ width: '100%' }}
              format="MMM DD, YYYY"
            />
          </Form.Item>
          <Form.Item label={t('estHoursPerDay', { defaultValue: 'Estimated Hours' })}>
            <InputNumber min={0.5} step={0.5} value={newTaskEst} onChange={v => setNewTaskEst(v || 0.5)} style={{ width: '100%' }} />
          </Form.Item>
          {ctx.axis === 'project' && (
            <Form.Item label={t('assignTo', { defaultValue: 'Assign to' })}>
              <Select
                value={otherAxisVal}
                onChange={setOtherAxisVal}
                style={{ width: '100%' }}
                options={members.map(m => ({ value: m.id, label: m.name }))}
              />
            </Form.Item>
          )}
        </>
      )}

      {mode === 'unassigned' && (
        <>
          {ctx.axis === 'member' && (
            <Form.Item label={t('project', { defaultValue: 'Project' })}>
              <Select
                value={taskProjectId || undefined}
                onChange={setTaskProjectId}
                showSearch
                optionFilterProp="label"
                placeholder={t('selectProject', { defaultValue: 'Select project…' })}
                style={{ width: '100%' }}
                options={projects.map(p => ({ value: p.id, label: p.name }))}
              />
            </Form.Item>
          )}
          <Form.Item label={t('unscheduledTask', { defaultValue: 'Unscheduled task' })} required>
            {!taskProjectId ? (
              <div style={{ fontSize: 12, opacity: 0.5, padding: '8px 0' }}>
                {t('pickProjectFirst', { defaultValue: 'Pick a project to see its unscheduled tasks.' })}
              </div>
            ) : (
              <>
                <Input
                  allowClear
                  prefix={<SearchOutlined style={{ opacity: 0.45 }} />}
                  placeholder={t('searchUnassignedTasks', { defaultValue: 'Search by task name or key…' })}
                  value={taskSearch}
                  onChange={e => setTaskSearch(e.target.value)}
                  style={{ marginBottom: 8 }}
                />
                <div
                  style={{
                    maxHeight: 180,
                    overflowY: 'auto',
                    border: `1px solid ${token.colorBorderSecondary}`,
                    borderRadius: 6,
                  }}
                >
                  {unschedLoading ? (
                    <div style={{ textAlign: 'center', padding: 16 }}>
                      <Spin size="small" />
                    </div>
                  ) : visibleUnschedTasks.length === 0 ? (
                    <Empty
                      description={t('noUnscheduled', { defaultValue: 'No unscheduled tasks for this project — all caught up.' })}
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      style={{ padding: 12 }}
                    />
                  ) : (
                    visibleUnschedTasks.map(u => {
                      const hours = (u.total_hours || 0) + (u.total_minutes || 0) / 60;
                      const active = selUnsched === u.id;
                      return (
                        <div
                          key={u.id}
                          onClick={() => setSelUnsched(u.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8,
                            padding: '7px 10px',
                            fontSize: 12,
                            cursor: 'pointer',
                            fontWeight: active ? 700 : 400,
                            background: active ? token.colorPrimaryBg : 'transparent',
                            borderLeft: active ? `3px solid ${token.colorPrimary}` : '3px solid transparent',
                          }}
                        >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
                            {u.task_key && <span style={{ opacity: 0.5, flexShrink: 0 }}>{u.task_key}</span>}
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</span>
                          </span>
                          <span style={{ opacity: 0.5, flexShrink: 0, fontSize: 11 }}>
                            {hours > 0 ? `${Math.round(hours * 10) / 10}h` : `${fallbackEst}h default`}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </Form.Item>
          <Form.Item label={t('date', { defaultValue: 'Date' })}>
            <DatePicker
              value={taskDate}
              onChange={v => setTaskDate(v || dayjs(ctx.day))}
              style={{ width: '100%' }}
              format="MMM DD, YYYY"
            />
          </Form.Item>
          {ctx.axis === 'project' && (
            <Form.Item label={t('assignTo', { defaultValue: 'Assign to' })}>
              <Select
                value={otherAxisVal}
                onChange={setOtherAxisVal}
                style={{ width: '100%' }}
                options={members.map(m => ({ value: m.id, label: m.name }))}
              />
            </Form.Item>
          )}
        </>
      )}

      {mode === 'block' && (
        <>
          {ctx.axis === 'member' ? (
            <Form.Item label={t('project', { defaultValue: 'Project' })}>
              <Select
                value={otherAxisVal}
                onChange={setOtherAxisVal}
                style={{ width: '100%' }}
                options={projects.map(p => ({ value: p.id, label: p.name }))}
              />
            </Form.Item>
          ) : (
            <Form.Item label={t('assignTo', { defaultValue: 'Assign to' })}>
              <Select
                value={otherAxisVal}
                onChange={setOtherAxisVal}
                style={{ width: '100%' }}
                options={members.map(m => ({ value: m.id, label: m.name }))}
              />
            </Form.Item>
          )}
          <Form.Item label={t('dateRange', { defaultValue: 'Start – end date' })}>
            <DatePicker.RangePicker
              value={blockRange}
              onChange={v => v && setBlockRange([v[0] || dayjs(ctx.day), v[1] || dayjs(ctx.day)])}
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item label={t('totalHours', { defaultValue: 'Total hours (spread evenly across the range)' })}>
            <InputNumber min={1} value={blockHours} onChange={v => setBlockHours(v || 1)} style={{ width: '100%' }} />
          </Form.Item>
          <div style={{ fontSize: 11, opacity: 0.55, lineHeight: 1.5 }}>
            {t('needRichAllocation', { defaultValue: 'Need percentage-based or multi-month staffing instead? See Resources.' })}
          </div>
        </>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
        <Button onClick={onClose}>{t('cancel', { defaultValue: 'Cancel' })}</Button>
        <Button
          type="primary"
          loading={mode === 'new' && newTaskSubmitting}
          disabled={
            (mode === 'unassigned' && !selUnsched) ||
            (mode === 'new' && (!newTaskName.trim() || !taskProjectId))
          }
          onClick={() => {
            if (mode === 'new') {
              submitNewTask();
              return;
            }
            if (mode === 'unassigned') {
              const item = unschedTasks.find(u => u.id === selUnsched);
              if (item) {
                const memberId = ctx.axis === 'member' ? ctx.rowKey : otherAxisVal;
                onScheduleTask(item.id, taskProjectId, memberId, taskDate.format('YYYY-MM-DD'), item.name);
              }
            } else {
              const memberId = ctx.axis === 'member' ? ctx.rowKey : otherAxisVal;
              const projectId = ctx.axis === 'project' ? ctx.rowKey : otherAxisVal;
              onAddBlock({
                memberId,
                projectId,
                hours: blockHours,
                startDay: blockRange[0].format('YYYY-MM-DD'),
                endDay: blockRange[1].format('YYYY-MM-DD'),
              });
            }
            onClose();
          }}
        >
          {mode === 'new'
            ? t('createTask', { defaultValue: 'Create Task' })
            : mode === 'unassigned'
              ? t('schedule', { defaultValue: 'Schedule' })
              : t('addBlock', { defaultValue: 'Add block' })}
        </Button>
      </div>
    </Modal>
  );
};

// ── Peek drawer body — Section 5.4: tasks can edit Assignee + Date (Project is read-only
// here; moving a task between projects isn't a single-socket-call operation, so it stays
// out of this quick-edit surface — open the task's board to move it). Blocks can only
// edit Assignee. ──
const PeekBody: React.FC<{
  peek: PeekItem;
  members: WlMember[];
  projects: WlProject[];
  fallbackEst: number;
  onSaveAssignee: (memberId: string) => void;
  onSaveDate: (dateStr: string) => void;
  onRemove: () => void;
}> = ({ peek, members, projects, fallbackEst, onSaveAssignee, onSaveDate, onRemove }) => {
  const { t } = useTranslation('schedule');
  const { task, block, focus } = peek;
  const [memberId, setMemberId] = useState(task ? task.memberId : block!.memberId);
  const [dateVal, setDateVal] = useState<Dayjs>(dayjs(task ? task.day : block!.startDay));
  const project = projects.find(p => p.id === (task ? task.projectId : block!.projectId));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1 }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4 }}>{task ? t('estimate', { defaultValue: 'Estimate' }) : t('totalHours', { defaultValue: 'Total hours' })}</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>
            {task
              ? `${task.estHours ?? fallbackEst}h${task.estHours == null ? ' (default)' : ''}`
              : `${block!.hours}h, spread evenly`}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4 }}>{t('assignee', { defaultValue: 'Assignee' })}</div>
          <Select
            autoFocus={focus === 'assign'}
            value={memberId}
            onChange={setMemberId}
            style={{ width: '100%' }}
            options={members.map(m => ({ value: m.id, label: m.name }))}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4 }}>{t('project', { defaultValue: 'Project' })}</div>
          <div style={{ fontSize: 13, fontWeight: 500 }}>{project?.name || '—'}</div>
        </div>

        {task && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4 }}>{t('date', { defaultValue: 'Date' })}</div>
            <DatePicker
              autoFocus={focus === 'date'}
              value={dateVal}
              onChange={v => v && setDateVal(v)}
              style={{ width: '100%' }}
            />
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, paddingTop: 12, borderTop: '1px solid rgba(0,0,0,.06)' }}>
        <Button
          type="primary"
          style={{ flex: 1 }}
          onClick={() => {
            if (memberId !== (task ? task.memberId : block!.memberId)) onSaveAssignee(memberId);
            if (task && dateVal.format('YYYY-MM-DD') !== task.day) onSaveDate(dateVal.format('YYYY-MM-DD'));
          }}
        >
          {t('saveChanges', { defaultValue: 'Save Changes' })}
        </Button>
        <Button onClick={onRemove}>{t('remove', { defaultValue: 'Remove' })}</Button>
      </div>
    </div>
  );
};

export default PlannerWorkloadView;
