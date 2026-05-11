// Service Worker Registration Utility
// Handles registration, updates, and error handling

import React, { startTransition } from 'react';

const isLocalhost = Boolean(
  window.location.hostname === 'localhost' ||
  window.location.hostname === '[::1]' ||
  window.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/)
);

type Config = {
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  onOfflineReady?: () => void;
  onError?: (error: Error) => void;
};

const APP_VERSION_STORAGE_KEY = 'app_version';
const LATEST_VERSION_STORAGE_KEY = 'app_latest_version';
const PENDING_UPDATE_VERSION_STORAGE_KEY = 'app_pending_update_version';
const UPDATE_REQUESTED_AT_STORAGE_KEY = 'app_update_requested_at';
const UPDATE_RELOAD_GRACE_PERIOD_MS = 60 * 1000;

declare global {
  interface Window {
    buildTimestamp?: string;
  }
}

const getLoadedBuildVersion = (): string | null => {
  return window.buildTimestamp ? window.buildTimestamp.toString() : null;
};

const syncStoredVersionWithLoadedBuild = (): string | null => {
  const loadedBuildVersion = getLoadedBuildVersion();

  if (!loadedBuildVersion) {
    return localStorage.getItem(APP_VERSION_STORAGE_KEY);
  }

  if (localStorage.getItem(APP_VERSION_STORAGE_KEY) !== loadedBuildVersion) {
    localStorage.setItem(APP_VERSION_STORAGE_KEY, loadedBuildVersion);
  }

  if (localStorage.getItem(PENDING_UPDATE_VERSION_STORAGE_KEY) === loadedBuildVersion) {
    localStorage.removeItem(PENDING_UPDATE_VERSION_STORAGE_KEY);
    localStorage.removeItem(UPDATE_REQUESTED_AT_STORAGE_KEY);
  }

  return loadedBuildVersion;
};

// Track registration state to prevent double registration
let isRegistering = false;
let registrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

export function registerSW(config?: Config) {
  if ('serviceWorker' in navigator) {
    // Check if service worker is already registered
    const checkExisting = navigator.serviceWorker.getRegistration();

    if (checkExisting) {
      return checkExisting
        .then(registration => {
          if (registration) {
            // Service worker already registered, just call callbacks if needed
            if (config) {
              if (
                config.onSuccess &&
                registration.installing === null &&
                registration.waiting === null
              ) {
                // Use setTimeout to defer callback execution outside of render phase
                setTimeout(() => {
                  try {
                    config.onSuccess?.(registration);
                  } catch (error) {
                    console.error('Error in onSuccess callback:', error);
                  }
                }, 0);
              }
            }
            return registration;
          }
          // No existing registration, continue with new registration
          return null;
        })
        .then(registration => {
          // If we got an existing registration, return it
          if (registration) {
            return registration;
          }
          // Otherwise, continue with new registration below
          return null;
        })
        .catch(() => {
          // Error checking existing registration, continue with new registration
          return null;
        })
        .then(existingReg => {
          // If we have an existing registration, return it
          if (existingReg) {
            return existingReg;
          }

          // Continue with new registration logic below
          return performNewRegistration();
        });
    }

    return performNewRegistration();
  } else {
    console.log('Service workers are not supported in this browser.');
    return Promise.resolve(null);
  }

  function performNewRegistration(): Promise<ServiceWorkerRegistration | null> {
    // Prevent double registration
    if (isRegistering && registrationPromise) {
      console.log('Service Worker registration already in progress, skipping duplicate call');
      return registrationPromise.then(registration => {
        if (registration && config) {
          // Call callbacks for the duplicate registration attempt
          if (
            config.onSuccess &&
            registration.installing === null &&
            registration.waiting === null
          ) {
            // Use setTimeout to defer callback execution outside of render phase
            setTimeout(() => {
              try {
                config.onSuccess?.(registration);
              } catch (error) {
                console.error('Error in onSuccess callback:', error);
              }
            }, 0);
          }
        }
        return registration;
      });
    }

    // Only register in production or when explicitly testing
    const swUrl = '/sw.js';

    isRegistering = true;
    registrationPromise = new Promise<ServiceWorkerRegistration | null>(resolve => {
      const registrationCallback = (registration: ServiceWorkerRegistration | null) => {
        isRegistering = false;
        resolve(registration);
      };

      if (isLocalhost) {
        // This is running on localhost. Let's check if a service worker still exists or not.
        checkValidServiceWorker(swUrl, config, registrationCallback);

        // Add some additional logging to localhost, pointing developers to the
        // service worker/PWA documentation.
        navigator.serviceWorker.ready.then(() => {
          console.log(
            'This web app is being served cache-first by a service ' +
              'worker. To learn more, visit https://bit.ly/CRA-PWA'
          );
        });
      } else {
        // Is not localhost. Just register service worker
        registerValidSW(swUrl, config, registrationCallback);
      }
    });

    return registrationPromise;
  }
}

