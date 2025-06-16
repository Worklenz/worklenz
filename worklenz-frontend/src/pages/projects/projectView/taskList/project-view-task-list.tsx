import { useEffect, useState, useMemo } from 'react';
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
import { Empty } from 'antd';
import useTabSearchParam from '@/hooks/useTabSearchParam';

const ProjectViewTaskList = () => {
  const dispatch = useAppDispatch();
  const { projectView } = useTabSearchParam();
  const [searchParams, setSearchParams] = useSearchParams();
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

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

  // Single source of truth for loading state - EXCLUDE labels loading from skeleton
  // Labels loading should not block the main task list display
  const isLoading = useMemo(() => 
    loadingGroups || loadingPhases || loadingStatusCategories || !initialLoadComplete,
    [loadingGroups, loadingPhases, loadingStatusCategories, initialLoadComplete]
  );

  // Memoize the empty state check
  const isEmptyState = useMemo(() => 
    taskGroups && taskGroups.length === 0 && !isLoading,
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

  // Batch initial data fetching - core data only
  useEffect(() => {
    const fetchInitialData = async () => {
      if (!projectId || !groupBy || initialLoadComplete) return;

      try {
        // Batch only essential API calls for initial load
        // Filter data (labels, assignees, etc.) will load separately and not block the UI
        await Promise.allSettled([
          dispatch(fetchTaskListColumns(projectId)),
          dispatch(fetchPhasesByProjectId(projectId)),
          dispatch(fetchStatusesCategories()),
        ]);
        setInitialLoadComplete(true);
      } catch (error) {
        console.error('Error fetching initial data:', error);
        setInitialLoadComplete(true); // Still mark as complete to prevent infinite loading
      }
    };

    fetchInitialData();
  }, [projectId, groupBy, dispatch, initialLoadComplete]);

  // Fetch task groups with dependency on initial load completion
  useEffect(() => {
    const fetchTasks = async () => {
      if (!projectId || !groupBy || projectView !== 'list' || !initialLoadComplete) return;

      try {
        await dispatch(fetchTaskGroups(projectId));
      } catch (error) {
        console.error('Error fetching task groups:', error);
      }
    };

    fetchTasks();
  }, [projectId, groupBy, projectView, dispatch, fields, search, archived, initialLoadComplete]);

  // Memoize the task groups to prevent unnecessary re-renders
  const memoizedTaskGroups = useMemo(() => taskGroups || [], [taskGroups]);

  return (
    <Flex vertical gap={16} style={{ overflowX: 'hidden' }}>
      {/* Filters load independently and don't block the main content */}
      <TaskListFilters position="list" />

      {isEmptyState ? (
        <Empty description="No tasks group found" />
      ) : (
        <Skeleton active loading={isLoading} className='mt-4 p-4'>
          <TaskGroupWrapperOptimized 
            taskGroups={memoizedTaskGroups} 
            groupBy={groupBy} 
          />
        </Skeleton>
      )}
    </Flex>
  );
};

export default ProjectViewTaskList;
