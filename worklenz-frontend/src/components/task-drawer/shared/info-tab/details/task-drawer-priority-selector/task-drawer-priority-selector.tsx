import { Flex, Select, Typography } from '@/shared/antd-imports';
import './priority-dropdown.css';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useCallback, useEffect, useMemo } from 'react';
import { ALPHA_CHANNEL } from '@/shared/constants';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import {
  DoubleLeftOutlined,
  ExclamationOutlined,
  MinusOutlined,
  PauseOutlined,
} from '@/shared/antd-imports';
import { ITaskViewModel } from '@/types/tasks/task.types';
import { useAuthService } from '@/hooks/useAuth';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import useTabSearchParam from '@/hooks/useTabSearchParam';
import { ITaskListPriorityChangeResponse } from '@/types/tasks/task-list-priority.types';
import { setTaskPriority } from '@/features/task-drawer/task-drawer.slice';
import { updateTaskPriority as updateBoardTaskPriority } from '@/features/board/board-slice';
import { updateTaskPriority as updateTasksListTaskPriority } from '@/features/tasks/tasks.slice';
import { updateEnhancedKanbanTaskPriority } from '@/features/enhanced-kanban/enhanced-kanban.slice';

type PriorityDropdownProps = {
  task: ITaskViewModel | undefined | null;
};

const PriorityDropdown = ({ task }: PriorityDropdownProps) => {
  const { socket } = useSocket();
  const priorityList = useAppSelector(state => state.priorityReducer.priorities);
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const currentSession = useAuthService().getCurrentSession();
  const dispatch = useAppDispatch();
  const { tab } = useTabSearchParam();

  useEffect(() => {
    if (!socket || !task?.id) return;

    const handleResponse = (data: ITaskListPriorityChangeResponse) => {
      // Guard against task being undefined during drawer close transition
      if (!task?.id) return;
      // Event name is shared across every open priority dropdown/board, so
      // ignore responses for other tasks instead of applying them here.
      if (data.id !== task?.id) return;
      dispatch(setTaskPriority(data));
      if (tab === 'tasks-list') {
        dispatch(updateTasksListTaskPriority(data));
      }
      if (tab === 'board') {
        dispatch(updateEnhancedKanbanTaskPriority(data));
      }
    };

    socket.on(SocketEvents.TASK_PRIORITY_CHANGE.toString(), handleResponse);
    return () => {
      socket.off(SocketEvents.TASK_PRIORITY_CHANGE.toString(), handleResponse);
    };
  }, [socket, task?.id, tab, dispatch]);

  const handlePriorityChange = useCallback(
    (priorityId: string) => {
      if (!task?.id || !priorityId) return;

      socket?.emit(
        SocketEvents.TASK_PRIORITY_CHANGE.toString(),
        JSON.stringify({
          task_id: task.id,
          priority_id: priorityId,
          team_id: currentSession?.team_id,
        })
      );
    },
    [socket, task?.id, currentSession?.team_id]
  );

  const options = useMemo(
    () =>
      priorityList?.map(priority => ({
        value: priority.id,
        label: (
          <Flex gap={8} align="center" justify="space-between">
            {priority.name}
            {priority.name === 'Low' && (
              <MinusOutlined
                style={{
                  color: themeMode === 'dark' ? priority.color_code_dark : priority.color_code,
                }}
              />
            )}
            {priority.name === 'Medium' && (
              <PauseOutlined
                style={{
                  color: themeMode === 'dark' ? priority.color_code_dark : priority.color_code,
                  transform: 'rotate(90deg)',
                }}
              />
            )}
            {priority.name === 'High' && (
              <DoubleLeftOutlined
                style={{
                  color: themeMode === 'dark' ? priority.color_code_dark : priority.color_code,
                  transform: 'rotate(90deg)',
                }}
              />
            )}
            {priority.name === 'Critical' && (
              <ExclamationOutlined
                style={{
                  color: themeMode === 'dark' ? priority.color_code_dark : priority.color_code,
                }}
              />
            )}
          </Flex>
        ),
      })),
    [priorityList, themeMode]
  );

  const selectedPriority = useMemo(
    () => priorityList?.find(priority => priority.id === task?.priority_id),
    [priorityList, task?.priority_id]
  );

  // Guard placed after every hook above (not before) — an early return before
  // hooks would violate the Rules of Hooks whenever `task` toggles between
  // defined and undefined/null across renders of the same instance, e.g. the
  // drawer-close race condition this prop being optional is meant to guard.
  if (!task) return null;

  return (
    <>
      {
        <Select
          className="priority-selector-tinted"
          value={task?.priority_id}
          onChange={handlePriorityChange}
          dropdownStyle={{ borderRadius: 8, minWidth: 150, maxWidth: 200 }}
          style={{
            width: 'fit-content',
            backgroundColor:
              themeMode === 'dark'
                ? selectedPriority?.color_code_dark
                : selectedPriority?.color_code + ALPHA_CHANNEL,
          }}
          options={options}
        />
      }
    </>
  );
};

export default PriorityDropdown;
