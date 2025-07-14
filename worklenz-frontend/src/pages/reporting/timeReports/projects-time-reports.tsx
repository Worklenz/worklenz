import { Card, Flex } from 'antd';
import TimeReportPageHeader from '@/pages/reporting/timeReports/page-header/time-report-page-header';
import ProjectTimeSheetChart, {
  ProjectTimeSheetChartRef,
} from '@/pages/reporting/time-reports/project-time-sheet/project-time-sheet-chart';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import TimeReportingRightHeader from './timeReportingRightHeader/TimeReportingRightHeader';
import { useRef } from 'react';

const ProjectsTimeReports = () => {
  const { t } = useTranslation('time-report');
  const chartRef = useRef<ProjectTimeSheetChartRef>(null);

  useDocumentTitle('Reporting - Allocation');

  const handleExport = (type: string) => {
    if (type === 'png') {
      chartRef.current?.exportChart();
    }
  };

  return (
    <Flex vertical>
      <TimeReportingRightHeader
        title={t('projectsTimeSheet')}
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
        <ProjectTimeSheetChart ref={chartRef} />
      </Card>
    </Flex>
  );
};

export default ProjectsTimeReports;
