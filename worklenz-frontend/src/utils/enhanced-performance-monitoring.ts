// Enhanced performance monitoring for Worklenz application

// Performance monitoring constants
export const PERFORMANCE_CONFIG = {
  // Measurement thresholds
  THRESHOLDS: {
    FCP: 1800, // First Contentful Paint (ms)
    LCP: 2500, // Largest Contentful Paint (ms)
    FID: 100, // First Input Delay (ms)
    CLS: 0.1, // Cumulative Layout Shift
    TTFB: 600, // Time to First Byte (ms)
    INP: 200, // Interaction to Next Paint (ms)
  },

  // Monitoring intervals
  INTERVALS: {
    METRICS_COLLECTION: 5000, // 5 seconds
    PERFORMANCE_REPORT: 30000, // 30 seconds
    CLEANUP_THRESHOLD: 300000, // 5 minutes
  },

  // Buffer sizes
  BUFFERS: {
    MAX_ENTRIES: 1000,
    MAX_RESOURCE_ENTRIES: 500,
    MAX_NAVIGATION_ENTRIES: 100,
  },
} as const;

// Performance metrics interface
export interface PerformanceMetrics {
  // Core Web Vitals
  fcp?: number;
  lcp?: number;
  fid?: number;
  cls?: number;
  ttfb?: number;
  inp?: number;

  // Custom metrics
  domContentLoaded?: number;
  windowLoad?: number;
  firstByte?: number;

  // Application-specific metrics
  taskLoadTime?: number;
  projectSwitchTime?: number;
  filterApplyTime?: number;
  bulkActionTime?: number;

  // Memory and performance
  memoryUsage?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };

  // Timing information
  timestamp: number;
  url: string;
  userAgent: string;
}

// Performance monitoring class
export class EnhancedPerformanceMonitor {
  private static instance: EnhancedPerformanceMonitor;
  private metrics: PerformanceMetrics[] = [];
  private observers: PerformanceObserver[] = [];
  private intervalIds: NodeJS.Timeout[] = [];
  private isMonitoring = false;

  // Singleton pattern
  static getInstance(): EnhancedPerformanceMonitor {
    if (!this.instance) {
      this.instance = new EnhancedPerformanceMonitor();
    }
    return this.instance;
  }

  // Start comprehensive performance monitoring
  startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.setupObservers();
    this.collectInitialMetrics();
    this.startPeriodicCollection();
    
