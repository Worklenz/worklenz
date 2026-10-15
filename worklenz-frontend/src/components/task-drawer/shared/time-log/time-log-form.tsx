import React from 'react';
import { Button, DatePicker, Form, Input, TimePicker, Flex, InputNumber, Segmented, Tag, Alert } from '@/shared/antd-imports';
import { ClockCircleOutlined, InfoCircleOutlined } from '@/shared/antd-imports';

import dayjs, { Dayjs } from 'dayjs';

import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { fetchOrgConfig } from '@/features/org-config/org-config.slice';
import { themeWiseColor } from '@/utils/themeWiseColor';
import { useAuthService } from '@/hooks/useAuth';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { ITaskAssigneesUpdateResponse } from '@/types/tasks/task-assignee-update-response';
import { ITaskLogViewModel } from '@/types/tasks/task-log-view.types';
import { Select, Spin, Tooltip } from '@/shared/antd-imports';
import { taskTimeLogsApiService, IRecentProject, ITaskInProject } from '@/api/tasks/task-time-logs.api.service';
import apiClient from '@/api/api-client';
import { API_BASE_URL } from '@/shared/constants';
import { useTranslation } from 'react-i18next';


/**
 * TimeLogForm provides time tracking entry input in either duration mode (hours + minutes)
 * or time-range mode (start date & time, end date & time).
 * 
 * Supports overnight entries across midnight where the end date falls on a later calendar day
 * than the start date.
 */
interface TimeLogFormProps {
  onCancel: () => void;
  onSubmitSuccess?: () => void;
  initialValues?: ITaskLogViewModel;
  mode?: 'create' | 'edit';
  taskId?: string;
  projectId?: string;
  allowReassign?: boolean;  // Allow the form to reassign the log to a different task/project in edit mode
  /** Save edits through the Time Entries endpoint (owners/admins may edit other members' entries).
   * Only the Time Entries page sets this; the task drawer leaves it off and keeps its author-only route. */
  asTimeEntry?: boolean;
  /** Rendered inside a dialog: drops the divider/top padding that separate the inline form from the
   * content above it, uses regular-size controls, and right-aligns the buttons like a modal footer. */
  inModal?: boolean;
}

type TimeLogInputMode = 'duration' | 'timeRange';

