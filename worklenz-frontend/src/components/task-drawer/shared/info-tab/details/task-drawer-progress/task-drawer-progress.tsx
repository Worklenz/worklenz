import { Form, InputNumber, Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { useAppSelector } from '@/hooks/useAppSelector';
import { ITaskViewModel } from '@/types/tasks/task.types';
import Flex from 'antd/lib/flex';
import { SocketEvents } from '@/shared/socket-events';
import { useEffect } from 'react';
import { useSocket } from '@/socket/socketContext';

interface TaskDrawerProgressProps {
  task: ITaskViewModel;
  form: any;
}

const TaskDrawerProgress = ({ task, form }: TaskDrawerProgressProps) => {
  const { t } = useTranslation('task-drawer/task-drawer');
  const { project } = useAppSelector(state => state.projectReducer);
  const { socket, connected } = useSocket();

  const isSubTask = !!task?.parent_task_id;
  const hasSubTasks = task?.sub_tasks_count > 0;

  // Determine which progress input to show based on project settings
  const showManualProgressInput = project?.use_manual_progress && !hasSubTasks && !isSubTask;
  const showTaskWeightInput = project?.use_weighted_progress && isSubTask;

  useEffect(() => {
    // Listen for progress updates from the server
    socket?.on(SocketEvents.TASK_PROGRESS_UPDATED.toString(), (data) => {
      if (data.task_id === task.id) {
        if (data.progress_value !== undefined) {
          form.setFieldsValue({ progress_value: data.progress_value });
        }
        if (data.weight !== undefined) {
          form.setFieldsValue({ weight: data.weight });
        }
      }
    });

    return () => {
      socket?.off(SocketEvents.TASK_PROGRESS_UPDATED.toString());
    };
  }, [socket, task.id, form]);

  const handleProgressChange = (value: number | null) => {
    if (connected && task.id && value !== null) {
      socket?.emit(SocketEvents.UPDATE_TASK_PROGRESS.toString(), JSON.stringify({
        task_id: task.id,
        progress_value: value,
        parent_task_id: task.parent_task_id
      }));
    }
  };

  const handleWeightChange = (value: number | null) => {
    if (connected && task.id && value !== null) {
      socket?.emit(SocketEvents.UPDATE_TASK_WEIGHT.toString(), JSON.stringify({
        task_id: task.id,
        weight: value,
        parent_task_id: task.parent_task_id
      }));
    }
  };

  const percentFormatter = (value: number | undefined) => value ? `${value}%` : '0%';
  const percentParser = (value: string | undefined) => {
    const parsed = parseInt(value?.replace('%', '') || '0', 10);
    return isNaN(parsed) ? 0 : parsed;
  };

  if (!showManualProgressInput && !showTaskWeightInput) {
    return null; // Don't show any progress inputs if not applicable
  }

  return (
    <>
      {showManualProgressInput && (
        <Form.Item
          name="progress_value"
          label={
            <Flex align="center" gap={4}>
              {t('taskInfoTab.details.progressValue')}
              <Tooltip title={t('taskInfoTab.details.progressValueTooltip')}>
                <QuestionCircleOutlined />
              </Tooltip>
            </Flex>
          }
          rules={[
            {
              required: true,
              message: t('taskInfoTab.details.progressValueRequired'),
            },
            {
              type: 'number',
              min: 0,
              max: 100,
              message: t('taskInfoTab.details.progressValueRange'),
            },
          ]}
        >
          <InputNumber 
            min={0}
            max={100}
            formatter={percentFormatter}
            parser={percentParser}
            onBlur={(e) => {
              const value = percentParser(e.target.value);
              handleProgressChange(value);
            }}
          />
        </Form.Item>
      )}

      {showTaskWeightInput && (
        <Form.Item
          name="weight"
          label={
            <Flex align="center" gap={4}>
              {t('taskInfoTab.details.taskWeight')}
              <Tooltip title={t('taskInfoTab.details.taskWeightTooltip')}>
                <QuestionCircleOutlined />
              </Tooltip>
            </Flex>
          }
          rules={[
            {
              required: true,
              message: t('taskInfoTab.details.taskWeightRequired'),
            },
            {
              type: 'number',
              min: 0,
              max: 100,
              message: t('taskInfoTab.details.taskWeightRange'),
            },
          ]}
        >
          <InputNumber
            min={0}
            max={100}
            formatter={percentFormatter}
            parser={percentParser}
            onBlur={(e) => {
              const value = percentParser(e.target.value);
              handleWeightChange(value);
            }}
          />
        </Form.Item>
      )}
    </>
  );
};

export default TaskDrawerProgress; 