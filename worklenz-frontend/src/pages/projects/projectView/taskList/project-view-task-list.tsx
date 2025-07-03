import { useEffect, useState, useMemo } from 'react';
import { Empty } from '@/shared/antd-imports';
import Flex from 'antd/es/flex';
import Skeleton from 'antd/es/skeleton';
import { useSearchParams } from 'react-router-dom';

import TaskListFilters from './task-list-filters/task-list-filters';
import TaskGroupWrapperOptimized from './task-group-wrapper-optimized';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { fetchTaskGroups, fetchTaskListColumns } from '@/features/tasks/tasks.slice';
import { fetchStatusesCategories } from '@/features/taskAttributes/taskStatusSlice';
import { fetchPhasesByProjectId } from '@/features/projects/singleProject/phase/phases.slice';
import useTabSearchParam from '@/hooks/useTabSearchParam';

const ProjectViewTaskList = () => {
  const dispatch = useAppDispatch();
  const { projectView } = useTabSearchParam();
  const [searchParams, setSearchParams] = useSearchParams();
  const [coreDataLoaded, setCoreDataLoaded] = useState(false);

  // Split selectors to prevent unnecessary rerenders
  const projectId = useAppSelector(state => state.projectReducer.projectId);
  const taskGroups = useAppSelector(state => state.taskReducer.taskGroups);
  const loadingGroups = useAppSelector(state => state.taskReducer.loadingGroups);
  const groupBy = useAppSelector(state => state.taskReducer.groupBy);
  const archived = useAppSelector(state => state.taskReducer.archived);
  const fields = useAppSelector(state => state.taskReducer.fields);
  const search = useAppSelector(state => state.taskReducer.search);

  const statusCategories = useAppSelector(state => state.taskStatusReducer.statusCategories);
  const loadingStatusCategories = useAppSelector(state => state.taskStatusReducer.loading);

  const loadingPhases = useAppSelector(state => state.phaseReducer.loadingPhases);

  // Simplified loading state - only wait for essential data
  // Remove dependency on phases and status categories for initial render
  const isLoading = useMemo(
    () => loadingGroups || !coreDataLoaded,
    [loadingGroups, coreDataLoaded]
  );

  // Memoize the empty state check
  const isEmptyState = useMemo(
    () => taskGroups && taskGroups.length === 0 && !isLoading,
    [taskGroups, isLoading]
  );

  // Handle view type changes
  useEffect(() => {
    if (projectView !== 'list' && projectView !== 'board') {
      const newParams = new URLSearchParams(searchParams);
      newParams.set('tab', 'tasks-list');
      newParams.set('pinned_tab', 'tasks-list');
      setSearchParams(newParams);
    }
  }, [projectView, setSearchParams, searchParams]);

  // Optimized parallel data fetching - don't wait for everything
  useEffect(() => {
    const fetchCoreData = async () => {
      if (!projectId || !groupBy || coreDataLoaded) return;

      try {
        // Start all requests in parallel, but only wait for task columns
        // Other data can load in background without blocking UI
        const corePromises = [
          dispatch(fetchTaskListColumns(projectId)),
          dispatch(fetchTaskGroups(projectId)), // Start immediately
        ];

        // Background data - don't wait for these
        dispatch(fetchPhasesByProjectId(projectId));
        dispatch(fetchStatusesCategories());

        // Only wait for essential data
        await Promise.allSettled(corePromises);
        setCoreDataLoaded(true);
      } catch (error) {
        console.error('Error fetching core data:', error);
        setCoreDataLoaded(true); // Still mark as complete to prevent infinite loading
      }
    };

    fetchCoreData();
  }, [projectId, groupBy, dispatch, coreDataLoaded]);

  // Optimized task groups fetching - remove initialLoadComplete dependency
  useEffect(() => {
    const fetchTasks = async () => {
      if (!projectId || !groupBy || projectView !== 'list') return;

      try {
        // Only refetch if filters change, not on initial load
        if (coreDataLoaded) {
          await dispatch(fetchTaskGroups(projectId));
        }
      } catch (error) {
        console.error('Error fetching task groups:', error);
      }
    };

    // Only refetch when filters change
    if (coreDataLoaded) {
      fetchTasks();
    }
  }, [projectId, groupBy, projectView, dispatch, fields, search, archived, coreDataLoaded]);

  // Memoize the task groups to prevent unnecessary re-renders
  const memoizedTaskGroups = useMemo(() => taskGroups || [], [taskGroups]);

  return (
    <Flex vertical gap={16} style={{ overflowX: 'hidden' }}>
      {/* Filters load synchronously - no suspense boundary */}
      <TaskListFilters position="list" />

      {isEmptyState ? (
        <Empty description="No tasks group found" />
      ) : (
        <Skeleton active loading={isLoading} className="mt-4 p-4">
          <TaskGroupWrapperOptimized taskGroups={memoizedTaskGroups} groupBy={groupBy} />
        </Skeleton>
      )}
    </Flex>
  );
};

export default ProjectViewTaskList;
