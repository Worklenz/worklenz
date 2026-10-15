import { useEffect, useMemo } from 'react';
import { Flex, Typography } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { useAuthService } from '@/hooks/useAuth';
import AllTasksReportsFilters from './components/all-tasks-reports-filters/all-tasks-reports-filters';
import AllTasksReportsTable from './components/all-tasks-reports-table/all-tasks-reports-table';
import AllTasksStatsCards from './components/all-tasks-stats-cards/all-tasks-stats-cards';
import {
  fetchAllTasks,
  fetchAllTasksTeams,
} from '@/features/reporting/allTasksReports/all-tasks-reports-slice';

const AllTasksReports = () => {
  const { t } = useTranslation('reporting-all-tasks');
  const dispatch = useAppDispatch();
  useDocumentTitle('Reporting - All Tasks');
  const authService = useAuthService();
  const currentSession = useMemo(() => authService.getCurrentSession(), [authService]);

  // Fetch teams first, then fetch tasks only after teams are loaded
  // This prevents the race condition where fetchAllTasks fires with an empty
  // teams array (state.teams = []), causing the backend to fall back to the
  // default team instead of querying all teams.
  useEffect(() => {
    dispatch(fetchAllTasksTeams()).then(() => {
      dispatch(fetchAllTasks());
    });
  }, [dispatch, currentSession?.team_id]);

  return (
    // Fills the reporting layout (viewport - top bar - content padding) so only the table scrolls.
    <Flex vertical gap={16} style={{ height: 'calc(100vh - 52px - 48px)', overflow: 'hidden' }}>
      <Flex vertical>
        <Typography.Title level={3} className="!mb-0 !mt-1">
          {t('pageTitle', { defaultValue: 'All Tasks' })}
        </Typography.Title>
        <Typography.Text type="secondary">
          {t('pageSubtitle', {
            defaultValue: 'Browse, filter and export every task across your teams and projects.',
          })}
        </Typography.Text>
      </Flex>

      <AllTasksStatsCards />

      <AllTasksReportsFilters />

      <AllTasksReportsTable />
    </Flex>
  );
};

export default AllTasksReports;
