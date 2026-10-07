import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  DeleteOutlined,
  DownloadOutlined,
  Empty,
  Flex,
  PlusOutlined,
  Popconfirm,
  Table,
  Tooltip,
  Typography,
  theme,
} from '@/shared/antd-imports';
import type { TableColumnsType } from '@/shared/antd-imports';

import { softwareReportsApiService } from '@/api/software-reports/software-reports.api.service';
import { useAuthService } from '@/hooks/useAuth';
import { useSoftwareReport } from '@/hooks/useSoftwareReport';
import alertService from '@/services/alerts/alertService';
import { ICustomReport, ICustomReportData } from '@/types/project/softwareReports.types';
import { isAnnouncedApiError } from '@/components/projects/releases/release-utils';
import { ReportError, ReportPanel } from './report-parts';
import { CustomReportViewModal } from './custom-report-view-modal';
import {
  downloadReportCsv,
  getGroupLabel,
  getMetricLabel,
  getRowLabel,
  getVisibilityLabel,
  getVisualizationLabel,
} from './custom-report-config';

interface CustomReportsSectionProps {
  projectId: string;
  refreshKey: number;
  onCreate: () => void;
}

/** Saved custom reports for the project, with open, export and delete actions. */
export const CustomReportsSection = ({ projectId, refreshKey, onCreate }: CustomReportsSectionProps) => {
  const { t } = useTranslation('project-view');
  const { token } = theme.useToken();
  const authService = useAuthService();
  const currentUserId = authService.getCurrentSession()?.id;
  const isOwnerOrAdmin = authService.isOwnerOrAdmin();
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [openReport, setOpenReport] = useState<ICustomReport | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const { data, isLoading, hasError, reload } = useSoftwareReport<ICustomReport[]>(
    `${projectId}:${refreshKey}`,
    () => softwareReportsApiService.getCustomReports(projectId)
  );
  const reports = (data ?? []).filter(report => !deletedIds.includes(report.id));

  const handleExport = (report: ICustomReport, reportData: ICustomReportData) => {
    downloadReportCsv(
      report.name,
      [getGroupLabel(t, report.group_by), getMetricLabel(t, report.metric, report.source)],
      reportData.rows.map(row => [getRowLabel(t, row, report.group_by), row.value])
    );
  };

  const handleExportFromList = async (report: ICustomReport) => {
    setExportingId(report.id);
    try {
      const response = await softwareReportsApiService.getCustomReportData(projectId, report.id);
      if (response.done) handleExport(report, response.body);
    } catch (error) {
      if (!isAnnouncedApiError(error)) {
        alertService.error(
          t('customReportExportErrorTitle', { defaultValue: 'Could not export the report' }),
          t('retryLater', { defaultValue: 'Please try again.' })
        );
      }
    } finally {
      setExportingId(null);
    }
  };

  const handleDelete = async (report: ICustomReport) => {
    try {
      const response = await softwareReportsApiService.deleteCustomReport(projectId, report.id);
      if (response.done) setDeletedIds(ids => [...ids, report.id]);
    } catch (error) {
      if (!isAnnouncedApiError(error)) {
        alertService.error(
          t('customReportDeleteErrorTitle', { defaultValue: 'Could not delete the report' }),
          t('retryLater', { defaultValue: 'Please try again.' })
        );
      }
    }
  };

  const columns: TableColumnsType<ICustomReport> = [
    {
      key: 'name',
      title: t('customReportColumnName', { defaultValue: 'Report' }),
      render: (_, report) => (
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => setOpenReport(report)}
            className="border-0 bg-transparent p-0 font-semibold cursor-pointer hover:underline focus-visible:outline focus-visible:outline-2 text-left"
            style={{ color: token.colorPrimary }}
            aria-label={t('customReportOpenAria', { defaultValue: 'Open {{name}}', name: report.name })}
          >
            {report.name}
          </button>
          <Typography.Text type="secondary" className="block text-[11px]">
            {t('customReportVisibilityNote', {
              defaultValue: '{{visibility}} report',
              visibility: getVisibilityLabel(t, report.visibility),
            })}
          </Typography.Text>
        </div>
      ),
    },
    {
      key: 'metric',
      title: t('customReportMetricLabel', { defaultValue: 'Metric' }),
      width: 190,
      render: (_, report) => getMetricLabel(t, report.metric, report.source),
    },
    {
      key: 'group',
      title: t('customReportGroupLabel', { defaultValue: 'Group by' }),
      width: 150,
      render: (_, report) => (
        <Typography.Text type="secondary">{getGroupLabel(t, report.group_by)}</Typography.Text>
      ),
    },
    {
      key: 'visual',
      title: t('customReportVisualLabel', { defaultValue: 'Visualization' }),
      width: 140,
      render: (_, report) => getVisualizationLabel(t, report.visualization),
    },
    {
      key: 'actions',
      width: 150,
      align: 'right',
      render: (_, report) => {
        const canDelete = isOwnerOrAdmin || report.created_by === currentUserId;
        return (
          <Flex justify="end" gap={4}>
            <Button size="small" onClick={() => setOpenReport(report)}>
              {t('customReportOpen', { defaultValue: 'Open' })}
            </Button>
            <Tooltip title={t('customReportExportCsv', { defaultValue: 'Export CSV' })}>
              <Button
                size="small"
                type="text"
                icon={<DownloadOutlined />}
                loading={exportingId === report.id}
                onClick={() => void handleExportFromList(report)}
                aria-label={t('customReportExportCsv', { defaultValue: 'Export CSV' })}
              />
            </Tooltip>
            {canDelete && (
              <Popconfirm
                title={t('customReportDeleteConfirm', { defaultValue: 'Delete this report?' })}
                okText={t('customReportDelete', { defaultValue: 'Delete' })}
                okButtonProps={{ danger: true }}
                cancelText={t('cancel', { defaultValue: 'Cancel' })}
                onConfirm={() => handleDelete(report)}
              >
                <Tooltip title={t('customReportDelete', { defaultValue: 'Delete' })}>
                  <Button
                    size="small"
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    aria-label={t('customReportDeleteAria', {
                      defaultValue: 'Delete {{name}}',
                      name: report.name,
                    })}
                  />
                </Tooltip>
              </Popconfirm>
            )}
          </Flex>
        );
      },
    },
  ];

  return (
    <ReportPanel
      title={t('customReportsTitle', { defaultValue: 'Custom reports' })}
      extra={
        <Typography.Text type="secondary" className="text-xs">
          {t('customReportsSubtitle', { defaultValue: 'Saved views for this project' })}
        </Typography.Text>
      }
    >
      {hasError && !data ? (
        <ReportError onRetry={reload} />
      ) : (
        <Table<ICustomReport>
          rowKey="id"
          size="small"
          columns={columns}
          dataSource={reports}
          loading={isLoading && !data}
          pagination={false}
          scroll={{ x: 760 }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <Flex vertical gap={2}>
                    <strong>{t('customReportsEmptyTitle', { defaultValue: 'No custom reports yet' })}</strong>
                    <Typography.Text type="secondary" className="text-xs">
                      {t('customReportsEmptyHint', {
                        defaultValue: 'Create a focused report from work items, sprints, releases or time logs.',
                      })}
                    </Typography.Text>
                  </Flex>
                }
              >
                <Button icon={<PlusOutlined />} onClick={onCreate}>
                  {t('customReportCreate', { defaultValue: 'Create report' })}
                </Button>
              </Empty>
            ),
          }}
        />
      )}

      <CustomReportViewModal
        projectId={projectId}
        report={openReport}
        onClose={() => setOpenReport(null)}
        onExport={handleExport}
      />
    </ReportPanel>
  );
};
