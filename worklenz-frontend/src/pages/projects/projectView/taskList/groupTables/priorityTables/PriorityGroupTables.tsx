import React from 'react';
import { TaskPriorityType, TaskType } from '../../../../../../types/task.types';
import { Flex } from '@/shared/antd-imports';
import TaskListTableWrapper from '../../task-list-table/task-list-table-wrapper/task-list-table-wrapper';
import { useAppSelector } from '../../../../../../hooks/useAppSelector';
import { getPriorityColor } from '../../../../../../utils/getPriorityColors';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';

const PriorityGroupTables = ({ datasource }: { datasource: IProjectTask[] }) => {
  const priorityList: { id: string; name: string }[] = [
    {
      id: 'high',
      name: 'high',
    },
    {
      id: 'medium',
      name: 'medium',
    },
    {
      id: 'low',
      name: 'low',
    },
  ];

  const themeMode = useAppSelector(state => state.themeReducer.mode);

  return (
    <Flex gap={24} vertical>
      {priorityList.map((priority, index) => (
        <TaskListTableWrapper
          key={index}
          taskList={datasource.filter(task => task.priority === priority.name)}
          tableId={priority.id}
          name={priority.name}
          groupBy="priority"
          priorityCategory={priority.name}
          color={getPriorityColor(priority.name as TaskPriorityType, themeMode)}
        />
      ))}
    </Flex>
  );
};

export default PriorityGroupTables;
