import { useEffect, useCallback } from 'react';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { fetchPriorities } from '@/features/taskAttributes/taskPrioritySlice';
import {
  fetchLabelsByProject,
  fetchTaskAssignees,
} from '@/features/tasks/tasks.slice';
import { getTeamMembers } from '@/features/team-members/team-members.slice';

/**
 * Hook to manage filter data loading independently of main task list loading
 * This ensures filter data loading doesn't block the main UI skeleton
 */
export const useFilterDataLoader = () => {
  const dispatch = useAppDispatch();
  
  const { priorities } = useAppSelector(state => ({
    priorities: state.priorityReducer.priorities,
  }));
  
  const { projectId } = useAppSelector(state => ({
    projectId: state.projectReducer.projectId,
  }));

  // Load filter data asynchronously
  const loadFilterData = useCallback(async () => {
    try {
      // Load priorities if not already loaded (usually fast/cached)
      if (!priorities.length) {
        dispatch(fetchPriorities());
      }

      // Load project-specific data in parallel without blocking
      if (projectId) {
        // These dispatch calls are fire-and-forget
        // They will update the UI when ready, but won't block initial render
        dispatch(fetchLabelsByProject(projectId));
        dispatch(fetchTaskAssignees(projectId));
      }

      // Load team members for member filters
      dispatch(getTeamMembers({ 
        index: 0, 
        size: 100, 
        field: null, 
        order: null, 
        search: null, 
        all: true 
      }));
    } catch (error) {
      console.error('Error loading filter data:', error);
      // Don't throw - filter loading errors shouldn't break the main UI
    }
  }, [dispatch, priorities.length, projectId]);

  // Load filter data on mount and when dependencies change
  useEffect(() => {
    // Use setTimeout to ensure this runs after the main component render
    // This prevents filter loading from blocking the initial render
    const timeoutId = setTimeout(loadFilterData, 0);
    
    return () => clearTimeout(timeoutId);
  }, [loadFilterData]);

  return {
    loadFilterData,
  };
}; 