import { useEffect, useState } from 'react';
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
  // Add local loading state to immediately show skeleton
  const [isLoading, setIsLoading] = useState(true);

  const { projectId } = useAppSelector(state => state.projectReducer);
  const { taskGroups, loadingGroups, groupBy, archived, fields, search } = useAppSelector(
    state => state.taskReducer
  );
  const { statusCategories, loading: loadingStatusCategories } = useAppSelector(
    state => state.taskStatusReducer
  );
  const { loadingPhases } = useAppSelector(state => state.phaseReducer);
  const { loadingColumns } = useAppSelector(state => state.taskReducer);

  useEffect(() => {
    // Set default view to list if projectView is not list or board
    if (projectView !== 'list' && projectView !== 'board') {
      searchParams.set('tab', 'tasks-list');
      searchParams.set('pinned_tab', 'tasks-list');
      setSearchParams(searchParams);
    }
  }, [projectView, searchParams, setSearchParams]);

  useEffect(() => {
    // Set loading state based on all loading conditions
    setIsLoading(loadingGroups || loadingColumns || loadingPhases || loadingStatusCategories);
  }, [loadingGroups, loadingColumns, loadingPhases, loadingStatusCategories]);

  useEffect(() => {
    const loadData = async () => {
      if (projectId && groupBy) {
        const promises = [];
        
        if (!loadingColumns) promises.push(dispatch(fetchTaskListColumns(projectId)));
        if (!loadingPhases) promises.push(dispatch(fetchPhasesByProjectId(projectId)));
        if (!loadingGroups && projectView === 'list') {
          promises.push(dispatch(fetchTaskGroups(projectId)));
        }
        if (!statusCategories.length) {
          promises.push(dispatch(fetchStatusesCategories()));
        }
        
        // Wait for all data to load
        await Promise.all(promises);
      }
    };
    
    loadData();
  }, [dispatch, projectId, groupBy, fields, search, archived]);

  return (
    <Flex vertical gap={16} style={{ overflowX: 'hidden' }}>
      <TaskListFilters position="list" />

      {(taskGroups && taskGroups.length === 0 && !isLoading) ? (
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
