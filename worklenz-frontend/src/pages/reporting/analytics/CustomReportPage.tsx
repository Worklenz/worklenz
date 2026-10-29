import React, { useEffect, useMemo, lazy, Suspense } from 'react';
import { Button, Empty, Typography } from '@/shared/antd-imports';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { ReportPageShell } from '@/components/reporting/analytics';
import { SuspenseFallback } from '@/components/suspense-fallback/suspense-fallback';
import { ANALYTICS_BASE_PATH } from '@/lib/reporting/analytics-nav';
import { useAnalyticsCustomReports } from '@/features/reporting/analytics-custom-reports';

const VelocityPage = lazy(() => import('@/pages/reporting/analytics/VelocityPage'));
const ProjectHealthPage = lazy(() => import('@/pages/reporting/analytics/ProjectHealthPage'));
const PlannedVsActualTasksPage = lazy(
  () => import('@/pages/reporting/analytics/PlannedVsActualTasksPage')
);
const PlannedVsActualMilestonesPage = lazy(
  () => import('@/pages/reporting/analytics/PlannedVsActualMilestonesPage')
);
const UtilizationPage = lazy(() => import('@/pages/reporting/analytics/UtilizationPage'));
const TimeReportPage = lazy(() => import('@/pages/reporting/analytics/TimeReportPage'));
const BudgetTrackingPage = lazy(() => import('@/pages/reporting/analytics/BudgetTrackingPage'));
const CumulativeFlowPage = lazy(() => import('@/pages/reporting/analytics/CumulativeFlowPage'));
const TimeInStatusPage = lazy(() => import('@/pages/reporting/analytics/TimeInStatusPage'));

const { Text } = Typography;

const REPORT_PAGE_BY_KIND: Record<
  string,
  React.LazyExoticComponent<
    React.ComponentType<{ customTemplateId?: string; customTemplateName?: string }>
  >
> = {
  velocity: VelocityPage,
  'project-health': ProjectHealthPage,
  'planned-vs-actual-tasks': PlannedVsActualTasksPage,
  'planned-vs-actual-milestones': PlannedVsActualMilestonesPage,
  utilization: UtilizationPage,
  'time-report': TimeReportPage,
  'budget-tracking': BudgetTrackingPage,
  'cumulative-flow': CumulativeFlowPage,
  'time-in-status': TimeInStatusPage,
};

/**
 * Opens a saved custom template at /custom/:id and renders the source report
 * with that template's name + filters (URL stays on Custom reports).
 */
const CustomReportPage: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation('reporting-analytics');
  const { customReports, refreshCustomReports } = useAnalyticsCustomReports();

  useEffect(() => {
    refreshCustomReports();
  }, [refreshCustomReports]);

  const report = useMemo(
    () => customReports.find(item => item.id === id),
    [customReports, id]
  );

  const title = report?.name ?? t('descCustomReport', { defaultValue: 'Saved custom report' });
  useDocumentTitle(title);

  if (!report) {
    return <Navigate to={ANALYTICS_BASE_PATH} replace />;
  }

  const Page = report.sourceKind ? REPORT_PAGE_BY_KIND[report.sourceKind] : undefined;
  if (Page) {
    return (
      <Suspense fallback={<SuspenseFallback />}>
        <Page customTemplateId={report.id} customTemplateName={report.name} />
      </Suspense>
    );
  }

  return (
    <ReportPageShell
      title={title}
      crumbs={[
        {
          label: t('allReports', { defaultValue: 'All reports' }),
          path: ANALYTICS_BASE_PATH,
        },
        {
          label: t('tabCustom', { defaultValue: 'Custom reports' }),
          path: ANALYTICS_BASE_PATH,
        },
        { label: title },
      ]}
      lastUpdatedAt={report.accessedAt || report.createdAt}
    >
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <>
            <Text strong>
              {t('noReportsFound', { defaultValue: 'No reports found' })}
            </Text>
            <br />
            <Text type="secondary">
              {t('noReportsHint', {
                defaultValue: 'Try a different search or create a custom report.',
              })}
            </Text>
          </>
        }
      >
        <Button type="primary" onClick={() => navigate(ANALYTICS_BASE_PATH)}>
          {t('allReports', { defaultValue: 'All reports' })}
        </Button>
      </Empty>
    </ReportPageShell>
  );
};

export default CustomReportPage;
