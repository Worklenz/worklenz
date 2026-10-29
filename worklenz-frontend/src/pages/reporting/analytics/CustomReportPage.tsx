import React, { useEffect, useMemo } from 'react';
import { Button, Empty, Typography } from '@/shared/antd-imports';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { ReportPageShell } from '@/components/reporting/analytics';
import { ANALYTICS_BASE_PATH } from '@/lib/reporting/analytics-nav';
import { useAnalyticsCustomReports } from '@/features/reporting/analytics-custom-reports';
import VelocityPage from '@/pages/reporting/analytics/VelocityPage';

const { Text } = Typography;

/**
 * Opens a saved custom template at /custom/:id.
 * Velocity-based templates render the velocity chart here (keep custom URL + title).
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

  if (report.sourceKind === 'velocity') {
    return (
      <VelocityPage
        customTemplateId={report.id}
        customTemplateName={report.name}
      />
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
          label: t('tabCustom', { defaultValue: 'Custom templates' }),
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
