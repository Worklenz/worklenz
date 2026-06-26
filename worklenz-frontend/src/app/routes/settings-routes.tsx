import { RouteObject } from 'react-router-dom';
import { Navigate } from 'react-router-dom';
import { Suspense } from 'react';
import SettingsLayout from '@/layouts/SettingsLayout';
import { getAccessibleSettings, settingsItems } from '@/lib/settings/settings-constants';
import { useAuthService } from '@/hooks/useAuth';
import { useBusinessFeatures } from '@/worklenz-ee/hooks/use-business-features';
import { SuspenseFallback } from '@/components/suspense-fallback/suspense-fallback';

const SettingsGuard = ({
  children,
  itemKey,
}: {
  children: React.ReactNode;
  itemKey: string;
}) => {
  const authService = useAuthService();
  const isOwnerOrAdmin = authService.isOwnerOrAdmin();
  const { hasBusinessAccess } = useBusinessFeatures();
  const accessibleSettings = getAccessibleSettings(isOwnerOrAdmin, hasBusinessAccess);
  const hasAccess = accessibleSettings.some(item => item.key === itemKey);

  if (!hasAccess) {
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
