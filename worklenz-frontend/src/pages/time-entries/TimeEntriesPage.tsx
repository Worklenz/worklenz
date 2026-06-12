import React from 'react';
import { createPortal } from 'react-dom';
import { Typography, Flex, Button } from '@/shared/antd-imports';
import { PlusOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { taskTimeLogsApiService, IMyTaskWithLogs, IMySummary } from '@/api/tasks/task-time-logs.api.service';
import { TimeEntriesSummaryBar } from '@/components/time-entries/TimeEntriesSummaryBar';
import { TimeEntriesFilters, DateFilter } from '@/components/time-entries/TimeEntriesFilters';
import { TimeEntriesTaskList } from '@/components/time-entries/TimeEntriesTaskList';
import { LogTimeModal } from '@/components/time-entries/LogTimeModal';
import TaskDrawer from '@components/task-drawer/task-drawer';
import apiClient from '@/api/api-client';
import { API_BASE_URL } from '@/shared/constants';

const { Title } = Typography;
const PAGE_SIZE = 20;

interface Project {
  id: string;
  name: string;
}

const TimeEntriesPage: React.FC = () => {
  const { t } = useTranslation('time-entries');

  const [tasks, setTasks] = React.useState<IMyTaskWithLogs[]>([]);
  const [summary, setSummary] = React.useState<IMySummary | null>(null);
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [fallbackDate, setFallbackDate] = React.useState<string | null>(null);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);

  const [tasksLoading, setTasksLoading] = React.useState(false);
  const [summaryLoading, setSummaryLoading] = React.useState(false);

  const [dateFilter, setDateFilter] = React.useState<DateFilter>('today');
  const [dateRange, setDateRange] = React.useState<[string, string] | null>(null);
  const [projectId, setProjectId] = React.useState<string | undefined>(undefined);
  const [search, setSearch] = React.useState('');

  const [logTimeOpen, setLogTimeOpen] = React.useState(false);

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
        setTotal(body.total ?? 0);
      }
    } catch {
      setTasks([]);
      setTotal(0);
    } finally {
      setTasksLoading(false);
    }
  }, [dateFilter, projectId, search, dateRange]);

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
    setPage(1);
    fetchTasks(1);
  }, [fetchTasks]);

  React.useEffect(() => {
    fetchSummary();
    fetchProjects();
  }, [fetchSummary, fetchProjects]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchTasks(newPage);
  };

  const handleEntryChange = () => {
    fetchSummary();
    fetchTasks(page);
  };

  const handleLogTimeSuccess = () => {
    fetchSummary();
    fetchTasks(page);
  };

  const handleDateFilterChange = (filter: DateFilter) => {
    setDateFilter(filter);
    if (filter !== 'custom') setDateRange(null);
  };

  return (
    <div style={{ padding: '24px', maxWidth: 1100, margin: '0 auto' }}>
      <Flex align="center" justify="space-between" style={{ marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0 }}>
          {t('pageTitle', { defaultValue: 'Time Entries' })}
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setLogTimeOpen(true)}>
          {t('quickLogButton', { defaultValue: 'Log time' })}
        </Button>
      </Flex>

      <TimeEntriesSummaryBar summary={summary} loading={summaryLoading} />

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

      <TimeEntriesTaskList
        tasks={tasks}
        loading={tasksLoading}
        fallbackDate={fallbackDate}
        onEntryChange={handleEntryChange}
        onLogTime={() => setLogTimeOpen(true)}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={handlePageChange}
      />

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
