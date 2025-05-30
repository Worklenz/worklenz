import { Card, Flex } from 'antd';
import TimeReportPageHeader from '@/pages/reporting/timeReports/page-header/time-report-page-header';
import MembersTimeSheet, { MembersTimeSheetRef } from '@/pages/reporting/time-reports/members-time-sheet/members-time-sheet';
import TimeReportingRightHeader from './timeReportingRightHeader/TimeReportingRightHeader';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { useRef, useState } from 'react';
import TotalTimeUtilization from './total-time-utilization/total-time-utilization';
import { IRPTTimeTotals } from '@/types/reporting/reporting.types';

const MembersTimeReports = () => {
  const { t } = useTranslation('time-report');
  const chartRef = useRef<MembersTimeSheetRef>(null);
  const [totals, setTotals] = useState<IRPTTimeTotals>({
    total_time_logs: "0",
    total_estimated_hours: "0",
    total_utilization: "0",
  });
  useDocumentTitle('Reporting - Allocation');

  const handleExport = (type: string) => {
    if (type === 'png') {
      chartRef.current?.exportChart();
    }
  };

  const handleTotalsUpdate = (newTotals: IRPTTimeTotals) => {
    setTotals(newTotals);
  };

  return (
    <Flex vertical>
      <TimeReportingRightHeader
        title={t('Members Time Sheet')}
        exportType={[{ key: 'png', label: 'PNG' }]}
        export={handleExport}
      />
      <TotalTimeUtilization totals={totals} />
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
        <MembersTimeSheet onTotalsUpdate={handleTotalsUpdate} ref={chartRef} />
      </Card>
    </Flex>
  );
};

export default MembersTimeReports;
