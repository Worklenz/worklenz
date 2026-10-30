import React from 'react';
import { Button, Flex } from '@/shared/antd-imports';
import { PlusOutlined } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { ReportEmptyState, ReportPageShell } from '@/components/reporting/analytics';
import { useAuthService } from '@/hooks/useAuth';
import {
  getAnalyticsDashboardPermissions,
  resolveAnalyticsActorRole,
} from '@/lib/reporting/analytics-permissions';
import { ANALYTICS_BASE_PATH } from '@/lib/reporting/analytics-nav';

const DashboardsPage: React.FC = () => {
  const { t } = useTranslation('reporting-analytics');
  const title = t('dashboards', { defaultValue: 'Dashboards' });
  useDocumentTitle(title);

  const authService = useAuthService();
  const session = authService.getCurrentSession();
  const permissions = getAnalyticsDashboardPermissions({
    role: resolveAnalyticsActorRole(session),
    userId: session?.id,
  });

  return (
    <ReportPageShell
      title={title}
      lastUpdatedAt={null}
      actions={
        permissions.canCreate ? (
          <Button type="primary" icon={<PlusOutlined />} disabled>
            {t('createDashboard', { defaultValue: 'Create Dashboard' })}
          </Button>
        ) : undefined
      }
    >
      <Flex align="center" justify="center" style={{ minHeight: 360 }}>
        <ReportEmptyState
          title={t('noDashboardsTitle', { defaultValue: 'No dashboards yet' })}
          description={t('noDashboardsDescription', {
            defaultValue: 'Create a dashboard to track sprint progress, SLA, and flow metrics.',
          })}
          ctaLabel={t('createDashboard', { defaultValue: 'Create Dashboard' })}
          onCta={permissions.canCreate ? () => undefined : undefined}
        />
      </Flex>
    </ReportPageShell>
  );
};

export default DashboardsPage;
