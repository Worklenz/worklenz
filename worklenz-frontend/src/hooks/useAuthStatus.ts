import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuthService } from '@/hooks/useAuth';
import { useAppSelector } from '@/hooks/useAppSelector';
import { ISUBSCRIPTION_TYPE } from '@/shared/constants';

const isFreePlanSession = (session: {
  subscription_type?: string;
  subscription_status?: string;
} | null | undefined) =>
  session?.subscription_type === ISUBSCRIPTION_TYPE.FREE ||
  session?.subscription_status?.toLowerCase() === 'free';

export const useAuthStatus = () => {
  const authService = useAuthService();
  const location = useLocation();
  // Recompute after verify/login replaces the session. authService itself is stable,
  // so a plan change (trial -> free, Google signup) would otherwise stay stale.
  const authUser = useAppSelector(state => state.auth.user);

  const status = useMemo(() => {
    try {
      if (!authService || typeof authService.isAuthenticated !== 'function') {
        return {
          isAuthenticated: false,
          isLicenseExpired: false,
          isAdmin: false,
          isSetupComplete: false,
        };
      }

      const isAuthenticated = authService.isAuthenticated();
      if (!isAuthenticated) {
        return {
          isAuthenticated: false,
          isLicenseExpired: false,
          isAdmin: false,
          isSetupComplete: false,
        };
      }

      const currentSession = authService.getCurrentSession();
      const isFreePlan = isFreePlanSession(currentSession);
      const isAdmin = authService.isOwnerOrAdmin() && !isFreePlan;
      const isSetupComplete = currentSession?.setup_completed ?? false;

      const isLicenseExpired = () => {
        if (!currentSession || isFreePlan) return false;
        if (currentSession.is_expired) return true;

        // Check using valid_till_date for subscription types that can expire
        const expirableTypes = [
          ISUBSCRIPTION_TYPE.TRIAL,
          ISUBSCRIPTION_TYPE.PADDLE,
          ISUBSCRIPTION_TYPE.CUSTOM,
        ];

        if (
          expirableTypes.includes(currentSession.subscription_type as ISUBSCRIPTION_TYPE) &&
          (currentSession.valid_till_date || currentSession.trial_expire_date)
        ) {
          const today = new Date();
          // Use valid_till_date first, fallback to trial_expire_date
          const expireDateStr = currentSession.valid_till_date || currentSession.trial_expire_date;
          if (!expireDateStr) return false;
          const expiryDate = new Date(expireDateStr);
          const diffTime = today.getTime() - expiryDate.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          // License is considered fully expired after 7 days grace period
          // This will trigger the LicenseExpiredModal
          return diffDays > 7;
        }

        return false;
      };

      return { isAuthenticated, isLicenseExpired: isLicenseExpired(), isAdmin, isSetupComplete };
    } catch (error) {
      console.error('Error in useAuthStatus:', error);
      return {
        isAuthenticated: false,
        isLicenseExpired: false,
        isAdmin: false,
        isSetupComplete: false,
      };
    }
  }, [authService, authUser]);

  return { ...status, location };
};
