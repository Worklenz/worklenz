import React from 'react';
import { createPortal } from 'react-dom';
import { Typography, Flex, theme } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import {
  recurringTasksListApiService,
  IRecurringTaskRow,
} from '@/api/tasks/recurring-tasks-list.api.service';
import { RecurringTasksFilters, RecurringTasksFiltersValue } from '@/components/recurring-tasks/RecurringTasksFilters';
import { RecurringTasksTable, RecurringTasksSortField } from '@/components/recurring-tasks/RecurringTasksTable';
import TaskDrawer from '@components/task-drawer/task-drawer';
import { useAuthService } from '@/hooks/useAuth';
import { hasBusinessFeatureAccess } from '@/ee/utils/subscription-utils';
import { UpgradeOverlayCard, useUpgradeMaskBackground } from '@/components/upgrade/FeatureUpgradePreview';
import { IRecurringMode } from '@/types/tasks/task-recurring-schedule';

const { Title } = Typography;

const INITIAL_PAGE_SIZE = 20;

const RecurringTasksPage: React.FC = () => {
  const { t } = useTranslation('recurring-tasks');
  const { token } = theme.useToken();

  const auth = useAuthService();
  const hasBusinessAccess = hasBusinessFeatureAccess(auth.getCurrentSession());
  const maskBackground = useUpgradeMaskBackground();

  const [tasks, setTasks] = React.useState<IRecurringTaskRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(INITIAL_PAGE_SIZE);
  const [loading, setLoading] = React.useState(false);
  const [filters, setFilters] = React.useState<RecurringTasksFiltersValue>({});
  const [sortField, setSortField] = React.useState<RecurringTasksSortField | null>(null);
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>('asc');
  const [selectedPriorityIds, setSelectedPriorityIds] = React.useState<string[]>([]);

  const fetchTasks = React.useCallback(
    async (currentPage: number, currentPageSize: number) => {
      if (!hasBusinessAccess) return;
      setLoading(true);
      try {
        const res = await recurringTasksListApiService.getRecurringTasks({
          index: currentPage,
          size: currentPageSize,
          project_id: filters.projectIds?.length ? filters.projectIds.join(',') : undefined,
          team_member_id: filters.assigneeIds?.length ? filters.assigneeIds.join(',') : undefined,
          recurring_mode: filters.recurringModes?.length ? filters.recurringModes.join(',') : undefined,
          schedule_type: filters.scheduleTypes?.length ? filters.scheduleTypes.join(',') : undefined,
          priority_id: selectedPriorityIds.length ? selectedPriorityIds.join(',') : undefined,
          field: sortField || undefined,
          order: sortOrder,
        });
        if (res.done) {
          setTasks(res.body.data || []);
          setTotal(res.body.total || 0);
        }
      } catch {
        setTasks([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    },
    [filters, selectedPriorityIds, sortField, sortOrder, hasBusinessAccess]
  );

  React.useEffect(() => {
    setPage(1);
    fetchTasks(1, pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, selectedPriorityIds, sortField, sortOrder, hasBusinessAccess]);

  const handlePageChange = (newPage: number, newPageSize: number) => {
    setPage(newPage);
    setPageSize(newPageSize);
    fetchTasks(newPage, newPageSize);
  };

  const handleSortChange = (field: RecurringTasksSortField) => {
    setSortOrder(prev => (sortField === field && prev === 'asc' ? 'desc' : 'asc'));
    setSortField(field);
  };

  // Shares state with the top filter bar's Recur Type dropdown so both controls
  // stay in sync rather than tracking the filter separately.
  const handleRecurringModeFilterChange = (values: string[]) => {
    setFilters(prev => ({ ...prev, recurringModes: values as IRecurringMode[] }));
  };

  return (
    <div>
      <Flex vertical style={{ marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0 }}>
          {t('pageTitle', { defaultValue: 'Recurring Tasks' })}
        </Title>
        <Typography.Text type="secondary">
          {t('pageSubtitle', {
            defaultValue: 'Automated repeating tasks across all teams and projects',
          })}
        </Typography.Text>
      </Flex>

      <div style={{ position: 'relative' }}>
        <div
          style={
            !hasBusinessAccess
              ? { filter: 'blur(2px)', pointerEvents: 'none', userSelect: 'none' }
              : undefined
          }
        >
          <div
            style={{
              marginBottom: 16,
              padding: '10px 12px',
              border: `1px solid ${token.colorBorderSecondary}`,
              borderRadius: 8,
              background: token.colorBgContainer,
            }}
          >
            <RecurringTasksFilters value={filters} onChange={setFilters} />
          </div>

          <RecurringTasksTable
            tasks={tasks}
            loading={loading}
            total={total}
            page={page}
            pageSize={pageSize}
            onPageChange={handlePageChange}
            sortField={sortField}
            sortOrder={sortOrder}
            onSortChange={handleSortChange}
            selectedPriorityIds={selectedPriorityIds}
            onPriorityFilterChange={setSelectedPriorityIds}
            selectedRecurringModes={filters.recurringModes || []}
            onRecurringModeFilterChange={handleRecurringModeFilterChange}
          />
        </div>

        {!hasBusinessAccess && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: maskBackground,
              padding: 24,
            }}
          >
            <UpgradeOverlayCard
              title={t('pageTitle', { defaultValue: 'Recurring Tasks' })}
              description={t('upgradeDescription', {
                defaultValue:
                  'Automate repetitive work across your projects. Available on the Business plan.',
              })}
              features={[
                t('upgradeFeature1', { defaultValue: 'Recurring task schedules across all projects' }),
                t('upgradeFeature2', { defaultValue: 'Auto-create tasks or change status on a schedule' }),
                t('upgradeFeature3', { defaultValue: 'Filter by project, assignee, and recurrence' }),
              ]}
            />
          </div>
        )}
      </div>

      {createPortal(<TaskDrawer />, document.body, 'recurring-tasks-task-drawer')}
    </div>
  );
};

export default RecurringTasksPage;
