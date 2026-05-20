import { useCallback } from 'react';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { toggleTaskSelection } from '@/features/task-management/selection.slice';
import { Task } from '@/types/task-management.types';
import { updateTask } from '@/features/task-management/task-management.slice';
import { updateSelectedTaskName } from '@/features/task-drawer/task-drawer.slice';
import { store } from '@/app/store';

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
      if (task.is_parent_container) return;
      dispatch(toggleTaskSelection(taskId));
    },
    [dispatch, taskId, task.is_parent_container]
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
    if (task.is_parent_container) return;
    setEditTaskName(true);
  }, [setEditTaskName, task.is_parent_container]);

  // Handle live task name change — updates Redux immediately so the drawer reflects it in real time
  const handleTaskNameChangeLive = useCallback(
    (name: string) => {
      // Update task-management slice so the row display stays in sync
      const currentTask = store.getState().taskManagement.entities[task.id];
      if (currentTask) {
        dispatch(
          updateTask({
            ...currentTask,
            title: name,
            updatedAt: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as Task)
        );
      }

      // Update drawer slice so the open drawer reflects the change immediately
      const drawerState = store.getState().taskDrawerReducer;
      if (drawerState.selectedTaskId === task.id) {
        dispatch(updateSelectedTaskName({ id: task.id, name }));
      }
    },
    [dispatch, task.id]
  );

  return {
    handleCheckboxChange,
    handleTaskNameSave,
    handleTaskNameEdit,
    handleTaskNameChangeLive,
  };
};
