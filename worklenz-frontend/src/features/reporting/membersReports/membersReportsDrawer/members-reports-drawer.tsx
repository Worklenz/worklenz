import { Drawer, Typography, Flex, Button, Space, Dropdown } from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { toggleMembersReportsDrawer } from '../membersReportsSlice';
import { DownOutlined } from '@/shared/antd-imports';
import MembersReportsDrawerTabs from './members-reports-drawer-tabs';
import { useTranslation } from 'react-i18next';
import MembersOverviewTasksStatsDrawer from './overviewTab/members-overview-tasks-stats-drawer/members-overview-tasks-stats-drawer';
import MembersOverviewProjectsStatsDrawer from './overviewTab/members-overview-projects-stats-drawer/members-overview-projects-stats-drawer';
import TimeWiseFilter from '@/components/reporting/time-wise-filter';
import { useState } from 'react';
import { useAuthService } from '@/hooks/useAuth';
import { reportingExportApiService } from '@/api/reporting/reporting-export.api.service';
import logger from '@/utils/errorLogger';

type MembersReportsDrawerProps = {
  memberId: string | null;
};

const MembersReportsDrawer = ({ memberId }: MembersReportsDrawerProps) => {
  const { t } = useTranslation('reporting-members-drawer');
  const dispatch = useAppDispatch();
  const currentSession = useAuthService().getCurrentSession();
  const [exporting, setExporting] = useState<boolean>(false);

  const isDrawerOpen = useAppSelector(
    state => state.membersReportsReducer.isMembersReportsDrawerOpen
  );
  const { membersList, archived } = useAppSelector(state => state.membersReportsReducer);
  const activeTab = useAppSelector(state => state.membersReportsReducer.activeTab);
  const { duration, dateRange } = useAppSelector(state => state.reportingReducer);

  const selectedMember = membersList?.find(member => member.id === memberId);

  const handleClose = () => {
    dispatch(toggleMembersReportsDrawer());
  };

  const exportTimeLogs = () => {
    if (!memberId || !currentSession?.team_id) return;
    try {
      setExporting(true);
      const body = {
        team_member_id: memberId,
        team_id: currentSession?.team_id as string,
        duration: duration,
        date_range: dateRange,
        archived: archived,
        member_name: selectedMember?.name,
        team_name: currentSession?.team_name,
      };
      reportingExportApiService.exportMemberTimeLogs(body);
    } catch (e) {
      logger.error('exportTimeLogs', e);
    } finally {
      setExporting(false);
    }
  };

  const exportActivityLogs = () => {
    if (!memberId || !currentSession?.team_id) return;
    try {
      setExporting(true);
      const body = {
        team_member_id: memberId,
        team_id: currentSession?.team_id as string,
        duration: duration,
        date_range: dateRange,
        member_name: selectedMember?.name,
        team_name: currentSession?.team_name,
        archived: archived,
      };
      reportingExportApiService.exportMemberActivityLogs(body);
    } catch (e) {
      logger.error('exportActivityLogs', e);
    } finally {
      setExporting(false);
    }
  };

  const exportTasks = () => {
    if (!memberId || !currentSession?.team_id) return;
    try {
      setExporting(true);
      const additionalBody = {
        duration: duration,
        date_range: dateRange,
        only_single_member: true,
        archived,
      };
      reportingExportApiService.exportMemberTasks(
        memberId,
        selectedMember?.name,
        currentSession?.team_name,
        additionalBody
      );
    } catch (e) {
      logger.error('exportTasks', e);
    } finally {
      setExporting(false);
    }
  };

  const handleExport = (key: string) => {
    switch (key) {
      case '1': // Time Logs
        exportTimeLogs();
        break;
      case '2': // Activity Logs
        exportActivityLogs();
        break;
      case '3': // Tasks
        exportTasks();
        break;
      default:
        break;
    }
  };

  return (
    <Drawer
      open={isDrawerOpen}
      onClose={handleClose}
      width={900}
      destroyOnClose
      title={
        selectedMember && (
          <Flex align="center" justify="space-between">
            <Flex gap={8} align="center" style={{ fontWeight: 500 }}>
              <Typography.Text>{selectedMember.name}</Typography.Text>
            </Flex>

            <Space>
              <TimeWiseFilter />
              <Dropdown
                menu={{
                  items: [
                    { key: '1', label: t('timeLogsButton') },
                    { key: '2', label: t('activityLogsButton') },
                    { key: '3', label: t('tasksButton') },
                  ],
                  onClick: ({ key }) => handleExport(key),
                }}
              >
                <Button
                  type="primary"
                  loading={exporting}
                  icon={<DownOutlined />}
                  iconPosition="end"
                >
                  {t('exportButton')}
                </Button>
              </Dropdown>
            </Space>
          </Flex>
        )
      }
    >
      {selectedMember && <MembersReportsDrawerTabs memberId={selectedMember.id} />}
      {selectedMember && <MembersOverviewTasksStatsDrawer memberId={selectedMember.id} />}
      {selectedMember && <MembersOverviewProjectsStatsDrawer memberId={selectedMember.id} />}
    </Drawer>
  );
};

export default MembersReportsDrawer;
