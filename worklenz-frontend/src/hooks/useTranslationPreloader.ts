import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ensureTranslationsLoaded } from '@/i18n';

interface UseTranslationPreloaderOptions {
  namespaces?: string[];
  fallback?: React.ReactNode;
}

/**
 * Hook to ensure translations are loaded before rendering components
 * This prevents Suspense issues when components use useTranslation
 */
export const useTranslationPreloader = (
  namespaces: string[] = ['tasks/task-table-bulk-actions', 'task-management'],
  options: UseTranslationPreloaderOptions = {}
) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { t, ready } = useTranslation(namespaces);

  useEffect(() => {
    let isMounted = true;

    const loadTranslations = async () => {
      try {
        setIsLoading(true);
        
        // Ensure translations are loaded
        await ensureTranslationsLoaded(namespaces);
        
        // Wait for i18next to be ready
        if (!ready) {
          // If i18next is not ready, wait a bit and check again
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        if (isMounted) {
          setIsLoaded(true);
          setIsLoading(false);
        }
      } catch (error) {
        if (isMounted) {
          setIsLoaded(true); // Still set as loaded to prevent infinite loading
          setIsLoading(false);
        }
      }
    };

    loadTranslations();

    return () => {
      isMounted = false;
    };
  }, [namespaces, ready]);

  return {
    t,
    ready: isLoaded && ready,
    isLoading,
    isLoaded,
  };
};

/**
 * Hook specifically for bulk action bar translations
 */
export const useBulkActionTranslations = () => {
  return useTranslationPreloader(['tasks/task-table-bulk-actions']);
};

/**
 * Hook for task management translations
 */
export const useTaskManagementTranslations = () => {
  return useTranslationPreloader(['task-management', 'tasks/task-table-bulk-actions']);
}; 