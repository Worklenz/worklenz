import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Typography,
  Flex,
  Input,
  Button,
  Card,
  Dropdown,
  Modal,
  Empty,
  message,
  theme,
  Switch,
  Tag,
  Form,
  EditOutlined,
  FormOutlined,
  DeleteOutlined,
  EyeOutlined,
  SearchOutlined,
  FolderOutlined,
  ImportOutlined,
  MoreOutlined,
  GlobalOutlined,
  CopyOutlined,
} from '@/shared/antd-imports';
import type { MenuProps } from '@/shared/antd-imports';

import PillToggle from '@/pages/home/PillToggle';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import logger from '@/utils/errorLogger';
import { calculateTimeGap } from '@/utils/calculate-time-gap';
import { decodeHtmlEntities } from '@/utils/html-entities';
import { projectColors } from '@/lib/project/project-constants';
import { getTemplateIcon } from '@/components/projects/create-project-modal/template-icon';

import { projectTemplatesApiService } from '@/api/project-templates/project-templates.api.service';
import { taskTemplatesApiService } from '@/api/task-templates/task-templates.api.service';
import {
  ICustomTemplate,
  IWorklenzTemplate,
} from '@/types/project-templates/project-templates.types';
import { ProjectTemplateImportPayload } from '@/components/project-templates/project-template-preview-modal';
import { presentCustomTemplateImportResult } from '@/utils/project-template-import-result';
import { ITaskTemplatesGetResponse } from '@/types/settings/task-templates.types';

import { ProjectTemplateRenameModal } from '@/components/project-templates/project-template-rename-modal';
import { ProjectTemplatePreviewModal } from '@/components/project-templates/project-template-preview-modal';
import { ProjectTemplateDefinitionModal } from '@/components/project-templates/project-template-definition-modal';
import TaskTemplateDrawer from '@/components/task-templates/task-template-drawer';
import { getRole } from '@/utils/session-helper';
import { isAdminRole } from '@/types/roles/role.types';
import { useAuthService } from '@/hooks/useAuth';

type TemplatesTab = 'builtin' | 'project' | 'task';

const OrganizationBadge: React.FC<{ label: string }> = ({ label }) => {
  const { token } = theme.useToken();

  return (
    <Tag
      icon={<GlobalOutlined />}
      style={{
        margin: 0,
        color: token.colorPrimary,
        background: token.colorPrimaryBg,
        borderColor: token.colorPrimaryBorder,
      }}
    >
      {label}
    </Tag>
  );
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  // minmax(220px, 1fr) settles at ~5 columns on typical desktop widths (the
  // fixed-5-column look this was meant to have) while still reflowing to
  // fewer columns as the viewport narrows, instead of squeezing 5 fixed
  // columns into whatever width is available.
  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
  gap: 16,
};

const SkeletonGrid: React.FC = () => (
  <div style={gridStyle}>
    {Array.from({ length: 10 }).map((_, i) => (
      <Card key={i} size="small" loading style={{ height: 132 }} />
    ))}
  </div>
);

