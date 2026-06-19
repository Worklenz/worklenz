import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  ArrowRightOutlined,
  Button,
  EyeOutlined,
  FileOutlined,
  Flex,
  Form,
  InfoCircleOutlined,
  Input,
  Modal,
  SearchOutlined,
  Skeleton,
  Tooltip,
  Typography,
  theme,
} from '@/shared/antd-imports';
import type { InputRef } from '@/shared/antd-imports';

import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { projectColors } from '@/lib/project/project-constants';
import { useCreateProjectMutation } from '@/api/projects/projects.v1.api.service';
import { projectTemplatesApiService } from '@/api/project-templates/project-templates.api.service';
import { fetchProjectStatuses } from '@/features/projects/lookups/projectStatuses/projectStatusesSlice';
import { IProjectViewModel } from '@/types/project/projectViewModel.types';
import { IWorklenzTemplate } from '@/types/project-templates/project-templates.types';
import { projectsApi } from '@/api/projects/projects.v1.api.service';
import { ensureCsrfToken, refreshCsrfToken } from '@/api/api-client';
import { evt_projects_create } from '@/shared/worklenz-analytics-events';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import logger from '@/utils/errorLogger';
import { TemplatePreviewDrawer } from './template-preview-drawer';
import { getTemplateIcon } from './template-icon';
import './create-project-modal.css';

interface CreateProjectModalProps {
  open: boolean;
  onClose: () => void;
}

interface ApiErrorWithStatus {
  status?: number | string;
}

interface CreateProjectCssVariables extends CSSProperties {
  '--create-project-bg-container': string;
  '--create-project-border': string;
  '--create-project-border-secondary': string;
  '--create-project-fill-quaternary': string;
  '--create-project-primary': string;
  '--create-project-primary-bg': string;
  '--create-project-text-secondary': string;
}

interface TemplateCardProps {
  template: IWorklenzTemplate;
  selected: boolean;
  onClick: () => void;
  onPreview?: () => void;
  isBlank?: boolean;
}

const TemplateCard = ({
  template,
  selected,
  onClick,
  onPreview,
  isBlank = false,
}: TemplateCardProps) => {
  const { token } = theme.useToken();
  const { t } = useTranslation('create-project-modal');

  return (
    <button
      type="button"
      className={`create-project-template-card${selected ? ' create-project-template-card--selected' : ''}`}
      style={{
        background: selected ? token.colorPrimaryBg : token.colorBgContainer,
        borderColor: selected ? token.colorPrimary : token.colorBorder,
        color: selected ? token.colorPrimary : token.colorText,
      }}
      onClick={onClick}
      aria-pressed={selected}
    >
      <span className="create-project-template-thumbnail" aria-hidden="true">
        {isBlank ? (
          <span className="create-project-blank-thumbnail">
            <FileOutlined />
          </span>
        ) : template.image_url ? (
          <img src={template.image_url} alt="" className="create-project-template-image" />
        ) : (
          <span className="create-project-template-board">
            <span />
            <span />
            <span />
          </span>
        )}
      </span>

      <span className="create-project-template-card-body">
        <Typography.Text strong ellipsis style={{ color: token.colorText }}>
          {template.name}
        </Typography.Text>
        <Typography.Text
          type="secondary"
          ellipsis={{ tooltip: template.name }}
          style={{ fontSize: 12 }}
        >
          {isBlank
            ? t('blankProjectDesc', { defaultValue: 'Empty project you can shape from scratch.' })
            : t('templateMeta', {
                defaultValue: '{{tasks}} tasks, {{phases}} phases',
                tasks: template.task_count ?? 0,
                phases: template.phase_count ?? 0,
              })}
        </Typography.Text>
      </span>

      {!isBlank && onPreview && (
        <Tooltip title={t('previewTemplate', { defaultValue: 'Preview template' })}>
          <span
            role="button"
            tabIndex={0}
            className="create-project-template-preview-btn"
            onClick={event => {
              event.stopPropagation();
              onPreview();
            }}
            onKeyDown={event => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                event.stopPropagation();
                onPreview();
              }
            }}
            aria-label={t('previewTemplate', { defaultValue: 'Preview template' })}
          >
            <EyeOutlined />
          </span>
        </Tooltip>
      )}
    </button>
  );
};

interface ColorSwatchProps {
  color: string;
  selected: boolean;
  onClick: () => void;
}

const ColorSwatch = ({ color, selected, onClick }: ColorSwatchProps) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={color}
    aria-pressed={selected}
    className={`create-project-color-swatch${selected ? ' create-project-color-swatch--selected' : ''}`}
    style={{ background: color, color }}
  />
);

