import { RouteObject } from 'react-router-dom';
import { Navigate } from 'react-router-dom';
import { Suspense } from 'react';
import SettingsLayout from '@/layouts/SettingsLayout';
import { settingsItems } from '@/lib/settings/settings-constants';
import { useAuthService } from '@/hooks/useAuth';
import { SuspenseFallback } from '@/components/suspense-fallback/suspense-fallback';

const SettingsGuard = ({
  children,
  adminRequired,
}: {
  children: React.ReactNode;
  adminRequired: boolean;
}) => {
  const isOwnerOrAdmin = useAuthService().isOwnerOrAdmin();

  if (adminRequired && !isOwnerOrAdmin) {
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
          <SettingsGuard adminRequired={!!item.adminOnly}>{item.element}</SettingsGuard>
        </Suspense>
      ),
    })),
  },
];

export default settingsRoutes;
