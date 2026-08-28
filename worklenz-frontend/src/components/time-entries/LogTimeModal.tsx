import React from 'react';
import {
  Modal,
  Flex,
  Select,
  Segmented,
  DatePicker,
  TimePicker,
  Input,
  InputNumber,
  Form,
  Button,
  Spin,
  appMessage,
  dayjs,
  type Dayjs,
} from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import {
  taskTimeLogsApiService,
  IRecentProject,
  ITaskInProject,
} from '@/api/tasks/task-time-logs.api.service';
import apiClient from '@/api/api-client';
import { API_BASE_URL } from '@/shared/constants';

const { TextArea } = Input;

interface LogTimeModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type TimeLogInputMode = 'duration' | 'timeRange';

export const LogTimeModal: React.FC<LogTimeModalProps> = ({ open, onClose, onSuccess }) => {
  const { t } = useTranslation('time-entries');
  const [form] = Form.useForm();
  const minutesAutoClearedRef = React.useRef(false);

  const [recentProjects, setRecentProjects] = React.useState<IRecentProject[]>([]);
  const [projectSearchResults, setProjectSearchResults] = React.useState<IRecentProject[]>([]);
  const [projectSearchTerm, setProjectSearchTerm] = React.useState('');
  const [projectLoading, setProjectLoading] = React.useState(false);
  const [selectedProject, setSelectedProject] = React.useState<IRecentProject | null>(null);

  const [tasks, setTasks] = React.useState<ITaskInProject[]>([]);
  const [taskSearchTerm, setTaskSearchTerm] = React.useState('');
  const [taskLoading, setTaskLoading] = React.useState(false);
  const [selectedTaskId, setSelectedTaskId] = React.useState<string | null>(null);

  const [inputMode, setInputMode] = React.useState<TimeLogInputMode>('duration');
  const [submitting, setSubmitting] = React.useState(false);
  const [formValues, setFormValues] = React.useState<{
    date?: Dayjs;
    hours?: number;
    minutes?: number;
    startTime?: Dayjs;
    endTime?: Dayjs;
  }>({});

  const projectSearchTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const taskSearchTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (!open) return;
    minutesAutoClearedRef.current = false;
    const initialValues = {
      date: dayjs(),
      hours: 0,
      minutes: 30,
      startTime: dayjs().second(0).millisecond(0),
      endTime: dayjs().second(0).millisecond(0).add(30, 'minute'),
    };
    form.resetFields();
    form.setFieldsValue(initialValues);
    setFormValues(initialValues);
    setSelectedProject(null);
    setSelectedTaskId(null);
    setTasks([]);
    setProjectSearchTerm('');
    setTaskSearchTerm('');
    setInputMode('duration');
    taskTimeLogsApiService.getMyRecentProjects().then(res => {
      if (res.done) setRecentProjects(res.body as IRecentProject[]);
    });
  }, [open, form]);

  React.useEffect(() => {
    if (projectSearchTimerRef.current) clearTimeout(projectSearchTimerRef.current);
    if (!projectSearchTerm.trim()) {
      setProjectSearchResults([]);
      return;
    }
    projectSearchTimerRef.current = setTimeout(async () => {
      setProjectLoading(true);
      try {
        const res = await apiClient.get(`${API_BASE_URL}/projects/my-task-projects`);
        const list: any[] = res.data?.body || [];
        const q = projectSearchTerm.toLowerCase();
        setProjectSearchResults(
          list
            .filter((p: any) => p.name?.toLowerCase().includes(q))
            .map((p: any) => ({ id: p.id, name: p.name, color_code: p.color_code }))
        );
      } catch {
        setProjectSearchResults([]);
      } finally {
        setProjectLoading(false);
      }
    }, 300);
  }, [projectSearchTerm]);

  React.useEffect(() => {
    if (!selectedProject) return;
    if (taskSearchTimerRef.current) clearTimeout(taskSearchTimerRef.current);
    taskSearchTimerRef.current = setTimeout(async () => {
      setTaskLoading(true);
      try {
        const res = await taskTimeLogsApiService.getMyTasksInProject(selectedProject.id, taskSearchTerm || undefined);
        if (res.done) setTasks(res.body as ITaskInProject[]);
      } catch {
        setTasks([]);
      } finally {
        setTaskLoading(false);
      }
    }, 200);
  }, [selectedProject, taskSearchTerm]);

  React.useEffect(() => () => {
    if (projectSearchTimerRef.current) clearTimeout(projectSearchTimerRef.current);
    if (taskSearchTimerRef.current) clearTimeout(taskSearchTimerRef.current);
  }, []);

  const projectOptions = (projectSearchTerm.trim() ? projectSearchResults : recentProjects).map(p => ({
    value: p.id,
    label: p.name,
  }));

  const taskOptions = tasks.map(task => ({ value: task.id, label: task.name }));

  const handleProjectChange = (projectId: string | undefined) => {
    const found =
      projectSearchResults.find(p => p.id === projectId) ||
      recentProjects.find(p => p.id === projectId) ||
      null;
    setSelectedProject(found);
    setSelectedTaskId(null);
    setTasks([]);
    setTaskSearchTerm('');
    form.setFieldsValue({ taskId: undefined });
  };

  const isFormValid = () => {
    if (!selectedProject || !selectedTaskId || !formValues.date) return false;
    if (inputMode === 'duration') {
      const h = Math.max(0, Number(formValues.hours || 0));
      const m = Math.max(0, Math.min(59, Number(formValues.minutes || 0)));
      return h * 60 + m > 0;
    }
    if (!formValues.startTime || !formValues.endTime) return false;
    return formValues.endTime.isAfter(formValues.startTime);
  };

  const handleSubmit = async (values: any) => {
    if (!selectedProject || !selectedTaskId) {
      appMessage.error(t('selectProjectAndTaskError', { defaultValue: 'Please select a project and a task' }));
      return;
    }

    const date: Dayjs = values.date;
    let secondsSpent = 0;
    let formattedStart: Dayjs;

    if (inputMode === 'duration') {
      const hours = Math.max(0, Number(values.hours || 0));
      const minutes = Math.max(0, Number(values.minutes || 0));
      if (minutes > 59) {
        form.setFields([{ name: 'minutes', errors: [t('minutesRangeError', { defaultValue: 'Minutes must be between 0 and 59' })] }]);
        return;
      }
      secondsSpent = hours * 3600 + minutes * 60;
      if (secondsSpent <= 0) {
        form.setFields([{ name: 'hours', errors: [t('invalidTimeLoggedError', { defaultValue: 'Enter at least 1 minute' })] }]);
        return;
      }
      const now = dayjs();
      formattedStart = date.hour(now.hour()).minute(now.minute()).second(0).millisecond(0);
    } else {
      const startTime: Dayjs = values.startTime;
      const endTime: Dayjs = values.endTime;
      if (!startTime || !endTime || !endTime.isAfter(startTime)) {
        form.setFields([
          {
            name: 'endTime',
            errors: [t('endTimeAfterStartError', { defaultValue: 'End time must be after start time' })],
          },
        ]);
        return;
      }
      secondsSpent = endTime.diff(startTime, 'second');
      formattedStart = date.hour(startTime.hour()).minute(startTime.minute()).second(0).millisecond(0);
    }

    const requestBody = {
      id: selectedTaskId,
      project_id: selectedProject.id,
      formatted_start: formattedStart.toISOString(),
      seconds_spent: secondsSpent,
      description: values.description || '',
    };

    setSubmitting(true);
    try {
      await taskTimeLogsApiService.create(requestBody);
      onSuccess();
      onClose();
    } catch {
      appMessage.error(t('logTimeError', { defaultValue: 'Failed to log time' }));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={t('modalTitle', { defaultValue: 'Quick Time Entry' })}
      footer={null}
      width={440}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        onValuesChange={(changedValues, values) => {
          // Only auto-clear if minutes is still at its untouched default — otherwise
          // this would stomp a minutes value the user already entered themselves
          // (e.g. entering "45" then "1" to mean 1h45m).
          if ('hours' in changedValues && !minutesAutoClearedRef.current && values.minutes === 30) {
            const incoming = Number(changedValues.hours);
            if (!isNaN(incoming) && incoming > 0) {
              minutesAutoClearedRef.current = true;
              form.setFieldsValue({ minutes: 0 });
              setFormValues({ ...values, minutes: 0 });
              return;
            }
          }
          setFormValues(values);
        }}
        requiredMark={false}
      >
        <Form.Item label={t('projectLabel', { defaultValue: 'Project' })} style={{ marginBottom: 16 }}>
          <Select
            showSearch
            allowClear
            filterOption={false}
            placeholder={t('selectProjectPlaceholder', { defaultValue: 'Select project...' })}
            value={selectedProject?.id}
            options={projectOptions}
            loading={projectLoading}
            notFoundContent={projectLoading ? <Spin size="small" /> : null}
            onSearch={setProjectSearchTerm}
            onChange={handleProjectChange}
            style={{ width: '100%' }}
          />
        </Form.Item>

        <Form.Item name="taskId" label={t('taskLabel', { defaultValue: 'Task' })} style={{ marginBottom: 16 }}>
          <Select
            showSearch
            allowClear
            filterOption={false}
            disabled={!selectedProject}
            placeholder={
              selectedProject
                ? t('selectTaskPlaceholder', { defaultValue: 'Select task...' })
                : t('selectProjectFirstPlaceholder', { defaultValue: 'Select a project first' })
            }
            options={taskOptions}
            loading={taskLoading}
            notFoundContent={taskLoading ? <Spin size="small" /> : null}
            onSearch={setTaskSearchTerm}
            onChange={val => setSelectedTaskId(val || null)}
            style={{ width: '100%' }}
          />
        </Form.Item>

        <Form.Item label={t('inputModeLabel', { defaultValue: 'Input Mode' })} style={{ marginBottom: 16 }}>
          <Segmented
            block
            value={inputMode}
            onChange={value => setInputMode(value as TimeLogInputMode)}
            options={[
              { label: t('durationMode', { defaultValue: 'Duration' }), value: 'duration' },
              { label: t('timeRangeMode', { defaultValue: 'Time Range' }), value: 'timeRange' },
            ]}
          />
        </Form.Item>

        {inputMode === 'duration' ? (
          <Flex gap={12} wrap="wrap" style={{ width: '100%' }}>
            <Form.Item
              name="date"
              label={t('dateLabel', { defaultValue: 'Date' })}
              rules={[{ required: true, message: t('selectDateError', { defaultValue: 'Select a date' }) }]}
              style={{ flex: 1.4, minWidth: 160, marginBottom: 16 }}
            >
              <DatePicker
                style={{ width: '100%' }}
                disabledDate={current => current && current.toDate() > new Date()}
              />
            </Form.Item>

            <Form.Item
              name="hours"
              label={t('hoursLabel', { defaultValue: 'Hours' })}
              rules={[{ type: 'number', min: 0, message: t('hoursMinError', { defaultValue: 'Hours must be 0 or greater' }) }]}
              style={{ flex: 1, minWidth: 80, marginBottom: 16 }}
            >
              <InputNumber min={0} precision={0} placeholder="0" style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item
              name="minutes"
              label={t('minutesLabel', { defaultValue: 'Minutes' })}
              rules={[{ type: 'number', min: 0, max: 59, message: t('minutesRangeError', { defaultValue: '0 – 59' }) }]}
              style={{ flex: 1, minWidth: 80, marginBottom: 16 }}
            >
              <InputNumber min={0} max={59} precision={0} placeholder="0" style={{ width: '100%' }} />
            </Form.Item>
          </Flex>
        ) : (
          <>
            <Form.Item
              name="date"
              label={t('dateLabel', { defaultValue: 'Date' })}
              rules={[{ required: true, message: t('selectDateError', { defaultValue: 'Select a date' }) }]}
              style={{ marginBottom: 16 }}
            >
              <DatePicker
                style={{ width: '100%' }}
                disabledDate={current => current && current.toDate() > new Date()}
              />
            </Form.Item>

            <Flex gap={12} style={{ width: '100%' }}>
              <Form.Item
                name="startTime"
                label={t('startTimeLabel', { defaultValue: 'Start Time' })}
                rules={[{ required: true, message: t('selectStartTimeError', { defaultValue: 'Select a start time' }) }]}
                style={{ flex: 1, marginBottom: 16 }}
              >
                <TimePicker format="HH:mm" style={{ width: '100%' }} />
              </Form.Item>

              <Form.Item
                name="endTime"
                label={t('endTimeLabel', { defaultValue: 'End Time' })}
                rules={[{ required: true, message: t('selectEndTimeError', { defaultValue: 'Select an end time' }) }]}
                style={{ flex: 1, marginBottom: 16 }}
              >
                <TimePicker format="HH:mm" style={{ width: '100%' }} />
              </Form.Item>
            </Flex>
          </>
        )}

        <Form.Item
          name="description"
          label={t('workDescriptionLabel', { defaultValue: 'Work Description' })}
          style={{ marginBottom: 20 }}
        >
          <TextArea
            placeholder={t('workDescriptionPlaceholder', { defaultValue: 'What did you work on?' })}
            maxLength={500}
            showCount
            autoSize={{ minRows: 2, maxRows: 5 }}
          />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0 }}>
          <Button
            type="primary"
            htmlType="submit"
            block
            size="large"
            loading={submitting}
            disabled={!isFormValid()}
          >
            {t('logTimeButton', { defaultValue: 'Log Time' })}
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
};
