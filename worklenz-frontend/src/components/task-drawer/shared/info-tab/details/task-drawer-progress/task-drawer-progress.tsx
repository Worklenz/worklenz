import { Form, InputNumber, Tooltip, Modal } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { QuestionCircleOutlined } from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';
import { ITaskViewModel } from '@/types/tasks/task.types';
import Flex from 'antd/lib/flex';
import { SocketEvents } from '@/shared/socket-events';
import { useState, useEffect } from 'react';
import { useSocket } from '@/socket/socketContext';
import { useAuthService } from '@/hooks/useAuth';
import logger from '@/utils/errorLogger';
import { ITaskListStatusChangeResponse } from '@/types/tasks/task-list-status.types';
import { setTaskStatus } from '@/features/task-drawer/task-drawer.slice';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { updateBoardTaskStatus } from '@/features/board/board-slice';
import { updateTaskProgress, updateTaskStatus } from '@/features/tasks/tasks.slice';
import {
  updateEnhancedKanbanTaskStatus,
  updateEnhancedKanbanTaskProgress,
} from '@/features/enhanced-kanban/enhanced-kanban.slice';
import useTabSearchParam from '@/hooks/useTabSearchParam';

interface TaskDrawerProgressProps {
  task: ITaskViewModel;
  form: any;
}

const TaskDrawerProgress = ({ task, form }: TaskDrawerProgressProps) => {
  const { t } = useTranslation('task-drawer/task-drawer');
  const dispatch = useAppDispatch();
  const { tab } = useTabSearchParam();

  const { project } = useAppSelector(state => state.projectReducer);
  const { socket, connected } = useSocket();
  const [isCompletionModalVisible, setIsCompletionModalVisible] = useState(false);
  const currentSession = useAuthService().getCurrentSession();

  const isSubTask = !!task?.parent_task_id;
  // Safe handling of sub_tasks_count which might be undefined in some cases
  const hasSubTasks = (task?.sub_tasks_count || 0) > 0;

  // HIGHEST PRIORITY CHECK: Never show progress inputs for parent tasks with subtasks
  if (hasSubTasks) {
    return null;
  }

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

        // Check if we should prompt the user to mark the task as done
        if (data.should_prompt_for_done) {
          setIsCompletionModalVisible(true);
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
      // Check if progress is set to 100% to show completion confirmation
      if (value === 100) {
        setIsCompletionModalVisible(true);
      }

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

      socket?.once(SocketEvents.GET_TASK_PROGRESS.toString(), (data: any) => {
        if (tab === 'tasks-list') {
          dispatch(
            updateTaskProgress({
              taskId: task.id,
              progress: data.complete_ratio,
              totalTasksCount: data.total_tasks_count,
              completedCount: data.completed_count,
            })
          );
        }
        if (tab === 'board') {
          dispatch(
            updateEnhancedKanbanTaskProgress({
              id: task.id,
              complete_ratio: data.complete_ratio,
              completed_count: data.completed_count,
              total_tasks_count: data.total_tasks_count,
              parent_task: task.parent_task_id || null,
            })
          );
        }
      });

      if (task.id) {
        setTimeout(() => {
          socket?.emit(SocketEvents.GET_TASK_PROGRESS.toString(), task.id);
        }, 500);
      }

      // If this is a subtask, request the parent's progress to be updated in UI
      if (parent_task_id) {
        setTimeout(() => {
          socket?.emit(SocketEvents.GET_TASK_PROGRESS.toString(), parent_task_id);
        }, 500);
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

  const handleMarkTaskAsComplete = () => {
    // Close the modal
    setIsCompletionModalVisible(false);

    // Find a "Done" status for this project
    if (connected && task.id) {
      // Emit socket event to get "done" category statuses
      socket?.emit(
        SocketEvents.GET_DONE_STATUSES.toString(),
        task.project_id,
        (doneStatuses: any[]) => {
          if (doneStatuses && doneStatuses.length > 0) {
            // Use the first "done" status
            const doneStatusId = doneStatuses[0].id;

            // Emit socket event to update the task status
            socket?.emit(
              SocketEvents.TASK_STATUS_CHANGE.toString(),
              JSON.stringify({
                task_id: task.id,
                status_id: doneStatusId,
                project_id: task.project_id,
                team_id: currentSession?.team_id,
                parent_task: task.parent_task_id || null,
              })
            );
            socket?.once(
              SocketEvents.TASK_STATUS_CHANGE.toString(),
              (data: ITaskListStatusChangeResponse) => {
                dispatch(setTaskStatus(data));

                if (tab === 'tasks-list') {
                  dispatch(updateTaskStatus(data));
                }
                if (tab === 'board') {
                  dispatch(updateEnhancedKanbanTaskStatus(data));
                }
                if (data.parent_task)
                  socket?.emit(SocketEvents.GET_TASK_PROGRESS.toString(), data.parent_task);
              }
            );
          } else {
            logger.error(`No "done" statuses found for project ${task.project_id}`);
          }
        }
      );
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
              let value = percentParser(e.target.value);
              // Ensure value doesn't exceed 100
              if (value > 100) {
                value = 100;
                form.setFieldsValue({ weight: 100 });
              }
              handleWeightChange(value);
            }}
            onChange={value => {
              if (value !== null && value > 100) {
                form.setFieldsValue({ weight: 100 });
                handleWeightChange(100);
              }
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
              let value = percentParser(e.target.value);
              // Ensure value doesn't exceed 100
              if (value > 100) {
                value = 100;
                form.setFieldsValue({ progress_value: 100 });
              }
              handleProgressChange(value);
            }}
            onChange={value => {
              if (value !== null && value > 100) {
                form.setFieldsValue({ progress_value: 100 });
                handleProgressChange(100);
              }
            }}
          />
        </Form.Item>
      )}

      <Modal
        title={t('taskProgress.markAsDoneTitle', 'Mark Task as Done?')}
        open={isCompletionModalVisible}
        onOk={handleMarkTaskAsComplete}
        onCancel={() => setIsCompletionModalVisible(false)}
        okText={t('taskProgress.confirmMarkAsDone', 'Yes, mark as done')}
        cancelText={t('taskProgress.cancelMarkAsDone', 'No, keep current status')}
      >
        <p>
          {t(
            'taskProgress.markAsDoneDescription',
            'You\'ve set the progress to 100%. Would you like to update the task status to "Done"?'
          )}
        </p>
      </Modal>
    </>
  );
};

export default TaskDrawerProgress;
