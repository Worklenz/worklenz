import { useEffect } from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import { setUser, setTag, addBreadcrumb } from '@/config/sentry';

// Hook to integrate Sentry with Redux state and user tracking
export const useSentryIntegration = () => {
  const user = useAppSelector((state: any) => state.auth?.user);
  const theme = useAppSelector((state: any) => state.userReducer?.theme);
  const organization = useAppSelector(
    (state: any) => state.organizationReducer?.currentOrganization
  );

  useEffect(() => {
    // Set user context in Sentry when user data changes
    if (user) {
      setUser({
        id: user.id,
        email: user.email,
        username: user.name || user.email,
        // Add any other relevant user fields
        segment: user.role || 'user',
      });

      // Add user-specific tags
      setTag('userId', user.id);
      setTag('userEmail', user.email);
      setTag('userRole', user.role || 'user');
    } else {
      // Clear user context when logged out
      setUser(null);
    }
  }, [user]);

  useEffect(() => {
    // Set theme tag
    if (theme) {
      setTag('theme', theme);
      addBreadcrumb({
        category: 'ui',
        message: `Theme changed to ${theme}`,
        level: 'info',
      });
    }
  }, [theme]);

  useEffect(() => {
    // Set organization context
    if (organization) {
      setTag('organizationId', organization.id);
      setTag('organizationName', organization.name);

      addBreadcrumb({
        category: 'organization',
        message: `Organization context: ${organization.name}`,
        level: 'info',
        data: {
          organizationId: organization.id,
          organizationName: organization.name,
        },
      });
    }
  }, [organization]);
};

// Enhanced analytics tracking with Sentry integration
export const trackAnalyticsEvent = (eventName: string, properties?: Record<string, any>) => {
  // Add breadcrumb for analytics event
  addBreadcrumb({
    category: 'analytics',
    message: eventName,
    level: 'info',
    data: properties,
  });

  // Set event as tag for easier filtering in Sentry
  setTag('lastAnalyticsEvent', eventName);
};

// Performance tracking helper
export const trackPerformance = (operationName: string, startTime: number, endTime?: number) => {
  const duration = endTime ? endTime - startTime : performance.now() - startTime;

  addBreadcrumb({
    category: 'performance',
    message: `${operationName} completed`,
    level: 'info',
    data: {
      operation: operationName,
      duration: Math.round(duration),
      durationMs: Math.round(duration),
    },
  });

  // Set performance tag
  setTag(`perf_${operationName}`, `${Math.round(duration)}ms`);
};

// Error tracking helper for API calls
export const trackApiError = (error: any, endpoint: string, method: string, payload?: any) => {
  addBreadcrumb({
    category: 'api',
    message: `API Error: ${method} ${endpoint}`,
    level: 'error',
    data: {
      endpoint,
      method,
      status: error?.response?.status,
      statusText: error?.response?.statusText,
      errorCode: error?.code,
      payload: payload ? JSON.stringify(payload) : undefined,
    },
  });

  // Set error context tags
  setTag('lastApiError', endpoint);
  setTag('lastApiStatus', error?.response?.status?.toString() || 'unknown');
};

// Feature usage tracking
export const trackFeatureUsage = (
  featureName: string,
  action: string,
  properties?: Record<string, any>
) => {
  const eventName = `${featureName}_${action}`;

  addBreadcrumb({
    category: 'feature',
    message: eventName,
    level: 'info',
    data: {
      feature: featureName,
      action,
      ...properties,
    },
  });

  setTag('lastFeatureUsed', featureName);
  setTag('lastFeatureAction', action);
};

export default useSentryIntegration;
