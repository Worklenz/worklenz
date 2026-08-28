import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  Select,
  DatePicker,
  TimePicker,
  Segmented,
  Input,
  InputNumber,
  Button,
  theme,
  notification,
  Table,
  TableProps,
  Badge,
  Pagination,
  CaretUpOutlined,
  CaretDownOutlined,
  Tag,
} from '@/shared/antd-imports';
import dayjs, { Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useGetProjectsByTeamQuery } from '@/api/home-page/home-page.api.service';
import {
  taskTimeLogsApiService,
  IMySummary,
  IRecentTimeLog,
  IWeeklyBreakdownDay,
  ITaskInProject,
} from '@/api/tasks/task-time-logs.api.service';
import { IProject } from '@/types/project/project.types';
import HomeAddTaskModal from '../task-list/HomeAddTaskModal';
import {
  setSelectedTaskId,
  setShowTaskDrawer,
  fetchTask,
  setNavigationContext,
} from '@/features/task-drawer/task-drawer.slice';
import { setProjectId } from '@/features/project/project.slice';
import { updateTask } from '@/features/task-management/task-management.slice';
import { Task } from '@/types/task-management.types';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { decodeHtmlEntities } from '@/utils/html-entities';
import { useResponsive } from '@/hooks/useResponsive';
import './home-log-time.css';

