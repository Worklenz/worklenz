import { useEffect } from 'react';
import { Flex } from 'antd';
import TaskListFilters from './taskListFilters/TaskListFilters';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { fetchStatusesCategories } from '@/features/taskAttributes/taskStatusSlice';
import { fetchTaskGroups } from '@/features/tasks/tasks.slice';
import { fetchPriorities } from '@/features/taskAttributes/taskPrioritySlice';
import { ITaskListConfigV2 } from '@/types/tasks/taskList.types';
import TaskListTable from '../task-list/task-list-table';

const ProjectViewTaskList = () => {
  const dispatch = useAppDispatch();
  const { taskGroups, loadingGroups } = useAppSelector(state => state.taskReducer);
  const { statusCategories } = useAppSelector(state => state.taskStatusReducer);
  const { priorities } = useAppSelector(state => state.priorityReducer);
  const projectId = useAppSelector(state => state.projectReducer.projectId);

  useEffect(() => {
    if (projectId) {
      const config: ITaskListConfigV2 = {
        id: projectId,
        field: 'id',
        order: 'desc',
        search: '',
        statuses: '',
        members: '',
        projects: '',
        isSubtasksInclude: true,
      };
      dispatch(fetchTaskGroups(config));
    }
    if (!statusCategories.length) {
      dispatch(fetchStatusesCategories());
    }
    if (!priorities.length) {
      dispatch(fetchPriorities());
    }
  }, [dispatch, projectId, statusCategories.length, priorities.length]);

  const handleStatusChange = (taskId: string, statusId: string) => {
    // Handle status change
    console.log('Status changed:', taskId, statusId);
  };

  const handlePriorityChange = (taskId: string, priorityId: string) => {
    // Handle priority change
    console.log('Priority changed:', taskId, priorityId);
  };

  return (
    <Flex vertical gap={16} style={{ overflowX: 'hidden' }}>
      <TaskListFilters position="list" />

      {taskGroups.map(group => (
        <div key={group.id} style={{ marginBottom: '24px' }}>
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: group.color_code || '#f0f0f0',
              color: 'white',
              borderRadius: '8px 8px 0 0',
              fontWeight: 500
            }}
          >
            {group.name || 'Unnamed Group'}
          </div>
          <TaskListTable
            data={(group.tasks || []).map(task => ({
              ...task,
              id: task.id || '',
              name: task.name || ''
            }))}
            statusOptions={statusCategories.map(category => ({
              id: category.id || '',
              name: category.name || '',
              color: category.color_code
            })).filter(option => option.id && option.name)}
            priorityOptions={priorities.map((priority: any) => ({
              id: priority.id || '',
              name: priority.name || '',
              color: priority.color_code
            })).filter(option => option.id && option.name)}
            onStatusChange={handleStatusChange}
            onPriorityChange={handlePriorityChange}
          />
        </div>
      ))}
    </Flex>
  );
};

export default ProjectViewTaskList;
