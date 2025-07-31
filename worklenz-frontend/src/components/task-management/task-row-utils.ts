import { Task } from '@/types/task-management.types';
import { dayjs } from '@/shared/antd-imports';

// Performance constants
export const PERFORMANCE_CONSTANTS = {
  CACHE_CLEAR_INTERVAL: 300000, // 5 minutes
  VIRTUALIZATION_THRESHOLD: 25, // Updated to match main virtualization threshold
  DRAG_THROTTLE_MS: 50,
  RENDER_TIMEOUT_MS: 16, // 60fps target
  MAX_CACHE_SIZE: 1000,
} as const;

// Priority and status color constants
export const PRIORITY_COLORS = {
  critical: '#ff4d4f',
  high: '#ff7a45',
  medium: '#faad14',
  low: '#52c41a',
} as const;

export const STATUS_COLORS = {
  todo: '#f0f0f0',
  doing: '#1890ff',
  done: '#52c41a',
} as const;

// Cache management for date formatting
class DateFormatCache {
  private cache = new Map<string, string>();
  private maxSize: number;

  constructor(maxSize: number = PERFORMANCE_CONSTANTS.MAX_CACHE_SIZE) {
    this.maxSize = maxSize;
  }

  get(key: string): string | undefined {
    return this.cache.get(key);
  }

  set(key: string, value: string): void {
    // LRU eviction when cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value as string;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// Global cache instances
export const formatDateCache = new DateFormatCache();
export const formatDateTimeCache = new DateFormatCache();

// Optimized date formatters with caching
export const formatDate = (dateString?: string): string => {
  if (!dateString) return '';

  if (formatDateCache.has(dateString)) {
    return formatDateCache.get(dateString)!;
  }

  const formatted = dayjs(dateString).format('MMM DD, YYYY');
  formatDateCache.set(dateString, formatted);
  return formatted;
};

export const formatDateTime = (dateString?: string): string => {
  if (!dateString) return '';

  if (formatDateTimeCache.has(dateString)) {
    return formatDateTimeCache.get(dateString)!;
  }

  const formatted = dayjs(dateString).format('MMM DD, YYYY HH:mm');
  formatDateTimeCache.set(dateString, formatted);
  return formatted;
};

// Performance monitoring utilities
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, number[]> = new Map();

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  startTiming(operation: string): () => void {
    const startTime = performance.now();

    return () => {
      const endTime = performance.now();
      const duration = endTime - startTime;

      if (!this.metrics.has(operation)) {
        this.metrics.set(operation, []);
      }

      const operationMetrics = this.metrics.get(operation)!;
      operationMetrics.push(duration);

      // Keep only last 100 measurements
      if (operationMetrics.length > 100) {
        operationMetrics.shift();
      }
    };
  }

  getAverageTime(operation: string): number {
    const times = this.metrics.get(operation);
    if (!times || times.length === 0) return 0;

    const sum = times.reduce((acc, time) => acc + time, 0);
    return sum / times.length;
  }

  getMetrics(): Record<string, { average: number; count: number; latest: number }> {
    const result: Record<string, { average: number; count: number; latest: number }> = {};

    this.metrics.forEach((times, operation) => {
      if (times.length > 0) {
        result[operation] = {
          average: this.getAverageTime(operation),
          count: times.length,
          latest: times[times.length - 1],
        };
      }
    });

    return result;
  }

  logMetrics(): void {
    const metrics = this.getMetrics();
    console.table(metrics);
  }

  clearMetrics(): void {
    this.metrics.clear();
  }
}

// Task comparison utilities for React.memo
export const taskPropsEqual = (prevTask: Task, nextTask: Task): boolean => {
  // Quick identity check
  if (prevTask === nextTask) return true;
  if (prevTask.id !== nextTask.id) return false;

  // Check commonly changing properties
  const criticalProps: (keyof Task)[] = [
    'title',
    'progress',
    'status',
    'priority',
    'description',
    'startDate',
    'dueDate',
    'updatedAt',
  ];

  for (const prop of criticalProps) {
    if (prevTask[prop] !== nextTask[prop]) {
      return false;
    }
  }

  // Check array lengths (fast path)
  if (prevTask.labels?.length !== nextTask.labels?.length) return false;
  if (prevTask.assignee_names?.length !== nextTask.assignee_names?.length) return false;

  return true;
};

// Throttle utility for drag operations
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: NodeJS.Timeout | null = null;
  let lastExecTime = 0;

