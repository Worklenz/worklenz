/**
 * Chunk Error Handler
 * Handles dynamic import failures caused by stale chunks after deployment
 */

interface ChunkErrorHandlerOptions {
  maxRetries?: number;
  retryDelay?: number;
  onError?: (error: Error) => void;
}

export class ChunkErrorHandler {
  private static retryCount = 0;
  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAY = 1000;
  private static isReloading = false;

  /**
   * Check if error is a chunk loading error
   */
  static isChunkError(error: any): boolean {
    if (!error) return false;

    const errorMessage = error.message || error.toString();
    const errorName = error.name || '';

    return (
      errorMessage.includes('Failed to fetch dynamically imported module') ||
      errorMessage.includes('Loading chunk') ||
      errorMessage.includes('ChunkLoadError') ||
      errorMessage.includes('Loading CSS chunk') ||
      errorName === 'ChunkLoadError' ||
      (errorName === 'TypeError' && errorMessage.includes('fetch'))
    );
  }

  /**
   * Handle chunk loading error with retry logic
   */
  static async handleChunkError(
    error: Error,
    options: ChunkErrorHandlerOptions = {}
  ): Promise<void> {
    const { maxRetries = this.MAX_RETRIES, retryDelay = this.RETRY_DELAY, onError } = options;

    console.error('ChunkErrorHandler: Chunk loading error detected', {
      error: error.message,
      retryCount: this.retryCount,
      maxRetries,
    });

    // Prevent multiple simultaneous reloads
    if (this.isReloading) {
      console.log('ChunkErrorHandler: Reload already in progress, skipping');
      return;
    }

    // Call error callback if provided
    if (onError) {
      try {
        onError(error);
      } catch (callbackError) {
        console.error('ChunkErrorHandler: Error in callback', callbackError);
      }
    }

    // If we haven't exceeded retry limit, try to reload
    if (this.retryCount < maxRetries) {
      this.retryCount++;
      console.log(
        `ChunkErrorHandler: Attempting retry ${this.retryCount}/${maxRetries} after ${retryDelay}ms`
      );

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, retryDelay));

      // Try to reload the page
      this.performHardReload();
    } else {
      console.error('ChunkErrorHandler: Max retries exceeded, performing hard reload');
      this.performHardReload();
    }
  }

  /**
   * Perform hard reload with cache clearing
   */
  static async performHardReload(): Promise<void> {
    if (this.isReloading) return;

    this.isReloading = true;

    try {
      console.log('ChunkErrorHandler: Performing hard reload with cache clear');

      // Clear all caches
      await this.clearAllCaches();

      // Force reload with cache bypass
      window.location.reload();
    } catch (error) {
      console.error('ChunkErrorHandler: Error during hard reload', error);
      // Fallback to simple reload
      window.location.reload();
    }
  }

  /**
   * Clear all browser caches
   */
  private static async clearAllCaches(): Promise<void> {
    try {
      // Clear Cache Storage API
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
        console.log('ChunkErrorHandler: Cleared Cache Storage API');
      }

      // Clear Service Worker caches
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration?.active) {
          // Send message to service worker to clear its caches
          const messageChannel = new MessageChannel();
          registration.active.postMessage({ type: 'CLEAR_CACHE' }, [messageChannel.port2]);
        }
      }

      // Clear session storage (but preserve critical data)
      const preserveKeys = ['i18nextLng', 'theme'];
      const sessionData: Record<string, string> = {};

      preserveKeys.forEach(key => {
        const value = sessionStorage.getItem(key);
        if (value) sessionData[key] = value;
      });

      sessionStorage.clear();

      // Restore preserved data
      Object.entries(sessionData).forEach(([key, value]) => {
        sessionStorage.setItem(key, value);
      });

      console.log('ChunkErrorHandler: Cleared session storage (preserved critical keys)');
    } catch (error) {
      console.error('ChunkErrorHandler: Error clearing caches', error);
    }
  }

  /**
   * Reset retry counter (call this on successful navigation)
   */
  static resetRetryCount(): void {
    this.retryCount = 0;
    this.isReloading = false;
  }

  /**
   * Create a lazy import wrapper with error handling
   */
  static wrapLazyImport<T extends React.ComponentType<any>>(
    importFn: () => Promise<{ default: T }>,
    componentName: string = 'Component'
  ): () => Promise<{ default: T }> {
    return async () => {
      try {
        return await importFn();
      } catch (error: any) {
        if (this.isChunkError(error)) {
          console.error(
            `ChunkErrorHandler: Failed to load ${componentName}, attempting recovery`,
            error
          );

          // Handle the error
          await this.handleChunkError(error);

          // This will never return as we reload the page
          throw error;
        }

        // Re-throw non-chunk errors
        throw error;
      }
    };
  }

  /**
   * Add global error listeners for chunk errors
   */
  static setupGlobalHandlers(): void {
    // Handle unhandled promise rejections (for dynamic imports)
    window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
      if (this.isChunkError(event.reason)) {
        console.error('ChunkErrorHandler: Unhandled chunk error', event.reason);
        event.preventDefault();
        this.handleChunkError(event.reason);
      }
    });

    // Handle global errors
    window.addEventListener('error', (event: ErrorEvent) => {
      if (this.isChunkError(event.error)) {
        console.error('ChunkErrorHandler: Global chunk error', event.error);
        event.preventDefault();
        this.handleChunkError(event.error);
      }
    });

    console.log('ChunkErrorHandler: Global handlers registered');
  }

  /**
   * Remove global error listeners
   */
  static removeGlobalHandlers(): void {
    // Note: We can't easily remove the listeners without keeping references
    // This is intentional as we want these to persist
    console.log('ChunkErrorHandler: Global handlers cleanup requested (no-op)');
  }
}

export default ChunkErrorHandler;
