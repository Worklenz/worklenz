import { Flex, Select } from 'antd';
import './status-dropdown.css';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useMemo, useCallback } from 'react';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { getCurrentGroup, GROUP_BY_STATUS_VALUE } from '@/features/tasks/tasks.slice';
import React from 'react';

type StatusDropdownProps = {
  task: IProjectTask;
  teamId: string;
};

const StatusDropdown = React.memo<StatusDropdownProps>(({ task, teamId }) => {
  const { socket } = useSocket();
  const statusList = useAppSelector(state => state.taskStatusReducer.status);
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  const handleStatusChange = useCallback((statusId: string) => {
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
  }, [task.id, task.parent_task_id, teamId, socket]);

  const isGroupByStatus = useCallback(() => {
    return getCurrentGroup().value === GROUP_BY_STATUS_VALUE;
  }, []);

  const options = useMemo(
    () =>
      statusList.map(status => ({
        value: status.id,
        label: status.name,
        color: themeMode === 'dark' ? status.color_code_dark : status.color_code,
      })),
    [statusList, themeMode]
  );

  // Memoize style object
  const selectStyle = useMemo(() => ({
    backgroundColor: themeMode === 'dark' ? task.status_color_dark : task.status_color,
    borderRadius: 16,
    height: 22,
  }), [themeMode, task.status_color_dark, task.status_color]);

  // Memoize dropdown style
  const dropdownStyle = useMemo(() => ({
    borderRadius: 8,
    minWidth: 150,
    maxWidth: 200
  }), []);

  // Memoize label renderer
  const labelRenderer = useCallback((status: any) => {
    return status ? <span style={{ fontSize: 13 }}>{status.label}</span> : '';
  }, []);

  // Memoize option renderer
  const optionRenderer = useCallback((option: any) => (
    <Flex align="center">
      {option.label}
    </Flex>
  ), []);

  return (
    <>
      {task.status && (
        <Select
          variant="borderless"
          value={task.status}
          onChange={handleStatusChange}
          dropdownStyle={dropdownStyle}
          style={selectStyle}
          labelRender={labelRenderer}
          options={options}
          optionRender={optionRenderer}
          // Performance optimizations
          virtual={false}
          showSearch={false}
          notFoundContent={null}
        />
      )}
    </>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for better memoization
  return (
    prevProps.task.id === nextProps.task.id &&
    prevProps.task.status === nextProps.task.status &&
    prevProps.task.status_color === nextProps.task.status_color &&
    prevProps.task.status_color_dark === nextProps.task.status_color_dark &&
    prevProps.task.parent_task_id === nextProps.task.parent_task_id &&
    prevProps.teamId === nextProps.teamId
  );
});

StatusDropdown.displayName = 'StatusDropdown';

export default StatusDropdown;