    // console.log('🚀 Enhanced performance monitoring started');
  }

  // Stop monitoring and cleanup
  stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    this.cleanupObservers();
    this.clearIntervals();
    
    // console.log('🛑 Enhanced performance monitoring stopped');
  }

  // Setup performance observers
  private setupObservers(): void {
    if (!('PerformanceObserver' in window)) return;

    // Core Web Vitals observer
    try {
      const vitalsObserver = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          this.processVitalMetric(entry);
        }
      });

      vitalsObserver.observe({
        type: 'largest-contentful-paint',
        buffered: true,
      });

      vitalsObserver.observe({
        type: 'first-input',
        buffered: true,
      });

      vitalsObserver.observe({
        type: 'layout-shift',
        buffered: true,
      });

      this.observers.push(vitalsObserver);
    } catch (error) {
      console.warn('Failed to setup vitals observer:', error);
    }

    // Navigation timing observer
    try {
      const navigationObserver = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          this.processNavigationMetric(entry as PerformanceNavigationTiming);
        }
      });

      navigationObserver.observe({
        type: 'navigation',
        buffered: true,
      });

      this.observers.push(navigationObserver);
    } catch (error) {
      console.warn('Failed to setup navigation observer:', error);
    }

    // Resource timing observer
    try {
      const resourceObserver = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          this.processResourceMetric(entry as PerformanceResourceTiming);
        }
      });

      resourceObserver.observe({
        type: 'resource',
        buffered: true,
      });

      this.observers.push(resourceObserver);
    } catch (error) {
      console.warn('Failed to setup resource observer:', error);
    }

    // Measure observer
    try {
      const measureObserver = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          this.processCustomMeasure(entry as PerformanceMeasure);
        }
      });

      measureObserver.observe({
        type: 'measure',
        buffered: true,
      });

      this.observers.push(measureObserver);
    } catch (error) {
      console.warn('Failed to setup measure observer:', error);
    }
  }

  // Process Core Web Vitals metrics
  private processVitalMetric(entry: PerformanceEntry): void {
    const metric: Partial<PerformanceMetrics> = {
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
    };

    switch (entry.entryType) {
      case 'largest-contentful-paint':
        metric.lcp = entry.startTime;
        break;
      case 'first-input':
        metric.fid = (entry as any).processingStart - entry.startTime;
        break;
      case 'layout-shift':
        if (!(entry as any).hadRecentInput) {
          metric.cls = (metric.cls || 0) + (entry as any).value;
        }
        break;
    }

    this.addMetric(metric as PerformanceMetrics);
  }

  // Process navigation timing metrics
  private processNavigationMetric(entry: PerformanceNavigationTiming): void {
    const metric: PerformanceMetrics = {
      fcp: this.getFCP(),
      ttfb: entry.responseStart - entry.requestStart,
      domContentLoaded: entry.domContentLoadedEventEnd - entry.startTime,
      windowLoad: entry.loadEventEnd - entry.startTime,
      firstByte: entry.responseStart - entry.startTime,
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
    };

    this.addMetric(metric);
  }

  // Process resource timing metrics
  private processResourceMetric(entry: PerformanceResourceTiming): void {
    // Track slow resources
    const duration = entry.responseEnd - entry.requestStart;

    if (duration > 1000) {
      // Resources taking more than 1 second
      console.warn(`Slow resource detected: ${entry.name} (${duration.toFixed(2)}ms)`);
    }

    // Track render-blocking resources (check if property exists)
    if ((entry as any).renderBlockingStatus === 'blocking') {
      console.warn(`Render-blocking resource: ${entry.name}`);
    }
  }

  // Process custom performance measures
  private processCustomMeasure(entry: PerformanceMeasure): void {
    const metric: Partial<PerformanceMetrics> = {
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
    };

    // Map custom measures to metrics
    switch (entry.name) {
      case 'task-load-time':
        metric.taskLoadTime = entry.duration;
        break;
      case 'project-switch-time':
        metric.projectSwitchTime = entry.duration;
        break;
      case 'filter-apply-time':
        metric.filterApplyTime = entry.duration;
        break;
      case 'bulk-action-time':
        metric.bulkActionTime = entry.duration;
        break;
    }

    if (Object.keys(metric).length > 3) {
      this.addMetric(metric as PerformanceMetrics);
    }
  }

  // Get First Contentful Paint
  private getFCP(): number | undefined {
    const fcpEntry = performance
      .getEntriesByType('paint')
      .find(entry => entry.name === 'first-contentful-paint');
    return fcpEntry?.startTime;
  }

  // Collect initial metrics
  private collectInitialMetrics(): void {
    const metric: PerformanceMetrics = {
      fcp: this.getFCP(),
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
    };

    // Add memory information if available
    if ('memory' in performance) {
      metric.memoryUsage = {
        usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
        totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
        jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit,
      };
    }

    this.addMetric(metric);
  }

  // Start periodic metrics collection
  private startPeriodicCollection(): void {
    // Collect metrics every 5 seconds
    const metricsInterval = setInterval(() => {
      this.collectPeriodicMetrics();
    }, PERFORMANCE_CONFIG.INTERVALS.METRICS_COLLECTION);

    // Generate performance report every 30 seconds
    const reportInterval = setInterval(() => {
      this.generatePerformanceReport();
    }, PERFORMANCE_CONFIG.INTERVALS.PERFORMANCE_REPORT);

    // Cleanup old metrics every 5 minutes
    const cleanupInterval = setInterval(() => {
      this.cleanupOldMetrics();
    }, PERFORMANCE_CONFIG.INTERVALS.CLEANUP_THRESHOLD);

    this.intervalIds.push(metricsInterval, reportInterval, cleanupInterval);
  }

  // Collect periodic metrics
  private collectPeriodicMetrics(): void {
    const metric: PerformanceMetrics = {
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
    };

    // Add memory information if available
    if ('memory' in performance) {
      metric.memoryUsage = {
        usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
        totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
        jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit,
      };
    }

    this.addMetric(metric);
  }

  // Add metric to collection
  private addMetric(metric: PerformanceMetrics): void {
    this.metrics.push(metric);

    // Limit buffer size
    if (this.metrics.length > PERFORMANCE_CONFIG.BUFFERS.MAX_ENTRIES) {
      this.metrics = this.metrics.slice(-PERFORMANCE_CONFIG.BUFFERS.MAX_ENTRIES);
    }
  }

  // Generate performance report
  private generatePerformanceReport(): void {
    if (this.metrics.length === 0) return;

    const recent = this.metrics.slice(-10); // Last 10 metrics
    const report = this.analyzeMetrics(recent);
    
    // console.log('📊 Performance Report:', report);

    // Check for performance issues
    this.checkPerformanceIssues(report);
  }

  // Analyze metrics and generate insights
  private analyzeMetrics(metrics: PerformanceMetrics[]): any {
    const validMetrics = metrics.filter(m => m);

    if (validMetrics.length === 0) return {};

    const report: any = {
      timestamp: Date.now(),
      sampleSize: validMetrics.length,
    };

    // Analyze each metric
    ['fcp', 'lcp', 'fid', 'cls', 'ttfb', 'taskLoadTime', 'projectSwitchTime'].forEach(metric => {
      const values = validMetrics.map(m => (m as any)[metric]).filter(v => v !== undefined);

      if (values.length > 0) {
        report[metric] = {
          avg: values.reduce((a, b) => a + b, 0) / values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          latest: values[values.length - 1],
        };
      }
    });

    // Memory analysis
    const memoryMetrics = validMetrics.map(m => m.memoryUsage).filter(m => m !== undefined);

    if (memoryMetrics.length > 0) {
      const latest = memoryMetrics[memoryMetrics.length - 1];
      report.memory = {
        usedMB: (latest.usedJSHeapSize / 1024 / 1024).toFixed(2),
        totalMB: (latest.totalJSHeapSize / 1024 / 1024).toFixed(2),
        usage: ((latest.usedJSHeapSize / latest.totalJSHeapSize) * 100).toFixed(2) + '%',
      };
    }

    return report;
  }

  // Check for performance issues
  private checkPerformanceIssues(report: any): void {
    const issues: string[] = [];

    // Check Core Web Vitals
    if (report.fcp?.latest > PERFORMANCE_CONFIG.THRESHOLDS.FCP) {
      issues.push(
        `FCP is slow: ${report.fcp.latest.toFixed(2)}ms (threshold: ${PERFORMANCE_CONFIG.THRESHOLDS.FCP}ms)`
      );
    }

    if (report.lcp?.latest > PERFORMANCE_CONFIG.THRESHOLDS.LCP) {
      issues.push(
        `LCP is slow: ${report.lcp.latest.toFixed(2)}ms (threshold: ${PERFORMANCE_CONFIG.THRESHOLDS.LCP}ms)`
      );
    }

    if (report.fid?.latest > PERFORMANCE_CONFIG.THRESHOLDS.FID) {
      issues.push(
        `FID is high: ${report.fid.latest.toFixed(2)}ms (threshold: ${PERFORMANCE_CONFIG.THRESHOLDS.FID}ms)`
      );
    }

    if (report.cls?.latest > PERFORMANCE_CONFIG.THRESHOLDS.CLS) {
      issues.push(
        `CLS is high: ${report.cls.latest.toFixed(3)} (threshold: ${PERFORMANCE_CONFIG.THRESHOLDS.CLS})`
      );
    }

    // Check application-specific metrics
    if (report.taskLoadTime?.latest > 1000) {
      issues.push(`Task loading is slow: ${report.taskLoadTime.latest.toFixed(2)}ms`);
    }

    if (report.projectSwitchTime?.latest > 500) {
      issues.push(`Project switching is slow: ${report.projectSwitchTime.latest.toFixed(2)}ms`);
    }

    // Check memory usage
    if (report.memory && parseFloat(report.memory.usage) > 80) {
      issues.push(`High memory usage: ${report.memory.usage}`);
    }

    // Log issues
    if (issues.length > 0) {
      console.warn('⚠️ Performance Issues Detected:');
      issues.forEach(issue => console.warn(`  - ${issue}`));
    }
  }

  // Cleanup old metrics
  private cleanupOldMetrics(): void {
    const fiveMinutesAgo = Date.now() - PERFORMANCE_CONFIG.INTERVALS.CLEANUP_THRESHOLD;
    this.metrics = this.metrics.filter(metric => metric.timestamp > fiveMinutesAgo);
  }

  // Cleanup observers
  private cleanupObservers(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }

  // Clear intervals
  private clearIntervals(): void {
    this.intervalIds.forEach(id => clearInterval(id));
    this.intervalIds = [];
  }

  // Get current metrics
  getMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  // Get performance summary
  getPerformanceSummary(): any {
    return this.analyzeMetrics(this.metrics);
  }

  // Export metrics for analysis
  exportMetrics(): string {
    return JSON.stringify(
      {
        timestamp: Date.now(),
        metrics: this.metrics,
        summary: this.getPerformanceSummary(),
      },
      null,
      2
    );
  }
}

