import { DatePicker } from '@/shared/antd-imports';
import { colors } from '@/styles/colors';
import dayjs, { Dayjs } from 'dayjs';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { getUserSession } from '@/utils/session-helper';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';

const TaskListStartDateCell = ({ task }: { task: IProjectTask }) => {
  const { socket } = useSocket();
  const startDayjs = task.start_date ? dayjs(task.start_date) : null;
  const dueDayjs = task.end_date ? dayjs(task.end_date) : null;

  const handleStartDateChange = (date: Dayjs | null) => {
    socket?.emit(
      SocketEvents.TASK_START_DATE_CHANGE.toString(),
      JSON.stringify({
        task_id: task.id,
        start_date: date?.format(),
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
      value={startDayjs}
      onChange={handleStartDateChange}
      format={'MMM DD, YYYY'}
      suffixIcon={null}
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
