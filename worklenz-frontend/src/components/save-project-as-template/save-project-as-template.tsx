import { closeSaveAsTemplateDrawer } from '@/features/projects/projectsSlice';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  Button,
  Modal,
  Flex,
  Form,
  Input,
  Typography,
  Card,
  Space,
  Spin,
  Tooltip,
  Badge,
  Tag,
  Collapse,
  Switch,
  theme,
} from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  DEFAULT_NEW_TASK_INCLUDES,
  DEFAULT_PROJECT_SETTINGS_INCLUDES,
  ICustomProjectTemplateCreateRequest,
} from '@/types/project/projectTemplate.types';
import { projectTemplatesApiService } from '@/api/project-templates/project-templates.api.service';
import alertService from '@/services/alerts/alertService';
import { hasBusinessFeatureAccess } from '@/utils/subscription-utils';
import { useAuthService } from '@/hooks/useAuth';
import useProjectPermissions from '@/hooks/useProjectPermissions';
import {
  SaveOutlined,
  ProjectOutlined,
  CheckSquareOutlined,
  InfoCircleOutlined,
  BulbOutlined,
  SettingOutlined,
  CheckCircleOutlined,
  CopyOutlined,
  FolderOpenOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  TagsOutlined,
  UnorderedListOutlined,
  ThunderboltOutlined,
  ExperimentOutlined,
  CloseCircleOutlined,
  UserOutlined,
  TeamOutlined,
  CalendarOutlined,
  FieldTimeOutlined,
  DollarOutlined,
  ControlOutlined,
  ApartmentOutlined,
  RetweetOutlined,
  LinkOutlined,
  AccountBookOutlined,
} from '@ant-design/icons';

const { Panel } = Collapse;

interface AttributeConfig {
  label: string;
  value: string;
  disabled: boolean;
  checked: boolean;
  icon?: React.ReactNode;
  description?: string;
  /** When true, item is hidden (e.g. plan-gated). */
  hidden?: boolean;
}

const mergeAttributeLabels = (
  prev: Record<string, AttributeConfig>,
  next: Record<string, AttributeConfig>
): Record<string, AttributeConfig> => {
  const merged: Record<string, AttributeConfig> = {};
  for (const [key, attr] of Object.entries(next)) {
    const existing = prev[key];
    merged[key] = existing
      ? {
          ...attr,
          checked: existing.checked,
        }
      : attr;
  }
  return merged;
};

const visibleEntries = (attrs: Record<string, AttributeConfig>) =>
  Object.entries(attrs).filter(([, attr]) => !attr.hidden);

