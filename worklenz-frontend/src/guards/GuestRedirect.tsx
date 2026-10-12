import { Navigate, useLocation } from 'react-router-dom';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAuthService } from '@/hooks/useAuth';
import { selectCurrentProject } from '@/app/selectors';
import { isSessionGuest } from '@/utils/guest-session';

/**
 * GuestRedirect Component
 *
 * Prevents guest-only users from accessing the Home page.
 * Guest users should only have access to Projects section.
 *
 * Guest status is team-scoped in the authenticated session. Project membership
 * still controls which projects the user can see.
 */
const GuestRedirect = ({ children }: { children: React.ReactNode }) => {
  const authService = useAuthService();
  const session = authService.getCurrentSession();
  const location = useLocation();
  const currentProject = useAppSelector(selectCurrentProject);

  try {
    // Allow owners and admins to access all pages
    if (session?.owner || session?.is_admin) {
      return <>{children}</>;
    }

    const isGuest =
      isSessionGuest(session) || Boolean(currentProject?.project?.is_guest);

    if (isGuest && location.pathname.startsWith('/worklenz/home')) {
      return <Navigate to="/worklenz/projects" replace />;
    }

    return <>{children}</>;
  } catch (error) {
    console.error('Error in GuestRedirect:', error);
    // On error, allow access (fail open)
    return <>{children}</>;
  }
};

export default GuestRedirect;
