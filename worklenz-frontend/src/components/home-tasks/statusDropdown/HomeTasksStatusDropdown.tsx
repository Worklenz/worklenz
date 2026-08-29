import { Badge, Flex, Select } from '@/shared/antd-imports';
import './home-tasks-status-dropdown.css';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useTranslation } from 'react-i18next';
import { ITaskStatus } from '@/types/status.types';
import { useState, useEffect, useMemo } from 'react';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { ITaskListStatusChangeResponse } from '@/types/tasks/task-list-status.types';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';

type HomeTasksStatusDropdownProps = {
  task: IProjectTask;
  teamId: string;
};

const HomeTasksStatusDropdown = ({ task, teamId }: HomeTasksStatusDropdownProps) => {
  const { t } = useTranslation('task-list-table');
  const { socket, connected } = useSocket();
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  const [selectedStatus, setSelectedStatus] = useState<ITaskStatus | undefined>(undefined);

  const handleStatusChange = (statusId: string) => {
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
    getTaskProgress(task.id);
  };

  const handleTaskStatusChange = (response: ITaskListStatusChangeResponse) => {
    if (response && response.id === task.id) {
      const updatedTask = {
        ...task,
        status_color: response.color_code,
        complete_ratio: +response.complete_ratio || 0,
        status_id: response.status_id,
        status_category: response.statusCategory,
      };
      setSelectedStatus(updatedTask);
    }
  };

  const getTaskProgress = (taskId: string) => {
    socket?.emit(SocketEvents.GET_TASK_PROGRESS.toString(), taskId);
  };

  useEffect(() => {
    const foundStatus = task.project_statuses?.find(status => status.id === task.status_id);
    setSelectedStatus(foundStatus);
  }, [task.status_id, task.project_statuses]);

  useEffect(() => {
    socket?.on(SocketEvents.TASK_STATUS_CHANGE.toString(), handleTaskStatusChange);

    return () => {
      socket?.removeListener(SocketEvents.TASK_STATUS_CHANGE.toString(), handleTaskStatusChange);
    };
  }, [connected]);

  const options = useMemo(
    () =>
      task.project_statuses?.map(status => ({
        value: status.id,
        label: (
          <Flex gap={8} align="center">
            <Badge color={status.color_code} text={status.name} />
          </Flex>
        ),
      })),
    [task.project_statuses]
  );

  // Solid status color, same convention as the Priority cell's badge —
  // matches its color_code/color_code_dark + borderRadius: 4 pairing instead
  // of a diluted alpha-blended pill.
  const statusColor =
    (themeMode === 'dark' ? selectedStatus?.color_code_dark : selectedStatus?.color_code) ??
    selectedStatus?.color_code;

  return (
    <>
      {
        <Select
          variant="borderless"
          value={task.status_id}
          onChange={handleStatusChange}
          className="home-status-select"
          styles={{
            popup: {
              root: { borderRadius: 8, minWidth: 150, maxWidth: 200 },
            },
          }}
          style={
            {
              // A CSS var, not `backgroundColor` directly — antd's dark theme
              // paints its own opaque fill on the inner `.ant-select-selector`
              // (not the outer node this `style` prop targets), which sat on
              // top of and hid this color in dark mode. See the matching
              // `.home-status-select .ant-select-selector` rule in the CSS file.
              '--status-color': statusColor,
              borderRadius: 4,
              height: 22,
            } as React.CSSProperties
          }
          labelRender={value => {
            const status = task.project_statuses?.find(status => status.id === value.value);
            return status ? <span style={{ fontSize: 12, color: '#fff' }}>{status.name}</span> : '';
          }}
          options={options}
        />
      }
    </>
  );
};

export default HomeTasksStatusDropdown;
