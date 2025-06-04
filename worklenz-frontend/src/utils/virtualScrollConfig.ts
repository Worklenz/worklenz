/**
 * Enhanced virtual scrolling configuration for task lists
 * Optimized for faster loading and responsive scroll position updates
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { RefObject } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

export const VIRTUAL_SCROLL_CONFIG = {
  // Enhanced overscan values for faster loading and smoother scrolling
  DEFAULT_OVERSCAN: 40,      // Increased from 25 for faster perceived loading
  LARGE_LIST_OVERSCAN: 60,   // Increased from 35 for better large list performance
  SMALL_LIST_OVERSCAN: 25,   // Increased from 15 for smoother small lists
  
  // More aggressive preloading for instant perceived performance
  PRELOAD_OVERSCAN: 80,      // Increased from 50 for faster loading
  INSTANT_OVERSCAN: 100,     // For instant loading scenarios
  
  // Standard row heights
  TASK_ROW_HEIGHT: 42,
  HEADER_ROW_HEIGHT: 40,
  
  // Enhanced scroll padding for better buffer management
  SCROLL_PADDING: {
    start: 50,    // Increased from 0 for better buffer
    end: 50,      // Increased from 0 for better buffer
  },
  
  // Optimized scroll margins with larger preload zones
  SCROLL_MARGINS: {
    start: 200,   // Increased from 100px for faster preloading
    end: 200,     // Increased from 100px for faster preloading
  },
  
  // Browser-specific optimizations with enhanced measuring
  MEASURE_ELEMENT: typeof window !== 'undefined' && navigator.userAgent.indexOf('Firefox') === -1
    ? (element: Element | undefined) => {
        if (!element) return 42; // fallback height
        // Use cached measurements when possible
        const rect = element.getBoundingClientRect();
        return rect.height || 42;
      }
    : undefined,
    
  // Faster scroll behavior optimizations
  SCROLL_DEBOUNCE: 8,        // Reduced from 16 for more responsive updates (~120fps)
  LAYOUT_EFFECT_DEPS: ['count', 'estimateSize'], // Optimize re-renders
  
  // Enhanced scroll synchronization
  SCROLL_SYNC: {
    immediate: true,           // Enable immediate scroll position updates
    throttleMs: 8,            // More responsive throttling
    usePassive: true,         // Use passive event listeners
    enableSmoothScrolling: true,
  },
  
  // Data loading optimizations
  DATA_LOADING: {
    preloadThreshold: 0.7,    // Start loading when 70% scrolled to boundary
    cacheSize: 2000,          // Cache up to 2000 items
    staleTime: 30000,         // 30s cache validity
    batchSize: 50,            // Load 50 items at a time
  },
} as const;

/**
 * Gets optimized overscan value based on list size and performance needs
 */
export const getOptimalOverscan = (itemCount: number, aggressive = false): number => {
  const multiplier = aggressive ? 1.8 : 1.2; // Increased multipliers for better performance
  
  if (itemCount > 1000) return Math.floor(VIRTUAL_SCROLL_CONFIG.LARGE_LIST_OVERSCAN * multiplier);
  if (itemCount < 100) return Math.floor(VIRTUAL_SCROLL_CONFIG.SMALL_LIST_OVERSCAN * multiplier);
  return Math.floor(VIRTUAL_SCROLL_CONFIG.DEFAULT_OVERSCAN * multiplier);
};

/**
 * Creates optimized virtualizer config for task lists with enhanced preloading
 */
export const createTaskListVirtualizerConfig = (
  count: number,
  getScrollElement: () => Element | null,
  estimateSize?: () => number,
  aggressive = false
) => ({
  count,
  getScrollElement,
  estimateSize: estimateSize ?? (() => VIRTUAL_SCROLL_CONFIG.TASK_ROW_HEIGHT),
  overscan: aggressive ? VIRTUAL_SCROLL_CONFIG.INSTANT_OVERSCAN : getOptimalOverscan(count, aggressive),
  scrollPaddingStart: VIRTUAL_SCROLL_CONFIG.SCROLL_PADDING.start,
  scrollPaddingEnd: VIRTUAL_SCROLL_CONFIG.SCROLL_PADDING.end,
  scrollMargin: VIRTUAL_SCROLL_CONFIG.SCROLL_MARGINS.start,
  measureElement: VIRTUAL_SCROLL_CONFIG.MEASURE_ELEMENT,
  // Enhanced scroll position synchronization
  initialRect: { width: 0, height: 0 },
  enableSmoothScrolling: VIRTUAL_SCROLL_CONFIG.SCROLL_SYNC.enableSmoothScrolling,
  // Enable immediate updates for scroll position changes - REMOVED onChange to prevent recursion
  lanes: 1, // Single lane for consistent positioning
});

