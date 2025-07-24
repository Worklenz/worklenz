import { useState } from 'react';
import { Button, Drawer, Form, Input, List, Typography } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';

import { useAppDispatch } from '@/hooks/useAppDispatch';
import { taskTemplatesApiService } from '@/api/task-templates/task-templates.api.service';
import logger from '@/utils/errorLogger';
import { ITaskTemplateGetResponse } from '@/types/settings/task-templates.types';
import { useAppSelector } from '@/hooks/useAppSelector';
import { setSelectedTasks } from '@/features/project/project.slice';

interface TaskTemplateDrawerProps {
  showDrawer: boolean;
  selectedTemplateId: string | null;
  onClose: () => void;
}

const TaskTemplateDrawer = ({
  showDrawer = false,
  selectedTemplateId,
  onClose,
}: TaskTemplateDrawerProps) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('task-template-drawer');
  const [form] = Form.useForm();
  const [templateData, setTemplateData] = useState<ITaskTemplateGetResponse>({});
  const [isLoading, setIsLoading] = useState(false);
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  const [updatingTemplate, setUpdatingTemplate] = useState(false);

  const { selectedTasks } = useAppSelector(state => state.bulkActionReducer);

  const onCloseDrawer = () => {
    form.resetFields();
    setTemplateData({});
    onClose();
  };

  const fetchTemplateData = async () => {
    if (!selectedTemplateId) return;
    try {
      setIsLoading(true);
      const res = await taskTemplatesApiService.getTemplate(selectedTemplateId);
      if (res.done) {
        setTemplateData(res.body);
        form.setFieldsValue({
          name: res.body.name,
        });
      }
    } catch (error) {
      logger.error('Failed to fetch template data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const afterOpenChange = (open: boolean) => {
    if (selectedTemplateId) {
      fetchTemplateData();
      return;
    }
    // Tasks should already have the name property set correctly
    setTemplateData({ tasks: selectedTasks });
  };

  const handleRemoveTask = (index: number) => {
    const updatedTasks = [...(templateData.tasks || [])];
    updatedTasks.splice(index, 1);
    setTemplateData({
      ...templateData,
      tasks: updatedTasks,
    });
  };

  const createTemplate = async () => {
    const values = form.getFieldsValue();
    if (!values.name || !templateData.tasks) return;
    try {
      setCreatingTemplate(true);
      const res = await taskTemplatesApiService.createTemplate({
        name: values.name || '',
        tasks: templateData.tasks || [],
      });
      if (res.done) {
        onCloseDrawer();
        dispatch(setSelectedTasks([]));
      }
    } catch (error) {
      logger.error('Failed to create template:', error);
    } finally {
      setCreatingTemplate(false);
    }
  };

  const updateTemplate = async () => {
    if (!selectedTemplateId || !templateData.name || !templateData.tasks) return;
    const values = form.getFieldsValue();
    try {
      setUpdatingTemplate(true);
      const res = await taskTemplatesApiService.updateTemplate(selectedTemplateId, {
        name: values.name || '',
        tasks: templateData.tasks || [],
      });
      if (res.done) {
        onCloseDrawer();
        dispatch(setSelectedTasks([]));
      }
    } catch (error) {
      logger.error('Failed to update template:', error);
    } finally {
      setUpdatingTemplate(false);
    }
  };

  const handleSaveTemplate = () => {
    if (!selectedTemplateId) {
      createTemplate();
    } else {
      updateTemplate();
    }
  };

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
        <Typography.Text style={{ fontWeight: 700 }}>
          {t('selectedTasks')} ({templateData?.tasks?.length || 0})
        </Typography.Text>
        <div style={{ marginTop: '1.5rem' }}>
          <List
            loading={isLoading}
            bordered
            dataSource={templateData?.tasks}
            renderItem={(item, index) => (
              <List.Item>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                  }}
                >
                  <span>{item.name}</span>
                  <Button type="link" onClick={() => handleRemoveTask(index)}>
                    {t('removeTask')}
                  </Button>
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
