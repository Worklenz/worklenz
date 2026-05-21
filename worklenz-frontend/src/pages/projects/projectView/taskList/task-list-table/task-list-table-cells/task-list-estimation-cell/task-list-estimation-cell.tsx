import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { InputNumber, Typography } from '@/shared/antd-imports';
import React, { useState, useEffect, useCallback } from 'react';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';

interface ITaskListEstimationCellProps {
  task: IProjectTask;
}

const TaskListEstimationCell = ({ task }: ITaskListEstimationCellProps) => {
  const { socket, connected } = useSocket();
  
  // Calculate initial value as decimal hours
  const initialValue = (task?.total_hours || 0) + (task?.total_minutes || 0) / 60;
  const [estimationValue, setEstimationValue] = useState<number | null>(
    initialValue > 0 ? initialValue : null
  );

  useEffect(() => {
    const newVal = (task?.total_hours || 0) + (task?.total_minutes || 0) / 60;
    setEstimationValue(newVal > 0 ? newVal : null);
  }, [task?.total_hours, task?.total_minutes]);

  const handleEstimationChange = useCallback(
    (value: number | null) => {
      setEstimationValue(value);
      if (!connected || !socket || !task.id) return;
      
      const hours = value ? Math.floor(value) : 0;
      const minutes = value ? Math.round((value - hours) * 60) : 0;

      socket.emit(
        SocketEvents.TASK_TIME_ESTIMATION_CHANGE.toString(),
        JSON.stringify({
          task_id: task.id,
          total_hours: hours,
          total_minutes: minutes,
          parent_task: task.parent_task_id || null,
        })
      );
    },
    [connected, socket, task.id, task.parent_task_id]
  );

  return (
    <div className="w-full">
      <InputNumber
        min={0}
        precision={1}
        size="small"
        className="w-full bg-transparent shadow-none border-transparent hover:border-gray-300 focus:border-blue-500 transition-colors"
        style={{ background: 'transparent' }}
        value={estimationValue}
        placeholder="-"
        onChange={handleEstimationChange}
        onPressEnter={(e) => {
          (e.target as HTMLInputElement).blur();
        }}
        controls={false}
      />
    </div>
  );
};

export default TaskListEstimationCell;
