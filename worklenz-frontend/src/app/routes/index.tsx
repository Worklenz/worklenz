import { createBrowserRouter, Navigate, RouteObject, useLocation } from 'react-router-dom';
import { lazy, Suspense, memo, useMemo } from 'react';
import rootRoutes from './root-routes';
import authRoutes from './auth-routes';
import mainRoutes, { licenseExpiredRoute } from './main-routes';
import notFoundRoute from './not-found-route';
import accountSetupRoute from './account-setup-routes';
import reportingRoutes from './reporting-routes';
import clientPortalRoutes from './client-portal-routes';
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
import { useAuthStatus } from '@/hooks/useAuthStatus';
import clientViewRoutes from './client-view-routes';

export const AuthGuard = memo(({ children }: GuardProps) => {
  const { isAuthenticated, location } = useAuthStatus();

  if (!isAuthenticated) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  return <>{children}</>;
});

AuthGuard.displayName = 'AuthGuard';

export const AdminGuard = memo(({ children }: GuardProps) => {
  const { isAuthenticated, isAdmin, location } = useAuthStatus();

  if (!isAuthenticated) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/worklenz/unauthorized" />;
  }

  return <>{children}</>;
});

AdminGuard.displayName = 'AdminGuard';

export const LicenseExpiryGuard = memo(({ children }: GuardProps) => {
  const { isLicenseExpired, location } = useAuthStatus();

  const isAdminCenterRoute = location.pathname.includes('/worklenz/admin-center');
  const isLicenseExpiredRoute = location.pathname === '/worklenz/license-expired';

  if (isLicenseExpired && !isAdminCenterRoute && !isLicenseExpiredRoute) {
    return <Navigate to="/worklenz/license-expired" replace />;
  }

  return <>{children}</>;
});

LicenseExpiryGuard.displayName = 'LicenseExpiryGuard';

export const SetupGuard = memo(({ children }: GuardProps) => {
  const { isAuthenticated, isSetupComplete, location } = useAuthStatus();

  if (!isAuthenticated) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (!isSetupComplete) {
    return <Navigate to="/worklenz/setup" />;
  }

  return <>{children}</>;
});

SetupGuard.displayName = 'SetupGuard';

// Combined guard for routes that require both authentication and setup completion
export const AuthAndSetupGuard = memo(({ children }: GuardProps) => {
  const { isAuthenticated, isSetupComplete, location } = useAuthStatus();

  if (!isAuthenticated) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (!isSetupComplete) {
    return <Navigate to="/worklenz/setup" />;
  }

  return <>{children}</>;
});

AuthAndSetupGuard.displayName = 'AuthAndSetupGuard';

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
    <div
      style={{
        marginTop: 65,
        minHeight: '90vh',
        backgroundColor: '#f5f5f5',
        padding: '20px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          background: 'white',
          padding: '30px',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          textAlign: 'center',
          maxWidth: '600px',
        }}
      >
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
            cursor: 'pointer',
          }}
          onClick={() => (window.location.href = '/worklenz/admin-center/billing')}
        >
          Upgrade now
        </button>
      </div>
    </div>
  );
});

StaticLicenseExpired.displayName = 'StaticLicenseExpired';

// Create route arrays (moved outside of useMemo to avoid hook violations)
const publicRoutes = [...rootRoutes, ...authRoutes, notFoundRoute];

// Apply combined guard to main routes that require both auth and setup completion
const protectedMainRoutes = wrapRoutes(mainRoutes, AuthAndSetupGuard);
const adminRoutes = wrapRoutes(reportingRoutes, AdminGuard);
const adminclientPortalRoutes = wrapRoutes(clientPortalRoutes, AdminGuard);
const setupRoutes = wrapRoutes([accountSetupRoute], AuthGuard);

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
const router = createBrowserRouter(
  [
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
      children: [...licenseCheckedMainRoutes, ...adminRoutes, ...adminclientPortalRoutes, ...clientViewRoutes , ...setupRoutes, licenseExpiredRoute],
    },
    ...publicRoutes,
  ],
  {
    // Enable React Router future features for better performance
    future: {
      v7_relativeSplatPath: true,
      v7_fetcherPersist: true,
      v7_normalizeFormMethod: true,
      v7_partialHydration: true,
      v7_skipActionErrorRevalidation: true,
    },
  }
);

export default router;
