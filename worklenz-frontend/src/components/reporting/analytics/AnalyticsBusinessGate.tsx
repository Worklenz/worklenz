import React from 'react';
import { Button, CrownOutlined, Flex, Result, theme } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';
import { useAuthService } from '@/hooks/useAuth';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useOrganizationPermission } from '@/hooks/useOrganizationPermission';
import { openUpgradeModal } from '@/features/admin-center/admin-center.slice';
import { canUseFeature } from '@/utils/subscription-utils';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { ORGANIZATION_PERMISSIONS } from '@/types/admin-center/permission-schemes.types';
import { SuspenseFallback } from '@/components/suspense-fallback/suspense-fallback';
import { ReportPageShell } from './ReportPageShell';
import { ANALYTICS_BASE_PATH } from '@/lib/reporting/analytics-nav';

interface AnalyticsBusinessGateProps {
  feature?: 'advanced_reporting' | 'finance_module';
  titleKey: string;
  titleDefault: string;
  children: React.ReactNode;
}

/**
 * Renders reports only when their feature is available; otherwise shows an upgrade state.
 * Finance reports also require the "View finance" organization permission.
 */
export const AnalyticsBusinessGate: React.FC<AnalyticsBusinessGateProps> = ({
  feature = 'advanced_reporting',
  titleKey,
  titleDefault,
  children,
}) => {
  const { token } = theme.useToken();
  const { t } = useTranslation('reporting-analytics');
  const dispatch = useAppDispatch();
  const authService = useAuthService();
  const session = authService.getCurrentSession();
  const canAccess = canUseFeature(session, feature);
  const { hasPermission: canViewFinance, isLoading: isFinancePermissionLoading } =
    useOrganizationPermission(ORGANIZATION_PERMISSIONS.VIEW_FINANCE);
  const title = t(titleKey, { defaultValue: titleDefault });

  useDocumentTitle(title);

  if (feature === 'finance_module') {
    if (isFinancePermissionLoading) return <SuspenseFallback />;
    if (!canViewFinance) {
      return <Navigate to={ANALYTICS_BASE_PATH} replace />;
    }
  }

  if (canAccess) {
    return <>{children}</>;
  }

  return (
    <ReportPageShell
      title={title}
    >
      <Flex align="center" justify="center" style={{ minHeight: 360, width: '100%' }}>
        <Result
          icon={<CrownOutlined style={{ color: token.colorWarning }} />}
          title={t('businessReportLockedTitle', {
            defaultValue: 'Business plan required',
          })}
          subTitle={feature === 'finance_module'
            ? t('financeReportLockedDescription', {
                defaultValue: 'Project Health and Budget Tracking are available on the Business plan.',
              })
            : t('businessReportLockedDescription', {
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

export const AnalyticsFinanceGate: React.FC<Omit<AnalyticsBusinessGateProps, 'feature'>> = props => (
  <AnalyticsBusinessGate {...props} feature="finance_module" />
);
