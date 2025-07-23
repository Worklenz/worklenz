import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { Typography } from '@/shared/antd-imports';
import React from 'react';

interface ITaskListEstimationCellProps {
  task: IProjectTask;
}
const TaskListEstimationCell = ({ task }: ITaskListEstimationCellProps) => {
  return <Typography.Text>{task?.total_time_string}</Typography.Text>;
};

export default TaskListEstimationCell;
