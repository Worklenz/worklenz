import Input, { InputRef } from 'antd/es/input';
import { useMemo, useRef, useState } from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import { colors } from '@/styles/colors';
import { useTranslation } from 'react-i18next';
import { SocketEvents } from '@/shared/socket-events';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { DRAWER_ANIMATION_INTERVAL } from '@/shared/constants';
import {
  getCurrentGroup,
  GROUP_BY_STATUS_VALUE,
  GROUP_BY_PRIORITY_VALUE,
  GROUP_BY_PHASE_VALUE,
  addTask,
} from '@/features/tasks/tasks.slice';
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
  const taskInputRef = useRef<InputRef>(null);
  const dispatch = useAppDispatch();
  const currentSession = useAuthService().getCurrentSession();

  const { socket } = useSocket();

  const { t } = useTranslation('task-list-table');

  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const customBorderColor = useMemo(() => themeMode === 'dark' && ' border-[#303030]', [themeMode]);
  const projectId = useAppSelector(state => state.projectReducer.projectId);

  const createRequestBody = (): ITaskCreateRequest | null => {
    if (!projectId || !currentSession) return null;
    const body: ITaskCreateRequest = {
      project_id: projectId,
      name: taskName,
      reporter_id: currentSession.id,
      team_id: currentSession.team_id,
    };

    const groupBy = getCurrentGroup();
    if (groupBy.value === GROUP_BY_STATUS_VALUE) {
      body.status_id = groupId || undefined;
    } else if (groupBy.value === GROUP_BY_PRIORITY_VALUE) {
      body.priority_id = groupId || undefined;
    } else if (groupBy.value === GROUP_BY_PHASE_VALUE) {
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
    setIsEdit(true);

    setTimeout(() => {
      taskInputRef.current?.focus();
      if (scroll) window.scrollTo(0, document.body.scrollHeight);
    }, DRAWER_ANIMATION_INTERVAL);
  };

  const onNewTaskReceived = (task: IAddNewTask) => {
    if (!groupId) return;

    // Ensure we're adding the task with the correct group
    const taskWithGroup = {
      ...task,
      groupId: groupId,
    };

    // Add the task to the state
    dispatch(
      addTask({
        task: taskWithGroup,
        groupId,
        insert: true,
      })
    );

    socket?.emit(SocketEvents.GET_TASK_PROGRESS.toString(), task.parent_task_id || task.id);

    // Reset the input state
    reset(false);
  };

  const addInstantTask = async () => {
    if (creatingTask || !projectId || !currentSession || taskName.trim() === '') return;

    try {
      setCreatingTask(true);
      const body = createRequestBody();
      if (!body) return;

      socket?.emit(SocketEvents.QUICK_TASK.toString(), JSON.stringify(body));
      socket?.once(SocketEvents.QUICK_TASK.toString(), (task: IProjectTask) => {
        setCreatingTask(false);
        onNewTaskReceived(task as IAddNewTask);
      });
    } catch (error) {
      console.error('Error adding task:', error);
      setCreatingTask(false);
    }
  };

  const handleAddTask = () => {
    setIsEdit(false);
    addInstantTask();
  };

  return (
    <div>
      {isEdit ? (
        <Input
          className="h-12 w-full rounded-none"
          style={{ borderColor: colors.skyBlue }}
          placeholder={t('addTaskInputPlaceholder')}
          onChange={e => setTaskName(e.target.value)}
          onBlur={handleAddTask}
          onPressEnter={handleAddTask}
          ref={taskInputRef}
        />
      ) : (
        <Input
          onFocus={() => setIsEdit(true)}
          className="w-[300px] border-none"
          value={parentTask ? t('addSubTaskText') : t('addTaskText')}
          ref={taskInputRef}
        />
      )}
    </div>
  );
};

export default AddTaskListRow;
