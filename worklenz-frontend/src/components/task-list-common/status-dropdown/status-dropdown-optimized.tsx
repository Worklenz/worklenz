import React, { useMemo, useCallback } from 'react';
import { Flex, Select } from 'antd';
import './status-dropdown.css';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { getCurrentGroup, GROUP_BY_STATUS_VALUE } from '@/features/tasks/tasks.slice';

type StatusDropdownProps = {
  task: IProjectTask;
  teamId: string;
};

// Create a memoized options factory outside component to prevent recreation
const createStatusOptions = (statusList: any[], themeMode: string) => {
  return statusList.map(status => ({
    value: status.id,
    label: status.name,
    color: themeMode === 'dark' ? status.color_code_dark : status.color_code,
  }));
};

const StatusDropdownOptimized = React.memo<StatusDropdownProps>(({ task, teamId }) => {
  const { socket } = useSocket();
  const statusList = useAppSelector(state => state.taskStatusReducer.status);
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  // Memoize options with stable reference
  const options = useMemo(
    () => createStatusOptions(statusList, themeMode),
    [statusList, themeMode]
  );

  // Memoize the change handler to prevent recreation
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

  // Memoize the label renderer to prevent recreation
  const labelRenderer = useCallback((status: any) => {
    return status ? <span style={{ fontSize: 13 }}>{status.label}</span> : '';
  }, []);

  // Memoize the option renderer to prevent recreation
  const optionRenderer = useCallback((option: any) => (
    <Flex align="center">
      {option.label}
    </Flex>
  ), []);

  // Memoize style object to prevent recreation
  const selectStyle = useMemo(() => ({
    backgroundColor: themeMode === 'dark' ? task.status_color_dark : task.status_color,
    borderRadius: 16,
    height: 22,
  }), [themeMode, task.status_color_dark, task.status_color]);

  // Memoize dropdown style to prevent recreation
  const dropdownStyle = useMemo(() => ({
    borderRadius: 8,
    minWidth: 150,
    maxWidth: 200
  }), []);

  // Early return if no status
  if (!task.status) return null;

  return (
    <Select
      variant="borderless"
      value={task.status}
      onChange={handleStatusChange}
      dropdownStyle={dropdownStyle}
      style={selectStyle}
      labelRender={labelRenderer}
      options={options}
      optionRender={optionRenderer}
      // Add these performance optimizations
      virtual={false} // Disable virtualization for small lists
      showSearch={false} // Disable search if not needed
      notFoundContent={null} // Prevent unnecessary renders
    />
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for better memoization
  return (
    prevProps.task.id === nextProps.task.id &&
    prevProps.task.status === nextProps.task.status &&
    prevProps.task.status_color === nextProps.task.status_color &&
    prevProps.task.status_color_dark === nextProps.task.status_color_dark &&
    prevProps.teamId === nextProps.teamId
  );
});

StatusDropdownOptimized.displayName = 'StatusDropdownOptimized';

export default StatusDropdownOptimized; 