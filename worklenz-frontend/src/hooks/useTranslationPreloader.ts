import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  ensureTranslationsLoaded, 
  preloadPageTranslations,
  getPerformanceMetrics,
  changeLanguageOptimized 
} from '../i18n';
import logger from '../utils/errorLogger';

// Cache for preloaded translation states
const preloadCache = new Map<string, boolean>();
const loadingStates = new Map<string, boolean>();

interface TranslationHookOptions {
  preload?: boolean;
  priority?: number;
  fallbackReady?: boolean;
}

interface TranslationHookReturn {
  t: (key: string, defaultValue?: string) => string;
  ready: boolean;
  isLoading: boolean;
  error: Error | null;
  retryLoad: () => Promise<void>;
  performanceMetrics: any;
}

// Enhanced translation hook with better performance
export const useOptimizedTranslation = (
  namespace: string | string[],
  options: TranslationHookOptions = {}
): TranslationHookReturn => {
  const { preload = true, priority = 5, fallbackReady = true } = options;
  
  const namespaces = Array.isArray(namespace) ? namespace : [namespace];
  const namespaceKey = namespaces.join(',');
  
  const [ready, setReady] = useState(fallbackReady);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const hasInitialized = useRef(false);
  const loadingPromise = useRef<Promise<void> | null>(null);
  
  const { t, i18n } = useTranslation(namespaces);

  // Memoized preload function
  const preloadTranslations = useCallback(async () => {
    const cacheKey = `${i18n.language}:${namespaceKey}`;
    
    // Skip if already preloaded or currently loading
    if (preloadCache.get(cacheKey) || loadingStates.get(cacheKey)) {
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      loadingStates.set(cacheKey, true);
      
      const startTime = performance.now();
      
      // Use the optimized preload function
      await preloadPageTranslations(namespaces);
      
      const endTime = performance.now();
      const loadTime = endTime - startTime;
      
      if (process.env.NODE_ENV === 'development') {
        console.log(
          `✅ Preloaded translations for ${namespaceKey} in ${loadTime.toFixed(2)}ms`
        );
      }
      
      preloadCache.set(cacheKey, true);
      setReady(true);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to preload translations');
      setError(error);
      logger.error(`Failed to preload translations for ${namespaceKey}:`, error);
      
      // Fallback to ready state even on error to prevent blocking UI
      if (fallbackReady) {
        setReady(true);
      }
    } finally {
      setIsLoading(false);
      loadingStates.set(cacheKey, false);
    }
  }, [namespaces, namespaceKey, i18n.language, fallbackReady]);

  // Initialize preloading
  useEffect(() => {
    if (!hasInitialized.current && preload) {
      hasInitialized.current = true;
      
      if (!loadingPromise.current) {
        loadingPromise.current = preloadTranslations();
      }
    }
  }, [preload, preloadTranslations]);

  // Handle language changes
  useEffect(() => {
    const handleLanguageChange = () => {
      const cacheKey = `${i18n.language}:${namespaceKey}`;
      if (!preloadCache.get(cacheKey) && preload) {
        setReady(false);
        preloadTranslations();
      }
    };

    i18n.on('languageChanged', handleLanguageChange);
    return () => {
      i18n.off('languageChanged', handleLanguageChange);
    };
  }, [i18n, namespaceKey, preload, preloadTranslations]);

  // Retry function
  const retryLoad = useCallback(async () => {
    const cacheKey = `${i18n.language}:${namespaceKey}`;
    preloadCache.delete(cacheKey);
    loadingStates.delete(cacheKey);
    await preloadTranslations();
  }, [namespaceKey, i18n.language, preloadTranslations]);

  // Get performance metrics
  const performanceMetrics = useMemo(() => getPerformanceMetrics(), [ready]);

  // Enhanced t function with better error handling
  const enhancedT = useCallback((key: string, defaultValue?: string) => {
    try {
      const translation = t(key, { defaultValue });
      
      // Return the translation if it's not the key itself (indicating it was found)
      if (translation !== key) {
        return translation;
      }
      
      // If we have a default value, use it
      if (defaultValue) {
        return defaultValue;
      }
      
      // Fallback to the key
      return key;
    } catch (err) {
      logger.error(`Translation error for key ${key}:`, err);
      return defaultValue || key;
    }
  }, [t]);

  return {
    t: enhancedT,
    ready,
    isLoading,
    error,
    retryLoad,
    performanceMetrics,
  };
};

// Specialized hooks for commonly used namespaces
export const useTaskManagementTranslations = (options?: TranslationHookOptions) => {
  return useOptimizedTranslation(['task-management', 'task-list-table'], {
    priority: 8,
    ...options,
  });
};

export const useBulkActionTranslations = (options?: TranslationHookOptions) => {
  return useOptimizedTranslation(['tasks/task-table-bulk-actions', 'task-management'], {
    priority: 6,
    ...options,
  });
};

export const useTaskDrawerTranslations = (options?: TranslationHookOptions) => {
  return useOptimizedTranslation(['task-drawer/task-drawer', 'task-list-table'], {
    priority: 7,
    ...options,
  });
};

export const useProjectTranslations = (options?: TranslationHookOptions) => {
  return useOptimizedTranslation(['project-drawer', 'common'], {
    priority: 7,
    ...options,
  });
};

export const useSettingsTranslations = (options?: TranslationHookOptions) => {
  return useOptimizedTranslation(['settings', 'common'], {
    priority: 4,
    ...options,
  });
};

// Utility function to preload multiple namespaces
export const preloadMultipleNamespaces = async (
  namespaces: string[],
  priority: number = 5
): Promise<boolean> => {
  try {
    await Promise.all(
      namespaces.map(ns => preloadPageTranslations([ns]))
    );
    return true;
  } catch (error) {
    logger.error('Failed to preload multiple namespaces:', error);
    return false;
  }
};

// Hook for pages that need multiple translation namespaces
export const usePageTranslations = (
  namespaces: string[],
  options?: TranslationHookOptions
) => {
  const { ready, isLoading, error } = useOptimizedTranslation(namespaces, options);
  
  // Create individual translation functions for each namespace
  const translations = useMemo(() => {
    const result: Record<string, any> = {};
    
    namespaces.forEach(ns => {
      const { t } = useTranslation(ns);
      result[ns] = t;
    });
    
    return result;
  }, [namespaces, ready]);

  return {
    ...translations,
    ready,
    isLoading,
    error,
  };
};

// Language switching utilities
export const useLanguageSwitcher = () => {
  const [switching, setSwitching] = useState(false);
  
  const switchLanguage = useCallback(async (language: string) => {
    try {
      setSwitching(true);
      await changeLanguageOptimized(language);
      
      // Clear preload cache for new language
      preloadCache.clear();
      loadingStates.clear();
      
    } catch (error) {
      logger.error('Failed to switch language:', error);
    } finally {
      setSwitching(false);
    }
  }, []);

  return {
    switchLanguage,
    switching,
  };
};

// Performance monitoring hook
export const useTranslationPerformance = () => {
  const [metrics, setMetrics] = useState(getPerformanceMetrics());
  
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(getPerformanceMetrics());
    }, 5000); // Update every 5 seconds
    
    return () => clearInterval(interval);
  }, []);
  
  return metrics;
};
