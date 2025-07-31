import React from 'react';

// Performance monitoring utility for task list performance analysis
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, number[]> = new Map();
  private marks: Map<string, number> = new Map();
  private observers: Map<string, PerformanceObserver> = new Map();

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  // Mark a performance point
  mark(name: string): void {
    this.marks.set(name, performance.now());
    performance.mark(name);
  }

  // Measure time between two marks
  measure(name: string, startMark: string, endMark: string): void {
    try {
      performance.measure(name, startMark, endMark);
      const measure = performance.getEntriesByName(name, 'measure')[0];
      if (measure) {
        this.addMetric(name, measure.duration);
      }
    } catch (error) {
      console.warn(`Failed to measure ${name}:`, error);
    }
  }

  // Add a metric value
  addMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(value);
  }

  // Get average for a metric
  getAverage(name: string): number {
    const values = this.metrics.get(name);
    if (!values || values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  // Get all metrics
  getMetrics(): Record<string, { average: number; count: number; min: number; max: number }> {
    const result: Record<string, { average: number; count: number; min: number; max: number }> = {};

    this.metrics.forEach((values, name) => {
      if (values.length > 0) {
        result[name] = {
          average: this.getAverage(name),
          count: values.length,
          min: Math.min(...values),
          max: Math.max(...values),
        };
      }
    });

    return result;
  }

  // Monitor React component render times
  monitorComponentRender(componentName: string): () => void {
    const startMark = `${componentName}-render-start`;
    const endMark = `${componentName}-render-end`;

    this.mark(startMark);

    return () => {
      this.mark(endMark);
      this.measure(`${componentName}-render-time`, startMark, endMark);
    };
  }

  // Monitor Redux selector performance
  monitorSelector(selectorName: string, selectorFn: () => any): any {
    const startTime = performance.now();
    const result = selectorFn();
    const endTime = performance.now();

    this.addMetric(`${selectorName}-execution-time`, endTime - startTime);
    return result;
  }

  // Monitor DOM operations
  monitorDOMOperation(operationName: string, operation: () => void): void {
    const startTime = performance.now();
    operation();
    const endTime = performance.now();

    this.addMetric(`${operationName}-dom-time`, endTime - startTime);
  }

  // Monitor memory usage
  monitorMemory(): void {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      this.addMetric('memory-used', memory.usedJSHeapSize);
      this.addMetric('memory-total', memory.totalJSHeapSize);
      this.addMetric('memory-limit', memory.jsHeapSizeLimit);
    }
  }

  // Monitor frame rate
  startFrameRateMonitoring(): () => void {
    let frameCount = 0;
    let lastTime = performance.now();

    const measureFrameRate = () => {
      frameCount++;
      const currentTime = performance.now();

      if (currentTime - lastTime >= 1000) {
        // Every second
        const fps = frameCount / ((currentTime - lastTime) / 1000);
        this.addMetric('fps', fps);
        frameCount = 0;
        lastTime = currentTime;
      }

      requestAnimationFrame(measureFrameRate);
    };

    const animationId = requestAnimationFrame(measureFrameRate);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }

  // Monitor long tasks
  startLongTaskMonitoring(): () => void {
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'longtask') {
            this.addMetric('long-task-duration', entry.duration);
            console.warn('Long task detected:', entry);
          }
        }
      });

      observer.observe({ entryTypes: ['longtask'] });
      this.observers.set('longtask', observer);

      return () => {
        observer.disconnect();
        this.observers.delete('longtask');
      };
    }

    return () => {};
  }

  // Monitor layout thrashing
  startLayoutThrashingMonitoring(): () => void {
    let layoutCount = 0;
    let lastLayoutTime = 0;
    const monitor = this;

    const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;

    Element.prototype.getBoundingClientRect = function () {
      const currentTime = performance.now();
      if (currentTime - lastLayoutTime < 16) {
        // Less than 16ms between calls
        layoutCount++;
        monitor.addMetric('layout-thrashing-count', layoutCount);
      }
      lastLayoutTime = currentTime;
      return originalGetBoundingClientRect.call(this);
    };

    return () => {
      Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
    };
  }

  // Generate performance report
  generateReport(): string {
    const metrics = this.getMetrics();
    const report = {
      timestamp: new Date().toISOString(),
      metrics,
      summary: this.generateSummary(metrics),
      recommendations: this.generateRecommendations(metrics),
    };

    return JSON.stringify(report, null, 2);
  }

  private generateSummary(metrics: Record<string, any>): Record<string, string> {
    const summary: Record<string, string> = {};

    // Component render times
    const renderTimes = Object.keys(metrics).filter(key => key.includes('render-time'));
    if (renderTimes.length > 0) {
      const avgRenderTime =
        renderTimes.reduce((sum, key) => sum + metrics[key].average, 0) / renderTimes.length;
      summary.renderPerformance = avgRenderTime > 16 ? 'Poor' : avgRenderTime > 8 ? 'Fair' : 'Good';
    }

    // FPS
    if (metrics.fps) {
      summary.frameRate =
        metrics.fps.average > 55 ? 'Good' : metrics.fps.average > 30 ? 'Fair' : 'Poor';
    }

    // Memory usage
    if (metrics['memory-used'] && metrics['memory-limit']) {
      const memoryUsage = (metrics['memory-used'].average / metrics['memory-limit'].average) * 100;
      summary.memoryUsage = memoryUsage > 80 ? 'High' : memoryUsage > 50 ? 'Moderate' : 'Low';
    }

    return summary;
  }

  private generateRecommendations(metrics: Record<string, any>): string[] {
    const recommendations: string[] = [];

    // Check for slow component renders
    const slowRenders = Object.keys(metrics).filter(
      key => key.includes('render-time') && metrics[key].average > 16
    );
    if (slowRenders.length > 0) {
      recommendations.push(`Optimize component renders: ${slowRenders.join(', ')}`);
    }

    // Check for layout thrashing
    if (metrics['layout-thrashing-count'] && metrics['layout-thrashing-count'].count > 10) {
      recommendations.push('Reduce layout thrashing by batching DOM reads and writes');
    }

    // Check for long tasks
    if (metrics['long-task-duration'] && metrics['long-task-duration'].count > 0) {
      recommendations.push('Break down long tasks into smaller chunks');
    }

    // Check for low FPS
    if (metrics.fps && metrics.fps.average < 30) {
      recommendations.push('Optimize rendering performance to maintain 60fps');
    }

    // Check for high memory usage
    if (metrics['memory-used'] && metrics['memory-limit']) {
      const memoryUsage = (metrics['memory-used'].average / metrics['memory-limit'].average) * 100;
      if (memoryUsage > 80) {
        recommendations.push('Reduce memory usage to prevent performance degradation');
      }
    }

    return recommendations;
  }

  // Clear all metrics
  clear(): void {
    this.metrics.clear();
    this.marks.clear();
    performance.clearMarks();
    performance.clearMeasures();
  }

  // Stop all monitoring
  stop(): void {
    this.observers.forEach(observer => {
      observer.disconnect();
    });
    this.observers.clear();
  }
}

// Convenience functions
export const performanceMonitor = PerformanceMonitor.getInstance();

// React hook for monitoring component performance
export const usePerformanceMonitor = (componentName: string) => {
  const endMonitoring = React.useCallback(() => {
    return performanceMonitor.monitorComponentRender(componentName);
  }, [componentName]);

  React.useEffect(() => {
    const cleanup = endMonitoring();
    return cleanup;
  }, [endMonitoring]);
};

// Redux middleware for monitoring selector performance
export const performanceMiddleware = (store: any) => (next: any) => (action: any) => {
  const startTime = performance.now();
  const result = next(action);
  const endTime = performance.now();

  performanceMonitor.addMetric(`redux-action-${action.type}`, endTime - startTime);

  return result;
};

// Export for global access
if (typeof window !== 'undefined') {
  (window as any).performanceMonitor = performanceMonitor;
}
