import { useEffect, useRef } from 'react';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { persistFilters } from '@/features/tasks/tasks.slice';

/**
 * Hook to automatically persist task filters whenever they change
 * Listens to filter state changes and saves them to localStorage
 *
 * IMPORTANT: This hook prevents persisting stale filters when switching projects.
 * The bug: projectReducer.projectId changes before taskReducer filter state resets.
 * This means useFilterPersistence fires and reads the OLD project's filters while
 * taskReducer still holds them, then writes them under the NEW project's storage key,
 * clobbering the new project's saved filters.
 *
 * Solution: skip persisting on the render where a project switch is first observed
 * (the old filters are still in taskReducer at that point), and skip persisting
 * while a restoration is actively in progress. Once the projectId is stable and
 * no restoration is in flight, filter changes persist immediately — this also
 * covers hook remounts where the project's filters were already restored earlier.
 */
export const useFilterPersistence = () => {
  const dispatch = useAppDispatch();

  // Get all filter-related state
  const taskReducer = useAppSelector(state => state.taskReducer);
  const projectId = useAppSelector(state => state.projectReducer.projectId);
  const isRestoringFilters = useAppSelector(state => state.taskReducer.isRestoringFilters);

  const previousProjectIdRef = useRef<string | null>(null);

  // Whenever filters change, persist them
  useEffect(() => {
    // Only persist if we have a projectId context (to keep filters scoped)
    if (!projectId) {
      return;
    }

    // CRITICAL: skip the render where the project just switched — taskReducer
    // may still hold the previous project's filters at this point.
    if (previousProjectIdRef.current !== projectId) {
      previousProjectIdRef.current = projectId;
      return;
    }

    // Don't persist while a restoration is actively in progress.
    if (isRestoringFilters) {
      return;
    }

    dispatch(persistFilters());
  }, [
    taskReducer.priorities,
    taskReducer.phases,
    taskReducer.taskAssignees,
    taskReducer.statuses,
    taskReducer.labels,
    taskReducer.search,
    taskReducer.archived,
    projectId,
    isRestoringFilters,
    dispatch,
  ]);
};
