import { Card, Flex } from '@/shared/antd-imports';
import TimeReportPageHeader from '@/components/reporting/time-reports/page-header/TimeReportPageHeader';
import MembersTimeSheet, {
  MembersTimeSheetRef,
} from '@/pages/reporting/time-reports/members-time-sheet/members-time-sheet';
import TimeReportingRightHeader from '@/components/reporting/time-reports/right-header/TimeReportingRightHeader';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { useRef } from 'react';

const MembersTimeReports = () => {
  const { t } = useTranslation('time-report');
  const chartRef = useRef<MembersTimeSheetRef>(null);

  useDocumentTitle('Reporting - Allocation');

  const handleExport = (type: string) => {
    if (type === 'png') {
      chartRef.current?.exportChart();
    }
  };

  const handleTotalsUpdate = (totals: {
    total_time_logs: string;
    total_estimated_hours: string;
    total_utilization: string;
  }) => {
    // Handle totals update if needed
    // This could be used to display totals in the UI or pass to parent components
    console.log('Totals updated:', totals);
  };

  return (
    <Flex vertical>
      <TimeReportingRightHeader
        title={t('membersTimeSheet')}
        exportType={[{ key: 'png', label: 'PNG' }]}
        export={handleExport}
      />

      <Card
        style={{ borderRadius: '4px' }}
        title={
          <div style={{ padding: '16px 0' }}>
            <TimeReportPageHeader />
          </div>
        }
        styles={{
          body: {
            maxHeight: 'calc(100vh - 300px)',
            overflowY: 'auto',
            padding: '16px',
          },
        }}
      >
        <MembersTimeSheet ref={chartRef} onTotalsUpdate={handleTotalsUpdate} />
      </Card>
    </Flex>
  );
};

export default MembersTimeReports;
