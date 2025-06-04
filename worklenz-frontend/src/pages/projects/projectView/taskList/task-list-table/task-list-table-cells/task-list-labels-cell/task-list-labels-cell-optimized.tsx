import React from 'react';
import { Flex } from 'antd';
import CustomColordLabel from '@/components/taskListCommon/labelsSelector/CustomColordLabel';
import CustomNumberLabel from '@/components/taskListCommon/labelsSelector/CustomNumberLabel';
import LabelsSelectorOptimized from '@/components/taskListCommon/labelsSelector/LabelsSelector-optimized';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';

interface TaskListLabelsCellProps {
  task: IProjectTask;
}

const TaskListLabelsCellOptimized = React.memo<TaskListLabelsCellProps>(({ task }) => {
  return (
    <Flex>
      {task.labels?.map((label, index) => (
        label.end && label.names && label.name ? (
          <CustomNumberLabel key={`${label.id}-${index}`} labelList={label.names ?? []} namesString={label.name} />
        ) : (
          <CustomColordLabel key={`${label.id}-${index}`} label={label} />
        )
      ))}
      <LabelsSelectorOptimized task={task} />
    </Flex>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.task.id === nextProps.task.id &&
    JSON.stringify(prevProps.task.labels) === JSON.stringify(nextProps.task.labels) &&
    JSON.stringify(prevProps.task.all_labels) === JSON.stringify(nextProps.task.all_labels)
  );
});

TaskListLabelsCellOptimized.displayName = 'TaskListLabelsCellOptimized';

export default TaskListLabelsCellOptimized; 