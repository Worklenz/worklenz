import React, { useEffect, useMemo } from 'react';
import { Button, Empty, Typography } from '@/shared/antd-imports';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { ReportPageShell } from '@/components/reporting/analytics';
import {
  ANALYTICS_BASE_PATH,
  analyticsPath,
  flatAnalyticsNavItems,
} from '@/lib/reporting/analytics-nav';
import { useAnalyticsCustomReports } from '@/features/reporting/analytics-custom-reports';

const { Text } = Typography;

/**
 * Opens a saved custom report. When it was created from a builtin report,
 * redirect to that report; otherwise show an empty state (not a coming-soon stub).
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

  const sourcePath = useMemo(() => {
    if (!report?.sourceKind) return null;
    const item = flatAnalyticsNavItems().find(
      nav => nav.key === report.sourceKind || nav.path === report.sourceKind
    );
    return item?.enabled && item.path ? item.path : null;
  }, [report]);

  if (!report) {
    return <Navigate to={ANALYTICS_BASE_PATH} replace />;
  }

  if (sourcePath) {
    return <Navigate to={analyticsPath(sourcePath)} replace />;
  }

  return (
    <ReportPageShell
      title={title}
      crumbs={[
        {
          label: t('allReports', { defaultValue: 'All reports' }),
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
