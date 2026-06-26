import React from 'react';
import { Button, DatePicker, Form, Input, TimePicker, Flex, InputNumber, Segmented } from '@/shared/antd-imports';
import { ClockCircleOutlined } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import dayjs, { Dayjs } from 'dayjs';

import { useAppSelector } from '@/hooks/useAppSelector';
import { themeWiseColor } from '@/utils/themeWiseColor';
import { useAuthService } from '@/hooks/useAuth';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { ITaskAssigneesUpdateResponse } from '@/types/tasks/task-assignee-update-response';
import { ITaskLogViewModel } from '@/types/tasks/task-log-view.types';
import { taskTimeLogsApiService } from '@/api/tasks/task-time-logs.api.service';

interface TimeLogFormProps {
  onCancel: () => void;
  onSubmitSuccess?: () => void;
  initialValues?: ITaskLogViewModel;
  mode?: 'create' | 'edit';
}

type TimeLogInputMode = 'duration' | 'timeRange';

interface TimeLogFormValues {
  date: Dayjs | null;
  startTime: Dayjs | null;
  endTime: Dayjs | null;
  hours: number | null;
  minutes: number | null;
  description?: string;
}

const TimeLogForm = ({
  onCancel,
  onSubmitSuccess,
  initialValues,
  mode = 'create',
}: TimeLogFormProps) => {
  const { t } = useTranslation('task-drawer/task-drawer');
  const currentSession = useAuthService().getCurrentSession();
  const { socket, connected } = useSocket();
  const [form] = Form.useForm();
  const [inputMode, setInputMode] = React.useState<TimeLogInputMode>('duration');
  const [formValues, setFormValues] = React.useState<TimeLogFormValues>({
    date: dayjs(),
    startTime: dayjs().second(0).millisecond(0),
    endTime: dayjs().second(0).millisecond(0).add(30, 'minute'),
    hours: 0,
    minutes: 30,
  });

  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const { taskFormViewModel } = useAppSelector(state => state.taskDrawerReducer);

  const getNowRoundedToMinute = React.useCallback(() => {
    return dayjs().second(0).millisecond(0);
  }, []);

  const getDurationFromRange = React.useCallback((startTime?: Dayjs | null, endTime?: Dayjs | null) => {
    if (!startTime || !endTime || endTime.isBefore(startTime)) {
      return { hours: 0, minutes: 0 };
    }

    const totalMinutes = endTime.diff(startTime, 'minute');
    return {
      hours: Math.floor(totalMinutes / 60),
      minutes: totalMinutes % 60,
    };
  }, []);

  const getRangeFromDuration = React.useCallback(
    (
      dateValue?: Dayjs | null,
      startTimeValue?: Dayjs | null,
      hoursValue?: number | null,
      minutesValue?: number | null
    ) => {
      const safeDate = dateValue || dayjs();
      const safeStartTime = startTimeValue || getNowRoundedToMinute();
      const totalMinutes = Math.max(0, Number(hoursValue || 0) * 60 + Number(minutesValue || 0));
      const normalizedStart = dayjs(safeDate)
        .hour(safeStartTime.hour())
        .minute(safeStartTime.minute())
        .second(0)
        .millisecond(0);

      return {
        startTime: normalizedStart,
        endTime: normalizedStart.add(totalMinutes, 'minute'),
      };
    },
    [getNowRoundedToMinute]
  );

  React.useEffect(() => {
    if (initialValues && mode === 'edit') {
      const createdAt = dayjs(initialValues.created_at);

      const startTime = dayjs(initialValues.start_time || initialValues.created_at);

      let endTime;
      if (initialValues.time_spent) {
        endTime = dayjs(startTime).add(initialValues.time_spent, 'second');
      } else {
        endTime = dayjs(initialValues.end_time || initialValues.created_at);
      }

      const { hours, minutes } = getDurationFromRange(startTime, endTime);

      form.setFieldsValue({
        date: createdAt,
        startTime: startTime,
        endTime: endTime,
        hours,
        minutes,
        description: initialValues.description || '',
      });

      setFormValues({
        date: createdAt,
        startTime: startTime,
        endTime: endTime,
        hours,
        minutes,
        description: initialValues.description || '',
      });
    } else if (mode === 'create') {
      const now = getNowRoundedToMinute();
      const nextHalfHour = now.add(30, 'minute');
      form.setFieldsValue({
        date: dayjs(),
        startTime: now,
        endTime: nextHalfHour,
        hours: 0,
        minutes: 30,
      });
    }
  }, [initialValues, mode, form, getDurationFromRange, getNowRoundedToMinute]);

  const quickAssignMember = (session: any) => {
    if (!taskFormViewModel?.task || !connected) return;

    const body = {
      team_member_id: session.team_member_id,
      project_id: taskFormViewModel?.task?.project_id,
      task_id: taskFormViewModel?.task?.id,
      reporter_id: session?.id,
      mode: 0,
      parent_task: taskFormViewModel?.task?.parent_task_id,
    };
    socket?.emit(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), JSON.stringify(body));
    socket?.once(
      SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(),
      (response: ITaskAssigneesUpdateResponse) => {
        if (session.team_member_id) {
          // TODO: emitTimeLogAssignMember(response);
        }
      }
    );
  };

  const handleModeChange = (nextMode: TimeLogInputMode) => {
    if (nextMode === inputMode) return;

    const currentDate = form.getFieldValue('date') as Dayjs | null;
    const currentStartTime = form.getFieldValue('startTime') as Dayjs | null;
    const currentEndTime = form.getFieldValue('endTime') as Dayjs | null;
    const currentHours = form.getFieldValue('hours') as number | null;
    const currentMinutes = form.getFieldValue('minutes') as number | null;

    if (nextMode === 'duration') {
      const { hours, minutes } = getDurationFromRange(currentStartTime, currentEndTime);
      form.setFieldsValue({ hours, minutes });
      setFormValues(prev => ({ ...prev, hours, minutes }));
    } else {
      const { startTime, endTime } = getRangeFromDuration(
        currentDate,
        currentStartTime,
        currentHours,
        currentMinutes
      );
      form.setFieldsValue({ startTime, endTime });
      setFormValues(prev => ({ ...prev, startTime, endTime }));
    }

    setInputMode(nextMode);
  };

  const createReqBody = (values: TimeLogFormValues) => {
    if (!values.date) return;

    const dateValue = dayjs(values.date);
    const startTimeValue = values.startTime || getNowRoundedToMinute();

    if (inputMode === 'timeRange') {
      if (!values.startTime || !values.endTime) return;

      const formattedStartTime = dayjs(dateValue)
        .hour(values.startTime.hour())
        .minute(values.startTime.minute())
        .second(0)
        .millisecond(0);

      const formattedEndTime = dayjs(dateValue)
        .hour(values.endTime.hour())
        .minute(values.endTime.minute())
        .second(0)
        .millisecond(0);

      const diff = formattedEndTime.diff(formattedStartTime, 'seconds');

      return {
        id: mode === 'edit' && initialValues?.id ? initialValues.id : taskFormViewModel?.task?.id,
        project_id: taskFormViewModel?.task?.project_id as string,
        formatted_start: formattedStartTime.toISOString(),
        seconds_spent: Math.floor(Math.abs(diff)),
        description: values.description,
      };
    }

    const hours = Math.max(0, Number(values.hours || 0));
    const minutes = Math.max(0, Number(values.minutes || 0));
    const secondsSpent = hours * 3600 + minutes * 60;

    const formattedStartTime = dayjs(dateValue)
      .hour(startTimeValue.hour())
      .minute(startTimeValue.minute())
      .second(0)
      .millisecond(0);

    return {
      id: mode === 'edit' && initialValues?.id ? initialValues.id : taskFormViewModel?.task?.id,
      project_id: taskFormViewModel?.task?.project_id as string,
      formatted_start: formattedStartTime.toISOString(),
      seconds_spent: secondsSpent,
      description: values.description,
    };
  };

  const onFinish = async (values: TimeLogFormValues) => {
    const { startTime, endTime } = values;

    if (inputMode === 'timeRange' && startTime && endTime && startTime.isAfter(endTime)) {
      form.setFields([
        {
          name: 'endTime',
          errors: [
            t('taskTimeLogTab.timeLogForm.endTimeAfterStartError', {
              defaultValue: 'End time must be after start time',
            }),
          ],
        },
      ]);
      return;
    }

    if (inputMode === 'duration') {
      const minutes = Number(values.minutes || 0);
      const hours = Number(values.hours || 0);

      if (minutes > 59) {
        form.setFields([
          {
            name: 'minutes',
            errors: [
              t('taskTimeLogTab.timeLogForm.minutesRangeError', {
                defaultValue: 'Minutes must be between 0 and 59',
              }),
            ],
          },
        ]);
        return;
      }

      if (hours * 60 + minutes <= 0) {
        form.setFields([
          {
            name: 'minutes',
            errors: [
              t('taskTimeLogTab.timeLogForm.durationGreaterThanZeroError', {
                defaultValue: 'Duration must be greater than 0 minutes',
              }),
            ],
          },
        ]);
        return;
      }
    }

    if (!currentSession) return;

    const assignees = taskFormViewModel?.task?.assignees as string[];
    if (currentSession && !assignees.includes(currentSession?.team_member_id as string)) {
      quickAssignMember(currentSession);
    }

    const requestBody = createReqBody(values);
    if (!requestBody) return;

    try {
      if (mode === 'edit' && initialValues?.id) {
        console.log('Updating time log:', requestBody);
        await taskTimeLogsApiService.update(initialValues.id, requestBody);
      } else {
        console.log('Creating new time log:', requestBody);
        await taskTimeLogsApiService.create(requestBody);
      }
      console.log('Received values:', values);

      // Call onSubmitSuccess if provided, otherwise just cancel
      if (onSubmitSuccess) {
        onSubmitSuccess();
      } else {
        onCancel();
      }
    } catch (error) {
      console.error('Error saving time log:', error);
    }
  };

  const isFormValid = () => {
    if (!formValues.date) return false;

    if (inputMode === 'timeRange') {
      if (!formValues.startTime || !formValues.endTime) return false;
      return !formValues.startTime.isAfter(formValues.endTime);
    }

    const hours = Number(formValues.hours || 0);
    const minutes = Number(formValues.minutes || 0);
    if (minutes < 0 || minutes > 59 || hours < 0) return false;
    return hours * 60 + minutes > 0;
  };

  return (
    <Flex
      gap={8}
      vertical
      align="center"
      justify="center"
      style={{
        width: '100%',
        position: 'relative',
        height: 'fit-content',
        justifySelf: 'flex-end',
        paddingTop: 16,
        paddingBottom: 0,
        overflow: 'visible',
      }}
    >
      <div
        style={{
          marginBlockEnd: 0,
          height: 1,
          position: 'absolute',
          top: 0,
          width: '100%',
          backgroundColor: themeWiseColor('#ebebeb', '#3a3a3a', themeMode),
        }}
      />

      <Form
        form={form}
        style={{ width: '100%', overflow: 'visible' }}
        layout="vertical"
        onFinish={onFinish}
        onValuesChange={(_, values) => setFormValues(values as TimeLogFormValues)}
      >
        <Form.Item
          label={t('taskTimeLogTab.timeLogForm.inputMode', { defaultValue: 'Input Mode' })}
          style={{ marginBlockEnd: 6 }}
        >
          <Segmented
            size="small"
            value={inputMode}
            onChange={value => handleModeChange(value as TimeLogInputMode)}
            options={[
              {
                label: t('taskTimeLogTab.timeLogForm.durationMode', { defaultValue: 'Duration' }),
                value: 'duration',
              },
              {
                label: t('taskTimeLogTab.timeLogForm.timeRangeMode', { defaultValue: 'Time Range' }),
                value: 'timeRange',
              },
            ]}
            block
          />
        </Form.Item>

        {inputMode === 'duration' ? (
          <Form.Item style={{ marginBlockEnd: 6 }}>
            <Flex gap={8} wrap="wrap" style={{ width: '100%' }}>
              <Form.Item
                name="date"
                label={t('taskTimeLogTab.timeLogForm.date')}
                rules={[
                  {
                    required: true,
                    message: t('taskTimeLogTab.timeLogForm.selectDateError'),
                  },
                ]}
                style={{ flex: 1.4, minWidth: 170, marginBlockEnd: 0 }}
              >
                <DatePicker
                  size="small"
                  style={{ width: '100%' }}
                  disabledDate={current => current && current.toDate() > new Date()}
                />
              </Form.Item>

              <Form.Item
                name="hours"
                label={t('taskTimeLogTab.timeLogForm.hours', { defaultValue: 'Hours' })}
                rules={[
                  {
                    type: 'number',
                    min: 0,
                    message: t('taskTimeLogTab.timeLogForm.hoursMinError', {
                      defaultValue: 'Hours must be 0 or greater',
                    }),
                  },
                ]}
                style={{ flex: 1, minWidth: 120, marginBlockEnd: 0 }}
              >
                <InputNumber size="small" min={0} precision={0} style={{ width: '100%' }} />
              </Form.Item>

              <Form.Item
                name="minutes"
                label={t('taskTimeLogTab.timeLogForm.minutes', { defaultValue: 'Minutes' })}
                rules={[
                  {
                    type: 'number',
                    min: 0,
                    max: 59,
                    message: t('taskTimeLogTab.timeLogForm.minutesRangeError', {
                      defaultValue: 'Minutes must be between 0 and 59',
                    }),
                  },
                ]}
                style={{ flex: 1, minWidth: 120, marginBlockEnd: 0 }}
              >
                <InputNumber size="small" min={0} max={59} precision={0} style={{ width: '100%' }} />
              </Form.Item>
            </Flex>
          </Form.Item>
        ) : (
          <>
            <Form.Item
              name="date"
              label={t('taskTimeLogTab.timeLogForm.date')}
              rules={[
                {
                  required: true,
                  message: t('taskTimeLogTab.timeLogForm.selectDateError'),
                },
              ]}
            >
              <DatePicker
                size="small"
                style={{ width: '100%' }}
                disabledDate={current => current && current.toDate() > new Date()}
              />
            </Form.Item>

            <Form.Item style={{ marginBlockEnd: 6 }}>
            <Flex gap={8} wrap="wrap" style={{ width: '100%' }}>
              <Form.Item
                name="startTime"
                label={t('taskTimeLogTab.timeLogForm.startTime')}
                rules={[
                  {
                    required: true,
                    message: t('taskTimeLogTab.timeLogForm.selectStartTimeError'),
                  },
                ]}
                style={{ flex: 1, minWidth: 140, marginBlockEnd: 0 }}
              >
                <TimePicker size="small" format="HH:mm" style={{ width: '100%' }} />
              </Form.Item>

              <Form.Item
                name="endTime"
                label={t('taskTimeLogTab.timeLogForm.endTime')}
                rules={[
                  {
                    required: true,
                    message: t('taskTimeLogTab.timeLogForm.selectEndTimeError'),
                  },
                ]}
                style={{ flex: 1, minWidth: 140, marginBlockEnd: 0 }}
              >
                <TimePicker size="small" format="HH:mm" style={{ width: '100%' }} />
              </Form.Item>
            </Flex>
            </Form.Item>
          </>
        )}

        <Form.Item
          name="description"
          label={t('taskTimeLogTab.timeLogForm.workDescription')}
          style={{ marginBlockEnd: 10 }}
        >
          <Input.TextArea
            placeholder={t('taskTimeLogTab.timeLogForm.descriptionPlaceholder')}
            maxLength={500}
            showCount
            autoSize={{ minRows: 2, maxRows: 6 }}
          />
        </Form.Item>

        <Form.Item style={{ marginBlockEnd: 0 }}>
          <Flex gap={8}>
            <Button onClick={onCancel}>{t('taskTimeLogTab.timeLogForm.cancel')}</Button>
            <Button
              type="primary"
              icon={<ClockCircleOutlined />}
              disabled={!isFormValid()}
              htmlType="submit"
            >
              {mode === 'edit'
                ? t('taskTimeLogTab.timeLogForm.updateTime')
                : t('taskTimeLogTab.timeLogForm.logTime')}
            </Button>
          </Flex>
        </Form.Item>
      </Form>
    </Flex>
  );
};

export default TimeLogForm;
