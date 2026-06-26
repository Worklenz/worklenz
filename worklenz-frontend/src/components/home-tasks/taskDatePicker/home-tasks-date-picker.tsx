import { useSocket } from '@/socket/socketContext';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { DatePicker } from '@/shared/antd-imports';
import dayjs from 'dayjs';
import calendar from 'dayjs/plugin/calendar';
import { SocketEvents } from '@/shared/socket-events';
import type { Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useEffect, useState, useMemo, useRef } from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import homePageApi, { useGetMyTasksQuery } from '@/api/home-page/home-page.api.service';
import { getUserSession } from '@/utils/session-helper';
import { getDueDateStatus, getDueDateColor, getDueDateAriaLabel } from '@/utils/dueDateColorHelper';
import './home-tasks-date-picker.css';

// Extend dayjs with the calendar plugin
dayjs.extend(calendar);

type HomeTasksDatePickerProps = {
  record: IProjectTask;
};

const HomeTasksDatePicker = ({ record }: HomeTasksDatePickerProps) => {
  const { socket, connected } = useSocket();
  const dispatch = useAppDispatch();
  const { t } = useTranslation('home');
  const { homeTasksConfig } = useAppSelector(state => state.homePageReducer);
  const { refetch } = useGetMyTasksQuery(homeTasksConfig, {
    skip: false,
  });

  const wrapperRef = useRef<HTMLDivElement>(null);

  // Use useMemo to avoid re-renders when record.end_date is the same
  const initialDate = useMemo(
    () => (record.end_date ? dayjs(record.end_date, 'YYYY-MM-DD') : null),
    [record.end_date]
  );

  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(initialDate);

  // Update selected date when record changes
  useEffect(() => {
    setSelectedDate(initialDate);
  }, [initialDate]);

  const handleChangeReceived = (value: any) => {
    refetch();
    // Invalidate task counts cache to refresh calendar badges
    dispatch(homePageApi.util.invalidateTags(['taskCounts']));
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

  // Get due date status and color
  const dueDateStatus = useMemo(() => getDueDateStatus(selectedDate), [selectedDate]);
  const dueDateColor = useMemo(() => getDueDateColor(dueDateStatus), [dueDateStatus]);
  const ariaLabel = useMemo(() => getDueDateAriaLabel(dueDateStatus), [dueDateStatus]);

  // Apply color directly to input element after render
  useEffect(() => {
    const applyColor = () => {
      if (wrapperRef.current) {
        const input = wrapperRef.current.querySelector('input');
        if (input) {
          if (dueDateColor) {
            input.style.setProperty('color', dueDateColor, 'important');
          } else {
            input.style.removeProperty('color');
          }
        }
      }
    };

    // Apply immediately
    applyColor();

    // Also apply after a small delay to ensure DOM is ready
    const timer = setTimeout(applyColor, 0);
    return () => clearTimeout(timer);
  }, [dueDateColor, selectedDate]);

  return (
    <div ref={wrapperRef} className="due-date-wrapper" style={{ color: dueDateColor }}>
      <DatePicker
        className="due-date-picker"
        allowClear
        disabledDate={
          record.start_date ? current => current.isBefore(dayjs(record.start_date)) : undefined
        }
        placeholder={t('tasks.dueDatePlaceholder')}
        value={selectedDate}
        onChange={value => handleEndDateChanged(value || null, record || null)}
        format={value => getFormattedDate(value)}
        style={{
          width: '100%',
          color: dueDateColor,
        }}
        inputReadOnly
        variant={'borderless'}
        suffixIcon={null}
        aria-label={ariaLabel || undefined}
      />
    </div>
  );
};

export default HomeTasksDatePicker;