interface ProjectTemplateCardProps {
  template: ICustomTemplate;
  onPreview: () => void;
  onUse: () => void;
  onEdit: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onScopeChange: (scope: 'team' | 'organization') => void;
  scopeUpdating?: boolean;
  canChangeScope?: boolean;
  canCreateProject: boolean;
  duplicating?: boolean;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

const ProjectTemplateCard: React.FC<ProjectTemplateCardProps> = ({
  template,
  onPreview,
  onUse,
  onEdit,
  onRename,
  onDuplicate,
  onDelete,
  onScopeChange,
  scopeUpdating = false,
  canChangeScope = false,
  canCreateProject,
  duplicating = false,
  t,
}) => {
  const { token } = theme.useToken();
  const color = template.color_code;
  const canManage = template.can_manage === true;
  const isOrganizationScope = template.scope === 'organization';

  const menuItems: MenuProps['items'] = [
    ...(canCreateProject
      ? [
          {
            key: 'use',
            label: t('useTemplate'),
            icon: <ImportOutlined />,
            onClick: onUse,
          },
        ]
      : []),
    {
      key: 'preview',
      label: t('previewToolTip'),
      icon: <EyeOutlined />,
      onClick: onPreview,
    },
    ...(canManage && canChangeScope
      ? [
          {
            key: 'scope',
            label: (
              <Flex
                justify="space-between"
                align="center"
                gap={16}
                onClick={event => event.stopPropagation()}
                onKeyDown={event => event.stopPropagation()}
                role="presentation"
              >
                <span>{t('shareWithOrganization')}</span>
                <Switch
                  size="small"
                  checked={isOrganizationScope}
                  loading={scopeUpdating}
                  onChange={checked =>
                    onScopeChange(checked ? 'organization' : 'team')
                  }
                  aria-label={t('shareWithOrganization')}
                />
              </Flex>
            ),
          },
        ]
      : []),
    ...(canManage
      ? [
          {
            key: 'edit',
            label: t('editToolTip'),
            icon: <EditOutlined />,
            onClick: onEdit,
          },
          {
            key: 'rename',
            label: t('renameToolTip'),
            icon: <FormOutlined />,
            onClick: onRename,
          },
          {
            key: 'duplicate',
            label: t('duplicateToolTip', { defaultValue: 'Duplicate' }),
            icon: <CopyOutlined />,
            disabled: duplicating,
            onClick: onDuplicate,
          },
          {
            key: 'delete',
            label: t('deleteToolTip'),
            icon: <DeleteOutlined />,
            danger: true,
            onClick: () => {
              Modal.confirm({
                title: t('confirmText'),
                okText: t('okText'),
                okType: 'danger',
                cancelText: t('cancelText'),
                centered: true,
                onOk: onDelete,
              });
            },
          },
        ]
      : []),
  ];

  return (
    <Card size="small" bodyStyle={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Flex justify="space-between" align="flex-start" gap={8}>
        <Flex gap={10} align="center" style={{ minWidth: 0 }}>
          <span
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 17,
              background: color ? `${color}22` : token.colorPrimaryBg,
              border: `1px solid ${color || token.colorBorderSecondary}`,
            }}
          >
            <FolderOutlined style={{ color: color || token.colorPrimary }} />
          </span>
          <Typography.Text strong ellipsis={{ tooltip: decodeHtmlEntities(template.name) }} style={{ fontSize: 14 }}>
            {decodeHtmlEntities(template.name)}
          </Typography.Text>
        </Flex>
        <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
          <Button
            size="small"
            type="text"
            icon={<MoreOutlined />}
            aria-label={t('moreOptions')}
          />
        </Dropdown>
      </Flex>
      <Flex gap={8} align="center" wrap>
        {isOrganizationScope && (
          <OrganizationBadge label={t('organizationBadge')} />
        )}
        {template.created_at && (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {calculateTimeGap(template.created_at)}
          </Typography.Text>
        )}
      </Flex>
    </Card>
  );
};

interface BuiltInTemplateCardProps {
  template: IWorklenzTemplate;
  onUse: () => void;
  onCopyCustomize: () => void;
  canCreateProject: boolean;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

const BuiltInTemplateCard: React.FC<BuiltInTemplateCardProps> = ({
  template,
  onUse,
  onCopyCustomize,
  canCreateProject,
  t,
}) => {
  const { token } = theme.useToken();
  const name = decodeHtmlEntities(template.name || '');
  const icon = getTemplateIcon(template.name);

  const menuItems: MenuProps['items'] = [
    ...(canCreateProject
      ? [
          {
            key: 'use',
            label: t('useTemplate'),
            icon: <ImportOutlined />,
            onClick: onUse,
          },
        ]
      : []),
    {
      key: 'copy-customize',
      label: t('copyAndCustomize', { defaultValue: 'Copy & Customize' }),
      icon: <CopyOutlined />,
      onClick: onCopyCustomize,
    },
  ];

  return (
    <Card size="small" bodyStyle={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Flex justify="space-between" align="flex-start" gap={8}>
        <Flex gap={10} align="center" style={{ minWidth: 0 }}>
          <span
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 17,
              background: token.colorPrimaryBg,
              border: `1px solid ${token.colorBorderSecondary}`,
              overflow: 'hidden',
            }}
            aria-hidden="true"
          >
            {template.image_url ? (
              <img
                src={template.image_url}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              icon
            )}
          </span>
          <Typography.Text strong ellipsis={{ tooltip: name }} style={{ fontSize: 14 }}>
            {name}
          </Typography.Text>
        </Flex>
        <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
          <Button
            size="small"
            type="text"
            icon={<MoreOutlined />}
            aria-label={t('moreOptions')}
          />
        </Dropdown>
      </Flex>
      <Flex gap={8} align="center" wrap>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {t('taskCountLabel', {
            defaultValue: '{{count}} tasks',
            count: template.task_count ?? 0,
          })}
        </Typography.Text>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          ·
        </Typography.Text>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {t('phaseCountLabel', {
            defaultValue: '{{count}} phases',
            count: template.phase_count ?? 0,
          })}
        </Typography.Text>
      </Flex>
    </Card>
  );
};

