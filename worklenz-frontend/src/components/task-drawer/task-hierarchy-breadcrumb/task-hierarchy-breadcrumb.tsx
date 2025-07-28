import React, { useState, useEffect } from 'react';
import { Breadcrumb, Button, Typography, Tooltip } from '@/shared/antd-imports';
import { HomeOutlined } from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { fetchTask, setSelectedTaskId } from '@/features/task-drawer/task-drawer.slice';
import { tasksApiService } from '@/api/tasks/tasks.api.service';
import { TFunction } from 'i18next';
import './task-hierarchy-breadcrumb.css';

interface TaskHierarchyBreadcrumbProps {
  t: TFunction;
  onBackClick?: () => void;
}

interface TaskHierarchyItem {
  id: string;
  name: string;
  parent_task_id?: string;
}

// Utility function to truncate text
const truncateText = (text: string, maxLength: number = 25): string => {
  if (!text || text.length <= maxLength) return text;
  return `${text.substring(0, maxLength)}...`;
};

const TaskHierarchyBreadcrumb: React.FC<TaskHierarchyBreadcrumbProps> = ({ t, onBackClick }) => {
  const dispatch = useAppDispatch();
  const { taskFormViewModel } = useAppSelector(state => state.taskDrawerReducer);
  const { projectId } = useAppSelector(state => state.projectReducer);
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const [hierarchyPath, setHierarchyPath] = useState<TaskHierarchyItem[]>([]);
  const [loading, setLoading] = useState(false);

  const task = taskFormViewModel?.task;
  const isSubTask = task?.is_sub_task || !!task?.parent_task_id;

  // Recursively fetch the complete hierarchy path
  const fetchHierarchyPath = async (currentTaskId: string): Promise<TaskHierarchyItem[]> => {
    if (!projectId) return [];

    const path: TaskHierarchyItem[] = [];
    let taskId = currentTaskId;

    // Traverse up the hierarchy until we reach the root
    while (taskId) {
      try {
        const response = await tasksApiService.getFormViewModel(taskId, projectId);
        if (response.done && response.body.task) {
          const taskData = response.body.task;
          path.unshift({
            id: taskData.id,
            name: taskData.name || '',
            parent_task_id: taskData.parent_task_id || undefined,
          });

          // Move to parent task
          taskId = taskData.parent_task_id || '';
        } else {
          break;
        }
      } catch (error) {
        console.error('Error fetching task in hierarchy:', error);
        break;
      }
    }

    return path;
  };

  // Fetch the complete hierarchy when component mounts or task changes
  useEffect(() => {
    const loadHierarchy = async () => {
      if (!isSubTask || !task?.parent_task_id || !projectId) {
        setHierarchyPath([]);
        return;
      }

      setLoading(true);
      try {
        const path = await fetchHierarchyPath(task.parent_task_id);
        setHierarchyPath(path);
      } catch (error) {
        console.error('Error loading task hierarchy:', error);
        setHierarchyPath([]);
      } finally {
        setLoading(false);
      }
    };

    loadHierarchy();
  }, [task?.parent_task_id, projectId, isSubTask]);

  const handleNavigateToTask = (taskId: string) => {
    if (projectId) {
      if (onBackClick) {
        onBackClick();
      }

      // Navigate to the selected task
      dispatch(setSelectedTaskId(taskId));
      dispatch(fetchTask({ taskId, projectId }));
    }
  };

  if (!isSubTask || hierarchyPath.length === 0) {
    return null;
  }

  // Create breadcrumb items from the hierarchy path
  const breadcrumbItems = [
    // Add all parent tasks in the hierarchy
    ...hierarchyPath.map((hierarchyTask, index) => {
      const truncatedName = truncateText(hierarchyTask.name, 25);
      const shouldShowTooltip = hierarchyTask.name.length > 25;

      return {
        title: (
          <Tooltip title={shouldShowTooltip ? hierarchyTask.name : ''} trigger="hover">
            <Button
              type="link"
              icon={index === 0 ? <HomeOutlined /> : undefined}
              onClick={() => handleNavigateToTask(hierarchyTask.id)}
              style={{
                padding: 0,
                height: 'auto',
                color: themeMode === 'dark' ? '#1890ff' : '#1890ff',
                fontSize: '14px',
                marginRight: '0px',
                maxWidth: '200px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: index === 0 ? '6px' : '0px', // Add gap between icon and text for root task
              }}
            >
              {truncatedName}
            </Button>
          </Tooltip>
        ),
      };
    }),
    // Add the current task as the last item (non-clickable)
    {
      title: (() => {
        const currentTaskName = task?.name || t('taskHeader.currentTask', 'Current Task');
        const truncatedCurrentName = truncateText(currentTaskName, 25);
        const shouldShowCurrentTooltip = currentTaskName.length > 25;

        return (
          <Tooltip title={shouldShowCurrentTooltip ? currentTaskName : ''} trigger="hover">
            <Typography.Text
              className="current-task-name"
              style={{
                color: themeMode === 'dark' ? '#ffffffd9' : '#000000d9',
                fontSize: '14px',
                fontWeight: 500,
                maxWidth: '200px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                display: 'inline-block',
              }}
            >
              {truncatedCurrentName}
            </Typography.Text>
          </Tooltip>
        );
      })(),
    },
  ];

  return (
    <div className="task-hierarchy-breadcrumb">
      {loading ? (
        <Typography.Text style={{ color: themeMode === 'dark' ? '#ffffffd9' : '#000000d9' }}>
          {t('taskHeader.loadingHierarchy', 'Loading hierarchy...')}
        </Typography.Text>
      ) : (
        <Breadcrumb items={breadcrumbItems} />
      )}
    </div>
  );
};

export default TaskHierarchyBreadcrumb;
