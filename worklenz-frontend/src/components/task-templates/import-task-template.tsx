import { useState } from 'react';
import { safeTextDisplay } from '@/utils/html-entities';
import {
  Button,
  Divider,
  Drawer,
  Flex,
  Form,
  List,
  Select,
  Tag,
  Tooltip,
  Typography,
} from '@/shared/antd-imports';
import { theme } from 'antd';
import { useTranslation } from 'react-i18next';

import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  ITaskTemplatesGetResponse,
  ITaskTemplateSubTask,
  ITaskTemplateTask,
} from '@/types/settings/task-templates.types';
import { taskTemplatesApiService } from '@/api/task-templates/task-templates.api.service';
import logger from '@/utils/errorLogger';
import { setImportTaskTemplateDrawerOpen } from '@/features/project/project.slice';
import useTabSearchParam from '@/hooks/useTabSearchParam';
import { fetchTasksV3 } from '@/features/task-management/task-management.slice';
import { fetchEnhancedKanbanGroups } from '@/features/enhanced-kanban/enhanced-kanban.slice';

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
          {safeTextDisplay(subtask.name)}
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
              <Typography.Text
                type="secondary"
                style={{ fontSize: 12, opacity: 0.75 }}
              >
                {safeTextDisplay(grandchild.name)}
              </Typography.Text>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Main component ──────────────────────────────────────────────────────────

const ImportTaskTemplate = () => {
  const dispatch = useAppDispatch();
  const [form] = Form.useForm();
  const { t } = useTranslation('project-view/import-task-templates');
  const { tab } = useTabSearchParam();

  const { importTaskTemplateDrawerOpen, projectId } = useAppSelector(state => state.projectReducer);

  const [templates, setTemplates] = useState<ITaskTemplatesGetResponse[]>([]);
  const [tasks, setTasks] = useState<ITaskTemplateTask[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [importing, setImporting] = useState(false);

  const handleClose = () => {
    form.resetFields();
    setTasks([]);
    dispatch(setImportTaskTemplateDrawerOpen(false));
  };

  const fetchTemplates = async () => {
    try {
      setLoadingTemplates(true);
      const res = await taskTemplatesApiService.getTemplates();
      if (res.done) {
        setTemplates(res.body);
      }
    } catch (error) {
      logger.error('Error fetching templates', error);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const fetchTasks = async (templateId: string) => {
    try {
      setLoadingTasks(true);
      const res = await taskTemplatesApiService.getTemplate(templateId);
      if (res.done) {
        setTasks(res.body?.tasks || []);
      }
    } catch (error) {
      logger.error('Error fetching tasks', error);
    } finally {
      setLoadingTasks(false);
    }
  };

  const handleTemplateSelect = (value: string) => {
    if (!value) return;
    fetchTasks(value);
  };

  const handleAfterOpenChange = (open: boolean) => {
    if (open) {
      fetchTemplates();
    }
  };

  const handleImport = async () => {
    if (!projectId || tasks.length === 0) return;
    try {
      setImporting(true);
      const res = await taskTemplatesApiService.importTemplate(projectId, tasks);
      if (res.done) {
        if (tab === 'board') {
          dispatch(fetchEnhancedKanbanGroups(projectId));
        }
        if (tab === 'tasks-list') {
          dispatch(fetchTasksV3(projectId));
        }
        dispatch(setImportTaskTemplateDrawerOpen(false));
      }
    } catch (error) {
      logger.error('Error importing task template', error);
    } finally {
      setImporting(false);
    }
  };

  const handleRemoveTask = (index: number) => {
    const newTasks = [...tasks];
    newTasks.splice(index, 1);
    setTasks(newTasks);
  };

  // Total count: parent tasks + subtasks + grandchildren
  const totalTaskCount = tasks.reduce((sum, task) => {
    const subtaskTotal = (task.sub_tasks || []).reduce(
      (s, sub) => s + 1 + (sub.sub_tasks?.length ?? 0),
      0
    );
    return sum + 1 + subtaskTotal;
  }, 0);

  return (
    <Drawer
      title={t('importTaskTemplate')}
      open={importTaskTemplateDrawerOpen}
      onClose={handleClose}
      width={650}
      afterOpenChange={handleAfterOpenChange}
      destroyOnHidden={true}
      footer={
        <Flex justify="end" gap={10}>
          <Button onClick={handleClose}>{t('cancel')}</Button>
          <Button
            type="primary"
            onClick={handleImport}
            loading={importing}
            disabled={tasks.length === 0}
          >
            {t('import')}
          </Button>
        </Flex>
      }
    >
      <Form form={form} layout="horizontal">
        <Form.Item name="templateName" label={t('templateName')}>
          <Select
            options={templates.map(tmpl => ({ label: tmpl.name, value: tmpl.id }))}
            loading={loadingTemplates}
            onSelect={handleTemplateSelect}
          />
        </Form.Item>
        <Divider />

        <Typography.Text strong>
          {t('selectedTasks')} ({totalTaskCount})
        </Typography.Text>

        <List
          loading={loadingTasks}
          dataSource={tasks}
          bordered
          style={{ marginTop: 12 }}
          renderItem={(task, index) => (
            <List.Item key={index}>
              <div style={{ width: '100%' }}>
                {/* Level-1: parent task row */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Typography.Text strong>{safeTextDisplay(task.name)}</Typography.Text>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {task.sub_tasks && task.sub_tasks.length > 0 && (
                      <Tooltip
                        title={t('subtaskCountTooltip', {
                          count: task.sub_tasks.length,
                          defaultValue: `${task.sub_tasks.length} subtask(s) will be imported`,
                        })}
                      >
                        <Tag color="blue" style={{ cursor: 'default' }}>
                          {task.sub_tasks.length}{' '}
                          {t('subtasksLabel', { defaultValue: 'subtask(s)' })}
                        </Tag>
                      </Tooltip>
                    )}
                    <Button type="link" onClick={() => handleRemoveTask(index)}>
                      {t('remove')}
                    </Button>
                  </div>
                </div>

                {/* Level-2 subtasks + Level-3 grandchildren */}
                {task.sub_tasks && task.sub_tasks.length > 0 && (
                  <div style={{ marginTop: 6, paddingLeft: 16 }}>
                    {task.sub_tasks.map((subtask, subIndex) => (
                      <SubTaskRow key={subIndex} subtask={subtask} />
                    ))}
                  </div>
                )}
              </div>
            </List.Item>
          )}
        />
      </Form>
    </Drawer>
  );
};

export default ImportTaskTemplate;
