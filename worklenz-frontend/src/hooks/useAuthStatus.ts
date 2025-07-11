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
        return { isAuthenticated: false, isLicenseExpired: false, isAdmin: false, isSetupComplete: false };
      }

      const isAuthenticated = authService.isAuthenticated();
      if (!isAuthenticated) {
        return { isAuthenticated: false, isLicenseExpired: false, isAdmin: false, isSetupComplete: false };
      }

      const currentSession = authService.getCurrentSession();
      const isFreePlan = currentSession?.subscription_type === ISUBSCRIPTION_TYPE.FREE;
      const isAdmin = authService.isOwnerOrAdmin() && !isFreePlan;
      const isSetupComplete = currentSession?.setup_completed ?? false;

      const isLicenseExpired = () => {
        if (!currentSession) return false;
        if (currentSession.is_expired) return true;

        if (
          currentSession.subscription_type === ISUBSCRIPTION_TYPE.TRIAL &&
          currentSession.trial_expire_date
        ) {
          const today = new Date();
          const expiryDate = new Date(currentSession.trial_expire_date);
          const diffTime = today.getTime() - expiryDate.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          return diffDays > 7;
        }

        return false;
      };

      return { isAuthenticated, isLicenseExpired: isLicenseExpired(), isAdmin, isSetupComplete };
    } catch (error) {
      console.error('Error in useAuthStatus:', error);
      return { isAuthenticated: false, isLicenseExpired: false, isAdmin: false, isSetupComplete: false };
    }
  }, [authService]);

  return { ...status, location };
};
