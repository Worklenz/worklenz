import { SocketEvents } from '@/shared/socket-events';
import { useSocket } from '@/socket/socketContext';
import { colors } from '@/styles/colors';
import { ITaskViewModel } from '@/types/tasks/task.types';
import { Flex, Form, FormInstance, InputNumber, Typography, Tooltip } from 'antd';
import { TFunction } from 'i18next';
import { useState, useEffect } from 'react';

interface TaskDrawerEstimationProps {
  t: TFunction;
  task: ITaskViewModel;
  form: FormInstance<any>;
  subTasksEstimation?: { hours: number; minutes: number }; // Sum of subtasks estimation
}

const TaskDrawerEstimation = ({ t, task, form, subTasksEstimation }: TaskDrawerEstimationProps) => {
  const { socket, connected } = useSocket();
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  
  // Check if task has subtasks
  const hasSubTasks = (task?.sub_tasks_count || 0) > 0;
  
  // Use subtasks estimation if available, otherwise use task's own estimation
  const displayHours = hasSubTasks && subTasksEstimation ? subTasksEstimation.hours : (task?.total_hours || 0);
  const displayMinutes = hasSubTasks && subTasksEstimation ? subTasksEstimation.minutes : (task?.total_minutes || 0);

  useEffect(() => {
    // Update form values when subtasks estimation changes
    if (hasSubTasks && subTasksEstimation) {
      form.setFieldsValue({
        hours: subTasksEstimation.hours,
        minutes: subTasksEstimation.minutes
      });
    }
  }, [subTasksEstimation, hasSubTasks, form]);

  const handleTimeEstimationBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (!connected || !task.id || hasSubTasks) return;
    
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

  const tooltipTitle = hasSubTasks 
    ? t('taskInfoTab.details.time-estimation-disabled-tooltip', { 
        count: task?.sub_tasks_count || 0,
        defaultValue: `Time estimation is disabled because this task has ${task?.sub_tasks_count || 0} subtasks. The estimation shown is the sum of all subtasks.`
      })
    : '';

  return (
    <Form.Item name="timeEstimation" label={t('taskInfoTab.details.time-estimation')}>
      <Tooltip title={tooltipTitle} trigger={hasSubTasks ? 'hover' : []}>
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
          >
            <InputNumber
              min={0}
              max={24}
              placeholder={t('taskInfoTab.details.hours')}    
              onBlur={handleTimeEstimationBlur}
              onChange={value => !hasSubTasks && setHours(value || 0)}
              disabled={hasSubTasks}
              value={displayHours}
              style={{ 
                cursor: hasSubTasks ? 'not-allowed' : 'default',
                opacity: hasSubTasks ? 0.6 : 1
              }}
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
          >
            <InputNumber
              min={0}
              max={60}
              placeholder={t('taskInfoTab.details.minutes')}
              onBlur={handleTimeEstimationBlur}
              onChange={value => !hasSubTasks && setMinutes(value || 0)}
              disabled={hasSubTasks}
              value={displayMinutes}
              style={{ 
                cursor: hasSubTasks ? 'not-allowed' : 'default',
                opacity: hasSubTasks ? 0.6 : 1
              }}
            />
          </Form.Item>
        </Flex>
      </Tooltip>
    </Form.Item>
  );
};

export default TaskDrawerEstimation;