interface TimeLogFormValues {
  date: Dayjs | null;
  startDate?: Dayjs | null;
  endDate?: Dayjs | null;
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
  taskId: taskIdProp,
  projectId: projectIdProp,
  allowReassign = false,
  asTimeEntry = false,
  inModal = false,

}: TimeLogFormProps) => {
  const { t } = useTranslation('task-drawer/task-drawer');
  const controlSize = inModal ? 'middle' : 'small';
  const currentSession = useAuthService().getCurrentSession();
  const { socket, connected } = useSocket();
  const [form] = Form.useForm();
  // Edit opens in time-range so the saved start/end are visible immediately.
  // Duration mode unmounts those fields; switching back was falling back to "now".
  const [inputMode, setInputMode] = React.useState<TimeLogInputMode>(
    mode === 'edit' ? 'timeRange' : 'duration'
  );
  // Tracks whether the "auto-clear minutes from 30→0 on first hours entry" has
  // already fired for the current form session. Reset whenever the form resets.
  const minutesAutoClearedRef = React.useRef(false);
  const [submitting, setSubmitting] = React.useState(false);

  // Reassign state — only used when allowReassign=true and mode=edit
  const [reassignProjects, setReassignProjects] = React.useState<IRecentProject[]>([]);
  const [reassignProjectSearch, setReassignProjectSearch] = React.useState('');
  const [reassignProjectSearchResults, setReassignProjectSearchResults] = React.useState<IRecentProject[]>([]);
  const [reassignProjectLoading, setReassignProjectLoading] = React.useState(false);
  const [selectedReassignProject, setSelectedReassignProject] = React.useState<IRecentProject | null>(null);
  const [reassignTasks, setReassignTasks] = React.useState<ITaskInProject[]>([]);
  const [reassignTaskSearch, setReassignTaskSearch] = React.useState('');
  const [reassignTaskLoading, setReassignTaskLoading] = React.useState(false);
  const [selectedReassignTaskId, setSelectedReassignTaskId] = React.useState<string | null>(null);
  const reassignProjectSearchTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const reassignTaskSearchTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);


  const [formValues, setFormValues] = React.useState<TimeLogFormValues>({
    date: dayjs(),
    startTime: dayjs().second(0).millisecond(0),
    endTime: dayjs().second(0).millisecond(0).add(30, 'minute'),
    hours: 0,
    minutes: 30,
  });

  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const { taskFormViewModel } = useAppSelector(state => state.taskDrawerReducer);

  const dispatch = useAppDispatch();
  const backdateLimitDays = useAppSelector(
    state => state.orgConfigReducer.timelog_backdate_limit_days
  );
  const orgConfigInitialized = useAppSelector(state => state.orgConfigReducer.isInitialized);
  const orgConfigLoading = useAppSelector(state => state.orgConfigReducer.isLoading);

  // The form is reachable outside the settings page, so pull the org config in
  // on first use. Once initialized the store keeps it for the rest of the session.
  React.useEffect(() => {
    if (orgConfigInitialized || orgConfigLoading) return;
    void dispatch(fetchOrgConfig());
  }, [dispatch, orgConfigInitialized, orgConfigLoading]);

  // Earliest date a log may carry, or null when the org sets no limit.
  const minLogDate = React.useMemo(() => {
    if (!backdateLimitDays || backdateLimitDays <= 0) return null;
    return dayjs().startOf('day').subtract(backdateLimitDays, 'day');
  }, [backdateLimitDays]);

  // In edit mode the log's own date must stay selectable even once it ages past
  // the limit, so description/duration edits remain possible. The backend applies
  // the same exemption for an unchanged date.
  const originalLogDate = React.useMemo(() => {
    if (mode !== 'edit' || !initialValues?.created_at) return null;
    return dayjs(initialValues.created_at).startOf('day');
  }, [mode, initialValues?.created_at]);

  const isDateDisabled = React.useCallback(
    (current: Dayjs) => {
      if (!current) return false;
      // Allow future dates. Only enforce organization backdate limits for past dates.
      if (!minLogDate) return false;
      if (originalLogDate && current.isSame(originalLogDate, 'day')) return false;
      return current.isBefore(minLogDate, 'day');
    },
    [minLogDate, originalLogDate]
  );

  const getNowRoundedToMinute = React.useCallback(() => {
    return dayjs().second(0).millisecond(0);
  }, []);

  const getDurationFromRange = React.useCallback(
    (
      dateValue?: Dayjs | null,
      startTimeValue?: Dayjs | null,
      endTimeValue?: Dayjs | null
    ) => {
      if (!startTimeValue || !endTimeValue) {
        return { hours: 0, minutes: 0 };
      }

      const base = dateValue || dayjs();

      const fullStart = dayjs(base)
        .hour(startTimeValue.hour())
        .minute(startTimeValue.minute())
        .second(0)
        .millisecond(0);

      let fullEnd = dayjs(base)
        .hour(endTimeValue.hour())
        .minute(endTimeValue.minute())
        .second(0)
        .millisecond(0);

      // If end time is before start time, it rolls over to next day
      if (fullEnd.isBefore(fullStart)) {
        fullEnd = fullEnd.add(1, 'day');
      }

      const totalMinutes = fullEnd.diff(fullStart, 'minute');
      return {
        hours: Math.floor(totalMinutes / 60),
        minutes: totalMinutes % 60,
      };
    },
    []
  );

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

      const normalizedEnd = normalizedStart.add(totalMinutes, 'minute');

      return {
        date: dayjs(normalizedStart).startOf('day'),
        startTime: normalizedStart,
        endTime: normalizedEnd,
      };
    },
    [getNowRoundedToMinute]
  );

  React.useEffect(() => {
    if (initialValues && mode === 'edit') {
      const createdAt = dayjs(initialValues.created_at);
      const startTime = dayjs(initialValues.start_time || initialValues.created_at);

      let endTime: Dayjs;
      if (initialValues.end_time) {
        endTime = dayjs(initialValues.end_time);
      } else if (initialValues.time_spent) {
        endTime = dayjs(startTime).add(Number(initialValues.time_spent), 'second');
      } else {
        endTime = dayjs(initialValues.created_at);
      }

      const logDate = dayjs(startTime).startOf('day');
      const { hours, minutes } = getDurationFromRange(logDate, startTime, endTime);
      const nextValues: TimeLogFormValues = {
        date: logDate,
        startTime,
        endTime,
        hours,
        minutes,
        description: initialValues.description || '',
      };

      setInputMode('timeRange');
      form.setFieldsValue(nextValues);
      setFormValues(nextValues);
    } else if (mode === 'create') {
      minutesAutoClearedRef.current = false;
      const now = getNowRoundedToMinute();
      const nextHalfHour = now.add(30, 'minute');
      const today = dayjs().startOf('day');
      setInputMode('duration');
      form.setFieldsValue({
        date: today,
        startTime: now,
        endTime: nextHalfHour,
        hours: 0,
        minutes: 30,
      });
    }
  }, [initialValues, mode, form, getDurationFromRange, getNowRoundedToMinute]);

  // Load recent projects when reassign is enabled
  React.useEffect(() => {
    if (!allowReassign || mode !== 'edit') return;
    setSelectedReassignProject(null);
    setSelectedReassignTaskId(null);
    setReassignTasks([]);
    setReassignProjectSearch('');
    setReassignProjectSearchResults([]);
    taskTimeLogsApiService.getMyRecentProjects().then(res => {
      if (res.done) setReassignProjects(res.body as IRecentProject[]);
    });
  }, [allowReassign, mode, initialValues?.id]);

  // Search projects for reassign
  React.useEffect(() => {
    if (!allowReassign) return;
    if (reassignProjectSearchTimer.current) clearTimeout(reassignProjectSearchTimer.current);
    if (!reassignProjectSearch.trim()) {
      setReassignProjectSearchResults([]);
      return;
    }
    reassignProjectSearchTimer.current = setTimeout(async () => {
      setReassignProjectLoading(true);
      try {
        const res = await apiClient.get(`${API_BASE_URL}/projects/my-task-projects`);
        const list: any[] = res.data?.body || [];
        const q = reassignProjectSearch.toLowerCase();
        setReassignProjectSearchResults(
          list
            .filter((p: any) => p.name?.toLowerCase().includes(q))
            .map((p: any) => ({ id: p.id, name: p.name, color_code: p.color_code }))
        );
      } catch {
        setReassignProjectSearchResults([]);
      } finally {
        setReassignProjectLoading(false);
      }
    }, 300);
  }, [reassignProjectSearch, allowReassign]);

  // Load tasks when reassign project is selected
  React.useEffect(() => {
    if (!selectedReassignProject) return;
    if (reassignTaskSearchTimer.current) clearTimeout(reassignTaskSearchTimer.current);
    reassignTaskSearchTimer.current = setTimeout(async () => {
      setReassignTaskLoading(true);
      try {
        const res = await taskTimeLogsApiService.getMyTasksInProject(
          selectedReassignProject.id,
          reassignTaskSearch || undefined
        );
        if (res.done) setReassignTasks(res.body as ITaskInProject[]);
      } catch {
        setReassignTasks([]);
      } finally {
        setReassignTaskLoading(false);
      }
    }, 200);
  }, [selectedReassignProject, reassignTaskSearch]);


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

    // Prefer form store, then React state, then the log being edited.
    const currentDate =
      (form.getFieldValue('date') as Dayjs | null) ||
      formValues.date;
    const currentStartTime =
      (form.getFieldValue('startTime') as Dayjs | null) ||
      formValues.startTime ||
      (initialValues?.start_time ? dayjs(initialValues.start_time) : null);
    const currentEndTime =
      (form.getFieldValue('endTime') as Dayjs | null) ||
      formValues.endTime ||
      (initialValues?.end_time ? dayjs(initialValues.end_time) : null);
    const currentHours =
      (form.getFieldValue('hours') as number | null) ?? formValues.hours;
    const currentMinutes =
      (form.getFieldValue('minutes') as number | null) ?? formValues.minutes;

    if (nextMode === 'duration') {
      const { hours, minutes } = getDurationFromRange(
        currentDate,
        currentStartTime,
        currentEndTime
      );
      form.setFieldsValue({
        date: currentDate,
        hours,
        minutes,
      });
      setFormValues(prev => ({
        ...prev,
        date: currentDate,
        hours,
        minutes,
      }));
    } else {
      const { date, startTime, endTime } = getRangeFromDuration(
        currentDate,
        currentStartTime,
        currentHours,
        currentMinutes
      );
      form.setFieldsValue({ date, startTime, endTime });
      setFormValues(prev => ({ ...prev, date, startTime, endTime }));
    }

    setInputMode(nextMode);
  };

  const createReqBody = (values: TimeLogFormValues) => {
    const dateValue = values.date;
    if (!dateValue) return;

    const startTimeValue = values.startTime || getNowRoundedToMinute();

    if (inputMode === 'timeRange') {
      if (!values.startTime || !values.endTime) return;

      const formattedStartTime = dayjs(dateValue)
        .hour(values.startTime.hour())
        .minute(values.startTime.minute())
        .second(0)
        .millisecond(0);

      let formattedEndTime = dayjs(dateValue)
        .hour(values.endTime.hour())
        .minute(values.endTime.minute())
        .second(0)
        .millisecond(0);

      // If end time is before start time, it rolls over to next day
      if (formattedEndTime.isBefore(formattedStartTime)) {
        formattedEndTime = formattedEndTime.add(1, 'day');
      }

      const diff = formattedEndTime.diff(formattedStartTime, 'seconds');

      return {
        id: mode === 'edit' && initialValues?.id ? initialValues.id : (taskIdProp ?? taskFormViewModel?.task?.id),
        project_id: (projectIdProp ?? taskFormViewModel?.task?.project_id ?? (initialValues as any)?.project_id) as string,
        formatted_start: formattedStartTime.toISOString(),
        seconds_spent: Math.max(0, Math.floor(diff)),
        description: values.description,
        // Only include new_task_id if user explicitly selected a different task
        ...(mode === 'edit' && selectedReassignTaskId ? { new_task_id: selectedReassignTaskId } : {}),
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
      id: mode === 'edit' && initialValues?.id ? initialValues.id : (taskIdProp ?? taskFormViewModel?.task?.id),
      project_id: (projectIdProp ?? taskFormViewModel?.task?.project_id ?? (initialValues as any)?.project_id) as string,
      formatted_start: formattedStartTime.toISOString(),
      seconds_spent: secondsSpent,
      description: values.description,
      // Only include new_task_id if user explicitly selected a different task
      ...(mode === 'edit' && selectedReassignTaskId ? { new_task_id: selectedReassignTaskId } : {}),
    };
  };

  const onFinish = async (values: TimeLogFormValues) => {
    const { date, startTime, endTime } = values;

    if (!date) {
      form.setFields([
        {
          name: 'date',
          errors: [
            t('taskTimeLogTab.timeLogForm.selectDateError', {
              defaultValue: 'Please select date',
            }),
          ],
        },
      ]);
      return;
    }

    if (inputMode === 'timeRange') {
      if (!startTime) {
        form.setFields([
          {
            name: 'startTime',
            errors: [
              t('taskTimeLogTab.timeLogForm.selectStartTimeError', {
                defaultValue: 'Please select start time',
              }),
            ],
          },
        ]);
        return;
      }

      if (!endTime) {
        form.setFields([
          {
            name: 'endTime',
            errors: [
              t('taskTimeLogTab.timeLogForm.selectEndTimeError', {
                defaultValue: 'Please select end time',
              }),
            ],
          },
        ]);
        return;
      }

      const fullStart = dayjs(date)
        .hour(startTime.hour())
        .minute(startTime.minute())
        .second(0)
        .millisecond(0);
      let fullEnd = dayjs(date)
        .hour(endTime.hour())
        .minute(endTime.minute())
        .second(0)
        .millisecond(0);

      if (fullEnd.isBefore(fullStart)) {
        fullEnd = fullEnd.add(1, 'day');
      }

      const diffMinutes = fullEnd.diff(fullStart, 'minute');
      if (diffMinutes <= 0) {
        form.setFields([
          {
            name: 'endTime',
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

    const assignees = taskFormViewModel?.task?.assignees as string[] | undefined;
    if (assignees && !assignees.includes(currentSession?.team_member_id as string)) {
      quickAssignMember(currentSession);
    }

    // Client-side mirror of the org backdate limit, so the user sees the problem
    // before a round trip. The server enforces the same rule regardless.
    const activeDate = values.date;
    if (
      minLogDate &&
      activeDate &&
      activeDate.isBefore(minLogDate, 'day') &&
      !(originalLogDate && activeDate.isSame(originalLogDate, 'day'))
    ) {
      form.setFields([
        {
          name: 'date',
          errors: [
            t('taskTimeLogTab.timeLogForm.backdateLimitError', {
              days: backdateLimitDays,
              earliestDate: minLogDate.format('MMM DD, YYYY'),
              defaultValue:
                'Time logs cannot be backdated more than {{days}} days. The earliest date you can log against is {{earliestDate}}.',
            }),
          ],
        },
      ]);
      return;
    }

    const requestBody = createReqBody(values);
    if (!requestBody) return;

    setSubmitting(true);
    try {
      if (mode === 'edit' && initialValues?.id) {
        await (asTimeEntry
          ? taskTimeLogsApiService.updateEntry(initialValues.id, requestBody)
          : taskTimeLogsApiService.update(initialValues.id, requestBody));
      } else {
        await taskTimeLogsApiService.create(requestBody);
      }

      // Call onSubmitSuccess if provided, otherwise just cancel
      if (onSubmitSuccess) {
        onSubmitSuccess();
      } else {
        onCancel();
      }
    } catch (error: any) {
      const serverMessage = error?.response?.data?.message;
      form.setFields([
        {
          name: 'date',
          errors: [
            serverMessage ||
              t('taskTimeLogTab.timeLogForm.saveError', {
                defaultValue: 'Could not save the time log. Please try again.',
              }),
          ],
        },
      ]);
    } finally {
      setSubmitting(false);
    }
  };

  const isFormValid = () => {
    if (!formValues.date) return false;

    if (inputMode === 'timeRange') {
      if (!formValues.startTime || !formValues.endTime) return false;

      const fullStart = dayjs(formValues.date)
        .hour(formValues.startTime.hour())
        .minute(formValues.startTime.minute())
        .second(0)
        .millisecond(0);
      let fullEnd = dayjs(formValues.date)
        .hour(formValues.endTime.hour())
        .minute(formValues.endTime.minute())
        .second(0)
        .millisecond(0);

      if (fullEnd.isBefore(fullStart)) {
        fullEnd = fullEnd.add(1, 'day');
      }

      return fullEnd.diff(fullStart, 'minute') > 0;
    }

    const hours = Number(formValues.hours || 0);
    const minutes = Number(formValues.minutes || 0);
    if (minutes < 0 || minutes > 59 || hours < 0) return false;
    return hours * 60 + minutes > 0;
  };

  // Live calculation of duration and multi-day status for UI summary feedback
  const activeDurationInfo = React.useMemo(() => {
    if (inputMode === 'duration') {
      const h = Number(formValues.hours || 0);
      const m = Number(formValues.minutes || 0);
      const totalMins = h * 60 + m;
      return {
        hours: h,
        minutes: m,
        totalMinutes: totalMins,
        isOvernight: false,
        daySpan: 0,
        exceedsDay: totalMins > 24 * 60,
      };
    }

    if (!formValues.date || !formValues.startTime || !formValues.endTime) {
      return { hours: 0, minutes: 0, totalMinutes: 0, isOvernight: false, daySpan: 0, exceedsDay: false };
    }

    const fullStart = dayjs(formValues.date)
      .hour(formValues.startTime.hour())
      .minute(formValues.startTime.minute())
      .second(0)
      .millisecond(0);
    let fullEnd = dayjs(formValues.date)
      .hour(formValues.endTime.hour())
      .minute(formValues.endTime.minute())
      .second(0)
      .millisecond(0);

    const isOvernight = fullEnd.isBefore(fullStart);
    if (isOvernight) {
      fullEnd = fullEnd.add(1, 'day');
    }

    const totalMinutes = fullEnd.diff(fullStart, 'minute');

    return {
      hours: Math.floor(totalMinutes / 60),
      minutes: totalMinutes % 60,
      totalMinutes,
      isOvernight,
      daySpan: isOvernight ? 1 : 0,
      exceedsDay: totalMinutes > 24 * 60,
    };
  }, [inputMode, formValues]);

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
        paddingTop: inModal ? 0 : 16,
        paddingBottom: 0,
        overflow: 'visible',
      }}
    >
      {!inModal && (
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
      )}

      <Form
        form={form}
        style={{ width: '100%', overflow: 'visible' }}
        layout="vertical"
        onFinish={onFinish}
        onValuesChange={(changedValues, values) => {
          // The first time the user enters any value in the hours field (including
          // typing digit-by-digit), auto-clear the default 30-minute suggestion.
          // We use a ref so this fires exactly once per form session regardless of
          // whether the user types or uses the spinner arrows. Only clear if minutes
          // is still at its untouched default — otherwise this would stomp a minutes
          // value the user already entered themselves (e.g. entering "45" then "1"
          // to mean 1h45m).
          if (
            'hours' in changedValues &&
            !minutesAutoClearedRef.current &&
            (values as TimeLogFormValues).minutes === 30
          ) {
            const incoming = Number(changedValues.hours);
            if (!isNaN(incoming) && incoming > 0) {
              minutesAutoClearedRef.current = true;
              form.setFieldsValue({ minutes: 0 });
              setFormValues({ ...(values as TimeLogFormValues), minutes: 0 });
              return;
            }
          }
          setFormValues({ ...values } as TimeLogFormValues);
        }}
      >
        <Form.Item
          label={t('taskTimeLogTab.timeLogForm.inputMode', { defaultValue: 'Input Mode' })}
          style={{ marginBlockEnd: 6 }}
        >
          <Segmented
            size={controlSize}
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
                  size={controlSize}
                  style={{ width: '100%' }}
                  disabledDate={isDateDisabled}
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
                <InputNumber size={controlSize} min={0} precision={0} style={{ width: '100%' }} />
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
                <InputNumber size={controlSize} min={0} max={59} precision={0} style={{ width: '100%' }} />
              </Form.Item>
            </Flex>
          </Form.Item>
        ) : (
          <>
            <Form.Item
              name="date"
              label={t('taskTimeLogTab.timeLogForm.date', { defaultValue: 'Date' })}
              rules={[
                {
                  required: true,
                  message: t('taskTimeLogTab.timeLogForm.selectDateError', {
                    defaultValue: 'Please select date',
                  }),
                },
              ]}
              style={{ marginBlockEnd: 6 }}
            >
              <DatePicker
                size={controlSize}
                style={{ width: '100%' }}
                disabledDate={isDateDisabled}
              />
            </Form.Item>

            <Form.Item style={{ marginBlockEnd: 6 }}>
              <Flex gap={8} style={{ width: '100%' }}>
                <Form.Item
                  name="startTime"
                  label={t('taskTimeLogTab.timeLogForm.startTime', { defaultValue: 'Start Time' })}
                  rules={[
                    {
                      required: true,
                      message: t('taskTimeLogTab.timeLogForm.selectStartTimeError', {
                        defaultValue: 'Please select start time',
                      }),
                    },
                  ]}
                  style={{ flex: 1, minWidth: 120, marginBlockEnd: 0 }}
                >
                  <TimePicker size={controlSize} format="HH:mm" style={{ width: '100%' }} />
                </Form.Item>

                <Form.Item
                  name="endTime"
                  label={t('taskTimeLogTab.timeLogForm.endTime', { defaultValue: 'End Time' })}
                  rules={[
                    {
                      required: true,
                      message: t('taskTimeLogTab.timeLogForm.selectEndTimeError', {
                        defaultValue: 'Please select end time',
                      }),
                    },
                  ]}
                  style={{ flex: 1, minWidth: 120, marginBlockEnd: 0 }}
                >
                  <TimePicker
                    size={controlSize}
                    format="HH:mm"
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Flex>
            </Form.Item>
          </>
        )}

        {/* Reassign to different task — edit mode only */}
        {allowReassign && mode === 'edit' && (
          <>
            <Form.Item
              label={
                <span>
                  {t('taskTimeLogTab.timeLogForm.moveToProject', { defaultValue: 'Move to Project' })}
                  <Tooltip title={t('taskTimeLogTab.timeLogForm.moveToProjectTooltip', { defaultValue: 'Reassign this time log to a different project' })}>
                    <InfoCircleOutlined style={{ marginLeft: 6, color: '#8c8c8c', fontSize: 13 }} />
                  </Tooltip>

                </span>
              }

              style={{ marginBlockEnd: 6 }}
            >


              <Select
                showSearch
                allowClear
                placeholder={t('taskTimeLogTab.timeLogForm.selectProject', { defaultValue: 'Search project...' })}
                filterOption={false}
                loading={reassignProjectLoading}
                onFocus={() => {
                  setReassignProjectSearch('');
                  setReassignProjectSearchResults([]);
                }}
                onSearch={val => setReassignProjectSearch(val)}
                onChange={(val: string | undefined) => {
                  if (!val) {
                    setSelectedReassignProject(null);
                    setSelectedReassignTaskId(null);
                    setReassignTasks([]);
                    return;
                  }
                  const found =
                    reassignProjectSearchResults.find(p => p.id === val) ||
                    reassignProjects.find(p => p.id === val) ||
                    null;
                  setSelectedReassignProject(found);
                  setReassignProjectSearch('');

                  setSelectedReassignTaskId(null);
                  setReassignTasks([]);
                }}
                size={controlSize}
                style={{ width: '100%' }}
                notFoundContent={reassignProjectLoading ? <Spin size="small" /> : null}
                options={reassignProjectSearchResults.map(p => ({ value: p.id, label: p.name }))}

              />
            </Form.Item>

            {selectedReassignProject && (
              <Form.Item
                label={
                  <span>
                    {t('taskTimeLogTab.timeLogForm.moveToTask', { defaultValue: 'Move to Task' })}
                    <Tooltip title={t('taskTimeLogTab.timeLogForm.moveToTaskTooltip', { defaultValue: 'Reassign this time log to a different task' })}>
                      <InfoCircleOutlined style={{ marginLeft: 6, color: '#8c8c8c', fontSize: 13 }} />
                    </Tooltip>

                  </span>
                }

                style={{ marginBlockEnd: 10 }}
              >

                <Select
                  showSearch
                  allowClear
                  placeholder={t('taskTimeLogTab.timeLogForm.selectTask', { defaultValue: 'Select task...' })}
                  filterOption={false}
                  loading={reassignTaskLoading}
                  onSearch={val => setReassignTaskSearch(val)}
                  onChange={(val: string | undefined) => setSelectedReassignTaskId(val || null)}
                  size={controlSize}
                  style={{ width: '100%' }}
                  notFoundContent={reassignTaskLoading ? <Spin size="small" /> : null}
                  options={reassignTasks.map(task => ({ value: task.id, label: task.name }))}
                />
              </Form.Item>
            )}
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
        {/* Live duration summary (pure hours and minutes like Clockify/Toggl, no overnight/OT badges) */}
        {activeDurationInfo.totalMinutes > 0 && (
          <div style={{ marginBlockEnd: 10, width: '100%' }}>
            <Flex align="center" gap={6}>
              <Tag color="blue" icon={<ClockCircleOutlined />}>
                {t('taskTimeLogTab.timeLogForm.totalDurationBadge', {
                  duration: `${activeDurationInfo.hours}h ${activeDurationInfo.minutes}m`,
                  defaultValue: `Total: ${activeDurationInfo.hours}h ${activeDurationInfo.minutes}m`,
                })}
              </Tag>
            </Flex>

            {activeDurationInfo.exceedsDay && (
              <Alert
                type="warning"
                showIcon
                style={{ marginTop: 8 }}
                message={t('taskTimeLogTab.timeLogForm.durationExceedsDayWarning', {
                  defaultValue: 'This session exceeds 24 hours. Please verify the start and end dates.',
                })}
              />
            )}
          </div>
        )}

        <Form.Item style={{ marginBlockEnd: 0 }}>
          <Flex gap={8} justify={inModal ? 'flex-end' : undefined}>
            <Button onClick={onCancel}>{t('taskTimeLogTab.timeLogForm.cancel')}</Button>
            <Button
              type="primary"
              icon={<ClockCircleOutlined />}
              disabled={!isFormValid()}
              loading={submitting}
              htmlType="submit"
            >
              {mode === 'edit'
                ? t('taskTimeLogTab.timeLogForm.updateTime', { defaultValue: 'Update' })
                : t('taskTimeLogTab.timeLogForm.logTime')}
            </Button>
          </Flex>
        </Form.Item>
      </Form>
    </Flex>
  );
};

export default TimeLogForm;
