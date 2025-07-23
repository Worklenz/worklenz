import { Flex, Select } from '@/shared/antd-imports';
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

  // Helper function to get display name for raw status values
  const getStatusDisplayName = (status: string | undefined) => {
    if (!status) return 'To Do';

    // Handle raw status values from backend
    const statusDisplayMap: Record<string, string> = {
      to_do: 'To Do',
      todo: 'To Do',
      doing: 'Doing',
      in_progress: 'In Progress',
      done: 'Done',
      completed: 'Completed',
    };

    return statusDisplayMap[status.toLowerCase()] || status;
  };

  // Helper function to get status color for raw status values
  const getStatusColor = (status: string | undefined) => {
    if (!status) return themeMode === 'dark' ? '#434343' : '#f0f0f0';

    // Default colors for raw status values
    const statusColorMap: Record<string, { light: string; dark: string }> = {
      to_do: { light: '#f0f0f0', dark: '#434343' },
      todo: { light: '#f0f0f0', dark: '#434343' },
      doing: { light: '#1890ff', dark: '#177ddc' },
      in_progress: { light: '#1890ff', dark: '#177ddc' },
      done: { light: '#52c41a', dark: '#389e0d' },
      completed: { light: '#52c41a', dark: '#389e0d' },
    };

    const colorPair = statusColorMap[status.toLowerCase()];
    return colorPair
      ? themeMode === 'dark'
        ? colorPair.dark
        : colorPair.light
      : themeMode === 'dark'
        ? '#434343'
        : '#f0f0f0';
  };

  // Find matching status from the list, or use raw value
  const currentStatus = useMemo(() => {
    if (!task.status) return null;

    // First try to find by ID
    const statusById = statusList.find(status => status.id === task.status);
    if (statusById) return statusById;

    // Then try to find by name (case insensitive)
    const statusByName = statusList.find(
      status => status.name.toLowerCase() === task.status?.toLowerCase()
    );
    if (statusByName) return statusByName;

    // Return null if no match found (will use fallback rendering)
    return null;
  }, [task.status, statusList]);

  const options = useMemo(
    () =>
      statusList.map(status => ({
        value: status.id,
        label: status.name,
        color: themeMode === 'dark' ? status.color_code_dark : status.color_code,
      })),
    [statusList, themeMode]
  );

  // If we have a valid status from the list, render the dropdown
  if (currentStatus && statusList.length > 0) {
    return (
      <Select
        variant="borderless"
        value={currentStatus.id}
        onChange={handleStatusChange}
        dropdownStyle={{ borderRadius: 8, minWidth: 150, maxWidth: 200 }}
        style={{
          backgroundColor:
            themeMode === 'dark' ? currentStatus.color_code_dark : currentStatus.color_code,
          borderRadius: 16,
          height: 22,
        }}
        labelRender={() => {
          return <span style={{ fontSize: 13 }}>{currentStatus.name}</span>;
        }}
        options={options}
        optionRender={option => <Flex align="center">{option.label}</Flex>}
      />
    );
  }

  // Fallback rendering for raw status values or when status list is not loaded
  return (
    <div
      className="px-2 py-1 text-xs rounded-sm"
      style={{
        backgroundColor: getStatusColor(task.status),
        borderRadius: 16,
        height: 22,
        display: 'flex',
        alignItems: 'center',
        fontSize: 13,
        color: '#383838',
        minWidth: 60,
      }}
    >
      {getStatusDisplayName(task.status)}
    </div>
  );
};

export default StatusDropdown;
