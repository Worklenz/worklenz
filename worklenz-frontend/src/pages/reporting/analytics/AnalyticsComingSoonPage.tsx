import React, { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { ReportEmptyState, ReportPageShell } from '@/components/reporting/analytics';
import { flatAnalyticsNavItems, ANALYTICS_BASE_PATH } from '@/lib/reporting/analytics-nav';

const AnalyticsComingSoonPage: React.FC = () => {
  const location = useLocation();
  const { t } = useTranslation('reporting-analytics');

  const item = useMemo(() => {
    const segment = location.pathname.replace(/^\/worklenz\/reporting\/analytics\/?/, '').split('/')[0];
    return flatAnalyticsNavItems().find(i => i.path === segment || i.key === segment);
  }, [location.pathname]);

  const title = item
    ? t(item.labelKey, { defaultValue: item.defaultLabel })
    : t('reportComingSoon', { defaultValue: 'Report' });

  useDocumentTitle(title);

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
      lastUpdatedAt={null}
    >
      <ReportEmptyState
        title={t('placeholderEmptyTitle', { defaultValue: 'Report coming soon' })}
        description={t('placeholderEmptyDescription', {
          defaultValue: 'This analytics report will load data in a later phase.',
        })}
      />
    </ReportPageShell>
  );
};

export default AnalyticsComingSoonPage;
