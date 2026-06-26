import { useState, useCallback } from 'react';
import {
  Flex,
  DatePicker,
  Typography,
  Button,
  Form,
  FormInstance,
  TimePicker,
} from '@/shared/antd-imports';
import { TFunction } from 'i18next';
import dayjs, { Dayjs } from 'dayjs';

import { SocketEvents } from '@/shared/socket-events';
import { useSocket } from '@/socket/socketContext';
import { colors } from '@/styles/colors';
import logger from '@/utils/errorLogger';

import { getUserSession } from '@/utils/session-helper';
import { ITaskViewModel } from '@/types/tasks/task.types';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  setStartDate,
  setTaskEndDate,
  setTaskDueTime,
} from '@/features/task-drawer/task-drawer.slice';
import {
  updateEnhancedKanbanTaskStartDate,
  updateEnhancedKanbanTaskEndDate,
} from '@/features/enhanced-kanban/enhanced-kanban.slice';
import useTabSearchParam from '@/hooks/useTabSearchParam';
import { updateTask } from '@/features/task-management/task-management.slice';
import { store } from '@/app/store';
interface TaskDrawerDueDateProps {
  task: ITaskViewModel;
  t: TFunction;
  form: FormInstance;
}

const TaskDrawerDueDate = ({ task, t, form }: TaskDrawerDueDateProps) => {
  const { socket } = useSocket();
  const [isShowStartDate, setIsShowStartDate] = useState(false);
  const dispatch = useAppDispatch();
  const { tab } = useTabSearchParam();
  // Date handling
  const startDayjs = task?.start_date ? dayjs(task.start_date, 'YYYY-MM-DD') : null;
  const dueDayjs = task?.end_date ? dayjs(task.end_date, 'YYYY-MM-DD') : null;
  const isValidStartDate = startDayjs?.isValid();
  const isValidDueDate = dueDayjs?.isValid();

  // Date validation
  const disabledStartDate = (current: Dayjs) => {
    if (isValidDueDate && current && dueDayjs && current > dueDayjs) {
      return true;
    }
    return false;
  };

  const disabledEndDate = (current: Dayjs) => {
    if (!isShowStartDate || !isValidStartDate) {
      return current && current < dayjs().startOf('day');
    }
    return current && startDayjs && current < startDayjs;
  };

  const handleStartDateChange = (date: Dayjs | null) => {
    try {
      socket?.emit(
        SocketEvents.TASK_START_DATE_CHANGE.toString(),
        JSON.stringify({
          task_id: task.id,
          start_date: date?.format('YYYY-MM-DD'),
          parent_task: task.parent_task_id,
          time_zone: getUserSession()?.timezone_name
            ? getUserSession()?.timezone_name
            : Intl.DateTimeFormat().resolvedOptions().timeZone,
        })
      );
      socket?.once(SocketEvents.TASK_START_DATE_CHANGE.toString(), (data: IProjectTask) => {
        dispatch(setStartDate(data));

        // Also update enhanced kanban if on board tab
        if (tab === 'board') {
          dispatch(updateEnhancedKanbanTaskStartDate({ task: data }));
        }
      });
    } catch (error) {
      logger.error('Failed to update start date:', error);
    }
  };

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
      socket?.once(SocketEvents.TASK_END_DATE_CHANGE.toString(), (data: IProjectTask) => {
        dispatch(setTaskEndDate(data));

        // Also update enhanced kanban if on board tab
        if (tab === 'board') {
          dispatch(updateEnhancedKanbanTaskEndDate({ task: data }));
        }
      });
    } catch (error) {
      logger.error('Failed to update due date:', error);
    }
  };

  // Due time handling
  const timeValue = task?.due_time ? dayjs(task.due_time, 'HH:mm') : null;

const handleDueTimeChange = useCallback(
  (_time: dayjs.Dayjs | null, timeString: string | string[]) => {
    try {
      const value = Array.isArray(timeString) ? timeString[0] : timeString;
      const dueTime = value || null;

      // Optimistically update Redux immediately
      dispatch(setTaskDueTime({ id: task.id, due_time: dueTime }));
      const currentTask = store.getState().taskManagement.entities[task.id];
      if (currentTask) {
        dispatch(updateTask({ ...currentTask, due_time: dueTime }));
      }

      socket?.emit(
        SocketEvents.TASK_DUE_TIME_CHANGE.toString(),
        JSON.stringify({ task_id: task.id, due_time: dueTime })
      );

      socket?.once(
        SocketEvents.TASK_DUE_TIME_CHANGE.toString(),
        (data: { id: string; due_time: string | null }) => {
          if (!data) return;
          dispatch(setTaskDueTime({ id: data.id, due_time: data.due_time }));
          const confirmedTask = store.getState().taskManagement.entities[data.id];
          if (confirmedTask) {
            dispatch(updateTask({ ...confirmedTask, due_time: data.due_time }));
          }
        }
      );
    } catch (error) {
      logger.error('Failed to update due time:', error);
    }
  },
  [socket, dispatch, task.id]
);

  return (
    <>
      <Form.Item name="dueDate" label={t('taskInfoTab.details.due-date')}>
        <Flex align="center" gap={8}>
          {isShowStartDate && (
            <>
              <DatePicker
                placeholder={t('taskInfoTab.details.start-date')}
                disabledDate={(current: Dayjs) => disabledStartDate(current) ?? false}
                onChange={handleStartDateChange}
                value={isValidStartDate ? startDayjs : null}
                format={'MMM DD, YYYY'}
                suffixIcon={null}
              />
              <Typography.Text>-</Typography.Text>
            </>
          )}
          <DatePicker
            placeholder={t('taskInfoTab.details.end-date')}
            disabledDate={(current: Dayjs) => disabledEndDate(current) ?? false}
            onChange={handleEndDateChange}
            value={isValidDueDate ? dueDayjs : null}
            format={'MMM DD, YYYY'}
          />

          <Button
            type="text"
            onClick={() => setIsShowStartDate(prev => !prev)}
            style={{ color: isShowStartDate ? 'red' : colors.skyBlue }}
          >
            {isShowStartDate
              ? t('taskInfoTab.details.hide-start-date')
              : t('taskInfoTab.details.show-start-date')}
          </Button>
        </Flex>
      </Form.Item>
      <Form.Item
        name="dueTime"
        label={t('taskInfoTab.details.due-time', { defaultValue: 'Due Time' })}
         getValueProps={() => ({ value: timeValue })}
      >
        <TimePicker
          format="HH:mm"
          onChange={handleDueTimeChange}
          changeOnScroll
          needConfirm={false}
          placeholder={t('taskInfoTab.details.set-due-time', { defaultValue: 'Set due time' })}
          style={{ width: '160px' }}
          allowClear
        />
      </Form.Item>
    </>
  );
};

export default TaskDrawerDueDate;
