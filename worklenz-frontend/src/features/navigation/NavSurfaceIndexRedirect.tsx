import { Navigate } from 'react-router-dom';
import { useNavPreferences } from './useNavPreferences';
import type { SurfaceKey } from './nav-registry.types';
import { readReportingModePreference } from '@/components/reporting/ReportingModePaddle';
import { ANALYTICS_BASE_PATH } from '@/lib/reporting/analytics-nav';

interface NavSurfaceIndexRedirectProps {
  surfaceKey: SurfaceKey;
}

// Route-based surfaces (Reporting, Client Portal) have no bare "/" element of
// their own — without this, the top bar's static link always lands on a
// hardcoded sub-path regardless of what the user pinned as their default.
const NavSurfaceIndexRedirect: React.FC<NavSurfaceIndexRedirectProps> = ({ surfaceKey }) => {
  const { resolved } = useNavPreferences(surfaceKey);

  // Honor last Custom/Classic paddle choice when entering classic reporting index.
  if (surfaceKey === 'reporting' && readReportingModePreference() === 'custom') {
    return <Navigate to={ANALYTICS_BASE_PATH} replace />;
  }

  return <Navigate to={resolved.activeDefaultKey} replace />;
};

export default NavSurfaceIndexRedirect;
