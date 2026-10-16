import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Checkbox,
  Flex,
  Form,
  Input,
  List,
  Modal,
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
const countAllTasks = (tasks: ITaskTemplateTask[]): number => {
  return tasks.reduce((sum, task) => {
    const subtaskCount = (task.sub_tasks || []).reduce(
      (s, sub) => s + 1 + (sub.sub_tasks?.length ?? 0),
      0
    );
    return sum + 1 + subtaskCount;
  }, 0);
};

/**
 * Flatten the task tree to top-level only (strip all sub_tasks).
 * Used when the user unchecks "Include subtasks hierarchy".
 * Every task — including previously nested ones — becomes a top-level entry.
 */
const flattenToTopLevel = (tasks: ITaskTemplateTask[]): ITaskTemplateTask[] => {
  const flat: ITaskTemplateTask[] = [];
  for (const task of tasks) {
    flat.push({ id: task.id, name: task.name, total_minutes: task.total_minutes });
    for (const sub of task.sub_tasks || []) {
      flat.push({ id: sub.id, name: sub.name, total_minutes: sub.total_minutes });
      for (const grand of sub.sub_tasks || []) {
        flat.push({ id: grand.id, name: grand.name, total_minutes: grand.total_minutes });
      }
    }
  }
  return flat;
};

/**
 * Convert IProjectTask[] (already hierarchy-aware, built by handleOpenTemplateDrawer)
 * into ITaskTemplateTask[] for the API payload and preview.
 */
const projectTasksToTemplateTasks = (projectTasks: any[]): ITaskTemplateTask[] => {
  return projectTasks.map(task => ({
    id: task.id,
    name: task.name || '',
    total_minutes: task.total_minutes ?? 0,
    ...(task.sub_tasks && task.sub_tasks.length > 0
      ? {
          sub_tasks: task.sub_tasks.map((sub: any) => ({
            id: sub.id,
            name: sub.name || '',
            total_minutes: sub.total_minutes ?? 0,
            ...(sub.sub_tasks && sub.sub_tasks.length > 0
              ? {
                  sub_tasks: sub.sub_tasks.map((grand: any) => ({
                    id: grand.id,
                    name: grand.name || '',
                    total_minutes: grand.total_minutes ?? 0,
                  })),
                }
              : {}),
          })),
        }
      : {}),
  }));
};

// ─── Sub-component: renders one subtask row + its grandchildren ──────────────

const SubTaskRow: React.FC<{ subtask: ITaskTemplateSubTask }> = ({ subtask }) => {
  const { token } = theme.useToken();

  return (
    <div>
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
  const { token } = theme.useToken();
  const [form] = Form.useForm();

  const [templateData, setTemplateData] = useState<ITaskTemplateGetResponse>({});
  const [isLoading, setIsLoading] = useState(false);
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  const [updatingTemplate, setUpdatingTemplate] = useState(false);
  const [includeSubtasks, setIncludeSubtasks] = useState(true);

  const { selectedTasks } = useAppSelector(state => state.bulkActionReducer);

  const hasAnySubtasks = useMemo(
    () => selectedTasks.some(task => task.sub_tasks && task.sub_tasks.length > 0),
    [selectedTasks]
  );

  const isSaving = creatingTemplate || updatingTemplate;

  const resetState = () => {
    form.resetFields();
    setTemplateData({});
    setIncludeSubtasks(true);
  };

  const handleClose = () => {
    if (isSaving) return;
    resetState();
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

  useEffect(() => {
    if (!showDrawer) return;

    if (selectedTemplateId) {
      fetchTemplateData();
      return;
    }

    const tasks = projectTasksToTemplateTasks(selectedTasks);
    setTemplateData({ tasks });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once when opened
  }, [showDrawer, selectedTemplateId]);

  const handleRemoveTask = (index: number) => {
    const updated = [...(templateData.tasks || [])];
    updated.splice(index, 1);
    setTemplateData({ ...templateData, tasks: updated });
  };

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
        resetState();
        dispatch(setSelectedTasks([]));
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
        resetState();
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

  const displayTasks = useMemo((): ITaskTemplateTask[] => {
    const tasks = templateData.tasks || [];
    if (!includeSubtasks) return flattenToTopLevel(tasks);
    return tasks;
  }, [templateData.tasks, includeSubtasks]);

  const totalTaskCount = useMemo(
    () => (includeSubtasks ? countAllTasks(displayTasks) : displayTasks.length),
    [displayTasks, includeSubtasks]
  );

  const title = selectedTemplateId ? t('editTaskTemplate') : t('createTaskTemplate');

  return (
    <Modal
      title={<span id="task-template-modal-title">{title}</span>}
      open={showDrawer}
      onCancel={handleClose}
      width={720}
      centered
      destroyOnHidden
      maskClosable={!isSaving}
      keyboard={!isSaving}
      aria-labelledby="task-template-modal-title"
      footer={
        <Flex justify="flex-end" gap={8}>
          <Button
            onClick={handleClose}
            disabled={isSaving}
            aria-label={t('cancelButton')}
          >
            {t('cancelButton')}
          </Button>
          <Button
            type="primary"
            onClick={handleSaveTemplate}
            loading={isSaving}
            disabled={isLoading}
            aria-label={t('saveButton')}
          >
            {t('saveButton')}
          </Button>
        </Flex>
      }
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{ name: templateData?.name }}
        style={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: 4 }}
      >
        <Form.Item
          name="name"
          label={t('templateNameText')}
          rules={[{ required: true, message: t('templateNameRequired') }]}
        >
          <Input
            type="text"
            maxLength={100}
            aria-label={t('templateNameText')}
            autoFocus
          />
        </Form.Item>

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

        <div style={{ marginTop: 16 }}>
          <List
            loading={isLoading}
            bordered
            dataSource={displayTasks}
            style={{
              borderRadius: token.borderRadiusLG ?? 8,
              borderColor: token.colorBorderSecondary,
            }}
            renderItem={(item, index) => (
              <List.Item>
                <div style={{ width: '100%' }}>
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
                      <Button
                        type="link"
                        onClick={() => handleRemoveTask(index)}
                        aria-label={t('removeTask')}
                      >
                        {t('removeTask')}
                      </Button>
                    </div>
                  </div>

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
    </Modal>
  );
};

export default TaskTemplateDrawer;
