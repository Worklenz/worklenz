import { useSocket } from '@/socket/socketContext';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { DatePicker } from '@/shared/antd-imports';
import dayjs from 'dayjs';
import calendar from 'dayjs/plugin/calendar';
import { SocketEvents } from '@/shared/socket-events';
import type { Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useEffect, useState, useMemo } from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useGetMyTasksQuery } from '@/api/home-page/home-page.api.service';
import { getUserSession } from '@/utils/session-helper';

// Extend dayjs with the calendar plugin
dayjs.extend(calendar);

type HomeTasksDatePickerProps = {
  record: IProjectTask;
};

const HomeTasksDatePicker = ({ record }: HomeTasksDatePickerProps) => {
  const { socket, connected } = useSocket();
  const { t } = useTranslation('home');
  const { homeTasksConfig } = useAppSelector(state => state.homePageReducer);
  const { refetch } = useGetMyTasksQuery(homeTasksConfig, {
    skip: false,
  });

  // Use useMemo to avoid re-renders when record.end_date is the same
  const initialDate = useMemo(
    () => (record.end_date ? dayjs(record.end_date) : null),
    [record.end_date]
  );

  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(initialDate);

  // Update selected date when record changes
  useEffect(() => {
    setSelectedDate(initialDate);
  }, [initialDate]);

  const handleChangeReceived = (value: any) => {
    refetch();
  };

  useEffect(() => {
    socket?.on(SocketEvents.TASK_END_DATE_CHANGE.toString(), handleChangeReceived);
    socket?.on(SocketEvents.TASK_STATUS_CHANGE.toString(), handleChangeReceived);
    return () => {
      socket?.removeListener(SocketEvents.TASK_END_DATE_CHANGE.toString(), handleChangeReceived);
      socket?.removeListener(SocketEvents.TASK_STATUS_CHANGE.toString(), handleChangeReceived);
    };
  }, [connected]);

  const handleEndDateChanged = (value: Dayjs | null, task: IProjectTask) => {
    setSelectedDate(value);
    if (!task.id) return;

    const body = {
      task_id: task.id,
      end_date: value?.format('YYYY-MM-DD'),
      parent_task: task.parent_task_id,
      time_zone: getUserSession()?.timezone_name
        ? getUserSession()?.timezone_name
        : Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
    socket?.emit(SocketEvents.TASK_END_DATE_CHANGE.toString(), JSON.stringify(body));
  };

  // Function to dynamically format the date based on the calendar rules
  const getFormattedDate = (date: Dayjs | null) => {
    if (!date) return '';

    return date.calendar(null, {
      sameDay: '[Today]',
      nextDay: '[Tomorrow]',
      nextWeek: 'MMM DD',
      lastDay: '[Yesterday]',
      lastWeek: 'MMM DD',
      sameElse: date.year() === dayjs().year() ? 'MMM DD' : 'MMM DD, YYYY',
    });
  };

  return (
    <DatePicker
      allowClear
      disabledDate={
        record.start_date ? current => current.isBefore(dayjs(record.start_date)) : undefined
      }
      placeholder={t('tasks.dueDatePlaceholder')}
      value={selectedDate}
      onChange={value => handleEndDateChanged(value || null, record || null)}
      format={value => getFormattedDate(value)} // Dynamically format the displayed value
      style={{
        color: selectedDate
          ? selectedDate.isSame(dayjs(), 'day') || selectedDate.isSame(dayjs().add(1, 'day'), 'day')
            ? '#52c41a'
            : selectedDate.isAfter(dayjs().add(1, 'day'), 'day')
              ? undefined
              : '#ff4d4f'
          : undefined,
        width: '125px', // Ensure the input takes full width
      }}
      inputReadOnly // Prevent manual input to avoid overflow issues
      variant={'borderless'} // Make the DatePicker borderless
      suffixIcon={null}
    />
  );
};

export default HomeTasksDatePicker;
