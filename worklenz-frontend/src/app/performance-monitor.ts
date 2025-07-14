import { Middleware } from '@reduxjs/toolkit';

// Performance monitoring for Redux store
export interface PerformanceMetrics {
  actionType: string;
  duration: number;
  timestamp: number;
  stateSize: number;
}

class ReduxPerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private maxMetrics = 100; // Keep last 100 metrics
  private slowActionThreshold = 50; // Log actions taking more than 50ms

  logMetric(metric: PerformanceMetrics) {
    this.metrics.push(metric);

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // Log slow actions in development
    if (process.env.NODE_ENV === 'development' && metric.duration > this.slowActionThreshold) {
      console.warn(`Slow Redux action detected: ${metric.actionType} took ${metric.duration}ms`);
    }
  }

  getMetrics() {
    return [...this.metrics];
  }

  getSlowActions(threshold = this.slowActionThreshold) {
    return this.metrics.filter(m => m.duration > threshold);
  }

  getAverageActionTime() {
    if (this.metrics.length === 0) return 0;
    const total = this.metrics.reduce((sum, m) => sum + m.duration, 0);
    return total / this.metrics.length;
  }

  reset() {
    this.metrics = [];
  }
}

export const performanceMonitor = new ReduxPerformanceMonitor();

// Redux middleware for performance monitoring
export const performanceMiddleware: Middleware = store => next => (action: any) => {
  const start = performance.now();

  const result = next(action);

  const end = performance.now();
  const duration = end - start;

  // Calculate approximate state size (in development only)
  let stateSize = 0;
  if (process.env.NODE_ENV === 'development') {
    try {
      stateSize = JSON.stringify(store.getState()).length;
    } catch (e) {
      stateSize = -1; // Indicates serialization error
    }
  }

  performanceMonitor.logMetric({
    actionType: action.type || 'unknown',
    duration,
    timestamp: Date.now(),
    stateSize,
  });

  return result;
};

// Hook to access performance metrics in components
export function useReduxPerformance() {
  return {
    metrics: performanceMonitor.getMetrics(),
    slowActions: performanceMonitor.getSlowActions(),
    averageTime: performanceMonitor.getAverageActionTime(),
    reset: () => performanceMonitor.reset(),
  };
}

// Utility to detect potential performance issues
export function analyzeReduxPerformance() {
  const metrics = performanceMonitor.getMetrics();
  const analysis = {
    totalActions: metrics.length,
    slowActions: performanceMonitor.getSlowActions().length,
    averageActionTime: performanceMonitor.getAverageActionTime(),
    largestStateSize: Math.max(...metrics.map(m => m.stateSize)),
    mostFrequentActions: {} as Record<string, number>,
    recommendations: [] as string[],
  };

  // Count action frequencies
  metrics.forEach(m => {
    analysis.mostFrequentActions[m.actionType] =
      (analysis.mostFrequentActions[m.actionType] || 0) + 1;
  });

  // Generate recommendations
  if (analysis.slowActions > analysis.totalActions * 0.1) {
    analysis.recommendations.push('Consider optimizing selectors with createSelector');
  }

  if (analysis.largestStateSize > 1000000) {
    // 1MB
    analysis.recommendations.push('State size is large - consider normalizing data');
  }

  if (analysis.averageActionTime > 20) {
    analysis.recommendations.push('Average action time is high - check for expensive reducers');
  }

  return analysis;
}
