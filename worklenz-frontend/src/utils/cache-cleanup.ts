/**
 * Cache cleanup utilities for logout operations
 * Handles clearing of various caches to prevent stale data issues
 */

export class CacheCleanup {
  /**
   * Clear all caches including service worker, browser cache, and storage
   */
  static async clearAllCaches(): Promise<void> {
    try {
      console.log('CacheCleanup: Starting cache clearing process...');

      // Clear browser caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        console.log('CacheCleanup: Found caches:', cacheNames);

        await Promise.all(
          cacheNames.map(async cacheName => {
            const deleted = await caches.delete(cacheName);
            console.log(`CacheCleanup: Deleted cache "${cacheName}":`, deleted);
            return deleted;
          })
        );
        console.log('CacheCleanup: Browser caches cleared');
      } else {
        console.log('CacheCleanup: Cache API not supported');
      }

      // Clear service worker cache
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          console.log('CacheCleanup: Found service worker registration');

          // Send logout message to service worker to clear its caches and unregister
          if (registration.active) {
            try {
              console.log('CacheCleanup: Sending LOGOUT message to service worker...');
              await this.sendMessageToServiceWorker('LOGOUT');
              console.log('CacheCleanup: LOGOUT message sent successfully');
            } catch (error) {
              console.warn('CacheCleanup: Failed to send logout message to service worker:', error);
              // Fallback: try to clear cache manually
              try {
                console.log('CacheCleanup: Trying fallback CLEAR_CACHE message...');
                await this.sendMessageToServiceWorker('CLEAR_CACHE');
                console.log('CacheCleanup: CLEAR_CACHE message sent successfully');
              } catch (fallbackError) {
                console.warn('CacheCleanup: Failed to clear service worker cache:', fallbackError);
              }
            }
          }

          // If service worker is still registered, unregister it
          if (registration.active) {
            console.log('CacheCleanup: Unregistering service worker...');
            await registration.unregister();
            console.log('CacheCleanup: Service worker unregistered');
          }
        } else {
          console.log('CacheCleanup: No service worker registration found');
        }
      } else {
        console.log('CacheCleanup: Service Worker not supported');
      }

      // Clear localStorage and sessionStorage
      const localStorageKeys = Object.keys(localStorage);
      const sessionStorageKeys = Object.keys(sessionStorage);

      console.log('CacheCleanup: Clearing localStorage keys:', localStorageKeys);
      console.log('CacheCleanup: Clearing sessionStorage keys:', sessionStorageKeys);

      localStorage.clear();
      sessionStorage.clear();
      console.log('CacheCleanup: Local storage cleared');

      console.log('CacheCleanup: Cache clearing process completed successfully');
    } catch (error) {
      console.error('CacheCleanup: Error clearing caches:', error);
      throw error;
    }
  }

  /**
   * Send message to service worker
   */
  private static async sendMessageToServiceWorker(type: string, payload?: any): Promise<any> {
    if (!('serviceWorker' in navigator)) {
      throw new Error('Service Worker not supported');
    }

    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration || !registration.active) {
      throw new Error('Service Worker not active');
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

      registration.active!.postMessage({ type, payload }, [messageChannel.port2]);

      // Timeout after 5 seconds
      setTimeout(() => {
        reject(new Error('Service Worker message timeout'));
      }, 5000);
    });
  }

  /**
   * Force reload the page to ensure fresh state
   */
  static forceReload(url: string = '/auth/login'): void {
    // Use replace to prevent back button issues
    window.location.replace(url);
  }

  /**
   * Clear specific cache types
   */
  static async clearSpecificCaches(cacheTypes: string[]): Promise<void> {
    if (!('caches' in window)) return;

    const cacheNames = await caches.keys();
    const cachesToDelete = cacheNames.filter(name => cacheTypes.some(type => name.includes(type)));

    await Promise.all(cachesToDelete.map(cacheName => caches.delete(cacheName)));
  }

  /**
   * Clear API cache specifically
   */
  static async clearAPICache(): Promise<void> {
    await this.clearSpecificCaches(['api', 'dynamic']);
  }

  /**
   * Clear static asset cache
   */
  static async clearStaticCache(): Promise<void> {
    await this.clearSpecificCaches(['static', 'images']);
  }
}

export default CacheCleanup;
