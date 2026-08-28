import { useEffect, useRef } from 'react';
import { Form, ConfigProvider, Flex } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { ITaskFormViewModel, ITaskViewModel } from '@/types/tasks/task.types';

import NotifyMemberSelector from './notify-member-selector';
import TaskDrawerPhaseSelector from './details/task-drawer-phase-selector/task-drawer-phase-selector';
import TaskDrawerKey from './details/task-drawer-key/task-drawer-key';
import TaskDrawerLabels from './details/task-drawer-labels/task-drawer-labels';
import TaskDrawerAssigneeSelector from './details/task-drawer-assignee-selector/task-drawer-assignee-selector';
import Avatars from '@/components/avatars/avatars';
import TaskDrawerDueDate from './details/task-drawer-due-date/task-drawer-due-date';
import TaskDrawerEstimation from './details/task-drawer-estimation/task-drawer-estimation';
import TaskDrawerPrioritySelector from './details/task-drawer-priority-selector/task-drawer-priority-selector';
import TaskDrawerBillable from './details/task-drawer-billable/task-drawer-billable';
import TaskDrawerProgress from './details/task-drawer-progress/task-drawer-progress';
import { useAppSelector } from '@/hooks/useAppSelector';
import logger from '@/utils/errorLogger';
import TaskDrawerRecurringConfig from './details/task-drawer-recurring-config/task-drawer-recurring-config';
import { InlineMember } from '@/types/teamMembers/inlineMember.types';

interface TaskDetailsFormProps {
  taskFormViewModel?: ITaskFormViewModel | null;
  canCreateTask?: boolean;
  isGuest?: boolean;
}

// Custom wrapper that enforces stricter rules for displaying progress input
interface ConditionalProgressInputProps {
  task: ITaskViewModel;
  form: any; // Using any for the form as the exact type may be complex
}

const ConditionalProgressInput = ({ task, form }: ConditionalProgressInputProps) => {
  const { project } = useAppSelector(state => state.projectReducer);
  const hasSubTasks = task?.sub_tasks_count > 0;
  const isSubTask = !!task?.parent_task_id;

  // STRICT RULE: Never show progress input for parent tasks with subtasks
  // This is the most important check and must be done first
  if (hasSubTasks) {
    logger.debug(`Task ${task.id} has ${task.sub_tasks_count} subtasks. Hiding progress input.`);
    return null;
  }

  // Only for tasks without subtasks, determine which input to show based on project mode
  if (project?.use_time_progress) {
    // In time-based mode, show progress input ONLY for tasks without subtasks
    return (
      <TaskDrawerProgress task={{ ...task, sub_tasks_count: hasSubTasks ? 1 : 0 }} form={form} />
    );
  } else if (project?.use_manual_progress) {
    // In manual mode, show progress input ONLY for tasks without subtasks
    return (
      <TaskDrawerProgress task={{ ...task, sub_tasks_count: hasSubTasks ? 1 : 0 }} form={form} />
    );
  } else if (project?.use_weighted_progress && isSubTask) {
    // In weighted mode, show weight input for subtasks
    return (
      <TaskDrawerProgress task={{ ...task, sub_tasks_count: hasSubTasks ? 1 : 0 }} form={form} />
    );
  }

  return null;
};