/**
 * Enhanced CSS properties for hardware acceleration and faster loading
 */
export const HARDWARE_ACCELERATION_STYLES = {
  transform: 'translate3d(0, 0, 0)',
  willChange: 'transform, scroll-position',  // Added scroll-position for better optimization
  backfaceVisibility: 'hidden' as const,
  contain: 'layout style paint size' as const,  // Added 'size' for better containment
  isolation: 'isolate' as const,               // Improve stacking context performance
} as const;

/**
 * Enhanced scroll event handler with immediate position updates
 */
export const createOptimizedScrollHandler = (callback: () => void, immediate = false) => {
  let ticking = false;
  let lastScrollTime = 0;
  
  return (event?: Event) => {
    const now = performance.now();
    
    // For immediate updates (scroll position sync)
    if (immediate || (now - lastScrollTime) > VIRTUAL_SCROLL_CONFIG.SCROLL_DEBOUNCE) {
      callback();
      lastScrollTime = now;
      return;
    }
    
    // For non-immediate updates, use requestAnimationFrame
    if (!ticking) {
      requestAnimationFrame(() => {
        callback();
        ticking = false;
        lastScrollTime = performance.now();
      });
      ticking = true;
    }
  };
};

/**
 * Enhanced scroll position synchronization
 */
export const createScrollPositionSync = (elements: HTMLElement[]) => {
  let isScrolling = false;
  
  const syncScrollPosition = (sourceElement: HTMLElement, targetElements: HTMLElement[]) => {
    if (isScrolling) return;
    
    isScrolling = true;
    const { scrollTop, scrollLeft } = sourceElement;
    
    // Use immediate synchronization for better UX
    targetElements.forEach(element => {
      if (element !== sourceElement) {
        element.scrollTop = scrollTop;
        element.scrollLeft = scrollLeft;
      }
    });
    
    // Reset flag after a short delay
    requestAnimationFrame(() => {
      isScrolling = false;
    });
  };
  
  return { syncScrollPosition };
};

/**
 * Enhanced preloading configuration for faster perceived performance
 */
export const PRELOAD_CONFIG = {
  // Enhanced preloading parameters
  PRELOAD_ROWS: 40,          // Increased from 20 for better preloading
  PRELOAD_THRESHOLD: 0.7,    // Reduced from 0.8 for earlier loading
  MAX_CACHED_ITEMS: 2000,    // Increased from 1000 for better caching
  CACHE_VALIDITY_MS: 30000,  // 30 seconds cache validity
  BATCH_SIZE: 50,            // Load items in batches of 50
  
  // Data loading strategies
  LOADING_STRATEGIES: {
    eager: { overscan: 100, threshold: 0.5 },     // Load early and aggressively
    balanced: { overscan: 60, threshold: 0.7 },   // Balanced approach
    lazy: { overscan: 30, threshold: 0.9 },       // Load only when needed
  },
} as const;

/**
 * Virtual list item cache for faster rendering
 */
export class VirtualItemCache {
  private cache = new Map<string, any>();
  private timestamps = new Map<string, number>();
  private maxSize: number;
  private staleTime: number;
  
  constructor(maxSize = PRELOAD_CONFIG.MAX_CACHED_ITEMS, staleTime = PRELOAD_CONFIG.CACHE_VALIDITY_MS) {
    this.maxSize = maxSize;
    this.staleTime = staleTime;
  }
  
  get(key: string) {
    const timestamp = this.timestamps.get(key);
    if (timestamp && (Date.now() - timestamp) > this.staleTime) {
      this.cache.delete(key);
      this.timestamps.delete(key);
      return undefined;
    }
    return this.cache.get(key);
  }
  
  set(key: string, value: any) {
    // Clean up old entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const oldestKey = Array.from(this.timestamps.entries())
        .sort(([, a], [, b]) => a - b)[0][0];
      this.cache.delete(oldestKey);
      this.timestamps.delete(oldestKey);
    }
    
    this.cache.set(key, value);
    this.timestamps.set(key, Date.now());
  }
  
  clear() {
    this.cache.clear();
    this.timestamps.clear();
  }
  
  size() {
    return this.cache.size;
  }
}

/**
 * Create a global cache instance for virtual list items
 */
export const globalVirtualItemCache = new VirtualItemCache();

/**
 * Enhanced data loader with predictive loading
 */
