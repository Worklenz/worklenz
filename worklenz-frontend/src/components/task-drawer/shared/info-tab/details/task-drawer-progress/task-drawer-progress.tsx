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

  // Show manual progress input only for tasks without subtasks (not parent tasks)
  // Parent tasks get their progress calculated from subtasks
  const showManualProgressInput = !hasSubTasks;

  // Only show weight input for subtasks in weighted progress mode
  const showTaskWeightInput = project?.use_weighted_progress && isSubTask;

  useEffect(() => {
    // Listen for progress updates from the server
    const handleProgressUpdate = (data: any) => {
      if (data.task_id === task.id) {
        if (data.progress_value !== undefined) {
          form.setFieldsValue({ progress_value: data.progress_value });
        }
        if (data.weight !== undefined) {
          form.setFieldsValue({ weight: data.weight });
        }
      }
    };

    socket?.on(SocketEvents.TASK_PROGRESS_UPDATED.toString(), handleProgressUpdate);

    // When the component mounts, explicitly request the latest progress for this task
    if (connected && task.id) {
      socket?.emit(SocketEvents.GET_TASK_PROGRESS.toString(), task.id);
    }

    return () => {
      socket?.off(SocketEvents.TASK_PROGRESS_UPDATED.toString(), handleProgressUpdate);
    };
  }, [socket, connected, task.id, form]);

  const handleProgressChange = (value: number | null) => {
    if (connected && task.id && value !== null) {
      // Ensure parent_task_id is not undefined
      const parent_task_id = task.parent_task_id || null;

      socket?.emit(
        SocketEvents.UPDATE_TASK_PROGRESS.toString(),
        JSON.stringify({
          task_id: task.id,
          progress_value: value,
          parent_task_id: parent_task_id,
        })
      );

      // If this task has subtasks, request recalculation of its progress
      if (hasSubTasks) {
        setTimeout(() => {
          socket?.emit(SocketEvents.GET_TASK_PROGRESS.toString(), task.id);
        }, 100);
      }

      // If this is a subtask, request the parent's progress to be updated in UI
      if (parent_task_id) {
        setTimeout(() => {
          socket?.emit(SocketEvents.GET_TASK_PROGRESS.toString(), parent_task_id);
        }, 100);
      }
    }
  };

  const handleWeightChange = (value: number | null) => {
    if (connected && task.id && value !== null) {
      // Ensure parent_task_id is not undefined
      const parent_task_id = task.parent_task_id || null;

      socket?.emit(
        SocketEvents.UPDATE_TASK_WEIGHT.toString(),
        JSON.stringify({
          task_id: task.id,
          weight: value,
          parent_task_id: parent_task_id,
        })
      );
      
      // If this is a subtask, request the parent's progress to be updated in UI
      if (parent_task_id) {
        setTimeout(() => {
          socket?.emit(SocketEvents.GET_TASK_PROGRESS.toString(), parent_task_id);
        }, 100);
      }
    }
  };

  const percentFormatter = (value: number | undefined) => (value ? `${value}%` : '0%');
  const percentParser = (value: string | undefined) => {
    const parsed = parseInt(value?.replace('%', '') || '0', 10);
    return isNaN(parsed) ? 0 : parsed;
  };

  if (!showManualProgressInput && !showTaskWeightInput) {
    return null; // Don't show any progress inputs if not applicable
  }

  return (
    <>
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
            onBlur={e => {
              const value = percentParser(e.target.value);
              handleWeightChange(value);
            }}
          />
        </Form.Item>
      )}
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
            onBlur={e => {
              const value = percentParser(e.target.value);
              handleProgressChange(value);
            }}
          />
        </Form.Item>
      )}
    </>
  );
};

export default TaskDrawerProgress;
