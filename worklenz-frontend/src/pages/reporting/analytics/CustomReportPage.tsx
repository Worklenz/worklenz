import React, { useEffect, useMemo, useState, lazy, Suspense } from 'react';
import { Button, Empty, Typography } from '@/shared/antd-imports';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { ReportPageShell } from '@/components/reporting/analytics';
import { AnalyticsBusinessGate, AnalyticsFinanceGate } from '@/components/reporting/analytics/AnalyticsBusinessGate';
import { SuspenseFallback } from '@/components/suspense-fallback/suspense-fallback';
import {
  ANALYTICS_BASE_PATH,
  isBusinessAnalyticsReport,
  isFinanceAnalyticsReport,
} from '@/lib/reporting/analytics-nav';
import { useAnalyticsCustomReports, isAnalyticsCustomReportsSessionActive } from '@/features/reporting/analytics-custom-reports';
import { analyticsTemplatesApiService } from '@/api/reporting/analytics-templates.api.service';
import { ReportErrorState } from '@/components/reporting/analytics/states/ReportStateViews';

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
  const { customReports, storageKey, syncTemplatesToCustomReports } = useAnalyticsCustomReports();
  const [isSyncing, setIsSyncing] = useState(true);
  const [hasSyncError, setHasSyncError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsSyncing(true);
    setHasSyncError(false);
    void analyticsTemplatesApiService.listTemplates('all').then(res => {
      if (cancelled || !isAnalyticsCustomReportsSessionActive(storageKey)) return;
      if (!res.done || !Array.isArray(res.body)) {
        setHasSyncError(true);
        return;
      }
      syncTemplatesToCustomReports(res.body);
    }).catch(() => {
      if (!cancelled) setHasSyncError(true);
    }).finally(() => {
      if (!cancelled) setIsSyncing(false);
    });
    return () => {
      cancelled = true;
    };
  }, [storageKey, syncTemplatesToCustomReports, id, retryCount]);

  const report = useMemo(
    () => customReports.find(item => item.id === id),
    [customReports, id]
  );

  const title = report?.name ?? t('descCustomReport', { defaultValue: 'Saved custom report' });
  useDocumentTitle(title);

  if (isSyncing && !report) {
    return <SuspenseFallback />;
  }

  if (!report && hasSyncError) {
    return <ReportErrorState onRetry={() => setRetryCount(count => count + 1)} />;
  }

  if (!report) {
    return <Navigate to={ANALYTICS_BASE_PATH} replace />;
  }

  const Page = report.sourceKind ? REPORT_PAGE_BY_KIND[report.sourceKind] : undefined;
  if (Page) {
    const page = (
      <Suspense fallback={<SuspenseFallback />}>
        <Page customTemplateId={report.id} customTemplateName={report.name} />
      </Suspense>
    );
    if (report.sourceKind && isBusinessAnalyticsReport(report.sourceKind)) {
      return (
        <AnalyticsBusinessGate titleKey="descCustomReport" titleDefault={title}>
          {page}
        </AnalyticsBusinessGate>
      );
    }
    if (report.sourceKind && isFinanceAnalyticsReport(report.sourceKind)) {
      return (
        <AnalyticsFinanceGate titleKey="descCustomReport" titleDefault={title}>
          {page}
        </AnalyticsFinanceGate>
      );
    }
    return page;
  }

  return (
    <ReportPageShell
      title={title}
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
