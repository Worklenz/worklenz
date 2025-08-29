// Service Worker Registration Utility
// Handles registration, updates, and error handling

import React from 'react';

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

export function registerSW(config?: Config) {
  if ('serviceWorker' in navigator) {
    // Only register in production or when explicitly testing
    const swUrl = '/sw.js';

    if (isLocalhost) {
      // This is running on localhost. Let's check if a service worker still exists or not.
      checkValidServiceWorker(swUrl, config);

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
      registerValidSW(swUrl, config);
    }
  } else {
    console.log('Service workers are not supported in this browser.');
  }
}

function registerValidSW(swUrl: string, config?: Config) {
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

              // Execute callback
              if (config && config.onUpdate) {
                config.onUpdate(registration);
              }
            } else {
              // At this point, everything has been precached.
              // It's the perfect time to display a
              // "Content is cached for offline use." message.
              console.log('Content is cached for offline use.');

              // Execute callback
              if (config && config.onSuccess) {
                config.onSuccess(registration);
              }

              if (config && config.onOfflineReady) {
                config.onOfflineReady();
              }
            }
          }
        };
      };
    })
    .catch(error => {
      console.error('Error during service worker registration:', error);
      if (config && config.onError) {
        config.onError(error);
      }
    });
}

function checkValidServiceWorker(swUrl: string, config?: Config) {
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
      } else {
        // Service worker found. Proceed as normal.
        registerValidSW(swUrl, config);
      }
    })
    .catch(() => {
      console.log('No internet connection found. App is running in offline mode.');
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

  // Check for updates
  async checkForUpdates(): Promise<boolean> {
    try {
      const response = await this.sendMessage('CHECK_FOR_UPDATES');
      return response.hasUpdates;
    } catch (error) {
      console.error('Failed to check for updates:', error);
      return false;
    }
  }

  // Force update service worker
  async forceUpdate(): Promise<void> {
    if (!this.registration) return;

    try {
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
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Register service worker
    registerSW({
      onSuccess: registration => {
        setSWManager(new ServiceWorkerManager(registration));
      },
      onUpdate: registration => {
        // You could show a toast here asking user to refresh
        console.log('New version available');
        setSWManager(new ServiceWorkerManager(registration));
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
