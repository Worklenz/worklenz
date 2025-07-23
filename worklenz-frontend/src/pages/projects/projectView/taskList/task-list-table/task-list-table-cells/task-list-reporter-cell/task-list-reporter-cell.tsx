import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { Typography } from '@/shared/antd-imports';

const TaskListReporterCell = ({ task }: { task: IProjectTask }) => {
  return <Typography.Text>{task?.reporter}</Typography.Text>;
};

export default TaskListReporterCell;
