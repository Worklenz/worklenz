import React, { useState, useCallback } from 'react';
import {
  Modal,
  Button,
  Typography,
  Checkbox,
  Space,
  message,
} from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { addSubtaskToParent, addTaskToGroup, duplicateTask, removeTemporarySubtask, selectCurrentGroupingV3, setDuplicateTask } from '@/features/task-management/task-management.slice';
import { useTaskSocketHandlers } from '@/hooks/useTaskSocketHandlers';
import { evt_project_sub_task_duplicate, evt_project_task_duplicate, evt_project_task_list_create_subtask } from '@/shared/worklenz-analytics-events';
import { Task } from '@/types/task-management.types';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { store } from '@/app/store';
import { updateEnhancedKanbanSubtask } from '@/features/enhanced-kanban/enhanced-kanban.slice';
import {
  addTaskToGroup as addEnhancedKanbanTaskToGroup
} from '@/features/enhanced-kanban/enhanced-kanban.slice';
// Replace with your actual duplicate thunk/action
// import { duplicateTaskAsync } from '@/store/tasks/tasksThunks';

const { Title, Text } = Typography;

interface DuplicateTaskModalProps {
  open: boolean;
  onClose: () => void;
  projectId?: string; // optional
}

const DuplicateTaskModal: React.FC<DuplicateTaskModalProps> = ({
  open,
  onClose,
  projectId: propProjectId,
}) => {
  const { t } = useTranslation('task-duplicate');
  const dispatch = useAppDispatch();
  const { trackMixpanelEvent } = useMixpanelTracking();

  const isDarkMode = useAppSelector(state => state.themeReducer?.mode === 'dark');
  const currentProjectId = useAppSelector(state => state.projectReducer.projectId);
  const projectId = propProjectId || currentProjectId;
  const task = useAppSelector(state => state.taskManagement.duplicateTask);
  const currentGroupingV3 = useAppSelector(selectCurrentGroupingV3);

  // Exactly your 8 options – change defaults if you want
  const [options, setOptions] = useState<Record<string, boolean>>({
    subtasks: true,
    attachments: false,
    dates: true,
    dependencies: false,
    assignees: true,
    labels: true,
    customFields: true,
    subscribers: false,
  });

  const [loading, setLoading] = useState(false);

  const toggle = (key: string) => {
    setOptions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleNewTaskReceived = useCallback(
      (response: any) => {
        // Handle array format response [index, taskData]
        const data = Array.isArray(response) ? response[1] : response;
        if (!data) return;
        if (data.parent_task_id) {
          // Handle subtask creation
          const subtask: Task = {
            id: data.id || '',
            task_key: data.task_key || '',
            title: data.name || '',
            description: data.description || '',
            // Prefer canonical status ID if provided; otherwise fall back to category value
            status: (data.status || (
              data.status_category?.is_todo
                ? 'todo'
                : data.status_category?.is_doing
                  ? 'doing'
                  : data.status_category?.is_done
                    ? 'done'
                    : 'todo'
            )) as string,
            priority: (data.priority_value === 3
              ? 'critical'
              : data.priority_value === 2
                ? 'high'
                : data.priority_value === 1
                  ? 'medium'
                  : 'low') as 'critical' | 'high' | 'medium' | 'low',
            phase: data.phase_name || 'Development',
            progress: data.complete_ratio || 0,
            assignees: data.assignees?.map((a: any) => a.team_member_id) || [],
            assignee_names: data.names || [],
            labels:
              data.labels?.map((l: any) => ({
                id: l.id || '',
                name: l.name || '',
                color: l.color_code || '#1890ff',
                end: l.end,
                names: l.names,
              })) || [],
            dueDate: data.end_date,
            timeTracking: {
              estimated: (data.total_hours || 0) + (data.total_minutes || 0) / 60,
              logged: (data.time_spent?.hours || 0) + (data.time_spent?.minutes || 0) / 60,
            },
            created_at: data.created_at || new Date().toISOString(),
            updated_at: data.updated_at || new Date().toISOString(),
            order: data.sort_order || 0,
            parent_task_id: data.parent_task_id,
            is_sub_task: true,
          };
  
          // Before adding the real subtask, remove any temporary subtasks with the same name
          // This prevents duplication from optimistic updates
          const parentTask = store.getState().taskManagement.entities[data.parent_task_id];
          if (parentTask && parentTask.sub_tasks) {
            const temporarySubtasks = parentTask.sub_tasks.filter(
              (st: Task) => st.isTemporary && st.name === subtask.title
            );
  
            // Remove each temporary subtask
            temporarySubtasks.forEach((tempSubtask: Task) => {
              dispatch(
                removeTemporarySubtask({
                  parentTaskId: data.parent_task_id,
                  tempId: tempSubtask.id,
                })
              );
            });
          }
  
          dispatch(addSubtaskToParent({ parentId: data.parent_task_id, subtask }));
  
          // Track subtask creation event
          trackMixpanelEvent(evt_project_sub_task_duplicate, {
            task_id: data.id,
            project_id: data.project_id,
            parent_task_id: data.parent_task_id,
          });
  
          // Also update enhanced kanban slice for subtask creation
          dispatch(
            updateEnhancedKanbanSubtask({
              sectionId: '',
              subtask: data,
              mode: 'add',
            })
          );
        } else {
          // Handle regular task creation - transform to Task format and add
          const task: Task = {
            id: data.id || '',
            task_key: data.task_key || '',
            title: data.name || '',
            description: data.description || '',
            // Prefer concrete status id if provided; fall back to category only if missing
            status: (data.status || data.status_id || (data.status_category?.is_todo
              ? 'todo'
              : data.status_category?.is_doing
                ? 'doing'
                : data.status_category?.is_done
                  ? 'done'
                  : 'todo')) as any,
            priority: (data.priority_value === 3
              ? 'critical'
              : data.priority_value === 2
                ? 'high'
                : data.priority_value === 1
                  ? 'medium'
                  : 'low') as 'critical' | 'high' | 'medium' | 'low',
            phase: data.phase_name || 'Development',
            progress: data.complete_ratio || 0,
            assignees: data.assignees?.map((a: any) => a.team_member_id) || [],
            assignee_names: data.names || [],
            labels:
              data.labels?.map((l: any) => ({
                id: l.id || '',
                name: l.name || '',
                color: l.color_code || '#1890ff',
                end: l.end,
                names: l.names,
              })) || [],
            dueDate: data.end_date,
            startDate: data.start_date,
            timeTracking: {
              estimated: (data.total_hours || 0) + (data.total_minutes || 0) / 60,
              logged: (data.time_spent?.hours || 0) + (data.time_spent?.minutes || 0) / 60,
            },
            created_at: data.created_at || new Date().toISOString(),
            updated_at: data.updated_at || new Date().toISOString(),
            order: data.sort_order || 0,
            sub_tasks: [],
            sub_tasks_count: 0,
            show_sub_tasks: false,
          };
  
          // Extract the group UUID from the backend response based on current grouping
          let groupId: string | undefined;
  
          // Select the correct UUID based on current grouping
          // If currentGroupingV3 is null, default to 'status' since that's the most common grouping
          const grouping = currentGroupingV3 || 'status';
  
          if (grouping === 'status') {
            // For status grouping, use status field (which contains the status UUID)
            groupId = data.status;
          } else if (grouping === 'priority') {
            // For priority grouping, use priority field (which contains the priority UUID)
            groupId = data.priority;
          } else if (grouping === 'phase') {
            // For phase grouping, use phase_id, or 'Unmapped' if no phase_id
            groupId = data.phase_id || 'Unmapped';
          }
  
          // Use addTaskToGroup with the actual group UUID
          dispatch(addTaskToGroup({ task, groupId: groupId || '' }));
  
          // Track regular task creation event
          trackMixpanelEvent(evt_project_task_duplicate, {
            task_id: data.id,
            project_id: data.project_id,
          });
  
          // Also update enhanced kanban slice for regular task creation
          dispatch(
            addEnhancedKanbanTaskToGroup({
              sectionId: groupId || '',
              task: data,
            })
          );
        }
      },
      [dispatch, trackMixpanelEvent]
    );

  const handleDuplicate = useCallback(async () => {
    setLoading(true);
    try {
      const res = await dispatch(
        duplicateTask({
          taskId: task.taskId as string,
          projectId: projectId as string,
          duplicateOptions: options, // exactly the JSON you want
        })
      ).unwrap();
      if (res.done) {
        dispatch(setDuplicateTask({}));
        setOptions({
          subtasks: true,
          attachments: false,
          dates: true,
          dependencies: false,
          assignees: true,
          labels: true,
          customFields: true,
          subscribers: false,
        });
        handleNewTaskReceived(res.body);
        message.success(t('taskDuplicatedSuccess') || 'Task duplicated successfully');
        onClose();
      }

    } catch {
      message.error(t('taskDuplicatedError') || 'Failed to duplicate task');
    } finally {
      setLoading(false);
    }
  }, [dispatch, task.taskId, projectId, options, onClose, t]);

  // Your exact list in the order you wrote
  const checkboxItems = [
    { key: 'subtasks', label: 'Subtasks' },
    { key: 'attachments', label: 'Attachments' },
    { key: 'dates', label: 'Dates' },
    { key: 'dependencies', label: 'Dependencies' },
    { key: 'assignees', label: 'Assignees' },
    { key: 'labels', label: 'Labels' },
    { key: 'customFields', label: 'Custom Field Values' },
    { key: 'subscribers', label: 'Subscribers' },
  ] as const;

  return (
    <Modal
      title={
        <Title level={4} className={`m-0 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          {t('duplicateTask') || 'Duplicate Task'}
        </Title>
      }
      open={open}
      onCancel={onClose}
      width={520}
      footer={
        <div className="flex justify-end gap-3">
          <Button onClick={onClose} disabled={loading}>
            {t('cancel') || 'Cancel'}
          </Button>
          <Button type="primary" loading={loading} onClick={handleDuplicate}>
            {t('duplicate') || 'Duplicate'}
          </Button>
        </div>
      }
      className={isDarkMode ? 'dark-modal' : ''}
    >
      <Text className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>
        {task.title || 'Task Title'}
      </Text>

      <div className="mt-6">
        <Checkbox.Group
          value={Object.keys(options).filter(k => options[k])}
          className="w-full"
        >
          <Space direction="vertical" size={12} className="w-full">
            {checkboxItems.map(item => (
              <Checkbox
                key={item.key}
                value={item.key}
                checked={options[item.key]}
                onChange={() => toggle(item.key)}
                className="text-base"
              >
                {t(`duplicateOptions.${item.key}`) || item.label}
              </Checkbox>
            ))}
          </Space>
        </Checkbox.Group>
      </div>
    </Modal>
  );
};

export default DuplicateTaskModal;