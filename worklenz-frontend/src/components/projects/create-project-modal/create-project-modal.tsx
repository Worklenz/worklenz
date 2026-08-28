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
import {
  IWorklenzTemplate,
  ICustomTemplate,
} from '@/types/project-templates/project-templates.types';
import { projectsApi } from '@/api/projects/projects.v1.api.service';
import homePageApi from '@/api/home-page/home-page.api.service';
import { ensureCsrfToken, refreshCsrfToken } from '@/api/api-client';
import { evt_projects_create } from '@/shared/worklenz-analytics-events';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import logger from '@/utils/errorLogger';
import { TemplatePreviewDrawer } from './template-preview-drawer';
import { getTemplateIcon } from './template-icon';
import ImportSourceModal from '@/pages/settings/import-export/ImportSourceModal';
import './create-project-modal.css';
import { decodeHtmlEntities } from '@/utils/html-entities';

interface CreateProjectModalProps {
  open: boolean;
  onClose: () => void;
  /** When provided, a successful creation reports the new project's id here instead of
   * navigating to it — used by callers (e.g. the Planner/Home "New Task" modals) that
   * want to stay put and select the new project inline, not abandon their own in-progress
   * form by jumping to the project's page. Omit to keep the default navigate-and-open
   * behavior (the original "Create Project" entry points). */
  onProjectCreated?: (projectId: string) => void;
}

interface ApiErrorWithStatus {
  status?: number | string;
}

// Stable reference (not recreated per render) — ImportSourceModal's setup effect
// depends on this object by identity to decide when to (re)create an import job.
// An inline object literal here would get a new reference on every render of this
// component, refiring that effect (and abandoning the in-flight job) on any
// unrelated re-render while the CSV wizard is open, e.g. RTK Query cache
// invalidation right after the target project is created.
const CSV_IMPORT_SOURCE = { key: 'csv', label: 'CSV', icon: null };

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
          {decodeHtmlEntities(template.name)}
        </Typography.Text>
        <Typography.Text
          type="secondary"
          ellipsis={{ tooltip: decodeHtmlEntities(template.name) }}
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

