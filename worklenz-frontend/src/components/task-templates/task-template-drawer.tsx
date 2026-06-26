import { useState, useMemo } from 'react';
import {
  Button,
  Checkbox,
  Drawer,
  Form,
  Input,
  List,
  Tag,
  Tooltip,
  Typography,
} from '@/shared/antd-imports';
import { InfoCircleOutlined } from '@/shared/antd-imports';
import { theme } from 'antd';
import { useTranslation } from 'react-i18next';

import { useAppDispatch } from '@/hooks/useAppDispatch';
import { taskTemplatesApiService } from '@/api/task-templates/task-templates.api.service';
import logger from '@/utils/errorLogger';
import {
  ITaskTemplateGetResponse,
  ITaskTemplateSubTask,
  ITaskTemplateTask,
} from '@/types/settings/task-templates.types';
import { useAppSelector } from '@/hooks/useAppSelector';
import { setSelectedTasks } from '@/features/project/project.slice';

interface TaskTemplateDrawerProps {
  showDrawer: boolean;
  selectedTemplateId: string | null;
  onClose: () => void;
  /** Called only after a template is successfully saved. Use this to clear task selection. */
  onSaved?: () => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Count all tasks in the tree: parent + all subtasks + all grandchildren. */
function countAllTasks(tasks: ITaskTemplateTask[]): number {
  return tasks.reduce((sum, task) => {
    const subtaskCount = (task.sub_tasks || []).reduce(
      (s, sub) => s + 1 + (sub.sub_tasks?.length ?? 0),
      0
    );
    return sum + 1 + subtaskCount;
  }, 0);
}

/**
 * Flatten the task tree to top-level only (strip all sub_tasks).
 * Used when the user unchecks "Include subtasks hierarchy".
 * Every task — including previously nested ones — becomes a top-level entry.
 */
function flattenToTopLevel(tasks: ITaskTemplateTask[]): ITaskTemplateTask[] {
  const flat: ITaskTemplateTask[] = [];
  for (const task of tasks) {
    flat.push({ name: task.name, total_minutes: task.total_minutes });
    for (const sub of task.sub_tasks || []) {
      flat.push({ name: sub.name, total_minutes: sub.total_minutes });
      for (const grand of sub.sub_tasks || []) {
        flat.push({ name: grand.name, total_minutes: grand.total_minutes });
      }
    }
  }
  return flat;
}

/**
 * Convert IProjectTask[] (already hierarchy-aware, built by handleOpenTemplateDrawer)
 * into ITaskTemplateTask[] for the API payload and preview.
 */
function projectTasksToTemplateTasks(projectTasks: any[]): ITaskTemplateTask[] {
  return projectTasks.map(task => ({
    name: task.name || '',
    total_minutes: task.total_minutes ?? 0,
    ...(task.sub_tasks && task.sub_tasks.length > 0
      ? {
          sub_tasks: task.sub_tasks.map((sub: any) => ({
            name: sub.name || '',
            total_minutes: sub.total_minutes ?? 0,
            ...(sub.sub_tasks && sub.sub_tasks.length > 0
              ? {
                  sub_tasks: sub.sub_tasks.map((grand: any) => ({
                    name: grand.name || '',
                    total_minutes: grand.total_minutes ?? 0,
                  })),
                }
              : {}),
          })),
        }
      : {}),
  }));
}

// ─── Sub-component: renders one subtask row + its grandchildren ──────────────

const SubTaskRow: React.FC<{ subtask: ITaskTemplateSubTask }> = ({ subtask }) => {
  const { token } = theme.useToken();

  return (
    <div>
      {/* Level-2 subtask */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '2px 0',
          fontSize: 13,
        }}
      >
        <span style={{ color: token.colorTextQuaternary }}>↳</span>
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          {subtask.name}
        </Typography.Text>
        {subtask.sub_tasks && subtask.sub_tasks.length > 0 && (
          <Tag color="geekblue" style={{ cursor: 'default', fontSize: 11, padding: '0 4px' }}>
            {subtask.sub_tasks.length}
          </Tag>
        )}
      </div>

      {/* Level-3 grandchildren */}
      {subtask.sub_tasks && subtask.sub_tasks.length > 0 && (
        <div style={{ paddingLeft: 20 }}>
          {subtask.sub_tasks.map((grandchild, gcIdx) => (
            <div
              key={gcIdx}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '2px 0',
                fontSize: 12,
              }}
            >
              <span style={{ color: token.colorTextQuaternary }}>↳</span>
              <Typography.Text type="secondary" style={{ fontSize: 12, opacity: 0.75 }}>
                {grandchild.name}
              </Typography.Text>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Main component ──────────────────────────────────────────────────────────

const TaskTemplateDrawer = ({
  showDrawer = false,
  selectedTemplateId,
  onClose,
  onSaved,
}: TaskTemplateDrawerProps) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('task-template-drawer');
  const [form] = Form.useForm();

  const [templateData, setTemplateData] = useState<ITaskTemplateGetResponse>({});
  const [isLoading, setIsLoading] = useState(false);
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  const [updatingTemplate, setUpdatingTemplate] = useState(false);
  // Controls whether the selected hierarchy is preserved or flattened
  const [includeSubtasks, setIncludeSubtasks] = useState(true);

  // selectedTasks is the hierarchy-aware IProjectTask[] built by handleOpenTemplateDrawer
  const { selectedTasks } = useAppSelector(state => state.bulkActionReducer);

  // Show the checkbox only when the selection actually contains a hierarchy
  const hasAnySubtasks = useMemo(
    () => selectedTasks.some(task => task.sub_tasks && task.sub_tasks.length > 0),
    [selectedTasks]
  );

  const onCloseDrawer = () => {
    form.resetFields();
    setTemplateData({});
    setIncludeSubtasks(true);
    onClose();
  };

  const fetchTemplateData = async () => {
    if (!selectedTemplateId) return;
    try {
      setIsLoading(true);
      const res = await taskTemplatesApiService.getTemplate(selectedTemplateId);
      if (res.done) {
        setTemplateData(res.body);
        form.setFieldsValue({ name: res.body.name });
      }
    } catch (error) {
      logger.error('Failed to fetch template data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const afterOpenChange = (open: boolean) => {
    if (!open) return;
    if (selectedTemplateId) {
      // Editing an existing template — fetch from server
      fetchTemplateData();
    } else {
      // Creating a new template — selectedTasks already has the correct
      // hierarchy built by handleOpenTemplateDrawer (selection-aware tree).
      // Convert to ITaskTemplateTask[] for the preview and payload.
      const tasks = projectTasksToTemplateTasks(selectedTasks);
      setTemplateData({ tasks });
    }
  };

  const handleRemoveTask = (index: number) => {
    const updated = [...(templateData.tasks || [])];
    updated.splice(index, 1);
    setTemplateData({ ...templateData, tasks: updated });
  };

  /**
   * Build the final payload for the API.
   * - includeSubtasks = true  → send the hierarchy as-is
   * - includeSubtasks = false → flatten everything to top-level tasks
   */
  const buildPayloadTasks = (): ITaskTemplateTask[] => {
    const tasks = templateData.tasks || [];
    if (!includeSubtasks) return flattenToTopLevel(tasks);
    return tasks;
  };

  const createTemplate = async () => {
    const values = form.getFieldsValue();
    if (!values.name) return;
    const payloadTasks = buildPayloadTasks();
    if (!payloadTasks.length) return;
    try {
      setCreatingTemplate(true);
      const res = await taskTemplatesApiService.createTemplate({
        name: values.name.trim(),
        tasks: payloadTasks,
      });
      if (res.done) {
        // Reset drawer state
        form.resetFields();
        setTemplateData({});
        setIncludeSubtasks(true);
        // Clear the Redux template selection state
        dispatch(setSelectedTasks([]));
        // Notify parent: saved successfully (triggers selection clear in task list)
        onSaved?.();
        onClose();
      }
    } catch (error) {
      logger.error('Failed to create template:', error);
    } finally {
      setCreatingTemplate(false);
    }
  };

  const updateTemplate = async () => {
    if (!selectedTemplateId) return;
    const values = form.getFieldsValue();
    if (!values.name) return;
    const payloadTasks = buildPayloadTasks();
    if (!payloadTasks.length) return;
    try {
      setUpdatingTemplate(true);
      const res = await taskTemplatesApiService.updateTemplate(selectedTemplateId, {
        name: values.name.trim(),
        tasks: payloadTasks,
      });
      if (res.done) {
        // Reset drawer state
        form.resetFields();
        setTemplateData({});
        setIncludeSubtasks(true);
        dispatch(setSelectedTasks([]));
        onSaved?.();
        onClose();
      }
    } catch (error) {
      logger.error('Failed to update template:', error);
    } finally {
      setUpdatingTemplate(false);
    }
  };

  const handleSaveTemplate = () => {
    form.validateFields().then(() => {
      if (!selectedTemplateId) {
        createTemplate();
      } else {
        updateTemplate();
      }
    });
  };

  // Display list respects the includeSubtasks toggle for live preview
  const displayTasks = useMemo((): ITaskTemplateTask[] => {
    const tasks = templateData.tasks || [];
    if (!includeSubtasks) return flattenToTopLevel(tasks);
    return tasks;
  }, [templateData.tasks, includeSubtasks]);

  const totalTaskCount = useMemo(
    () => (includeSubtasks ? countAllTasks(displayTasks) : displayTasks.length),
    [displayTasks, includeSubtasks]
  );

  return (
    <Drawer
      width={650}
      title={selectedTemplateId ? t('editTaskTemplate') : t('createTaskTemplate')}
      open={showDrawer}
      onClose={onCloseDrawer}
      afterOpenChange={afterOpenChange}
      destroyOnHidden={true}
      footer={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'right' }}>
          <Button onClick={onCloseDrawer}>{t('cancelButton')}</Button>
          <Button
            type="primary"
            onClick={handleSaveTemplate}
            loading={creatingTemplate || updatingTemplate}
          >
            {t('saveButton')}
          </Button>
        </div>
      }
    >
      <Form form={form} initialValues={{ name: templateData?.name }}>
        <Form.Item
          name="name"
          label={t('templateNameText')}
          rules={[{ required: true, message: t('templateNameRequired') }]}
        >
          <Input type="text" />
        </Form.Item>

        {/* Hierarchy toggle — only shown when the selection has a parent-child structure */}
        {hasAnySubtasks && (
          <Form.Item style={{ marginBottom: 12 }}>
            <Checkbox
              checked={includeSubtasks}
              onChange={e => setIncludeSubtasks(e.target.checked)}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {t('includeSubtasks', { defaultValue: 'Include subtask hierarchy' })}
                <Tooltip
                  title={t('subtaskHierarchyInfo', {
                    defaultValue:
                      'When checked, subtasks are saved under their parent task. When unchecked, subtasks are saved as separate main tasks.',
                  })}
                  placement="right"
                >
                  <InfoCircleOutlined style={{ fontSize: 13, opacity: 0.45, cursor: 'help' }} />
                </Tooltip>
              </span>
            </Checkbox>
          </Form.Item>
        )}

        <Typography.Text style={{ fontWeight: 700 }}>
          {t('selectedTasks')} ({totalTaskCount})
        </Typography.Text>

        <div style={{ marginTop: '1.5rem' }}>
          <List
            loading={isLoading}
            bordered
            dataSource={displayTasks}
            renderItem={(item, index) => (
              <List.Item>
                <div style={{ width: '100%' }}>
                  {/* Level-1: parent task row */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span style={{ fontWeight: 500 }}>{item.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {item.sub_tasks && item.sub_tasks.length > 0 && (
                        <Tooltip
                          title={t('subtaskCount', {
                            count: item.sub_tasks.length,
                            defaultValue: `${item.sub_tasks.length} subtask(s)`,
                          })}
                        >
                          <Tag color="blue" style={{ cursor: 'default' }}>
                            {item.sub_tasks.length}{' '}
                            {t('subtasksLabel', { defaultValue: 'subtask(s)' })}
                          </Tag>
                        </Tooltip>
                      )}
                      <Button type="link" onClick={() => handleRemoveTask(index)}>
                        {t('removeTask')}
                      </Button>
                    </div>
                  </div>

                  {/* Level-2 subtasks + Level-3 grandchildren */}
                  {item.sub_tasks && item.sub_tasks.length > 0 && (
                    <div style={{ marginTop: 6, paddingLeft: 16 }}>
                      {item.sub_tasks.map((subtask, subIndex) => (
                        <SubTaskRow key={subIndex} subtask={subtask} />
                      ))}
                    </div>
                  )}
                </div>
              </List.Item>
            )}
          />
        </div>
      </Form>
    </Drawer>
  );
};

export default TaskTemplateDrawer;