interface TaskTemplateCardProps {
  template: ITaskTemplatesGetResponse;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onScopeChange: (scope: 'team' | 'organization') => void;
  scopeUpdating?: boolean;
  canChangeScope?: boolean;
  duplicating?: boolean;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

const TaskTemplateCard: React.FC<TaskTemplateCardProps> = ({
  template,
  onEdit,
  onDuplicate,
  onDelete,
  onScopeChange,
  scopeUpdating = false,
  canChangeScope = false,
  duplicating = false,
  t,
}) => {
  const canManage = template.can_manage === true;
  const isOrganizationScope = template.scope === 'organization';

  const menuItems: MenuProps['items'] = [
    ...(canManage && canChangeScope
      ? [
          {
            key: 'scope',
            label: (
              <Flex
                justify="space-between"
                align="center"
                gap={16}
                onClick={event => event.stopPropagation()}
                onKeyDown={event => event.stopPropagation()}
                role="presentation"
              >
                <span>{t('shareWithOrganization')}</span>
                <Switch
                  size="small"
                  checked={isOrganizationScope}
                  loading={scopeUpdating}
                  onChange={checked =>
                    onScopeChange(checked ? 'organization' : 'team')
                  }
                  aria-label={t('shareWithOrganization')}
                />
              </Flex>
            ),
          },
        ]
      : []),
    ...(canManage
      ? [
          {
            key: 'edit',
            label: t('editToolTip'),
            icon: <EditOutlined />,
            onClick: onEdit,
          },
          {
            key: 'duplicate',
            label: t('duplicateToolTip', { defaultValue: 'Duplicate' }),
            icon: <CopyOutlined />,
            disabled: duplicating,
            onClick: onDuplicate,
          },
          {
            key: 'delete',
            label: t('deleteToolTip'),
            icon: <DeleteOutlined />,
            danger: true,
            onClick: () => {
              Modal.confirm({
                title: t('confirmText'),
                okText: t('okText'),
                okType: 'danger',
                cancelText: t('cancelText'),
                centered: true,
                onOk: onDelete,
              });
            },
          },
        ]
      : []),
  ];

  return (
    <Card size="small" bodyStyle={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Flex justify="space-between" align="flex-start" gap={8}>
        <Flex vertical gap={2} style={{ minWidth: 0 }}>
          <Typography.Text strong ellipsis={{ tooltip: decodeHtmlEntities(template.name) }} style={{ fontSize: 14 }}>
            {decodeHtmlEntities(template.name)}
          </Typography.Text>
        </Flex>
        {canManage && (
          <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
            <Button
              size="small"
              type="text"
              icon={<MoreOutlined />}
              aria-label={t('moreOptions')}
            />
          </Dropdown>
        )}
      </Flex>
      <Flex gap={8} align="center" wrap>
        {isOrganizationScope && (
          <OrganizationBadge label={t('organizationBadge')} />
        )}
        {template.created_at && (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {calculateTimeGap(template.created_at)}
          </Typography.Text>
        )}
      </Flex>
    </Card>
  );
};

const EmptyStateSteps: React.FC<{ title: string; steps: string[] }> = ({ title, steps }) => {
  const { token } = theme.useToken();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 24px', textAlign: 'center' }}>
      <Typography.Text strong style={{ fontSize: 15, marginBottom: 24 }}>
        {title}
      </Typography.Text>
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', maxWidth: 360, textAlign: 'left' }}>
        {steps.map((step, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: 24 }}>
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: token.colorPrimaryBg,
                  border: `1px solid ${token.colorPrimaryBorder}`,
                  color: token.colorPrimary,
                  fontSize: 11,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {i + 1}
              </div>
              {i < steps.length - 1 && (
                <div style={{ width: 1, height: 32, background: token.colorPrimaryBorder, margin: '3px 0' }} />
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', minHeight: 24, paddingBottom: i < steps.length - 1 ? 16 : 0 }}>
              <Typography.Text style={{ fontSize: 13, fontWeight: 500 }}>{step}</Typography.Text>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const TemplatesPage: React.FC = () => {
  const { t } = useTranslation('projects/templates');
  const navigate = useNavigate();
  useDocumentTitle(t('pageTitle', { defaultValue: 'Templates' }));

  const [activeTab, setActiveTab] = useState<TemplatesTab>('builtin');
  const [search, setSearch] = useState('');

  const [builtInTemplates, setBuiltInTemplates] = useState<IWorklenzTemplate[]>([]);
  const [loadingBuiltInTemplates, setLoadingBuiltInTemplates] = useState(true);

  const [projectTemplates, setProjectTemplates] = useState<ICustomTemplate[]>([]);
  const [loadingProjectTemplates, setLoadingProjectTemplates] = useState(true);

  const [taskTemplates, setTaskTemplates] = useState<ITaskTemplatesGetResponse[]>([]);
  const [loadingTaskTemplates, setLoadingTaskTemplates] = useState(true);

  // Rename modal state (project templates)
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedTemplateName, setSelectedTemplateName] = useState('');

  // Preview / use-template modal state (project templates)
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(null);
  const [previewTemplateName, setPreviewTemplateName] = useState('');
  const [previewInitialStep, setPreviewInitialStep] = useState<'preview' | 'confirm'>('preview');
  const [importing, setImporting] = useState(false);
  const [scopeUpdatingId, setScopeUpdatingId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  // Built-in use modal (create project from worklenz template)
  const [builtInUseVisible, setBuiltInUseVisible] = useState(false);
  const [builtInUseTemplate, setBuiltInUseTemplate] = useState<IWorklenzTemplate | null>(null);
  const [builtInProjectName, setBuiltInProjectName] = useState('');
  const [builtInNameError, setBuiltInNameError] = useState('');
  const [importingBuiltIn, setImportingBuiltIn] = useState(false);

  // Definition modal (Copy & Customize / Edit project template)
  const [definitionModalVisible, setDefinitionModalVisible] = useState(false);
  const [definitionMode, setDefinitionMode] = useState<'edit' | 'copy-from-builtin'>(
    'copy-from-builtin'
  );
  const [editCustomTemplateId, setEditCustomTemplateId] = useState<string | null>(null);
  const [copyWorklenzTemplateId, setCopyWorklenzTemplateId] = useState<string | null>(null);
  const [copyWorklenzTemplateName, setCopyWorklenzTemplateName] = useState('');
  const [editSeedName, setEditSeedName] = useState('');

  // Task template drawer state
  const [taskTemplateId, setTaskTemplateId] = useState<string | null>(null);
  const [showTaskDrawer, setShowTaskDrawer] = useState(false);
  const authService = useAuthService();
  const canChangeScope = isAdminRole(getRole());
  const canCreateProject = authService.canCreateProjectsFromTemplates();

  const fetchBuiltInTemplates = useCallback(async () => {
    try {
      setLoadingBuiltInTemplates(true);
      const res = await projectTemplatesApiService.getWorklenzTemplates();
      setBuiltInTemplates(res.body || []);
    } catch (error) {
      logger.error('Failed to fetch built-in templates:', error);
    } finally {
      setLoadingBuiltInTemplates(false);
    }
  }, []);

  const fetchProjectTemplates = useCallback(async () => {
    try {
      setLoadingProjectTemplates(true);
      const res = await projectTemplatesApiService.getCustomTemplates();
      setProjectTemplates(res.body || []);
    } catch (error) {
      logger.error('Failed to fetch project templates:', error);
    } finally {
      setLoadingProjectTemplates(false);
    }
  }, []);

  const fetchTaskTemplates = useCallback(async () => {
    try {
      setLoadingTaskTemplates(true);
      const res = await taskTemplatesApiService.getTemplates();
      setTaskTemplates(res.body || []);
    } catch (error) {
      logger.error('Failed to fetch task templates:', error);
    } finally {
      setLoadingTaskTemplates(false);
    }
  }, []);

  useEffect(() => {
    fetchBuiltInTemplates();
    fetchProjectTemplates();
    fetchTaskTemplates();
  }, [fetchBuiltInTemplates, fetchProjectTemplates, fetchTaskTemplates]);

  useEffect(() => {
    if (taskTemplateId) setShowTaskDrawer(true);
  }, [taskTemplateId]);

  const handleDeleteProjectTemplate = async (id: string) => {
    try {
      const res = await projectTemplatesApiService.deleteCustomTemplate(id);
      if (res.done) {
        message.success(t('deleteProjectTemplateSuccess'));
        fetchProjectTemplates();
      }
    } catch (error) {
      logger.error('Failed to delete project template:', error);
      message.error(t('deleteProjectTemplateError'));
    }
  };

  const handleDuplicateProjectTemplate = async (id: string) => {
    try {
      setDuplicatingId(id);
      const res = await projectTemplatesApiService.duplicateCustomTemplate(id);
      if (res.done) {
        message.success(
          t('duplicateProjectTemplateSuccess', {
            defaultValue: 'Project template duplicated successfully.',
          })
        );
        fetchProjectTemplates();
      } else {
        message.error(
          (res as { message?: string }).message ||
            t('duplicateProjectTemplateError', {
              defaultValue: 'Failed to duplicate project template.',
            })
        );
      }
    } catch (error) {
      logger.error('Failed to duplicate project template:', error);
      message.error(
        t('duplicateProjectTemplateError', {
          defaultValue: 'Failed to duplicate project template.',
        })
      );
    } finally {
      setDuplicatingId(null);
    }
  };

  const handleDuplicateTaskTemplate = async (id: string) => {
    try {
      setDuplicatingId(id);
      const res = await taskTemplatesApiService.duplicateTemplate(id);
      if (res.done) {
        message.success(
          t('duplicateTaskTemplateSuccess', {
            defaultValue: 'Task template duplicated successfully.',
          })
        );
        fetchTaskTemplates();
      } else {
        message.error(
          (res as { message?: string }).message ||
            t('duplicateTaskTemplateError', {
              defaultValue: 'Failed to duplicate task template.',
            })
        );
      }
    } catch (error) {
      logger.error('Failed to duplicate task template:', error);
      message.error(
        t('duplicateTaskTemplateError', {
          defaultValue: 'Failed to duplicate task template.',
        })
      );
    } finally {
      setDuplicatingId(null);
    }
  };

  const getScopeSuccessMessage = (scope: 'team' | 'organization') =>
    scope === 'organization'
      ? t('scopeSharedSuccess', { defaultValue: 'Template shared with organization.' })
      : t('scopeUnsharedSuccess', { defaultValue: 'Template is no longer shared with organization.' });

  const handleScopeChange = async (
    templateId: string,
    scope: 'team' | 'organization'
  ) => {
    try {
      setScopeUpdatingId(templateId);
      const res = await projectTemplatesApiService.updateTemplateScope(
        templateId,
        scope
      );
      if (res.done) {
        message.success(getScopeSuccessMessage(scope));
        setProjectTemplates(prev =>
          prev.map(template =>
            template.id === templateId ? { ...template, scope } : template
          )
        );
      } else {
        message.error((res as { message?: string }).message ?? t('scopeUpdateError'));
      }
    } catch (error) {
      logger.error('Failed to update template scope:', error);
      message.error(t('scopeUpdateError'));
    } finally {
      setScopeUpdatingId(null);
    }
  };

  const handleTaskTemplateScopeChange = async (
    templateId: string,
    scope: 'team' | 'organization'
  ) => {
    try {
      setScopeUpdatingId(templateId);
      const res = await taskTemplatesApiService.updateTemplateScope(
        templateId,
        scope
      );
      if (res.done) {
        message.success(getScopeSuccessMessage(scope));
        setTaskTemplates(prev =>
          prev.map(template =>
            template.id === templateId ? { ...template, scope } : template
          )
        );
      } else {
        message.error((res as { message?: string }).message ?? t('scopeUpdateError'));
      }
    } catch (error) {
      logger.error('Failed to update task template scope:', error);
      message.error(t('scopeUpdateError'));
    } finally {
      setScopeUpdatingId(null);
    }
  };

  const handleDeleteTaskTemplate = async (id: string) => {
    try {
      const res = await taskTemplatesApiService.deleteTemplate(id);
      if (res.done) {
        message.success(t('deleteTaskTemplateSuccess'));
        fetchTaskTemplates();
      }
    } catch (error) {
      logger.error('Failed to delete task template:', error);
      message.error(t('deleteTaskTemplateError'));
    }
  };

  const openPreview = (template: ICustomTemplate, step: 'preview' | 'confirm') => {
    if (!template.id) return;
    // Members cannot create projects — only allow the import/confirm step for owner/admin.
    const resolvedStep = step === 'confirm' && !canCreateProject ? 'preview' : step;
    setPreviewTemplateId(template.id);
    setPreviewTemplateName(template.name || '');
    setPreviewInitialStep(resolvedStep);
    setPreviewModalVisible(true);
  };

  const handleUseTemplate = (template: ICustomTemplate) => {
    if (!canCreateProject) return;
    openPreview(template, 'confirm');
  };

  const openRename = (template: ICustomTemplate) => {
    if (!template.id) return;
    setSelectedTemplateId(template.id);
    setSelectedTemplateName(template.name || '');
    setRenameModalVisible(true);
  };

  const openEditProjectTemplate = (template: ICustomTemplate) => {
    if (!template.id) return;
    setDefinitionMode('edit');
    setEditCustomTemplateId(template.id);
    setEditSeedName(template.name || '');
    setCopyWorklenzTemplateId(null);
    setCopyWorklenzTemplateName('');
    setDefinitionModalVisible(true);
  };

  const openBuiltInUse = (template: IWorklenzTemplate) => {
    if (!canCreateProject || !template.id) return;
    setBuiltInUseTemplate(template);
    setBuiltInProjectName(decodeHtmlEntities(template.name || ''));
    setBuiltInNameError('');
    setBuiltInUseVisible(true);
  };

  const openCopyCustomize = (template: IWorklenzTemplate) => {
    if (!template.id) return;
    setDefinitionMode('copy-from-builtin');
    setEditCustomTemplateId(null);
    setEditSeedName('');
    setCopyWorklenzTemplateId(template.id);
    setCopyWorklenzTemplateName(template.name || '');
    setDefinitionModalVisible(true);
  };

  const handleImportBuiltInTemplate = async () => {
    if (!canCreateProject || !builtInUseTemplate?.id) return;
    const trimmed = builtInProjectName.trim();
    if (!trimmed) {
      setBuiltInNameError(
        t('builtInProjectNameRequired', {
          defaultValue: 'Please enter a project name.',
        })
      );
      return;
    }

    try {
      setImportingBuiltIn(true);
      setBuiltInNameError('');
      const res = await projectTemplatesApiService.createFromWorklenzTemplate({
        template_id: builtInUseTemplate.id,
        project_name: trimmed,
        color_code: projectColors[0],
      });
      if (res.done && (res.body as { project_id?: string })?.project_id) {
        const projectId = (res.body as { project_id: string }).project_id;
        setBuiltInUseVisible(false);
        setBuiltInUseTemplate(null);
        message.success(t('importSuccess'));
        navigate(
          `/worklenz/projects/${projectId}?tab=tasks-list&pinned_tab=tasks-list&new_project=1`
        );
      } else {
        setBuiltInNameError((res as { message?: string }).message ?? t('importError'));
      }
    } catch (error) {
      logger.error('Failed to import built-in template:', error);
      setBuiltInNameError(t('importError'));
    } finally {
      setImportingBuiltIn(false);
    }
  };

  const handleImportTemplate = async (
    templateId: string,
    payload: ProjectTemplateImportPayload
  ): Promise<string | null> => {
    try {
      setImporting(true);
      const res = await projectTemplatesApiService.createFromCustomTemplate({
        template_id: templateId,
        project_name: payload.projectName,
        start_date: payload.start_date,
        settings_overrides: payload.settings_overrides,
      });
      if (res.done) {
        const projectId = res.body?.project_id ?? '';
        presentCustomTemplateImportResult({
          t,
          projectId,
          skips: res.body?.skips,
          onBeforeNavigate: () => setPreviewModalVisible(false),
          navigate,
        });
        return null;
      } else {
        // Return the error message so the modal can display it inline on the name field
        return (res as any).message ?? t('importError');
      }
    } catch (error) {
      logger.error('Failed to import template:', error);
      return t('importError');
    } finally {
      setImporting(false);
    }
  };

  const handleCloseTaskDrawer = () => {
    setTaskTemplateId(null);
    setShowTaskDrawer(false);
    fetchTaskTemplates();
  };

  const filteredBuiltInTemplates = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return builtInTemplates;
    return builtInTemplates.filter(tpl => (tpl.name || '').toLowerCase().includes(q));
  }, [builtInTemplates, search]);

  const filteredProjectTemplates = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projectTemplates;
    return projectTemplates.filter(tpl => (tpl.name || '').toLowerCase().includes(q));
  }, [projectTemplates, search]);

  const filteredTaskTemplates = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return taskTemplates;
    return taskTemplates.filter(tpl => (tpl.name || '').toLowerCase().includes(q));
  }, [taskTemplates, search]);