// Custom performance measurement utilities
export class CustomPerformanceMeasurer {
  private static marks = new Map<string, number>();

  // Mark start of operation
  static mark(name: string): void {
    if ('performance' in window && 'mark' in performance) {
      performance.mark(`${name}-start`);
    }
    this.marks.set(name, Date.now());
  }

  // Measure operation duration
  static measure(name: string): number {
    const startTime = this.marks.get(name);
    const endTime = Date.now();

    if (startTime) {
      const duration = endTime - startTime;

      if ('performance' in window && 'measure' in performance) {
        try {
          performance.measure(name, `${name}-start`);
        } catch (error) {
          console.warn(`Failed to create performance measure for ${name}:`, error);
        }
      }

      this.marks.delete(name);
      return duration;
    }

    return 0;
  }

  // Measure async operation
  static async measureAsync<T>(name: string, operation: () => Promise<T>): Promise<T> {
    this.mark(name);
    try {
      const result = await operation();
      this.measure(name);
      return result;
    } catch (error) {
      this.measure(name);
      throw error;
    }
  }

  // Measure function execution
  static measureFunction<T extends any[], R>(
    name: string,
    fn: (...args: T) => R
  ): (...args: T) => R {
    return (...args: T): R => {
      this.mark(name);
      try {
        const result = fn(...args);
        this.measure(name);
        return result;
      } catch (error) {
        this.measure(name);
        throw error;
      }
    };
  }
}

