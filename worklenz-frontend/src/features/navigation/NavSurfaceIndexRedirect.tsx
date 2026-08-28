import { Navigate } from 'react-router-dom';
import { useNavPreferences } from './useNavPreferences';
import type { SurfaceKey } from './nav-registry.types';

interface NavSurfaceIndexRedirectProps {
  surfaceKey: SurfaceKey;
}

// Route-based surfaces (Reporting, Client Portal) have no bare "/" element of
// their own — without this, the top bar's static link always lands on a
// hardcoded sub-path regardless of what the user pinned as their default.
const NavSurfaceIndexRedirect: React.FC<NavSurfaceIndexRedirectProps> = ({ surfaceKey }) => {
  const { resolved } = useNavPreferences(surfaceKey);
  return <Navigate to={resolved.activeDefaultKey} replace />;
};

export default NavSurfaceIndexRedirect;
