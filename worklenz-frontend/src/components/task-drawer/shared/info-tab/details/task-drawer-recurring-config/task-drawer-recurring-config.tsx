import React, { useState, useMemo, useEffect } from 'react';
import { Form, Switch, Button, Popover, Select, Checkbox, Radio, InputNumber, Skeleton, Row, Col } from 'antd';
import { SettingOutlined } from '@ant-design/icons';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { ITaskRecurringScheduleData } from '@/types/tasks/task-recurring-schedule';
import { ITaskViewModel } from '@/types/tasks/task.types';
import { useTranslation } from 'react-i18next';

// Dummy enums and types for demonstration; replace with actual imports/types
const ITaskRecurring = {
    Weekly: 'weekly',
    EveryXDays: 'every_x_days',
    EveryXWeeks: 'every_x_weeks',
    EveryXMonths: 'every_x_months',
    Monthly: 'monthly',
};

const repeatOptions = [
    { label: 'Weekly', value: ITaskRecurring.Weekly },
    { label: 'Every X Days', value: ITaskRecurring.EveryXDays },
    { label: 'Every X Weeks', value: ITaskRecurring.EveryXWeeks },
    { label: 'Every X Months', value: ITaskRecurring.EveryXMonths },
    { label: 'Monthly', value: ITaskRecurring.Monthly },
];

const daysOfWeek = [
    { label: 'Mon', value: 'mon' },
    { label: 'Tue', value: 'tue' },
    { label: 'Wed', value: 'wed' },
    { label: 'Thu', value: 'thu' },
    { label: 'Fri', value: 'fri' },
    { label: 'Sat', value: 'sat' },
    { label: 'Sun', value: 'sun' },
];

const monthlyDateOptions = Array.from({ length: 31 }, (_, i) => i + 1);
const weekOptions = [
    { label: 'First', value: 'first' },
    { label: 'Second', value: 'second' },
    { label: 'Third', value: 'third' },
    { label: 'Fourth', value: 'fourth' },
    { label: 'Last', value: 'last' },
];
const dayOptions = daysOfWeek.map(d => ({ label: d.label, value: d.value }));

const TaskDrawerRecurringConfig = ({ task }: {task: ITaskViewModel}) => {
    const { socket, connected } = useSocket();
    const { t } = useTranslation('task-drawer/task-drawer-recurring-config');

    const [recurring, setRecurring] = useState(false);
    const [showConfig, setShowConfig] = useState(false);
    const [repeatOption, setRepeatOption] = useState(repeatOptions[0]);
    const [selectedDays, setSelectedDays] = useState([]);
    const [monthlyOption, setMonthlyOption] = useState('date');
    const [selectedMonthlyDate, setSelectedMonthlyDate] = useState(1);
    const [selectedMonthlyWeek, setSelectedMonthlyWeek] = useState(weekOptions[0].value);
    const [selectedMonthlyDay, setSelectedMonthlyDay] = useState(dayOptions[0].value);
    const [intervalDays, setIntervalDays] = useState(1);
    const [intervalWeeks, setIntervalWeeks] = useState(1);
    const [intervalMonths, setIntervalMonths] = useState(1);
    const [loadingData, setLoadingData] = useState(false);
    const [updatingData, setUpdatingData] = useState(false);

    const handleChange = (checked: boolean) => {
        setRecurring(checked);
        if (!checked) setShowConfig(false);
    };

    const configVisibleChange = (visible: boolean) => {
        setShowConfig(visible);
    };

    const isMonthlySelected = useMemo(() => repeatOption.value === ITaskRecurring.Monthly, [repeatOption]);

    const handleDayCheckboxChange = (checkedValues: string[]) => {
        setSelectedDays(checkedValues as unknown as string[]);
    };

    const handleSave = () => {
        // Compose the schedule data and call the update handler
        const data = {
            recurring,
            repeatOption,
            selectedDays,
            monthlyOption,
            selectedMonthlyDate,
            selectedMonthlyWeek,
            selectedMonthlyDay,
            intervalDays,
            intervalWeeks,
            intervalMonths,
        };
        // if (onUpdateSchedule) onUpdateSchedule(data);
        setShowConfig(false);
    };

    const getScheduleData = () => {

    };

    const handleResponse = (response: ITaskRecurringScheduleData) => {
        if (!task || !response.task_id) return;
    }

    useEffect(() => {
        if (task) setRecurring(!!task.schedule_id);
        if (recurring) void getScheduleData();
        socket?.on(SocketEvents.TASK_RECURRING_CHANGE.toString(), handleResponse)
    }, [])

    return (
        <div>
            <Form.Item className="w-100 mb-2 align-form-item" style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                    <Switch checked={recurring} onChange={handleChange} />
                    &nbsp;
                    {recurring && (
                        <Popover
                            title="Recurring task configuration"
                            content={
                                <Skeleton loading={loadingData} active>
                                    <Form layout="vertical">
                                        <Form.Item label="Repeats">
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
                                            <Form.Item label="Select Days of the Week">
                                                <Checkbox.Group
                                                    options={daysOfWeek}
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
                                                <Form.Item label="Monthly repeat type">
                                                    <Radio.Group
                                                        value={monthlyOption}
                                                        onChange={e => setMonthlyOption(e.target.value)}
                                                    >
                                                        <Radio.Button value="date">On a specific date</Radio.Button>
                                                        <Radio.Button value="day">On a specific day</Radio.Button>
                                                    </Radio.Group>
                                                </Form.Item>
                                                {monthlyOption === 'date' && (
                                                    <Form.Item label="Date of the month">
                                                        <Select
                                                            value={selectedMonthlyDate}
                                                            onChange={setSelectedMonthlyDate}
                                                            options={monthlyDateOptions.map(date => ({ label: date.toString(), value: date }))}
                                                            style={{ width: 120 }}
                                                        />
                                                    </Form.Item>
                                                )}
                                                {monthlyOption === 'day' && (
                                                    <>
                                                        <Form.Item label="Week of the month">
                                                            <Select
                                                                value={selectedMonthlyWeek}
                                                                onChange={setSelectedMonthlyWeek}
                                                                options={weekOptions}
                                                                style={{ width: 150 }}
                                                            />
                                                        </Form.Item>
                                                        <Form.Item label="Day of the week">
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
                                            <Form.Item label="Interval (days)">
                                                <InputNumber min={1} value={intervalDays} onChange={(value) => value && setIntervalDays(value)} />
                                            </Form.Item>
                                        )}
                                        {repeatOption.value === ITaskRecurring.EveryXWeeks && (
                                            <Form.Item label="Interval (weeks)">
                                                <InputNumber min={1} value={intervalWeeks} onChange={(value) => value && setIntervalWeeks(value)} />
                                            </Form.Item>
                                        )}
                                        {repeatOption.value === ITaskRecurring.EveryXMonths && (
                                            <Form.Item label="Interval (months)">
                                                <InputNumber min={1} value={intervalMonths} onChange={(value) => value && setIntervalMonths(value)} />
                                            </Form.Item>
                                        )}
                                        <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
                                            <Button
                                                type="primary"
                                                size="small"
                                                loading={updatingData}
                                                onClick={handleSave}
                                            >
                                                Save Changes
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