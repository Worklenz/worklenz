import { useEffect } from 'react';
import { Flex } from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { fetchStatusesCategories } from '@/features/taskAttributes/taskStatusSlice';
import { fetchTasksV3 } from '@/features/task-management/task-management.slice';
import { deselectAll } from '@/features/projects/bulkActions/bulkActionSlice';
import TaskListBoard from '@/components/task-management/task-list-board';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { evt_project_task_list_visit } from '@/shared/worklenz-analytics-events';

const ProjectViewTaskList = () => {
  const dispatch = useAppDispatch();
  const projectId = useAppSelector(state => state.projectReducer.projectId);
  const { statusCategories } = useAppSelector(state => state.taskStatusReducer);
  const { trackMixpanelEvent } = useMixpanelTracking();

  useEffect(() => {
    if (projectId) {
      // Use the optimized V3 API for faster loading
      dispatch(fetchTasksV3(projectId));
      trackMixpanelEvent(evt_project_task_list_visit, { project_id: projectId });
    }
    if (!statusCategories.length) {
      dispatch(fetchStatusesCategories());
    }
  }, [dispatch, projectId, trackMixpanelEvent]);

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
