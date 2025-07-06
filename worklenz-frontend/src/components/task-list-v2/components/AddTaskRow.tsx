import React, { useState, useCallback, memo, useEffect } from 'react';
import { Input } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { useAuthService } from '@/hooks/useAuth';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { addTaskToGroup } from '@/features/task-management/task-management.slice';
import { Task } from '@/types/task-management.types';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';

interface AddTaskRowProps {
  groupId: string;
  groupType: string;
  groupValue: string;
  projectId: string;
  visibleColumns: Array<{
    id: string;
    width: string;
    isSticky?: boolean;
  }>;
  onTaskAdded: () => void;
}

const AddTaskRow: React.FC<AddTaskRowProps> = memo(({ 
  groupId, 
  groupType,
  groupValue,
  projectId, 
  visibleColumns, 
  onTaskAdded 
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [taskName, setTaskName] = useState('');
  const { socket, connected } = useSocket();
  const { t } = useTranslation('task-list-table');
  const dispatch = useAppDispatch();
  
  // Get session data for reporter_id and team_id
  const currentSession = useAuthService().getCurrentSession();

  // Listen for task creation completion and add to Redux store immediately
  useEffect(() => {
    if (!socket) return;

    const handleTaskCreated = (data: IProjectTask) => {
      if (data) {
        // Transform backend response to Task format for real-time addition
        const task: Task = {
          id: data.id || '',
          task_key: data.task_key || '',
          title: data.name || '',
          description: data.description || '',
          status: (data.status_category?.is_todo
            ? 'todo'
            : data.status_category?.is_doing
              ? 'doing'
              : data.status_category?.is_done
                ? 'done'
                : 'todo') as 'todo' | 'doing' | 'done',
          priority: (data.priority_value === 3
            ? 'critical'
            : data.priority_value === 2
              ? 'high'
              : data.priority_value === 1
                ? 'medium'
                : 'low') as 'critical' | 'high' | 'medium' | 'low',
          phase: data.phase_name || 'Development',
          progress: data.complete_ratio || 0,
          assignees: data.assignees?.map(a => a.team_member_id) || [],
          assignee_names: data.names || [],
          labels:
            data.labels?.map(l => ({
              id: l.id || '',
              name: l.name || '',
              color: l.color_code || '#1890ff',
              end: l.end,
              names: l.names,
            })) || [],
          dueDate: data.end_date,
          startDate: data.start_date,
          timeTracking: {
            estimated: (data.total_hours || 0) + (data.total_minutes || 0) / 60,
            logged: (data.time_spent?.hours || 0) + (data.time_spent?.minutes || 0) / 60,
          },
          created_at: data.created_at || new Date().toISOString(),
          updated_at: data.updated_at || new Date().toISOString(),
          order: data.sort_order || 0,
          sub_tasks: [],
          sub_tasks_count: 0,
          show_sub_tasks: false,
        };

        // Add task to the correct group in Redux store for immediate UI update
        dispatch(addTaskToGroup({ task, groupId }));

        // Optional: Call onTaskAdded for any additional UI updates
        onTaskAdded();
      }
    };

    socket.on(SocketEvents.QUICK_TASK.toString(), handleTaskCreated);

    return () => {
      socket.off(SocketEvents.QUICK_TASK.toString(), handleTaskCreated);
    };
  }, [socket, onTaskAdded, dispatch, groupId]);

  const handleAddTask = useCallback(() => {
    if (!taskName.trim() || !currentSession) return;

    try {
      const body: any = {
        name: taskName.trim(),
        project_id: projectId,
        reporter_id: currentSession.id,
        team_id: currentSession.team_id,
      };

      // Map grouping type to correct field name expected by backend
      switch (groupType) {
        case 'status':
          body.status_id = groupValue;
          break;
        case 'priority':
          body.priority_id = groupValue;
          break;
        case 'phase':
          body.phase_id = groupValue;
          break;
        default:
          // For any other grouping types, use the groupType as is
          body[groupType] = groupValue;
          break;
      }

      if (socket && connected) {

        socket.emit(SocketEvents.QUICK_TASK.toString(), JSON.stringify(body));
        setTaskName('');
        setIsAdding(false);
        // Task refresh will be handled by socket response listener
      } else {
        console.warn('Socket not connected, unable to create task');
      }
    } catch (error) {
      console.error('Error creating task:', error);
    }
  }, [taskName, projectId, groupType, groupValue, socket, connected, currentSession, onTaskAdded]);

  const handleCancel = useCallback(() => {
    setTaskName('');
    setIsAdding(false);
  }, []);

  const renderColumn = useCallback((columnId: string, width: string) => {
    const baseStyle = { width };

    switch (columnId) {
      case 'dragHandle':
      case 'checkbox':
      case 'taskKey':
        return <div style={baseStyle} />;
      case 'title':
        return (
          <div className="flex items-center h-full" style={baseStyle}>
            <div className="flex items-center w-full h-full">
              <div className="w-4 mr-1" />
              
              {!isAdding ? (
                <button
                  onClick={() => setIsAdding(true)}
                  className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors h-full"
                >
                  <PlusOutlined className="text-xs" />
                  {t('addTaskText')}
                </button>
              ) : (
                <Input
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                  onPressEnter={handleAddTask}
                  onBlur={handleCancel}
                  placeholder="Type task name and press Enter to save"
                  className="w-full h-full border-none shadow-none bg-transparent"
                  style={{ 
                    height: '100%',
                    minHeight: '32px',
                    padding: '0',
                    fontSize: '14px'
                  }}
                  autoFocus
                />
              )}
            </div>
          </div>
        );
      default:
        return <div style={baseStyle} />;
    }
  }, [isAdding, taskName, handleAddTask, handleCancel, t]);

  return (
    <div className="flex items-center min-w-max px-1 py-0.5 hover:bg-gray-50 dark:hover:bg-gray-800 min-h-[36px] border-b border-gray-200 dark:border-gray-700">
      {visibleColumns.map((column) =>
        renderColumn(column.id, column.width)
      )}
    </div>
  );
});

AddTaskRow.displayName = 'AddTaskRow';

export default AddTaskRow; 