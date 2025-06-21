import { createBrowserRouter, Navigate, RouteObject, useLocation } from 'react-router-dom';
import { lazy, Suspense, memo, useMemo } from 'react';
import rootRoutes from './root-routes';
import authRoutes from './auth-routes';
import mainRoutes, { licenseExpiredRoute } from './main-routes';
import notFoundRoute from './not-found-route';
import accountSetupRoute from './account-setup-routes';
import reportingRoutes from './reporting-routes';
import { useAuthService } from '@/hooks/useAuth';
import { AuthenticatedLayout } from '@/layouts/AuthenticatedLayout';
import ErrorBoundary from '@/components/ErrorBoundary';
import { SuspenseFallback } from '@/components/suspense-fallback/suspense-fallback';
import { ISUBSCRIPTION_TYPE } from '@/shared/constants';

// Lazy load the NotFoundPage component for better code splitting
const NotFoundPage = lazy(() => import('@/pages/404-page/404-page'));

interface GuardProps {
  children: React.ReactNode;
}

// Route-based code splitting utility
const withCodeSplitting = (Component: React.LazyExoticComponent<React.ComponentType<any>>) => {
  return memo(() => (
    <Suspense fallback={<SuspenseFallback />}>
      <Component />
    </Suspense>
  ));
};

// Memoized guard components with defensive programming
export const AuthGuard = memo(({ children }: GuardProps) => {
  const authService = useAuthService();
  const location = useLocation();

  const shouldRedirect = useMemo(() => {
    try {
      // Defensive check to ensure authService and its methods exist
      if (!authService || typeof authService.isAuthenticated !== 'function') {
        return false; // Don't redirect if auth service is not ready
      }
      return !authService.isAuthenticated();
    } catch (error) {
      console.error('Error in AuthGuard:', error);
      return false; // Don't redirect on error, let the app handle it
    }
  }, [authService]);

  if (shouldRedirect) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  return <>{children}</>;
});

AuthGuard.displayName = 'AuthGuard';

export const AdminGuard = memo(({ children }: GuardProps) => {
  const authService = useAuthService();
  const location = useLocation();

  const guardResult = useMemo(() => {
    try {
      // Defensive checks to ensure authService and its methods exist
      if (!authService || 
          typeof authService.isAuthenticated !== 'function' ||
          typeof authService.isOwnerOrAdmin !== 'function' ||
          typeof authService.getCurrentSession !== 'function') {
        return null; // Don't redirect if auth service is not ready
      }

      if (!authService.isAuthenticated()) {
        return { redirect: '/auth', state: { from: location } };
      }

      const currentSession = authService.getCurrentSession();
      const isFreePlan = currentSession?.subscription_type === ISUBSCRIPTION_TYPE.FREE;
      
      if (!authService.isOwnerOrAdmin() || isFreePlan) {
        return { redirect: '/worklenz/unauthorized' };
      }

      return null;
    } catch (error) {
      console.error('Error in AdminGuard:', error);
      return null; // Don't redirect on error
    }
  }, [authService, location]);

  if (guardResult) {
    return <Navigate to={guardResult.redirect} state={guardResult.state} replace />;
  }

  return <>{children}</>;
});

AdminGuard.displayName = 'AdminGuard';

export const LicenseExpiryGuard = memo(({ children }: GuardProps) => {
  const authService = useAuthService();
  const location = useLocation();

  const shouldRedirect = useMemo(() => {
    try {
      // Defensive checks to ensure authService and its methods exist
      if (!authService || 
          typeof authService.isAuthenticated !== 'function' ||
          typeof authService.getCurrentSession !== 'function') {
        return false; // Don't redirect if auth service is not ready
      }

      if (!authService.isAuthenticated()) return false;

      const isAdminCenterRoute = location.pathname.includes('/worklenz/admin-center');
      const isLicenseExpiredRoute = location.pathname === '/worklenz/license-expired';

      // Don't check or redirect if we're already on the license-expired page
      if (isLicenseExpiredRoute) return false;

      const currentSession = authService.getCurrentSession();

      // Check if trial is expired more than 7 days or if is_expired flag is set
      const isLicenseExpiredMoreThan7Days = () => {   
        // Quick bail if no session data is available
        if (!currentSession) return false;
        
        // Check is_expired flag first
        if (currentSession.is_expired) {      
          // If no trial_expire_date exists but is_expired is true, defer to backend check
          if (!currentSession.trial_expire_date) return true;
          
          // If there is a trial_expire_date, check if it's more than 7 days past
          const today = new Date();
          const expiryDate = new Date(currentSession.trial_expire_date);
          const diffTime = today.getTime() - expiryDate.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          // Redirect if more than 7 days past expiration
          return diffDays > 7;
        }
        
        // If not marked as expired but has trial_expire_date, do a date check
        if (currentSession.subscription_type === ISUBSCRIPTION_TYPE.TRIAL && currentSession.trial_expire_date) {
          const today = new Date();
          const expiryDate = new Date(currentSession.trial_expire_date);

          const diffTime = today.getTime() - expiryDate.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          // If expired more than 7 days, redirect
          return diffDays > 7;
        }
        
        // No expiration data found
        return false;
      };

      return isLicenseExpiredMoreThan7Days() && !isAdminCenterRoute;
    } catch (error) {
      console.error('Error in LicenseExpiryGuard:', error);
      return false; // Don't redirect on error
    }
  }, [authService, location.pathname]);

  if (shouldRedirect) {
    return <Navigate to="/worklenz/license-expired" replace />;
  }

  return <>{children}</>;
});

