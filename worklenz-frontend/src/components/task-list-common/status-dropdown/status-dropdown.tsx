import { Flex, Select } from 'antd';
import './status-dropdown.css';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useMemo } from 'react';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { getCurrentGroup, GROUP_BY_STATUS_VALUE } from '@/features/tasks/tasks.slice';

type StatusDropdownProps = {
  task: IProjectTask;
  teamId: string;
};

const StatusDropdown = ({ task, teamId }: StatusDropdownProps) => {
  const { socket } = useSocket();
  const statusList = useAppSelector(state => state.taskStatusReducer.status);
  const themeMode = useAppSelector(state => state.themeReducer.mode);

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
    socket?.emit(SocketEvents.GET_TASK_PROGRESS.toString(), task.id);
  };

  const isGroupByStatus = () => {
    return getCurrentGroup().value === GROUP_BY_STATUS_VALUE;
  };

  const options = useMemo(
    () =>
      statusList.map(status => ({
        value: status.id,
        label: status.name,
        color: themeMode === 'dark' ? status.color_code_dark : status.color_code,
      })),
    [statusList, themeMode]
  );

  return (
    <>
      {task.status && (
        <Select
          variant="borderless"
          value={task.status}
          onChange={handleStatusChange}
          dropdownStyle={{ borderRadius: 8, minWidth: 150, maxWidth: 200 }}
          style={{
            backgroundColor: themeMode === 'dark' ? task.status_color_dark : task.status_color,
            borderRadius: 16,
            height: 22,
          }}
          labelRender={status => {
            return status ? <span style={{ fontSize: 13 }}>{status.label}</span> : '';
          }}
          options={options}
          optionRender={(option) => (
            <Flex align="center">
              {option.label}
            </Flex>
          )}
        />
      )}
    </>
  );
};

export default StatusDropdown;