function registerValidSW(
  swUrl: string,
  config?: Config,
  onComplete?: (registration: ServiceWorkerRegistration | null) => void
) {
  navigator.serviceWorker
    .register(swUrl)
    .then(registration => {
      console.log('Service Worker registered successfully:', registration);

      registration.onupdatefound = () => {
        const installingWorker = registration.installing;
        if (installingWorker == null) {
          return;
        }

        installingWorker.onstatechange = () => {
          if (installingWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              // At this point, the updated precached content has been fetched,
              // but the previous service worker will still serve the older
              // content until all client tabs are closed.
              console.log(
                'New content is available and will be used when all ' +
                  'tabs for this page are closed. See https://bit.ly/CRA-PWA.'
              );

              // Execute callback - defer to prevent React concurrent mode issues
              if (config && config.onUpdate) {
                setTimeout(() => {
                  try {
                    config.onUpdate?.(registration);
                  } catch (error) {
                    console.error('Error in onUpdate callback:', error);
                  }
                }, 0);
              }
            } else {
              // At this point, everything has been precached.
              // It's the perfect time to display a
              // "Content is cached for offline use." message.
              console.log('Content is cached for offline use.');

              // Execute callback - defer to prevent React concurrent mode issues
              if (config && config.onSuccess) {
                setTimeout(() => {
                  try {
                    config.onSuccess?.(registration);
                  } catch (error) {
                    console.error('Error in onSuccess callback:', error);
                  }
                }, 0);
              }

              if (config && config.onOfflineReady) {
                setTimeout(() => {
                  try {
                    config.onOfflineReady?.();
                  } catch (error) {
                    console.error('Error in onOfflineReady callback:', error);
                  }
                }, 0);
              }
            }
          }
        };
      };

      if (onComplete) {
        onComplete(registration);
      }
    })
    .catch(error => {
      console.error('Error during service worker registration:', error);
      if (config && config.onError) {
        // Defer error callback to prevent React concurrent mode issues
        setTimeout(() => {
          try {
            config.onError?.(error);
          } catch (callbackError) {
            console.error('Error in onError callback:', callbackError);
          }
        }, 0);
      }
      if (onComplete) {
        onComplete(null);
      }
    });
}

function checkValidServiceWorker(
  swUrl: string,
  config?: Config,
  onComplete?: (registration: ServiceWorkerRegistration | null) => void
) {
  // Check if the service worker can be found. If it can't reload the page.
  fetch(swUrl, {
    headers: { 'Service-Worker': 'script' },
  })
    .then(response => {
      // Ensure service worker exists, and that we really are getting a JS file.
      const contentType = response.headers.get('content-type');
      if (
        response.status === 404 ||
        (contentType != null && contentType.indexOf('javascript') === -1)
      ) {
        // No service worker found. Probably a different app. Reload the page.
        navigator.serviceWorker.ready.then(registration => {
          registration.unregister().then(() => {
            window.location.reload();
          });
        });
        if (onComplete) {
          onComplete(null);
        }
      } else {
        // Service worker found. Proceed as normal.
        registerValidSW(swUrl, config, onComplete);
      }
    })
    .catch(() => {
      console.log('No internet connection found. App is running in offline mode.');
      if (onComplete) {
        onComplete(null);
      }
    });
}

