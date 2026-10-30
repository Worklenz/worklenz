import React from 'react';
import { Button, CrownOutlined, Flex, Result } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useAuthService } from '@/hooks/useAuth';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { openUpgradeModal } from '@/features/admin-center/admin-center.slice';
import { canUseFeature } from '@/utils/subscription-utils';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { ReportPageShell } from './ReportPageShell';
import { ANALYTICS_BASE_PATH } from '@/lib/reporting/analytics-nav';

interface AnalyticsBusinessGateProps {
  titleKey: string;
  titleDefault: string;
  children: React.ReactNode;
}

/**
 * Renders children for Business (advanced_reporting) sessions;
 * otherwise shows an upgrade empty state for Flow analytics reports.
 */
export const AnalyticsBusinessGate: React.FC<AnalyticsBusinessGateProps> = ({
  titleKey,
  titleDefault,
  children,
}) => {
  const { t } = useTranslation('reporting-analytics');
  const dispatch = useAppDispatch();
  const authService = useAuthService();
  const session = authService.getCurrentSession();
  const canAccess = canUseFeature(session, 'advanced_reporting');
  const title = t(titleKey, { defaultValue: titleDefault });

  useDocumentTitle(title);

  if (canAccess) {
    return <>{children}</>;
  }

  return (
    <ReportPageShell
      title={title}
    >
      <Flex align="center" justify="center" style={{ minHeight: 360, width: '100%' }}>
        <Result
          icon={<CrownOutlined style={{ color: '#faad14' }} />}
          title={t('businessReportLockedTitle', {
            defaultValue: 'Business plan required',
          })}
          subTitle={t('businessReportLockedDescription', {
            defaultValue:
              'Velocity, Cumulative Flow, Time in Status, and SLA Tracking are available on the Business plan.',
          })}
          extra={
            <Button type="primary" icon={<CrownOutlined />} onClick={() => dispatch(openUpgradeModal('default'))}>
              {t('upgradeToBusiness', { defaultValue: 'Upgrade to Business' })}
            </Button>
          }
        />
      </Flex>
    </ReportPageShell>
  );
};
