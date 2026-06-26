// Update Checker Hook
// Periodically checks for app updates and manages update notifications

import React from 'react';
import { useServiceWorker } from '../utils/serviceWorkerRegistration';

const LATEST_VERSION_STORAGE_KEY = 'app_latest_version';
const DISMISSED_UPDATE_VERSION_STORAGE_KEY = 'app_dismissed_update_version';

interface UseUpdateCheckerOptions {
  checkInterval?: number; // Check interval in milliseconds (default: 5 minutes)
  enableAutoCheck?: boolean; // Enable automatic checking (default: true)
  showNotificationOnUpdate?: boolean; // Show notification when update is found (default: true)
}

interface UseUpdateCheckerReturn {
  hasUpdate: boolean;
  isChecking: boolean;
  lastChecked: Date | null;
  checkForUpdates: () => Promise<void>;
  dismissUpdate: () => void;
  showUpdateNotification: boolean;
  setShowUpdateNotification: (show: boolean) => void;
}

export function useUpdateChecker(options: UseUpdateCheckerOptions = {}): UseUpdateCheckerReturn {
  const {
    checkInterval = 5 * 60 * 1000, // 5 minutes
    enableAutoCheck = true,
    showNotificationOnUpdate = true,
  } = options;

  const { checkForUpdates: serviceWorkerCheckUpdates, swManager } = useServiceWorker();

  const [hasUpdate, setHasUpdate] = React.useState(false);
  const [isChecking, setIsChecking] = React.useState(false);
  const [lastChecked, setLastChecked] = React.useState<Date | null>(null);
  const [showUpdateNotification, setShowUpdateNotification] = React.useState(false);
  const [dismissedVersion, setDismissedVersion] = React.useState<string | null>(() =>
    localStorage.getItem(DISMISSED_UPDATE_VERSION_STORAGE_KEY)
  );
  const isCheckingRef = React.useRef(false);

  // Check for updates function
  const checkForUpdates = React.useCallback(async () => {
    if (!serviceWorkerCheckUpdates || isCheckingRef.current) return;

    isCheckingRef.current = true;
    setIsChecking(true);
    try {
      const hasUpdates = await serviceWorkerCheckUpdates();
      const latestVersion = localStorage.getItem(LATEST_VERSION_STORAGE_KEY);
      setHasUpdate(hasUpdates);
      setLastChecked(new Date());

      // Show notification if update found and user hasn't dismissed it
      if (hasUpdates && showNotificationOnUpdate && latestVersion !== dismissedVersion) {
        setShowUpdateNotification(true);
      } else if (!hasUpdates) {
        setShowUpdateNotification(false);
      }
    } catch (error) {
      console.error('Error checking for updates:', error);
    } finally {
      isCheckingRef.current = false;
      setIsChecking(false);
    }
  }, [serviceWorkerCheckUpdates, showNotificationOnUpdate, dismissedVersion]);

  // Dismiss update notification
  const dismissUpdate = React.useCallback(() => {
    const latestVersion = localStorage.getItem(LATEST_VERSION_STORAGE_KEY);
    if (latestVersion) {
      localStorage.setItem(DISMISSED_UPDATE_VERSION_STORAGE_KEY, latestVersion);
    }
    setDismissedVersion(latestVersion);
    setShowUpdateNotification(false);
  }, []);

  // Set up automatic checking interval
  React.useEffect(() => {
    if (!enableAutoCheck || !swManager) return;

    // Initial check after a short delay
    const initialTimeout = setTimeout(() => {
      checkForUpdates();
    }, 10000); // 10 seconds after component mount

    // Set up interval for periodic checks
    const intervalId = setInterval(() => {
      checkForUpdates();
    }, checkInterval);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(intervalId);
    };
  }, [enableAutoCheck, swManager, checkInterval, checkForUpdates]);

  // Listen for visibility change to check for updates when user returns to tab
  React.useEffect(() => {
    if (!enableAutoCheck) return;

    const handleVisibilityChange = () => {
      if (!document.hidden && swManager) {
        // Check for updates when user returns to the tab
        setTimeout(() => {
          checkForUpdates();
        }, 2000); // 2 second delay
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enableAutoCheck, swManager, checkForUpdates]);

  // Listen for focus events to check for updates
  React.useEffect(() => {
    if (!enableAutoCheck) return;

    const handleFocus = () => {
      if (swManager) {
        // Check for updates when window regains focus
        setTimeout(() => {
          checkForUpdates();
        }, 1000); // 1 second delay
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [enableAutoCheck, swManager, checkForUpdates]);

  React.useEffect(() => {
    if (!hasUpdate && dismissedVersion) {
      localStorage.removeItem(DISMISSED_UPDATE_VERSION_STORAGE_KEY);
      setDismissedVersion(null);
    }
  }, [hasUpdate, dismissedVersion]);

  return {
    hasUpdate,
    isChecking,
    lastChecked,
    checkForUpdates,
    dismissUpdate,
    showUpdateNotification,
    setShowUpdateNotification,
  };
}
