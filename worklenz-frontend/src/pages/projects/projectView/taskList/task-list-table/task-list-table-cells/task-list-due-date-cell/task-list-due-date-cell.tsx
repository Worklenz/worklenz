import { useState, useEffect } from 'react';
import { DatePicker } from '@/shared/antd-imports';
import { colors } from '@/styles/colors';
import dayjs, { Dayjs } from 'dayjs';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { getUserSession } from '@/utils/session-helper';
import logger from '@/utils/errorLogger';

const TaskListDueDateCell = ({ task }: { task: IProjectTask }) => {
  const { socket } = useSocket();
  const startDayjs = task.start_date ? dayjs(task.start_date, 'YYYY-MM-DD') : null;

  // Local state for optimistic UI — prevents the controlled DatePicker from
  // snapping back to the old value while waiting for the socket round-trip
  const [localDate, setLocalDate] = useState<Dayjs | null>(
    task.end_date ? dayjs(task.end_date, 'YYYY-MM-DD') : null
  );

  // Sync local state when Redux updates the task (e.g. socket response arrives)
  useEffect(() => {
    setLocalDate(task.end_date ? dayjs(task.end_date, 'YYYY-MM-DD') : null);
  }, [task.end_date]);

  const handleEndDateChange = (date: Dayjs | null) => {
    // Optimistic update — clear/set immediately in the UI
    setLocalDate(date);

    try {
      socket?.emit(
        SocketEvents.TASK_END_DATE_CHANGE.toString(),
        JSON.stringify({
          task_id: task.id,
          end_date: date ? date.format('YYYY-MM-DD') : null,
          parent_task: task.parent_task_id,
          time_zone: getUserSession()?.timezone_name
            ? getUserSession()?.timezone_name
            : Intl.DateTimeFormat().resolvedOptions().timeZone,
        })
      );
    } catch (error) {
      logger.error('Failed to update due date:', error);
    }
  };

  const disabledEndDate = (current: Dayjs) => {
    return current && startDayjs ? current < startDayjs : false;
  };

  return (
    <DatePicker
      placeholder="Set Date"
      value={localDate}
      format={'MMM DD, YYYY'}
      suffixIcon={null}
      allowClear
      onChange={handleEndDateChange}
      disabledDate={disabledEndDate}
      style={{
        backgroundColor: colors.transparent,
        border: 'none',
        boxShadow: 'none',
      }}
    />
  );
};

export default TaskListDueDateCell;
