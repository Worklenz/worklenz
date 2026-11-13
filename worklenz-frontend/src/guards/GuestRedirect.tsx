import { Navigate, useLocation } from 'react-router-dom';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAuthService } from '@/hooks/useAuth';
import { selectCurrentProject } from '@/app/selectors';
import { isSessionGuest } from '@/utils/guest-session';

interface GuestRedirectProps {
  children: React.ReactNode;
  /**
   * When set, guests hitting this path prefix are redirected to Projects
   * (used for Reporting & Analytics and Home).
   */
  blockPathPrefix?: string;
}

/**
 * Prevents guest-only users from accessing restricted surfaces.
 * Guest status is team-scoped in the authenticated session.
 */
const GuestRedirect = ({
  children,
  blockPathPrefix = '/worklenz/home',
}: GuestRedirectProps) => {
  const authService = useAuthService();
  const session = authService.getCurrentSession();
  const location = useLocation();
  const currentProject = useAppSelector(selectCurrentProject);

  try {
    if (session?.owner || session?.is_admin) {
      return <>{children}</>;
    }

    const isGuest =
      isSessionGuest(session) || Boolean(currentProject?.project?.is_guest);

    if (isGuest && location.pathname.startsWith(blockPathPrefix)) {
      return <Navigate to="/worklenz/projects" replace />;
    }

    return <>{children}</>;
  } catch (error) {
    console.error('Error in GuestRedirect:', error);
    return <>{children}</>;
  }
};

export default GuestRedirect;
