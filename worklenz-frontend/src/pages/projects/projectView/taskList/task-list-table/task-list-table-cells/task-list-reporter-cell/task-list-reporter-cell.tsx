import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { Typography } from '@/components/ui';

const TaskListReporterCell = ({ task }: { task: IProjectTask }) => {
  return <Typography.Text>{task?.reporter}</Typography.Text>;
};

export default TaskListReporterCell;