export const CreateProjectModal = ({ open, onClose }: CreateProjectModalProps) => {
  const { t } = useTranslation('create-project-modal');
  const { token } = theme.useToken();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { trackMixpanelEvent } = useMixpanelTracking();
  const [form] = Form.useForm();

  const [projectName, setProjectName] = useState('');
  const [selectedColor, setSelectedColor] = useState(projectColors[0]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [templateSearch, setTemplateSearch] = useState('');
  const [templates, setTemplates] = useState<IWorklenzTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(null);
  const [previewTemplateName, setPreviewTemplateName] = useState<string | undefined>(undefined);
  const [previewOpen, setPreviewOpen] = useState(false);

  const [createProject, { isLoading: isCreating }] = useCreateProjectMutation();
  const nameInputRef = useRef<InputRef>(null);
  const hasLoadedTemplates = useRef(false);

  const { projectStatuses } = useAppSelector(state => state.projectStatusesReducer);
  const defaultStatusId = useMemo(
    () => projectStatuses.find(status => status.is_default)?.id ?? projectStatuses[0]?.id,
    [projectStatuses]
  );

  const blankTemplate = useMemo<IWorklenzTemplate>(
    () => ({
      name: t('blankProject', { defaultValue: 'Blank project' }),
      task_count: 0,
      phase_count: 0,
    }),
    [t]
  );

  const modalCssVariables = useMemo<CreateProjectCssVariables>(
    () => ({
      '--create-project-bg-container': token.colorBgContainer,
      '--create-project-border': token.colorBorder,
      '--create-project-border-secondary': token.colorBorderSecondary,
      '--create-project-fill-quaternary': token.colorFillQuaternary,
      '--create-project-primary': token.colorPrimary,
      '--create-project-primary-bg': token.colorPrimaryBg,
      '--create-project-text-secondary': token.colorTextSecondary,
    }),
    [token]
  );

  useEffect(() => {
    if (projectStatuses.length === 0) {
      dispatch(fetchProjectStatuses());
    }
  }, [dispatch, projectStatuses.length]);

  const loadTemplates = useCallback(async () => {
    if (hasLoadedTemplates.current) return;
    try {
      hasLoadedTemplates.current = true;
      setLoadingTemplates(true);
      const res = await projectTemplatesApiService.getWorklenzTemplates();
      if (res.done) {
        setTemplates(res.body);
      }
    } catch (err) {
      logger.error('Failed to load templates', err);
      setError(
        t('templateLoadError', { defaultValue: 'Failed to load templates. Please try again.' })
      );
    } finally {
      setLoadingTemplates(false);
    }
  }, [t]);

  useEffect(() => {
    if (open) {
      setProjectName('');
      setSelectedColor(projectColors[0]);
      setSelectedTemplateId(null);
      setTemplateSearch('');
      setTemplates([]);
      setError(null);
      form.resetFields();
      hasLoadedTemplates.current = false;
      setTimeout(() => nameInputRef.current?.focus(), 100);
      refreshCsrfToken().catch(() => undefined);
      loadTemplates();
    }
  }, [open, form, loadTemplates]);

  const filteredTemplates = useMemo(() => {
    const query = templateSearch.trim().toLowerCase();
    if (!query) return templates;
    return templates.filter(template => (template.name ?? '').toLowerCase().includes(query));
  }, [templates, templateSearch]);

  const selectedTemplateName = useMemo(() => {
    if (!selectedTemplateId) return t('blankProject', { defaultValue: 'Blank project' });
    return templates.find(template => template.id === selectedTemplateId)?.name ?? '';
  }, [selectedTemplateId, templates, t]);

  const handleCreate = useCallback(async () => {
    const name = projectName.trim();
    // Allow creation without name when template is selected (will be auto-generated)
    if (!name && !selectedTemplateId) return;

    setError(null);

    try {
      if (selectedTemplateId) {
        const res = await projectTemplatesApiService.createFromWorklenzTemplate({
          template_id: selectedTemplateId,
          project_name: name || undefined, // Pass undefined if no name provided
          color_code: selectedColor,
        });
        if (res.done && res.body.project_id) {
          trackMixpanelEvent(evt_projects_create);
          dispatch(projectsApi.util.invalidateTags([{ type: 'Projects', id: 'LIST' }]));
          onClose();
          navigate(
            `/worklenz/projects/${res.body.project_id}?tab=tasks-list&pinned_tab=tasks-list&new_project=1`
          );
        } else {
          setError(
            t('createError', { defaultValue: 'Failed to create project. Please try again.' })
          );
        }
        return;
      }

      const csrfToken = await ensureCsrfToken();
      if (!csrfToken) {
        setError(
          t('csrfError', { defaultValue: 'Security token missing. Please refresh and try again.' })
        );
        return;
      }

      const projectModel: IProjectViewModel = {
        name,
        color_code: selectedColor,
        status_id: defaultStatusId,
      };

      const response = await createProject(projectModel);

      if (response?.data?.done) {
        trackMixpanelEvent(evt_projects_create);
        onClose();
        navigate(
          `/worklenz/projects/${response.data.body.id}?tab=tasks-list&pinned_tab=tasks-list&new_project=1`
        );
        setTimeout(() => {
          window.location.reload();
        }, 100);
        return;
      }

      const responseError =
        'error' in response ? (response.error as ApiErrorWithStatus) : undefined;

      if (responseError?.status === 403) {
        const newToken = await refreshCsrfToken();
        if (!newToken) {
          setError(
            t('csrfError', {
              defaultValue: 'Security token missing. Please refresh and try again.',
            })
          );
          return;
        }
        const retryResponse = await createProject(projectModel);
        if (retryResponse?.data?.done) {
          trackMixpanelEvent(evt_projects_create);
          onClose();
          navigate(
            `/worklenz/projects/${retryResponse.data.body.id}?tab=tasks-list&pinned_tab=tasks-list&new_project=1`
          );
          setTimeout(() => {
            window.location.reload();
          }, 100);
        } else {
          setError(
            retryResponse?.data?.message ??
              t('createError', { defaultValue: 'Failed to create project. Please try again.' })
          );
        }
        return;
      }

      setError(
        response?.data?.message ??
          t('createError', { defaultValue: 'Failed to create project. Please try again.' })
      );
    } catch (err) {
      logger.error('Error creating project', err);
      setError(t('createError', { defaultValue: 'Failed to create project. Please try again.' }));
    }
  }, [
    projectName,
    selectedTemplateId,
    selectedColor,
    defaultStatusId,
    createProject,
    dispatch,
    navigate,
    onClose,
    t,
    trackMixpanelEvent,
  ]);

  const canCreate =
    (projectName.trim().length > 0 || selectedTemplateId) && (selectedTemplateId ? true : !!defaultStatusId);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Enter' && canCreate && !isCreating) {
        handleCreate();
      }
    },
    [handleCreate, canCreate, isCreating]
  );

  return (
    <>
      <Modal
        open={open}
        onCancel={onClose}
        footer={null}
        destroyOnClose
        width={880}
        className="create-project-modal"
        title={
          <div>
            <Typography.Text strong style={{ fontSize: 16 }}>
              {t('title', { defaultValue: 'New project' })}
            </Typography.Text>
            <br />
            <Typography.Text type="secondary" style={{ fontSize: 13, fontWeight: 400 }}>
              {t('subtitle', { defaultValue: 'Name it, then start blank or grab a template.' })}
            </Typography.Text>
          </div>
        }
        styles={{ body: { padding: 0 } }}
      >
        <Form form={form} layout="vertical" onKeyDown={handleKeyDown} style={modalCssVariables}>
          <div className="create-project-layout">
            <aside className="create-project-config-panel">
              <Form.Item
                label={t('projectName', { defaultValue: 'Project name' })}
                required={!selectedTemplateId}
                style={{ marginBottom: 16 }}
              >
                <Input
                  ref={nameInputRef}
                  size="large"
                  placeholder={selectedTemplateId ? t('projectNameOptional', { defaultValue: 'Optional - will use template name' }) : t('projectNameExample', { defaultValue: 'e.g. Q3 Website Refresh' })}
                  value={projectName}
                  onChange={event => setProjectName(event.target.value)}
                  maxLength={100}
                  aria-label={t('projectName', { defaultValue: 'Project name' })}
                  autoComplete="off"
                />
              </Form.Item>

              <Form.Item
                label={t('projectColor', { defaultValue: 'Color' })}
                style={{ marginBottom: 16 }}
              >
                <Flex
                  gap={10}
                  wrap="wrap"
                  role="group"
                  aria-label={t('projectColor', { defaultValue: 'Color' })}
                >
                  {projectColors.map(color => (
                    <ColorSwatch
                      key={color}
                      color={color}
                      selected={selectedColor === color}
                      onClick={() => setSelectedColor(color)}
                    />
                  ))}
                </Flex>
              </Form.Item>

              <div
                className="create-project-starting-card"
                style={{ borderColor: token.colorBorder, background: token.colorFillQuaternary }}
              >
                <Typography.Text className="create-project-starting-label" type="secondary">
                  {t('startingFrom', { defaultValue: 'Starting from' })}
                </Typography.Text>
                <Typography.Text strong style={{ display: 'block', color: token.colorText }}>
                  {selectedTemplateName}
                </Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {selectedTemplateId
                    ? t('templateSelectedHint', {
                        defaultValue: 'Template structure will be copied into your project.',
                      })
                    : t('blankSelectedHint', {
                        defaultValue:
                          'Empty project. Pick a template on the right to get a head start.',
                      })}
                </Typography.Text>
              </div>

              <Typography.Text className="create-project-config-note" type="secondary">
                <InfoCircleOutlined />{' '}
                {t('configureHint', {
                  defaultValue:
                    'Status, dates, manager and more are set inside the project after creation.',
                })}
              </Typography.Text>
            </aside>

            <section className="create-project-template-panel">
              <div className="create-project-template-toolbar">
                <Typography.Text strong style={{ color: token.colorText }}>
                  {t('templates', { defaultValue: 'Templates' })}
                </Typography.Text>
                <Input
                  size="middle"
                  placeholder={t('searchTemplates', { defaultValue: 'Search templates' })}
                  prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
                  value={templateSearch}
                  onChange={event => setTemplateSearch(event.target.value)}
                  className="create-project-template-search"
                  aria-label={t('searchTemplates', { defaultValue: 'Search templates' })}
                />
              </div>

              <div
                className="create-project-template-list"
                role="listbox"
                aria-label={t('templates', { defaultValue: 'Templates' })}
              >
                <TemplateCard
                  template={blankTemplate}
                  selected={!selectedTemplateId}
                  onClick={() => setSelectedTemplateId(null)}
                  isBlank
                />
                {loadingTemplates ? (
                  <Skeleton active paragraph={{ rows: 4 }} title={false} />
                ) : filteredTemplates.length === 0 ? (
                  <Typography.Text type="secondary" className="create-project-template-empty">
                    {t('noTemplates', { defaultValue: 'No templates found.' })}
                  </Typography.Text>
                ) : (
                  filteredTemplates.map(template => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      selected={selectedTemplateId === template.id}
                      onClick={() => setSelectedTemplateId(template.id ?? null)}
                      onPreview={() => {
                        setPreviewTemplateId(template.id ?? null);
                        setPreviewTemplateName(template.name);
                        setPreviewOpen(true);
                      }}
                    />
                  ))
                )}
              </div>
            </section>
          </div>

          {error && (
            <Alert
              type="error"
              message={error}
              showIcon
              className="create-project-error"
              closable
              onClose={() => setError(null)}
            />
          )}

          <Flex
            justify="space-between"
            align="center"
            className="create-project-footer"
            style={{ borderColor: token.colorBorderSecondary }}
          >
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {selectedTemplateId
                ? t('templateFooterHint', {
                    defaultValue: 'Selected template will be used for this project.',
                  })
                : t('blankFooterHint', {
                    defaultValue: 'No template selected - will create blank.',
                  })}
            </Typography.Text>
            <Flex gap={8}>
              <Button onClick={onClose} disabled={isCreating}>
                {t('cancel', { defaultValue: 'Cancel' })}
              </Button>
              <Tooltip
                title={
                  !canCreate
                    ? selectedTemplateId
                      ? undefined
                      : t('nameRequired', { defaultValue: 'Enter a project name to continue.' })
                    : undefined
                }
              >
                <Button
                  type="primary"
                  onClick={handleCreate}
                  loading={isCreating}
                  disabled={!canCreate}
                  aria-label={
                    selectedTemplateId
                      ? t('createFromTemplate', { defaultValue: 'Create from template' })
                      : t('createBlank', { defaultValue: 'Create blank' })
                  }
                >
                  {selectedTemplateId
                    ? t('createProject', { defaultValue: 'Create project' })
                    : t('createBlank', { defaultValue: 'Create blank' })}{' '}
                  <ArrowRightOutlined />
                </Button>
              </Tooltip>
            </Flex>
          </Flex>
        </Form>
      </Modal>

      <TemplatePreviewDrawer
        templateId={previewTemplateId}
        templateName={previewTemplateName}
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        onUseTemplate={id => {
          setSelectedTemplateId(id);
          setPreviewOpen(false);
        }}
      />
    </>
  );
};

export default CreateProjectModal;
