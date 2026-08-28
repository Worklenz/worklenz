import { useEffect, useRef, FocusEvent } from 'react';
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
  disabled?: boolean;
}

const TaskDrawerEstimation = ({ t, task, form, disabled = false }: TaskDrawerEstimationProps) => {
  const { socket, connected } = useSocket();

  // Tracks whether either input is actively being edited, so an external update (e.g. the
  // Planner Schedule grid's drag-to-resize, or another tab/user) arriving mid-edit doesn't
  // clobber what the user is currently typing here.
  const isEditingRef = useRef(false);
  const estimationGroupRef = useRef<HTMLDivElement>(null);
  const handleEstimationFocus = () => {
    isEditingRef.current = true;
  };
  const handleEstimationBlurTracking = (e: FocusEvent<HTMLInputElement>) => {
    // Tabbing hours -> minutes (or back) blurs one field and focuses the other in the same
    // tick; relatedTarget is the element about to receive focus. Skip clearing the guard in
    // that case so it stays active for the whole transition instead of opening a window
    // where an external update could land and overwrite the field the user is about to edit.
    const next = e.relatedTarget as HTMLElement | null;
    if (next && estimationGroupRef.current?.contains(next)) return;
    isEditingRef.current = false;
  };

  // task-details-form.tsx only re-seeds the whole form when the task ID changes (by
  // design, to avoid resetting other fields on every socket update), so hours/minutes need
  // their own resync whenever this same task's estimate changes elsewhere while its drawer
  // stays open.
  useEffect(() => {
    if (isEditingRef.current) return;
    form.setFieldsValue({ hours: task?.total_hours || 0, minutes: task?.total_minutes || 0 });
  }, [task?.total_hours, task?.total_minutes, form]);

  const handleTimeEstimationBlur = (e: FocusEvent<HTMLInputElement>) => {
    handleEstimationBlurTracking(e);
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
      <Flex gap={8} ref={estimationGroupRef}>
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
            onFocus={handleEstimationFocus}
            onBlur={handleTimeEstimationBlur}
            disabled={disabled}
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
            onFocus={handleEstimationFocus}
            onBlur={handleTimeEstimationBlur}
            disabled={disabled}
          />
        </Form.Item>
      </Flex>
    </Form.Item>
  );
};

export default TaskDrawerEstimation;
