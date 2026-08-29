import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import Skeleton from 'antd/es/skeleton';
import Tooltip from 'antd/es/tooltip';
import { useTranslation } from 'react-i18next';
import {
  theme,
  Button,
  Input,
  PlusOutlined,
  ExpandAltOutlined,
  SearchOutlined,
  Table,
  TableProps,
  Dropdown,
  CaretDownFilled,
} from '@/shared/antd-imports';
import HomeAddTaskModal from './task-list/HomeAddTaskModal';
import PlannerMultiFilterDropdown from '@/features/schedule/PlannerMultiFilterDropdown';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  useGetMyTasksQuery,
  useGetUnassignedTasksQuery,
  useGetTaskFilterOptionsQuery,
} from '@/api/home-page/home-page.api.service';
import { IMyTask } from '@/types/home/my-tasks.types';
import { IHomeTasksConfig } from '@/types/home/home-page.types';
import HomeTasksStatusDropdown from '@/components/home-tasks/statusDropdown/HomeTasksStatusDropdown';
import HomeTasksDatePicker from '@/components/home-tasks/taskDatePicker/home-tasks-date-picker';
import SortArrows from '@/components/SortArrows';
import AvatarGroup from '@/components/AvatarGroup';
import AssigneeSelector from '@/components/AssigneeSelector';
import {
  setSelectedTaskId,
  setShowTaskDrawer,
  fetchTask,
  setNavigationContext,
} from '@/features/task-drawer/task-drawer.slice';
import { setProjectId } from '@/features/project/project.slice';
import { fetchLabels } from '@/features/taskAttributes/taskLabelSlice';
import { fetchPriorities } from '@/features/taskAttributes/taskPrioritySlice';
import { getTeamMembers } from '@/features/team-members/team-members.slice';
import { useResponsive } from '@/hooks/useResponsive';
import './HomeMyTasksView.css';

type SideFilter = 'everything' | 'assigned-me' | 'assigned-by-me' | 'overdue' | 'unassigned' | 'no-due';
type SortField = 'name' | 'project_name' | 'end_date' | 'priority' | 'status' | null;

