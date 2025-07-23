import { Flex, Select, Typography } from '@/shared/antd-imports';
import './priority-dropdown.css';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useState, useEffect, useMemo } from 'react';
import { ALPHA_CHANNEL } from '@/shared/constants';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { ITaskPriority } from '@/types/tasks/taskPriority.types';
import { DoubleLeftOutlined, MinusOutlined, PauseOutlined } from '@/shared/antd-imports';
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
  task: ITaskViewModel;
};

const PriorityDropdown = ({ task }: PriorityDropdownProps) => {
  const { socket } = useSocket();
  const [selectedPriority, setSelectedPriority] = useState<ITaskPriority | undefined>(undefined);
  const priorityList = useAppSelector(state => state.priorityReducer.priorities);
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const currentSession = useAuthService().getCurrentSession();
  const dispatch = useAppDispatch();
  const { tab } = useTabSearchParam();

  const handlePriorityChange = (priorityId: string) => {
    if (!task.id || !priorityId) return;

    socket?.emit(
      SocketEvents.TASK_PRIORITY_CHANGE.toString(),
      JSON.stringify({
        task_id: task.id,
        priority_id: priorityId,
        team_id: currentSession?.team_id,
      })
    );
    socket?.once(
      SocketEvents.TASK_PRIORITY_CHANGE.toString(),
      (data: ITaskListPriorityChangeResponse) => {
        dispatch(setTaskPriority(data));
        if (tab === 'tasks-list') {
          dispatch(updateTasksListTaskPriority(data));
        }
        if (tab === 'board') {
          dispatch(updateEnhancedKanbanTaskPriority(data));
        }
      }
    );
  };

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
          </Flex>
        ),
      })),
    [priorityList, themeMode]
  );

  return (
    <>
      {
        <Select
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
