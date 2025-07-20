import React, { useState, useMemo, useEffect } from 'react';
import {
  Form,
  Switch,
  Button,
  Popover,
  Select,
  Checkbox,
  Radio,
  InputNumber,
  Skeleton,
  Row,
  Col,
  DatePicker,
  Tag,
  Space,
} from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import { SettingOutlined } from '@ant-design/icons';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import {
  IRepeatOption,
  ITaskRecurring,
  ITaskRecurringSchedule,
  ITaskRecurringScheduleData,
} from '@/types/tasks/task-recurring-schedule';
import { ITaskViewModel } from '@/types/tasks/task.types';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { updateRecurringChange } from '@/features/tasks/tasks.slice';
import { updateTaskCounts } from '@/features/task-management/task-management.slice';
import { taskRecurringApiService } from '@/api/tasks/task-recurring.api.service';
import logger from '@/utils/errorLogger';
import { setTaskRecurringSchedule } from '@/features/task-drawer/task-drawer.slice';
import moment from 'moment-timezone';

const monthlyDateOptions = Array.from({ length: 28 }, (_, i) => i + 1);

const TaskDrawerRecurringConfig = ({ task }: { task: ITaskViewModel }) => {
  const { socket, connected } = useSocket();
  const dispatch = useAppDispatch();
  const { t } = useTranslation('task-drawer/task-drawer-recurring-config');

  const repeatOptions: IRepeatOption[] = [
    { label: t('daily'), value: ITaskRecurring.Daily },
    { label: t('weekly'), value: ITaskRecurring.Weekly },
    { label: t('everyXDays'), value: ITaskRecurring.EveryXDays },
    { label: t('everyXWeeks'), value: ITaskRecurring.EveryXWeeks },
    { label: t('everyXMonths'), value: ITaskRecurring.EveryXMonths },
    { label: t('monthly'), value: ITaskRecurring.Monthly },
  ];

  const daysOfWeek = [
    { label: t('sun'), value: 0, checked: false },
    { label: t('mon'), value: 1, checked: false },
    { label: t('tue'), value: 2, checked: false },
    { label: t('wed'), value: 3, checked: false },
    { label: t('thu'), value: 4, checked: false },
    { label: t('fri'), value: 5, checked: false },
    { label: t('sat'), value: 6, checked: false },
  ];

  const weekOptions = [
    { label: t('first'), value: 1 },
    { label: t('second'), value: 2 },
    { label: t('third'), value: 3 },
    { label: t('fourth'), value: 4 },
    { label: t('last'), value: 5 },
  ];

  const dayOptions = daysOfWeek.map(d => ({ label: d.label, value: d.value }));

  // Get common timezones
  const timezoneOptions = [
    { label: 'UTC', value: 'UTC' },
    { label: 'US Eastern', value: 'America/New_York' },
    { label: 'US Central', value: 'America/Chicago' },
    { label: 'US Mountain', value: 'America/Denver' },
    { label: 'US Pacific', value: 'America/Los_Angeles' },
    { label: 'Europe/London', value: 'Europe/London' },
    { label: 'Europe/Paris', value: 'Europe/Paris' },
    { label: 'Asia/Tokyo', value: 'Asia/Tokyo' },
    { label: 'Asia/Shanghai', value: 'Asia/Shanghai' },
    { label: 'Asia/Kolkata', value: 'Asia/Kolkata' },
    { label: 'Australia/Sydney', value: 'Australia/Sydney' },
  ];

  const [recurring, setRecurring] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [repeatOption, setRepeatOption] = useState<IRepeatOption>({});
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [monthlyOption, setMonthlyOption] = useState('date');
  const [selectedMonthlyDate, setSelectedMonthlyDate] = useState(1);
  const [selectedMonthlyWeek, setSelectedMonthlyWeek] = useState(weekOptions[0].value);
  const [selectedMonthlyDay, setSelectedMonthlyDay] = useState(dayOptions[0].value);
  const [intervalDays, setIntervalDays] = useState(1);
  const [intervalWeeks, setIntervalWeeks] = useState(1);
  const [intervalMonths, setIntervalMonths] = useState(1);
  const [loadingData, setLoadingData] = useState(false);
  const [updatingData, setUpdatingData] = useState(false);
  const [scheduleData, setScheduleData] = useState<ITaskRecurringSchedule>({});
  const [timezone, setTimezone] = useState('UTC');
  const [endDate, setEndDate] = useState<moment.Moment | null>(null);
  const [excludedDates, setExcludedDates] = useState<string[]>([]);
  const [newExcludeDate, setNewExcludeDate] = useState<moment.Moment | null>(null);

  const handleChange = (checked: boolean) => {
    if (!task.id) return;

    socket?.emit(SocketEvents.TASK_RECURRING_CHANGE.toString(), {
      task_id: task.id,
      schedule_id: task.schedule_id,
    });

    socket?.once(
      SocketEvents.TASK_RECURRING_CHANGE.toString(),
      (schedule: ITaskRecurringScheduleData) => {
        if (schedule.id && schedule.schedule_type) {
          const selected = repeatOptions.find(e => e.value == schedule.schedule_type);
          if (selected) setRepeatOption(selected);
        }
        dispatch(updateRecurringChange(schedule));
        dispatch(
          setTaskRecurringSchedule({ schedule_id: schedule.id as string, task_id: task.id })
        );

        // Update Redux state with recurring task status
        dispatch(updateTaskCounts({
          taskId: task.id,
          counts: {
            schedule_id: schedule.id as string || null
          }
        }));

        setRecurring(checked);
        if (!checked) setShowConfig(false);
      }
    );
  };

  const configVisibleChange = (visible: boolean) => {
    setShowConfig(visible);
  };

  const isMonthlySelected = useMemo(
    () => repeatOption.value === ITaskRecurring.Monthly,
    [repeatOption]
  );

  const handleDayCheckboxChange = (checkedValues: number[]) => {
    setSelectedDays(checkedValues);
  };

  const getSelectedDays = () => {
    return daysOfWeek
      .filter(day => day.checked) // Get only the checked days
      .map(day => day.value); // Extract their numeric values
  };

  const getUpdateBody = () => {
    if (!task.id || !task.schedule_id || !repeatOption.value) return;

    const body: ITaskRecurringSchedule = {
      id: task.id,
      schedule_type: repeatOption.value,
      timezone: timezone,
      end_date: endDate ? endDate.format('YYYY-MM-DD') : null,
      excluded_dates: excludedDates,
    };

    switch (repeatOption.value) {
      case ITaskRecurring.Weekly:
        body.days_of_week = getSelectedDays();
        break;

      case ITaskRecurring.Monthly:
        if (monthlyOption === 'date') {
          body.date_of_month = selectedMonthlyDate;
          setSelectedMonthlyDate(0);
          setSelectedMonthlyDay(0);
        } else {
          body.week_of_month = selectedMonthlyWeek;
          body.day_of_month = selectedMonthlyDay;
          setSelectedMonthlyDate(0);
        }
        break;

      case ITaskRecurring.EveryXDays:
        body.interval_days = intervalDays;
        break;

      case ITaskRecurring.EveryXWeeks:
        body.interval_weeks = intervalWeeks;
        break;

      case ITaskRecurring.EveryXMonths:
        body.interval_months = intervalMonths;
        break;
    }
    return body;
  };

  const handleSave = async () => {
    if (!task.id || !task.schedule_id) return;

    try {
      setUpdatingData(true);
      const body = getUpdateBody();

      const res = await taskRecurringApiService.updateTaskRecurringData(task.schedule_id, body);
      if (res.done) {
        setRecurring(true);
        setShowConfig(false);
        configVisibleChange(false);
      }
    } catch (e) {
      logger.error('handleSave', e);
    } finally {
      setUpdatingData(false);
    }
  };

  const updateDaysOfWeek = () => {
    for (let i = 0; i < daysOfWeek.length; i++) {
      daysOfWeek[i].checked = scheduleData.days_of_week?.includes(daysOfWeek[i].value) ?? false;
    }
  };

  const getScheduleData = async () => {
    if (!task.schedule_id) return;
    setLoadingData(true);
    try {
      const res = await taskRecurringApiService.getTaskRecurringData(task.schedule_id);
      if (res.done) {
        setScheduleData(res.body);
        if (!res.body) {
          setRepeatOption(repeatOptions[0]);
        } else {
          const selected = repeatOptions.find(e => e.value == res.body.schedule_type);
          if (selected) {
            setRepeatOption(selected);
            setSelectedMonthlyDate(res.body.date_of_month || 1);
            setSelectedMonthlyDay(res.body.day_of_month || 0);
            setSelectedMonthlyWeek(res.body.week_of_month || 0);
            setIntervalDays(res.body.interval_days || 1);
            setIntervalWeeks(res.body.interval_weeks || 1);
            setIntervalMonths(res.body.interval_months || 1);
            setTimezone(res.body.timezone || 'UTC');
            setEndDate(res.body.end_date ? moment(res.body.end_date) : null);
            setExcludedDates(res.body.excluded_dates || []);
            setMonthlyOption(res.body.date_of_month ? 'date' : 'day');
            updateDaysOfWeek();
          }
        }
      }
    } catch (e) {
      logger.error('getScheduleData', e);
    } finally {
      setLoadingData(false);
    }
  };

  const handleResponse = (response: ITaskRecurringScheduleData) => {
    if (!task || !response.task_id) return;
  };

  useEffect(() => {
    if (!task) return;

    if (task) setRecurring(!!task.schedule_id);
    if (task.schedule_id) void getScheduleData();
    socket?.on(SocketEvents.TASK_RECURRING_CHANGE.toString(), handleResponse);
  }, [task?.schedule_id]);

  return (
    <div>
      <Form.Item className="w-100 mb-2 align-form-item" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
          <Switch checked={recurring} onChange={handleChange} />
          &nbsp;
          {recurring && (
            <Popover
              title={t('recurringTaskConfiguration')}
              content={
                <Skeleton loading={loadingData} active>
                  <Form layout="vertical">
                    <Form.Item label={t('repeats')}>
                      <Select
                        value={repeatOption.value}
                        onChange={val => {
                          const option = repeatOptions.find(opt => opt.value === val);
                          if (option) {
                            setRepeatOption(option);
                          }
                        }}
                        options={repeatOptions}
                        style={{ width: 200 }}
                      />
                    </Form.Item>

                    {repeatOption.value === ITaskRecurring.Weekly && (
                      <Form.Item label={t('selectDaysOfWeek')}>
                        <Checkbox.Group
                          options={daysOfWeek.map(day => ({
                            label: day.label,
                            value: day.value,
                          }))}
                          value={selectedDays}
                          onChange={handleDayCheckboxChange}
                          style={{ width: '100%' }}
                        >
                          <Row>
                            {daysOfWeek.map(day => (
                              <Col span={8} key={day.value}>
                                <Checkbox value={day.value}>{day.label}</Checkbox>
                              </Col>
                            ))}
                          </Row>
                        </Checkbox.Group>
                      </Form.Item>
                    )}

                    {isMonthlySelected && (
                      <>
                        <Form.Item label={t('monthlyRepeatType')}>
                          <Radio.Group
                            value={monthlyOption}
                            onChange={e => setMonthlyOption(e.target.value)}
                          >
                            <Radio.Button value="date">{t('onSpecificDate')}</Radio.Button>
                            <Radio.Button value="day">{t('onSpecificDay')}</Radio.Button>
                          </Radio.Group>
                        </Form.Item>
                        {monthlyOption === 'date' && (
                          <Form.Item label={t('dateOfMonth')}>
                            <Select
                              value={selectedMonthlyDate}
                              onChange={setSelectedMonthlyDate}
                              options={monthlyDateOptions.map(date => ({
                                label: date.toString(),
                                value: date,
                              }))}
                              style={{ width: 120 }}
                            />
                          </Form.Item>
                        )}
                        {monthlyOption === 'day' && (
                          <>
                            <Form.Item label={t('weekOfMonth')}>
                              <Select
                                value={selectedMonthlyWeek}
                                onChange={setSelectedMonthlyWeek}
                                options={weekOptions}
                                style={{ width: 150 }}
                              />
                            </Form.Item>
                            <Form.Item label={t('dayOfWeek')}>
                              <Select
                                value={selectedMonthlyDay}
                                onChange={setSelectedMonthlyDay}
                                options={dayOptions}
                                style={{ width: 150 }}
                              />
                            </Form.Item>
                          </>
                        )}
                      </>
                    )}

                    {repeatOption.value === ITaskRecurring.EveryXDays && (
                      <Form.Item label={t('intervalDays')}>
                        <InputNumber
                          min={1}
                          value={intervalDays}
                          onChange={value => value && setIntervalDays(value)}
                        />
                      </Form.Item>
                    )}
                    {repeatOption.value === ITaskRecurring.EveryXWeeks && (
                      <Form.Item label={t('intervalWeeks')}>
                        <InputNumber
                          min={1}
                          value={intervalWeeks}
                          onChange={value => value && setIntervalWeeks(value)}
                        />
                      </Form.Item>
                    )}
                    {repeatOption.value === ITaskRecurring.EveryXMonths && (
                      <Form.Item label={t('intervalMonths')}>
                        <InputNumber
                          min={1}
                          value={intervalMonths}
                          onChange={value => value && setIntervalMonths(value)}
                        />
                      </Form.Item>
                    )}

                    {/* Timezone Selection */}
                    <Form.Item label={t('timezone')}>
                      <Select
                        value={timezone}
                        onChange={setTimezone}
                        options={timezoneOptions}
                        style={{ width: '100%' }}
                      />
                    </Form.Item>

                    {/* End Date */}
                    <Form.Item label={t('endDate')}>
                      <DatePicker
                        value={endDate}
                        onChange={setEndDate}
                        style={{ width: '100%' }}
                        placeholder={t('selectEndDate')}
                        disabledDate={(current) => current && current < moment().endOf('day')}
                      />
                    </Form.Item>

                    {/* Excluded Dates */}
                    <Form.Item label={t('excludedDates')}>
                      <Space direction="vertical" style={{ width: '100%' }}>
                        <DatePicker
                          value={newExcludeDate}
                          onChange={setNewExcludeDate}
                          style={{ width: '100%' }}
                          placeholder={t('selectDateToExclude')}
                          disabledDate={(current) => current && current < moment().endOf('day')}
                        />
                        {newExcludeDate && (
                          <Button
                            size="small"
                            onClick={() => {
                              const dateStr = newExcludeDate.format('YYYY-MM-DD');
                              if (!excludedDates.includes(dateStr)) {
                                setExcludedDates([...excludedDates, dateStr]);
                                setNewExcludeDate(null);
                              }
                            }}
                          >
                            {t('addExcludedDate')}
                          </Button>
                        )}
                        <div style={{ marginTop: 8 }}>
                          {excludedDates.map((date) => (
                            <Tag
                              key={date}
                              closable
                              onClose={() => {
                                setExcludedDates(excludedDates.filter(d => d !== date));
                              }}
                              style={{ marginBottom: 4 }}
                            >
                              {date}
                            </Tag>
                          ))}
                        </div>
                      </Space>
                    </Form.Item>

                    <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
                      <Button
                        type="primary"
                        size="small"
                        loading={updatingData}
                        onClick={handleSave}
                      >
                        {t('saveChanges')}
                      </Button>
                    </Form.Item>
                  </Form>
                </Skeleton>
              }
              overlayStyle={{ width: 510 }}
              open={showConfig}
              onOpenChange={configVisibleChange}
              trigger="click"
            >
              <Button type="link" loading={loadingData} style={{ padding: 0 }}>
                {repeatOption.label} <SettingOutlined />
              </Button>
            </Popover>
          )}
        </div>
      </Form.Item>
    </div>
  );
};

export default TaskDrawerRecurringConfig;
