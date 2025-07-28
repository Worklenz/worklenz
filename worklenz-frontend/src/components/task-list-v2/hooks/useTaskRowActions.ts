import { useCallback } from 'react';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { toggleTaskSelection } from '@/features/task-management/selection.slice';
import { Task } from '@/types/task-management.types';

interface UseTaskRowActionsProps {
  task: Task;
  taskId: string;
  taskName: string;
  editTaskName: boolean;
  setEditTaskName: (editing: boolean) => void;
}

export const useTaskRowActions = ({
  task,
  taskId,
  taskName,
  editTaskName,
  setEditTaskName,
}: UseTaskRowActionsProps) => {
  const dispatch = useAppDispatch();
  const { socket, connected } = useSocket();

  // Handle checkbox change
  const handleCheckboxChange = useCallback(
    (e: any) => {
      e.stopPropagation(); // Prevent row click when clicking checkbox
      dispatch(toggleTaskSelection(taskId));
    },
    [dispatch, taskId]
  );

  // Handle task name save
  const handleTaskNameSave = useCallback(() => {
    if (
      taskName?.trim() !== '' &&
      connected &&
      taskName.trim() !== (task.title || task.name || '').trim()
    ) {
      socket?.emit(
        SocketEvents.TASK_NAME_CHANGE.toString(),
        JSON.stringify({
          task_id: task.id,
          name: taskName.trim(),
          parent_task: task.parent_task_id,
        })
      );
    }
    setEditTaskName(false);
  }, [
    taskName,
    connected,
    socket,
    task.id,
    task.parent_task_id,
    task.title,
    task.name,
    setEditTaskName,
  ]);

  // Handle task name edit start
  const handleTaskNameEdit = useCallback(() => {
    setEditTaskName(true);
  }, [setEditTaskName]);

  // Handle task name change
  const handleTaskNameChange = useCallback((name: string) => {
    // This will be handled by the parent component's state setter
  }, []);

  return {
    handleCheckboxChange,
    handleTaskNameSave,
    handleTaskNameEdit,
    handleTaskNameChange,
  };
};
