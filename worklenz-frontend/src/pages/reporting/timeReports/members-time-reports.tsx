import { Card, Flex } from 'antd';
import TimeReportPageHeader from '@/pages/reporting/timeReports/page-header/time-report-page-header';
import MembersTimeSheet, {
  MembersTimeSheetRef,
} from '@/pages/reporting/time-reports/members-time-sheet/members-time-sheet';
import TimeReportingRightHeader from './timeReportingRightHeader/TimeReportingRightHeader';
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

  return (
    <Flex vertical>
      <TimeReportingRightHeader
        title={t('Members Time Sheet')}
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
        <MembersTimeSheet ref={chartRef} />
      </Card>
    </Flex>
  );
};

export default MembersTimeReports;
