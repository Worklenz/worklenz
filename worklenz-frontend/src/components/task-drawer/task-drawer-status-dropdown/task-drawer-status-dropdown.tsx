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
import { CSSProperties, useMemo } from 'react';
import './task-drawer-status-dropdown.css';
import { updateEnhancedKanbanTaskStatus } from '@/features/enhanced-kanban/enhanced-kanban.slice';
import { updateTask } from '@/features/task-management/task-management.slice';
import { store } from '@/app/store';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { evt_task_completed } from '@/shared/worklenz-analytics-events';

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
  const { trackMixpanelEvent } = useMixpanelTracking();

  const getTaskProgress = (taskId: string) => {
    socket?.emit(SocketEvents.GET_TASK_PROGRESS.toString(), taskId);
  };

  const handleStatusChange = async (statusId: string) => {
    if (!task.id || !statusId) return;

    // Check dependencies BEFORE emitting the socket event
    if (task.status_id !== statusId) {
      const canContinue = await checkTaskDependencyStatus(task.id, statusId);
      if (!canContinue) {
        alertService.error(
          'Task is not completed',
          'Please complete the task dependencies before proceeding'
        );
        return;
      }
    }

    socket?.emit(
      SocketEvents.TASK_STATUS_CHANGE.toString(),
      JSON.stringify({
        task_id: task.id,
        status_id: statusId,
        parent_task: task.parent_task_id || null,
        team_id: teamId,
      })
    );

    // Update task drawer state and emit progress request
    // The global useTaskSocketHandlers will handle updating all slices
    socket?.once(
      SocketEvents.TASK_STATUS_CHANGE.toString(),
      (data: ITaskListStatusChangeResponse) => {
        dispatch(setTaskStatus(data));
        // Track task completion if status changed to done category
        if (data.statusCategory?.is_done) {
          trackMixpanelEvent(evt_task_completed, {
            task_id: task.id,
            project_id: task.project_id,
            status_id: data.status_id,
          });
        }
        // Update task-management slice for task-list-v2
        const currentTask = store.getState().taskManagement.entities[task.id];
        if (currentTask) {
          dispatch(
            updateTask({
              ...currentTask,
              status: data.status_id || currentTask.status,
              progress:
                typeof data.complete_ratio === 'number'
                  ? data.complete_ratio
                  : currentTask.progress,
              complete_ratio: data.complete_ratio,
              updatedAt: new Date().toISOString(),
            })
          );
        }

        // Update old tasks slice
        if (tab === 'tasks-list') {
          dispatch(updateTaskStatus(data));
        }

        // Update enhanced kanban slice
        if (tab === 'board') {
          dispatch(updateEnhancedKanbanTaskStatus(data));
        }

        socket?.emit(SocketEvents.GET_TASK_PROGRESS.toString(), task.id);
        if (data.parent_task) getTaskProgress(data.parent_task);
      }
    );
  };

  const options = useMemo(
    () =>
      statuses.map(status => ({
        value: status.id,
        label: status.name,
      })),
    [statuses]
  );

  const selectedStatus = useMemo(
    () => statuses.find(status => status.id === task.status_id),
    [statuses, task.status_id]
  );

  const resolvedStatusBackground = useMemo(() => {
    return selectedStatus?.color_code || task.status_color || task.status_color_dark;
  }, [
    selectedStatus?.color_code,
    task.status_color,
    task.status_color_dark,
  ]);

  return (
    <>
      {task.status_id && (
        <Select
          className="task-drawer-status-select"
          variant="borderless"
          value={task.status_id}
          onChange={handleStatusChange}
          dropdownStyle={{ borderRadius: 8, minWidth: 150, maxWidth: 200 }}
          style={
            {
              backgroundColor: resolvedStatusBackground,
              borderRadius: 16,
              '--task-drawer-status-bg': resolvedStatusBackground,
            } as CSSProperties
          }
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
