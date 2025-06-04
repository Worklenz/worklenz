import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { Flex, Select, Typography } from 'antd';
import './priority-dropdown.css';
import { useAppSelector } from '@/hooks/useAppSelector';
import { ALPHA_CHANNEL } from '@/shared/constants';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { ITaskPriority } from '@/types/tasks/taskPriority.types';
import { DoubleLeftOutlined, MinusOutlined, PauseOutlined } from '@ant-design/icons';

type PriorityDropdownProps = {
  task: IProjectTask;
  teamId: string;
};

// Memoized icon components to prevent recreation
const PriorityIcon = React.memo(({ name, color }: { name: string; color: string }) => {
  const iconStyle = { color };
  
  switch (name) {
    case 'Low':
      return <MinusOutlined style={iconStyle} />;
    case 'Medium':
      return <PauseOutlined style={{ ...iconStyle, transform: 'rotate(90deg)' }} />;
    case 'High':
      return <DoubleLeftOutlined style={{ ...iconStyle, transform: 'rotate(90deg)' }} />;
    default:
      return null;
  }
});

// Create options factory outside component
const createPriorityOptions = (priorityList: ITaskPriority[], themeMode: string) => {
  return priorityList
    .filter(priority => priority.id) // Filter out priorities without valid IDs
    .map(priority => ({
      value: priority.id,
      label: (
        <Flex gap={8} align="center" justify="space-between">
          {priority.name}
          <PriorityIcon 
            name={priority.name} 
            color={(themeMode === 'dark' ? priority.color_code_dark : priority.color_code) || ''}
          />
        </Flex>
      ),
    }));
};

const PriorityDropdownOptimized = React.memo<PriorityDropdownProps>(({ task, teamId }) => {
  const { socket } = useSocket();
  const [selectedPriority, setSelectedPriority] = useState<ITaskPriority | undefined>(undefined);
  const priorityList = useAppSelector(state => state.priorityReducer.priorities);
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  // Memoize the change handler
  const handlePriorityChange = useCallback((priorityId: string) => {
    if (!task.id || !priorityId) return;

    socket?.emit(
      SocketEvents.TASK_PRIORITY_CHANGE.toString(),
      JSON.stringify({
        task_id: task.id,
        priority_id: priorityId,
        team_id: teamId,
      })
    );
  }, [task.id, teamId, socket]);

  // Update selected priority when task priority changes
  useEffect(() => {
    const foundPriority = priorityList.find(priority => priority.id === task.priority);
    setSelectedPriority(foundPriority);
  }, [task.priority, priorityList]);

  // Memoize options
  const options = useMemo(
    () => createPriorityOptions(priorityList, themeMode),
    [priorityList, themeMode]
  );

  // Memoize priority lookup map for better performance
  const priorityMap = useMemo(
    () => new Map(priorityList.map(priority => [priority.id, priority])),
    [priorityList]
  );

  // Memoize label renderer with optimized lookup
  const labelRenderer = useCallback((value: any) => {
    const priority = priorityMap.get(value.value);
    return priority ? (
      <Typography.Text style={{ fontSize: 13, color: '#383838' }}>
        {priority.name}
      </Typography.Text>
    ) : '';
  }, [priorityMap]);

  // Memoize style objects
  const selectStyle = useMemo(() => ({
    backgroundColor:
      themeMode === 'dark'
        ? selectedPriority?.color_code_dark
        : selectedPriority?.color_code + ALPHA_CHANNEL,
    borderRadius: 16,
    height: 22,
  }), [themeMode, selectedPriority?.color_code_dark, selectedPriority?.color_code]);

  const dropdownStyle = useMemo(() => ({
    borderRadius: 8,
    minWidth: 150,
    maxWidth: 200
  }), []);

  // Early return if no priority
  if (!task.priority) return null;

  return (
    <Select
      variant="borderless"
      value={task.priority}
      onChange={handlePriorityChange}
      dropdownStyle={dropdownStyle}
      style={selectStyle}
      labelRender={labelRenderer}
      options={options}
      // Performance optimizations
      virtual={false}
      showSearch={false}
      notFoundContent={null}
    />
  );
}, (prevProps, nextProps) => {
  // Custom comparison for better memoization
  return (
    prevProps.task.id === nextProps.task.id &&
    prevProps.task.priority === nextProps.task.priority &&
    prevProps.teamId === nextProps.teamId
  );
});

PriorityDropdownOptimized.displayName = 'PriorityDropdownOptimized';

export default PriorityDropdownOptimized; 