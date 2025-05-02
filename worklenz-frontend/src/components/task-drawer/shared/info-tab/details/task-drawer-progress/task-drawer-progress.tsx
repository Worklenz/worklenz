import { Form, InputNumber, Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { useAppSelector } from '@/hooks/useAppSelector';
import { ITaskViewModel } from '@/types/tasks/task.types';
import Flex from 'antd/lib/flex';
import { SocketEvents } from '@/shared/socket-events';
import { useEffect, useState } from 'react';
import { useSocket } from '@/socket/socketContext';

interface TaskDrawerProgressProps {
  task: ITaskViewModel;
  form: any;
}

const TaskDrawerProgress = ({ task, form }: TaskDrawerProgressProps) => {
  const { t } = useTranslation('task-drawer/task-drawer');
  const { project } = useAppSelector(state => state.projectReducer);
  const { socket, connected } = useSocket();
  const [confirmedHasSubtasks, setConfirmedHasSubtasks] = useState<boolean | null>(null);

  const isSubTask = !!task?.parent_task_id;
  const hasSubTasks = task?.sub_tasks_count > 0 || confirmedHasSubtasks === true;

  // Additional debug logging
  console.log(`TaskDrawerProgress for task ${task.id} (${task.name}): hasSubTasks=${hasSubTasks}, count=${task.sub_tasks_count}, confirmedHasSubtasks=${confirmedHasSubtasks}`);

  // HIGHEST PRIORITY CHECK: Never show progress inputs for parent tasks with subtasks
  // This check happens before any other logic to ensure consistency
  if (hasSubTasks) {
    console.error(`REJECTED: Progress input for parent task ${task.id} with ${task.sub_tasks_count} subtasks. confirmedHasSubtasks=${confirmedHasSubtasks}`);
    return null;
  }

  // Double-check by directly querying for subtasks from the server
  useEffect(() => {
    if (connected && task.id) {
      socket?.emit(SocketEvents.GET_TASK_SUBTASKS_COUNT.toString(), task.id);
    }
    
    // Listen for the subtask count response
    const handleSubtasksCount = (data: any) => {
      if (data.task_id === task.id) {
        console.log(`Received subtask count for task ${task.id}: ${data.subtask_count}, has_subtasks=${data.has_subtasks}`);
        setConfirmedHasSubtasks(data.has_subtasks);
      }
    };
    
    socket?.on(SocketEvents.TASK_SUBTASKS_COUNT.toString(), handleSubtasksCount);
    
    return () => {
      socket?.off(SocketEvents.TASK_SUBTASKS_COUNT.toString(), handleSubtasksCount);
    };
  }, [socket, connected, task.id]);

  // Never show manual progress input for parent tasks (tasks with subtasks)
  // Only show progress input for tasks without subtasks
  const showManualProgressInput = !hasSubTasks;

  // Only show weight input for subtasks in weighted progress mode
  const showTaskWeightInput = project?.use_weighted_progress && isSubTask && !hasSubTasks;

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

  // One last check before rendering
  if (hasSubTasks) {
    return null;
  }

  const handleProgressChange = (value: number | null) => {
    if (connected && task.id && value !== null && !hasSubTasks) {
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

      // If this is a subtask, request the parent's progress to be updated in UI
      if (parent_task_id) {
        setTimeout(() => {
          socket?.emit(SocketEvents.GET_TASK_PROGRESS.toString(), parent_task_id);
        }, 100);
      }
    }
  };

  const handleWeightChange = (value: number | null) => {
    if (connected && task.id && value !== null && !hasSubTasks) {
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

  // Final safety check
  if (hasSubTasks) {
    return null;
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
