import React from 'react';

/**
 * Route preloader utility to prefetch components and improve navigation performance
 */

interface PreloadableRoute {
  path: string;
  loader: () => Promise<any>;
  priority: 'high' | 'medium' | 'low';
}

class RoutePreloader {
  private preloadedRoutes = new Set<string>();
  private preloadQueue: PreloadableRoute[] = [];
  private isPreloading = false;

  /**
   * Register a route for preloading
   */
  public registerRoute(
    path: string,
    loader: () => Promise<any>,
    priority: 'high' | 'medium' | 'low' = 'medium'
  ): void {
    if (this.preloadedRoutes.has(path)) return;

    this.preloadQueue.push({ path, loader, priority });
    this.sortQueue();
  }

  /**
   * Preload a specific route immediately
   */
  public async preloadRoute(path: string, loader: () => Promise<any>): Promise<void> {
    if (this.preloadedRoutes.has(path)) return;

    try {
      await loader();
      this.preloadedRoutes.add(path);
    } catch (error) {
      console.warn(`Failed to preload route: ${path}`, error);
    }
  }

  /**
   * Start preloading routes in the queue
   */
  public async startPreloading(): Promise<void> {
    if (this.isPreloading || this.preloadQueue.length === 0) return;

    this.isPreloading = true;

    // Use requestIdleCallback if available, otherwise setTimeout
    const scheduleWork = (callback: () => void) => {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(callback, { timeout: 1000 });
      } else {
        setTimeout(callback, 0);
      }
    };

    const processQueue = async () => {
      while (this.preloadQueue.length > 0) {
        const route = this.preloadQueue.shift();
        if (!route) break;

        if (this.preloadedRoutes.has(route.path)) continue;

        try {
          await route.loader();
          this.preloadedRoutes.add(route.path);
        } catch (error) {
          console.warn(`Failed to preload route: ${route.path}`, error);
        }

        // Yield control back to the browser
        await new Promise<void>(resolve => scheduleWork(() => resolve()));
      }

      this.isPreloading = false;
    };

    scheduleWork(processQueue);
  }

  /**
   * Preload routes on user interaction (hover, focus)
   */
  public preloadOnInteraction(
    element: HTMLElement,
    path: string,
    loader: () => Promise<any>
  ): void {
    if (this.preloadedRoutes.has(path)) return;

    let preloadTriggered = false;

    const handleInteraction = () => {
      if (preloadTriggered) return;
      preloadTriggered = true;

      this.preloadRoute(path, loader);

      // Clean up listeners
      element.removeEventListener('mouseenter', handleInteraction);
      element.removeEventListener('focus', handleInteraction);
      element.removeEventListener('touchstart', handleInteraction);
    };

    element.addEventListener('mouseenter', handleInteraction, { passive: true });
    element.addEventListener('focus', handleInteraction, { passive: true });
    element.addEventListener('touchstart', handleInteraction, { passive: true });
  }

  /**
   * Preload routes when the browser is idle
   */
  public preloadOnIdle(): void {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(
        () => {
          this.startPreloading();
        },
        { timeout: 2000 }
      );
    } else {
      setTimeout(() => {
        this.startPreloading();
      }, 1000);
    }
  }

  /**
   * Check if a route is already preloaded
   */
  public isRoutePreloaded(path: string): boolean {
    return this.preloadedRoutes.has(path);
  }

  /**
   * Clear all preloaded routes
   */
  public clearPreloaded(): void {
    this.preloadedRoutes.clear();
    this.preloadQueue = [];
  }

  private sortQueue(): void {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    this.preloadQueue.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  }
}

// Create default instance
export const routePreloader = new RoutePreloader();

/**
 * React hook to preload routes on component mount
 */
export function useRoutePreloader(
  routes: Array<{ path: string; loader: () => Promise<any>; priority?: 'high' | 'medium' | 'low' }>
): void {
  React.useEffect(() => {
    routes.forEach(route => {
      routePreloader.registerRoute(route.path, route.loader, route.priority);
    });

    // Start preloading after a short delay to not interfere with initial render
    const timer = setTimeout(() => {
      routePreloader.preloadOnIdle();
    }, 100);

    return () => clearTimeout(timer);
  }, [routes]);
}

/**
 * React hook to preload a route on element interaction
 */
export function usePreloadOnHover(path: string, loader: () => Promise<any>) {
  const elementRef = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    routePreloader.preloadOnInteraction(element, path, loader);
  }, [path, loader]);

  return elementRef;
}

export default routePreloader;
