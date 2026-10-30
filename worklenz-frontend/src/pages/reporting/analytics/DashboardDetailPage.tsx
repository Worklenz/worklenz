import React from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { ReportEmptyState, ReportPageShell } from '@/components/reporting/analytics';
import { ANALYTICS_BASE_PATH, analyticsPath } from '@/lib/reporting/analytics-nav';

const DashboardDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation('reporting-analytics');
  const title = t('dashboardDetail', { defaultValue: 'Dashboard' });
  useDocumentTitle(title);

  return (
    <ReportPageShell
      title={title}
      lastUpdatedAt={null}
    >
      <ReportEmptyState
        title={t('dashboardCanvasEmptyTitle', { defaultValue: 'Empty dashboard' })}
        description={t('dashboardCanvasEmptyDescription', {
          defaultValue: 'Drag gadgets here once the dashboard editor is available.',
        })}
      />
    </ReportPageShell>
  );
};

export default DashboardDetailPage;
