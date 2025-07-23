import Input, { InputRef } from 'antd/es/input';
import { useMemo, useRef, useState, useEffect } from 'react';
import { Spin } from '@/shared/antd-imports';
import { LoadingOutlined } from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';
import { colors } from '@/styles/colors';
import { useTranslation } from 'react-i18next';
import { SocketEvents } from '@/shared/socket-events';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { DRAWER_ANIMATION_INTERVAL } from '@/shared/constants';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useSocket } from '@/socket/socketContext';
import { ITaskCreateRequest } from '@/types/tasks/task-create-request.types';
import { useAuthService } from '@/hooks/useAuth';

interface IAddTaskListRowProps {
  groupId?: string | null;
  parentTask?: string | null;
}

interface IAddNewTask extends IProjectTask {
  groupId: string;
}

const AddTaskListRow = ({ groupId = null, parentTask = null }: IAddTaskListRowProps) => {
  const [isEdit, setIsEdit] = useState<boolean>(false);
  const [taskName, setTaskName] = useState<string>('');
  const [creatingTask, setCreatingTask] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [taskCreationTimeout, setTaskCreationTimeout] = useState<NodeJS.Timeout | null>(null);
  const taskInputRef = useRef<InputRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dispatch = useAppDispatch();
  const currentSession = useAuthService().getCurrentSession();

  const { socket } = useSocket();

  const { t } = useTranslation('task-list-table');

  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const customBorderColor = useMemo(() => themeMode === 'dark' && ' border-[#303030]', [themeMode]);
  const projectId = useAppSelector(state => state.projectReducer.projectId);
  const currentGrouping = useAppSelector(state => state.grouping.currentGrouping);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (taskCreationTimeout) {
        clearTimeout(taskCreationTimeout);
      }
    };
  }, [taskCreationTimeout]);

  // Handle click outside to cancel edit mode
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isEdit &&
        !creatingTask &&
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        cancelEdit();
      }
    };

    if (isEdit) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isEdit, creatingTask]);

  const createRequestBody = (): ITaskCreateRequest | null => {
    if (!projectId || !currentSession) return null;
    const body: ITaskCreateRequest = {
      id: '',
      name: taskName,
      description: '',
      status_id: '',
      priority: '',
      start_date: '',
      end_date: '',
      total_hours: 0,
      total_minutes: 0,
      billable: false,
      phase_id: '',
      parent_task_id: undefined,
      project_id: projectId,
      team_id: currentSession.team_id,
      task_key: '',
      labels: [],
      assignees: [],
      names: [],
      sub_tasks_count: 0,
      manual_progress: false,
      progress_value: null,
      weight: null,
      reporter_id: currentSession.id,
    };

    if (currentGrouping === 'status') {
      body.status_id = groupId || undefined;
    } else if (currentGrouping === 'priority') {
      body.priority_id = groupId || undefined;
    } else if (currentGrouping === 'phase') {
      body.phase_id = groupId || undefined;
    }

    if (parentTask) {
      body.parent_task_id = parentTask;
    }
    return body;
  };

  const reset = (scroll = true) => {
    setIsEdit(false);
    setCreatingTask(false);
    setTaskName('');
    setError('');
    if (taskCreationTimeout) {
      clearTimeout(taskCreationTimeout);
      setTaskCreationTimeout(null);
    }

    setIsEdit(true);

    setTimeout(() => {
      taskInputRef.current?.focus();
      if (scroll) window.scrollTo(0, document.body.scrollHeight);
    }, DRAWER_ANIMATION_INTERVAL);
  };

  const cancelEdit = () => {
    setIsEdit(false);
    setTaskName('');
    setError('');
    if (taskCreationTimeout) {
      clearTimeout(taskCreationTimeout);
      setTaskCreationTimeout(null);
    }
  };

  const addInstantTask = async () => {
    // Validation
    if (creatingTask || !projectId || !currentSession) return;

    const trimmedTaskName = taskName.trim();
    if (trimmedTaskName === '') {
      setError('Task name cannot be empty');
      taskInputRef.current?.focus();
      return;
    }

    try {
      setCreatingTask(true);
      setError('');

      const body = createRequestBody();
      if (!body) {
        setError('Failed to create task. Please try again.');
        setCreatingTask(false);
        return;
      }

      // Set timeout for task creation (10 seconds)
      const timeout = setTimeout(() => {
        setCreatingTask(false);
        setError('Task creation timed out. Please try again.');
      }, 10000);

      setTaskCreationTimeout(timeout);

      socket?.emit(SocketEvents.QUICK_TASK.toString(), JSON.stringify(body));

      // Handle success response - the global socket handler will handle task addition
      socket?.once(SocketEvents.QUICK_TASK.toString(), (task: IProjectTask) => {
        clearTimeout(timeout);
        setTaskCreationTimeout(null);
        setCreatingTask(false);

        if (task && task.id) {
          // Just reset the form - the global handler will add the task to Redux
          reset(false);
          // Emit progress update for parent task if this is a subtask
          if (task.parent_task_id) {
            socket?.emit(SocketEvents.GET_TASK_PROGRESS.toString(), task.parent_task_id);
          } else {
            socket?.emit(SocketEvents.GET_TASK_PROGRESS.toString(), task.id);
          }
        } else {
          setError('Failed to create task. Please try again.');
        }
      });

      // Handle error response
      socket?.once('error', (errorData: any) => {
        clearTimeout(timeout);
        setTaskCreationTimeout(null);
        setCreatingTask(false);
        const errorMessage = errorData?.message || 'Failed to create task';
        setError(errorMessage);
      });
    } catch (error) {
      console.error('Error adding task:', error);
      setCreatingTask(false);
      setError('An unexpected error occurred. Please try again.');
    }
  };

  const handleAddTask = () => {
    if (creatingTask) return; // Prevent multiple submissions
    addInstantTask();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    } else if (e.key === 'Enter' && !creatingTask) {
      e.preventDefault();
      handleAddTask();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTaskName(e.target.value);
    if (error) setError(''); // Clear error when user starts typing
  };

  return (
    <div className="add-task-row-container" ref={containerRef}>
      {isEdit ? (
        <div className="add-task-input-container">
          <Input
            className="add-task-input"
            style={{
              borderColor: error ? '#ff4d4f' : colors.skyBlue,
              paddingRight: creatingTask ? '32px' : '12px',
            }}
            placeholder={t('addTaskInputPlaceholder')}
            value={taskName}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            ref={taskInputRef}
            autoFocus
            disabled={creatingTask}
          />
          {creatingTask && (
            <div className="add-task-loading">
              <Spin size="small" indicator={<LoadingOutlined style={{ fontSize: 14 }} spin />} />
            </div>
          )}
          {error && <div className="add-task-error">{error}</div>}
        </div>
      ) : (
        <div className="add-task-label" onClick={() => setIsEdit(true)}>
          <span className="add-task-text">
            {parentTask ? t('addSubTaskText') : t('addTaskText')}
          </span>
        </div>
      )}

      <style>{`
        .add-task-row-container {
          width: 100%;
          transition: height 0.3s ease;
        }

        .add-task-input-container {
          position: relative;
          width: 100%;
        }

        .add-task-input {
          width: 100%;
          height: 40px;
          border-radius: 6px;
          border: 1px solid ${colors.skyBlue};
          font-size: 14px;
          padding: 0 12px;
          margin: 2px 0;
          transition: border-color 0.2s ease, background-color 0.2s ease;
        }

        .add-task-input:disabled {
          background-color: var(--task-bg-secondary, #f5f5f5);
          cursor: not-allowed;
          opacity: 0.7;
        }

        .add-task-loading {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          z-index: 1;
        }

        .add-task-error {
          font-size: 12px;
          color: #ff4d4f;
          margin-top: 4px;
          margin-left: 2px;
          line-height: 1.4;
        }

        .add-task-label {
          width: 100%;
          height: 40px;
          display: flex;
          align-items: center;
          padding: 0;
          cursor: pointer;
          border-radius: 6px;
          border: 1px solid transparent;
          transition: all 0.2s ease;
          color: var(--task-text-tertiary, #8c8c8c);
        }

        .add-task-label:hover {
          background: var(--task-hover-bg, #fafafa);
          border-color: var(--task-border-tertiary, #d9d9d9);
          color: var(--task-text-secondary, #595959);
        }

        .add-task-text {
          font-size: 14px;
          user-select: none;
        }

        /* Dark mode support */
        .dark .add-task-label,
        [data-theme="dark"] .add-task-label {
          color: var(--task-text-tertiary, #8c8c8c);
        }

        .dark .add-task-label:hover,
        [data-theme="dark"] .add-task-label:hover {
          background: var(--task-hover-bg, #2a2a2a);
          border-color: var(--task-border-tertiary, #505050);
          color: var(--task-text-secondary, #d9d9d9);
        }
      `}</style>
    </div>
  );
};

export default AddTaskListRow;
