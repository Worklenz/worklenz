import { useEffect } from 'react';

/**
 * ResourcePreloader component to preload critical chunks for better performance
 * This helps reduce loading times when users navigate to different project view tabs
 */
const ResourcePreloader = () => {
  useEffect(() => {
    // Preload critical project view chunks after initial page load
    const preloadCriticalChunks = () => {
      // Only preload in production and if the user is likely to use project views
      if (import.meta.env.DEV) return;

      // Check if user is on a project-related page or dashboard
      const currentPath = window.location.pathname;
      const isProjectRelated = currentPath.includes('/projects') || 
                             currentPath.includes('/worklenz') ||
                             currentPath === '/';

      if (!isProjectRelated) return;

      // Preload the most commonly used project view components
      const criticalImports = [
        () => import('@/pages/projects/projectView/taskList/project-view-task-list'),
        () => import('@/pages/projects/projectView/board/project-view-board'),
        () => import('@/components/project-task-filters/filter-dropdowns/group-by-filter-dropdown'),
        () => import('@/components/project-task-filters/filter-dropdowns/search-dropdown'),
      ];

      // Preload with a small delay to not interfere with initial page load
      setTimeout(() => {
        criticalImports.forEach(importFn => {
          importFn().catch(error => {
            // Silently handle preload failures - they're not critical
            console.debug('Preload failed:', error);
          });
        });
      }, 2000); // 2 second delay after initial load
    };

    // Start preloading when component mounts
    preloadCriticalChunks();
  }, []);

  // This component doesn't render anything
  return null;
};

export default ResourcePreloader; 