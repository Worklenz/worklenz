import { useMemo, useCallback, useRef, useEffect } from 'react';
import { GanttTask, PerformanceMetrics } from '../types/advanced-gantt.types';

// Debounce utility for drag operations
export function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout>();
  
  return useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }, [callback, delay]) as T;
}

// Throttle utility for scroll events
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const lastCall = useRef<number>(0);
  
  return useCallback((...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall.current >= delay) {
      lastCall.current = now;
      callback(...args);
    }
  }, [callback, delay]) as T;
}

// Memoized task calculations
export const useTaskCalculations = (tasks: GanttTask[]) => {
  return useMemo(() => {
    const taskMap = new Map<string, GanttTask>();
    const parentChildMap = new Map<string, string[]>();
    const dependencyMap = new Map<string, string[]>();
    
    // Build maps for efficient lookups
    tasks.forEach(task => {
      taskMap.set(task.id, task);
      
      if (task.parent) {
        if (!parentChildMap.has(task.parent)) {
          parentChildMap.set(task.parent, []);
        }
        parentChildMap.get(task.parent)!.push(task.id);
      }
      
      if (task.dependencies) {
        dependencyMap.set(task.id, task.dependencies);
      }
    });
    
    return {
      taskMap,
      parentChildMap,
      dependencyMap,
      totalTasks: tasks.length,
      projectTasks: tasks.filter(t => t.type === 'project'),
      milestones: tasks.filter(t => t.type === 'milestone'),
      regularTasks: tasks.filter(t => t.type === 'task'),
    };
  }, [tasks]);
};

// Virtual scrolling calculations
export interface VirtualScrollData {
  startIndex: number;
  endIndex: number;
  visibleItems: GanttTask[];
  totalHeight: number;
  offsetY: number;
}

export const useVirtualScrolling = (
  tasks: GanttTask[],
  containerHeight: number,
  itemHeight: number,
  scrollTop: number,
  overscan: number = 5
): VirtualScrollData => {
  return useMemo(() => {
    const totalHeight = tasks.length * itemHeight;
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      tasks.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );
    const visibleItems = tasks.slice(startIndex, endIndex + 1);
    const offsetY = startIndex * itemHeight;
    
    return {
      startIndex,
      endIndex,
      visibleItems,
      totalHeight,
      offsetY,
    };
  }, [tasks, containerHeight, itemHeight, scrollTop, overscan]);
};

// Timeline virtual scrolling
export interface TimelineVirtualData {
  startDate: Date;
  endDate: Date;
  visibleDays: Date[];
  totalWidth: number;
  offsetX: number;
}

export const useTimelineVirtualScrolling = (
  projectStartDate: Date,
  projectEndDate: Date,
  dayWidth: number,
  containerWidth: number,
  scrollLeft: number,
  overscan: number = 10
): TimelineVirtualData => {
  return useMemo(() => {
    const totalDays = Math.ceil((projectEndDate.getTime() - projectStartDate.getTime()) / (1000 * 60 * 60 * 24));
    const totalWidth = totalDays * dayWidth;
    
    const startDayIndex = Math.max(0, Math.floor(scrollLeft / dayWidth) - overscan);
    const endDayIndex = Math.min(
      totalDays - 1,
      Math.ceil((scrollLeft + containerWidth) / dayWidth) + overscan
    );
    
    const visibleDays: Date[] = [];
    for (let i = startDayIndex; i <= endDayIndex; i++) {
      const date = new Date(projectStartDate);
      date.setDate(date.getDate() + i);
      visibleDays.push(date);
    }
    
    const offsetX = startDayIndex * dayWidth;
    const startDate = new Date(projectStartDate);
    startDate.setDate(startDate.getDate() + startDayIndex);
    
    const endDate = new Date(projectStartDate);
    endDate.setDate(endDate.getDate() + endDayIndex);
    
    return {
      startDate,
      endDate,
      visibleDays,
      totalWidth,
      offsetX,
    };
  }, [projectStartDate, projectEndDate, dayWidth, containerWidth, scrollLeft, overscan]);
};

// Performance monitoring hook
export const usePerformanceMonitoring = (): {
  metrics: PerformanceMetrics;
  startMeasure: (name: string) => void;
  endMeasure: (name: string) => void;
  recordMetric: (name: string, value: number) => void;
} => {
  const metricsRef = useRef<PerformanceMetrics>({
    renderTime: 0,
    taskCount: 0,
    visibleTaskCount: 0,
  });
  
  const measurementsRef = useRef<Map<string, number>>(new Map());
  
  const startMeasure = useCallback((name: string) => {
    measurementsRef.current.set(name, performance.now());
  }, []);
  
  const endMeasure = useCallback((name: string) => {
    const startTime = measurementsRef.current.get(name);
    if (startTime) {
      const duration = performance.now() - startTime;
      measurementsRef.current.delete(name);
      
      if (name === 'render') {
        metricsRef.current.renderTime = duration;
      }
    }
  }, []);
  
  const recordMetric = useCallback((name: string, value: number) => {
    switch (name) {
      case 'taskCount':
        metricsRef.current.taskCount = value;
        break;
      case 'visibleTaskCount':
        metricsRef.current.visibleTaskCount = value;
        break;
      case 'memoryUsage':
        metricsRef.current.memoryUsage = value;
        break;
      case 'fps':
        metricsRef.current.fps = value;
        break;
    }
  }, []);
  
  return {
    metrics: metricsRef.current,
    startMeasure,
    endMeasure,
    recordMetric,
  };
};

