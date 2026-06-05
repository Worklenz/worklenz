import React, { memo, useCallback } from 'react';
import { TimePicker } from '@/shared/antd-imports';
import { dayjs } from '@/shared/antd-imports';
import { Task } from '@/types/task-management.types';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { useTranslation } from 'react-i18next';
import './task-list-due-time-cell.css';

interface TaskListDueTimeCellProps {
  task: Task;
  disabled?: boolean;
}

const TaskListDueTimeCell: React.FC<TaskListDueTimeCellProps> = memo(({ task, disabled = false }) => {
  const { socket, connected } = useSocket();
  const { t } = useTranslation('task-list-table');

  // Parse stored "HH:mm" string into a dayjs value for the picker
  const timeValue = task.due_time ? dayjs(task.due_time, 'HH:mm') : null;

  const handleTimeChange = useCallback(
    (_time: dayjs.Dayjs | null, timeString: string | string[]) => {
      if (!connected || !socket) return;

      const value = Array.isArray(timeString) ? timeString[0] : timeString;

      socket.emit(
        SocketEvents.TASK_DUE_TIME_CHANGE.toString(),
        JSON.stringify({
          task_id: task.id,
          due_time: value || null,
        })
      );
    },
    [connected, socket, task.id]
  );

  return (
    <TimePicker
      format="HH:mm"
      value={timeValue}
      onChange={handleTimeChange}
      changeOnScroll
      needConfirm={false}
      placeholder={t('setDueTime', { defaultValue: 'Set due time' })}
      style={{
        border: 'none',
        background: 'transparent',
        width: '100%',
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? 'not-allowed' : undefined,
      }}
      className="due-time-picker"
      allowClear
      disabled={disabled}
    />
  );
});

TaskListDueTimeCell.displayName = 'TaskListDueTimeCell';

export default TaskListDueTimeCell;
