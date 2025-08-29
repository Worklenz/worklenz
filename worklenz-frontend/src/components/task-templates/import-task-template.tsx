import { useState } from 'react';
import {
  Button,
  Divider,
  Drawer,
  Flex,
  Form,
  Input,
  List,
  Select,
  Skeleton,
  Typography,
} from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';

import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { ITaskTemplatesGetResponse } from '@/types/settings/task-templates.types';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { taskTemplatesApiService } from '@/api/task-templates/task-templates.api.service';
import logger from '@/utils/errorLogger';
import { fetchBoardTaskGroups } from '@/features/board/board-slice';
import { setImportTaskTemplateDrawerOpen } from '@/features/project/project.slice';
import useTabSearchParam from '@/hooks/useTabSearchParam';
import { fetchTaskGroups } from '@/features/tasks/tasks.slice';
import { fetchTasksV3 } from '@/features/task-management/task-management.slice';

const ImportTaskTemplate = () => {
  const dispatch = useAppDispatch();
  const [form] = Form.useForm();
  const { t } = useTranslation('project-view/import-task-templates');
  const { tab } = useTabSearchParam();

  const { importTaskTemplateDrawerOpen, projectId } = useAppSelector(state => state.projectReducer);
  const [templates, setTemplates] = useState<ITaskTemplatesGetResponse[]>([]);
  const [tasks, setTasks] = useState<IProjectTask[]>([]);
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
        if (tab === 'board') dispatch(fetchBoardTaskGroups(projectId));
        if (tab === 'tasks-list') dispatch(fetchTasksV3(projectId));

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

  return (
    <Drawer
      title={t('importTaskTemplate')}
      open={importTaskTemplateDrawerOpen}
      onClose={handleClose}
      width={650}
      afterOpenChange={handleAfterOpenChange}
      destroyOnClose
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
            options={templates.map(t => ({ label: t.name, value: t.id }))}
            loading={loadingTemplates}
            onSelect={handleTemplateSelect}
          />
        </Form.Item>
        <Divider />
        <Typography.Text strong>
          {t('selectedTasks')} ({tasks.length})
        </Typography.Text>
        <List
          loading={loadingTasks}
          dataSource={tasks}
          bordered
          renderItem={(task, index) => (
            <List.Item
              key={task.id}
              actions={[
                <Button type="link" onClick={() => handleRemoveTask(index)}>
                  {t('remove')}
                </Button>,
              ]}
            >
              <Typography.Text>{task.name}</Typography.Text>
            </List.Item>
          )}
        />
      </Form>
    </Drawer>
  );
};

export default ImportTaskTemplate;
