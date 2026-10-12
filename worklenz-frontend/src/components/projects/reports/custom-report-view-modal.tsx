import { useTranslation } from 'react-i18next';
import { Button, DownloadOutlined, Flex, Modal, Tag } from '@/shared/antd-imports';

import { softwareReportsApiService } from '@/api/software-reports/software-reports.api.service';
import { useSoftwareReport } from '@/hooks/useSoftwareReport';
import { ICustomReport, ICustomReportData } from '@/types/project/softwareReports.types';
import { ReportError, ReportLoading } from './report-parts';
import { CustomReportVisual } from './custom-report-visual';
import { getFilterLabel, getGroupLabel, getMetricLabel, getSourceLabel } from './custom-report-config';

interface CustomReportViewModalProps {
  projectId: string;
  report: ICustomReport | null;
  onClose: () => void;
  onExport: (report: ICustomReport, data: ICustomReportData) => void;
}

export const CustomReportViewModal = ({
  projectId,
  report,
  onClose,
  onExport,
}: CustomReportViewModalProps) => {
  const { t } = useTranslation('project-view');
  const { data, isLoading, hasError, reload } = useSoftwareReport<ICustomReportData>(
    report ? `${projectId}:${report.id}` : null,
    () => softwareReportsApiService.getCustomReportData(projectId, report?.id ?? '')
  );
  const isCurrent = !!report && !isLoading;

  return (
    <Modal
      open={!!report}
      title={report?.name}
      onCancel={onClose}
      width={760}
      footer={
        <Flex justify="end" gap={8}>
          <Button
            icon={<DownloadOutlined />}
            disabled={!report || !data || !isCurrent}
            onClick={() => report && data && onExport(report, data)}
          >
            {t('customReportExportCsv', { defaultValue: 'Export CSV' })}
          </Button>
          <Button type="primary" onClick={onClose}>
            {t('customReportDone', { defaultValue: 'Done' })}
          </Button>
        </Flex>
      }
    >
      {report && (
        <Flex vertical gap={12}>
          <Flex gap={6} wrap="wrap">
            <Tag className="m-0">{getSourceLabel(t, report.source)}</Tag>
            <Tag className="m-0">{getMetricLabel(t, report.metric, report.source)}</Tag>
            <Tag className="m-0">
              {t('customReportGroupedBy', {
                defaultValue: 'Grouped by {{group}}',
                group: getGroupLabel(t, report.group_by).toLowerCase(),
              })}
            </Tag>
            {report.filter !== 'all' && <Tag className="m-0">{getFilterLabel(t, report.filter)}</Tag>}
          </Flex>
          {hasError && !isLoading ? (
            <ReportError onRetry={reload} />
          ) : !data || !isCurrent ? (
            <ReportLoading />
          ) : (
            <CustomReportVisual
              data={data}
              source={report.source}
              metric={report.metric}
              groupBy={report.group_by}
              visualization={report.visualization}
            />
          )}
        </Flex>
      )}
    </Modal>
  );
};
