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
  notification,
  theme,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  SearchOutlined,
  FolderOutlined,
  ImportOutlined,
  MoreOutlined,
} from '@/shared/antd-imports';
import type { MenuProps } from '@/shared/antd-imports';

import PillToggle from '@/pages/home/PillToggle';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import logger from '@/utils/errorLogger';
import { calculateTimeGap } from '@/utils/calculate-time-gap';
import { decodeHtmlEntities } from '@/utils/html-entities';

import { projectTemplatesApiService } from '@/api/project-templates/project-templates.api.service';
import { taskTemplatesApiService } from '@/api/task-templates/task-templates.api.service';
import { ICustomTemplate } from '@/types/project-templates/project-templates.types';
import { ITaskTemplatesGetResponse } from '@/types/settings/task-templates.types';

import { ProjectTemplateRenameModal } from '@/components/project-templates/project-template-rename-modal';
import { ProjectTemplatePreviewModal } from '@/components/project-templates/project-template-preview-modal';
import TaskTemplateDrawer from '@/components/task-templates/task-template-drawer';

type TemplatesTab = 'project' | 'task';

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
  onRename: () => void;
  onDelete: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

const ProjectTemplateCard: React.FC<ProjectTemplateCardProps> = ({
  template,
  onPreview,
  onUse,
  onRename,
  onDelete,
  t,
}) => {
  const { token } = theme.useToken();
  const color = template.color_code;

  const menuItems: MenuProps['items'] = [
    {
      key: 'use',
      label: t('useTemplate'),
      icon: <ImportOutlined />,
      onClick: onUse,
    },
    {
      key: 'preview',
      label: t('previewToolTip'),
      icon: <EyeOutlined />,
      onClick: onPreview,
    },
    {
      key: 'rename',
      label: t('renameToolTip'),
      icon: <EditOutlined />,
      onClick: onRename,
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
          <Button size="small" type="text" icon={<MoreOutlined />} />
        </Dropdown>
      </Flex>
      {template.created_at && (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {calculateTimeGap(template.created_at)}
        </Typography.Text>
      )}
    </Card>
  );
};

interface TaskTemplateCardProps {
  template: ITaskTemplatesGetResponse;
  onEdit: () => void;
  onDelete: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

const TaskTemplateCard: React.FC<TaskTemplateCardProps> = ({ template, onEdit, onDelete, t }) => {
  const menuItems: MenuProps['items'] = [
    {
      key: 'edit',
      label: t('editToolTip'),
      icon: <EditOutlined />,
      onClick: onEdit,
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
  ];

  return (
    <Card size="small" bodyStyle={{ padding: 16 }}>
      <Flex justify="space-between" align="flex-start" gap={8}>
        <Flex vertical gap={2} style={{ minWidth: 0 }}>
          <Typography.Text strong ellipsis={{ tooltip: decodeHtmlEntities(template.name) }} style={{ fontSize: 14 }}>
            {decodeHtmlEntities(template.name)}
          </Typography.Text>
          {template.created_at && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {calculateTimeGap(template.created_at)}
            </Typography.Text>
          )}
        </Flex>
        <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
          <Button size="small" type="text" icon={<MoreOutlined />} />
        </Dropdown>
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
  useDocumentTitle('Templates');

  const [activeTab, setActiveTab] = useState<TemplatesTab>('project');
  const [search, setSearch] = useState('');

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

  // Task template drawer state
  const [taskTemplateId, setTaskTemplateId] = useState<string | null>(null);
  const [showTaskDrawer, setShowTaskDrawer] = useState(false);

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
    fetchProjectTemplates();
    fetchTaskTemplates();
  }, [fetchProjectTemplates, fetchTaskTemplates]);

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
    setPreviewTemplateId(template.id);
    setPreviewTemplateName(template.name || '');
    setPreviewInitialStep(step);
    setPreviewModalVisible(true);
  };

  const openRename = (template: ICustomTemplate) => {
    if (!template.id) return;
    setSelectedTemplateId(template.id);
    setSelectedTemplateName(template.name || '');
    setRenameModalVisible(true);
  };

  const handleImportTemplate = async (templateId: string, projectName: string): Promise<string | null> => {
    try {
      setImporting(true);
      const res = await projectTemplatesApiService.createFromCustomTemplate({
        template_id: templateId,
        project_name: projectName,
      });
      if (res.done) {
        notification.success({
          message: t('importSuccess'),
          placement: 'topRight',
          style: { borderRadius: '4px' },
        });
        setPreviewModalVisible(false);
        navigate(`/worklenz/projects/${(res.body as any)?.project_id ?? ''}`);
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

  const isLoading = activeTab === 'project' ? loadingProjectTemplates : loadingTaskTemplates;

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
      ) : activeTab === 'project' ? (
        filteredProjectTemplates.length === 0 ? (
          search ? (
            <Empty description={t('noSearchResults')} />
          ) : (
            <EmptyStateSteps
              title={t('noProjectTemplatesTitle')}
              steps={[t('noProjectTemplatesStep1'), t('noProjectTemplatesStep2')]}
            />
          )
        ) : (
          <div style={gridStyle}>
            {filteredProjectTemplates.map(tpl => (
              <ProjectTemplateCard
                key={tpl.id}
                template={tpl}
                onPreview={() => openPreview(tpl, 'preview')}
                onUse={() => openPreview(tpl, 'confirm')}
                onRename={() => openRename(tpl)}
                onDelete={() => tpl.id && handleDeleteProjectTemplate(tpl.id)}
                t={t}
              />
            ))}
          </div>
        )
      ) : filteredTaskTemplates.length === 0 ? (
        search ? (
          <Empty description={t('noSearchResults')} />
        ) : (
          <EmptyStateSteps
            title={t('noTaskTemplatesTitle')}
            steps={[t('noTaskTemplatesStep1'), t('noTaskTemplatesStep2'), t('noTaskTemplatesStep3')]}
          />
        )
      ) : (
        <div style={gridStyle}>
          {filteredTaskTemplates.map(tpl => (
            <TaskTemplateCard
              key={tpl.id}
              template={tpl}
              onEdit={() => tpl.id && setTaskTemplateId(tpl.id)}
              onDelete={() => tpl.id && handleDeleteTaskTemplate(tpl.id)}
              t={t}
            />
          ))}
        </div>
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
        onClose={() => {
          setPreviewModalVisible(false);
          setPreviewTemplateId(null);
          setPreviewTemplateName('');
        }}
        onImport={handleImportTemplate}
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
