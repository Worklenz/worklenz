import { useEffect, useState, useMemo, useRef } from 'react';
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
  logger.debug('🚀 ProjectViewTaskList component render/mount', {
    timestamp: new Date().toISOString()
  });

  const dispatch = useAppDispatch();
  const { projectView } = useTabSearchParam();
  const [searchParams, setSearchParams] = useSearchParams();
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const lastFetchParamsRef = useRef<string>('');

  // Combine related selectors to reduce subscriptions
  const {
    projectId,
    taskGroups,
    loadingGroups,
    groupBy,
    archived,
    fields,
    search,
  } = useAppSelector(state => ({
    projectId: state.projectReducer.projectId,
    taskGroups: state.taskReducer.taskGroups,
    loadingGroups: state.taskReducer.loadingGroups,
    groupBy: state.taskReducer.groupBy,
    archived: state.taskReducer.archived,
    fields: state.taskReducer.fields,
    search: state.taskReducer.search,
  }));

  const {
    statusCategories,
    loading: loadingStatusCategories,
  } = useAppSelector(state => ({
    statusCategories: state.taskStatusReducer.statusCategories,
    loading: state.taskStatusReducer.loading,
  }));

  const { loadingPhases } = useAppSelector(state => ({
    loadingPhases: state.phaseReducer.loadingPhases,
  }));

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
    logger.debug('🎯 Initial data fetch useEffect triggered:', {
      projectId,
      groupBy,
      initialLoadComplete,
      timestamp: new Date().toISOString()
    });

    const fetchInitialData = async () => {
      if (!projectId || !groupBy || initialLoadComplete) {
        logger.debug('❌ Initial data fetch early return');
        return;
      }

      logger.debug('🚀 Starting initial data fetch...');

      try {
        // Batch only essential API calls for initial load
        // Filter data (labels, assignees, etc.) will load separately and not block the UI
        logger.debug('📡 Dispatching initial API calls...');
        await Promise.allSettled([
          dispatch(fetchTaskListColumns(projectId)),
          dispatch(fetchPhasesByProjectId(projectId)),
          dispatch(fetchStatusesCategories()),
        ]);
        logger.debug('✅ Initial API calls completed');
        logger.debug('🏁 Setting initialLoadComplete to true');
        setInitialLoadComplete(true);
      } catch (error) {
        logger.error('❌ Error fetching initial data:', error);
        setInitialLoadComplete(true); // Still mark as complete to prevent infinite loading
      }
    };

    fetchInitialData();
  }, [projectId, groupBy, dispatch, initialLoadComplete]);

  // Track fields changes for debugging
  useEffect(() => {
    logger.debug('🔧 Fields state changed:', {
      fieldsLength: fields?.length,
      fields: fields,
      timestamp: new Date().toISOString()
    });
  }, [fields]);

  // Track search changes for debugging
  useEffect(() => {
    logger.debug('🔍 Search state changed:', {
      search,
      timestamp: new Date().toISOString()
    });
  }, [search]);

  // Track archived changes for debugging
  useEffect(() => {
    logger.debug('📦 Archived state changed:', {
      archived,
      timestamp: new Date().toISOString()
    });
  }, [archived]);

  // Fetch task groups - single source of truth for task fetching
  useEffect(() => {
    logger.debug('🔄 fetchTasks useEffect triggered with dependencies:', {
      projectId,
      groupBy,
      projectView,
      fieldsLength: fields?.length,
      search,
      archived,
      initialLoadComplete,
      timestamp: new Date().toISOString()
    });

    const fetchTasks = async () => {
      logger.debug('📝 fetchTasks function called - checking conditions:', {
        hasProjectId: !!projectId,
        hasGroupBy: !!groupBy,
        isListView: projectView === 'list',
        isInitialLoadComplete: initialLoadComplete
      });

      if (!projectId || !groupBy || projectView !== 'list' || !initialLoadComplete) {
        logger.debug('❌ fetchTasks early return - conditions not met');
        return;
      }

      // Create a unique key for current fetch parameters to avoid duplicate calls
      const currentParams = `${projectId}-${groupBy}-${JSON.stringify(fields)}-${search}-${archived}`;
      logger.debug('🔑 Current params:', currentParams);
      logger.debug('🔑 Last params:   ', lastFetchParamsRef.current);
      
      // Skip if we already fetched with the same parameters
      if (lastFetchParamsRef.current === currentParams) {
        logger.debug('🚫 Skipping duplicate fetch - same parameters');
        return;
      }
      
      logger.debug('✅ Parameters changed - proceeding with fetch');
      lastFetchParamsRef.current = currentParams;

      try {
        logger.debug('🚀 Starting fetchTaskGroups dispatch...');
        await dispatch(fetchTaskGroups(projectId));
        logger.debug('✅ fetchTaskGroups completed successfully');
      } catch (error) {
        logger.error('❌ Error fetching task groups:', error);
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
