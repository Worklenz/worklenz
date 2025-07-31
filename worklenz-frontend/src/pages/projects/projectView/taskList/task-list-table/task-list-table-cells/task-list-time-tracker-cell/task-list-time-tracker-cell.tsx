import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import TaskTimer from '@/components/taskListCommon/task-timer/task-timer';
import { useTaskTimer } from '@/hooks/useTaskTimer';

type TaskListTimeTrackerCellProps = {
  task: IProjectTask;
};

const TaskListTimeTrackerCell = ({ task }: TaskListTimeTrackerCellProps) => {
  const { started, timeString, handleStartTimer, handleStopTimer } = useTaskTimer(
    task.id || '',
    task.timer_start_time || null
  );

  return (
    <TaskTimer
      taskId={task.id || ''}
      started={started}
      handleStartTimer={handleStartTimer}
      handleStopTimer={handleStopTimer}
      timeString={timeString}
    />
  );
};

export default TaskListTimeTrackerCell;