const formatSeconds = (seconds: number): string => {
  const total = Math.max(0, Math.round(seconds || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')}`;
};

const HomeLogTime: React.FC = () => {
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const { t } = useTranslation('home');
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const dispatch = useAppDispatch();
  const { socket } = useSocket();
  const { isDesktop } = useResponsive();

  const formatLogDate = (createdAt: string): string => {
    const date = dayjs(createdAt);
    if (date.isSame(dayjs(), 'day')) return t('logTime.today', { defaultValue: 'Today' });
    if (date.isSame(dayjs().subtract(1, 'day'), 'day')) return t('logTime.yesterday', { defaultValue: 'Yesterday' });
    return date.format('MMM D');
  };

  const STAT_DEFS = useMemo(() => [
    { key: 'today_total' as const, label: t('logTime.todayTotal', { defaultValue: 'Today Total' }), color: '#1677ff' },
    { key: 'today_billable' as const, label: t('logTime.todayBillable', { defaultValue: 'Today Billable' }), color: '#52c41a' },
    { key: 'today_non_billable' as const, label: t('logTime.todayNonBillable', { defaultValue: 'Today Non-Billable' }), color: '#ff4d4f' },
    { key: 'week_total' as const, label: t('logTime.weekTotal', { defaultValue: 'Week Total' }), color: '#1677ff' },
    { key: 'week_billable' as const, label: t('logTime.weekBillable', { defaultValue: 'Week Billable' }), color: '#52c41a' },
    { key: 'week_non_billable' as const, label: t('logTime.weekNonBillable', { defaultValue: 'Week Non-Billable' }), color: '#ff4d4f' },
  ], [t]);

  const WEEKDAY_LABELS = useMemo(() => [
    t('logTime.weekdayMon', { defaultValue: 'Mon' }),
    t('logTime.weekdayTue', { defaultValue: 'Tue' }),
    t('logTime.weekdayWed', { defaultValue: 'Wed' }),
    t('logTime.weekdayThu', { defaultValue: 'Thu' }),
    t('logTime.weekdayFri', { defaultValue: 'Fri' }),
    t('logTime.weekdaySat', { defaultValue: 'Sat' }),
    t('logTime.weekdaySun', { defaultValue: 'Sun' }),
  ], [t]);

  type LogSortField = 'project_name' | 'task_name' | 'priority_name' | 'time_spent' | 'created_at' | null;

  // Matches the Overview page's priority-table sort affordance (TasksList.tsx) —
  // stacked up/down carets, active direction highlighted in the theme's primary color.
  const SortArrows: React.FC<{ active: 'asc' | 'desc' | null }> = ({ active }) => {
    const { token } = theme.useToken();
    return (
      <span style={{ display: 'inline-flex', flexDirection: 'column', marginLeft: 4, lineHeight: 0 }}>
        <CaretUpOutlined
          style={{ fontSize: 9, color: active === 'asc' ? token.colorPrimary : token.colorTextQuaternary }}
        />
        <CaretDownOutlined
          style={{ fontSize: 9, marginTop: -2, color: active === 'desc' ? token.colorPrimary : token.colorTextQuaternary }}
        />
      </span>
    );
  };

  const { data: projectListData } = useGetProjectsByTeamQuery();
  const projects = useMemo(() => projectListData?.body || [], [projectListData]);

  const [selProjectId, setSelProjectId] = useState<string | undefined>(undefined);
  const [selTaskId, setSelTaskId] = useState<string | undefined>(undefined);
  const [tasks, setTasks] = useState<ITaskInProject[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [taskSearch, setTaskSearch] = useState('');
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const quickEntryRef = useRef<HTMLDivElement>(null);

  const [inputMode, setInputMode] = useState<'Duration' | 'Time Range'>('Duration');
  const [date, setDate] = useState<Dayjs>(dayjs());
  const [timeHours, setTimeHours] = useState<number>(0);
  const [timeMinutes, setTimeMinutes] = useState<number>(30);
  const minutesAutoClearedRef = useRef(false);
  const [startTime, setStartTime] = useState<Dayjs | null>(null);
  const [endTime, setEndTime] = useState<Dayjs | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [summary, setSummary] = useState<IMySummary | null>(null);
  const [weekly, setWeekly] = useState<IWeeklyBreakdownDay[]>([]);
  const [recentLogs, setRecentLogs] = useState<IRecentTimeLog[]>([]);
  const [recentLogsLoading, setRecentLogsLoading] = useState(false);

  // Recently Logged table — sort/filter/pagination state
  const [logSortField, setLogSortField] = useState<LogSortField>('created_at');
  const [logSortOrder, setLogSortOrder] = useState<'asc' | 'desc'>('desc');
  const [logCurrentPage, setLogCurrentPage] = useState(1);
  const logPageSize = 10;
  const [selectedLogProjectIds, setSelectedLogProjectIds] = useState<React.Key[]>([]);
  const [selectedLogStatusNames, setSelectedLogStatusNames] = useState<React.Key[]>([]);
  const [selectedLogPriorityNames, setSelectedLogPriorityNames] = useState<React.Key[]>([]);
  const [selectedLogBillable, setSelectedLogBillable] = useState<React.Key[]>([]);

  // Store original task names to restore if drawer closes without saving
  const originalTaskNamesRef = useRef<Map<string, string>>(new Map());

  const refreshData = useCallback(() => {
    taskTimeLogsApiService.getMySummary()
      .then(res => { if (res.done) setSummary(res.body as IMySummary); })
      .catch(() => {});
    taskTimeLogsApiService.getMyWeeklyBreakdown()
      .then(res => { if (res.done) setWeekly(res.body as IWeeklyBreakdownDay[]); })
      .catch(() => setWeekly([]));
    setRecentLogsLoading(true);
    taskTimeLogsApiService.getRecentTimeLogs(100)
      .then(res => { if (res.done) setRecentLogs(res.body as IRecentTimeLog[]); })
      .catch(() => {})
      .finally(() => setRecentLogsLoading(false));
  }, []);

  useEffect(() => { refreshData(); }, [refreshData]);

  // Real-time task name updates: Listen to socket events for changes from other sources
  useEffect(() => {
    if (!socket) return;

    const handleTaskNameChange = (data: { id: string; name: string }) => {
      if (!data?.id || !data.name) return;

      const decodedName = decodeHtmlEntities(data.name);

      // Update the task name in the recent logs list
      setRecentLogs(prevLogs =>
        prevLogs.map(log =>
          log.task_id === data.id ? { ...log, task_name: decodedName } : log
        )
      );
    };

    socket.on(SocketEvents.TASK_NAME_CHANGE.toString(), handleTaskNameChange);

    return () => {
      socket.off(SocketEvents.TASK_NAME_CHANGE.toString(), handleTaskNameChange);
    };
  }, [socket]);

  // Real-time task name updates: Sync with Redux state for immediate updates while editing in drawer
  const selectedTaskId = useAppSelector(state => state.taskDrawerReducer.selectedTaskId);
  const showTaskDrawer = useAppSelector(state => state.taskDrawerReducer.showTaskDrawer);
  const taskFormViewModel = useAppSelector(state => state.taskDrawerReducer.taskFormViewModel);
  const taskManagementEntities = useAppSelector(state => state.taskManagement.entities);

  // Capture original task name when drawer opens
  useEffect(() => {
    if (showTaskDrawer && selectedTaskId) {
      // Find the original task name from our local state
      const logInList = recentLogs.find(l => l.task_id === selectedTaskId);
      const originalName = logInList?.task_name;
      
      if (originalName && !originalTaskNamesRef.current.has(selectedTaskId)) {
        originalTaskNamesRef.current.set(selectedTaskId, originalName);
      }
    } else if (!showTaskDrawer && selectedTaskId) {
      // Drawer closed - restore original name if current name is empty or invalid
      const originalName = originalTaskNamesRef.current.get(selectedTaskId);
      if (originalName) {
        const currentTask = taskManagementEntities[selectedTaskId];
        const currentName = taskFormViewModel?.task?.name || currentTask?.title;
        
        // If current name is empty or whitespace-only, restore the original
        if (!currentName || !currentName.trim()) {
          setRecentLogs(prevLogs =>
            prevLogs.map(log =>
              log.task_id === selectedTaskId ? { ...log, task_name: originalName } : log
            )
          );
        }
        
        // Clean up the stored original name
        originalTaskNamesRef.current.delete(selectedTaskId);
      }
    }
  }, [showTaskDrawer, selectedTaskId, recentLogs, taskFormViewModel, taskManagementEntities]);

  // Real-time sync: Update list as user types, but show original name if empty
  const currentTaskName = useMemo(() => {
    if (!selectedTaskId || !showTaskDrawer) return null;
    
    const drawerTaskName = taskFormViewModel?.task?.name;
    const taskEntity = taskManagementEntities[selectedTaskId];
    const taskName = drawerTaskName !== undefined ? drawerTaskName : (taskEntity?.title || null);
    
    // If the name is empty or whitespace-only, return a special marker
    if (!taskName || !taskName.trim()) {
      return '__EMPTY__';
    }
    
    return taskName;
  }, [selectedTaskId, showTaskDrawer, taskFormViewModel?.task?.name, taskManagementEntities]);

  useEffect(() => {
    if (!selectedTaskId || !currentTaskName) return;

    // If name is empty, show the original name
    if (currentTaskName === '__EMPTY__') {
      const originalName = originalTaskNamesRef.current.get(selectedTaskId);
      if (originalName) {
        setRecentLogs(prevLogs =>
          prevLogs.map(log =>
            log.task_id === selectedTaskId ? { ...log, task_name: originalName } : log
          )
        );
      }
      return;
    }

    // Normal case: update with the current name
    const decodedName = decodeHtmlEntities(currentTaskName);

    setRecentLogs(prevLogs =>
      prevLogs.map(log =>
        log.task_id === selectedTaskId ? { ...log, task_name: decodedName } : log
      )
    );
  }, [selectedTaskId, currentTaskName]);

  useEffect(() => {
    if (!selProjectId) {
      setTasks([]);
      return;
    }
    setTasksLoading(true);
    taskTimeLogsApiService
      .getMyTasksInProject(selProjectId, taskSearch || undefined)
      .then(res => { if (res.done) setTasks(res.body as ITaskInProject[]); })
      .catch(() => setTasks([]))
      .finally(() => setTasksLoading(false));
  }, [selProjectId, taskSearch]);

  const projectOptions = projects.map((p: IProject) => ({ value: p.id, label: p.name }));
  const taskOptions = tasks.map(t => ({ value: t.id, label: t.name }));

  const loggedSeconds = useMemo(() => {
    if (inputMode === 'Duration') {
      return Math.max(0, timeHours) * 3600 + Math.max(0, Math.min(59, timeMinutes)) * 60;
    }
    if (!startTime || !endTime) return 0;
    const diff = endTime.diff(startTime, 'second');
    return diff > 0 ? diff : 0;
  }, [inputMode, timeHours, timeMinutes, startTime, endTime]);

  const isFormValid = useMemo(() => {
    if (!selProjectId || !selTaskId || !date || loggedSeconds <= 0) return false;
    if (inputMode === 'Time Range' && (!startTime || !endTime)) return false;
    return true;
  }, [selProjectId, selTaskId, date, loggedSeconds, inputMode, startTime, endTime]);

  const handleProjectChange = (projectId: string) => {
    setSelProjectId(projectId);
    setSelTaskId(undefined);
    setTaskSearch('');
  };

  const handleSubmit = async () => {
    if (!isFormValid) return;
    setSubmitting(true);
    try {
      await taskTimeLogsApiService.create({
        id: selTaskId,
        project_id: selProjectId,
        formatted_start: date.toISOString(),
        seconds_spent: loggedSeconds,
        description: notes || undefined,
      });
      setTimeHours(0);
      setTimeMinutes(30);
      minutesAutoClearedRef.current = false;
      setStartTime(null);
      setEndTime(null);
      setNotes('');
      refreshData();
    } catch {
      notification.error({ message: t('logTime.failedToLogTime', { defaultValue: 'Failed to log time' }) });
    } finally {
      setSubmitting(false);
    }
  };

  // Recently Logged — filter option lists derived from the currently loaded batch,
  // same approach as the Overview page's priority table (TasksList.tsx).
  const logProjectFilterOptions = useMemo(() => {
    const seen = new Map<string, string>();
    recentLogs.forEach(l => {
      if (l.project_id && l.project_name && !seen.has(l.project_id)) seen.set(l.project_id, l.project_name);
    });
    return Array.from(seen.entries()).map(([value, text]) => ({ text, value }));
  }, [recentLogs]);

  const logStatusFilterOptions = useMemo(() => {
    const seen = new Set<string>();
    recentLogs.forEach(l => { if (l.status_name) seen.add(l.status_name); });
    return Array.from(seen).map(name => ({ text: name, value: name }));
  }, [recentLogs]);

  const logPriorityFilterOptions = useMemo(() => {
    const seen = new Set<string>();
    recentLogs.forEach(l => { if (l.priority_name) seen.add(l.priority_name); });
    return Array.from(seen).map(name => ({ text: name, value: name }));
  }, [recentLogs]);

  const logBillableFilterOptions = [
    { text: t('logTime.yes', { defaultValue: 'Yes' }), value: 'yes' },
    { text: t('logTime.no', { defaultValue: 'No' }), value: 'no' },
  ];

  const handleLogSortClick = useCallback(
    (field: LogSortField) => {
      setLogCurrentPage(1);
      setLogSortOrder(prev => (logSortField === field && prev === 'asc' ? 'desc' : 'asc'));
      setLogSortField(field);
    },
    [logSortField]
  );

  const renderLogSortableTitle = useCallback(
    (label: string, field: LogSortField) => (
      <span
        onClick={() => handleLogSortClick(field)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', cursor: 'pointer', userSelect: 'none' }}
      >
        <span>{label}</span>
        <SortArrows active={logSortField === field ? logSortOrder : null} />
      </span>
    ),
    [logSortField, logSortOrder, handleLogSortClick]
  );

  const filteredSortedLogs = useMemo(() => {
    let logs = recentLogs;
    if (selectedLogProjectIds.length) {
      logs = logs.filter(l => selectedLogProjectIds.includes(l.project_id || ''));
    }
    if (selectedLogStatusNames.length) {
      logs = logs.filter(l => selectedLogStatusNames.includes(l.status_name || ''));
    }
    if (selectedLogPriorityNames.length) {
      logs = logs.filter(l => selectedLogPriorityNames.includes(l.priority_name || ''));
    }
    if (selectedLogBillable.length) {
      logs = logs.filter(l => selectedLogBillable.includes(l.billable ? 'yes' : 'no'));
    }
    if (!logSortField) return logs;

    const dir = logSortOrder === 'asc' ? 1 : -1;
    return [...logs].sort((a, b) => {
      if (logSortField === 'time_spent') return ((a.time_spent || 0) - (b.time_spent || 0)) * dir;
      if (logSortField === 'created_at') {
        return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * dir;
      }
      const av = (a[logSortField] || '').toString().toLowerCase();
      const bv = (b[logSortField] || '').toString().toLowerCase();
      return av.localeCompare(bv) * dir;
    });
  }, [recentLogs, logSortField, logSortOrder, selectedLogProjectIds, selectedLogStatusNames, selectedLogPriorityNames, selectedLogBillable]);

  const handleOpenTask = useCallback(
    (record: IRecentTimeLog) => {
      if (!record.task_id) return;
      const allTaskIds = Array.from(new Set(filteredSortedLogs.map(l => l.task_id).filter(Boolean)));
      const currentIndex = allTaskIds.indexOf(record.task_id);

      // Pre-populate Redux with available task data to prevent loading flash
      dispatch(updateTask({
        id: record.task_id,
        title: record.task_name,
        projectId: record.project_id,
      } as Partial<Task> as Task));

      dispatch(
        setNavigationContext({
          taskIds: allTaskIds,
          currentIndex: currentIndex >= 0 ? currentIndex : 0,
          sourceView: 'home',
          projectId: record.project_id || null,
        })
      );

      dispatch(setSelectedTaskId(record.task_id));
      dispatch(fetchTask({ taskId: record.task_id, projectId: record.project_id }));
      dispatch(setProjectId(record.project_id));
      dispatch(setShowTaskDrawer(true));
    },
    [dispatch, filteredSortedLogs]
  );

  const logColumns: TableProps<IRecentTimeLog>['columns'] = useMemo(
    () => [
      {
        key: 'task',
        title: renderLogSortableTitle(t('logTime.taskColumn', { defaultValue: 'Task' }), 'task_name'),
        width: '20%',
        render: (_, record) => (
          <span
            style={{ cursor: 'pointer' }}
            onClick={() => handleOpenTask(record)}
            onMouseEnter={e => { e.currentTarget.style.textDecoration = 'underline'; }}
            onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none'; }}
          >
            {record.task_name}
          </span>
        ),
      },
      {
        key: 'project',
        title: renderLogSortableTitle(t('logTime.projectColumn', { defaultValue: 'Project' }), 'project_name'),
        width: '18%',
        filters: logProjectFilterOptions,
        filteredValue: selectedLogProjectIds,
        onFilter: (value, record) => record.project_id === value,
        render: (_, record) => (
          <span
            style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
            onClick={() => record.project_id && navigate(`/worklenz/projects/${record.project_id}?tab=tasks-list&pinned_tab=tasks-list`)}
          >
            <Badge color={record.project_color || token.colorPrimary} />
            <span style={{ fontWeight: 500 }}>{record.project_name}</span>
          </span>
        ),
      },
      {
        key: 'status',
        title: t('logTime.statusColumn', { defaultValue: 'Status' }),
        width: '12%',
        filters: logStatusFilterOptions,
        filteredValue: selectedLogStatusNames,
        onFilter: (value, record) => record.status_name === value,
        render: (_, record) =>
          record.status_name ? (
            <Tag
              color={themeMode === 'dark' ? record.status_color_dark : record.status_color}
              style={{ margin: 0, fontSize: 11 }}
            >
              {record.status_name}
            </Tag>
          ) : null,
      },
      {
        key: 'priority',
        title: renderLogSortableTitle(t('logTime.priorityColumn', { defaultValue: 'Priority' }), 'priority_name'),
        width: '12%',
        filters: logPriorityFilterOptions,
        filteredValue: selectedLogPriorityNames,
        onFilter: (value, record) => record.priority_name === value,
        render: (_, record) =>
          record.priority_name ? (
            <Tag
              color={themeMode === 'dark' ? record.priority_color_dark : record.priority_color}
              style={{ margin: 0, fontSize: 11 }}
            >
              {record.priority_name}
            </Tag>
          ) : null,
      },
      {
        key: 'billable',
        title: t('logTime.billableColumn', { defaultValue: 'Billable' }),
        width: '10%',
        filters: logBillableFilterOptions,
        filteredValue: selectedLogBillable,
        onFilter: (value, record) => (record.billable ? 'yes' : 'no') === value,
        render: (_, record) => (
          <Tag
            color={record.billable ? '#52c41a' : undefined}
            style={{ margin: 0, fontSize: 11 }}
          >
            {record.billable ? t('logTime.yes', { defaultValue: 'Yes' }) : t('logTime.no', { defaultValue: 'No' })}
          </Tag>
        ),
      },
      {
        key: 'time',
        title: renderLogSortableTitle(t('logTime.timeColumn', { defaultValue: 'Time' }), 'time_spent'),
        width: '10%',
        render: (_, record) => (
          <Tag color="#1677ff" style={{ margin: 0, fontSize: 11 }}>
            {formatSeconds(record.time_spent || 0)}
          </Tag>
        ),
      },
      {
        key: 'date',
        title: renderLogSortableTitle(t('logTime.dateColumn', { defaultValue: 'Date' }), 'created_at'),
        width: '10%',
        render: (_, record) => <span style={{ opacity: 0.5, fontSize: 11 }}>{formatLogDate(record.created_at)}</span>,
      },
    ],
    [
      renderLogSortableTitle,
      logProjectFilterOptions,
      logStatusFilterOptions,
      logPriorityFilterOptions,
      selectedLogProjectIds,
      selectedLogStatusNames,
      selectedLogPriorityNames,
      selectedLogBillable,
      themeMode,
      token,
      navigate,
      handleOpenTask,
    ]
  );

  const fldLbl: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 5, color: token.colorTextSecondary };
  const cardStyle: React.CSSProperties = {
    borderRadius: token.borderRadiusLG,
    border: `1px solid ${token.colorBorderSecondary}`,
    background: token.colorBgContainer,
    padding: 16,
  };

  const weekMax = Math.max(1, ...weekly.map(d => (d.billable + d.non_billable) / 3600));

  return (
    <div style={{ padding: 24, height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: 20, flexShrink: 0 }}>
         <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{t('logTime.pageTitle', { defaultValue: 'Log Time' })}</h1>
         <p style={{ opacity: 0.5, fontSize: 13, margin: '4px 0 0' }}>{t('logTime.pageSubtitle', { defaultValue: 'Track time spent on your tasks.' })}</p>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: isDesktop ? 'row' : 'column',
          gap: isDesktop ? 24 : 16,
          alignItems: isDesktop ? 'stretch' : undefined,
          flex: 1,
          minHeight: 0,
        }}
      >
        {/* Quick Time Entry */}
        <div
          ref={quickEntryRef}
          style={{
            ...cardStyle,
            flex: isDesktop ? '0 0 360px' : '1 1 auto',
            width: isDesktop ? undefined : '100%',
            alignSelf: isDesktop ? 'flex-start' : 'stretch',
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>{t('logTime.quickEntryTitle', { defaultValue: 'Quick Time Entry' })}</div>

          <div style={{ marginBottom: 14 }}>
            <label style={fldLbl}>{t('logTime.projectLabel', { defaultValue: 'Project' })}</label>
            <Select
              showSearch
              style={{ width: '100%' }}
              placeholder={t('logTime.projectPlaceholder', { defaultValue: 'Select project' })}
              optionFilterProp="label"
              options={projectOptions}
              value={selProjectId}
              onChange={handleProjectChange}
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={fldLbl}>{t('logTime.taskLabel', { defaultValue: 'Task' })}</label>
            <Select
              showSearch
              style={{ width: '100%' }}
              placeholder={selProjectId ? t('logTime.taskPlaceholder', { defaultValue: 'Select task' }) : t('logTime.taskDisabledPlaceholder', { defaultValue: 'Select a project first' })}
              disabled={!selProjectId}
              loading={tasksLoading}
              filterOption={false}
              onSearch={setTaskSearch}
              options={taskOptions}
              value={selTaskId}
              onChange={setSelTaskId}
              notFoundContent={tasksLoading ? t('logTime.taskSearching', { defaultValue: 'Searching...' }) : t('logTime.noTasksFound', { defaultValue: 'No tasks found' })}
              dropdownRender={menu => (
                <>
                  {menu}
                  <div
                    style={{ borderTop: `1px solid ${token.colorBorderSecondary}`, padding: '6px 8px' }}
                  >
                    <Button
                      type="link"
                      size="small"
                      disabled={!selProjectId}
                      onClick={() => setAddTaskOpen(true)}
                      style={{ padding: 0 }}
                    >
                       {t('logTime.addNewTask', { defaultValue: '+ Add New Task' })}
                    </Button>
                  </div>
                </>
              )}
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={fldLbl}>{t('logTime.inputModeLabel', { defaultValue: 'Input Mode' })}</label>
            <Segmented
              block
              value={inputMode}
              onChange={v => setInputMode(v as 'Duration' | 'Time Range')}
              options={[
                { value: 'Duration', label: t('logTime.durationMode', { defaultValue: 'Duration' }) },
                { value: 'Time Range', label: t('logTime.timeRangeMode', { defaultValue: 'Time Range' }) },
              ]}
            />
          </div>

          {inputMode === 'Duration' ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
               <div style={{ flex: 1.4, minWidth: 160 }}>
                 <label style={fldLbl}>{t('logTime.dateLabel', { defaultValue: 'Date' })}</label>
                 <DatePicker
                  style={{ width: '100%' }}
                  value={date}
                  onChange={d => d && setDate(d)}
                  disabledDate={current => current && current.toDate() > new Date()}
                />
              </div>
              <div style={{ flex: 1, minWidth: 72 }}>
                 <label style={fldLbl}>{t('logTime.hoursLabel', { defaultValue: 'Hours' })}</label>
                 <InputNumber
                   min={0}
                   precision={0}
                   placeholder={t('logTime.hoursPlaceholder', { defaultValue: '0' })}
                  value={timeHours}
                  onChange={v => {
                    const next = Math.max(0, Number(v) || 0);
                    // Only auto-clear if minutes is still at its untouched default —
                    // otherwise this would stomp a minutes value the user already
                    // entered themselves (e.g. entering "45" then "1" to mean 1h45m).
                    if (!minutesAutoClearedRef.current && next > 0 && timeMinutes === 30) {
                      minutesAutoClearedRef.current = true;
                      setTimeMinutes(0);
                    }
                    setTimeHours(next);
                  }}
                  style={{ width: '100%' }}
                />
              </div>
              <div style={{ flex: 1, minWidth: 72 }}>
                 <label style={fldLbl}>{t('logTime.minutesLabel', { defaultValue: 'Minutes' })}</label>
                 <InputNumber
                   min={0}
                   max={59}
                   precision={0}
                   placeholder={t('logTime.minutesPlaceholder', { defaultValue: '0' })}
                  value={timeMinutes}
                  onChange={v => setTimeMinutes(Math.min(59, Math.max(0, Number(v) || 0)))}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 14 }}>
                <label style={fldLbl}><span style={{ color: token.colorError }}>*</span> {t('logTime.dateLabel', { defaultValue: 'Date' })}</label>
                <DatePicker
                  style={{ width: '100%' }}
                  value={date}
                  onChange={d => d && setDate(d)}
                  disabledDate={current => current && current.toDate() > new Date()}
                />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <label style={fldLbl}><span style={{ color: token.colorError }}>*</span> {t('logTime.requiredStartTime', { defaultValue: 'Start Time' })}</label>
                  <TimePicker
                    style={{ width: '100%' }}
                    format="HH:mm"
                    value={startTime}
                    onChange={setStartTime}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <label style={fldLbl}><span style={{ color: token.colorError }}>*</span> {t('logTime.requiredEndTime', { defaultValue: 'End Time' })}</label>
                  <TimePicker
                    style={{ width: '100%' }}
                    format="HH:mm"
                    value={endTime}
                    onChange={setEndTime}
                  />
                </div>
              </div>
            </>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={fldLbl}>{t('logTime.workDescriptionLabel', { defaultValue: 'Description' })}</label>
            <Input
              placeholder={t('logTime.workDescriptionPlaceholder', { defaultValue: 'What did you work on?' })}
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          <Button
            type="primary"
            loading={submitting}
            disabled={!isFormValid}
            onClick={handleSubmit}
          >
            {t('logTime.submitButton', { defaultValue: 'Log Time' })}
          </Button>
        </div>

        {/* Right column */}
        <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0, gap: 16 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isDesktop ? '1fr 220px' : '1fr',
              gap: 12,
              alignItems: 'stretch',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isDesktop ? 'repeat(3, 1fr)' : 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: 12,
              }}
            >
              {STAT_DEFS.map(stat => (
                <div key={stat.key} style={cardStyle}>
                  <div style={{ fontSize: 11, color: token.colorTextSecondary, marginBottom: 4 }}>{stat.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: stat.color }}>
                    {formatSeconds((summary?.[stat.key] as number) || 0)}
                  </div>
                </div>
              ))}
            </div>

             <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column' }}>
               <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{t('logTime.thisWeek', { defaultValue: 'This Week' })}</div>
               <div style={{ display: 'flex', gap: 10, marginBottom: 8, fontSize: 10 }}>
                 <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                   <span style={{ width: 8, height: 8, borderRadius: 2, background: '#52c41a', display: 'inline-block' }} />{t('logTime.billableLegend', { defaultValue: 'Billable' })}
                 </span>
                 <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                   <span style={{ width: 8, height: 8, borderRadius: 2, background: '#ff7875', display: 'inline-block' }} />{t('logTime.nonBillableLegend', { defaultValue: 'Non-Billable' })}
                 </span>
               </div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', flex: 1, paddingBottom: 4 }}>
                 {weekly.length === 0 && (
                    <div style={{ width: '100%', textAlign: 'center', fontSize: 11, opacity: 0.45 }}>{t('logTime.noDataYet', { defaultValue: 'No data yet' })}</div>
                  )}
                {weekly.map((d, i) => {
                  const billHrs = d.billable / 3600;
                  const nonHrs = d.non_billable / 3600;
                  const total = billHrs + nonHrs;
                  const billPct = (billHrs / weekMax) * 100;
                  const nonPct = (nonHrs / weekMax) * 100;
                  return (
                    <div key={d.day} style={{ textAlign: 'center', flex: 1 }}>
                      <div style={{ height: 80, background: token.colorFillTertiary, borderRadius: 4, position: 'relative', overflow: 'hidden', marginBottom: 4, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                        <div style={{ width: '100%', height: `${nonPct}%`, background: '#ff7875' }} />
                        <div style={{ width: '100%', height: `${billPct}%`, background: '#52c41a' }} />
                      </div>
                      <div style={{ fontSize: 9, opacity: 0.55 }}>{WEEKDAY_LABELS[i] || dayjs(d.day).format('ddd')}</div>
                      <div style={{ fontSize: 10, fontWeight: 600 }}>{total.toFixed(1)}h</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Recently Logged — fills the remaining vertical space down to the
              bottom of the screen; only the table body scrolls internally,
              same pattern as the Overview page's priority table. */}
          <div
            className="recent-logs-card"
            style={
              {
                ...cardStyle,
                flex: isDesktop ? 1 : 'initial',
                minHeight: isDesktop ? 0 : 'auto',
                display: 'flex',
                flexDirection: 'column',
                '--sticky-header-bg': token.colorBgContainer,
              } as React.CSSProperties
            }
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexShrink: 0 }}>
               <span style={{ fontSize: 13, fontWeight: 600 }}>{t('logTime.recentlyLogged', { defaultValue: 'Recently Logged' })}</span>
               <span
                 style={{ fontSize: 12, color: token.colorPrimary, cursor: 'pointer' }}
                 onClick={() => navigate('/worklenz/time-entries')}
               >
                  {t('logTime.viewAll', { defaultValue: 'View All' })}
               </span>
            </div>

            <div
              className="recent-logs-scroll"
              style={{
                flex: isDesktop ? 1 : 'initial',
                minHeight: isDesktop ? 0 : 'auto',
                overflowY: isDesktop ? 'auto' : 'visible',
                position: 'relative',
              }}
            >
              <Table<IRecentTimeLog>
                dataSource={
                  recentLogsLoading
                    ? []
                    : filteredSortedLogs.slice((logCurrentPage - 1) * logPageSize, logCurrentPage * logPageSize)
                }
                rowKey={record => record.id}
                columns={logColumns}
                size="middle"
                pagination={false}
                tableLayout="fixed"
                loading={recentLogsLoading}
                locale={{
                   emptyText: (
                     <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                       <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{t('logTime.emptyTitle', { defaultValue: 'No time logged yet' })}</div>
                       <p style={{ opacity: 0.6, fontSize: 12, margin: '0 0 16px' }}>
                         {t('logTime.emptySubtitle', { defaultValue: 'Start logging time on your tasks to see your activity here.' })}
                       </p>
                       <Button
                         type="primary"
                         size="small"
                         onClick={() =>
                           quickEntryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                         }
                       >
                         {t('logTime.logTimeButton', { defaultValue: 'Log Time' })}
                       </Button>
                     </div>
                   ),
                }}
                onChange={(_pagination, filters) => {
                  setLogCurrentPage(1);
                  setSelectedLogProjectIds((filters.project as React.Key[]) || []);
                  setSelectedLogStatusNames((filters.status as React.Key[]) || []);
                  setSelectedLogPriorityNames((filters.priority as React.Key[]) || []);
                  setSelectedLogBillable((filters.billable as React.Key[]) || []);
                }}
              />
            </div>

            {filteredSortedLogs.length > logPageSize && (
              <div style={{ flexShrink: 0, marginTop: 12, textAlign: 'right', display: 'flex', justifyContent: 'flex-end' }}>
                <Pagination
                  current={logCurrentPage}
                  pageSize={logPageSize}
                  total={filteredSortedLogs.length}
                  onChange={setLogCurrentPage}
                  showSizeChanger={false}
                  size="small"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <HomeAddTaskModal
        open={addTaskOpen}
        defaultDate={null}
        onClose={() => {
          setAddTaskOpen(false);
          if (selProjectId) {
            taskTimeLogsApiService.getMyTasksInProject(selProjectId, taskSearch || undefined)
              .then(res => { if (res.done) setTasks(res.body as ITaskInProject[]); })
              .catch(() => {});
          }
        }}
      />
    </div>
  );
};

export default HomeLogTime;
