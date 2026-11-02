import { RouteObject } from 'react-router-dom';
import { Navigate } from 'react-router-dom';
import { Suspense } from 'react';
import SettingsLayout from '@/layouts/SettingsLayout';
import { getAccessibleSettings, settingsItems } from '@/lib/settings/settings-constants';
import { useAuthService } from '@/hooks/useAuth';
import { useOrganizationPermissions } from '@/hooks/useOrganizationPermission';
import { isExpiredTrialSession } from '@/utils/subscription-utils';
import { SuspenseFallback } from '@/components/suspense-fallback/suspense-fallback';

const SettingsGuard = ({
  children,
  itemKey,
}: {
  children: React.ReactNode;
  itemKey: string;
}) => {
  const authService = useAuthService();
  const currentSession = authService.getCurrentSession();
  const isOwnerOrAdmin = authService.isOwnerOrAdmin();
  const { permissions: organizationPermissions } = useOrganizationPermissions();
  const accessibleSettings = getAccessibleSettings(
    isOwnerOrAdmin,
    currentSession,
    organizationPermissions
  );
  const hasAccess = accessibleSettings.some(item => item.key === itemKey);

  if (!hasAccess) {
    if (isExpiredTrialSession(currentSession)) {
      return <Navigate to="/worklenz/settings/profile" replace />;
    }
    return <Navigate to="/worklenz/unauthorized" replace />;
  }

  return <>{children}</>;
};

const settingsRoutes: RouteObject[] = [
  {
    path: 'settings',
    element: <SettingsLayout />,
    children: settingsItems.map(item => ({
      path: item.endpoint,
      element: (
        <Suspense fallback={<SuspenseFallback />}>
          <SettingsGuard itemKey={item.key}>{item.element}</SettingsGuard>
        </Suspense>
      ),
    })),
  },
];

export default settingsRoutes;
