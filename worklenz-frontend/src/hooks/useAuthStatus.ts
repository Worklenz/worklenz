import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuthService } from '@/hooks/useAuth';
import { ISUBSCRIPTION_TYPE } from '@/shared/constants';

export const useAuthStatus = () => {
  const authService = useAuthService();
  const location = useLocation();

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
      const isFreePlan = currentSession?.subscription_type === ISUBSCRIPTION_TYPE.FREE;
      const isAdmin = authService.isOwnerOrAdmin() && !isFreePlan;
      const isSetupComplete = currentSession?.setup_completed ?? false;

      const isLicenseExpired = () => {
        if (!currentSession) return false;
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
  }, [authService]);

  return { ...status, location };
};
