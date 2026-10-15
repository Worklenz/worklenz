import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Dropdown, Flex, Typography } from '@/shared/antd-imports';
import { DownOutlined } from '@/shared/antd-imports';
import CustomPageHeader from '@/components/reporting/common/CustomPageHeader';
import TimeWiseFilter from '@/components/reporting/time-wise-filter';
import TimeSheetTable from '@/components/reporting/time-reports/sheets/TimeSheetTable';
import TimeSheetFilterPanel from './components/time-sheet-filter-panel/TimeSheetFilterPanel';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { useAppSelector } from '@/hooks/useAppSelector';
import { reportingExportApiService } from '@/api/reporting/reporting-export.api.service';
import logger from '@/utils/errorLogger';

const OverviewTimeReports: React.FC = () => {
  const { t } = useTranslation('time-report');

  const {
    teams,
    projects: filterProjects,
    billable,
    archived,
  } = useAppSelector(state => state.timeReportsOverviewReducer);
  const { duration, dateRange } = useAppSelector(state => state.reportingReducer);

  useDocumentTitle('Reporting - Allocation');

  const exportFn = async () => {
    try {
      const selectedTeams = teams.filter(team => team.selected);
      const selectedProjects = filterProjects.filter(project => project.selected);

      await reportingExportApiService.exportAllocation(
        archived,
        selectedTeams.map(team => team.id) as string[],
        selectedProjects.map(project => project.id) as string[],
        duration,
        dateRange,
        billable.billable,
        billable.nonBillable
      );
    } catch (e) {
      logger.error('Error exporting allocation', e);
    }
  };

  const exportItems = [{ key: 'excel', label: 'Excel', onClick: exportFn }];

  return (
    // Fills the reporting layout (viewport - top bar - content padding) so only the table scrolls.
    <Flex vertical gap={16} style={{ height: 'calc(100vh - 52px - 48px)', overflow: 'hidden' }}>
      <Flex align="flex-end" justify="space-between" gap={12} wrap="wrap">
        <Flex vertical gap={4}>
          <CustomPageHeader title={t('timeSheet', { defaultValue: 'Time Sheet' })} style={{ padding: 0 }} />
          <Typography.Text type="secondary">
            {t('timeSheetSubtitle', {
              defaultValue:
                'See how much time each team member logged on every project for the selected period.',
            })}
          </Typography.Text>
        </Flex>
        <Flex gap={8} wrap="wrap" align="center" justify="flex-end">
          <TimeWiseFilter isPrimary />
          <TimeSheetFilterPanel />
          <Dropdown menu={{ items: exportItems }}>
            <Button icon={<DownOutlined />} iconPosition="end">
              {t('export', { defaultValue: 'Export' })}
            </Button>
          </Dropdown>
        </Flex>
      </Flex>
      <TimeSheetTable />
    </Flex>
  );
};

export default OverviewTimeReports;