// Intersection Observer for lazy loading
export const useIntersectionObserver = (
  callback: (entries: IntersectionObserverEntry[]) => void,
  options?: IntersectionObserverInit
) => {
  const targetRef = useRef<HTMLElement>(null);
  const observerRef = useRef<IntersectionObserver>();
  
  useEffect(() => {
    if (!targetRef.current) return;
    
    observerRef.current = new IntersectionObserver(callback, {
      root: null,
      rootMargin: '100px',
      threshold: 0.1,
      ...options,
    });
    
    observerRef.current.observe(targetRef.current);
    
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [callback, options]);
  
  return targetRef;
};

// Date calculations optimization
export const useDateCalculations = () => {
  return useMemo(() => {
    const cache = new Map<string, number>();
    
    const getDaysBetween = (start: Date, end: Date): number => {
      const key = `${start.getTime()}-${end.getTime()}`;
      if (cache.has(key)) {
        return cache.get(key)!;
      }
      
      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      cache.set(key, days);
      return days;
    };
    
    const addDays = (date: Date, days: number): Date => {
      const result = new Date(date);
      result.setDate(result.getDate() + days);
      return result;
    };
    
    const isWeekend = (date: Date): boolean => {
      const day = date.getDay();
      return day === 0 || day === 6; // Sunday or Saturday
    };
    
    const isWorkingDay = (date: Date, workingDays: number[]): boolean => {
      return workingDays.includes(date.getDay());
    };
    
    const getWorkingDaysBetween = (start: Date, end: Date, workingDays: number[]): number => {
      let count = 0;
      const current = new Date(start);
      
      while (current <= end) {
        if (isWorkingDay(current, workingDays)) {
          count++;
        }
        current.setDate(current.getDate() + 1);
      }
      
      return count;
    };
    
    return {
      getDaysBetween,
      addDays,
      isWeekend,
      isWorkingDay,
      getWorkingDaysBetween,
      clearCache: () => cache.clear(),
    };
  }, []);
};

// Task position calculations
export const useTaskPositions = (
  tasks: GanttTask[],
  timelineStart: Date,
  dayWidth: number
) => {
  return useMemo(() => {
    const positions = new Map<string, { x: number; width: number; y: number }>();
    
    tasks.forEach((task, index) => {
      const startDays = Math.floor((task.startDate.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24));
      const endDays = Math.floor((task.endDate.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24));
      
      positions.set(task.id, {
        x: startDays * dayWidth,
        width: Math.max(1, (endDays - startDays) * dayWidth),
        y: index * 40, // Assuming 40px row height
      });
    });
    
    return positions;
  }, [tasks, timelineStart, dayWidth]);
};

// Memory management utilities
export const useMemoryManagement = () => {
  const cleanupFunctions = useRef<Array<() => void>>([]);
  
  const addCleanup = useCallback((cleanup: () => void) => {
    cleanupFunctions.current.push(cleanup);
  }, []);
  
  const runCleanup = useCallback(() => {
    cleanupFunctions.current.forEach(cleanup => cleanup());
    cleanupFunctions.current = [];
  }, []);
  
  useEffect(() => {
    return runCleanup;
  }, [runCleanup]);
  
  return { addCleanup, runCleanup };
};

// Batch update utility for multiple task changes
export const useBatchUpdates = <T>(
  updateFunction: (updates: T[]) => void,
  delay: number = 100
) => {
  const batchRef = useRef<T[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout>();
  
  const addUpdate = useCallback((update: T) => {
    batchRef.current.push(update);
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      if (batchRef.current.length > 0) {
        updateFunction([...batchRef.current]);
        batchRef.current = [];
      }
    }, delay);
  }, [updateFunction, delay]);
  
  const flushUpdates = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    if (batchRef.current.length > 0) {
      updateFunction([...batchRef.current]);
      batchRef.current = [];
    }
  }, [updateFunction]);
  
  return { addUpdate, flushUpdates };
};

// FPS monitoring
export const useFPSMonitoring = () => {
  const fpsRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(performance.now());
  
  const measureFPS = useCallback(() => {
    frameCountRef.current++;
    const now = performance.now();
    
    if (now - lastTimeRef.current >= 1000) {
      fpsRef.current = Math.round((frameCountRef.current * 1000) / (now - lastTimeRef.current));
      frameCountRef.current = 0;
      lastTimeRef.current = now;
    }
    
    requestAnimationFrame(measureFPS);
  }, []);
  
  useEffect(() => {
    const rafId = requestAnimationFrame(measureFPS);
    return () => cancelAnimationFrame(rafId);
  }, [measureFPS]);
  
  return fpsRef.current;
};