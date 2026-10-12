import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Button, Flex, PlusOutlined, Segmented, Typography } from '@/shared/antd-imports';

import { SprintReportView } from '@/components/projects/reports/sprint-report-view';
import { FlowReportView } from '@/components/projects/reports/flow-report-view';
import { CycleTimeReportView } from '@/components/projects/reports/cycle-time-report-view';
import { CustomReportsSection } from '@/components/projects/reports/custom-reports-section';
import { CustomReportBuilderModal } from '@/components/projects/reports/custom-report-builder-modal';

/** Software-project Reports: sprint delivery, flow and cycle-time visibility, plus saved custom reports. */
export const ProjectViewReports = () => {
  const { t } = useTranslation('project-view');
  const { projectId } = useParams();
  const [activeReport, setActiveReport] = useState<ReportKey>('sprint');
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [customReportsRefreshKey, setCustomReportsRefreshKey] = useState(0);

  if (!projectId) return null;

  const reportOptions = [
    { value: 'sprint', label: t('reportsSprintTab', { defaultValue: 'Sprint' }) },
    { value: 'flow', label: t('reportsFlowTab', { defaultValue: 'Flow' }) },
    { value: 'cycle', label: t('reportsCycleTimeTab', { defaultValue: 'Cycle time' }) },
  ];

  const handleOpenBuilder = () => setIsBuilderOpen(true);
  const handleReportSaved = () => setCustomReportsRefreshKey(key => key + 1);

  return (
    <div className="flex flex-col gap-3">
      <Flex align="center" gap={12} wrap="wrap">
        <div className="min-w-0">
          <Typography.Title level={5} className="!m-0">
            {t('reportsTitle', { defaultValue: 'Project reports' })}
          </Typography.Title>
          <Typography.Text type="secondary" className="text-[13px]">
            {t('reportsSubtitle', { defaultValue: 'Delivery, flow and cycle-time visibility' })}
          </Typography.Text>
        </div>
        <Flex align="center" gap={8} wrap="wrap" className="ml-auto">
          <Segmented
            value={activeReport}
            options={reportOptions}
            onChange={value => setActiveReport(value as ReportKey)}
            aria-label={t('reportsViewSelector', { defaultValue: 'Report type' })}
          />
          <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleOpenBuilder}>
            {t('customReportCreate', { defaultValue: 'Create report' })}
          </Button>
        </Flex>
      </Flex>

      {activeReport === 'sprint' && <SprintReportView projectId={projectId} />}
      {activeReport === 'flow' && <FlowReportView projectId={projectId} />}
      {activeReport === 'cycle' && <CycleTimeReportView projectId={projectId} />}

      <CustomReportsSection
        projectId={projectId}
        refreshKey={customReportsRefreshKey}
        onCreate={handleOpenBuilder}
      />

      <CustomReportBuilderModal
        open={isBuilderOpen}
        projectId={projectId}
        onClose={() => setIsBuilderOpen(false)}
        onSaved={handleReportSaved}
      />
    </div>
  );
};

type ReportKey = 'sprint' | 'flow' | 'cycle';

export default ProjectViewReports;