  const isLoading =
    activeTab === 'builtin'
      ? loadingBuiltInTemplates
      : activeTab === 'project'
        ? loadingProjectTemplates
        : loadingTaskTemplates;

  const renderBuiltInTab = () => {
    if (filteredBuiltInTemplates.length === 0) {
      return search ? (
        <Empty description={t('noSearchResults')} />
      ) : (
        <Empty description={t('noBuiltInTemplatesTitle', { defaultValue: 'No built-in templates available' })} />
      );
    }

    return (
      <div style={gridStyle}>
        {filteredBuiltInTemplates.map(tpl => (
          <BuiltInTemplateCard
            key={tpl.id}
            template={tpl}
            onUse={() => openBuiltInUse(tpl)}
            onCopyCustomize={() => openCopyCustomize(tpl)}
            canCreateProject={canCreateProject}
            t={t}
          />
        ))}
      </div>
    );
  };

  const renderProjectTab = () => {
    if (filteredProjectTemplates.length === 0) {
      return search ? (
        <Empty description={t('noSearchResults')} />
      ) : (
        <EmptyStateSteps
          title={t('noProjectTemplatesTitle')}
          steps={[t('noProjectTemplatesStep1'), t('noProjectTemplatesStep2')]}
        />
      );
    }

    return (
      <div style={gridStyle}>
        {filteredProjectTemplates.map(tpl => (
          <ProjectTemplateCard
            key={tpl.id}
            template={tpl}
            onPreview={() => openPreview(tpl, 'preview')}
            onUse={() => openPreview(tpl, 'confirm')}
            onEdit={() => openEditProjectTemplate(tpl)}
            onRename={() => openRename(tpl)}
            onDuplicate={() => tpl.id && handleDuplicateProjectTemplate(tpl.id)}
            onDelete={() => tpl.id && handleDeleteProjectTemplate(tpl.id)}
            onScopeChange={scope => tpl.id && handleScopeChange(tpl.id, scope)}
            scopeUpdating={scopeUpdatingId === tpl.id}
            canChangeScope={canChangeScope}
            canCreateProject={canCreateProject}
            duplicating={duplicatingId === tpl.id}
            t={t}
          />
        ))}
      </div>
    );
  };