// Labels are resolved via t() inside the component (translations aren't
// available at module scope) — see `sideLabels` below.
const SIDE_ITEMS: { key: SideFilter; svg: string }[] = [
  {
    key: 'everything',
    svg: 'M3 6h18M3 12h18M3 18h18',
  },
  {
    key: 'assigned-me',
    svg: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z',
  },
  {
    key: 'assigned-by-me',
    svg: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  },
  {
    key: 'overdue',
    svg: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  {
    key: 'unassigned',
    svg: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z',
  },
  {
    key: 'no-due',
    svg: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  },
];

const BASE_QUERY_CONFIG: IHomeTasksConfig = {
  tasks_group_by: 0,
  current_tab: 'All',
  current_view: 0,
  is_calendar_view: false,
  selected_date: null,
  time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
};

// `get_task_assignees` (backend) returns avatar_url/color_code per assignee,
// but the shared ITaskAssignee type only declares the fields every other
// caller of that type relies on — widen locally rather than touching the
// shared type just for this column.
type AssigneeWithAvatar = IMyTask['assignees'] extends (infer M)[] | undefined
  ? M & { avatar_url?: string; color_code?: string }
  : never;

function getAssigneeMembers(task: IMyTask): AssigneeWithAvatar[] {
  if (task.assignees?.length) return task.assignees as AssigneeWithAvatar[];
  if (task.names?.length) return task.names as unknown as AssigneeWithAvatar[];
  return [];
}

const HomeMyTasksView: React.FC = () => {
  const dispatch = useAppDispatch();
  const { token } = theme.useToken();
  const { t } = useTranslation('home');
  const { priorities } = useAppSelector(state => state.priorityReducer);
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const { isDesktop } = useResponsive();

  const sideLabels = useMemo<Record<SideFilter, string>>(() => ({
    everything: t('tasks.all', { defaultValue: 'All' }),
    'assigned-me': t('tasks.assignedToMe', { defaultValue: 'Assigned to me' }),
    'assigned-by-me': t('tasks.assignedByMe', { defaultValue: 'Assigned by me' }),
    overdue: t('tasks.overdue', { defaultValue: 'Overdue' }),
    unassigned: t('myTasksView.sideUnassigned', { defaultValue: 'Unassigned' }),
    'no-due': t('tasks.noDueDate', { defaultValue: 'No due date' }),
  }), [t]);

  const [sideFilter, setSideFilter] = useState<SideFilter>('everything');
  const [search,     setSearch]     = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [selectedPriorityIds, setSelectedPriorityIds] = useState<string[]>([]);
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>([]);
  const [selectedStatusIds, setSelectedStatusIds] = useState<string[]>([]);
  const [page,     setPage]     = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [addTaskOpen, setAddTaskOpen] = useState(false);

  const isUnassigned = sideFilter === 'unassigned';

  // Reset to page 1 whenever the active view/filters/search/sort change.
  // Adjusted during render (React's documented pattern for this) rather than
  // in a useEffect: an effect would let queryConfig below fire one request
  // with the stale page and a second, corrected one right after. Comparing
  // against a ref and calling setPage synchronously here means page is
  // already 1 by the time queryConfig is computed in this same render.
  const filtersSignature = JSON.stringify([
    sideFilter, debouncedSearch, sortField, sortOrder,
    selectedProjectIds, selectedPriorityIds, selectedAssigneeIds, selectedStatusIds,
  ]);
  const prevFiltersSignatureRef = useRef(filtersSignature);
  if (prevFiltersSignatureRef.current !== filtersSignature) {
    prevFiltersSignatureRef.current = filtersSignature;
    if (page !== 1) setPage(1);
  }

  // Debounce free-text search before it goes into the query arg, so every
  // keystroke doesn't trigger its own request.
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(handle);
  }, [search]);

  // group_by: 0 = assigned to me, 1 = assigned by me, 2 = both (union) — see
  // getTasksByGroupClosure in home-page-controller.ts. "Unassigned" doesn't
  // fit this at all (by definition it has no assignee) so it's served by a
  // dedicated endpoint/query below instead of this one. "Overdue"/"No due
  // date" are subsets of "assigned to me" (group 0), narrowed further via
  // overdueOnly/noDueOnly.
  const groupBy = sideFilter === 'assigned-by-me' ? 1 : sideFilter === 'everything' ? 2 : 0;

  const queryConfig = useMemo<IHomeTasksConfig>(() => ({
    ...BASE_QUERY_CONFIG,
    tasks_group_by: groupBy,
    current_tab: 'All',
    index: page,
    size: pageSize,
    status: selectedStatusIds.length ? selectedStatusIds : undefined,
    priorityIds: selectedPriorityIds.length ? selectedPriorityIds : undefined,
    projectIds: selectedProjectIds.length ? selectedProjectIds : undefined,
    assigneeIds: selectedAssigneeIds.length ? selectedAssigneeIds : undefined,
    search: debouncedSearch || undefined,
    sortField: sortField || undefined,
    sortOrder,
    overdueOnly: sideFilter === 'overdue' || undefined,
    noDueOnly: sideFilter === 'no-due' || undefined,
  }), [
    groupBy, sideFilter, page, pageSize, selectedStatusIds, selectedPriorityIds,
    selectedProjectIds, selectedAssigneeIds, debouncedSearch, sortField, sortOrder,
  ]);

  const { data, isLoading, refetch } = useGetMyTasksQuery(queryConfig, {
    skip: isUnassigned,
    refetchOnMountOrArgChange: true,
    refetchOnReconnect: false,
    refetchOnFocus: false,
  });

  // "Unassigned" tasks aren't scoped by group_by/assignee at all (see backend
  // getUnassignedTasksResult), so it has no assigneeIds/overdueOnly/noDueOnly.
  const unassignedQueryConfig = useMemo(() => ({
    index: page,
    size: pageSize,
    status: selectedStatusIds.length ? selectedStatusIds : undefined,
    priorityIds: selectedPriorityIds.length ? selectedPriorityIds : undefined,
    projectIds: selectedProjectIds.length ? selectedProjectIds : undefined,
    search: debouncedSearch || undefined,
    sortField: sortField || undefined,
    sortOrder,
  }), [page, pageSize, selectedStatusIds, selectedPriorityIds, selectedProjectIds, debouncedSearch, sortField, sortOrder]);

  const {
    data: unassignedData,
    isLoading: isUnassignedLoading,
    refetch: refetchUnassigned,
  } = useGetUnassignedTasksQuery(unassignedQueryConfig, {
    skip: !isUnassigned,
    refetchOnMountOrArgChange: true,
    refetchOnReconnect: false,
    refetchOnFocus: false,
  });

  // Filter dropdown option lists — scoped to the My Tasks group_by (not the
  // team-wide lookups), and independent of the currently-selected filters
  // themselves so picking one doesn't shrink the others' choices.
  const { data: filterOptionsData } = useGetTaskFilterOptionsQuery({ group_by: groupBy });

  useEffect(() => {
    dispatch(fetchLabels());
    dispatch(fetchPriorities());
    dispatch(getTeamMembers({ index: 0, size: 100, field: null, order: null, search: null, all: true }));
  }, [dispatch]);

  const isTasksLoading = isUnassigned ? isUnassignedLoading : isLoading;
  const refetchTasks = useCallback(
    () => (isUnassigned ? refetchUnassigned() : refetch()),
    [isUnassigned, refetch, refetchUnassigned]
  );

  // Server-filtered and server-paginated already — this is exactly the page
  // of rows to render, no client-side slicing needed.
  const tasks: IMyTask[] = useMemo(
    () => (isUnassigned ? unassignedData?.body?.tasks : data?.body?.tasks) || [],
    [isUnassigned, data?.body?.tasks, unassignedData?.body?.tasks]
  );

  // Unassigned tasks now get the same SQL-side {total, today, overdue,
  // in_progress, ...} bucket shape as the main query (getUnassignedTasksCounts
  // on the backend), so stat cards can read from whichever body is active
  // without needing to special-case or approximate from a single page.
  const activeBody = isUnassigned ? unassignedData?.body : data?.body;
  const totalCount = activeBody?.total ?? 0;

  const projectFilterOptions = useMemo(
    () => (filterOptionsData?.body?.projects || []).map(p => ({ value: p.project_id, label: p.project_name })),
    [filterOptionsData?.body?.projects]
  );

  const priorityFilterOptions = useMemo(
    () => priorities.map(p => ({ value: p.id || '', label: p.name || '' })),
    [priorities]
  );

  // Task status is project-scoped (each project has its own status_id set),
  // so "My Tasks" spanning many projects has multiple distinct status_ids
  // that share the same display name (e.g. every project's own "To Do").
  // The backend already dedupes by lowercased name; mirror that as the
  // filter value so it round-trips through the `status[]` query param.
  const statusFilterOptions = useMemo(
    () => (filterOptionsData?.body?.statuses || []).map(s => ({ value: s.name.toLowerCase(), label: s.name })),
    [filterOptionsData?.body?.statuses]
  );

  const assigneeFilterOptions = useMemo(
    () => (filterOptionsData?.body?.assignees || []).map(a => ({ value: a.team_member_id, label: a.name })),
    [filterOptionsData?.body?.assignees]
  );

  // Stat cards — straight from the backend's SQL-side counts, scoped to the
  // full filtered set (not just the current page), for every side-view
  // including Unassigned.
  const statTotal      = totalCount;
  const statOverdue    = activeBody?.overdue ?? 0;
  const statDueToday   = activeBody?.today ?? 0;
  const statInProgress = activeBody?.in_progress ?? 0;

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage    = Math.min(page, totalPages);

  const showAssignee = sideFilter !== 'assigned-me';
  const sideLabel = sideLabels[sideFilter] || t('myTasksView.title', { defaultValue: 'My Tasks' });

  // Distinguishes "you have no tasks at all" from "your filters/search matched
  // nothing" so the empty state offers the right action for each case.
  const hasActiveFilters = sideFilter !== 'everything' || search.trim() !== ''
    || selectedProjectIds.length > 0 || selectedPriorityIds.length > 0
    || selectedAssigneeIds.length > 0 || selectedStatusIds.length > 0;
  const clearFilters = () => {
    setSideFilter('everything');
    setSearch('');
    setDebouncedSearch('');
    setSortField(null);
    setSelectedProjectIds([]);
    setSelectedPriorityIds([]);
    setSelectedAssigneeIds([]);
    setSelectedStatusIds([]);
    setPage(1);
  };

  // Prev/next navigation in the task drawer is scoped to the currently
  // loaded page (server-paginated — the full filtered set no longer exists
  // client-side).
  const handleOpenTask = useCallback((task: IMyTask) => {
    const allIds = tasks.map(tk => tk.id || '').filter(Boolean);
    const idx    = allIds.indexOf(task.id || '');
    dispatch(setNavigationContext({ taskIds: allIds, currentIndex: idx >= 0 ? idx : 0, sourceView: 'home', projectId: task.project_id || null }));
    dispatch(setSelectedTaskId(task.id || ''));
    dispatch(fetchTask({ taskId: task.id || '', projectId: task.project_id || '' }));
    dispatch(setProjectId(task.project_id || ''));
    dispatch(setShowTaskDrawer(true));
  }, [dispatch, tasks]);

  // Clicking a sortable header cycles asc -> desc for that column; clicking a
  // different column switches to it starting at asc. Mirrors the Home >
  // Overview priority table's sort behavior exactly.
  const handleSortClick = useCallback((field: SortField) => {
    setSortOrder(prev => (sortField === field && prev === 'asc' ? 'desc' : 'asc'));
    setSortField(field);
  }, [sortField]);

  const renderSortableTitle = useCallback(
    (label: string, field: SortField) => (
      <span
        onClick={() => handleSortClick(field)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', cursor: 'pointer', userSelect: 'none' }}
      >
        <span>{label}</span>
        <SortArrows active={sortField === field ? sortOrder : null} />
      </span>
    ),
    [sortField, sortOrder, handleSortClick]
  );

  // Page buttons helper
  const pageNumbers = useMemo(() => {
    const nums: (number | '…')[] = [];
    const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
      .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1);
    pages.forEach((p, i) => {
      if (i > 0 && p - (pages[i - 1] as number) > 1) nums.push('…');
      nums.push(p);
    });
    return nums;
  }, [totalPages, safePage]);

  const columns = useMemo<TableProps<IMyTask>['columns']>(() => {
    const cols: NonNullable<TableProps<IMyTask>['columns']> = [
      {
        key: 'id',
         title: t('myTasksView.columnId', { defaultValue: 'ID' }),
        width: '7%',
        render: (_, record) => (
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {record.task_key ? record.task_key : record.id ? String(record.id).slice(-4) : '—'}
          </span>
        ),
      },
      {
        key: 'name',
        title: renderSortableTitle(t('myTasksView.columnTask', { defaultValue: 'Task' }), 'name'),
        width: showAssignee ? '22%' : '29%',
        render: (_, record) => (
          <div
            onClick={() => handleOpenTask(record)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, cursor: 'pointer' }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
              {record.name}
            </span>
            <div className="row-action-button" style={{ flexShrink: 0 }}>
              <Tooltip title={t('myTasksView.openTask', { defaultValue: 'Open task' })} placement="right">
                <ExpandAltOutlined style={{ fontSize: 18, color: token.colorTextSecondary }} />
              </Tooltip>
            </div>
          </div>
        ),
      },
      {
        key: 'project',
        title: renderSortableTitle(t('tasks.project', { defaultValue: 'Project' }), 'project_name'),
        width: '15%',
        filters: projectFilterOptions.map(o => ({ text: o.label, value: o.value })),
        filteredValue: selectedProjectIds,
        render: (_, record) => (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: record.project_color || '#8c8c8c',
              flexShrink: 0, display: 'inline-block',
            }} />
            <span style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>
              {record.project_name || '—'}
            </span>
          </div>
        ),
      },
    ];

    if (showAssignee) {
      cols.push({
        key: 'assignee',
         title: t('myTasksView.columnAssignee', { defaultValue: 'Assignee' }),
        width: '13%',
        render: (_, record) => {
          const members = getAssigneeMembers(record);
          if (members.length) {
            return (
              <AvatarGroup
                members={members.map(m => ({
                  team_member_id: m.team_member_id,
                  name: m.name,
                  avatar_url: m.avatar_url,
                  color_code: m.color_code,
                }))}
                maxCount={3}
                size={26}
                isDarkMode={themeMode === 'dark'}
              />
            );
          }
          // The Unassigned view is the one place these are guaranteed empty —
          // that's what makes it worth surfacing the same assign picker the
          // project task list uses, right here, instead of a dead "—". Other
          // views (Assigned to me/by me, All, Overdue, No due date) can still
          // have zero-assignee rows too, but assigning there isn't what was
          // asked for, so they keep the plain placeholder.
          if (isUnassigned) {
            return (
              <AssigneeSelector
                task={record}
                groupId={null}
                isDarkMode={themeMode === 'dark'}
                projectIdOverride={record.project_id}
                teamId={record.team_id}
                hideInviteFooter
                onAssigneesChanged={() => refetchTasks()}
              />
            );
          }
          return <span style={{ color: token.colorTextDisabled, fontSize: 12 }}>—</span>;
        },
      });
    }

    cols.push(
      {
        key: 'status',
        title: renderSortableTitle(t('tasks.status', { defaultValue: 'Status' }), 'status'),
        width: '14%',
        filters: statusFilterOptions.map(o => ({ text: o.label, value: o.value })),
        filteredValue: selectedStatusIds,
        render: (_, record) => <HomeTasksStatusDropdown task={record} teamId={record.team_id || ''} />,
      },
      {
        key: 'priority',
        title: renderSortableTitle(t('tasks.priority', { defaultValue: 'Priority' }), 'priority'),
        width: '12%',
        filters: priorityFilterOptions.map(o => ({ text: o.label, value: o.value })),
        filteredValue: selectedPriorityIds,
        render: (_, record) => {
          if (!record.priority_name && !record.priority) {
            return <span style={{ color: token.colorTextQuaternary, fontSize: 12 }}>—</span>;
          }
          return (
            <span style={{
              display: 'inline-block',
              padding: '2px 10px',
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 400,
              background: (themeMode === 'dark' ? record.priority_color_dark : record.priority_color) ?? record.priority_color ?? 'transparent',
              color: '#fff',
            }}>
              {record.priority_name || record.priority}
            </span>
          );
        },
      },
      {
        key: 'due',
        title: renderSortableTitle(t('myTasksView.columnDue', { defaultValue: 'Due Date' }), 'end_date'),
        width: '13%',
        render: (_, record) => <HomeTasksDatePicker record={record} />,
      },
    );

    return cols;
  }, [
    t,
    showAssignee,
    token,
    renderSortableTitle,
    handleOpenTask,
    themeMode,
    projectFilterOptions,
    priorityFilterOptions,
    statusFilterOptions,
    selectedProjectIds,
    selectedPriorityIds,
    selectedStatusIds,
    isUnassigned,
    refetchTasks,
  ]);

  // Mirrors the real `columns` widths/shapes above so the loading state reads
  // as "this table, not yet loaded" instead of a generic unrelated skeleton.
  const skeletonColumns = useMemo<{ width: string; shape: 'text' | 'avatar' | 'pill' }[]>(() => {
    const cols: { width: string; shape: 'text' | 'avatar' | 'pill' }[] = [
      { width: '7%', shape: 'text' }, // id
      { width: showAssignee ? '22%' : '29%', shape: 'text' }, // task
      { width: '15%', shape: 'text' }, // project
    ];
    if (showAssignee) cols.push({ width: '13%', shape: 'avatar' });
    cols.push(
      { width: '14%', shape: 'pill' }, // status
      { width: '12%', shape: 'pill' }, // priority
      { width: '13%', shape: 'text' } // due
    );
    return cols;
  }, [showAssignee]);

  const btnStyle = (active: boolean): React.CSSProperties => ({
    minWidth: 28,
    height: 28,
    border: `1px solid ${token.colorBorder}`,
    borderRadius: 5,
    cursor: active ? 'pointer' : 'default',
    fontSize: 12,
    fontWeight: active ? 600 : 400,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: active ? token.colorPrimary : 'transparent',
    color: active ? token.colorTextLightSolid : token.colorText,
    opacity: active ? 1 : undefined,
    transition: 'all .1s',
    padding: '0 4px',
  });

  const navBtnStyle = (enabled: boolean): React.CSSProperties => ({
    minWidth: 28,
    height: 28,
    border: `1px solid ${token.colorBorder}`,
    borderRadius: 5,
    cursor: enabled ? 'pointer' : 'not-allowed',
    fontSize: 13,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    color: enabled ? token.colorText : token.colorTextDisabled,
    transition: 'all .1s',
    padding: '0 4px',
  });

  return (
    <div style={{ display: 'flex', flexDirection: isDesktop ? 'row' : 'column', height: '100%' }}>
      {/* ── Left side-filter panel — a vertical nav list on desktop, a
          horizontally-scrolling pill strip across the top on narrow screens
          (the fixed 200px column would otherwise squeeze the table into a
          sliver, same class of issue fixed on the Log Time page). ── */}
      <div style={{
        width: isDesktop ? 200 : '100%',
        flexShrink: 0,
        borderRight: isDesktop ? `1px solid ${token.colorBorderSecondary}` : 'none',
        borderBottom: isDesktop ? 'none' : `1px solid ${token.colorBorderSecondary}`,
        padding: isDesktop ? '16px 0' : '10px 12px',
        overflowY: isDesktop ? 'auto' : 'visible',
        position: isDesktop ? 'sticky' : 'static',
        top: 0,
        alignSelf: isDesktop ? 'flex-start' : undefined,
        height: isDesktop ? 'calc(100vh - 52px)' : 'auto',
      }}>
        <div style={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: .5,
          color: token.colorTextSecondary,
          padding: isDesktop ? '2px 14px 10px' : '2px 2px 6px',
        }}>
          {t('views', { defaultValue: 'VIEWS' })}
        </div>

        <div style={{
          display: 'flex',
          flexDirection: isDesktop ? 'column' : 'row',
          gap: isDesktop ? 0 : 6,
          overflowX: isDesktop ? 'visible' : 'auto',
        }}>
          {SIDE_ITEMS.map(item => {
            const active = sideFilter === item.key;
            return (
              <button
                key={item.key}
                onClick={() => { setSideFilter(item.key); setPage(1); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  width: isDesktop ? '100%' : 'auto',
                  flexShrink: isDesktop ? undefined : 0,
                  whiteSpace: isDesktop ? undefined : 'nowrap',
                  padding: isDesktop ? '7px 14px' : '7px 12px',
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: isDesktop ? 0 : 6,
                  fontSize: 13,
                  textAlign: 'left',
                  marginBottom: isDesktop ? 1 : 0,
                  background: active ? token.colorPrimaryBg : 'transparent',
                  color: active ? token.colorPrimary : token.colorText,
                  fontWeight: active ? 600 : 400,
                  transition: 'background .1s',
                }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = token.colorBgTextHover; }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
              >
                <svg
                  width="15" height="15" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  style={{ flexShrink: 0, opacity: active ? 1 : .45 }}
                >
                  <path d={item.svg} />
                </svg>
                {sideLabels[item.key]}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Main content ── */}
      {/* A bounded flex column, not a single overflowY:'auto' block — title,
          stat cards, and the filter bar stay put (flexShrink: 0) while only
          the table region below (flex: 1, minHeight: 0) scrolls internally,
          so a long/large-page-size result set scrolls the table, not the
          whole panel out from under the filters. */}
      <div style={{
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
      }}>

        {/* Title */}
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 16px', color: token.colorText, flexShrink: 0 }}>{sideLabel}</h1>

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16, marginBottom: 20, flexShrink: 0 }}>
          {[
            { label: t('myTasksView.statTotalTasks', { defaultValue: 'Total Tasks' }), value: statTotal,      color: token.colorText },
            { label: t('tasks.overdue', { defaultValue: 'Overdue' }),              value: statOverdue,    color: '#ff4d4f' },
            { label: t('myTasksView.statDueToday', { defaultValue: 'Due Today' }),   value: statDueToday,   color: '#1677ff' },
            { label: t('myTasksView.statInProgress', { defaultValue: 'In Progress' }), value: statInProgress, color: '#52c41a' },
          ].map(s => (
            <div key={s.label} style={{
              borderRadius: 10,
              padding: '18px 20px',
              border: `1px solid ${token.colorBorderSecondary}`,
              background: token.colorBgContainer,
            }}>
              <div style={{ fontSize: 12, marginBottom: 4, color: token.colorTextSecondary }}>{s.label}</div>
              <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.2, color: s.color }}>
                {isTasksLoading ? '—' : s.value}
              </div>
            </div>
          ))}
        </div>

        {/* Filter bar — boxed to match the table below (mirrors Planner's toolbar
            box / the task list view's bordered filter bar). */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            marginBottom: 16,
            flexWrap: 'wrap',
            flexShrink: 0,
            padding: '10px 12px',
            border: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: 8,
            background: token.colorBgContainer,
          }}
        >
          <PlannerMultiFilterDropdown
            label={t('tasks.status', { defaultValue: 'Status' })}
            options={statusFilterOptions}
            selected={selectedStatusIds}
            onChange={setSelectedStatusIds}
          />
          <PlannerMultiFilterDropdown
            label={t('tasks.priority', { defaultValue: 'Priority' })}
            options={priorityFilterOptions}
            selected={selectedPriorityIds}
            onChange={setSelectedPriorityIds}
            showSearch={false}
          />
          <PlannerMultiFilterDropdown
            label={t('myTasksView.filterProjects', { defaultValue: 'Projects' })}
            options={projectFilterOptions}
            selected={selectedProjectIds}
            onChange={setSelectedProjectIds}
          />
          <PlannerMultiFilterDropdown
            label={t('myTasksView.columnAssignee', { defaultValue: 'Assignee' })}
            options={assigneeFilterOptions}
            selected={selectedAssigneeIds}
            onChange={setSelectedAssigneeIds}
          />

          {/* Search — pushed to the far right via marginLeft: auto, filters stay
              grouped on the left. */}
          <Input
            prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
             placeholder={t('myTasksView.searchPlaceholder', { defaultValue: 'Search tasks...' })}
            value={search}
            onChange={e => setSearch(e.target.value)}
            allowClear
            style={{
              width: isDesktop ? 220 : '100%',
              flex: isDesktop ? undefined : '1 1 100%',
              height: 32,
              fontSize: 12,
              borderRadius: 7,
              marginLeft: isDesktop ? 'auto' : 0,
            }}
          />
        </div>

        {/* Table — wrapped in the same bordered card the loaded table uses
            (see below) so the loading state doesn't look glued to the filter
            bar above it. Rows are split into column-shaped blocks matching
            skeletonColumns rather than one generic full-width block, so this
            reads as "the table" loading, not an unrelated placeholder. */}
        {isTasksLoading ? (
          <div style={{
            borderRadius: 10,
            border: `1px solid ${token.colorBorderSecondary}`,
            background: token.colorBgContainer,
            maxHeight: 'calc(100vh - 320px)',
            overflowY: 'auto',
          }}>
            {Array.from({ length: pageSize }).map((_, row) => (
              <div
                key={row}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  height: 45,
                  boxSizing: 'border-box',
                  padding: '0 16px',
                  borderBottom: row < pageSize - 1 ? `1px solid ${token.colorBorderSecondary}` : 'none',
                }}
              >
                {skeletonColumns.map((col, i) => (
                  <div key={i} style={{ width: col.width, flexShrink: 0 }}>
                    {col.shape === 'avatar' ? (
                      <Skeleton.Avatar active size={26} shape="circle" />
                    ) : col.shape === 'pill' ? (
                      <Skeleton.Button active size="small" block style={{ height: 22, minWidth: 0, borderRadius: 4 }} />
                    ) : (
                      <Skeleton.Input active size="small" block style={{ height: 16, minWidth: 0 }} />
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          // No flex-grow here on purpose — with flex:1 this box always stretched
          // to fill the panel's full remaining height, so a short page (e.g. 10
          // rows) left a big empty gap with the pagination bar pinned to the
          // bottom of that stretch instead of sitting right under the last row.
          // maxHeight instead lets it shrink-to-fit small result sets, and only
          // kicks in (capping + letting my-tasks-table-card's own overflow:auto
          // take over) once content actually exceeds the available space.
          <div style={{
            borderRadius: 10,
            border: `1px solid ${token.colorBorderSecondary}`,
            overflow: 'hidden',
            background: token.colorBgContainer,
            maxHeight: 'calc(100vh - 320px)',
            display: 'flex',
            flexDirection: 'column',
          }}>
            {tasks.length === 0 ? (
              <div style={{ padding: '40px 0', overflowY: 'auto' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
                   {hasActiveFilters ? (
                     <>
                       <div style={{ fontSize: 14, fontWeight: 600 }}>{t('myTasksView.emptyFilteredTitle', { defaultValue: 'No matching tasks' })}</div>
                       <p style={{ opacity: 0.6, fontSize: 12, margin: 0, maxWidth: 280 }}>
                         {t('myTasksView.emptyFilteredSubtitle', { defaultValue: 'Try adjusting your filters or search term.' })}
                       </p>
                       <Button size="small" onClick={clearFilters}>{t('myTasksView.clearFilters', { defaultValue: 'Clear filters' })}</Button>
                    </>
                  ) : (
                     <>
                       <div style={{ fontSize: 14, fontWeight: 600 }}>{t('myTasksView.emptyTitle', { defaultValue: 'No tasks yet' })}</div>
                       <p style={{ opacity: 0.6, fontSize: 12, margin: 0, maxWidth: 280 }}>
                         {t('myTasksView.emptySubtitle', { defaultValue: 'Create your first task to get started.' })}
                       </p>
                       <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setAddTaskOpen(true)}>
                         {t('tasks.addTaskButton', { defaultValue: 'Add Task' })}
                       </Button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div
                className="my-tasks-table-card"
                style={{
                  '--my-tasks-sticky-bg': token.colorBgContainer,
                  flex: 1,
                  minHeight: 0,
                  overflowY: 'auto',
                } as React.CSSProperties}
              >
                <Table
                  dataSource={tasks}
                  rowKey={record => record.id || ''}
                  columns={columns}
                  size="middle"
                  rowClassName="custom-row-height"
                  pagination={false}
                  tableLayout="fixed"
                  onChange={(_pagination, filters) => {
                    setPage(1);
                    setSelectedProjectIds((filters.project as string[]) || []);
                    setSelectedPriorityIds((filters.priority as string[]) || []);
                    setSelectedStatusIds((filters.status as string[]) || []);
                  }}
                />
              </div>
            )}

            {/* Pagination — flexShrink: 0 keeps it pinned below the scrolling
                table instead of being scrolled out of view with the rows. */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 8,
              padding: '10px 16px',
              borderTop: `1px solid ${token.colorBorderSecondary}`,
              flexShrink: 0,
            }}>
              {/* Left: rows per page + count */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: token.colorTextSecondary }}>{t('myTasksView.rowsPerPage', { defaultValue: 'Rows per page' })}</span>
                <Dropdown
                  trigger={['click']}
                  menu={{
                    items: [10, 20, 50].map(n => ({ key: String(n), label: String(n) })),
                    selectedKeys: [String(pageSize)],
                    onClick: info => { setPageSize(Number(info.key)); setPage(1); },
                  }}
                >
                  <Button size="small">
                    {pageSize} <CaretDownFilled />
                  </Button>
                </Dropdown>
                <span style={{ fontSize: 12, color: token.colorTextSecondary, marginLeft: 4 }}>
                   {t('myTasksView.paginationSummary', {
                     range: totalCount === 0
                       ? '0'
                       : `${(safePage - 1) * pageSize + 1} – ${Math.min(safePage * pageSize, totalCount)}`,
                     total: totalCount,
                     defaultValue: '{{range}} of {{total}}',
                   })}
                </span>
              </div>

              {/* Right: page navigation */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
                <button style={navBtnStyle(safePage > 1)} disabled={safePage === 1} onClick={() => setPage(1)}>«</button>
                <button style={navBtnStyle(safePage > 1)} disabled={safePage === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>‹</button>
                {pageNumbers.map((p, i) =>
                  typeof p === 'number'
                    ? <button key={i} style={btnStyle(p === safePage)} onClick={() => setPage(p)}>{p}</button>
                    : <span key={i} style={{ fontSize: 12, padding: '0 4px', opacity: .5 }}>…</span>
                )}
                <button style={navBtnStyle(safePage < totalPages)} disabled={safePage === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>›</button>
                <button style={navBtnStyle(safePage < totalPages)} disabled={safePage === totalPages} onClick={() => setPage(totalPages)}>»</button>
              </div>
            </div>
          </div>
        )}
      </div>

      <HomeAddTaskModal
        open={addTaskOpen}
        defaultDate={null}
        onClose={() => setAddTaskOpen(false)}
        onTaskCreated={() => refetchTasks()}
      />
    </div>
  );
};

export default HomeMyTasksView;
