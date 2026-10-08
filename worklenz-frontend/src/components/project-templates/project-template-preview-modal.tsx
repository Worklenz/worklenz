import React, { useEffect, useState } from 'react';
import {
  Modal,
  Button,
  Tag,
  List,
  Typography,
  Skeleton,
  Empty,
  Space,
  Flex,
  theme,
  Divider,
  Progress,
} from '@/shared/antd-imports';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { projectTemplatesApiService } from '@/api/project-templates/project-templates.api.service';
import { IProjectTemplate } from '@/types/project-templates/project-templates.types';
import {
  IProjectTemplateIncludes,
  IProjectTemplateSettingsOverrides,
  IProjectTemplateSettingsSnapshot,
} from '@/types/project/projectTemplate.types';
import logger from '@/utils/errorLogger';
import { decodeHtmlEntities } from '@/utils/html-entities';
import ConfigureTemplateImportForm, {
  ConfigureTemplateImportFormValues,
  buildSettingsOverrides,
  initFormValuesFromSettings,
} from './configure-template-import-form';

export interface ProjectTemplateImportPayload {
  projectName: string;
  start_date: string;
  settings_overrides: IProjectTemplateSettingsOverrides;
}

interface ProjectTemplatePreviewModalProps {
  visible: boolean;
  templateId: string | null;
  templateName: string;
  onClose: () => void;
  /** Called when the user confirms import. Should return an error message string on failure, or null/undefined on success. */
  onImport: (
    templateId: string,
    payload: ProjectTemplateImportPayload
  ) => Promise<string | null | undefined> | void;
  importing?: boolean;
  /** Which step to open on. 'confirm' skips straight to the "name your project" step
   * (used by the "Use this Template" action), 'preview' (default) opens the template preview. */
  initialStep?: 'preview' | 'confirm';
  /** When false, hides import actions (restricted members can still preview). Defaults to true. */
  canImport?: boolean;
}

const { Text, Title } = Typography;

interface CustomTemplateDetail extends IProjectTemplate {
  schema_version?: number;
  includes?: IProjectTemplateIncludes | null;
  settings?: IProjectTemplateSettingsSnapshot | null;
}

