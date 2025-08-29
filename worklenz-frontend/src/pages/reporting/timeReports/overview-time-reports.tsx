import React from 'react';
import TimeReportPageHeader from '@/components/reporting/time-reports/page-header/TimeReportPageHeader';
import { Flex } from '@/shared/antd-imports';
import TimeSheetTable from '@/components/reporting/time-reports/sheets/TimeSheetTable';
import TimeReportingRightHeader from '@/components/reporting/time-reports/right-header/TimeReportingRightHeader';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { useAppSelector } from '@/hooks/useAppSelector';
import { reportingExportApiService } from '@/api/reporting/reporting-export.api.service';
import logger from '@/utils/errorLogger';

const OverviewTimeReports: React.FC = () => {
  const { t } = useTranslation('time-report');

  const {
    teams,
    loadingTeams,
    categories,
    loadingCategories,
    projects: filterProjects,
    loadingProjects,
    billable,
    archived,
  } = useAppSelector(state => state.timeReportsOverviewReducer);
  const { duration, dateRange } = useAppSelector(state => state.reportingReducer);

  useDocumentTitle('Reporting - Allocation');

  const exportFn = async () => {
    try {
      const selectedTeams = teams.filter(team => team.selected);
      const selectedProjects = filterProjects.filter(project => project.selected);
      const selectedCategories = categories.filter(category => category.selected);

      await reportingExportApiService.exportAllocation(
        archived,
        selectedTeams.map(t => t.id) as string[],
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

  return (
    <Flex vertical>
      <TimeReportingRightHeader
        title={t('timeSheet')}
        exportType={[{ key: 'excel', label: 'Excel' }]}
        export={exportFn}
      />

      <div>
        <TimeReportPageHeader />
      </div>
      <div style={{ marginTop: '1rem' }}>
        <TimeSheetTable />
      </div>
    </Flex>
  );
};

export default OverviewTimeReports;
