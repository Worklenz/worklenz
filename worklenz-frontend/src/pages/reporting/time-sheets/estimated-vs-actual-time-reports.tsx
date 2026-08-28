import { Card, Flex, Segmented } from '@/shared/antd-imports';
import TimeReportPageHeader from '@/components/reporting/time-reports/page-header/TimeReportPageHeader';
import EstimatedVsActualTimeSheet, {
  EstimatedVsActualTimeSheetRef,
} from '@/components/reporting/time-reports/sheets/EstimatedVsActualTimeSheet';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import TimeReportingRightHeader from './components/time-reporting-right-header/TimeReportingRightHeader';
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
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              rowGap: 12,
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
            width: '100%',
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
