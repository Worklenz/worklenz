import React, { useState, useEffect } from 'react';
import { Typography, Tooltip } from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { fetchTask, setSelectedTaskId } from '@/features/task-drawer/task-drawer.slice';
import { tasksApiService } from '@/api/tasks/tasks.api.service';
import { TFunction } from 'i18next';
import './task-hierarchy-breadcrumb.css';

interface TaskHierarchyBreadcrumbProps {
  t: TFunction;
  onBackClick?: () => void;
  projectName?: string | null;
}

interface TaskHierarchyItem {
  id: string;
  name: string;
  parent_task_id?: string;
}

const truncateText = (text: string, maxLength: number = 30): string => {
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

  const mutedColor = themeMode === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)';
  const linkColor = themeMode === 'dark' ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.65)';
  const separatorColor = themeMode === 'dark' ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)';

  // Build parts: [projectName, ...parentTasks]
  const parts: React.ReactNode[] = [];

  // 1. Project name — always plain muted text, no icon, no link
  if (projectName) {
    parts.push(
      <Tooltip key="project" title={projectName.length > 30 ? projectName : ''} trigger="hover">
        <Typography.Text style={{ color: mutedColor, fontSize: '12px', fontWeight: 400 }}>
          {truncateText(projectName, 30)}
        </Typography.Text>
      </Tooltip>
    );
  }

  // 2. Parent tasks — clickable but still muted style
  if (isSubTask && !loading) {
    hierarchyPath.forEach(hierarchyTask => {
      const truncated = truncateText(hierarchyTask.name, 25);
      const showTooltip = hierarchyTask.name.length > 25;
      parts.push(
        <Tooltip key={hierarchyTask.id} title={showTooltip ? hierarchyTask.name : ''} trigger="hover">
          <Typography.Text
            onClick={() => handleNavigateToTask(hierarchyTask.id)}
            style={{
              color: linkColor,
              fontSize: '12px',
              fontWeight: 400,
              cursor: 'pointer',
            }}
          >
            {truncated}
          </Typography.Text>
        </Tooltip>
      );
    });
  }

  if (parts.length === 0) return null;

  // Render parts joined by " / " separator — plain text, no Breadcrumb component
  return (
    <div className="task-hierarchy-breadcrumb">
      {loading ? (
        <Typography.Text style={{ color: mutedColor, fontSize: '12px' }}>
          {t('taskHeader.loadingHierarchy', 'Loading...')}
        </Typography.Text>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'nowrap', overflow: 'hidden' }}>
          {parts.map((part, index) => (
            <React.Fragment key={index}>
              {index > 0 && (
                <Typography.Text style={{ color: separatorColor, fontSize: '12px', userSelect: 'none' }}>
                  /
                </Typography.Text>
              )}
              {part}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};

export default TaskHierarchyBreadcrumb;