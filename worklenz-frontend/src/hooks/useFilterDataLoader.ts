import { useEffect, useCallback } from 'react';
import { useStore } from 'react-redux';
import type { RootState } from '@/app/store';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { fetchPriorities } from '@/features/taskAttributes/taskPrioritySlice';
import { fetchLabelsByProject, fetchTaskAssignees } from '@/features/tasks/tasks.slice';
import { getTeamMembers } from '@/features/team-members/team-members.slice';
import { fetchStatuses } from '@/features/taskAttributes/taskStatusSlice';
import { fetchPhasesByProjectId } from '@/features/projects/singleProject/phase/phases.slice';

/**
 * Hook to manage filter data loading independently of main task list loading
 * This ensures filter data loading doesn't block the main UI skeleton
 */
export const useFilterDataLoader = () => {
  const dispatch = useAppDispatch();
  const store = useStore<RootState>();

  // Memoize the priorities selector to prevent unnecessary re-renders
  const priorities = useAppSelector(state => state.priorityReducer.priorities);

  // Memoize the statuses selector to prevent unnecessary re-renders
  const statuses = useAppSelector(state => state.taskStatusReducer.status);

  // Memoize the projectId selector to prevent unnecessary re-renders
  const projectId = useAppSelector(state => state.projectReducer.projectId);

  // Export a refresh function for external use
  const refreshFilterData = useCallback(async () => {
    if (projectId) {
      dispatch(fetchLabelsByProject(projectId));
      dispatch(fetchTaskAssignees(projectId));
      dispatch(fetchStatuses(projectId));
      dispatch(fetchPhasesByProjectId(projectId));
    }
    dispatch(fetchPriorities());
    dispatch(
      getTeamMembers({
        index: 0,
        size: 100,
        field: null,
        order: null,
        search: null,
        all: true,
      })
    );
  }, [dispatch, projectId]);

  // Load filter data asynchronously
  const loadFilterData = useCallback(async () => {
    try {
      // Load priorities if not already loaded (usually fast/cached)
      if (!priorities.length) {
        dispatch(fetchPriorities());
      }

      // Load project-specific data in parallel without blocking
      if (projectId) {
        const { taskReducer, phaseReducer } = store.getState();
        if (
          taskReducer.labelsProjectId !== projectId &&
          taskReducer.labelsLoadingProjectId !== projectId
        ) {
          dispatch(fetchLabelsByProject(projectId));
        }
        if (
          taskReducer.assigneesProjectId !== projectId &&
          taskReducer.assigneesLoadingProjectId !== projectId
        ) {
          dispatch(fetchTaskAssignees(projectId));
        }

        // Load statuses if not already loaded
        if (!statuses.length) {
          dispatch(fetchStatuses(projectId));
        }

        if (
          phaseReducer.loadedProjectId !== projectId &&
          phaseReducer.loadingProjectId !== projectId
        ) {
          dispatch(fetchPhasesByProjectId(projectId));
        }
      }

      // Load team members for member filters
      dispatch(
        getTeamMembers({
          index: 0,
          size: 100,
          field: null,
          order: null,
          search: null,
          all: true,
        })
      );
    } catch (error) {
      console.error('Error loading filter data:', error);
      // Don't throw - filter loading errors shouldn't break the main UI
    }
  }, [dispatch, store, priorities.length, statuses.length, projectId]);

  // Load filter data on mount and when dependencies change
  useEffect(() => {
    // Use setTimeout to ensure this runs after the main component render
    // This prevents filter loading from blocking the initial render
    const timeoutId = setTimeout(loadFilterData, 0);

    return () => clearTimeout(timeoutId);
  }, [loadFilterData]);

  return {
    loadFilterData,
    refreshFilterData,
  };
};
