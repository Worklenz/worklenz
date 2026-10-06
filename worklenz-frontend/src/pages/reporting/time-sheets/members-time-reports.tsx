import { Card, Flex, theme } from '@/shared/antd-imports';
import MembersTimeSheet, {
  MembersTimeSheetRef,
} from '@/components/reporting/time-reports/sheets/MembersTimeSheet';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { useRef, useState } from 'react';
import { IRPTTimeTotals } from '@/types/reporting/reporting.types';
import TimeReportingRightHeader from './components/time-reporting-right-header/TimeReportingRightHeader';
import TimeReportPageHeader from '@/components/reporting/time-reports/page-header/TimeReportPageHeader';
import TotalTimeUtilization from '@/components/reporting/time-reports/total-time-utilization/total-time-utilization';
import { useAppSelector } from '@/hooks/useAppSelector';

const MembersTimeReports = () => {
  const { t } = useTranslation('time-report');
  const { token } = theme.useToken();
  const chartRef = useRef<MembersTimeSheetRef>(null);
  const [totals, setTotals] = useState<IRPTTimeTotals>({
    total_time_logs: '0',
    total_estimated_hours: '0',
    total_utilization: '0',
  });
  // Starts true so the stats cards and chart show a loading state instead of
  // a flash of zeroed-out values before the first fetch resolves.
  const [chartLoading, setChartLoading] = useState(true);
  const { dateRange } = useAppSelector(state => state.reportingReducer);
  const { utilizationVisible } = useAppSelector(state => state.timeReportsOverviewReducer);
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
    // height: '100%' (not minHeight) + the chart Card taking flex: 1 below is
    // the same pattern Home > Overview uses (HomeOverviewView.tsx) so the
    // page itself never grows past the viewport — only the chart's own box
    // scrolls when its content overflows, not the whole page.
    <Flex vertical style={{ height: '100%' }}>
      <div style={{ flexShrink: 0 }}>
        <TimeReportingRightHeader
          title={t('Members Time Sheet')}
          exportType={[{ key: 'png', label: 'PNG' }]}
          export={handleExport}
        />
      </div>

      {/* Utilization summary — cards only, no wrapping box */}
      {utilizationVisible && (
        <div style={{ flexShrink: 0 }}>
          <TotalTimeUtilization
            totals={totals}
            dateRange={dateRange}
            showToggleButton={false}
            loading={chartLoading}
          />
        </div>
      )}

      {/* Filters box — matches Projects > Recurring Tasks' compact filter bar */}
      <div
        style={{
          flexShrink: 0,
          marginBottom: 16,
          padding: '10px 12px',
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: 8,
          background: token.colorBgContainer,
        }}
      >
        <TimeReportPageHeader />
      </div>

      {/* Chart box — fills remaining height down to the bottom of the screen;
          only this box's body scrolls, not the whole page */}
      <Card
        style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
        styles={{
          body: {
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: 24,
          },
        }}
      >
        <MembersTimeSheet
          onTotalsUpdate={handleTotalsUpdate}
          onLoadingChange={setChartLoading}
          ref={chartRef}
        />
      </Card>
    </Flex>
  );
};

export default MembersTimeReports;