export function unregisterSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then(registration => {
        registration.unregister();
        console.log('Service Worker unregistered successfully');
      })
      .catch(error => {
        console.error('Error during service worker unregistration:', error);
      });
  }
}

// Utility to communicate with service worker
export class ServiceWorkerManager {
  private registration: ServiceWorkerRegistration | null = null;

  constructor(registration?: ServiceWorkerRegistration) {
    this.registration = registration || null;
  }

  // Send message to service worker
  async sendMessage(type: string, payload?: any): Promise<any> {
    if (!this.registration || !this.registration.active) {
      throw new Error('Service Worker not available');
    }

    return new Promise((resolve, reject) => {
      const messageChannel = new MessageChannel();

      messageChannel.port1.onmessage = event => {
        if (event.data.error) {
          reject(event.data.error);
        } else {
          resolve(event.data);
        }
      };

      this.registration!.active!.postMessage({ type, payload }, [messageChannel.port2]);

      // Timeout after 5 seconds
      setTimeout(() => {
        reject(new Error('Service Worker message timeout'));
      }, 5000);
    });
  }

  // Get service worker version
  async getVersion(): Promise<string> {
    try {
      const response = await this.sendMessage('GET_VERSION');
      return response.version;
    } catch (error) {
      console.error('Failed to get service worker version:', error);
      return 'unknown';
    }
  }

  // Clear all caches
  async clearCache(): Promise<boolean> {
    try {
      await this.sendMessage('CLEAR_CACHE');
      return true;
    } catch (error) {
      console.error('Failed to clear cache:', error);
      return false;
    }
  }

  // Check for updates by comparing version.json
  async checkForUpdates(): Promise<boolean> {
    try {
      const currentVersion = syncStoredVersionWithLoadedBuild();

      // Fetch latest version.json (bypassing all caches)
      const response = await fetch('/version.json?' + Date.now(), {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      });

      if (!response.ok) {
        console.warn('Failed to fetch version.json:', response.status);
        return false;
      }

      const versionData = await response.json();
      const latestVersion = versionData.buildId || versionData.buildTime;

      if (!latestVersion) {
        console.warn('Invalid version data received');
        return false;
      }

      const latestVersionString = latestVersion.toString();
      localStorage.setItem(LATEST_VERSION_STORAGE_KEY, latestVersionString);

      // First time check - store current version
      if (!currentVersion) {
        localStorage.setItem(APP_VERSION_STORAGE_KEY, latestVersionString);
        console.log('Initial version stored:', latestVersion);
        return false;
      }

      const pendingVersion = localStorage.getItem(PENDING_UPDATE_VERSION_STORAGE_KEY);
      const reloadRequestedAt = Number(
        localStorage.getItem(UPDATE_REQUESTED_AT_STORAGE_KEY) || '0'
      );
      const isWaitingForRequestedReload =
        pendingVersion === latestVersionString &&
        Date.now() - reloadRequestedAt < UPDATE_RELOAD_GRACE_PERIOD_MS;

      if (isWaitingForRequestedReload) {
        return false;
      }

      const loadedBuildVersion = getLoadedBuildVersion();

      // Compare versions against both the stored baseline and the currently loaded build.
      const hasUpdate =
        currentVersion !== latestVersionString && loadedBuildVersion !== latestVersionString;

      if (hasUpdate) {
        console.log('New version detected:', {
          current: currentVersion,
          latest: latestVersion,
        });
      }

      return hasUpdate;
    } catch (error) {
      console.error('Failed to check for updates:', error);
      return false;
    }
  }

