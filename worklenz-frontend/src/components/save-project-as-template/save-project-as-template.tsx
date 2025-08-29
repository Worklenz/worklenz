import { toggleSaveAsTemplateDrawer } from '@/features/projects/projectsSlice';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { Button, Checkbox, Drawer, Flex, Form, Input } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { ICustomProjectTemplateCreateRequest } from '@/types/project/projectTemplate.types';
import { projectTemplatesApiService } from '@/api/project-templates/project-templates.api.service';

const SaveProjectAsTemplate = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('project-view/save-as-template');

  const [form] = Form.useForm();

  const { isSaveAsTemplateDrawerOpen } = useAppSelector(state => state.projectsReducer);
  const { projectId } = useAppSelector(state => state.projectReducer);

  const [creating, setCreating] = useState(false);

  const [templateName, setTemplateName] = useState('');
  const [projectAttributes, setProjectAttributes] = useState({
    statuses: {
      label: t('includesOptions.statuses'),
      value: 'statuses',
      disabled: true,
      checked: true,
    },
    phases: { label: t('includesOptions.phases'), value: 'phases', disabled: false, checked: true },
    labels: { label: t('includesOptions.labels'), value: 'labels', disabled: false, checked: true },
  });

  const [taskAttributes, setTaskAttributes] = useState({
    name: { label: t('taskIncludesOptions.name'), value: 'name', disabled: true, checked: true },
    priority: {
      label: t('taskIncludesOptions.priority'),
      value: 'priority',
      disabled: true,
      checked: true,
    },
    status: {
      label: t('taskIncludesOptions.status'),
      value: 'status',
      disabled: true,
      checked: true,
    },
    phase: {
      label: t('taskIncludesOptions.phase'),
      value: 'phase',
      disabled: false,
      checked: true,
    },
    label: {
      label: t('taskIncludesOptions.label'),
      value: 'label',
      disabled: false,
      checked: true,
    },
    timeEstimate: {
      label: t('taskIncludesOptions.timeEstimate'),
      value: 'timeEstimate',
      disabled: false,
      checked: true,
    },
    description: {
      label: t('taskIncludesOptions.description'),
      value: 'description',
      disabled: false,
      checked: true,
    },
    subTasks: {
      label: t('taskIncludesOptions.subTasks'),
      value: 'subTasks',
      disabled: false,
      checked: true,
    },
  });

  const handleProjectAttributeChange = (key: keyof typeof projectAttributes) => {
    setProjectAttributes(prev => ({
      ...prev,
      [key]: { ...prev[key], checked: !prev[key].checked },
    }));
  };

  const handleTaskAttributeChange = (key: keyof typeof taskAttributes) => {
    setTaskAttributes(prev => ({
      ...prev,
      [key]: { ...prev[key], checked: !prev[key].checked },
    }));
  };

  const handleFinish = async (values: any) => {
    if (!values.name || !projectId) return;

    try {
      setCreating(true);
      const body: ICustomProjectTemplateCreateRequest = {
        project_id: projectId,
        templateName: values.name,
        projectIncludes: {
          statuses: projectAttributes.statuses.checked,
          phases: projectAttributes.phases.checked,
          labels: projectAttributes.labels.checked,
        },
        taskIncludes: {
          status: taskAttributes.status.checked,
          phase: taskAttributes.phase.checked,
          labels: taskAttributes.label.checked,
          estimation: taskAttributes.timeEstimate.checked,
          description: taskAttributes.description.checked,
          subtasks: taskAttributes.subTasks.checked,
        },
      };

      const res = await projectTemplatesApiService.createCustomTemplate(body);
      if (res.done) {
        dispatch(toggleSaveAsTemplateDrawer());
      }
    } catch (error) {
      console.error(error);
    } finally {
      setCreating(false);
    }
  };

  const handleCancel = () => {
    setTemplateName('');
    form.resetFields();
    dispatch(toggleSaveAsTemplateDrawer());
  };

  return (
    <Drawer
      title={t('title')}
      onClose={handleCancel}
      open={isSaveAsTemplateDrawerOpen}
      footer={
        <Flex justify="end" gap={8}>
          <Button type="default" onClick={handleCancel}>
            {t('cancel')}
          </Button>
          <Button
            type="primary"
            htmlType="submit"
            onClick={form.submit}
            disabled={templateName.trim() === ''}
          >
            {t('save')}
          </Button>
        </Flex>
      }
    >
      <Form form={form} layout="vertical" onFinish={handleFinish}>
        <Form.Item name="name" label={t('templateName')} required>
          <Input
            placeholder={t('templateNamePlaceholder')}
            onChange={e => setTemplateName(e.target.value)}
            value={templateName}
          />
        </Form.Item>
        <Form.Item name="includes" label={t('includes')}>
          <Flex vertical gap={8}>
            {Object.entries(projectAttributes).map(([key, attr]) => (
              <Checkbox
                key={key}
                value={attr.value}
                disabled={attr.disabled}
                checked={attr.checked}
                onChange={() => handleProjectAttributeChange(key as keyof typeof projectAttributes)}
              >
                {attr.label}
              </Checkbox>
            ))}
          </Flex>
        </Form.Item>
        <Form.Item name="taskIncludes" label={t('taskIncludes')}>
          <Flex vertical gap={8}>
            {Object.entries(taskAttributes).map(([key, attr]) => (
              <Checkbox
                key={key}
                value={attr.value}
                disabled={attr.disabled}
                checked={attr.checked}
                onChange={() => handleTaskAttributeChange(key as keyof typeof taskAttributes)}
              >
                {attr.label}
              </Checkbox>
            ))}
          </Flex>
        </Form.Item>
      </Form>
    </Drawer>
  );
};

export default SaveProjectAsTemplate;
