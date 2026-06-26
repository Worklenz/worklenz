import { useCallback, RefObject, useEffect, useRef } from 'react';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { toggleTaskSelection } from '@/features/task-management/selection.slice';
import { Task } from '@/types/task-management.types';
import { updateTask } from '@/features/task-management/task-management.slice';
import { updateSelectedTaskName } from '@/features/task-drawer/task-drawer.slice';
import { store } from '@/app/store';
import { useAppSelector } from '@/hooks/useAppSelector';
import { decodeHtmlEntities } from '@/utils/html-entities';

interface UseTaskRowActionsProps {
  task: Task;
  taskId: string;
  taskName: string;
  editTaskName: boolean;
  setEditTaskName: (editing: boolean) => void;
  originalTaskNameRef: RefObject<string>;
}

export const useTaskRowActions = ({
  task,
  taskId,
  taskName,
  editTaskName,
  setEditTaskName,
  originalTaskNameRef,
}: UseTaskRowActionsProps) => {
  const dispatch = useAppDispatch();
  const { socket, connected } = useSocket();

  // FIX: Keep refs to socket and connected so callbacks always read the live
  // values rather than a stale closure captured at memoization time.
  // This is the root cause of the name-change socket emit silently not firing
  // when connected was false on first render (StrictMode stale closure).
  const socketRef = useRef(socket);
  socketRef.current = socket;
  const connectedRef = useRef(connected);
  connectedRef.current = connected;

  const showTaskDrawer = useAppSelector(state => state.taskDrawerReducer.showTaskDrawer);

  // When the drawer closes while this row is in active inline edit, flush the save
  // so the name change is persisted rather than silently discarded.
  useEffect(() => {
    if (!editTaskName || showTaskDrawer) return;
    // Drawer just closed — emit save if the name actually changed
    if (
      taskName?.trim() !== '' &&
      connectedRef.current &&
      taskName.trim() !== (originalTaskNameRef.current ?? '').trim()
    ) {
      socketRef.current?.emit(
        SocketEvents.TASK_NAME_CHANGE.toString(),
        JSON.stringify({
          task_id: task.id,
          name: taskName.trim(),
          parent_task: task.parent_task_id,
        })
      );
    }
    setEditTaskName(false);
  }, [showTaskDrawer]); // eslint-disable-line react-hooks/exhaustive-deps

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
      connectedRef.current &&
      taskName.trim() !== (originalTaskNameRef.current ?? '').trim()
    ) {
      socketRef.current?.emit(
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
    task.id,
    task.parent_task_id,
    originalTaskNameRef,
    setEditTaskName,
    // socketRef and connectedRef are stable refs — no need in deps
  ]);

  // Handle task name edit start — snapshot the current name so handleTaskNameSave
  // can compare against the true pre-edit value (task.title gets updated live in Redux)
  const handleTaskNameEdit = useCallback(() => {
    if (task.is_parent_container) return;
    originalTaskNameRef.current = decodeHtmlEntities(task.title || task.name);
    setEditTaskName(true);
  }, [setEditTaskName, task.is_parent_container, task.title, task.name, originalTaskNameRef]);

  // Handle Escape — revert to the name captured when editing started, then close
  const handleCancelEdit = useCallback(() => {
    const original = originalTaskNameRef.current ?? decodeHtmlEntities(task.title || task.name);
    // Revert task-management slice back to the original name
    const currentTask = store.getState().taskManagement.entities[task.id];
    if (currentTask) {
      dispatch(
        updateTask({
          ...currentTask,
          title: original,
          updatedAt: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as Task)
      );
    }
    // Revert drawer slice if this task is open
    const drawerState = store.getState().taskDrawerReducer;
    if (drawerState.selectedTaskId === task.id) {
      dispatch(updateSelectedTaskName({ id: task.id, name: original }));
    }
    setEditTaskName(false);
  }, [dispatch, task.id, task.title, task.name, originalTaskNameRef, setEditTaskName]);

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
    handleCancelEdit,
  };
};
