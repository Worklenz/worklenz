import { Card, Flex, Segmented } from 'antd';
import TimeReportPageHeader from '@/pages/reporting/timeReports/page-header/time-report-page-header';
import EstimatedVsActualTimeSheet, {
  EstimatedVsActualTimeSheetRef,
} from '@/pages/reporting/time-reports/estimated-vs-actual-time-sheet/estimated-vs-actual-time-sheet';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import TimeReportingRightHeader from './timeReportingRightHeader/TimeReportingRightHeader';
import { useState, useRef } from 'react';

const EstimatedVsActualTimeReports = () => {
  const { t } = useTranslation('time-report');
  const [type, setType] = useState('WORKING_DAYS');
  const chartRef = useRef<EstimatedVsActualTimeSheetRef>(null);

  useDocumentTitle('Reporting - Allocation');

  const handleExport = (type: string) => {
    if (type === 'png') {
      chartRef.current?.exportChart();
    }
  };

  return (
    <Flex vertical>
      <TimeReportingRightHeader
        title={t('estimatedVsActual')}
        exportType={[{ key: 'png', label: 'PNG' }]}
        export={handleExport}
      />

      <Card
        style={{ borderRadius: '4px' }}
        title={
          <div
            style={{
              padding: '16px 0',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <TimeReportPageHeader />
            <Segmented
              style={{ fontWeight: 500 }}
              options={[
                {
                  label: t('workingDays'),
                  value: 'WORKING_DAYS',
                },
                {
                  label: t('manDays'),
                  value: 'MAN_DAYS',
                },
              ]}
              onChange={value => setType(value)}
            />
          </div>
        }
        styles={{
          body: {
            maxWidth: 'calc(100vw - 220px)',
            overflowX: 'auto',
            padding: '16px',
          },
        }}
      >
        <EstimatedVsActualTimeSheet type={type} ref={chartRef} />
      </Card>
    </Flex>
  );
};

export default EstimatedVsActualTimeReports;
