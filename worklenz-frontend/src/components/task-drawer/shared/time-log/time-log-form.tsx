import React from 'react';
import { Button, DatePicker, Form, Input, TimePicker, Flex } from 'antd';
import { ClockCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

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

const TimeLogForm = ({
  onCancel,
  onSubmitSuccess,
  initialValues,
  mode = 'create',
}: TimeLogFormProps) => {
  const currentSession = useAuthService().getCurrentSession();
  const { socket, connected } = useSocket();
  const [form] = Form.useForm();
  const [formValues, setFormValues] = React.useState<{
    date: any;
    startTime: any;
    endTime: any;
  }>({
    date: null,
    startTime: null,
    endTime: null,
  });

  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const { taskFormViewModel } = useAppSelector(state => state.taskDrawerReducer);

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

      form.setFieldsValue({
        date: createdAt,
        startTime: startTime,
        endTime: endTime,
        description: initialValues.description || '',
      });

      setFormValues({
        date: createdAt,
        startTime: startTime,
        endTime: endTime,
      });
    }
  }, [initialValues, mode, form]);

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

  const mapToRequest = () => {
    return {
      id: taskFormViewModel?.task?.id || undefined,
      project_id: taskFormViewModel?.task?.project_id as string,
      start_time: form.getFieldValue('startTime') || null,
      end_time: form.getFieldValue('endTime') || null,
      description: form.getFieldValue('description'),
      created_at: form.getFieldValue('date') || null,
    };
  };

  const createReqBody = () => {
    const map = mapToRequest();
    if (!map.start_time || !map.end_time || !map.created_at) return;

    const createdAt = new Date(map.created_at);
    const startTime = dayjs(map.start_time);
    const endTime = dayjs(map.end_time);

    const formattedStartTime = dayjs(createdAt)
      .hour(startTime.hour())
      .minute(startTime.minute())
      .second(0)
      .millisecond(0);

    const formattedEndTime = dayjs(createdAt)
      .hour(endTime.hour())
      .minute(endTime.minute())
      .second(0)
      .millisecond(0);

    const diff = formattedStartTime.diff(formattedEndTime, 'seconds');

    return {
      id: mode === 'edit' && initialValues?.id ? initialValues.id : taskFormViewModel?.task?.id,
      project_id: taskFormViewModel?.task?.project_id as string,
      formatted_start: formattedStartTime.toISOString(),
      seconds_spent: Math.floor(Math.abs(diff)),
      description: map.description,
    };
  };

  const onFinish = async (values: any) => {
    const { date, startTime, endTime } = values;

    if (startTime && endTime && startTime.isAfter(endTime)) {
      form.setFields([
        {
          name: 'endTime',
          errors: ['End time must be after start time'],
        },
      ]);
      return;
    }

    if (!currentSession) return;

    const assignees = taskFormViewModel?.task?.assignees as string[];
    if (currentSession && !assignees.includes(currentSession?.team_member_id as string)) {
      quickAssignMember(currentSession);
    }

    const requestBody = createReqBody();
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
    return formValues.date && formValues.startTime && formValues.endTime;
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
        onValuesChange={(_, values) => setFormValues(values)}
      >
        <Form.Item style={{ marginBlockEnd: 0 }}>
          <Flex gap={8} wrap="wrap" style={{ width: '100%' }}>
            <Form.Item
              name="date"
              label="Date"
              rules={[{ required: true, message: 'Please select a date' }]}
            >
              <DatePicker disabledDate={current => current && current.toDate() > new Date()} />
            </Form.Item>

            <Form.Item
              name="startTime"
              label="Start Time"
              rules={[{ required: true, message: 'Please select start time' }]}
            >
              <TimePicker format="HH:mm" />
            </Form.Item>

            <Form.Item
              name="endTime"
              label="End Time"
              rules={[{ required: true, message: 'Please select end time' }]}
            >
              <TimePicker format="HH:mm" />
            </Form.Item>
          </Flex>
        </Form.Item>

        <Form.Item name="description" label="Work Description" style={{ marginBlockEnd: 12 }}>
          <Input.TextArea placeholder="Add a description" />
        </Form.Item>

        <Form.Item style={{ marginBlockEnd: 0 }}>
          <Flex gap={8}>
            <Button onClick={onCancel}>Cancel</Button>
            <Button
              type="primary"
              icon={<ClockCircleOutlined />}
              disabled={!isFormValid()}
              htmlType="submit"
            >
              {mode === 'edit' ? 'Update time' : 'Log time'}
            </Button>
          </Flex>
        </Form.Item>
      </Form>
    </Flex>
  );
};

export default TimeLogForm;
