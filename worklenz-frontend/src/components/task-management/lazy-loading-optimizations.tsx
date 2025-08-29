import React, { lazy, Suspense, ComponentType, ReactNode } from 'react';
import { Skeleton, Spin } from '@/shared/antd-imports';

// Enhanced lazy loading with error boundary and retry logic
export function createOptimizedLazy<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  fallback?: ReactNode
): React.LazyExoticComponent<T> {
  let retryCount = 0;
  const maxRetries = 3;

  const retryImport = async (): Promise<{ default: T }> => {
    try {
      return await importFunc();
    } catch (error) {
      if (retryCount < maxRetries) {
        retryCount++;
        console.warn(`Lazy loading failed, retrying... (${retryCount}/${maxRetries})`);
        // Exponential backoff: 500ms, 1s, 2s
        await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, retryCount - 1)));
        return retryImport();
      }
      throw error;
    }
  };

  return lazy(retryImport);
}

// Preloading utility for components that will likely be used
export const preloadComponent = <T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>
): void => {
  // Preload on user interaction or after a delay
  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(() => {
      importFunc().catch(() => {
        // Ignore preload errors
      });
    });
  } else {
    setTimeout(() => {
      importFunc().catch(() => {
        // Ignore preload errors
      });
    }, 2000);
  }
};

// Lazy-loaded task management components with optimized fallbacks
export const LazyTaskListBoard = createOptimizedLazy(
  () => import('./task-list-board'),
  <div className="h-96 flex items-center justify-center">
    <Spin size="large" tip="Loading task board..." />
  </div>
);

export const LazyVirtualizedTaskList = createOptimizedLazy(
  () => import('./virtualized-task-list'),
  <Skeleton active paragraph={{ rows: 8 }} />
);

export const LazyTaskRow = createOptimizedLazy(
  () => import('./task-row'),
  <Skeleton.Input active style={{ width: '100%', height: 40 }} />
);

export const LazyImprovedTaskFilters = createOptimizedLazy(
  () => import('./improved-task-filters'),
  <Skeleton.Button active style={{ width: '100%', height: 60 }} />
);

export const LazyOptimizedBulkActionBar = createOptimizedLazy(
  () => import('./optimized-bulk-action-bar'),
  <Skeleton.Button active style={{ width: '100%', height: 48 }} />
);

export const LazyPerformanceAnalysis = createOptimizedLazy(
  () => import('./performance-analysis'),
  <div className="p-4 text-center">Loading performance tools...</div>
);

// Kanban-specific components
export const LazyKanbanTaskListBoard = createOptimizedLazy(
  () => import('../kanban-board-management-v2/kanbanTaskListBoard'),
  <div className="h-96 flex items-center justify-center">
    <Spin size="large" tip="Loading kanban board..." />
  </div>
);

// Task list V2 components
export const LazyTaskListV2Table = createOptimizedLazy(
  () => import('../task-list-v2/TaskListV2Table'),
  <Skeleton active paragraph={{ rows: 10 }} />
);

export const LazyTaskRowWithSubtasks = createOptimizedLazy(
  () => import('../task-list-v2/TaskRowWithSubtasks'),
  <Skeleton.Input active style={{ width: '100%', height: 40 }} />
);

export const LazyCustomColumnModal = createOptimizedLazy(
  () =>
    import(
      '@/pages/projects/projectView/taskList/task-list-table/custom-columns/custom-column-modal/custom-column-modal'
    ),
  <div className="p-4">
    <Skeleton active />
  </div>
);

export const LazyLabelsSelector = createOptimizedLazy(
  () => import('@/components/LabelsSelector'),
  <Skeleton.Button active style={{ width: 120, height: 24 }} />
);

export const LazyAssigneeSelector = createOptimizedLazy(
  () => import('./lazy-assignee-selector'),
  <Skeleton.Avatar active size="small" />
);

export const LazyTaskStatusDropdown = createOptimizedLazy(
  () => import('./task-status-dropdown'),
  <Skeleton.Button active style={{ width: 100, height: 24 }} />
);

export const LazyTaskPriorityDropdown = createOptimizedLazy(
  () => import('./task-priority-dropdown'),
  <Skeleton.Button active style={{ width: 80, height: 24 }} />
);

export const LazyTaskPhaseDropdown = createOptimizedLazy(
  () => import('./task-phase-dropdown'),
  <Skeleton.Button active style={{ width: 90, height: 24 }} />
);

// HOC for progressive enhancement
interface ProgressiveEnhancementProps {
  condition: boolean;
  children: ReactNode;
  fallback?: ReactNode;
  loadingComponent?: ReactNode;
}

export const ProgressiveEnhancement: React.FC<ProgressiveEnhancementProps> = ({
  condition,
  children,
  fallback,
  loadingComponent = <Skeleton active />,
}) => {
  if (!condition) {
    return <>{fallback || loadingComponent}</>;
  }

  return <Suspense fallback={loadingComponent}>{children}</Suspense>;
};

// Intersection observer based lazy loading for components
interface IntersectionLazyLoadProps {
  children: ReactNode;
  fallback?: ReactNode;
  rootMargin?: string;
  threshold?: number;
  once?: boolean;
}