export const ProjectTemplatePreviewModal: React.FC<ProjectTemplatePreviewModalProps> = ({
  visible,
  templateId,
  templateName,
  onClose,
  onImport,
  importing = false,
  initialStep = 'preview',
  canImport = true,
}) => {
  const { t } = useTranslation('settings/project-templates');
  const { token } = theme.useToken();
  const [template, setTemplate] = useState<CustomTemplateDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmStep, setConfirmStep] = useState(initialStep === 'confirm' && canImport);
  const [projectName, setProjectName] = useState(
    initialStep === 'confirm' && canImport ? decodeHtmlEntities(templateName) : ''
  );
  const [startDate, setStartDate] = useState<Dayjs | null>(dayjs());
  const [formValues, setFormValues] = useState<ConfigureTemplateImportFormValues>(() =>
    initFormValuesFromSettings(
      initialStep === 'confirm' && canImport ? decodeHtmlEntities(templateName) : '',
      null
    )
  );
  const [nameError, setNameError] = useState('');
  const [startDateError, setStartDateError] = useState('');

  useEffect(() => {
    if (!visible || !templateId) return;
    setTemplate(null);
    const shouldConfirm = initialStep === 'confirm' && canImport;
    setConfirmStep(shouldConfirm);
    const decodedName = shouldConfirm ? decodeHtmlEntities(templateName) : '';
    setProjectName(decodedName);
    setStartDate(dayjs());
    setFormValues(initFormValuesFromSettings(decodedName, null));
    setNameError('');
    setStartDateError('');
    setLoading(true);
    projectTemplatesApiService
      .getCustomTemplateById(templateId)
      .then(res => {
        if (res.done) {
          const body = res.body as CustomTemplateDetail;
          setTemplate(body);
          if (shouldConfirm) {
            setFormValues(initFormValuesFromSettings(decodedName, body.settings));
          }
        }
      })
      .catch(err => logger.error('Failed to load template preview:', err))
      .finally(() => setLoading(false));
  }, [visible, templateId, initialStep, canImport, templateName]);

  const handleImportClick = () => {
    if (!canImport) return;
    const decodedName = decodeHtmlEntities(templateName);
    setProjectName(decodedName);
    setStartDate(dayjs());
    setFormValues(initFormValuesFromSettings(decodedName, template?.settings));
    setNameError('');
    setStartDateError('');
    setConfirmStep(true);
  };

  const handleConfirmImport = async () => {
    if (!canImport) return;
    const trimmed = projectName.trim();
    let hasError = false;
    if (!trimmed) {
      setNameError(t('projectNameRequired', { defaultValue: 'Please enter a project name.' }));
      hasError = true;
    }
    if (!startDate) {
      setStartDateError(t('startDateRequired', { defaultValue: 'Please select a start date.' }));
      hasError = true;
    }
    if (hasError || !templateId) return;

    const overrides = buildSettingsOverrides(
      { ...formValues, projectName: trimmed, startDate: startDate as Dayjs },
      template?.includes
    );

    const errorMsg = await onImport(templateId, {
      projectName: trimmed,
      start_date: (startDate as Dayjs).format('YYYY-MM-DD'),
      settings_overrides: overrides,
    });
    if (errorMsg) {
      setNameError(errorMsg);
    }
  };

  const handleBack = () => {
    setConfirmStep(false);
    setNameError('');
    setStartDateError('');
  };

  const handleClose = () => {
    setConfirmStep(false);
    setProjectName('');
    setNameError('');
    setStartDateError('');
    onClose();
  };

  const handleFormValuesChange = (patch: Partial<ConfigureTemplateImportFormValues>) => {
    setFormValues(prev => ({ ...prev, ...patch }));
  };

  const renderSection = (
    label: string,
    items: { name?: string; color_code?: string }[] | undefined,
    emptyKey: string
  ) => (
    <div style={{ marginBottom: 16 }}>
      <Text strong style={{ display: 'block', marginBottom: 6 }}>
        {label}
      </Text>
      {items?.length ? (
        <Flex wrap="wrap" gap={6}>
          {items.map((item, i) => (
            <Tag
              key={`${item.name}-${i}`}
              color={item.color_code || undefined}
              style={{
                color: token.colorText,
                backgroundColor: item.color_code ? undefined : token.colorFillAlter,
                borderColor: item.color_code ? undefined : token.colorBorder,
              }}
            >
              {decodeHtmlEntities(item.name)}
            </Tag>
          ))}
        </Flex>
      ) : (
        <Text type="secondary">{t(emptyKey)}</Text>
      )}
    </div>
  );

  const tasks = template?.tasks ?? [];
  const rootTasks = tasks.filter((t: { parent_task_id?: string }) => !t.parent_task_id);
  const subTaskMap: Record<string, typeof tasks> = {};
  tasks.forEach((task: { parent_task_id?: string; original_task_id?: string; id?: string }) => {
    if (task.parent_task_id) {
      if (!subTaskMap[task.parent_task_id]) subTaskMap[task.parent_task_id] = [];
      subTaskMap[task.parent_task_id].push(task);
    }
  });

  const taskCount = tasks.length;
  const createLabel =
    importing && taskCount > 50
      ? t('confirmImportProgress', {
          defaultValue: 'Creating project ({{count}} tasks)…',
          count: taskCount,
        })
      : t('confirmImport', { defaultValue: 'Create Project' });

  return (
    <Modal
      title={
        <Space>
          <Title level={5} style={{ margin: 0 }} id="template-import-modal-title">
            {confirmStep
              ? t('importAsTitle', { defaultValue: 'Configure Project' })
              : `${t('previewTitle', { defaultValue: 'Template Preview' })}: ${decodeHtmlEntities(templateName)}`}
          </Title>
        </Space>
      }
      open={visible}
      onCancel={handleClose}
      width={confirmStep ? 560 : 640}
      centered
      destroyOnHidden
      maskClosable={!importing}
      keyboard={!importing}
      aria-labelledby="template-import-modal-title"
      footer={
        confirmStep && canImport ? (
          <Flex justify="space-between" align="center">
            {initialStep === 'preview' ? (
              <Button onClick={handleBack} disabled={importing} aria-label={t('backToPreview', { defaultValue: 'Back' })}>
                {t('backToPreview', { defaultValue: 'Back' })}
              </Button>
            ) : (
              <span />
            )}
            <Flex gap={8}>
              <Button
                onClick={handleClose}
                disabled={importing}
                aria-label={t('cancelText', { defaultValue: 'Cancel' })}
              >
                {t('cancelText', { defaultValue: 'Cancel' })}
              </Button>
              <Button
                type="primary"
                loading={importing}
                onClick={handleConfirmImport}
                aria-busy={importing}
                aria-label={createLabel}
              >
                {createLabel}
              </Button>
            </Flex>
          </Flex>
        ) : (
          <Flex justify="flex-end" gap={8}>
            <Button onClick={handleClose} aria-label={t('cancelText', { defaultValue: 'Cancel' })}>
              {t('cancelText', { defaultValue: 'Cancel' })}
            </Button>
            {canImport && (
              <Button
                type="primary"
                disabled={!templateId || loading}
                onClick={handleImportClick}
                aria-label={t('importTemplate', { defaultValue: 'Import' })}
              >
                {t('importTemplate', { defaultValue: 'Import' })}
              </Button>
            )}
          </Flex>
        )
      }
    >
      {confirmStep && canImport ? (
        <div
          style={{ maxHeight: '65vh', overflowY: 'auto', paddingRight: 4 }}
          role="region"
          aria-label={t('importAsTitle', { defaultValue: 'Configure Project' })}
        >
          {importing && (
            <div style={{ marginBottom: 16 }} aria-live="polite" aria-busy="true">
              <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                {t('importProgressHint', {
                  defaultValue:
                    taskCount > 0
                      ? 'Creating project and applying template ({{count}} tasks)…'
                      : 'Creating project from template…',
                  count: taskCount,
                })}
              </Text>
              <Progress
                percent={taskCount > 80 ? 70 : 45}
                status="active"
                showInfo={false}
                strokeColor={token.colorPrimary}
                aria-label={t('importProgressHint', {
                  defaultValue: 'Creating project from template…',
                })}
              />
            </div>
          )}
          {loading ? (
            <Skeleton active paragraph={{ rows: 6 }} />
          ) : (
            <>
              <ConfigureTemplateImportForm
                projectName={projectName}
                onProjectNameChange={value => {
                  setProjectName(value);
                  if (nameError) setNameError('');
                }}
                startDate={startDate}
                onStartDateChange={value => {
                  setStartDate(value);
                  if (startDateError) setStartDateError('');
                }}
                settings={template?.settings}
                includes={template?.includes}
                formValues={formValues}
                onFormValuesChange={handleFormValuesChange}
                disabled={importing}
                nameError={nameError}
                startDateError={startDateError}
              />
            </>
          )}
        </div>
      ) : (
        <Skeleton active loading={loading} paragraph={{ rows: 8 }}>
          {!template ? (
            <Empty description={t('noTemplateData')} />
          ) : (
            <div style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: 4 }}>
              {template.description && (
                <>
                  <div style={{ marginBottom: 16 }}>
                    <Text strong style={{ display: 'block', marginBottom: 4 }}>
                      {t('previewDescription')}
                    </Text>
                    <Text type="secondary">{template.description}</Text>
                  </div>
                  <Divider style={{ margin: '8px 0 16px' }} />
                </>
              )}

              {renderSection(t('previewPhases'), template.phases, 'noPhases')}
              {renderSection(t('previewStatuses'), template.status, 'noStatuses')}
              {renderSection(t('previewLabels'), template.labels, 'noLabels')}

              <Divider style={{ margin: '8px 0 16px' }} />

              <div>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>
                  {t('previewTasks')} ({tasks.length})
                </Text>
                {rootTasks.length ? (
                  <List
                    size="small"
                    dataSource={rootTasks}
                    renderItem={(task: {
                      original_task_id?: string;
                      id?: string;
                      name?: string;
                    }) => (
                      <React.Fragment key={task.original_task_id ?? task.id ?? task.name}>
                        <List.Item style={{ padding: '6px 8px', borderBottom: 'none' }}>
                          <Flex gap={8} align="center">
                            <span style={{ color: token.colorTextSecondary, fontSize: 12 }}>▸</span>
                            <Text>{decodeHtmlEntities(task.name)}</Text>
                          </Flex>
                        </List.Item>
                        {(subTaskMap[task.original_task_id ?? task.id ?? ''] ?? []).map(
                          (sub: { original_task_id?: string; id?: string; name?: string }) => (
                            <List.Item
                              key={sub.original_task_id ?? sub.id ?? sub.name}
                              style={{ padding: '4px 8px 4px 32px', borderBottom: 'none' }}
                            >
                              <Flex gap={8} align="center">
                                <span style={{ color: token.colorTextTertiary, fontSize: 11 }}>
                                  ↳
                                </span>
                                <Text type="secondary" style={{ fontSize: 13 }}>
                                  {decodeHtmlEntities(sub.name)}
                                </Text>
                              </Flex>
                            </List.Item>
                          )
                        )}
                      </React.Fragment>
                    )}
                  />
                ) : (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={t('noTasks')}
                    style={{ margin: '8px 0' }}
                  />
                )}
              </div>
            </div>
          )}
        </Skeleton>
      )}
    </Modal>
  );
};

export default ProjectTemplatePreviewModal;
