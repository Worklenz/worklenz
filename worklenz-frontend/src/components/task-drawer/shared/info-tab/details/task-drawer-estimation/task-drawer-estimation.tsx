import { SocketEvents } from '@/shared/socket-events';
import { useSocket } from '@/socket/socketContext';
import { colors } from '@/styles/colors';
import { ITaskViewModel } from '@/types/tasks/task.types';
import { Flex, Form, FormInstance, InputNumber, Typography } from '@/shared/antd-imports';
import { TFunction } from 'i18next';

interface TaskDrawerEstimationProps {
  t: TFunction;
  task: ITaskViewModel;
  form: FormInstance<any>;
}

const TaskDrawerEstimation = ({ t, task, form }: TaskDrawerEstimationProps) => {
  const { socket, connected } = useSocket();

  const handleTimeEstimationBlur = () => {
    if (!connected || !task.id) return;

    // Get current form values instead of using state
    const currentHours = form.getFieldValue('hours') || 0;
    const currentMinutes = form.getFieldValue('minutes') || 0;

    socket?.emit(
      SocketEvents.TASK_TIME_ESTIMATION_CHANGE.toString(),
      JSON.stringify({
        task_id: task.id,
        total_hours: currentHours,
        total_minutes: currentMinutes,
        parent_task: task.parent_task_id,
      })
    );
  };

  return (
    <Form.Item name="timeEstimation" label={t('taskInfoTab.details.time-estimation')}>
      <Flex gap={8}>
        <Form.Item
          name={'hours'}
          label={
            <Typography.Text style={{ color: colors.lightGray, fontSize: 12 }}>
              {t('taskInfoTab.details.hours')}
            </Typography.Text>
          }
          style={{ marginBottom: 36 }}
          labelCol={{ style: { paddingBlock: 0 } }}
          layout="vertical"
          rules={[
            {
              validator: (_, value) => {
                if (value === undefined || value === null || value >= 0) return Promise.resolve();
                return Promise.reject(new Error(t('taskInfoTab.details.hoursMinError')));
              },
            },
          ]}
        >
          <InputNumber
            min={0}
            precision={0}
            placeholder={t('taskInfoTab.details.hours')}
            onBlur={handleTimeEstimationBlur}
          />
        </Form.Item>
        <Form.Item
          name={'minutes'}
          label={
            <Typography.Text style={{ color: colors.lightGray, fontSize: 12 }}>
              {t('taskInfoTab.details.minutes')}
            </Typography.Text>
          }
          style={{ marginBottom: 36 }}
          labelCol={{ style: { paddingBlock: 0 } }}
          layout="vertical"
          rules={[
            {
              validator: (_, value) => {
                if (value === undefined || value === null || (value >= 0 && value <= 59)) return Promise.resolve();
                return Promise.reject(new Error(t('taskInfoTab.details.minutesRangeError')));
              },
            },
          ]}
        >
          <InputNumber
            min={0}
            max={59}
            precision={0}
            placeholder={t('taskInfoTab.details.minutes')}
            onBlur={handleTimeEstimationBlur}
          />
        </Form.Item>
      </Flex>
    </Form.Item>
  );
};

export default TaskDrawerEstimation;