const TaskDetailsForm = ({ taskFormViewModel = null, canCreateTask = true, isGuest = false }: TaskDetailsFormProps) => {
  const { t } = useTranslation('task-drawer/task-drawer');
  const [form] = Form.useForm();
  const { project } = useAppSelector(state => state.projectReducer);

  // Use ref to track the current task ID to prevent unnecessary form resets
  const previousTaskIdRef = useRef<string | null>(null);

  // Guests cannot edit tasks - disable all fields
  const isReadOnly = isGuest || !canCreateTask;

  useEffect(() => {
    if (!taskFormViewModel) {
      form.resetFields();
      previousTaskIdRef.current = null;
      return;
    }

    const { task } = taskFormViewModel;
    const currentTaskId = task?.id;

    // Only reset form fields when the task ID changes (different task loaded)
    // This prevents form resets when individual fields are updated via socket
    if (currentTaskId && currentTaskId !== previousTaskIdRef.current) {
      form.setFieldsValue({
        taskId: task?.id,
        phase: task?.phase_id,
        assignees: task?.assignees,
        dueDate: task?.end_date ?? null,
        dueTime: task?.due_time || null,
        hours: task?.total_hours || 0,
        minutes: task?.total_minutes || 0,
        priority: task?.priority_id || 'medium',
        labels: task?.labels || [],
        billable: task?.billable || false,
        notify: [],
        progress_value: task?.progress_value || null,
        weight: task?.weight || null,
      });

      // Update the ref to track the current task
      previousTaskIdRef.current = currentTaskId;
    }
  }, [taskFormViewModel?.task?.id, form]);

  const priorityMenuItems = taskFormViewModel?.priorities?.map(priority => ({
    key: priority.id,
    value: priority.id,
    label: priority.name,
  }));

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      console.log('task details form values', values);
    } catch (error) {
      console.error('Form validation failed:', error);
    }
  };

  return (
    <ConfigProvider
      theme={{
        components: {
          Form: { itemMarginBottom: 8 },
        },
      }}
    >
      <Form
        form={form}
        layout="horizontal"
        labelCol={{ span: 6 }}
        wrapperCol={{ span: 18 }}
        initialValues={{
          priority: 'medium',
          hours: 0,
          minutes: 0,
          billable: false,
          progress_value: null,
          weight: null,
          dueTime: null,
        }}
        onFinish={handleSubmit}
        disabled={isReadOnly}
      >
        <TaskDrawerKey
          taskKey={taskFormViewModel?.task?.task_key || 'NEW-TASK'}
          label={t('taskInfoTab.details.task-key')}
        />
        {taskFormViewModel?.task && (
          <TaskDrawerPhaseSelector
            phases={taskFormViewModel?.phases || []}
            task={taskFormViewModel.task as ITaskViewModel}
          />
        )}

        <Form.Item name="assignees" label={t('taskInfoTab.details.assignees')}>
          {!isGuest ? (
            <Flex gap={4} align="center">
              <Avatars
                members={
                  taskFormViewModel?.task?.assignee_names ||
                  (taskFormViewModel?.task?.names as unknown as InlineMember[]) ||
                  []
                }
              />
              <TaskDrawerAssigneeSelector
                task={(taskFormViewModel?.task as ITaskViewModel) || null}
              />
            </Flex>
          ) : (
            <Avatars
              members={
                taskFormViewModel?.task?.assignee_names ||
                (taskFormViewModel?.task?.names as unknown as InlineMember[]) ||
                []
              }
            />
          )}
        </Form.Item>

     {taskFormViewModel?.task && (
  <TaskDrawerDueDate task={taskFormViewModel.task as ITaskViewModel} t={t} form={form} disabled={isGuest} />
)}

        {taskFormViewModel?.task && (
          <TaskDrawerEstimation t={t} task={taskFormViewModel.task as ITaskViewModel} form={form} disabled={isGuest} />
        )}

        {taskFormViewModel?.task && (
          <ConditionalProgressInput task={taskFormViewModel?.task as ITaskViewModel} form={form} />
        )}

        <Form.Item name="priority" label={t('taskInfoTab.details.priority')}>
          {taskFormViewModel?.task && (
            <TaskDrawerPrioritySelector task={taskFormViewModel.task as ITaskViewModel} />
          )}
        </Form.Item>

        {taskFormViewModel?.task && (
          <TaskDrawerLabels task={taskFormViewModel.task as ITaskViewModel} t={t} isGuest={isGuest} />
        )}

        <Form.Item name="billable" label={t('taskInfoTab.details.billable')}>
          {taskFormViewModel?.task && (
            <TaskDrawerBillable task={taskFormViewModel.task as ITaskViewModel} disabled={isGuest} />
          )}
        </Form.Item>

        <Form.Item name="recurring" label={t('taskInfoTab.details.recurring')}>
          {taskFormViewModel?.task && (
            <TaskDrawerRecurringConfig task={taskFormViewModel.task as ITaskViewModel} disabled={isGuest} />
          )}
        </Form.Item>

        <Form.Item name="notify" label={t('taskInfoTab.details.notify')}>
          {taskFormViewModel?.task && (
            <NotifyMemberSelector task={taskFormViewModel.task as ITaskViewModel} t={t} disabled={isGuest} />
          )}
        </Form.Item>
      </Form>
    </ConfigProvider>
  );
};

export default TaskDetailsForm;
