import { Flex, Select, Typography } from '@/shared/antd-imports';
import './priority-dropdown.css';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useState, useEffect, useMemo } from 'react';
import { ALPHA_CHANNEL } from '@/shared/constants';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { ITaskPriority } from '@/types/tasks/taskPriority.types';
import { DoubleLeftOutlined, MinusOutlined, PauseOutlined } from '@/shared/antd-imports';

type PriorityDropdownProps = {
  task: IProjectTask;
  teamId: string;
};

const PriorityDropdown = ({ task, teamId }: PriorityDropdownProps) => {
  const { socket } = useSocket();
  const [selectedPriority, setSelectedPriority] = useState<ITaskPriority | undefined>(undefined);
  const priorityList = useAppSelector(state => state.priorityReducer.priorities);
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  const handlePriorityChange = (priorityId: string) => {
    if (!task.id || !priorityId) return;

    socket?.emit(
      SocketEvents.TASK_PRIORITY_CHANGE.toString(),
      JSON.stringify({
        task_id: task.id,
        priority_id: priorityId,
        team_id: teamId,
      })
    );
  };

  // Helper function to get display name for raw priority values
  const getPriorityDisplayName = (priority: string | undefined) => {
    if (!priority) return 'Medium';

    // Handle raw priority values from backend
    const priorityDisplayMap: Record<string, string> = {
      critical: 'Critical',
      high: 'High',
      medium: 'Medium',
      low: 'Low',
    };

    return priorityDisplayMap[priority.toLowerCase()] || priority;
  };

  // Helper function to get priority color for raw priority values
  const getPriorityColor = (priority: string | undefined) => {
    if (!priority) return themeMode === 'dark' ? '#434343' : '#f0f0f0';

    // Default colors for raw priority values
    const priorityColorMap: Record<string, { light: string; dark: string }> = {
      critical: { light: '#ff4d4f', dark: '#ff7875' },
      high: { light: '#fa8c16', dark: '#ffa940' },
      medium: { light: '#1890ff', dark: '#40a9ff' },
      low: { light: '#52c41a', dark: '#73d13d' },
    };

    const colorPair = priorityColorMap[priority.toLowerCase()];
    return colorPair
      ? themeMode === 'dark'
        ? colorPair.dark
        : colorPair.light
      : themeMode === 'dark'
        ? '#434343'
        : '#f0f0f0';
  };

  // Find matching priority from the list, or use raw value
  const currentPriority = useMemo(() => {
    if (!task.priority) return null;

    // First try to find by ID
    const priorityById = priorityList.find(priority => priority.id === task.priority);
    if (priorityById) return priorityById;

    // Then try to find by name (case insensitive)
    const priorityByName = priorityList.find(
      priority => priority.name.toLowerCase() === task.priority?.toLowerCase()
    );
    if (priorityByName) return priorityByName;

    // Return null if no match found (will use fallback rendering)
    return null;
  }, [task.priority, priorityList]);

  useEffect(() => {
    setSelectedPriority(currentPriority || undefined);
  }, [currentPriority]);

  const options = useMemo(
    () =>
      priorityList.map(priority => ({
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

  // If we have a valid priority from the list, render the dropdown
  if (currentPriority && priorityList.length > 0) {
    return (
      <Select
        variant="borderless"
        value={currentPriority.id}
        onChange={handlePriorityChange}
        dropdownStyle={{ borderRadius: 8, minWidth: 150, maxWidth: 200 }}
        style={{
          backgroundColor:
            themeMode === 'dark'
              ? currentPriority.color_code_dark
              : currentPriority.color_code + ALPHA_CHANNEL,
          borderRadius: 16,
          height: 22,
        }}
        labelRender={() => {
          return (
            <Typography.Text style={{ fontSize: 13, color: '#383838' }}>
              {currentPriority.name}
            </Typography.Text>
          );
        }}
        options={options}
      />
    );
  }

  // Fallback rendering for raw priority values or when priority list is not loaded
  return (
    <div
      className="px-2 py-1 text-xs rounded-sm"
      style={{
        backgroundColor: getPriorityColor(task.priority) + ALPHA_CHANNEL,
        borderRadius: 16,
        height: 22,
        display: 'flex',
        alignItems: 'center',
        fontSize: 13,
        color: '#383838',
        minWidth: 60,
      }}
    >
      {getPriorityDisplayName(task.priority)}
    </div>
  );
};

export default PriorityDropdown;
