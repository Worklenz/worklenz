import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  AppstoreOutlined,
  Button,
  FileOutlined,
  Flex,
  Form,
  Input,
  Modal,
  SearchOutlined,
  Skeleton,
  Tooltip,
  Typography,
  theme,
} from '@/shared/antd-imports';

import { useAppDispatch } from '@/hooks/useAppDispatch';
import { projectColors } from '@/lib/project/project-constants';
import { useCreateProjectMutation } from '@/api/projects/projects.v1.api.service';
import { projectTemplatesApiService } from '@/api/project-templates/project-templates.api.service';
import { IProjectViewModel } from '@/types/project/projectViewModel.types';
import { IWorklenzTemplate } from '@/types/project-templates/project-templates.types';
import { projectsApi } from '@/api/projects/projects.v1.api.service';
import { ensureCsrfToken, refreshCsrfToken } from '@/api/api-client';
import { evt_projects_create } from '@/shared/worklenz-analytics-events';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import logger from '@/utils/errorLogger';
import './create-project-modal.css';

type ProjectType = 'blank' | 'template';

interface CreateProjectModalProps {
  open: boolean;
  onClose: () => void;
}

// ─── Template card subcomponent ────────────────────────────────────────────
interface TemplateCardProps {
  template: IWorklenzTemplate;
  selected: boolean;
  onClick: () => void;
}

const TemplateCard = ({ template, selected, onClick }: TemplateCardProps) => {
  const { token } = theme.useToken();

  return (
    <button
      type="button"
      onClick={onClick}
      className={`create-project-template-card${selected ? ' create-project-template-card--selected' : ''}`}
      style={{
        background: selected ? token.colorPrimaryBg : token.colorBgContainer,
        borderColor: selected ? token.colorPrimary : token.colorBorder,
        color: token.colorText,
      }}
      aria-pressed={selected}
      aria-label={template.name ?? ''}
    >
      {/* Mini board thumbnail */}
      <div className="create-project-template-thumbnail" aria-hidden="true">
        {[3, 2, 4].map((count, i) => (
          <div key={i} className="create-project-template-column">
            {Array.from({ length: count }).map((_, j) => (
              <div
                key={j}
                className="create-project-template-bar"
                style={{ opacity: 0.5 + j * 0.15, background: token.colorPrimary }}
              />
            ))}
          </div>
        ))}
      </div>
      <Typography.Text
        strong
        style={{ fontSize: 12, color: token.colorText, display: 'block', marginTop: 6 }}
        ellipsis
      >
        {template.name}
      </Typography.Text>
    </button>
  );
};

// ─── Color swatch subcomponent ─────────────────────────────────────────────
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
    style={{ background: color }}
  />
);

