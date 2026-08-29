import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppSelector } from './useAppSelector';
import { debounce, throttle } from 'lodash-es';

// Performance optimization hook for schedule components
export const useSchedulePerformance = () => {
  const [renderCount, setRenderCount] = useState(0);
  const [lastRenderTime, setLastRenderTime] = useState(0);
  const renderStartTime = useRef(0);
  
  // Track render performance
  useEffect(() => {
    renderStartTime.current = performance.now();
    setRenderCount(prev => prev + 1);
    
    return () => {
      const renderTime = performance.now() - renderStartTime.current;
      setLastRenderTime(renderTime);
      
      // Log slow renders in development
      if (process.env.NODE_ENV === 'development' && renderTime > 16) {
        console.warn(`Slow render detected: ${renderTime.toFixed(2)}ms`);
      }
    };
  });
  
  // Debounced scroll handler
  const createDebouncedScrollHandler = useCallback(
    (handler: (event: any) => void, delay: number = 16) => {
      return debounce(handler, delay, { leading: true, trailing: true });
    },
    []
  );
  
  // Throttled resize handler
  const createThrottledResizeHandler = useCallback(
    (handler: (event: any) => void, delay: number = 100) => {
      return throttle(handler, delay, { leading: true, trailing: true });
    },
    []
  );
  
  // Memoized date calculations
  const createMemoizedDateCalculation = useCallback(
    (calculationFn: (...args: any[]) => any, deps: any[]) => {
      return useMemo(calculationFn, deps);
    },
    []
  );
  
  // Virtual scrolling helper
  const useVirtualScrolling = ({
    itemCount,
    itemHeight,
    containerHeight,
    scrollTop
  }: {
    itemCount: number;
    itemHeight: number;
    containerHeight: number;
    scrollTop: number;
  }) => {
    return useMemo(() => {
      const visibleStart = Math.floor(scrollTop / itemHeight);
      const visibleEnd = Math.min(
        itemCount - 1,
        Math.ceil((scrollTop + containerHeight) / itemHeight)
      );
      
      // Add buffer for smooth scrolling
      const buffer = Math.ceil(containerHeight / itemHeight);
      const startIndex = Math.max(0, visibleStart - buffer);
      const endIndex = Math.min(itemCount - 1, visibleEnd + buffer);
      
      return {
        startIndex,
        endIndex,
        visibleStart,
        visibleEnd,
        totalHeight: itemCount * itemHeight,
        offsetY: startIndex * itemHeight
      };
    }, [itemCount, itemHeight, containerHeight, scrollTop]);
  };
  
  return {
    renderCount,
    lastRenderTime,
    createDebouncedScrollHandler,
    createThrottledResizeHandler,
    createMemoizedDateCalculation,
    useVirtualScrolling
  };
};

// Hook for optimizing gantt chart rendering
export const useGanttOptimization = ({
  cellWidth,
  dayCount,
  memberCount
}: {
  cellWidth: number;
  dayCount: number;
  memberCount: number;
}) => {
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: dayCount });
  const [visibleMembers, setVisibleMembers] = useState({ start: 0, end: memberCount });
  
  // Calculate visible cells based on viewport
  const calculateVisibleCells = useCallback((scrollLeft: number, viewportWidth: number) => {
    const start = Math.floor(scrollLeft / cellWidth);
    const end = Math.ceil((scrollLeft + viewportWidth) / cellWidth);
    const buffer = Math.ceil(viewportWidth / cellWidth);
    
    setVisibleRange({
      start: Math.max(0, start - buffer),
      end: Math.min(dayCount, end + buffer)
    });
  }, [cellWidth, dayCount]);
  
  const calculateVisibleMembers = useCallback((scrollTop: number, viewportHeight: number, memberHeight: number) => {
    const start = Math.floor(scrollTop / memberHeight);
    const end = Math.ceil((scrollTop + viewportHeight) / memberHeight);
    const buffer = Math.ceil(viewportHeight / memberHeight);
    
    setVisibleMembers({
      start: Math.max(0, start - buffer),
      end: Math.min(memberCount, end + buffer)
    });
  }, [memberCount]);
  
  // Memoized cell renderer
  const createCellRenderer = useCallback((renderCell: (dayIndex: number, memberIndex: number) => React.ReactNode) => {
    return useMemo(() => {
      const cells: React.ReactNode[] = [];
      
      for (let memberIndex = visibleMembers.start; memberIndex < visibleMembers.end; memberIndex++) {
        for (let dayIndex = visibleRange.start; dayIndex < visibleRange.end; dayIndex++) {
          cells.push(renderCell(dayIndex, memberIndex));
        }
      }
      
      return cells;
    }, [visibleRange, visibleMembers, renderCell]);
  }, [visibleRange, visibleMembers]);
  
  return {
    visibleRange,
    visibleMembers,
    calculateVisibleCells,
    calculateVisibleMembers,
    createCellRenderer
  };
};

