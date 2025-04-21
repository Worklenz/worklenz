import { Flex, Select, Typography } from 'antd';
import './priority-dropdown.css';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useState, useEffect, useMemo } from 'react';
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

  useEffect(() => {
    const foundPriority = priorityList.find(priority => priority.id === task.priority);
    setSelectedPriority(foundPriority);
  }, [task.priority, priorityList]);

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

  return (
    <>
      {task.priority && (
        <Select
          variant="borderless"
          value={task.priority}
          onChange={handlePriorityChange}
          dropdownStyle={{ borderRadius: 8, minWidth: 150, maxWidth: 200 }}
          style={{
            backgroundColor:
              themeMode === 'dark'
                ? selectedPriority?.color_code_dark
                : selectedPriority?.color_code + ALPHA_CHANNEL,
            borderRadius: 16,
            height: 22,
          }}
          labelRender={value => {
            const priority = priorityList.find(priority => priority.id === value.value);
            return priority ? (
              <Typography.Text style={{ fontSize: 13, color: '#383838' }}>
                {priority.name}
              </Typography.Text>
            ) : (
              ''
            );
          }}
          options={options}
        />
      )}
    </>
  );
};

export default PriorityDropdown;
