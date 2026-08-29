import React from 'react';
import { createPortal } from 'react-dom';
import { Typography, Flex, Button } from '@/shared/antd-imports';
import { PlusOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import {
  taskTimeLogsApiService,
  IMyTaskWithLogs,
  IMySummary,
  IRecentTimeLog,
} from '@/api/tasks/task-time-logs.api.service';
import { TimeEntriesSummaryBar } from '@/components/time-entries/TimeEntriesSummaryBar';
import { TimeEntriesFilters, DateFilter } from '@/components/time-entries/TimeEntriesFilters';
import { TimeEntriesTaskList } from '@/components/time-entries/TimeEntriesTaskList';
import { TimeEntriesLogTable, LogSortField } from '@/components/time-entries/TimeEntriesLogTable';
import { LogTimeModal } from '@/components/time-entries/LogTimeModal';
import TaskDrawer from '@components/task-drawer/task-drawer';
import apiClient from '@/api/api-client';
import { API_BASE_URL } from '@/shared/constants';
import PillToggle from '@/pages/home/PillToggle';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { decodeHtmlEntities } from '@/utils/html-entities';
import { useAppSelector } from '@/hooks/useAppSelector';
import './time-entries.css';

const { Title } = Typography;
const PAGE_SIZE = 20;

type ViewMode = 'flat' | 'grouped';

interface Project {
  id: string;
  name: string;
}

const TimeEntriesPage: React.FC = () => {
  const { t } = useTranslation('time-entries');
  const { socket } = useSocket();

  const [viewMode, setViewMode] = React.useState<ViewMode>('flat');

  // Grouped-by-task view state (unchanged legacy behavior)
  const [tasks, setTasks] = React.useState<IMyTaskWithLogs[]>([]);
  const [fallbackDate, setFallbackDate] = React.useState<string | null>(null);
  const [tasksTotal, setTasksTotal] = React.useState(0);
  const [tasksPage, setTasksPage] = React.useState(1);
  const [tasksLoading, setTasksLoading] = React.useState(false);

  // Flat log-entry view state (mirrors Home > Log Time's Recently Logged table)
  const [logs, setLogs] = React.useState<IRecentTimeLog[]>([]);
  const [logsTotal, setLogsTotal] = React.useState(0);
  const [logsPage, setLogsPage] = React.useState(1);
  const [logsLoading, setLogsLoading] = React.useState(false);
  // No column is tied to created_at anymore (the old Date column is now Due
  // Date, sorted on due_date) — start with no active sort indicator, while
  // the backend still defaults to most-recently-logged-first under the hood.
  const [logSortField, setLogSortField] = React.useState<LogSortField>(null);
  const [logSortOrder, setLogSortOrder] = React.useState<'asc' | 'desc'>('desc');

  const [summary, setSummary] = React.useState<IMySummary | null>(null);
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [summaryLoading, setSummaryLoading] = React.useState(false);

  const [dateFilter, setDateFilter] = React.useState<DateFilter>('today');
  const [dateRange, setDateRange] = React.useState<[string, string] | null>(null);
  const [projectId, setProjectId] = React.useState<string | undefined>(undefined);
  const [search, setSearch] = React.useState('');

  const [logTimeOpen, setLogTimeOpen] = React.useState(false);

  // Store original task names to restore if drawer closes without saving
  const originalTaskNamesRef = React.useRef<Map<string, string>>(new Map());

  const fetchTasks = React.useCallback(async (currentPage: number) => {
    setTasksLoading(true);
    try {
      const res = await taskTimeLogsApiService.getMyTasksWithLogs({
        date_filter: dateFilter,
        project_id: projectId,
        search: search || undefined,
        date_from: dateFilter === 'custom' && dateRange ? dateRange[0] : undefined,
        date_to: dateFilter === 'custom' && dateRange ? dateRange[1] : undefined,
        page: currentPage,
        page_size: PAGE_SIZE,
      });
      if (res.done) {
        const body = res.body as any;
        setTasks(body.tasks || []);
        setFallbackDate(body.fallback_date ?? null);
        setTasksTotal(body.total ?? 0);
      }
    } catch {
      setTasks([]);
      setTasksTotal(0);
    } finally {
      setTasksLoading(false);
    }
  }, [dateFilter, projectId, search, dateRange]);

  const fetchLogs = React.useCallback(async (currentPage: number) => {
    setLogsLoading(true);
    try {
      const res = await taskTimeLogsApiService.getMyTimeLogEntries({
        date_filter: dateFilter,
        project_id: projectId,
        search: search || undefined,
        date_from: dateFilter === 'custom' && dateRange ? dateRange[0] : undefined,
        date_to: dateFilter === 'custom' && dateRange ? dateRange[1] : undefined,
        sort_field: logSortField || undefined,
        sort_order: logSortOrder,
        page: currentPage,
        page_size: PAGE_SIZE,
      });
      if (res.done) {
        setLogs(res.body.logs || []);
        setLogsTotal(res.body.total ?? 0);
      }
    } catch {
      setLogs([]);
      setLogsTotal(0);
    } finally {
      setLogsLoading(false);
    }
  }, [dateFilter, projectId, search, dateRange, logSortField, logSortOrder]);

  const fetchSummary = React.useCallback(async () => {
    setSummaryLoading(true);
    try {
      const res = await taskTimeLogsApiService.getMySummary();
      if (res.done) setSummary(res.body as IMySummary);
    } catch {
      // ignore
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const fetchProjects = React.useCallback(async () => {
    try {
      const res = await apiClient.get(`${API_BASE_URL}/projects/my-task-projects`);
      const list: any[] = res.data?.body || [];
      setProjects(list.map((p: any) => ({ id: p.id, name: p.name })));
    } catch {
      // ignore
    }
  }, []);

  React.useEffect(() => {
    if (viewMode === 'grouped') {
      setTasksPage(1);
      fetchTasks(1);
    } else {
      setLogsPage(1);
      fetchLogs(1);
    }
  }, [viewMode, fetchTasks, fetchLogs]);

  React.useEffect(() => {
    fetchSummary();
    fetchProjects();
  }, [fetchSummary, fetchProjects]);

  const handleTasksPageChange = (newPage: number) => {
    setTasksPage(newPage);
    fetchTasks(newPage);
  };

  const handleLogsPageChange = (newPage: number) => {
    setLogsPage(newPage);
    fetchLogs(newPage);
  };

  const handleLogSortChange = (field: LogSortField) => {
    setLogsPage(1);
    setLogSortOrder(prev => (logSortField === field && prev === 'asc' ? 'desc' : 'asc'));
    setLogSortField(field);
  };

  const handleEntryChange = () => {
    fetchSummary();
    fetchTasks(tasksPage);
  };

  const handleLogTimeSuccess = () => {
    fetchSummary();
    if (viewMode === 'grouped') fetchTasks(tasksPage);
    else fetchLogs(logsPage);
  };

  const handleDateFilterChange = (filter: DateFilter) => {
    setDateFilter(filter);
    if (filter !== 'custom') setDateRange(null);
  };

  // Real-time task name updates: Listen to socket events for changes from other sources
  React.useEffect(() => {
    if (!socket) return;

    const handleTaskNameChange = (data: { id: string; name: string }) => {
      if (!data?.id || !data.name) return;

      const decodedName = decodeHtmlEntities(data.name);

      // Update grouped view (tasks list)
      setTasks(prevTasks =>
        prevTasks.map(task =>
          task.task_id === data.id ? { ...task, task_name: decodedName } : task
        )
      );

      // Update flat view (logs list)
      setLogs(prevLogs =>
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
  React.useEffect(() => {
    if (showTaskDrawer && selectedTaskId) {
      // Find the original task name from our local state
      const taskInList = tasks.find(t => t.task_id === selectedTaskId);
      const logInList = logs.find(l => l.task_id === selectedTaskId);
      const originalName = taskInList?.task_name || logInList?.task_name;
      
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
          setTasks(prevTasks =>
            prevTasks.map(task =>
              task.task_id === selectedTaskId ? { ...task, task_name: originalName } : task
            )
          );
          
          setLogs(prevLogs =>
            prevLogs.map(log =>
              log.task_id === selectedTaskId ? { ...log, task_name: originalName } : log
            )
          );
        }
        
        // Clean up the stored original name
        originalTaskNamesRef.current.delete(selectedTaskId);
      }
    }
  }, [showTaskDrawer, selectedTaskId, tasks, logs, taskFormViewModel, taskManagementEntities]);

  // Real-time sync: Update list as user types, but show original name if empty
  const currentTaskName = React.useMemo(() => {
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

  React.useEffect(() => {
    if (!selectedTaskId || !currentTaskName) return;

    // If name is empty, show the original name
    if (currentTaskName === '__EMPTY__') {
      const originalName = originalTaskNamesRef.current.get(selectedTaskId);
      if (originalName) {
        setTasks(prevTasks =>
          prevTasks.map(task =>
            task.task_id === selectedTaskId ? { ...task, task_name: originalName } : task
          )
        );
        
        setLogs(prevLogs =>
          prevLogs.map(log =>
            log.task_id === selectedTaskId ? { ...log, task_name: originalName } : log
          )
        );
      }
      return;
    }

    // Normal case: update with the current name
    const decodedName = decodeHtmlEntities(currentTaskName);

    setTasks(prevTasks =>
      prevTasks.map(task =>
        task.task_id === selectedTaskId ? { ...task, task_name: decodedName } : task
      )
    );

    setLogs(prevLogs =>
      prevLogs.map(log =>
        log.task_id === selectedTaskId ? { ...log, task_name: decodedName } : log
      )
    );
  }, [selectedTaskId, currentTaskName]);

  return (
    <div>
      <Flex align="center" justify="space-between" style={{ marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0 }}>
          {t('pageTitle', { defaultValue: 'Time Entries' })}
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setLogTimeOpen(true)}>
          {t('quickLogButton', { defaultValue: 'Log time' })}
        </Button>
      </Flex>

      <TimeEntriesSummaryBar summary={summary} loading={summaryLoading} />

      <div className="time-entries-filters-row" style={{ marginBottom: 16 }}>
        <TimeEntriesFilters
          dateFilter={dateFilter}
          onDateFilterChange={handleDateFilterChange}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          projectId={projectId}
          onProjectChange={setProjectId}
          projects={projects}
          onSearch={setSearch}
        />

        <PillToggle<ViewMode>
          value={viewMode}
          onChange={setViewMode}
          options={[
            { value: 'flat', label: t('viewFlat', { defaultValue: 'Flat' }) },
            { value: 'grouped', label: t('viewGrouped', { defaultValue: 'Grouped by Task' }) },
          ]}
        />
      </div>

      {viewMode === 'flat' ? (
        <TimeEntriesLogTable
          logs={logs}
          loading={logsLoading}
          total={logsTotal}
          page={logsPage}
          pageSize={PAGE_SIZE}
          onPageChange={handleLogsPageChange}
          sortField={logSortField}
          sortOrder={logSortOrder}
          onSortChange={handleLogSortChange}
          onLogTime={() => setLogTimeOpen(true)}
        />
      ) : (
        <TimeEntriesTaskList
          tasks={tasks}
          loading={tasksLoading}
          fallbackDate={fallbackDate}
          onEntryChange={handleEntryChange}
          onLogTime={() => setLogTimeOpen(true)}
          total={tasksTotal}
          page={tasksPage}
          pageSize={PAGE_SIZE}
          onPageChange={handleTasksPageChange}
        />
      )}

      <LogTimeModal
        open={logTimeOpen}
        onClose={() => setLogTimeOpen(false)}
        onSuccess={handleLogTimeSuccess}
      />

      {createPortal(<TaskDrawer />, document.body, 'time-entries-task-drawer')}
    </div>
  );
};

export default TimeEntriesPage;
