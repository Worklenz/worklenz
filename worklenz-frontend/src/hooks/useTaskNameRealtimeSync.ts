import { useEffect, useMemo, useRef, Dispatch, SetStateAction } from 'react';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { useAppSelector } from '@/hooks/useAppSelector';
import { decodeHtmlEntities } from '@/utils/html-entities';

export interface UseTaskNameRealtimeSyncOptions<T> {
  items: T[];
  setItems: Dispatch<SetStateAction<T[]>>;
  getTaskId?: (item: T) => string;
  updateTaskName?: (item: T, newName: string) => T;
}

const defaultGetTaskId = (item: unknown): string => {
  if (!item || typeof item !== 'object') return '';
  const record = item as { task_id?: unknown; id?: unknown };
  if (typeof record.task_id === 'string') return record.task_id;
  if (typeof record.id === 'string') return record.id;
  return '';
};

const defaultUpdateTaskName = <T>(item: T, newName: string): T => {
  if (!item || typeof item !== 'object') return item;
  return { ...item, task_name: newName };
};

const getOriginalItemName = (item: unknown): string | undefined => {
  if (!item || typeof item !== 'object') return undefined;
  const record = item as { task_name?: unknown; name?: unknown };
  if (typeof record.task_name === 'string') return record.task_name;
  if (typeof record.name === 'string') return record.name;
  return undefined;
};

/**
 * Hook to synchronize task names in list/table state in real-time.
 * 
 * Synchronizes with:
 * 1. Optimistic updates from the Task Drawer Redux state while editing.
 * 2. Real-time Socket.IO `TASK_NAME_CHANGE` events.
 * 3. Graceful restoration of the original name if blanked out or cleared on drawer close.
 */
export function useTaskNameRealtimeSync<T>({
  items,
  setItems,
  getTaskId = defaultGetTaskId,
  updateTaskName = defaultUpdateTaskName,
}: UseTaskNameRealtimeSyncOptions<T>): void {
  const { socket } = useSocket();
  const selectedTaskId = useAppSelector(state => state.taskDrawerReducer.selectedTaskId);
  const showTaskDrawer = useAppSelector(state => state.taskDrawerReducer.showTaskDrawer);
  const taskFormViewModel = useAppSelector(state => state.taskDrawerReducer.taskFormViewModel);
  const taskManagementEntities = useAppSelector(state => state.taskManagement.entities);
  const originalTaskNamesRef = useRef<Map<string, string>>(new Map());

  // Socket listener for task name changes broadcasted from server / other clients
  useEffect(() => {
    if (!socket) return;

    const handleTaskNameChange = (data: { id: string; name: string }) => {
      if (!data?.id || !data.name) return;
      const decodedName = decodeHtmlEntities(data.name);

      setItems(prevItems =>
        prevItems.map(item =>
          getTaskId(item) === data.id ? updateTaskName(item, decodedName) : item
        )
      );
    };

    socket.on(SocketEvents.TASK_NAME_CHANGE.toString(), handleTaskNameChange);

    return () => {
      socket.off(SocketEvents.TASK_NAME_CHANGE.toString(), handleTaskNameChange);
    };
  }, [socket, getTaskId, updateTaskName, setItems]);

  // Capture original task name when drawer opens & restore on blank close
  useEffect(() => {
    if (showTaskDrawer && selectedTaskId) {
      const match = items.find(item => getTaskId(item) === selectedTaskId);
      const originalName = match ? getOriginalItemName(match) : undefined;

      if (originalName && !originalTaskNamesRef.current.has(selectedTaskId)) {
        originalTaskNamesRef.current.set(selectedTaskId, originalName);
      }
    } else if (!showTaskDrawer && selectedTaskId) {
      const originalName = originalTaskNamesRef.current.get(selectedTaskId);
      if (originalName) {
        const currentTask = taskManagementEntities[selectedTaskId];
        const currentName = taskFormViewModel?.task?.name || currentTask?.title;

        if (!currentName || !currentName.trim()) {
          setItems(prevItems =>
            prevItems.map(item =>
              getTaskId(item) === selectedTaskId ? updateTaskName(item, originalName) : item
            )
          );
        }

        originalTaskNamesRef.current.delete(selectedTaskId);
      }
    }
  }, [
    showTaskDrawer,
    selectedTaskId,
    items,
    taskFormViewModel,
    taskManagementEntities,
    getTaskId,
    updateTaskName,
    setItems,
  ]);

  // Real-time sync: compute current task name while drawer is open
  const currentTaskName = useMemo(() => {
    if (!selectedTaskId || !showTaskDrawer) return null;

    const drawerTaskName = taskFormViewModel?.task?.name;
    const taskEntity = taskManagementEntities[selectedTaskId];
    const taskName = drawerTaskName !== undefined ? drawerTaskName : (taskEntity?.title || null);

    if (!taskName || !taskName.trim()) {
      return '__EMPTY__';
    }

    return taskName;
  }, [selectedTaskId, showTaskDrawer, taskFormViewModel?.task?.name, taskManagementEntities]);

  // Update table row in real time as user types in task drawer
  useEffect(() => {
    if (!selectedTaskId || !currentTaskName) return;

    if (currentTaskName === '__EMPTY__') {
      const originalName = originalTaskNamesRef.current.get(selectedTaskId);
      if (originalName) {
        setItems(prevItems =>
          prevItems.map(item =>
            getTaskId(item) === selectedTaskId ? updateTaskName(item, originalName) : item
          )
        );
      }
      return;
    }

    const decodedName = decodeHtmlEntities(currentTaskName);

    setItems(prevItems =>
      prevItems.map(item =>
        getTaskId(item) === selectedTaskId ? updateTaskName(item, decodedName) : item
      )
    );
  }, [selectedTaskId, currentTaskName, getTaskId, updateTaskName, setItems]);
}
