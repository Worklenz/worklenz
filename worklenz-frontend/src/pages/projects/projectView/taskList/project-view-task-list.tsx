import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
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
import logger from '@/utils/errorLogger';

const ProjectViewTaskList = () => {
  const dispatch = useAppDispatch();
  const { projectView } = useTabSearchParam();
  const [searchParams, setSearchParams] = useSearchParams();
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const lastFetchParamsRef = useRef<string>('');

  // Memoize selectors to prevent unnecessary re-renders
  const taskState = useAppSelector(state => ({
    projectId: state.projectReducer.projectId,
    taskGroups: state.taskReducer.taskGroups,
    loadingGroups: state.taskReducer.loadingGroups,
    groupBy: state.taskReducer.groupBy,
    archived: state.taskReducer.archived,
    fields: state.taskReducer.fields,
    search: state.taskReducer.search,
  }));

  const statusState = useAppSelector(state => ({
    statusCategories: state.taskStatusReducer.statusCategories,
    loading: state.taskStatusReducer.loading,
  }));

  const phaseState = useAppSelector(state => ({
    loadingPhases: state.phaseReducer.loadingPhases,
  }));

  // Destructure after memoization
  const { projectId, taskGroups, loadingGroups, groupBy, archived, fields, search } = taskState;
  const { loading: loadingStatusCategories } = statusState;
  const { loadingPhases } = phaseState;

  // Memoize loading state calculation
  const isLoading = useMemo(() => 
    loadingGroups || loadingPhases || loadingStatusCategories || !initialLoadComplete,
    [loadingGroups, loadingPhases, loadingStatusCategories, initialLoadComplete]
  );

  // Memoize empty state check
  const isEmptyState = useMemo(() => 
    taskGroups && taskGroups.length === 0 && !isLoading,
    [taskGroups, isLoading]
  );

  // Memoize task groups to prevent unnecessary re-renders
  const memoizedTaskGroups = useMemo(() => taskGroups || [], [taskGroups]);

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
        await Promise.allSettled([
          dispatch(fetchTaskListColumns(projectId)),
          dispatch(fetchPhasesByProjectId(projectId)),
          dispatch(fetchStatusesCategories()),
        ]);
        setInitialLoadComplete(true);
      } catch (error) {
        logger.error('Error fetching initial data', error);
        setInitialLoadComplete(true);
      }
    };

    fetchInitialData();
  }, [projectId, groupBy, dispatch, initialLoadComplete]);

  // Memoize the fetch function to prevent unnecessary re-renders
  const fetchTasks = useCallback(async () => {
    if (!projectId || !groupBy || projectView !== 'list' || !initialLoadComplete) return;

    const currentParams = `${projectId}-${groupBy}-${JSON.stringify(fields)}-${search}-${archived}`;
    
    if (lastFetchParamsRef.current === currentParams) {
      logger.debug('Skipping duplicate fetch - same parameters');
      return;
    }
    
    lastFetchParamsRef.current = currentParams;

    try {
      await dispatch(fetchTaskGroups(projectId));
    } catch (error) {
      logger.error('Error fetching task groups', error);
    }
  }, [projectId, groupBy, projectView, dispatch, fields, search, archived, initialLoadComplete]);

  // Single effect for task fetching
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

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