// Hook for caching and memoization
export const useScheduleCache = <T extends Record<string, any>>(key: string, data: T, ttl: number = 300000) => {
  const cache = useRef<Map<string, { data: T; timestamp: number }>>(new Map());
  
  const getCachedData = useCallback((cacheKey: string): T | null => {
    const cached = cache.current.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.data;
    }
    return null;
  }, [ttl]);
  
  const setCachedData = useCallback((cacheKey: string, newData: T) => {
    cache.current.set(cacheKey, {
      data: newData,
      timestamp: Date.now()
    });
  }, []);
  
  const invalidateCache = useCallback((cacheKey?: string) => {
    if (cacheKey) {
      cache.current.delete(cacheKey);
    } else {
      cache.current.clear();
    }
  }, []);
  
  // Auto-cache current data
  useEffect(() => {
    if (data) {
      setCachedData(key, data);
    }
  }, [key, data, setCachedData]);
  
  return {
    getCachedData,
    setCachedData,
    invalidateCache,
    cacheSize: cache.current.size
  };
};

// Hook for performance monitoring
export const usePerformanceMonitor = (componentName: string) => {
  const metrics = useRef({
    renderCount: 0,
    totalRenderTime: 0,
    maxRenderTime: 0,
    minRenderTime: Infinity,
    lastRenderTime: 0
  });
  
  const startTime = useRef(0);
  
  useEffect(() => {
    startTime.current = performance.now();
    metrics.current.renderCount++;
    
    return () => {
      const renderTime = performance.now() - startTime.current;
      metrics.current.totalRenderTime += renderTime;
      metrics.current.maxRenderTime = Math.max(metrics.current.maxRenderTime, renderTime);
      metrics.current.minRenderTime = Math.min(metrics.current.minRenderTime, renderTime);
      metrics.current.lastRenderTime = renderTime;
      
      // Log performance metrics in development
      if (process.env.NODE_ENV === 'development' && metrics.current.renderCount % 100 === 0) {
        const avgRenderTime = metrics.current.totalRenderTime / metrics.current.renderCount;
        console.group(`${componentName} Performance Metrics`);
        console.log(`Renders: ${metrics.current.renderCount}`);
        console.log(`Avg Render Time: ${avgRenderTime.toFixed(2)}ms`);
        console.log(`Max Render Time: ${metrics.current.maxRenderTime.toFixed(2)}ms`);
        console.log(`Min Render Time: ${metrics.current.minRenderTime.toFixed(2)}ms`);
        console.log(`Last Render Time: ${metrics.current.lastRenderTime.toFixed(2)}ms`);
        console.groupEnd();
      }
    };
  });
  
  const getMetrics = useCallback(() => {
    const avgRenderTime = metrics.current.totalRenderTime / metrics.current.renderCount;
    return {
      ...metrics.current,
      avgRenderTime
    };
  }, []);
  
  const resetMetrics = useCallback(() => {
    metrics.current = {
      renderCount: 0,
      totalRenderTime: 0,
      maxRenderTime: 0,
      minRenderTime: Infinity,
      lastRenderTime: 0
    };
  }, []);
  
  return {
    getMetrics,
    resetMetrics
  };
};