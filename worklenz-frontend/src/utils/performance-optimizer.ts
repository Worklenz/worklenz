// Performance optimization utility for reducing long tasks and improving frame rate

import React from 'react';

interface PerformanceMetrics {
  longTaskCount: number;
  averageLongTaskDuration: number;
  frameRate: number;
  memoryUsage: number;
  layoutThrashingCount: number;
}

class PerformanceOptimizer {
  private longTaskObserver: PerformanceObserver | null = null;
  private frameRateObserver: PerformanceObserver | null = null;
  private layoutThrashingCount = 0;
  private metrics: PerformanceMetrics = {
    longTaskCount: 0,
    averageLongTaskDuration: 0,
    frameRate: 0,
    memoryUsage: 0,
    layoutThrashingCount: 0,
  };

  constructor() {
    this.initializeObservers();
  }

  private initializeObservers() {
    // Monitor long tasks
    if ('PerformanceObserver' in window) {
      this.longTaskObserver = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'longtask') {
            this.metrics.longTaskCount++;
            this.metrics.averageLongTaskDuration =
              (this.metrics.averageLongTaskDuration * (this.metrics.longTaskCount - 1) +
                entry.duration) /
              this.metrics.longTaskCount;

            console.warn(
              `🚨 Long task detected: ${entry.duration.toFixed(2)}ms - Consider chunking this operation`
            );
          }
        }
      });

      this.longTaskObserver.observe({ entryTypes: ['longtask'] });
    }

    // Monitor frame rate
    this.startFrameRateMonitoring();
  }

  private startFrameRateMonitoring() {
    let frameCount = 0;
    let lastTime = performance.now();

    const measureFrameRate = () => {
      frameCount++;
      const currentTime = performance.now();

      if (currentTime - lastTime >= 1000) {
        this.metrics.frameRate = frameCount;
        frameCount = 0;
        lastTime = currentTime;

        if (this.metrics.frameRate < 30) {
          console.warn(`⚠️ Low frame rate detected: ${this.metrics.frameRate}fps`);
        }
      }

      requestAnimationFrame(measureFrameRate);
    };

    requestAnimationFrame(measureFrameRate);
  }

  // Chunk large operations to prevent long tasks
  static chunkOperation<T>(
    items: T[],
    operation: (item: T, index: number) => void,
    chunkSize: number = 10,
    delay: number = 16
  ): Promise<void> {
    return new Promise(resolve => {
      let index = 0;

      const processChunk = () => {
        const startTime = performance.now();
        const endIndex = Math.min(index + chunkSize, items.length);

        // Process items in this chunk
        for (let i = index; i < endIndex; i++) {
          operation(items[i], i);
        }

        index = endIndex;

        // Check if we need to yield to prevent long tasks
        const processingTime = performance.now() - startTime;
        if (processingTime > 16) {
          console.warn(
            `⚠️ Chunk processing took ${processingTime.toFixed(2)}ms - consider smaller chunks`
          );
        }

        if (index < items.length) {
          // Schedule next chunk with delay to prevent blocking
          setTimeout(processChunk, delay);
        } else {
          resolve();
        }
      };

      processChunk();
    });
  }

  // Optimize DOM operations to prevent layout thrashing
  static batchDOMOperations(operations: (() => void)[]): void {
    // Use requestAnimationFrame to batch DOM updates
    requestAnimationFrame(() => {
      // Force layout read first
      document.body.offsetHeight;

      // Perform all write operations
      operations.forEach(operation => operation());
    });
  }

  // Debounce function for expensive operations
  static debounce<T extends (...args: any[]) => void>(func: T, delay: number): T {
    let timeoutId: NodeJS.Timeout;

    return ((...args: any[]) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    }) as T;
  }

  // Throttle function for frequent operations
  static throttle<T extends (...args: any[]) => void>(func: T, delay: number): T {
    let lastExecTime = 0;

    return ((...args: any[]) => {
      const currentTime = performance.now();

      if (currentTime - lastExecTime > delay) {
        func(...args);
        lastExecTime = currentTime;
      }
    }) as T;
  }

  // Optimize list rendering with virtualization hints
  static optimizeListRendering<T>(
    items: T[],
    renderItem: (item: T, index: number) => React.ReactNode,
    options: {
      chunkSize?: number;
      virtualizationThreshold?: number;
      overscanCount?: number;
    } = {}
  ): React.ReactNode[] {
    const { chunkSize = 50, virtualizationThreshold = 100, overscanCount = 5 } = options;

    // For small lists, render everything
    if (items.length <= virtualizationThreshold) {
      return items.map((item, index) => renderItem(item, index));
    }

    // For large lists, use chunked rendering
    const chunks: React.ReactNode[] = [];

    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      chunks.push(
        React.createElement(
          'div',
          { key: `chunk-${i}`, className: 'virtualized-chunk' },
          chunk.map((item, index) => renderItem(item, i + index))
        )
      );
    }

    return chunks;
  }

  // Monitor memory usage
  static getMemoryUsage(): { used: number; total: number; limit: number } {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return {
        used: memory.usedJSHeapSize / 1024 / 1024,
        total: memory.totalJSHeapSize / 1024 / 1024,
        limit: memory.jsHeapSizeLimit / 1024 / 1024,
      };
    }
    return { used: 0, total: 0, limit: 0 };
  }

  // Optimize scroll performance
  static optimizeScroll(container: HTMLElement, handler: (event: Event) => void): () => void {
    let ticking = false;

    const optimizedHandler = (event: Event) => {
      if (!ticking) {
        requestAnimationFrame(() => {
          handler(event);
          ticking = false;
        });
        ticking = true;
      }
    };

    container.addEventListener('scroll', optimizedHandler, { passive: true });

    return () => {
      container.removeEventListener('scroll', optimizedHandler);
    };
  }

  // Optimize hover performance
  static optimizeHover(
    element: HTMLElement,
    onEnter: () => void,
    onLeave: () => void,
    delay: number = 50
  ): () => void {
    let enterTimeout: NodeJS.Timeout;
    let leaveTimeout: NodeJS.Timeout;

    const handleMouseEnter = () => {
      clearTimeout(leaveTimeout);
      enterTimeout = setTimeout(onEnter, delay);
    };

    const handleMouseLeave = () => {
      clearTimeout(enterTimeout);
      leaveTimeout = setTimeout(onLeave, delay);
    };

    element.addEventListener('mouseenter', handleMouseEnter, { passive: true });
    element.addEventListener('mouseleave', handleMouseLeave, { passive: true });

    return () => {
      clearTimeout(enterTimeout);
      clearTimeout(leaveTimeout);
      element.removeEventListener('mouseenter', handleMouseEnter);
      element.removeEventListener('mouseleave', handleMouseLeave);
    };
  }

  // Get current performance metrics
  getMetrics(): PerformanceMetrics {
    const memory = PerformanceOptimizer.getMemoryUsage();
    this.metrics.memoryUsage = memory.used;
    this.metrics.layoutThrashingCount = this.layoutThrashingCount;

    return { ...this.metrics };
  }

  // Reset metrics
  resetMetrics(): void {
    this.metrics = {
      longTaskCount: 0,
      averageLongTaskDuration: 0,
      frameRate: 0,
      memoryUsage: 0,
      layoutThrashingCount: 0,
    };
  }

  // Cleanup observers
  destroy(): void {
    if (this.longTaskObserver) {
      this.longTaskObserver.disconnect();
    }
    if (this.frameRateObserver) {
      this.frameRateObserver.disconnect();
    }
  }
}

// Create global instance
const performanceOptimizer = new PerformanceOptimizer();

// Auto-cleanup on page unload
window.addEventListener('beforeunload', () => {
  performanceOptimizer.destroy();
});

export { PerformanceOptimizer, performanceOptimizer };
export default PerformanceOptimizer;