const SaveProjectAsTemplate = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('project-view/save-as-template');
  const { token } = theme.useToken();
  const authService = useAuthService();
  const hasBusinessAccess = hasBusinessFeatureAccess(authService.getCurrentSession());

  const [form] = Form.useForm();

  const { isSaveAsTemplateDrawerOpen } = useAppSelector(state => state.projectsReducer);
  const { projectId, project } = useAppSelector(state => state.projectReducer);
  const { permissions } = useProjectPermissions(projectId);
  const canIncludeBudget = hasBusinessAccess && permissions.finance;

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('');

  const generateAutoTemplateName = () => {
    if (project?.name) {
      const timestamp = new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
      return `${project.name} - ${timestamp}`;
    }
    const timestamp = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    return `Template - ${timestamp}`;
  };

  const [expandedPanels, setExpandedPanels] = useState<string | string[]>([
    'project',
    'projectSettings',
    'task',
  ]);
  const [quickSelectMode, setQuickSelectMode] = useState<'all' | 'none' | 'custom'>('custom');

  const projectAttributes = useMemo<Record<string, AttributeConfig>>(
    () => ({
      statuses: {
        label: t('includesOptions.statuses', { defaultValue: 'Statuses' }),
        value: 'statuses',
        disabled: true,
        checked: true,
        icon: <ThunderboltOutlined />,
        description: t('descriptions.statuses', {
          defaultValue: 'Project status workflow configuration',
        }),
      },
      phases: {
        label: t('includesOptions.phases', { defaultValue: 'Phases' }),
        value: 'phases',
        disabled: false,
        checked: true,
        icon: <FolderOpenOutlined />,
        description: t('descriptions.phases', {
          defaultValue: 'Project phases and milestones',
        }),
      },
      labels: {
        label: t('includesOptions.labels', { defaultValue: 'Labels' }),
        value: 'labels',
        disabled: false,
        checked: true,
        icon: <TagsOutlined />,
        description: t('descriptions.labels', {
          defaultValue: 'Custom labels for categorization',
        }),
      },
      customColumns: {
        label: t('includesOptions.customColumns', { defaultValue: 'Custom Columns' }),
        value: 'customColumns',
        disabled: false,
        checked: false,
        icon: <ExperimentOutlined />,
        description: t('descriptions.customColumns', {
          defaultValue: 'Custom fields and metadata',
        }),
      },
    }),
    [t]
  );

  const projectSettingsAttributes = useMemo<Record<string, AttributeConfig>>(
    () => ({
      category: {
        label: t('projectSettingsOptions.category', { defaultValue: 'Category' }),
        value: 'category',
        disabled: false,
        checked: DEFAULT_PROJECT_SETTINGS_INCLUDES.category,
        icon: <ApartmentOutlined />,
        description: t('descriptions.category', {
          defaultValue: 'Project category for organization',
        }),
      },
      projectManager: {
        label: t('projectSettingsOptions.projectManager', { defaultValue: 'Project manager' }),
        value: 'projectManager',
        disabled: false,
        checked: DEFAULT_PROJECT_SETTINGS_INCLUDES.projectManager,
        icon: <UserOutlined />,
        description: t('descriptions.projectManager', {
          defaultValue: 'Assigned project manager',
        }),
      },
      estimatedWorkingDays: {
        label: t('projectSettingsOptions.estimatedWorkingDays', {
          defaultValue: 'Estimated working days',
        }),
        value: 'estimatedWorkingDays',
        disabled: false,
        checked: DEFAULT_PROJECT_SETTINGS_INCLUDES.estimatedWorkingDays,
        icon: <CalendarOutlined />,
        description: t('descriptions.estimatedWorkingDays', {
          defaultValue: 'Estimated working days for the project',
        }),
      },
      estimatedManDays: {
        label: t('projectSettingsOptions.estimatedManDays', {
          defaultValue: 'Estimated man days',
        }),
        value: 'estimatedManDays',
        disabled: false,
        checked: DEFAULT_PROJECT_SETTINGS_INCLUDES.estimatedManDays,
        icon: <FieldTimeOutlined />,
        description: t('descriptions.estimatedManDays', {
          defaultValue: 'Estimated man days for the project',
        }),
      },
      hoursPerDay: {
        label: t('projectSettingsOptions.hoursPerDay', { defaultValue: 'Hours per day' }),
        value: 'hoursPerDay',
        disabled: false,
        checked: DEFAULT_PROJECT_SETTINGS_INCLUDES.hoursPerDay,
        icon: <ClockCircleOutlined />,
        description: t('descriptions.hoursPerDay', {
          defaultValue: 'Default working hours per day',
        }),
      },
      advanced: {
        label: t('projectSettingsOptions.advanced', { defaultValue: 'Advanced settings' }),
        value: 'advanced',
        disabled: false,
        checked: DEFAULT_PROJECT_SETTINGS_INCLUDES.advanced,
        icon: <ControlOutlined />,
        description: t('descriptions.advanced', {
          defaultValue: 'Progress modes, task defaults, and access controls',
        }),
      },
      budget: {
        label: t('projectSettingsOptions.budget', { defaultValue: 'Budget settings' }),
        value: 'budget',
        disabled: false,
        checked: DEFAULT_PROJECT_SETTINGS_INCLUDES.budget,
        icon: <DollarOutlined />,
        description: t('descriptions.budget', {
          defaultValue: 'Budget amount, currency, and project rate card',
        }),
        hidden: !canIncludeBudget,
      },
    }),
    [t, canIncludeBudget]
  );

  const taskAttributes = useMemo<Record<string, AttributeConfig>>(
    () => ({
      name: {
        label: t('taskIncludesOptions.name', { defaultValue: 'Name' }),
        value: 'name',
        disabled: true,
        checked: true,
        icon: <FileTextOutlined />,
        description: t('descriptions.taskName', { defaultValue: 'Task names and titles' }),
      },
      priority: {
        label: t('taskIncludesOptions.priority', { defaultValue: 'Priority' }),
        value: 'priority',
        disabled: true,
        checked: true,
        icon: <ThunderboltOutlined />,
        description: t('descriptions.taskPriority', { defaultValue: 'Task priority levels' }),
      },
      status: {
        label: t('taskIncludesOptions.status', { defaultValue: 'Status' }),
        value: 'status',
        disabled: true,
        checked: true,
        icon: <CheckCircleOutlined />,
        description: t('descriptions.taskStatus', { defaultValue: 'Task completion status' }),
      },
      phase: {
        label: t('taskIncludesOptions.phase', { defaultValue: 'Phase' }),
        value: 'phase',
        disabled: false,
        checked: true,
        icon: <FolderOpenOutlined />,
        description: t('descriptions.taskPhase', { defaultValue: 'Associated project phase' }),
      },
      label: {
        label: t('taskIncludesOptions.label', { defaultValue: 'Label' }),
        value: 'label',
        disabled: false,
        checked: true,
        icon: <TagsOutlined />,
        description: t('descriptions.taskLabel', { defaultValue: 'Task labels and tags' }),
      },
      timeEstimate: {
        label: t('taskIncludesOptions.timeEstimate', { defaultValue: 'Time Estimate' }),
        value: 'timeEstimate',
        disabled: false,
        checked: true,
        icon: <ClockCircleOutlined />,
        description: t('descriptions.timeEstimate', {
          defaultValue: 'Time estimates and duration',
        }),
      },
      description: {
        label: t('taskIncludesOptions.description', { defaultValue: 'Description' }),
        value: 'description',
        disabled: false,
        checked: true,
        icon: <FileTextOutlined />,
        description: t('descriptions.description', {
          defaultValue: 'Task descriptions and details',
        }),
      },
      subTasks: {
        label: t('taskIncludesOptions.subTasks', { defaultValue: 'Sub Tasks' }),
        value: 'subTasks',
        disabled: false,
        checked: true,
        icon: <UnorderedListOutlined />,
        description: t('descriptions.subTasks', {
          defaultValue: 'Subtasks and checklist items',
        }),
      },
      assignees: {
        label: t('taskIncludesOptions.assignees', { defaultValue: 'Assignees' }),
        value: 'assignees',
        disabled: false,
        checked: DEFAULT_NEW_TASK_INCLUDES.assignees,
        icon: <TeamOutlined />,
        description: t('descriptions.assignees', {
          defaultValue: 'Assignees on tasks and subtasks',
        }),
      },
      recurrence: {
        label: t('taskIncludesOptions.recurrence', { defaultValue: 'Recurring options' }),
        value: 'recurrence',
        disabled: false,
        checked: DEFAULT_NEW_TASK_INCLUDES.recurrence,
        icon: <RetweetOutlined />,
        description: t('descriptions.recurrence', {
          defaultValue: 'Frequency, interval, and end rule per task',
        }),
      },
      dependencies: {
        label: t('taskIncludesOptions.dependencies', { defaultValue: 'Dependencies' }),
        value: 'dependencies',
        disabled: false,
        checked: DEFAULT_NEW_TASK_INCLUDES.dependencies,
        icon: <LinkOutlined />,
        description: t('descriptions.dependencies', {
          defaultValue: 'Links between tasks in the template',
        }),
      },
      billable: {
        label: t('taskIncludesOptions.billable', { defaultValue: 'Billable / Non-billable' }),
        value: 'billable',
        disabled: false,
        checked: DEFAULT_NEW_TASK_INCLUDES.billable,
        icon: <AccountBookOutlined />,
        description: t('descriptions.billable', {
          defaultValue: 'Billable flag for each task',
        }),
      },
    }),
    [t]
  );

  const [projectAttributesState, setProjectAttributesState] = useState(projectAttributes);
  const [projectSettingsState, setProjectSettingsState] = useState(projectSettingsAttributes);
  const [taskAttributesState, setTaskAttributesState] = useState(taskAttributes);

  useEffect(() => {
    setProjectAttributesState(prev => mergeAttributeLabels(prev, projectAttributes));
  }, [projectAttributes]);

  useEffect(() => {
    setProjectSettingsState(prev => mergeAttributeLabels(prev, projectSettingsAttributes));
  }, [projectSettingsAttributes]);

  useEffect(() => {
    setTaskAttributesState(prev => mergeAttributeLabels(prev, taskAttributes));
  }, [taskAttributes]);

  const handleProjectAttributeChange = useCallback((key: string) => {
    setProjectAttributesState(prev => ({
      ...prev,
      [key]: { ...prev[key], checked: !prev[key].checked },
    }));
    setQuickSelectMode('custom');
  }, []);

  const handleProjectSettingsChange = useCallback((key: string) => {
    setProjectSettingsState(prev => {
      if (prev[key]?.hidden) return prev;
      return {
        ...prev,
        [key]: { ...prev[key], checked: !prev[key].checked },
      };
    });
    setQuickSelectMode('custom');
  }, []);

  const handleTaskAttributeChange = useCallback((key: string) => {
    setTaskAttributesState(prev => ({
      ...prev,
      [key]: { ...prev[key], checked: !prev[key].checked },
    }));
    setQuickSelectMode('custom');
  }, []);

  const handleQuickSelect = useCallback((mode: 'all' | 'none' | 'essential') => {
    if (mode === 'all') {
      setProjectAttributesState(prev =>
        Object.fromEntries(
          Object.entries(prev).map(([key, attr]) => [
            key,
            { ...attr, checked: attr.hidden ? false : true },
          ])
        )
      );
      setProjectSettingsState(prev =>
        Object.fromEntries(
          Object.entries(prev).map(([key, attr]) => [
            key,
            { ...attr, checked: attr.hidden ? false : true },
          ])
        )
      );
      setTaskAttributesState(prev =>
        Object.fromEntries(
          Object.entries(prev).map(([key, attr]) => [key, { ...attr, checked: true }])
        )
      );
      setQuickSelectMode('all');
      return;
    }

    if (mode === 'none') {
      setProjectAttributesState(prev =>
        Object.fromEntries(
          Object.entries(prev).map(([key, attr]) => [
            key,
            { ...attr, checked: attr.disabled },
          ])
        )
      );
      setProjectSettingsState(prev =>
        Object.fromEntries(
          Object.entries(prev).map(([key, attr]) => [key, { ...attr, checked: false }])
        )
      );
      setTaskAttributesState(prev =>
        Object.fromEntries(
          Object.entries(prev).map(([key, attr]) => [
            key,
            { ...attr, checked: attr.disabled },
          ])
        )
      );
      setQuickSelectMode('none');
      return;
    }

    // Essential Only — required items only
    setProjectAttributesState(prev => ({
      ...prev,
      statuses: { ...prev.statuses, checked: true },
      phases: { ...prev.phases, checked: false },
      labels: { ...prev.labels, checked: false },
      customColumns: { ...prev.customColumns, checked: false },
    }));
    setProjectSettingsState(prev =>
      Object.fromEntries(
        Object.entries(prev).map(([key, attr]) => [key, { ...attr, checked: false }])
      )
    );
    setTaskAttributesState(prev => ({
      ...prev,
      name: { ...prev.name, checked: true },
      priority: { ...prev.priority, checked: true },
      status: { ...prev.status, checked: true },
      phase: { ...prev.phase, checked: false },
      label: { ...prev.label, checked: false },
      timeEstimate: { ...prev.timeEstimate, checked: false },
      description: { ...prev.description, checked: false },
      subTasks: { ...prev.subTasks, checked: false },
      assignees: { ...prev.assignees, checked: false },
      recurrence: { ...prev.recurrence, checked: false },
      dependencies: { ...prev.dependencies, checked: false },
      billable: { ...prev.billable, checked: false },
    }));
    setQuickSelectMode('custom');
  }, []);

  const handleCancel = useCallback(() => {
    setTemplateName('');
    setError(null);
    setQuickSelectMode('custom');
    setExpandedPanels(['project', 'projectSettings', 'task']);
    form.resetFields();
    setProjectAttributesState(projectAttributes);
    setProjectSettingsState(projectSettingsAttributes);
    setTaskAttributesState(taskAttributes);
    dispatch(closeSaveAsTemplateDrawer());
  }, [
    dispatch,
    form,
    projectAttributes,
    projectSettingsAttributes,
    taskAttributes,
  ]);

  const handleFinish = async (values: { name?: string }) => {
    if (!values.name || !projectId) return;

    try {
      setCreating(true);
      setError(null);

      const body: ICustomProjectTemplateCreateRequest = {
        project_id: projectId,
        templateName: values.name,
        projectIncludes: {
          statuses: projectAttributesState.statuses.checked,
          phases: projectAttributesState.phases.checked,
          labels: projectAttributesState.labels.checked,
          customColumns: projectAttributesState.customColumns.checked,
        },
        projectSettingsIncludes: {
          category: projectSettingsState.category.checked,
          projectManager: projectSettingsState.projectManager.checked,
          estimatedWorkingDays: projectSettingsState.estimatedWorkingDays.checked,
          estimatedManDays: projectSettingsState.estimatedManDays.checked,
          hoursPerDay: projectSettingsState.hoursPerDay.checked,
          advanced: projectSettingsState.advanced.checked,
          budget: Boolean(canIncludeBudget && projectSettingsState.budget.checked),
        },
        taskIncludes: {
          status: taskAttributesState.status.checked,
          phase: taskAttributesState.phase.checked,
          labels: taskAttributesState.label.checked,
          estimation: taskAttributesState.timeEstimate.checked,
          description: taskAttributesState.description.checked,
          subtasks: taskAttributesState.subTasks.checked,
          assignees: taskAttributesState.assignees.checked,
          recurrence: taskAttributesState.recurrence.checked,
          dependencies: taskAttributesState.dependencies.checked,
          billable: taskAttributesState.billable.checked,
          dateOffsets: true,
        },
        includeCustomColumns: projectAttributesState.customColumns.checked,
      };

      const res = await projectTemplatesApiService.createCustomTemplate(body);
      if (res.done) {
        alertService.success(
          t('notifications.createSuccess', { defaultValue: 'Template Created' }),
          t('notifications.createSuccessDesc', {
            defaultValue:
              'Your project template has been successfully created and is ready to use.',
          })
        );
        setTimeout(() => {
          handleCancel();
        }, 1000);
      } else {
        setError(
          res.message ||
            t('notifications.createError', { defaultValue: 'Template Creation Failed' })
        );
      }
    } catch (err: unknown) {
      const errorMsg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        t('notifications.createError', { defaultValue: 'An unexpected error occurred' });
      setError(errorMsg);
    } finally {
      setCreating(false);
    }
  };

  const selectedProjectItems = visibleEntries(projectAttributesState).filter(
    ([, attr]) => attr.checked
  ).length;
  const totalProjectItems = visibleEntries(projectAttributesState).length;

  const selectedSettingsItems = visibleEntries(projectSettingsState).filter(
    ([, attr]) => attr.checked
  ).length;
  const totalSettingsItems = visibleEntries(projectSettingsState).length;

  const selectedTaskItems = visibleEntries(taskAttributesState).filter(
    ([, attr]) => attr.checked
  ).length;
  const totalTaskItems = visibleEntries(taskAttributesState).length;

  const totalSelected = selectedProjectItems + selectedSettingsItems + selectedTaskItems;

  const renderAttributeGrid = (
    attrs: Record<string, AttributeConfig>,
    onToggle: (key: string) => void,
    accent: 'success' | 'primary' | 'warning'
  ) => {
    const borderChecked =
      accent === 'success'
        ? token.colorSuccess
        : accent === 'warning'
          ? token.colorWarning
          : token.colorPrimary;
    const bgChecked =
      accent === 'success'
        ? token.colorSuccessBg
        : accent === 'warning'
          ? token.colorWarningBg
          : token.colorPrimaryBg;

    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 12,
        }}
      >
        {visibleEntries(attrs).map(([key, attr]) => (
          <Card
            key={key}
            size="small"
            hoverable={!attr.disabled}
            role="button"
            tabIndex={attr.disabled ? -1 : 0}
            aria-label={attr.label}
            aria-pressed={attr.checked}
            onKeyDown={e => {
              if (attr.disabled) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onToggle(key);
              }
            }}
            style={{
              border: attr.checked ? `2px solid ${borderChecked}` : `1px solid ${token.colorBorder}`,
              backgroundColor: attr.checked ? bgChecked : token.colorFillAlter,
              borderRadius: token.borderRadius,
              transition: 'all 0.3s ease',
              cursor: attr.disabled ? 'not-allowed' : 'pointer',
              opacity: attr.disabled && !attr.checked ? 0.6 : 1,
            }}
            onClick={() => !attr.disabled && onToggle(key)}
          >
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Flex justify="space-between" align="center">
                <Space>
                  {attr.icon}
                  <Typography.Text strong={attr.checked}>{attr.label}</Typography.Text>
                </Space>
                <Switch
                  checked={attr.checked}
                  disabled={attr.disabled}
                  onChange={() => onToggle(key)}
                  size="small"
                  aria-label={attr.label}
                  onClick={(_, e) => e.stopPropagation()}
                />
              </Flex>
              <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
                {attr.description}
              </Typography.Text>
              {attr.disabled && (
                <Tag color="orange" icon={<InfoCircleOutlined />} style={{ fontSize: 11 }}>
                  {t('required', { defaultValue: 'Required' })}
                </Tag>
              )}
            </Space>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <>
      <Modal
        title={
          <Space>
            <SaveOutlined style={{ color: token.colorPrimary }} />
            <Typography.Title level={4} style={{ margin: 0 }}>
              {t('title', { defaultValue: 'Save as Template' })}
            </Typography.Title>
          </Space>
        }
        onCancel={handleCancel}
        open={isSaveAsTemplateDrawerOpen}
        width={800}
        centered
        destroyOnHidden
        maskClosable={!creating}
        closable={!creating}
        footer={
          <div
            style={{
              padding: '12px 0',
              borderTop: `1px solid ${token.colorBorder}`,
            }}
          >
            <Flex justify="space-between" align="center">
              <Space>
                <Tag color="blue" icon={<InfoCircleOutlined />}>
                  {totalSelected} {t('itemsSelected', { defaultValue: 'items selected' })}
                </Tag>
                {templateName && (
                  <Tag color="green" icon={<CheckCircleOutlined />}>
                    {t('readyToSave', { defaultValue: 'Ready to save' })}
                  </Tag>
                )}
              </Space>
              <Space>
                <Button onClick={handleCancel} disabled={creating}>
                  {t('cancel', { defaultValue: 'Cancel' })}
                </Button>
                <Button
                  type="primary"
                  htmlType="submit"
                  onClick={form.submit}
                  disabled={templateName.trim() === '' || creating}
                  loading={creating}
                  icon={<SaveOutlined />}
                >
                  {t('save', { defaultValue: 'Save' })}
                </Button>
              </Space>
            </Flex>
          </div>
        }
      >
        <div style={{ maxHeight: '70vh', overflow: 'auto', padding: '4px' }}>
          <Spin
            spinning={creating}
            tip={t('creating', { defaultValue: 'Creating template...' })}
            size="large"
          >
            <Form form={form} layout="vertical" onFinish={handleFinish}>
              {error && (
                <Card
                  size="small"
                  style={{
                    marginBottom: 16,
                    borderColor: token.colorError,
                    backgroundColor: token.colorErrorBg,
                  }}
                >
                  <Typography.Text type="danger">{error}</Typography.Text>
                </Card>
              )}

              <Card
                size="small"
                style={{
                  marginBottom: 16,
                  backgroundColor: token.colorInfoBg,
                  borderColor: token.colorInfoBorder,
                }}
              >
                <Flex justify="space-between" align="center">
                  <Space wrap>
                    <Typography.Text strong>
                      {t('quickSelect', { defaultValue: 'Quick Select:' })}
                    </Typography.Text>
                    <Button
                      size="small"
                      onClick={() => handleQuickSelect('all')}
                      type={quickSelectMode === 'all' ? 'primary' : 'default'}
                      icon={<CheckSquareOutlined />}
                      aria-label={t('selectAll', { defaultValue: 'Select All' })}
                    >
                      {t('selectAll', { defaultValue: 'Select All' })}
                    </Button>
                    <Button
                      size="small"
                      onClick={() => handleQuickSelect('essential')}
                      icon={<ThunderboltOutlined />}
                      aria-label={t('essentialOnly', { defaultValue: 'Essential Only' })}
                    >
                      {t('essentialOnly', { defaultValue: 'Essential Only' })}
                    </Button>
                    <Button
                      size="small"
                      onClick={() => handleQuickSelect('none')}
                      type={quickSelectMode === 'none' ? 'primary' : 'default'}
                      icon={<CloseCircleOutlined />}
                      aria-label={t('clearAll', { defaultValue: 'Clear All' })}
                    >
                      {t('clearAll', { defaultValue: 'Clear All' })}
                    </Button>
                  </Space>
                </Flex>
              </Card>

              <Card
                size="small"
                style={{ marginBottom: 20 }}
                title={
                  <Space>
                    <CopyOutlined style={{ color: token.colorPrimary }} />
                    <Typography.Text strong>
                      {t('templateInfo', { defaultValue: 'Template Information' })}
                    </Typography.Text>
                  </Space>
                }
                extra={
                  templateName ? (
                    <Tag color="green" icon={<CheckCircleOutlined />}>
                      {t('validName', { defaultValue: 'Valid name' })}
                    </Tag>
                  ) : null
                }
              >
                <Form.Item
                  name="name"
                  label={
                    <Space>
                      <Typography.Text strong>
                        {t('templateName', { defaultValue: 'Template Name' })}
                      </Typography.Text>
                      <Typography.Text type="danger">*</Typography.Text>
                    </Space>
                  }
                  required
                  rules={[
                    {
                      required: true,
                      message: t('validation.nameRequired', {
                        defaultValue: 'Please enter a template name',
                      }),
                    },
                    {
                      min: 3,
                      message: t('validation.nameMinLength', {
                        defaultValue: 'Template name must be at least 3 characters',
                      }),
                    },
                    {
                      max: 50,
                      message: t('validation.nameMaxLength', {
                        defaultValue: 'Template name must be less than 50 characters',
                      }),
                    },
                  ]}
                  extra={
                    templateName ? (
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {templateName.length}/50{' '}
                        {t('characters', { defaultValue: 'characters' })}
                      </Typography.Text>
                    ) : null
                  }
                >
                  <Input
                    placeholder={
                      generateAutoTemplateName() ||
                      t('templateNamePlaceholder', { defaultValue: 'Enter template name' })
                    }
                    onChange={e => setTemplateName(e.target.value)}
                    value={templateName}
                    size="large"
                    prefix={<ProjectOutlined />}
                    showCount
                    maxLength={50}
                    style={{ borderRadius: token.borderRadius }}
                    aria-label={t('templateName', { defaultValue: 'Template Name' })}
                  />
                </Form.Item>
              </Card>

              <Collapse
                activeKey={expandedPanels}
                onChange={setExpandedPanels}
                expandIconPosition="end"
                style={{ marginBottom: 20 }}
                bordered={false}
                size="small"
              >
                <Panel
                  header={
                    <Space>
                      <SettingOutlined style={{ color: token.colorPrimary }} />
                      <Typography.Text strong>
                        {t('includes', { defaultValue: 'Project Elements' })}
                      </Typography.Text>
                      <Badge
                        count={selectedProjectItems}
                        style={{
                          backgroundColor:
                            selectedProjectItems > 0 ? token.colorSuccess : token.colorBorder,
                        }}
                      />
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        ({selectedProjectItems}/{totalProjectItems}{' '}
                        {t('selected', { defaultValue: 'selected' })})
                      </Typography.Text>
                    </Space>
                  }
                  key="project"
                  style={{
                    background: token.colorBgContainer,
                    marginBottom: 8,
                    borderRadius: token.borderRadius,
                    border: `1px solid ${token.colorBorder}`,
                  }}
                  extra={
                    <Tooltip
                      title={t('tooltips.projectElements', {
                        defaultValue: 'Choose what project elements to include in your template',
                      })}
                    >
                      <InfoCircleOutlined style={{ color: token.colorPrimary }} />
                    </Tooltip>
                  }
                >
                  <Form.Item name="includes">
                    {renderAttributeGrid(
                      projectAttributesState,
                      handleProjectAttributeChange,
                      'success'
                    )}
                  </Form.Item>
                </Panel>

                <Panel
                  header={
                    <Space>
                      <ControlOutlined style={{ color: token.colorInfo }} />
                      <Typography.Text strong>
                        {t('projectSettings', { defaultValue: 'Project Settings' })}
                      </Typography.Text>
                      <Badge
                        count={selectedSettingsItems}
                        style={{
                          backgroundColor:
                            selectedSettingsItems > 0 ? token.colorSuccess : token.colorBorder,
                        }}
                      />
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        ({selectedSettingsItems}/{totalSettingsItems}{' '}
                        {t('selected', { defaultValue: 'selected' })})
                      </Typography.Text>
                    </Space>
                  }
                  key="projectSettings"
                  style={{
                    background: token.colorBgContainer,
                    marginBottom: 8,
                    borderRadius: token.borderRadius,
                    border: `1px solid ${token.colorBorder}`,
                  }}
                  extra={
                    <Tooltip
                      title={t('tooltips.projectSettings', {
                        defaultValue:
                          'Choose which project settings to include. These can be reviewed before creating a project from this template.',
                      })}
                    >
                      <InfoCircleOutlined style={{ color: token.colorInfo }} />
                    </Tooltip>
                  }
                >
                  <Form.Item name="projectSettingsIncludes">
                    {renderAttributeGrid(
                      projectSettingsState,
                      handleProjectSettingsChange,
                      'primary'
                    )}
                  </Form.Item>
                  {!canIncludeBudget && (
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {t('budgetPlanHint', {
                        defaultValue: !hasBusinessAccess
                          ? 'Budget settings are available on Business and Enterprise plans.'
                          : 'Budget settings require finance access on this project.',
                      })}
                    </Typography.Text>
                  )}
                </Panel>

                <Panel
                  header={
                    <Space>
                      <CheckSquareOutlined style={{ color: token.colorWarning }} />
                      <Typography.Text strong>
                        {t('taskIncludes', { defaultValue: 'Task Elements' })}
                      </Typography.Text>
                      <Badge
                        count={selectedTaskItems}
                        style={{
                          backgroundColor:
                            selectedTaskItems > 0 ? token.colorSuccess : token.colorBorder,
                        }}
                      />
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        ({selectedTaskItems}/{totalTaskItems}{' '}
                        {t('selected', { defaultValue: 'selected' })})
                      </Typography.Text>
                    </Space>
                  }
                  key="task"
                  style={{
                    background: token.colorBgContainer,
                    borderRadius: token.borderRadius,
                    border: `1px solid ${token.colorBorder}`,
                  }}
                  extra={
                    <Tooltip
                      title={t('tooltips.taskElements', {
                        defaultValue: 'Choose what task elements to include in your template',
                      })}
                    >
                      <InfoCircleOutlined style={{ color: token.colorWarning }} />
                    </Tooltip>
                  }
                >
                  <Form.Item name="taskIncludes">
                    {renderAttributeGrid(taskAttributesState, handleTaskAttributeChange, 'warning')}
                  </Form.Item>
                </Panel>
              </Collapse>

              <Card
                size="small"
                style={{
                  backgroundColor: token.colorInfoBg,
                  border: `1px solid ${token.colorInfoBorder}`,
                  borderRadius: token.borderRadius,
                }}
              >
                <Space align="start">
                  <BulbOutlined style={{ color: token.colorInfo, marginTop: 2 }} />
                  <div>
                    <Typography.Text strong style={{ color: token.colorInfo }}>
                      {t('proTips', { defaultValue: 'Pro Tips' })}
                    </Typography.Text>
                    <Typography.Paragraph
                      type="secondary"
                      style={{ margin: '8px 0 0 0', fontSize: 13 }}
                    >
                      • {t('tips.line1', {
                        defaultValue: 'Templates preserve your project structure for quick reuse',
                      })}
                      <br />•{' '}
                      {t('tips.line2', {
                        defaultValue: 'Essential items are always included and cannot be removed',
                      })}
                      <br />•{' '}
                      {t('tips.line3', {
                        defaultValue:
                          'Project settings can be reviewed and edited when creating a project from this template',
                      })}
                      <br />•{' '}
                      {t('tips.line4', {
                        defaultValue:
                          'Leave people and budget off by default to avoid surprise assignments or costs in new projects',
                      })}
                    </Typography.Paragraph>
                  </div>
                </Space>
              </Card>
            </Form>
          </Spin>
        </div>
      </Modal>
    </>
  );
};

export default SaveProjectAsTemplate;
