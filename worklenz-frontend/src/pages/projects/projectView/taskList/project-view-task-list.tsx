import { useEffect, useState, useMemo } from 'react';
import Flex from 'antd/es/flex';
import Skeleton from 'antd/es/skeleton';
import { useSearchParams } from 'react-router-dom';

import TaskListFilters from './task-list-filters/task-list-filters';
import TaskGroupWrapper from './task-list-table/task-group-wrapper/task-group-wrapper';
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
  const [isLoading, setIsLoading] = useState(true);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  const { projectId } = useAppSelector(state => state.projectReducer);
  const { taskGroups, loadingGroups, groupBy, archived, fields, search } = useAppSelector(
    state => state.taskReducer
  );
  const { statusCategories, loading: loadingStatusCategories } = useAppSelector(
    state => state.taskStatusReducer
  );
  const { loadingPhases } = useAppSelector(state => state.phaseReducer);
  const { loadingColumns } = useAppSelector(state => state.taskReducer);

  // Memoize the loading state calculation - ignoring task list filter loading
  const isLoadingState = useMemo(() => 
    loadingGroups || loadingPhases || loadingStatusCategories,
    [loadingGroups, loadingPhases, loadingStatusCategories]
  );

  // Memoize the empty state check
  const isEmptyState = useMemo(() => 
    taskGroups && taskGroups.length === 0 && !isLoadingState,
    [taskGroups, isLoadingState]
  );

  // Handle view type changes
  useEffect(() => {
    if (projectView !== 'list' && projectView !== 'board') {
      const newParams = new URLSearchParams(searchParams);
      newParams.set('tab', 'tasks-list');
      newParams.set('pinned_tab', 'tasks-list');
      setSearchParams(newParams);
    }
  }, [projectView, setSearchParams]);

  // Update loading state
  useEffect(() => {
    setIsLoading(isLoadingState);
  }, [isLoadingState]);

  // Fetch initial data only once
  useEffect(() => {
    const fetchInitialData = async () => {
      if (!projectId || !groupBy || initialLoadComplete) return;

      try {
        await Promise.all([
          dispatch(fetchTaskListColumns(projectId)),
          dispatch(fetchPhasesByProjectId(projectId)),
          dispatch(fetchStatusesCategories())
        ]);
        setInitialLoadComplete(true);
      } catch (error) {
        console.error('Error fetching initial data:', error);
      }
    };

    fetchInitialData();
  }, [projectId, groupBy, dispatch, initialLoadComplete]);

  // Fetch task groups
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

  return (
    <Flex vertical gap={16} style={{ overflowX: 'hidden' }}>
      <TaskListFilters position="list" />

      {isEmptyState ? (
        <Empty description="No tasks group found" />
      ) : (
        <Skeleton active loading={isLoading} className='mt-4 p-4'>
          <TaskGroupWrapper taskGroups={taskGroups} groupBy={groupBy} />
        </Skeleton>
      )}
    </Flex>
  );
};

export default ProjectViewTaskList;
