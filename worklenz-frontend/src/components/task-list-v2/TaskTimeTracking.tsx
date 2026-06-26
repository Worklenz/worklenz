import React from 'react';
import TaskTimer from '@/components/taskListCommon/task-timer/task-timer';
import { useTaskTimerWithConflictCheck } from '@/hooks/useTaskTimerWithConflictCheck';

interface TaskTimeTrackingProps {
  taskId: string;
  isDarkMode: boolean;
}

const TaskTimeTracking: React.FC<TaskTimeTrackingProps> = React.memo(({ taskId, isDarkMode }) => {
  const { started, timeString, handleStartTimer, handleStopTimer } = useTaskTimerWithConflictCheck(
    taskId,
    null // The hook will get the timer start time from Redux
  );

  return (
    <TaskTimer
      taskId={taskId}
      started={started}
      handleStartTimer={handleStartTimer}
      handleStopTimer={handleStopTimer}
      timeString={timeString}
    />
  );
});

TaskTimeTracking.displayName = 'TaskTimeTracking';

export default TaskTimeTracking;
