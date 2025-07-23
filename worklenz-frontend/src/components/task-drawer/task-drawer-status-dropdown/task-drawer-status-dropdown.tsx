import { updateBoardTaskStatus } from '@/features/board/board-slice';
import { setTaskStatus } from '@/features/task-drawer/task-drawer.slice';
import { updateTaskStatus } from '@/features/tasks/tasks.slice';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import useTabSearchParam from '@/hooks/useTabSearchParam';
import alertService from '@/services/alerts/alertService';
import { SocketEvents } from '@/shared/socket-events';
import { useSocket } from '@/socket/socketContext';
import { ITaskListStatusChangeResponse } from '@/types/tasks/task-list-status.types';
import { ITaskViewModel } from '@/types/tasks/task.types';
import { ITaskStatus } from '@/types/tasks/taskStatus.types';
import { checkTaskDependencyStatus } from '@/utils/check-task-dependency-status';
import { Select } from '@/shared/antd-imports';
import { useMemo } from 'react';
import { updateEnhancedKanbanTaskStatus } from '@/features/enhanced-kanban/enhanced-kanban.slice';

interface TaskDrawerStatusDropdownProps {
  statuses: ITaskStatus[];
  task: ITaskViewModel;
  teamId: string;
}

const TaskDrawerStatusDropdown = ({ statuses, task, teamId }: TaskDrawerStatusDropdownProps) => {
  const { socket } = useSocket();
  const dispatch = useAppDispatch();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const { tab } = useTabSearchParam();

  const getTaskProgress = (taskId: string) => {
    socket?.emit(SocketEvents.GET_TASK_PROGRESS.toString(), taskId);
  };

  const handleStatusChange = async (statusId: string) => {
    if (!task.id || !statusId) return;

    socket?.emit(
      SocketEvents.TASK_STATUS_CHANGE.toString(),
      JSON.stringify({
        task_id: task.id,
        status_id: statusId,
        parent_task: task.parent_task_id || null,
        team_id: teamId,
      })
    );
    socket?.once(
      SocketEvents.TASK_STATUS_CHANGE.toString(),
      (data: ITaskListStatusChangeResponse) => {
        dispatch(setTaskStatus(data));
        socket?.emit(SocketEvents.GET_TASK_PROGRESS.toString(), task.id);

        if (tab === 'tasks-list') {
          dispatch(updateTaskStatus(data));
        }
        if (tab === 'board') {
          dispatch(updateEnhancedKanbanTaskStatus(data));
        }
        if (data.parent_task) getTaskProgress(data.parent_task);
      }
    );
    if (task.status_id !== statusId) {
      const canContinue = await checkTaskDependencyStatus(task.id, statusId);
      if (!canContinue) {
        alertService.error(
          'Task is not completed',
          'Please complete the task dependencies before proceeding'
        );
      }
    }
  };

  const options = useMemo(
    () =>
      statuses.map(status => ({
        value: status.id,
        label: status.name,
      })),
    [statuses]
  );

  return (
    <>
      {task.status_id && (
        <Select
          variant="borderless"
          value={task.status_id}
          onChange={handleStatusChange}
          dropdownStyle={{ borderRadius: 8, minWidth: 150, maxWidth: 200 }}
          style={{
            backgroundColor: themeMode === 'dark' ? task.status_color_dark : task.status_color,
            borderRadius: 16,
          }}
          labelRender={status => {
            return <span style={{ fontSize: 13 }}>{status.label}</span>;
          }}
          options={options}
        />
      )}
    </>
  );
};

export default TaskDrawerStatusDropdown;
