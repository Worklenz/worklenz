import { Button, Dropdown, Flex, Input, InputRef, MenuProps } from 'antd';
import React, { ChangeEvent, useEffect, useRef, useState } from 'react';
import { EllipsisOutlined } from '@ant-design/icons';
import { TFunction } from 'i18next';

import './task-drawer-header.css';

import { useAppSelector } from '@/hooks/useAppSelector';
import { useAuthService } from '@/hooks/useAuth';
import TaskDrawerStatusDropdown from '../task-drawer-status-dropdown/task-drawer-status-dropdown';
import { tasksApiService } from '@/api/tasks/tasks.api.service';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { setSelectedTaskId } from '@/features/task-drawer/task-drawer.slice';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import useTaskDrawerUrlSync from '@/hooks/useTaskDrawerUrlSync';
import { deleteTask } from '@/features/tasks/tasks.slice';
import { deleteTask as deleteTaskFromManagement } from '@/features/task-management/task-management.slice';
import { deselectTask } from '@/features/task-management/selection.slice';
import { deleteBoardTask } from '@/features/board/board-slice';
import { deleteTask as deleteKanbanTask, updateEnhancedKanbanSubtask } from '@/features/enhanced-kanban/enhanced-kanban.slice';
import useTabSearchParam from '@/hooks/useTabSearchParam';
import { ITaskViewModel } from '@/types/tasks/task.types';

type TaskDrawerHeaderProps = {
  inputRef: React.RefObject<InputRef | null>;
  t: TFunction;
};

const TaskDrawerHeader = ({ inputRef, t }: TaskDrawerHeaderProps) => {
  const dispatch = useAppDispatch();
  const { socket, connected } = useSocket();
  const { clearTaskFromUrl } = useTaskDrawerUrlSync();
  const isDeleting = useRef(false);
  const [isEditing, setIsEditing] = useState(false);

  const { taskFormViewModel, selectedTaskId } = useAppSelector(state => state.taskDrawerReducer);
  const [taskName, setTaskName] = useState<string>(taskFormViewModel?.task?.name ?? '');
  const currentSession = useAuthService().getCurrentSession();

  useEffect(() => {
    setTaskName(taskFormViewModel?.task?.name ?? '');
  }, [taskFormViewModel?.task?.name]);

  const onTaskNameChange = (e: ChangeEvent<HTMLInputElement>) => {
    setTaskName(e.currentTarget.value);
  };

  const handleDeleteTask = async () => {
    if (!selectedTaskId) return;

    // Set flag to indicate we're deleting the task
    isDeleting.current = true;

    const res = await tasksApiService.deleteTask(selectedTaskId);
    if (res.done) {
      // Update all relevant slices to ensure task is removed everywhere
      dispatch(deleteTask({ taskId: selectedTaskId })); // Old tasks slice
      dispatch(deleteTaskFromManagement(selectedTaskId)); // Task management slice (TaskListV2)
      dispatch(deselectTask(selectedTaskId)); // Remove from selection if selected
      dispatch(deleteBoardTask({ sectionId: '', taskId: selectedTaskId })); // Board slice

      // Clear the task drawer state and URL
      dispatch(setSelectedTaskId(null));
      dispatch(deleteTask({ taskId: selectedTaskId }));
      dispatch(deleteBoardTask({ sectionId: '', taskId: selectedTaskId }));
      if (taskFormViewModel?.task?.is_sub_task) {
        dispatch(updateEnhancedKanbanSubtask({
          sectionId: '',
          subtask: { id: selectedTaskId, parent_task_id: taskFormViewModel?.task?.parent_task_id || '', manual_progress: false },
          mode: 'delete',
        }));
      } else {
        dispatch(deleteKanbanTask(selectedTaskId)); // <-- Add this line
      }
      // Reset the flag after a short delay
      setTimeout(() => {
        clearTaskFromUrl();
        isDeleting.current = false;
      }, 100);
      if (taskFormViewModel?.task?.parent_task_id) {
        socket?.emit(
          SocketEvents.GET_TASK_PROGRESS.toString(),
          taskFormViewModel?.task?.parent_task_id
        );
      }
    } else {
      isDeleting.current = false;
    }
  };

  const deletTaskDropdownItems: MenuProps['items'] = [
    {
      key: '1',
      label: (
        <Flex gap={8} align="center">
          <Button type="text" danger onClick={handleDeleteTask}>
            {t('taskHeader.deleteTask')}
          </Button>
        </Flex>
      ),
    },
  ];

  const handleInputBlur = () => {
    setIsEditing(false);
    if (
      !selectedTaskId ||
      !connected ||
      taskName === taskFormViewModel?.task?.name ||
      taskName === undefined ||
      taskName === null ||
      taskName === ''
    )
      return;
    socket?.emit(
      SocketEvents.TASK_NAME_CHANGE.toString(),
      JSON.stringify({
        task_id: selectedTaskId,
        name: taskName,
        parent_task: taskFormViewModel?.task?.parent_task_id,
      })
    );
    // Note: Real-time updates are handled by the global useTaskSocketHandlers hook
    // No need for local socket listeners that could interfere with global handlers
  };

  return (
    <Flex gap={12} align="center" style={{ marginBlockEnd: 6 }}>
      <Flex style={{ position: 'relative', width: '100%' }}>
        {isEditing ? (
          <Input
            ref={inputRef}
            size="large"
            value={taskName}
            onChange={e => onTaskNameChange(e)}
            onBlur={handleInputBlur}
            placeholder={t('taskHeader.taskNamePlaceholder')}
            className="task-name-input"
            style={{
              width: '100%',
              border: 'none',
            }}
            showCount={true}
            maxLength={250}
            autoFocus
          />
        ) : (
          <p
            onClick={() => setIsEditing(true)}
            style={{
              margin: 0,
              padding: '4px 11px',
              fontSize: '16px',
              cursor: 'pointer',
              wordWrap: 'break-word',
              overflowWrap: 'break-word',
              width: '100%',
            }}
          >
            {taskName || t('taskHeader.taskNamePlaceholder')}
          </p>
        )}
      </Flex>

      <TaskDrawerStatusDropdown
        statuses={taskFormViewModel?.statuses ?? []}
        task={taskFormViewModel?.task ?? ({} as ITaskViewModel)}
        teamId={currentSession?.team_id ?? ''}
      />

      <Dropdown overlayClassName={'delete-task-dropdown'} menu={{ items: deletTaskDropdownItems }}>
        <Button type="text" icon={<EllipsisOutlined />} />
      </Dropdown>
    </Flex>
  );
};

export default TaskDrawerHeader;
