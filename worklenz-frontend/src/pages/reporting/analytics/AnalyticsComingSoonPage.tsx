import React, { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { ReportEmptyState, ReportPageShell } from '@/components/reporting/analytics';
import { flatAnalyticsNavItems, ANALYTICS_BASE_PATH } from '@/lib/reporting/analytics-nav';
import { useAnalyticsCustomReports } from '@/features/reporting/analytics-custom-reports';

const AnalyticsComingSoonPage: React.FC = () => {
  const location = useLocation();
  const { t } = useTranslation('reporting-analytics');
  const { customReports } = useAnalyticsCustomReports();

  const title = useMemo(() => {
    const rest = location.pathname.replace(/^\/worklenz\/reporting\/analytics\/?/, '');
    if (rest.startsWith('custom/')) {
      const id = rest.slice('custom/'.length).split('/')[0];
      const custom = customReports.find(r => r.id === id);
      if (custom) return custom.name;
    }

    const segment = rest.split('/')[0];
    const item = flatAnalyticsNavItems(customReports).find(
      i => i.path === segment || i.key === segment || i.path === rest
    );
    return item
      ? t(item.labelKey, { defaultValue: item.defaultLabel })
      : t('reportComingSoon', { defaultValue: 'Report' });
  }, [location.pathname, customReports, t]);

  useDocumentTitle(title);

  return (
    <ReportPageShell
      title={title}
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
