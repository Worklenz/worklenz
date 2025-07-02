import React from 'react';

/**
 * Performance monitoring utilities for development
 */

const isProduction = import.meta.env.PROD;
const isDevelopment = !isProduction;

interface PerformanceEntry {
  name: string;
  startTime: number;
  duration?: number;
}

class PerformanceMonitor {
  private timers: Map<string, number> = new Map();
  private entries: PerformanceEntry[] = [];

  /**
   * Start timing a performance measurement
   */
  public startTimer(name: string): void {
    if (isProduction) return;

    this.timers.set(name, performance.now());
  }

  /**
   * End timing and log the result
   */
  public endTimer(name: string): number | null {
    if (isProduction) return null;

    const startTime = this.timers.get(name);
    if (!startTime) {
      console.warn(`Performance timer "${name}" was not started`);
      return null;
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    this.timers.delete(name);
    this.entries.push({ name, startTime, duration });

    if (isDevelopment) {
      const color = duration > 100 ? '#ff4d4f' : duration > 50 ? '#faad14' : '#52c41a';
      console.log(`%c⏱️ ${name}: ${duration.toFixed(2)}ms`, `color: ${color}; font-weight: bold;`);
    }

    return duration;
  }

  /**
   * Measure the performance of a function
   */
  public measure<T>(name: string, fn: () => T): T {
    if (isProduction) return fn();

    this.startTimer(name);
    const result = fn();
    this.endTimer(name);
    return result;
  }

  /**
   * Measure the performance of an async function
   */
  public async measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    if (isProduction) return fn();

    this.startTimer(name);
    const result = await fn();
    this.endTimer(name);
    return result;
  }

  /**
   * Get all performance entries
   */
  public getEntries(): PerformanceEntry[] {
    return [...this.entries];
  }

  /**
   * Clear all entries
   */
  public clearEntries(): void {
    this.entries = [];
  }

  /**
   * Log a summary of all performance entries
   */
  public logSummary(): void {
    if (isProduction || this.entries.length === 0) return;

    console.group('📊 Performance Summary');

    const sortedEntries = this.entries
      .filter(entry => entry.duration !== undefined)
      .sort((a, b) => (b.duration || 0) - (a.duration || 0));

    console.table(
      sortedEntries.map(entry => ({
        Name: entry.name,
        Duration: `${(entry.duration || 0).toFixed(2)}ms`,
        'Start Time': `${entry.startTime.toFixed(2)}ms`,
      }))
    );

    const totalTime = sortedEntries.reduce((sum, entry) => sum + (entry.duration || 0), 0);
    console.log(`%cTotal measured time: ${totalTime.toFixed(2)}ms`, 'font-weight: bold;');

    console.groupEnd();
  }
}

// Create default instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * Higher-order component to measure component render performance
 */
export function withPerformanceMonitoring<P extends object>(
  Component: React.ComponentType<P>,
  componentName?: string
): React.ComponentType<P> {
  if (isProduction) return Component;

  const name = componentName || Component.displayName || Component.name || 'Unknown';

  const WrappedComponent = (props: P) => {
    React.useEffect(() => {
      performanceMonitor.startTimer(`${name} mount`);
      return () => {
        performanceMonitor.endTimer(`${name} mount`);
      };
    }, []);

    React.useEffect(() => {
      performanceMonitor.endTimer(`${name} render`);
    });

    performanceMonitor.startTimer(`${name} render`);
    return React.createElement(Component, props);
  };

  WrappedComponent.displayName = `withPerformanceMonitoring(${name})`;
  return WrappedComponent;
}

/**
 * Hook to measure render performance
 */
export function useRenderPerformance(componentName: string): void {
  if (isProduction) return;

  const renderCount = React.useRef(0);
  const startTime = React.useRef<number>(0);

  React.useEffect(() => {
    renderCount.current += 1;
    const endTime = performance.now();
    const duration = endTime - startTime.current;

    if (renderCount.current > 1) {
      console.log(
        `%c🔄 ${componentName} render #${renderCount.current}: ${duration.toFixed(2)}ms`,
        'color: #1890ff; font-size: 11px;'
      );
    }
  });

  startTime.current = performance.now();
}

export default performanceMonitor;