// Performance optimization recommendations
export class PerformanceOptimizer {
  // Analyze and provide optimization recommendations
  static analyzeAndRecommend(metrics: PerformanceMetrics[]): string[] {
    const recommendations: string[] = [];
    const latest = metrics[metrics.length - 1];

    if (!latest) return recommendations;

    // FCP recommendations
    if (latest.fcp && latest.fcp > PERFORMANCE_CONFIG.THRESHOLDS.FCP) {
      recommendations.push(
        'Consider optimizing critical rendering path: inline critical CSS, reduce render-blocking resources'
      );
    }

    // LCP recommendations
    if (latest.lcp && latest.lcp > PERFORMANCE_CONFIG.THRESHOLDS.LCP) {
      recommendations.push(
        'Optimize Largest Contentful Paint: compress images, preload critical resources, improve server response times'
      );
    }

    // Memory recommendations
    if (latest.memoryUsage) {
      const usagePercent =
        (latest.memoryUsage.usedJSHeapSize / latest.memoryUsage.totalJSHeapSize) * 100;

      if (usagePercent > 80) {
        recommendations.push(
          'High memory usage detected: implement cleanup routines, check for memory leaks, optimize data structures'
        );
      }
    }

    // Task loading recommendations
    if (latest.taskLoadTime && latest.taskLoadTime > 1000) {
      recommendations.push(
        'Task loading is slow: implement pagination, optimize database queries, add loading states'
      );
    }

    return recommendations;
  }

  // Get optimization priority
  static getOptimizationPriority(
    metrics: PerformanceMetrics[]
  ): Array<{ metric: string; priority: 'high' | 'medium' | 'low'; value: number }> {
    const latest = metrics[metrics.length - 1];
    if (!latest) return [];

    const priorities: Array<{
      metric: string;
      priority: 'high' | 'medium' | 'low';
      value: number;
    }> = [];

    // Check each metric against thresholds
    if (latest.fcp) {
      const ratio = latest.fcp / PERFORMANCE_CONFIG.THRESHOLDS.FCP;
      priorities.push({
        metric: 'First Contentful Paint',
        priority: ratio > 2 ? 'high' : ratio > 1.5 ? 'medium' : 'low',
        value: latest.fcp,
      });
    }

    if (latest.lcp) {
      const ratio = latest.lcp / PERFORMANCE_CONFIG.THRESHOLDS.LCP;
      priorities.push({
        metric: 'Largest Contentful Paint',
        priority: ratio > 2 ? 'high' : ratio > 1.5 ? 'medium' : 'low',
        value: latest.lcp,
      });
    }

    if (latest.cls) {
      const ratio = latest.cls / PERFORMANCE_CONFIG.THRESHOLDS.CLS;
      priorities.push({
        metric: 'Cumulative Layout Shift',
        priority: ratio > 3 ? 'high' : ratio > 2 ? 'medium' : 'low',
        value: latest.cls,
      });
    }

    return priorities.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }
}

// Track if performance monitoring has been initialized
let isInitialized = false;

// Initialize performance monitoring
export const initializePerformanceMonitoring = (): void => {
  // Prevent duplicate initialization
  if (isInitialized) {
    console.warn('Performance monitoring already initialized');
    return;
  }

  isInitialized = true;
  const monitor = EnhancedPerformanceMonitor.getInstance();
  monitor.startMonitoring();

  // Cleanup on page unload
  const cleanup = () => {
    monitor.stopMonitoring();
    isInitialized = false;
  };

  window.addEventListener('beforeunload', cleanup);

  // Also cleanup on page visibility change (tab switching)
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      cleanup();
    }
  });
};

// Export global performance utilities
export const performanceUtils = {
  monitor: EnhancedPerformanceMonitor.getInstance(),
  measurer: CustomPerformanceMeasurer,
  optimizer: PerformanceOptimizer,
  initialize: initializePerformanceMonitoring,
};
