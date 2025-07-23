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
  const dueDayjs = task.end_date ? dayjs(task.end_date) : null;
  const startDayjs = task.start_date ? dayjs(task.start_date) : null;

  const handleEndDateChange = (date: Dayjs | null) => {
    try {
      socket?.emit(
        SocketEvents.TASK_END_DATE_CHANGE.toString(),
        JSON.stringify({
          task_id: task.id,
          end_date: date?.format('YYYY-MM-DD'),
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
      value={dueDayjs}
      format={'MMM DD, YYYY'}
      suffixIcon={null}
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