export const createPredictiveDataLoader = <T>(
  loadDataFunction: (startIndex: number, endIndex: number) => Promise<T[]>,
  cacheKey: string
) => {
  let isLoading = false;
  const pendingRanges = new Set<string>();
  
  const loadRange = async (startIndex: number, endIndex: number): Promise<T[]> => {
    const rangeKey = `${cacheKey}_${startIndex}_${endIndex}`;
    
    // Check cache first
    const cached = globalVirtualItemCache.get(rangeKey);
    if (cached) {
      return cached;
    }
    
    // Avoid duplicate requests
    if (pendingRanges.has(rangeKey) || isLoading) {
      return [];
    }
    
    pendingRanges.add(rangeKey);
    isLoading = true;
    
    try {
      const data = await loadDataFunction(startIndex, endIndex);
      globalVirtualItemCache.set(rangeKey, data);
      return data;
    } catch (error) {
      console.error('Data loading error:', error);
      return [];
    } finally {
      pendingRanges.delete(rangeKey);
      isLoading = false;
    }
  };
  
  return { loadRange };
};

/**
 * React hook for optimized virtual list data loading with preloading
 */
export const useVirtualListDataLoader = <T>(
  totalCount: number,
  loadDataFunction: (startIndex: number, endIndex: number) => Promise<T[]>,
  cacheKey: string,
  preloadStrategy: 'eager' | 'balanced' | 'lazy' = 'balanced'
) => {
  const [loadingState, setLoadingState] = useState<{
    isLoading: boolean;
    loadedRanges: Array<{ start: number; end: number }>;
    error: string | null;
  }>({
    isLoading: false,
    loadedRanges: [],
    error: null,
  });

  const dataLoader = useMemo(
    () => createPredictiveDataLoader(loadDataFunction, cacheKey),
    [loadDataFunction, cacheKey]
  );

  const strategy = PRELOAD_CONFIG.LOADING_STRATEGIES[preloadStrategy];

  const loadData = useCallback(
    async (visibleStartIndex: number, visibleEndIndex: number) => {
      setLoadingState(prev => ({ ...prev, isLoading: true, error: null }));

      try {
        // Calculate preload range based on strategy
        const preloadStart = Math.max(0, visibleStartIndex - strategy.overscan);
        const preloadEnd = Math.min(totalCount - 1, visibleEndIndex + strategy.overscan);

        // Load visible range first
        await dataLoader.loadRange(visibleStartIndex, visibleEndIndex);

        // Preload adjacent ranges
        if (preloadStart < visibleStartIndex) {
          dataLoader.loadRange(preloadStart, visibleStartIndex - 1).catch(console.error);
        }
        if (preloadEnd > visibleEndIndex) {
          dataLoader.loadRange(visibleEndIndex + 1, preloadEnd).catch(console.error);
        }

        setLoadingState(prev => ({
          ...prev,
          isLoading: false,
          loadedRanges: [
            ...prev.loadedRanges,
            { start: visibleStartIndex, end: visibleEndIndex }
          ].filter((range, index, arr) => 
            // Remove duplicates and overlaps
            arr.findIndex(r => r.start === range.start && r.end === range.end) === index
          ),
        }));
      } catch (error) {
        setLoadingState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Loading failed',
        }));
      }
    },
    [dataLoader, strategy, totalCount]
  );

  const getCachedData = useCallback(
    (startIndex: number, endIndex: number): T[] | null => {
      const rangeKey = `${cacheKey}_${startIndex}_${endIndex}`;
      return globalVirtualItemCache.get(rangeKey) || null;
    },
    [cacheKey]
  );

  return {
    loadData,
    getCachedData,
    isLoading: loadingState.isLoading,
    loadedRanges: loadingState.loadedRanges,
    error: loadingState.error,
    clearCache: () => globalVirtualItemCache.clear(),
  };
};

/**
 * Enhanced virtual list configuration with immediate scroll sync
 */
export const useEnhancedVirtualList = <T>(
  items: T[],
  containerRef: RefObject<HTMLElement>,
  options: {
    itemHeight: number;
    overscan?: number;
    aggressive?: boolean;
    onScrollPositionChange?: (scrollTop: number) => void;
  }
) => {
  const { itemHeight, overscan, aggressive = false, onScrollPositionChange } = options;

  const virtualizer = useVirtualizer(
    createTaskListVirtualizerConfig(
      items.length,
      () => containerRef.current,
      () => itemHeight,
      aggressive
    )
  );

  // Enhanced scroll synchronization
  const [scrollTop, setScrollTop] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = createOptimizedScrollHandler(() => {
      const newScrollTop = container.scrollTop;
      setScrollTop(newScrollTop);
      onScrollPositionChange?.(newScrollTop);
      
      // Removed virtualizer.measure() to prevent infinite recursion
      // The virtualizer handles measurements automatically
    }, true); // Always immediate for scroll position accuracy

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [containerRef, onScrollPositionChange]);

  return {
    virtualizer,
    scrollTop,
    setScrollTop: (top: number) => {
      if (containerRef.current) {
        containerRef.current.scrollTop = top;
      }
    },
  };
}; 