import { useEffect } from 'react';
import { Flex } from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { fetchStatusesCategories } from '@/features/taskAttributes/taskStatusSlice';
import { fetchTasksV3 } from '@/features/task-management/task-management.slice';
import { deselectAll } from '@/features/projects/bulkActions/bulkActionSlice';
import TaskListBoard from '@/components/task-management/task-list-board';

const ProjectViewTaskList = () => {
  const dispatch = useAppDispatch();
  const projectId = useAppSelector(state => state.projectReducer.projectId);
  const { statusCategories } = useAppSelector(state => state.taskStatusReducer);

  useEffect(() => {
    if (projectId) {
      // Use the optimized V3 API for faster loading
      dispatch(fetchTasksV3(projectId));
    }
    if (!statusCategories.length) {
      dispatch(fetchStatusesCategories());
    }
  }, [dispatch, projectId]);

  // Cleanup effect - reset values when component is destroyed
  useEffect(() => {
    return () => {
      // Clear any selected tasks when component unmounts
      dispatch(deselectAll());
    };
  }, [dispatch]);

  if (!projectId) {
    return (
      <Flex vertical gap={16} style={{ overflowX: 'hidden' }}>
        <div>No project selected</div>
      </Flex>
    );
  }

  return (
    <Flex vertical gap={16} style={{ overflowX: 'hidden' }}>
      <TaskListBoard projectId={projectId} className="task-list-board" />
    </Flex>
  );
};

export default ProjectViewTaskList;