  return (...args: Parameters<T>) => {
    const currentTime = Date.now();

    const execute = () => {
      lastExecTime = currentTime;
      func(...args);
    };

    if (currentTime - lastExecTime > delay) {
      execute();
    } else {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(execute, delay - (currentTime - lastExecTime));
    }
  };
};

// Debounce utility for input operations
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

// Virtualization utilities
export const shouldVirtualize = (itemCount: number): boolean => {
  return itemCount > PERFORMANCE_CONSTANTS.VIRTUALIZATION_THRESHOLD;
};

export const calculateVirtualizedHeight = (
  itemCount: number,
  itemHeight: number,
  maxHeight: number = 600
): number => {
  const totalHeight = itemCount * itemHeight;
  return Math.min(totalHeight, maxHeight);
};

// CSS class utilities for performance
export const getOptimizedClasses = (
  isDragging: boolean,
  isVirtualized: boolean,
  isSelected: boolean
): string => {
  const classes = ['task-row-optimized'];

  if (isDragging) {
    classes.push('task-row-dragging');
  }

  if (isVirtualized) {
    classes.push('task-row-virtualized');
  }

  if (isSelected) {
    classes.push('task-row-selected');
  }

  return classes.join(' ');
};

// Memory management
export const clearAllCaches = (): void => {
  formatDateCache.clear();
  formatDateTimeCache.clear();
  PerformanceMonitor.getInstance().clearMetrics();
};

// Performance debugging helpers
export const logPerformanceWarning = (operation: string, duration: number): void => {
  if (duration > PERFORMANCE_CONSTANTS.RENDER_TIMEOUT_MS) {
    console.warn(
      `Performance warning: ${operation} took ${duration.toFixed(2)}ms (target: ${PERFORMANCE_CONSTANTS.RENDER_TIMEOUT_MS}ms)`
    );
  }
};

// Auto-cleanup setup
let cleanupInterval: NodeJS.Timeout | null = null;

export const setupAutoCleanup = (): void => {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
  }

  cleanupInterval = setInterval(() => {
    clearAllCaches();
  }, PERFORMANCE_CONSTANTS.CACHE_CLEAR_INTERVAL);
};

export const teardownAutoCleanup = (): void => {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
};

// Initialize auto-cleanup
if (typeof window !== 'undefined') {
  setupAutoCleanup();

  // Cleanup on page unload
  window.addEventListener('beforeunload', teardownAutoCleanup);
}

// Export performance monitor instance
export const performanceMonitor = PerformanceMonitor.getInstance();

// Task adapter utilities
export const createLabelsAdapter = (task: Task) =>
  ({
    id: task.id,
    name: task.title,
    parent_task_id: undefined,
    manual_progress: false,
    all_labels:
      task.labels?.map(label => ({
        id: label.id,
        name: label.name,
        color_code: label.color,
      })) || [],
    labels:
      task.labels?.map(label => ({
        id: label.id,
        name: label.name,
        color_code: label.color,
      })) || [],
  }) as any;

export const createAssigneeAdapter = (task: Task) =>
  ({
    id: task.id,
    name: task.title,
    parent_task_id: undefined,
    manual_progress: false,
    assignees:
      task.assignee_names?.map(member => ({
        team_member_id: member.team_member_id || '',
        id: member.team_member_id || '',
        project_member_id: member.team_member_id || '',
        name: member.name,
      })) || [],
  }) as any;

// Color utilities
export const getPriorityColor = (priority: string): string => {
  return PRIORITY_COLORS[priority as keyof typeof PRIORITY_COLORS] || '#d9d9d9';
};

export const getStatusColor = (status: string): string => {
  return STATUS_COLORS[status as keyof typeof STATUS_COLORS] || '#d9d9d9';
};