export const CreateProjectModal = ({
  open,
  onClose,
  onProjectCreated,
}: CreateProjectModalProps) => {
  const { t } = useTranslation('create-project-modal');
  const { token } = theme.useToken();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { trackMixpanelEvent } = useMixpanelTracking();
  const [form] = Form.useForm();

  const [projectName, setProjectName] = useState('');
  const [selectedColor, setSelectedColor] = useState(projectColors[0]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedTemplateType, setSelectedTemplateType] = useState<'worklenz' | 'custom' | null>(
    null
  );
  const [templateSearch, setTemplateSearch] = useState('');
  const [templates, setTemplates] = useState<IWorklenzTemplate[]>([]);
  const [customTemplates, setCustomTemplates] = useState<ICustomTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [loadingCustomTemplates, setLoadingCustomTemplates] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'templates' | 'projectTemplates' | 'csv'>('templates');
  const [isCsvImportSelected, setIsCsvImportSelected] = useState(false);
  const [isCsvImportOpen, setIsCsvImportOpen] = useState(false);

  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(null);
  const [previewTemplateName, setPreviewTemplateName] = useState<string | undefined>(undefined);
  const [previewTemplateType, setPreviewTemplateType] = useState<'worklenz' | 'custom'>('worklenz');
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

  const loadCustomTemplates = useCallback(async () => {
    try {
      setLoadingCustomTemplates(true);
      const res = await projectTemplatesApiService.getCustomTemplates();
      if (res.done) {
        setCustomTemplates(res.body);
      }
    } catch (err) {
      logger.error('Failed to load custom templates', err);
      // Don't set error as custom templates are optional
    } finally {
      setLoadingCustomTemplates(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setProjectName('');
      setSelectedColor(projectColors[0]);
      setSelectedTemplateId(null);
      setSelectedTemplateType(null);
      setTemplateSearch('');
      setTemplates([]);
      setCustomTemplates([]);
      setError(null);
      setActiveTab('templates');
      setIsCsvImportSelected(false);
      setIsCsvImportOpen(false);
      form.resetFields();
      hasLoadedTemplates.current = false;
      setTimeout(() => nameInputRef.current?.focus(), 100);
      refreshCsrfToken().catch(() => undefined);
      loadTemplates();
      loadCustomTemplates();
    }
  }, [open, form, loadTemplates, loadCustomTemplates]);

  const filteredTemplates = useMemo(() => {
    const query = templateSearch.trim().toLowerCase();
    if (!query) return templates;
    return templates.filter(template => (template.name ?? '').toLowerCase().includes(query));
  }, [templates, templateSearch]);

  const filteredCustomTemplates = useMemo(() => {
    const query = templateSearch.trim().toLowerCase();
    if (!query) return customTemplates;
    return customTemplates.filter(template => (template.name ?? '').toLowerCase().includes(query));
  }, [customTemplates, templateSearch]);

  const selectedTemplateName = useMemo(() => {
    if (!selectedTemplateId) return t('blankProject', { defaultValue: 'Blank project' });

    if (selectedTemplateType === 'custom') {
      return decodeHtmlEntities(
        customTemplates.find(template => template.id === selectedTemplateId)?.name ?? ''
      );
    }

    return decodeHtmlEntities(
      templates.find(template => template.id === selectedTemplateId)?.name ?? ''
    );
  }, [selectedTemplateId, selectedTemplateType, templates, customTemplates, t]);

  const createConfiguredProjectForImport = useCallback(async (): Promise<string> => {
    const name = projectName.trim();

    if (selectedTemplateId) {
      const response =
        selectedTemplateType === 'custom'
          ? await projectTemplatesApiService.createFromCustomTemplate({
              template_id: selectedTemplateId,
              project_name: name || undefined,
              color_code: selectedColor,
            })
          : await projectTemplatesApiService.createFromWorklenzTemplate({
              template_id: selectedTemplateId,
              project_name: name || undefined,
              color_code: selectedColor,
            });

      if (response.done && response.body.project_id) {
        trackMixpanelEvent(evt_projects_create);
        dispatch(projectsApi.util.invalidateTags([{ type: 'Projects', id: 'LIST' }]));
        dispatch(homePageApi.util.invalidateTags(['teamProjects']));
        return response.body.project_id;
      }

      throw new Error(
        response.message ||
          t('createError', { defaultValue: 'Failed to create project. Please try again.' })
      );
    }

    const csrfToken = await ensureCsrfToken();
    if (!csrfToken) {
      throw new Error(
        t('csrfError', { defaultValue: 'Security token missing. Please refresh and try again.' })
      );
    }

    const projectModel: IProjectViewModel = {
      name,
      color_code: selectedColor,
      status_id: defaultStatusId,
    };
    let response = await createProject(projectModel);
    const responseError = 'error' in response ? (response.error as ApiErrorWithStatus) : undefined;

    if (responseError?.status === 403) {
      const refreshedToken = await refreshCsrfToken();
      if (!refreshedToken) {
        throw new Error(
          t('csrfError', { defaultValue: 'Security token missing. Please refresh and try again.' })
        );
      }
      response = await createProject(projectModel);
    }

    if (response.data?.done && response.data.body.id) {
      trackMixpanelEvent(evt_projects_create);
      dispatch(homePageApi.util.invalidateTags(['teamProjects']));
      return response.data.body.id;
    }

    throw new Error(
      response.data?.message ||
        t('createError', { defaultValue: 'Failed to create project. Please try again.' })
    );
  }, [
    createProject,
    defaultStatusId,
    dispatch,
    projectName,
    selectedColor,
    selectedTemplateId,
    selectedTemplateType,
    t,
    trackMixpanelEvent,
  ]);

  const handleCreate = useCallback(async () => {
    const name = projectName.trim();
    // Allow creation without name when template is selected (will be auto-generated)
    if (!name && !selectedTemplateId) return;

    setError(null);

    if (isCsvImportSelected) {
      setIsCsvImportOpen(true);
      return;
    }

    // Always keeps the Planner/Home "New Task" project dropdown (a separate RTK Query
    // slice, homePageApi) in sync — projectsApi's own tag invalidation above only reaches
    // its own cache. When onProjectCreated is provided, skips navigate/reload entirely:
    // those callers render this modal inline inside their own in-progress form, and
    // jumping to the new project's page (or hard-reloading, for the blank-project path)
    // would silently discard whatever the user had already typed there. Without the
    // prop, behavior is unchanged from before — the original "Create Project" entry
    // points still navigate to (and, for a blank project, reload onto) the new project.
    const finishCreate = (newProjectId: string, reloadOnNavigate: boolean) => {
      dispatch(homePageApi.util.invalidateTags(['teamProjects']));
      onClose();
      if (onProjectCreated) {
        onProjectCreated(newProjectId);
        return;
      }
      navigate(
        `/worklenz/projects/${newProjectId}?tab=tasks-list&pinned_tab=tasks-list&new_project=1`
      );
      if (reloadOnNavigate) {
        setTimeout(() => {
          window.location.reload();
        }, 100);
      }
    };

    try {
      if (selectedTemplateId) {
        // Handle custom templates differently
        if (selectedTemplateType === 'custom') {
          const res = await projectTemplatesApiService.createFromCustomTemplate({
            template_id: selectedTemplateId,
            project_name: name || undefined,
            color_code: selectedColor,
          });
          if (res.done && res.body.project_id) {
            trackMixpanelEvent(evt_projects_create);
            dispatch(projectsApi.util.invalidateTags([{ type: 'Projects', id: 'LIST' }]));
            finishCreate(res.body.project_id, false);
          } else {
            setError(
              res.message ||
                t('createError', { defaultValue: 'Failed to create project. Please try again.' })
            );
          }
          return;
        }

        // Handle Worklenz templates
        const res = await projectTemplatesApiService.createFromWorklenzTemplate({
          template_id: selectedTemplateId,
          project_name: name || undefined,
          color_code: selectedColor,
        });
        if (res.done && res.body.project_id) {
          trackMixpanelEvent(evt_projects_create);
          dispatch(projectsApi.util.invalidateTags([{ type: 'Projects', id: 'LIST' }]));
          finishCreate(res.body.project_id, false);
        } else {
          setError(
            res.message ||
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
        finishCreate(response.data.body.id, true);
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
          finishCreate(retryResponse.data.body.id, true);
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
    selectedTemplateType,
    selectedColor,
    onProjectCreated,
    defaultStatusId,
    createProject,
    dispatch,
    navigate,
    onClose,
    t,
    trackMixpanelEvent,
    isCsvImportSelected,
  ]);

  const canCreate = isCsvImportSelected
    ? projectName.trim().length > 0 && !!defaultStatusId
    : (projectName.trim().length > 0 || selectedTemplateId) &&
      (selectedTemplateId ? true : !!defaultStatusId);

  const handleCsvImportStarted = useCallback(
    (projectId: string) => {
      setIsCsvImportOpen(false);
      onClose();
      if (onProjectCreated) {
        onProjectCreated(projectId);
        return;
      }
      navigate(
        `/worklenz/projects/${projectId}?tab=tasks-list&pinned_tab=tasks-list&new_project=1`
      );
      if (!selectedTemplateId) {
        setTimeout(() => {
          window.location.reload();
        }, 100);
      }
    },
    [navigate, onClose, onProjectCreated, selectedTemplateId]
  );

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
        open={open && !isCsvImportOpen}
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
                  placeholder={
                    selectedTemplateId
                      ? t('projectNameOptional', {
                          defaultValue: 'Optional - will use template name',
                        })
                      : t('projectNameExample', { defaultValue: 'e.g. Q3 Website Refresh' })
                  }
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

            <div
              style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}
            >
              <section className="create-project-template-panel">
                <div className="create-project-template-tabs" style={{ marginBottom: 16 }}>
                  <Button
                    type={activeTab === 'templates' ? 'primary' : 'default'}
                    onClick={() => setActiveTab('templates')}
                    style={{ marginRight: 8 }}
                  >
                    {t('templates', { defaultValue: 'Templates' })}
                  </Button>
                  {customTemplates.length > 0 && (
                    <Button
                      type={activeTab === 'projectTemplates' ? 'primary' : 'default'}
                      onClick={() => setActiveTab('projectTemplates')}
                    >
                      {t('yourLibrary', { defaultValue: 'Your Library' })}
                    </Button>
                  )}
                  <Button
                    type={activeTab === 'csv' ? 'primary' : 'default'}
                    onClick={() => {
                      setIsCsvImportSelected(true);
                      setActiveTab('csv');
                    }}
                    aria-pressed={isCsvImportSelected}
                  >
                    {t('importTasksCsv', { defaultValue: 'Import from CSV' })}
                  </Button>
                </div>

                {/* Templates Tab */}
                {activeTab === 'templates' && (
                  <>
                    <div className="create-project-template-toolbar">
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
                        onClick={() => {
                          setSelectedTemplateId(null);
                          setSelectedTemplateType(null);
                        }}
                        isBlank
                      />

                      {loadingTemplates ? (
                        <Skeleton active paragraph={{ rows: 2 }} title={false} />
                      ) : filteredTemplates.length === 0 ? (
                        <Typography.Text type="secondary" className="create-project-template-empty">
                          {t('noTemplates', { defaultValue: 'No templates found.' })}
                        </Typography.Text>
                      ) : (
                        filteredTemplates.map(template => (
                          <TemplateCard
                            key={template.id}
                            template={template}
                            selected={
                              selectedTemplateId === template.id &&
                              selectedTemplateType === 'worklenz'
                            }
                            onClick={() => {
                              setSelectedTemplateId(template.id ?? null);
                              setSelectedTemplateType('worklenz');
                            }}
                            onPreview={() => {
                              setPreviewTemplateId(template.id ?? null);
                              setPreviewTemplateName(template.name);
                              setPreviewTemplateType('worklenz');
                              setPreviewOpen(true);
                            }}
                          />
                        ))
                      )}
                    </div>
                  </>
                )}

                {/* Project Templates Tab */}
                {activeTab === 'projectTemplates' && (
                  <>
                    <div className="create-project-template-toolbar">
                      <Input
                        size="middle"
                        placeholder={t('searchYourLibrary', {
                          defaultValue: 'Search your library',
                        })}
                        prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
                        value={templateSearch}
                        onChange={event => setTemplateSearch(event.target.value)}
                        className="create-project-template-search"
                        aria-label={t('searchYourLibrary', { defaultValue: 'Search your library' })}
                      />
                    </div>

                    <div
                      className="create-project-template-list"
                      role="listbox"
                      aria-label={t('yourLibrary', { defaultValue: 'Your Library' })}
                    >
                      {loadingCustomTemplates ? (
                        <Skeleton active paragraph={{ rows: 2 }} title={false} />
                      ) : filteredCustomTemplates.length === 0 ? (
                        <Typography.Text type="secondary" className="create-project-template-empty">
                          {t('noYourLibrary', { defaultValue: 'No templates in your library.' })}
                        </Typography.Text>
                      ) : (
                        filteredCustomTemplates.map(template => (
                          <TemplateCard
                            key={template.id}
                            template={{
                              id: template.id,
                              name: template.name,
                              task_count: 0,
                              phase_count: 0,
                            }}
                            selected={
                              selectedTemplateId === template.id &&
                              selectedTemplateType === 'custom'
                            }
                            onClick={() => {
                              setSelectedTemplateId(template.id ?? null);
                              setSelectedTemplateType('custom');
                            }}
                            onPreview={() => {
                              setPreviewTemplateId(template.id ?? null);
                              setPreviewTemplateName(template.name);
                              setPreviewTemplateType('custom');
                              setPreviewOpen(true);
                            }}
                          />
                        ))
                      )}
                    </div>
                  </>
                )}

                {activeTab === 'csv' && (
                  <Flex
                    vertical
                    gap={12}
                    align="flex-start"
                    style={{ padding: '24px 0', maxWidth: 480 }}
                  >
                    <Typography.Title level={4} style={{ margin: 0, color: token.colorText }}>
                      {t('importTasksCsv', { defaultValue: 'Import from CSV' })}
                    </Typography.Title>
                    <Typography.Text type="secondary">
                      {t('csvImportHint', {
                        defaultValue:
                          'Upload a CSV file, map its fields, and import the tasks into this project.',
                      })}
                    </Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {t('csvImportSelected', { defaultValue: 'CSV task import selected' })}
                    </Typography.Text>
                  </Flex>
                )}
              </section>
            </div>
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
                : isCsvImportSelected
                  ? t('csvImportFooterHint', {
                      defaultValue: 'You will map CSV fields before this project is created.',
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
                    ? isCsvImportSelected
                      ? t('nameRequired', { defaultValue: 'Enter a project name to continue.' })
                      : selectedTemplateId
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
                    isCsvImportSelected
                      ? t('continueToCsvImport', { defaultValue: 'Continue to CSV import' })
                      : selectedTemplateId
                        ? t('createFromTemplate', { defaultValue: 'Create from template' })
                        : t('createBlank', { defaultValue: 'Create blank' })
                  }
                >
                  {isCsvImportSelected
                    ? t('continueToCsvImport', { defaultValue: 'Continue to CSV import' })
                    : selectedTemplateId
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
        templateType={previewTemplateType}
        onClose={() => setPreviewOpen(false)}
        onUseTemplate={id => {
          setSelectedTemplateId(id);
          setPreviewOpen(false);
        }}
      />
      <ImportSourceModal
        open={open && isCsvImportOpen}
        onClose={() => {
          // The CSV wizard's own close ("X") button means "abandon the import
          // entirely" from the user's point of view — not "go back to the
          // project-naming screen". Close both, matching that expectation.
          setIsCsvImportOpen(false);
          onClose();
        }}
        source={CSV_IMPORT_SOURCE}
        createTargetProject={createConfiguredProjectForImport}
        initialProjectName={projectName.trim()}
        hideProjectSetup
        onImportStarted={handleCsvImportStarted}
      />
    </>
  );
};

export default CreateProjectModal;