// ─── Main component ─────────────────────────────────────────────────────────
export const CreateProjectModal = ({ open, onClose }: CreateProjectModalProps) => {
  const { t } = useTranslation('create-project-modal');
  const { token } = theme.useToken();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { trackMixpanelEvent } = useMixpanelTracking();
  const [form] = Form.useForm();

  const [projectName, setProjectName] = useState('');
  const [selectedColor, setSelectedColor] = useState(projectColors[0]);
  const [projectType, setProjectType] = useState<ProjectType>('blank');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [templateSearch, setTemplateSearch] = useState('');
  const [templates, setTemplates] = useState<IWorklenzTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [createProject, { isLoading: isCreating }] = useCreateProjectMutation();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const hasLoadedTemplates = useRef(false);

  // Focus name input when modal opens
  useEffect(() => {
    if (open) {
      setProjectName('');
      setSelectedColor(projectColors[0]);
      setProjectType('blank');
      setSelectedTemplateId(null);
      setTemplateSearch('');
      setError(null);
      form.resetFields();
      hasLoadedTemplates.current = false;
      setTimeout(() => nameInputRef.current?.focus(), 100);
      // Pre-warm the CSRF token so it's ready before the user clicks Create
      // (mirrors what the old ProjectDrawer did on open)
      refreshCsrfToken().catch(() => {
        // non-fatal — ensureCsrfToken will retry on submit
      });
    }
  }, [open, form]);

  // Load templates once when template type is first selected
  const loadTemplates = useCallback(async () => {
    if (hasLoadedTemplates.current) return;
    try {
      setLoadingTemplates(true);
      const res = await projectTemplatesApiService.getWorklenzTemplates();
      if (res.done) {
        setTemplates(res.body);
        if (res.body.length > 0) {
          setSelectedTemplateId(res.body[0].id ?? null);
        }
      }
    } catch (err) {
      logger.error('Failed to load templates', err);
    } finally {
      setLoadingTemplates(false);
      hasLoadedTemplates.current = true;
    }
  }, []);

  const handleTypeChange = useCallback(
    (type: ProjectType) => {
      setProjectType(type);
      if (type === 'template') {
        loadTemplates();
      }
    },
    [loadTemplates]
  );

  const filteredTemplates = templates.filter(t =>
    (t.name ?? '').toLowerCase().includes(templateSearch.toLowerCase())
  );

  const handleCreate = useCallback(async () => {
    const name = projectName.trim();
    if (!name) return;

    setError(null);

    try {
      if (projectType === 'template' && selectedTemplateId) {
        // Create from template — uses apiClient (axios) which handles CSRF via interceptor
        const res = await projectTemplatesApiService.createFromWorklenzTemplate({
          template_id: selectedTemplateId,
        });
        if (res.done && res.body.project_id) {
          trackMixpanelEvent(evt_projects_create);
          dispatch(projectsApi.util.invalidateTags([{ type: 'Projects', id: 'LIST' }]));
          onClose();
          navigate(
            `/worklenz/projects/${res.body.project_id}?tab=tasks-list&pinned_tab=tasks-list&new_project=1`
          );
        } else {
          setError(t('createError', { defaultValue: 'Failed to create project. Please try again.' }));
        }
        return;
      }

      // Ensure the CSRF token is in memory before RTK Query prepareHeaders runs.
      // RTK Query uses fetchBaseQuery (native fetch), not axios, so the axios
      // interceptor's auto-retry doesn't apply here. We pre-fetch the token so
      // prepareHeaders can read it synchronously from the in-memory cache.
      const csrfToken = await ensureCsrfToken();
      if (!csrfToken) {
        setError(t('csrfError', { defaultValue: 'Security token missing. Please refresh and try again.' }));
        return;
      }

      const projectModel: IProjectViewModel = {
        name,
        color_code: selectedColor,
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
      } else if ((response as any)?.error?.status === 403) {
        // 403 means CSRF token was rejected by the server — refresh and retry once
        const newToken = await refreshCsrfToken();
        if (!newToken) {
          setError(t('csrfError', { defaultValue: 'Security token missing. Please refresh and try again.' }));
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
          setError(retryResponse?.data?.message ?? t('createError', { defaultValue: 'Failed to create project. Please try again.' }));
        }
      } else {
        setError(response?.data?.message ?? t('createError', { defaultValue: 'Failed to create project. Please try again.' }));
      }
    } catch (err) {
      logger.error('Error creating project', err);
      setError(t('createError', { defaultValue: 'Failed to create project. Please try again.' }));
    }
  }, [projectName, projectType, selectedTemplateId, selectedColor, createProject, dispatch, navigate, onClose, t, trackMixpanelEvent]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && projectName.trim() && !isCreating) {
        handleCreate();
      }
    },
    [handleCreate, projectName, isCreating]
  );

  const canCreate = projectName.trim().length > 0 && (projectType === 'blank' || !!selectedTemplateId);

  // ─── Type selector cards ─────────────────────────────────────────────────
  const blankCard = (
    <button
      type="button"
      className={`create-project-type-card${projectType === 'blank' ? ' create-project-type-card--selected' : ''}`}
      style={{
        background: projectType === 'blank' ? token.colorPrimaryBg : token.colorBgContainer,
        borderColor: projectType === 'blank' ? token.colorPrimary : token.colorBorder,
        color: token.colorText,
      }}
      onClick={() => handleTypeChange('blank')}
      aria-pressed={projectType === 'blank'}
    >
      <FileOutlined style={{ fontSize: 20, color: projectType === 'blank' ? token.colorPrimary : token.colorTextSecondary }} />
      <Typography.Text strong style={{ fontSize: 13, color: token.colorText }}>
        {t('blankProject', { defaultValue: 'Blank project' })}
      </Typography.Text>
      <Typography.Text type="secondary" style={{ fontSize: 12, textAlign: 'center' }}>
        {t('blankProjectDesc', { defaultValue: 'Empty board you can shape from scratch.' })}
      </Typography.Text>
    </button>
  );

  const templateCard = (
    <button
      type="button"
      className={`create-project-type-card${projectType === 'template' ? ' create-project-type-card--selected' : ''}`}
      style={{
        background: projectType === 'template' ? token.colorPrimaryBg : token.colorBgContainer,
        borderColor: projectType === 'template' ? token.colorPrimary : token.colorBorder,
        color: token.colorText,
      }}
      onClick={() => handleTypeChange('template')}
      aria-pressed={projectType === 'template'}
    >
      <AppstoreOutlined style={{ fontSize: 20, color: projectType === 'template' ? token.colorPrimary : token.colorTextSecondary }} />
      <Typography.Text strong style={{ fontSize: 13, color: token.colorText }}>
        {t('fromTemplate', { defaultValue: 'From a template' })}
      </Typography.Text>
      <Typography.Text type="secondary" style={{ fontSize: 12, textAlign: 'center' }}>
        {t('fromTemplateDesc', { defaultValue: 'Pre-built phases, labels, and sample tasks.' })}
      </Typography.Text>
    </button>
  );

  // ─── Template browser section ────────────────────────────────────────────
  const templateBrowser = projectType === 'template' && (
    <div className="create-project-template-browser">
      <Input
        size="small"
        placeholder={t('searchTemplates', { defaultValue: 'Search templates' })}
        prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
        value={templateSearch}
        onChange={e => setTemplateSearch(e.target.value)}
        style={{ marginBottom: 8 }}
        aria-label={t('searchTemplates', { defaultValue: 'Search templates' })}
      />
      {loadingTemplates ? (
        <Skeleton active paragraph={{ rows: 2 }} title={false} />
      ) : filteredTemplates.length === 0 ? (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {t('noTemplates', { defaultValue: 'No templates found.' })}
        </Typography.Text>
      ) : (
        <div className="create-project-template-grid" role="listbox" aria-label={t('templates', { defaultValue: 'Templates' })}>
          {filteredTemplates.map(tmpl => (
            <TemplateCard
              key={tmpl.id}
              template={tmpl}
              selected={selectedTemplateId === tmpl.id}
              onClick={() => setSelectedTemplateId(tmpl.id ?? null)}
            />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnClose
      width={520}
      title={
        <div>
          <Typography.Text strong style={{ fontSize: 16 }}>
            {t('title', { defaultValue: 'Create a new project' })}
          </Typography.Text>
          <br />
          <Typography.Text type="secondary" style={{ fontSize: 13, fontWeight: 400 }}>
            {t('subtitle', { defaultValue: 'Start blank or pick a template — configure the rest later.' })}
          </Typography.Text>
        </div>
      }
      styles={{ body: { paddingTop: 8 } }}
    >
      <Form form={form} layout="vertical" onKeyDown={handleKeyDown}>
        {/* Project name input */}
        <Form.Item style={{ marginBottom: 12 }}>
          <Input
            ref={nameInputRef as any}
            size="large"
            placeholder={t('projectNamePlaceholder', { defaultValue: 'Project name' })}
            value={projectName}
            onChange={e => setProjectName(e.target.value)}
            maxLength={100}
            aria-label={t('projectNamePlaceholder', { defaultValue: 'Project name' })}
            autoComplete="off"
          />
        </Form.Item>

        {/* Blank / Template type selector */}
        <Form.Item style={{ marginBottom: 12 }}>
          <div
            className="create-project-type-selector"
            role="group"
            aria-label={t('projectTypeLabel', { defaultValue: 'Project type' })}
          >
            {blankCard}
            {templateCard}
          </div>
        </Form.Item>

        {/* Template browser (shown when "From a template" selected) */}
        {templateBrowser}

        {/* Color picker (shown for blank projects) */}
        {projectType === 'blank' && (
          <Form.Item
            label={
              <Typography.Text style={{ fontSize: 13 }}>
                {t('projectColor', { defaultValue: 'Project color' })}
              </Typography.Text>
            }
            style={{ marginBottom: 12 }}
          >
            <Flex gap={6} wrap="wrap" role="group" aria-label={t('projectColor', { defaultValue: 'Project color' })}>
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
        )}

        {/* Info hint */}
        <Typography.Text
          type="secondary"
          style={{ fontSize: 12, display: 'block', marginBottom: 12 }}
        >
          <span role="img" aria-hidden="true">ℹ️</span>{' '}
          {t('configureHint', { defaultValue: 'Status, dates, manager, and more — set inside the project via the gear icon.' })}
        </Typography.Text>

        {/* Error */}
        {error && (
          <Alert
            type="error"
            message={error}
            showIcon
            style={{ marginBottom: 12 }}
            closable
            onClose={() => setError(null)}
          />
        )}

        {/* Footer actions */}
        <Flex justify="space-between" align="center">
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {t('editLaterHint', { defaultValue: 'You can edit everything after creating.' })}
          </Typography.Text>
          <Flex gap={8}>
            <Button onClick={onClose} disabled={isCreating}>
              {t('cancel', { defaultValue: 'Cancel' })}
            </Button>
            <Tooltip
              title={
                !projectName.trim()
                  ? t('nameRequired', { defaultValue: 'Enter a project name to continue.' })
                  : undefined
              }
            >
              <Button
                type="primary"
                onClick={handleCreate}
                loading={isCreating}
                disabled={!canCreate}
                aria-label={t('createProject', { defaultValue: 'Create project' })}
              >
                {t('createProject', { defaultValue: 'Create project' })} →
              </Button>
            </Tooltip>
          </Flex>
        </Flex>
      </Form>
    </Modal>
  );
};

export default CreateProjectModal;
