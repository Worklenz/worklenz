import React, { useState, useEffect } from 'react';
import { Breadcrumb, Button, Typography, Tooltip } from '@/shared/antd-imports';
import { FolderOutlined } from '@ant-design/icons';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { fetchTask, setSelectedTaskId } from '@/features/task-drawer/task-drawer.slice';
import { tasksApiService } from '@/api/tasks/tasks.api.service';
import { TFunction } from 'i18next';
import './task-hierarchy-breadcrumb.css';

interface TaskHierarchyBreadcrumbProps {
  t: TFunction;
  onBackClick?: () => void;
  /** Project name passed from the header */
  projectName?: string | null;
}

interface TaskHierarchyItem {
  id: string;
  name: string;
  parent_task_id?: string;
}

const truncateText = (text: string, maxLength: number = 25): string => {
  if (!text || text.length <= maxLength) return text;
  return `${text.substring(0, maxLength)}...`;
};

const TaskHierarchyBreadcrumb: React.FC<TaskHierarchyBreadcrumbProps> = ({
  t,
  onBackClick,
  projectName,
}) => {
  const dispatch = useAppDispatch();
  const { taskFormViewModel } = useAppSelector(state => state.taskDrawerReducer);
  const { projectId } = useAppSelector(state => state.projectReducer);
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const [hierarchyPath, setHierarchyPath] = useState<TaskHierarchyItem[]>([]);
  const [loading, setLoading] = useState(false);

  const task = taskFormViewModel?.task;
  const isSubTask = task?.is_sub_task || !!task?.parent_task_id;

  const fetchHierarchyPath = async (currentTaskId: string): Promise<TaskHierarchyItem[]> => {
    if (!projectId) return [];

    const path: TaskHierarchyItem[] = [];
    let taskId = currentTaskId;

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
      if (onBackClick) onBackClick();
      dispatch(setSelectedTaskId(taskId));
      dispatch(fetchTask({ taskId, projectId }));
    }
  };

  const linkColor = themeMode === 'dark' ? '#4096ff' : '#1677ff';
  const mutedColor = themeMode === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)';

  // --- Build breadcrumb items ---
  const breadcrumbItems: { title: React.ReactNode }[] = [];

  // 1. Project name (always shown)
  if (projectName) {
    breadcrumbItems.push({
      title: (
        <Tooltip title={projectName.length > 30 ? projectName : ''} trigger="hover">
          <Typography.Text
            style={{
              color: mutedColor,
              fontSize: '12px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <FolderOutlined style={{ fontSize: 12 }} />
            {truncateText(projectName, 30)}
          </Typography.Text>
        </Tooltip>
      ),
    });
  }

  // 2. Parent task(s) — only if this is a subtask
  if (isSubTask && !loading) {
    hierarchyPath.forEach(hierarchyTask => {
      const truncated = truncateText(hierarchyTask.name, 25);
      const showTooltip = hierarchyTask.name.length > 25;

      breadcrumbItems.push({
        title: (
          <Tooltip title={showTooltip ? hierarchyTask.name : ''} trigger="hover">
            <Button
              type="link"
              onClick={() => handleNavigateToTask(hierarchyTask.id)}
              style={{
                padding: 0,
                height: 'auto',
                color: linkColor,
                fontSize: '12px',
                maxWidth: 200,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {truncated}
            </Button>
          </Tooltip>
        ),
      });
    });
  }

  // If there's nothing to show (no project name, not a subtask) — render nothing
  if (breadcrumbItems.length === 0) return null;

  return (
    <div className="task-hierarchy-breadcrumb">
      {loading ? (
        <Typography.Text style={{ color: mutedColor, fontSize: '12px' }}>
          {t('taskHeader.loadingHierarchy', 'Loading...')}
        </Typography.Text>
      ) : (
        <Breadcrumb
          items={breadcrumbItems}
          style={{ fontSize: '12px', lineHeight: '20px' }}
        />
      )}
    </div>
  );
};

export default TaskHierarchyBreadcrumb;