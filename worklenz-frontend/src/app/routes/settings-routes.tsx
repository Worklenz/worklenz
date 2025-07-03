import { RouteObject } from 'react-router-dom';
import { Navigate } from 'react-router-dom';
import SettingsLayout from '@/layouts/SettingsLayout';
import { settingsItems } from '@/lib/settings/settings-constants';
import { useAuthService } from '@/hooks/useAuth';

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
      element: <SettingsGuard adminRequired={!!item.adminOnly}>{item.element}</SettingsGuard>,
    })),
  },
];

export default settingsRoutes;