  const renderTaskTab = () => {
    if (filteredTaskTemplates.length === 0) {
      return search ? (
        <Empty description={t('noSearchResults')} />
      ) : (
        <EmptyStateSteps
          title={t('noTaskTemplatesTitle')}
          steps={[
            t('noTaskTemplatesStep1'),
            t('noTaskTemplatesStep2'),
            t('noTaskTemplatesStep3'),
          ]}
        />
      );
    }

    return (
      <div style={gridStyle}>
        {filteredTaskTemplates.map(tpl => (
          <TaskTemplateCard
            key={tpl.id}
            template={tpl}
            onEdit={() => tpl.id && setTaskTemplateId(tpl.id)}
            onDuplicate={() => tpl.id && handleDuplicateTaskTemplate(tpl.id)}
            onDelete={() => tpl.id && handleDeleteTaskTemplate(tpl.id)}
            onScopeChange={scope =>
              tpl.id && handleTaskTemplateScopeChange(tpl.id, scope)
            }
            scopeUpdating={scopeUpdatingId === tpl.id}
            canChangeScope={canChangeScope}
            duplicating={duplicatingId === tpl.id}
            t={t}
          />
        ))}
      </div>
    );
  };

  return (
    <div>
      <Flex vertical style={{ marginBottom: 20 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          {t('pageTitle')}
        </Typography.Title>
        <Typography.Text type="secondary">{t('pageSubtitle')}</Typography.Text>
      </Flex>

      <Flex justify="space-between" align="center" wrap gap={12} style={{ marginBottom: 20 }}>
        <PillToggle<TemplatesTab>
          value={activeTab}
          onChange={value => {
            setActiveTab(value);
            setSearch('');
          }}
          options={[
            {
              value: 'builtin',
              label: t('builtInTemplatesTab', { defaultValue: 'Built-in Templates' }),
            },
            { value: 'project', label: t('projectTemplatesTab') },
            { value: 'task', label: t('taskTemplatesTab') },
          ]}
        />
        <Input
          allowClear
          placeholder={t('searchPlaceholder')}
          style={{ width: 240, maxWidth: '100%', height: 32, fontSize: 12 }}
          value={search}
          onChange={e => setSearch(e.target.value)}
          suffix={<SearchOutlined style={{ color: 'rgba(0,0,0,.35)' }} />}
        />
      </Flex>

      {isLoading ? (
        <SkeletonGrid />
      ) : activeTab === 'builtin' ? (
        renderBuiltInTab()
      ) : activeTab === 'project' ? (
        renderProjectTab()
      ) : (
        renderTaskTab()
      )}

      <ProjectTemplateRenameModal
        visible={renameModalVisible}
        templateId={selectedTemplateId}
        currentName={selectedTemplateName}
        onClose={renamed => {
          setRenameModalVisible(false);
          setSelectedTemplateId(null);
          setSelectedTemplateName('');
          if (renamed) fetchProjectTemplates();
        }}
      />

      <ProjectTemplatePreviewModal
        visible={previewModalVisible}
        templateId={previewTemplateId}
        templateName={previewTemplateName}
        importing={importing}
        initialStep={previewInitialStep}
        canImport={canCreateProject}
        onClose={() => {
          setPreviewModalVisible(false);
          setPreviewTemplateId(null);
          setPreviewTemplateName('');
        }}
        onImport={handleImportTemplate}
      />

      <Modal
        title={t('useBuiltInTitle', {
          defaultValue: 'Create project from template',
        })}
        open={builtInUseVisible}
        onCancel={() => {
          if (importingBuiltIn) return;
          setBuiltInUseVisible(false);
          setBuiltInUseTemplate(null);
          setBuiltInNameError('');
        }}
        onOk={handleImportBuiltInTemplate}
        confirmLoading={importingBuiltIn}
        okText={t('useTemplate')}
        cancelText={t('cancelText')}
        destroyOnHidden
        centered
      >
        <Form layout="vertical">
          <Form.Item
            label={t('builtInProjectName', { defaultValue: 'Project name' })}
            required
            validateStatus={builtInNameError ? 'error' : undefined}
            help={builtInNameError || undefined}
          >
            <Input
              value={builtInProjectName}
              onChange={e => {
                setBuiltInNameError('');
                setBuiltInProjectName(e.target.value);
              }}
              maxLength={100}
              autoFocus
              aria-label={t('builtInProjectName', { defaultValue: 'Project name' })}
              onPressEnter={handleImportBuiltInTemplate}
            />
          </Form.Item>
        </Form>
      </Modal>

      <ProjectTemplateDefinitionModal
        visible={definitionModalVisible}
        mode={definitionMode}
        customTemplateId={editCustomTemplateId}
        worklenzTemplateId={copyWorklenzTemplateId}
        seedName={
          definitionMode === 'edit' ? editSeedName : copyWorklenzTemplateName
        }
        existingCustomNames={projectTemplates.map(tpl => tpl.name || '')}
        onClose={saved => {
          setDefinitionModalVisible(false);
          setEditCustomTemplateId(null);
          setEditSeedName('');
          setCopyWorklenzTemplateId(null);
          setCopyWorklenzTemplateName('');
          if (saved) {
            fetchProjectTemplates();
            if (definitionMode === 'copy-from-builtin') {
              setActiveTab('project');
            }
          }
        }}
      />

      <TaskTemplateDrawer
        showDrawer={showTaskDrawer}
        selectedTemplateId={taskTemplateId}
        onClose={handleCloseTaskDrawer}
      />
    </div>
  );
};

export default TemplatesPage;