LicenseExpiryGuard.displayName = 'LicenseExpiryGuard';

export const SetupGuard = memo(({ children }: GuardProps) => {
  const authService = useAuthService();
  const location = useLocation();

  const shouldRedirect = useMemo(() => {
    try {
      // Defensive check to ensure authService and its methods exist
      if (!authService || typeof authService.isAuthenticated !== 'function') {
        return false; // Don't redirect if auth service is not ready
      }
      return !authService.isAuthenticated();
    } catch (error) {
      console.error('Error in SetupGuard:', error);
      return false; // Don't redirect on error
    }
  }, [authService]);

  if (shouldRedirect) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  return <>{children}</>;
});

SetupGuard.displayName = 'SetupGuard';

// Optimized route wrapping function with Suspense boundaries
const wrapRoutes = (
  routes: RouteObject[],
  Guard: React.ComponentType<{ children: React.ReactNode }>
): RouteObject[] => {
  return routes.map(route => {
    const wrappedRoute = {
      ...route,
      element: (
        <Suspense fallback={<SuspenseFallback />}>
          <Guard>{route.element}</Guard>
        </Suspense>
      ),
    };

    if (route.children) {
      wrappedRoute.children = wrapRoutes(route.children, Guard);
    }

    if (route.index) {
      delete wrappedRoute.children;
    }

    return wrappedRoute;
  });
};

// Optimized static license expired component
const StaticLicenseExpired = memo(() => {
  return (
    <div style={{ 
      marginTop: 65, 
      minHeight: '90vh', 
      backgroundColor: '#f5f5f5', 
      padding: '20px',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center'
    }}>
      <div style={{ 
        background: 'white', 
        padding: '30px', 
        borderRadius: '8px', 
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        textAlign: 'center',
        maxWidth: '600px'
      }}>
        <h1 style={{ fontSize: '24px', color: '#faad14', marginBottom: '16px' }}>
          Your Worklenz trial has expired!
        </h1>
        <p style={{ fontSize: '16px', color: '#555', marginBottom: '24px' }}>
          Please upgrade now to continue using Worklenz.
        </p>
        <button 
          style={{
            backgroundColor: '#1890ff',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            fontSize: '16px',
            cursor: 'pointer'
          }}
          onClick={() => window.location.href = '/worklenz/admin-center/billing'}
        >
          Upgrade now
        </button>
      </div>
    </div>
  );
});

StaticLicenseExpired.displayName = 'StaticLicenseExpired';

// Create route arrays (moved outside of useMemo to avoid hook violations)
const publicRoutes = [
  ...rootRoutes, 
  ...authRoutes,
  notFoundRoute
];

const protectedMainRoutes = wrapRoutes(mainRoutes, AuthGuard);
const adminRoutes = wrapRoutes(reportingRoutes, AdminGuard);
const setupRoutes = wrapRoutes([accountSetupRoute], SetupGuard);

// License expiry check function
const withLicenseExpiryCheck = (routes: RouteObject[]): RouteObject[] => {
  return routes.map(route => {
    const wrappedRoute = {
      ...route,
      element: (
        <Suspense fallback={<SuspenseFallback />}>
          <LicenseExpiryGuard>{route.element}</LicenseExpiryGuard>
        </Suspense>
      ),
    };

    if (route.children) {
      wrappedRoute.children = withLicenseExpiryCheck(route.children);
    }

    return wrappedRoute;
  });
};

const licenseCheckedMainRoutes = withLicenseExpiryCheck(protectedMainRoutes);

// Create optimized router with future flags for better performance
const router = createBrowserRouter([
  {
    element: (
      <ErrorBoundary>
        <AuthenticatedLayout />
      </ErrorBoundary>
    ),
    errorElement: (
      <ErrorBoundary>
        <Suspense fallback={<SuspenseFallback />}>
          <NotFoundPage />
        </Suspense>
      </ErrorBoundary>
    ),
    children: [
      ...licenseCheckedMainRoutes,
      ...adminRoutes,
      ...setupRoutes,
      licenseExpiredRoute,
    ],
  },
  ...publicRoutes,
], {
  // Enable React Router future features for better performance
  future: {
    v7_relativeSplatPath: true,
    v7_fetcherPersist: true,
    v7_normalizeFormMethod: true,
    v7_partialHydration: true,
    v7_skipActionErrorRevalidation: true
  }
});

export default router;