  // Force update service worker
  async forceUpdate(): Promise<void> {
    if (!this.registration) return;

    try {
      // Update stored version before reload
      const response = await fetch('/version.json?' + Date.now(), {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });

      if (response.ok) {
        const versionData = await response.json();
        const latestVersion = versionData.buildId || versionData.buildTime;
        if (latestVersion) {
          const latestVersionString = latestVersion.toString();
          localStorage.setItem(APP_VERSION_STORAGE_KEY, latestVersionString);
          localStorage.setItem(LATEST_VERSION_STORAGE_KEY, latestVersionString);
          localStorage.setItem(PENDING_UPDATE_VERSION_STORAGE_KEY, latestVersionString);
          localStorage.setItem(UPDATE_REQUESTED_AT_STORAGE_KEY, Date.now().toString());
        }
      }

      await this.registration.update();
      await this.sendMessage('SKIP_WAITING');
      window.location.reload();
    } catch (error) {
      console.error('Failed to force update service worker:', error);
      throw error;
    }
  }

  // Perform hard reload (clear cache and reload)
  async hardReload(): Promise<void> {
    try {
      // Update stored version before reload
      const response = await fetch('/version.json?' + Date.now(), {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });

      if (response.ok) {
        const versionData = await response.json();
        const latestVersion = versionData.buildId || versionData.buildTime;
        if (latestVersion) {
          const latestVersionString = latestVersion.toString();
          localStorage.setItem(APP_VERSION_STORAGE_KEY, latestVersionString);
          localStorage.setItem(LATEST_VERSION_STORAGE_KEY, latestVersionString);
          localStorage.setItem(PENDING_UPDATE_VERSION_STORAGE_KEY, latestVersionString);
          localStorage.setItem(UPDATE_REQUESTED_AT_STORAGE_KEY, Date.now().toString());
        }
      }

      // Clear all caches first
      await this.clearCache();

      // Force update the service worker
      if (this.registration) {
        await this.registration.update();
        await this.sendMessage('SKIP_WAITING');
      }

      // Perform hard reload by clearing browser cache
      window.location.reload();
    } catch (error) {
      console.error('Failed to perform hard reload:', error);
      // Fallback to regular reload
      window.location.reload();
    }
  }

  // Check if app is running offline
  isOffline(): boolean {
    return !navigator.onLine;
  }

  // Get cache storage estimate
  async getCacheSize(): Promise<StorageEstimate | null> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        return await navigator.storage.estimate();
      } catch (error) {
        console.error('Failed to get storage estimate:', error);
      }
    }
    return null;
  }
}

// Hook to use service worker in React components
export function useServiceWorker() {
  const [isOffline, setIsOffline] = React.useState(!navigator.onLine);
  const [swManager, setSWManager] = React.useState<ServiceWorkerManager | null>(null);

  React.useEffect(() => {
    const handleOnline = () => {
      // Use startTransition for non-urgent state updates to prevent concurrent mode errors
      startTransition(() => {
        setIsOffline(false);
      });
    };
    const handleOffline = () => {
      startTransition(() => {
        setIsOffline(true);
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Register service worker - this will safely handle duplicate calls
    registerSW({
      onSuccess: registration => {
        // Use startTransition and setTimeout to defer state update outside render phase
        setTimeout(() => {
          startTransition(() => {
            setSWManager(new ServiceWorkerManager(registration));
          });
        }, 0);
      },
      onUpdate: registration => {
        // You could show a toast here asking user to refresh
        console.log('New version available');
        // Use startTransition and setTimeout to defer state update outside render phase
        setTimeout(() => {
          startTransition(() => {
            setSWManager(new ServiceWorkerManager(registration));
          });
        }, 0);
      },
      onOfflineReady: () => {
        console.log('App ready for offline use');
      },
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    isOffline,
    swManager,
    clearCache: () => swManager?.clearCache(),
    forceUpdate: () => swManager?.forceUpdate(),
    hardReload: () => swManager?.hardReload(),
    checkForUpdates: () => swManager?.checkForUpdates(),
    getVersion: () => swManager?.getVersion(),
  };
}
