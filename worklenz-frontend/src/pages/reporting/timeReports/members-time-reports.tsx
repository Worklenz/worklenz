import { Card, Flex } from '@/shared/antd-imports';
import MembersTimeSheet, {
  MembersTimeSheetRef,
} from '@/components/reporting/time-reports/sheets/MembersTimeSheet';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { useRef, useState } from 'react';
import { IRPTTimeTotals } from '@/types/reporting/reporting.types';
import TimeReportingRightHeader from '@/components/reporting/time-reports/right-header/TimeReportingRightHeader';
import TimeReportPageHeader from '@/components/reporting/time-reports/page-header/TimeReportPageHeader';
import TotalTimeUtilization from '@/components/reporting/time-reports/total-time-utilization/total-time-utilization';
import { useAppSelector } from '@/hooks/useAppSelector';

const MembersTimeReports = () => {
  const { t } = useTranslation('time-report');
  const chartRef = useRef<MembersTimeSheetRef>(null);
  const [totals, setTotals] = useState<IRPTTimeTotals>({
    total_time_logs: '0',
    total_estimated_hours: '0',
    total_utilization: '0',
  });
  const { dateRange } = useAppSelector(state => state.reportingReducer);
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
      <TotalTimeUtilization totals={totals} dateRange={dateRange} />
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
