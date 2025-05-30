import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import TaskTimer from '@/components/taskListCommon/task-timer/task-timer';
import { useTaskTimer } from '@/hooks/useTaskTimer';
import { useTranslation } from 'react-i18next';

type TaskListTimeTrackerCellProps = {
  task: IProjectTask;
};

const TaskListTimeTrackerCell = ({ task }: TaskListTimeTrackerCellProps) => {
  const { t } = useTranslation('task-drawer/task-drawer');
  const { started, timeString, handleStartTimer, handleStopTimer } = useTaskTimer(
    task.id || '',
    task.timer_start_time || null
  );

  // Check if task has subtasks
  const hasSubTasks = (task.sub_tasks_count || 0) > 0;
  const timerDisabledTooltip = hasSubTasks 
    ? t('taskTimeLogTab.timerDisabledTooltip', { 
        count: task.sub_tasks_count || 0,
        defaultValue: `Timer is disabled because this task has ${task.sub_tasks_count || 0} subtasks. Time should be logged on individual subtasks.`
      })
    : '';

  return (
    <TaskTimer
      taskId={task.id || ''}
      started={started}
      handleStartTimer={handleStartTimer}
      handleStopTimer={handleStopTimer}
      timeString={timeString}
      disabled={hasSubTasks}
      disabledTooltip={timerDisabledTooltip}
    />
  );
};

export default TaskListTimeTrackerCell;
