import { Flex, Typography } from '@/shared/antd-imports';
import './priority-section.css';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useState, useEffect, useMemo } from 'react';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { ITaskPriority } from '@/types/tasks/taskPriority.types';
import { DoubleLeftOutlined, MinusOutlined, PauseOutlined } from '@/shared/antd-imports';

type PrioritySectionProps = {
  task: IProjectTask;
};

const PrioritySection = ({ task }: PrioritySectionProps) => {
  const [selectedPriority, setSelectedPriority] = useState<ITaskPriority | undefined>(undefined);
  const priorityList = useAppSelector(state => state.priorityReducer.priorities);
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  // Update selectedPriority whenever task.priority or priorityList changes
  useEffect(() => {
    if (!task.priority || !priorityList.length) {
      setSelectedPriority(undefined);
      return;
    }

    const foundPriority = priorityList.find(priority => priority.id === task.priority);
    setSelectedPriority(foundPriority);
  }, [task.priority, priorityList]);

  const priorityIcon = useMemo(() => {
    if (!selectedPriority) return null;

    const iconProps = {
      style: {
        color:
          themeMode === 'dark' ? selectedPriority.color_code_dark : selectedPriority.color_code,
        marginRight: '0.25rem',
      },
    };

    switch (selectedPriority.name) {
      case 'Low':
        return <MinusOutlined {...iconProps} />;
      case 'Medium':
        return (
          <PauseOutlined
            {...iconProps}
            style={{ ...iconProps.style, transform: 'rotate(90deg)' }}
          />
        );
      case 'High':
        return (
          <DoubleLeftOutlined
            {...iconProps}
            style={{ ...iconProps.style, transform: 'rotate(90deg)' }}
          />
        );
      default:
        return null;
    }
  }, [selectedPriority, themeMode]);

  if (!task.priority || !selectedPriority) return null;

  return <Flex gap={4}>{priorityIcon}</Flex>;
};

export default PrioritySection;
