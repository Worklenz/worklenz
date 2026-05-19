import { useState, useEffect } from 'react';
import { DatePicker } from '@/shared/antd-imports';
import { colors } from '@/styles/colors';
import dayjs, { Dayjs } from 'dayjs';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { getUserSession } from '@/utils/session-helper';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';

const TaskListStartDateCell = ({ task }: { task: IProjectTask }) => {
  const { socket } = useSocket();
  const dueDayjs = task.end_date ? dayjs(task.end_date, 'YYYY-MM-DD') : null;

  // Local state for optimistic UI — prevents the controlled DatePicker from
  // snapping back to the old value while waiting for the socket round-trip
  const [localDate, setLocalDate] = useState<Dayjs | null>(
    task.start_date ? dayjs(task.start_date, 'YYYY-MM-DD') : null
  );

  // Sync local state when Redux updates the task (e.g. socket response arrives)
  useEffect(() => {
    setLocalDate(task.start_date ? dayjs(task.start_date, 'YYYY-MM-DD') : null);
  }, [task.start_date]);

  const handleStartDateChange = (date: Dayjs | null) => {
    // Optimistic update — clear/set immediately in the UI
    setLocalDate(date);

    socket?.emit(
      SocketEvents.TASK_START_DATE_CHANGE.toString(),
      JSON.stringify({
        task_id: task.id,
        start_date: date ? date.format('YYYY-MM-DD') : null,
        parent_task: task.parent_task_id,
        time_zone: getUserSession()?.timezone_name
          ? getUserSession()?.timezone_name
          : Intl.DateTimeFormat().resolvedOptions().timeZone,
      })
    );
  };

  const disabledStartDate = (current: Dayjs) => {
    return current && dueDayjs ? current > dueDayjs : false;
  };

  return (
    <DatePicker
      placeholder="Set Date"
      value={localDate}
      onChange={handleStartDateChange}
      format={'MMM DD, YYYY'}
      suffixIcon={null}
      allowClear
      disabledDate={disabledStartDate}
      style={{
        backgroundColor: colors.transparent,
        border: 'none',
        boxShadow: 'none',
      }}
    />
  );
};

export default TaskListStartDateCell;
