import React from 'react';
import TaskTimer from '@/components/taskListCommon/task-timer/task-timer';
import { useTaskTimerWithConflictCheck } from '@/hooks/useTaskTimerWithConflictCheck';

interface TaskTimeTrackingProps {
  taskId: string;
  isDarkMode: boolean;
  disabled?: boolean;
}

const TaskTimeTracking: React.FC<TaskTimeTrackingProps> = React.memo(({ taskId, isDarkMode, disabled = false }) => {
  const { started, timeString, handleStartTimer, handleStopTimer } = useTaskTimerWithConflictCheck(
    taskId,
    null // The hook will get the timer start time from Redux
  );

  return (
    <TaskTimer
      taskId={taskId}
      started={started}
      handleStartTimer={disabled ? undefined : handleStartTimer}
      handleStopTimer={disabled ? undefined : handleStopTimer}
      timeString={timeString}
      disabled={disabled}
    />
  );
});

TaskTimeTracking.displayName = 'TaskTimeTracking';

export default TaskTimeTracking;
