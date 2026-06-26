import { toggleSaveAsTemplateDrawer } from '@/features/projects/projectsSlice';
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
  ConfigProvider,
  notification,
  theme,
} from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { ICustomProjectTemplateCreateRequest } from '@/types/project/projectTemplate.types';
import { projectTemplatesApiService } from '@/api/project-templates/project-templates.api.service';
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
} from '@ant-design/icons';

const { Panel } = Collapse;

interface AttributeConfig {
  label: string;
  value: string;
  disabled: boolean;
  checked: boolean;
  icon?: React.ReactNode;
  description?: string;
}

const SaveProjectAsTemplate = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('project-view/save-as-template');
  const [api, contextHolder] = notification.useNotification();
  const { token } = theme.useToken();

  const [form] = Form.useForm();

  const { isSaveAsTemplateDrawerOpen } = useAppSelector(state => state.projectsReducer);
  const { projectId } = useAppSelector(state => state.projectReducer);

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [expandedPanels, setExpandedPanels] = useState<string | string[]>(['project', 'task']);
  const [quickSelectMode, setQuickSelectMode] = useState<'all' | 'none' | 'custom'>('custom');

  const projectAttributes = useMemo<Record<string, AttributeConfig>>(
    () => ({
      statuses: {
        label: t('includesOptions.statuses'),
        value: 'statuses',
        disabled: true,
        checked: true,
        icon: <ThunderboltOutlined />,
        description: t('descriptions.statuses'),
      },
      phases: {
        label: t('includesOptions.phases'),
        value: 'phases',
        disabled: false,
        checked: true,
        icon: <FolderOpenOutlined />,
        description: t('descriptions.phases'),
      },
      labels: {
        label: t('includesOptions.labels'),
        value: 'labels',
        disabled: false,
        checked: true,
        icon: <TagsOutlined />,
        description: t('descriptions.labels'),
      },
      customColumns: {
        label: t('includesOptions.customColumns'),
        value: 'customColumns',
        disabled: false,
        checked: false,
        icon: <ExperimentOutlined />,
        description: t('descriptions.customColumns'),
      },
    }),
    [t]
  );

  const taskAttributes = useMemo<Record<string, AttributeConfig>>(
    () => ({
      name: {
        label: t('taskIncludesOptions.name'),
        value: 'name',
        disabled: true,
        checked: true,
        icon: <FileTextOutlined />,
        description: t('descriptions.taskName'),
      },
      priority: {
        label: t('taskIncludesOptions.priority'),
        value: 'priority',
        disabled: true,
        checked: true,
        icon: <ThunderboltOutlined />,
        description: t('descriptions.taskPriority'),
      },
      status: {
        label: t('taskIncludesOptions.status'),
        value: 'status',
        disabled: true,
        checked: true,
        icon: <CheckCircleOutlined />,
        description: t('descriptions.taskStatus'),
      },
      phase: {
        label: t('taskIncludesOptions.phase'),
        value: 'phase',
        disabled: false,
        checked: true,
        icon: <FolderOpenOutlined />,
        description: t('descriptions.taskPhase'),
      },
      label: {
        label: t('taskIncludesOptions.label'),
        value: 'label',
        disabled: false,
        checked: true,
        icon: <TagsOutlined />,
        description: t('descriptions.taskLabel'),
      },
      timeEstimate: {
        label: t('taskIncludesOptions.timeEstimate'),
        value: 'timeEstimate',
        disabled: false,
        checked: true,
        icon: <ClockCircleOutlined />,
        description: t('descriptions.timeEstimate'),
      },
      description: {
        label: t('taskIncludesOptions.description'),
        value: 'description',
        disabled: false,
        checked: true,
        icon: <FileTextOutlined />,
        description: t('descriptions.description'),
      },
      subTasks: {
        label: t('taskIncludesOptions.subTasks'),
        value: 'subTasks',
        disabled: false,
        checked: true,
        icon: <UnorderedListOutlined />,
        description: t('descriptions.subTasks'),
      },
    }),
    [t]
  );

  const [projectAttributesState, setProjectAttributesState] = useState(projectAttributes);
  const [taskAttributesState, setTaskAttributesState] = useState(taskAttributes);

  // Sync state when translations change
  useEffect(() => {
    setProjectAttributesState(projectAttributes);
  }, [projectAttributes]);

  useEffect(() => {
    setTaskAttributesState(taskAttributes);
  }, [taskAttributes]);

  const handleProjectAttributeChange = useCallback((key: string) => {
    setProjectAttributesState(prev => ({
      ...prev,
      [key]: { ...prev[key], checked: !prev[key].checked },
    }));
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
          Object.entries(prev).map(([key, attr]) => [key, { ...attr, checked: true }])
        )
      );
      setTaskAttributesState(prev =>
        Object.fromEntries(
          Object.entries(prev).map(([key, attr]) => [key, { ...attr, checked: true }])
        )
      );
      setQuickSelectMode('all');
    } else if (mode === 'none') {
      setProjectAttributesState(prev =>
        Object.fromEntries(
          Object.entries(prev).map(([key, attr]) => [key, { ...attr, checked: attr.disabled }])
        )
      );
      setTaskAttributesState(prev =>
        Object.fromEntries(
          Object.entries(prev).map(([key, attr]) => [key, { ...attr, checked: attr.disabled }])
        )
      );
      setQuickSelectMode('none');
    } else if (mode === 'essential') {
      setProjectAttributesState(prev => ({
        ...prev,
        statuses: { ...prev.statuses, checked: true },
        phases: { ...prev.phases, checked: true },
        labels: { ...prev.labels, checked: false },
        customColumns: { ...prev.customColumns, checked: false },
      }));
      setTaskAttributesState(prev => ({
        ...prev,
        name: { ...prev.name, checked: true },
        priority: { ...prev.priority, checked: true },
        status: { ...prev.status, checked: true },
        phase: { ...prev.phase, checked: true },
        label: { ...prev.label, checked: false },
        timeEstimate: { ...prev.timeEstimate, checked: false },
        description: { ...prev.description, checked: false },
        subTasks: { ...prev.subTasks, checked: false },
      }));
      setQuickSelectMode('custom');
    }
  }, []);

  const handleFinish = async (values: any) => {
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
        taskIncludes: {
          status: taskAttributesState.status.checked,
          phase: taskAttributesState.phase.checked,
          labels: taskAttributesState.label.checked,
          estimation: taskAttributesState.timeEstimate.checked,
          description: taskAttributesState.description.checked,
          subtasks: taskAttributesState.subTasks.checked,
        },
        includeCustomColumns: projectAttributesState.customColumns.checked,
      };

      const res = await projectTemplatesApiService.createCustomTemplate(body);
      if (res.done) {
        setTimeout(() => {
          handleCancel();
        }, 1000);
      } else {
        setError(res.message || 'Failed to create template');
      }
    } catch (error: any) {
      console.error(error);
      const errorMsg = error?.response?.data?.message || 'An unexpected error occurred';
      setError(errorMsg);
    } finally {
      setCreating(false);
    }
  };

  const handleCancel = () => {
    setTemplateName('');
    setError(null);
    setQuickSelectMode('custom');
    setExpandedPanels(['project', 'task']);
    form.resetFields();

    // Reset attributes to default state
    setProjectAttributesState(projectAttributes);
    setTaskAttributesState(taskAttributes);

    dispatch(toggleSaveAsTemplateDrawer());
  };

  // Calculate selected counts
  const selectedProjectItems = Object.values(projectAttributesState).filter(
    attr => attr.checked
  ).length;
  const selectedTaskItems = Object.values(taskAttributesState).filter(attr => attr.checked).length;
  const totalProjectItems = Object.keys(projectAttributesState).length;
  const totalTaskItems = Object.keys(taskAttributesState).length;

  return (
    <>
      {contextHolder}
      <Modal
        title={
          <Space>
            <SaveOutlined style={{ color: token.colorPrimary }} />
            <Typography.Title level={4} style={{ margin: 0 }}>
              {t('title')}
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
                  {selectedProjectItems + selectedTaskItems} {t('itemsSelected')}
                </Tag>
                {templateName && (
                  <Tag color="green" icon={<CheckCircleOutlined />}>
                    {t('readyToSave')}
                  </Tag>
                )}
              </Space>
              <Space>
                <Button onClick={handleCancel} disabled={creating}>
                  {t('cancel')}
                </Button>
                <Button
                  type="primary"
                  htmlType="submit"
                  onClick={form.submit}
                  disabled={templateName.trim() === '' || creating}
                  loading={creating}
                  icon={<SaveOutlined />}
                >
                  {t('save')}
                </Button>
              </Space>
            </Flex>
          </div>
        }
      >
        <div style={{ maxHeight: '70vh', overflow: 'auto', padding: '4px' }}>
          <Spin spinning={creating} tip={t('creating')} size="large">
            <Form form={form} layout="vertical" onFinish={handleFinish}>
              {/* Quick Actions Bar */}
              <Card
                size="small"
                style={{
                  marginBottom: 16,
                  backgroundColor: token.colorInfoBg,
                  borderColor: token.colorInfoBorder,
                }}
              >
                <Flex justify="space-between" align="center">
                  <Space>
                    <Typography.Text strong>{t('quickSelect')}</Typography.Text>
                    <Button
                      size="small"
                      onClick={() => handleQuickSelect('all')}
                      type={quickSelectMode === 'all' ? 'primary' : 'default'}
                      icon={<CheckSquareOutlined />}
                    >
                      {t('selectAll')}
                    </Button>
                    <Button
                      size="small"
                      onClick={() => handleQuickSelect('essential')}
                      icon={<ThunderboltOutlined />}
                    >
                      {t('essentialOnly')}
                    </Button>
                    <Button
                      size="small"
                      onClick={() => handleQuickSelect('none')}
                      type={quickSelectMode === 'none' ? 'primary' : 'default'}
                      icon={<CloseCircleOutlined />}
                    >
                      {t('clearAll')}
                    </Button>
                  </Space>
                </Flex>
              </Card>

              {/* Template Name Section */}
              <Card
                size="small"
                style={{
                  marginBottom: 20,
                }}
                title={
                  <Space>
                    <CopyOutlined style={{ color: token.colorPrimary }} />
                    <Typography.Text strong>{t('templateInfo')}</Typography.Text>
                  </Space>
                }
                extra={
                  templateName && (
                    <Tag color="green" icon={<CheckCircleOutlined />}>
                      {t('validName')}
                    </Tag>
                  )
                }
              >
                <Form.Item
                  name="name"
                  label={
                    <Space>
                      <Typography.Text strong>{t('templateName')}</Typography.Text>
                      <Typography.Text type="danger">*</Typography.Text>
                    </Space>
                  }
                  required
                  rules={[
                    { required: true, message: t('validation.nameRequired') },
                    { min: 3, message: t('validation.nameMinLength') },
                    { max: 50, message: t('validation.nameMaxLength') },
                  ]}
                  extra={
                    templateName && (
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {templateName.length}/50 characters
                      </Typography.Text>
                    )
                  }
                >
                  <Input
                    placeholder={t('templateNamePlaceholder')}
                    onChange={e => setTemplateName(e.target.value)}
                    value={templateName}
                    size="large"
                    prefix={<ProjectOutlined />}
                    showCount
                    maxLength={50}
                    style={{ borderRadius: token.borderRadius }}
                  />
                </Form.Item>
              </Card>

              {/* Configuration Sections */}
              <Collapse
                activeKey={expandedPanels}
                onChange={setExpandedPanels}
                expandIconPosition="end"
                style={{ marginBottom: 20 }}
                bordered={false}
                size="small"
              >
                {/* Project Attributes Panel */}
                <Panel
                  header={
                    <Space>
                      <SettingOutlined style={{ color: token.colorPrimary }} />
                      <Typography.Text strong>{t('includes')}</Typography.Text>
                      <Badge
                        count={selectedProjectItems}
                        style={{
                          backgroundColor:
                            selectedProjectItems > 0 ? token.colorSuccess : token.colorBorder,
                        }}
                      />
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        ({selectedProjectItems}/{totalProjectItems} selected)
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
                    <Tooltip title={t('tooltips.projectElements')}>
                      <InfoCircleOutlined style={{ color: token.colorPrimary }} />
                    </Tooltip>
                  }
                >
                  <Form.Item name="includes">
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                        gap: 12,
                      }}
                    >
                      {Object.entries(projectAttributesState).map(([key, attr]) => (
                        <Card
                          key={key}
                          size="small"
                          hoverable={!attr.disabled}
                          style={{
                            border: attr.checked
                              ? `2px solid ${token.colorSuccess}`
                              : `1px solid ${token.colorBorder}`,
                            backgroundColor: attr.checked
                              ? token.colorSuccessBg
                              : token.colorFillAlter,
                            borderRadius: token.borderRadius,
                            transition: 'all 0.3s ease',
                            cursor: attr.disabled ? 'not-allowed' : 'pointer',
                            opacity: attr.disabled && !attr.checked ? 0.6 : 1,
                          }}
                          onClick={() => !attr.disabled && handleProjectAttributeChange(key)}
                        >
                          <Space direction="vertical" size="small" style={{ width: '100%' }}>
                            <Flex justify="space-between" align="center">
                              <Space>
                                {attr.icon}
                                <Typography.Text strong={attr.checked}>
                                  {attr.label}
                                </Typography.Text>
                              </Space>
                              <Switch
                                checked={attr.checked}
                                disabled={attr.disabled}
                                onChange={() => handleProjectAttributeChange(key)}
                                size="small"
                                onClick={(_, e) => e.stopPropagation()}
                              />
                            </Flex>
                            <Typography.Text
                              type="secondary"
                              style={{ fontSize: 11, display: 'block' }}
                            >
                              {attr.description}
                            </Typography.Text>
                            {attr.disabled && (
                              <Tag
                                color="orange"
                                icon={<InfoCircleOutlined />}
                                style={{ fontSize: 11 }}
                              >
                                {t('required')}
                              </Tag>
                            )}
                          </Space>
                        </Card>
                      ))}
                    </div>
                  </Form.Item>
                </Panel>

                {/* Task Attributes Panel */}
                <Panel
                  header={
                    <Space>
                      <CheckSquareOutlined style={{ color: token.colorWarning }} />
                      <Typography.Text strong>{t('taskIncludes')}</Typography.Text>
                      <Badge
                        count={selectedTaskItems}
                        style={{
                          backgroundColor:
                            selectedTaskItems > 0 ? token.colorSuccess : token.colorBorder,
                        }}
                      />
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        ({selectedTaskItems}/{totalTaskItems} selected)
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
                    <Tooltip title={t('tooltips.taskElements')}>
                      <InfoCircleOutlined style={{ color: token.colorWarning }} />
                    </Tooltip>
                  }
                >
                  <Form.Item name="taskIncludes">
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                        gap: 12,
                      }}
                    >
                      {Object.entries(taskAttributesState).map(([key, attr]) => (
                        <Card
                          key={key}
                          size="small"
                          hoverable={!attr.disabled}
                          style={{
                            border: attr.checked
                              ? `2px solid ${token.colorWarning}`
                              : `1px solid ${token.colorBorder}`,
                            backgroundColor: attr.checked
                              ? token.colorWarningBg
                              : token.colorFillAlter,
                            borderRadius: token.borderRadius,
                            transition: 'all 0.3s ease',
                            cursor: attr.disabled ? 'not-allowed' : 'pointer',
                            opacity: attr.disabled && !attr.checked ? 0.6 : 1,
                          }}
                          onClick={() => !attr.disabled && handleTaskAttributeChange(key)}
                        >
                          <Space direction="vertical" size="small" style={{ width: '100%' }}>
                            <Flex justify="space-between" align="center">
                              <Space>
                                {attr.icon}
                                <Typography.Text strong={attr.checked}>
                                  {attr.label}
                                </Typography.Text>
                              </Space>
                              <Switch
                                checked={attr.checked}
                                disabled={attr.disabled}
                                onChange={() => handleTaskAttributeChange(key)}
                                size="small"
                                onClick={(_, e) => e.stopPropagation()}
                              />
                            </Flex>
                            <Typography.Text
                              type="secondary"
                              style={{ fontSize: 11, display: 'block' }}
                            >
                              {attr.description}
                            </Typography.Text>
                            {attr.disabled && (
                              <Tag
                                color="orange"
                                icon={<InfoCircleOutlined />}
                                style={{ fontSize: 11 }}
                              >
                                {t('required')}
                              </Tag>
                            )}
                          </Space>
                        </Card>
                      ))}
                    </div>
                  </Form.Item>
                </Panel>
              </Collapse>

              {/* Help Section */}
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
                      {t('proTips')}
                    </Typography.Text>
                    <Typography.Paragraph
                      type="secondary"
                      style={{ margin: '8px 0 0 0', fontSize: 13 }}
                    >
                      • {t('tips.line1')}
                      <br />• {t('tips.line2')}
                      <br />• {t('tips.line3')}
                      <br />• {t('tips.line4')}
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