export const IntersectionLazyLoad: React.FC<IntersectionLazyLoadProps> = ({
  children,
  fallback = <Skeleton active />,
  rootMargin = '100px',
  threshold = 0.1,
  once = true,
}) => {
  const [isVisible, setIsVisible] = React.useState(false);
  const [hasBeenVisible, setHasBeenVisible] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (once) {
            setHasBeenVisible(true);
            observer.disconnect();
          }
        } else if (!once) {
          setIsVisible(false);
        }
      },
      { rootMargin, threshold }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [rootMargin, threshold, once]);

  const shouldRender = isVisible || hasBeenVisible;

  return (
    <div ref={ref}>
      {shouldRender ? <Suspense fallback={fallback}>{children}</Suspense> : fallback}
    </div>
  );
};

// Route-based code splitting utility
export const createRouteComponent = <T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  pageTitle?: string
) => {
  const LazyComponent = createOptimizedLazy(importFunc);

  return React.memo(() => {
    React.useEffect(() => {
      if (pageTitle) {
        document.title = pageTitle;
      }
    }, []);

    return (
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center">
            <Spin size="large" tip={`Loading ${pageTitle || 'page'}...`} />
          </div>
        }
      >
        <LazyComponent {...({} as any)} />
      </Suspense>
    );
  });
};

// Bundle splitting by feature
export const TaskManagementBundle = {
  TaskListBoard: LazyTaskListBoard,
  VirtualizedTaskList: LazyVirtualizedTaskList,
  TaskRow: LazyTaskRow,
  TaskFilters: LazyImprovedTaskFilters,
  BulkActionBar: LazyOptimizedBulkActionBar,
  PerformanceAnalysis: LazyPerformanceAnalysis,
};

export const KanbanBundle = {
  KanbanBoard: LazyKanbanTaskListBoard,
};

export const TaskListV2Bundle = {
  TaskTable: LazyTaskListV2Table,
  TaskRowWithSubtasks: LazyTaskRowWithSubtasks,
};

export const FormBundle = {
  CustomColumnModal: LazyCustomColumnModal,
  LabelsSelector: LazyLabelsSelector,
  AssigneeSelector: LazyAssigneeSelector,
};

export const DropdownBundle = {
  StatusDropdown: LazyTaskStatusDropdown,
  PriorityDropdown: LazyTaskPriorityDropdown,
  PhaseDropdown: LazyTaskPhaseDropdown,
};

// Preloading strategies
export const preloadTaskManagementComponents = () => {
  // Preload core components that are likely to be used
  preloadComponent(() => import('./task-list-board'));
  preloadComponent(() => import('./virtualized-task-list'));
  preloadComponent(() => import('./improved-task-filters'));
};

export const preloadKanbanComponents = () => {
  preloadComponent(() => import('../kanban-board-management-v2/kanbanTaskListBoard'));
};

export const preloadFormComponents = () => {
  preloadComponent(() => import('@/components/LabelsSelector'));
};

// Dynamic import utilities
export const importTaskComponent = async (componentName: string) => {
  const componentMap: Record<string, () => Promise<any>> = {
    'task-list-board': () => import('./task-list-board'),
    'virtualized-task-list': () => import('./virtualized-task-list'),
    'task-row': () => import('./task-row'),
    'improved-task-filters': () => import('./improved-task-filters'),
    'optimized-bulk-action-bar': () => import('./optimized-bulk-action-bar'),
    'performance-analysis': () => import('./performance-analysis'),
  };

  const importFunc = componentMap[componentName];
  if (!importFunc) {
    throw new Error(`Component ${componentName} not found`);
  }

  return importFunc();
};

// Error boundary for lazy loaded components
interface LazyErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class LazyErrorBoundary extends React.Component<
  { children: ReactNode; fallback?: ReactNode },
  LazyErrorBoundaryState
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): LazyErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Lazy loading error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="p-4 text-center text-red-600">
            <p>Failed to load component</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Reload Page
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

// Usage example and documentation
export const LazyLoadingExamples = {
  // Basic lazy loading with suspense
  BasicExample: () => (
    <Suspense fallback={<Skeleton active />}>
      <LazyTaskListBoard projectId="123" />
    </Suspense>
  ),

  // Progressive enhancement
  ProgressiveExample: () => (
    <ProgressiveEnhancement condition={true}>
      <LazyTaskRow
        task={{ id: '1', status: 'todo', priority: 'medium', created_at: '', updated_at: '' }}
        projectId="123"
        groupId="group1"
        currentGrouping="status"
        isSelected={false}
        onSelect={() => {}}
        onToggleSubtasks={() => {}}
      />
    </ProgressiveEnhancement>
  ),

  // Intersection observer lazy loading
  IntersectionExample: () => (
    <IntersectionLazyLoad rootMargin="200px">
      <LazyPerformanceAnalysis projectId="123" />
    </IntersectionLazyLoad>
  ),

  // Error boundary with lazy loading
  ErrorBoundaryExample: () => (
    <LazyErrorBoundary>
      <Suspense fallback={<Skeleton active />}>
        <LazyTaskRow
          task={{ id: '1', status: 'todo', priority: 'medium', created_at: '', updated_at: '' }}
          projectId="123"
          groupId="group1"
          currentGrouping="status"
          isSelected={false}
          onSelect={() => {}}
          onToggleSubtasks={() => {}}
        />
      </Suspense>
    </LazyErrorBoundary>
  ),
};
