import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  ApiOutlined,
  BranchesOutlined,
  Button,
  ExportOutlined,
  Flex,
  Form,
  Menu,
  MenuProps,
  Modal as AntModal,
  NumberOutlined,
  ProfileOutlined,
  Skeleton,
  TableOutlined,
  Tag,
  TeamOutlined,
  ThunderboltOutlined,
  Typography,
  WarningOutlined,
  dayjs,
  notification,
  theme,
} from '@/shared/antd-imports';

import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAuthService } from '@/hooks/useAuth';
import useProjectPermissions from '@/hooks/useProjectPermissions';
import { useDeleteProjectMutation, useUpdateProjectMutation } from '@/api/projects/projects.v1.api.service';
import { ensureCsrfToken } from '@/api/api-client';
import { fetchClients } from '@/features/settings/client/clientSlice';
import { fetchProjectCategories } from '@/features/projects/lookups/projectCategories/projectCategoriesSlice';
import { fetchProjectHealth } from '@/features/projects/lookups/projectHealth/projectHealthSlice';
import { fetchProjectStatuses } from '@/features/projects/lookups/projectStatuses/projectStatusesSlice';
import { fetchProjectPriorities } from '@/features/projects/priority/projectPrioritySlice';
import { mergeProject, setProject, setProjectId } from '@/features/project/project.slice';
import {
  setProjectData,
  setProjectId as setDrawerProjectId,
} from '@/features/project/project-drawer.slice';
import { closeProjectSettingsModal } from '@/features/project/project-settings-modal.slice';
import { toggleUpgradeModal } from '@/features/admin-center/admin-center.slice';
import { hasBusinessFeatureAccess, isFreeUser } from '@/utils/subscription-utils';
import { hasTaskExportRoleAccess } from '@/utils/task-export-access';
import { isTeamLeadRole } from '@/types/roles/role.types';
import { decodeHtmlEntities } from '@/utils/html-entities';
import { getSoftwareProjectLabels } from '@/lib/project/software-project';
import logger from '@/utils/errorLogger';
import { IProjectViewModel } from '@/types/project/projectViewModel.types';
import { ITeamMemberViewModel } from '@/types/teamMembers/teamMembersGetResponse.types';

import ManageStatusContent from '@/components/task-management/ManageStatusContent';
import ManagePhaseContent from '@/components/task-management/ManagePhaseContent';
import CustomColumnsSettingsSection from '../project-settings-modal/sections/custom-columns-settings-section';
import IntegrationsSettingsSection from '../project-settings-modal/sections/integrations-settings-section';
import TaskExportSettingsSection from '../project-settings-modal/sections/task-export-settings-section';
import DangerZoneSection from '../project-settings-modal/sections/danger-zone-section';
import { SectionHeader } from './components/section-header';
import { SoftwareDetailsSection } from './sections/software-details-section';
import { SoftwareTeamAccessSection } from './sections/software-team-access-section';
import { SoftwareEstimationSection } from './sections/software-estimation-section';

export const SoftwareProjectSettingsModal = ({ onClose }: SoftwareProjectSettingsModalProps) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { t } = useTranslation('project-drawer');
  const { token } = theme.useToken();
  const [form] = Form.useForm<SoftwareSettingsFormValues>();
  const authService = useAuthService();
  const currentSession = authService.getCurrentSession();

  const [activeSection, setActiveSection] = useState<SoftwareSettingsSection>('details');
  const [selectedProjectLead, setSelectedProjectLead] = useState<ITeamMemberViewModel | null>(null);
  const [isDeletingProject, setIsDeletingProject] = useState(false);
  const [hasFormErrors, setHasFormErrors] = useState(false);
  const populatedProjectIdRef = useRef<string | null>(null);

  const { projectId, projectLoading, project } = useAppSelector(
    state => state.projectDrawerReducer
  );
  const { isOpen, navigateToProjectOnUpdate } = useAppSelector(
    state => state.projectSettingsModalReducer
  );
  const { projectStatuses } = useAppSelector(state => state.projectStatusesReducer);
  const { projectHealths } = useAppSelector(state => state.projectHealthReducer);
  const { projectCategories } = useAppSelector(state => state.projectCategoriesReducer);
  const { priorities } = useAppSelector(state => state.projectPriorityReducer);
  const { clients } = useAppSelector(state => state.clientReducer);

  const [updateProject, { isLoading: isUpdatingProject }] = useUpdateProjectMutation();
  const [deleteProject] = useDeleteProjectMutation();

  const { permissions, isProjectManager } = useProjectPermissions(projectId);
  const isOwnerOrAdmin = authService.isOwnerOrAdmin();
  const isTeamLead = isTeamLeadRole(authService.role);
  const isFreePlan = isFreeUser(currentSession);
  const hasBusinessAccess = hasBusinessFeatureAccess(currentSession);
  const canEditSettings = permissions.settings;
  const canViewExport = hasTaskExportRoleAccess(isOwnerOrAdmin, isProjectManager, isTeamLead);
  const softwareLabels = getSoftwareProjectLabels('software');
  const isProjectReady = Boolean(project?.id) && !projectLoading;

  useEffect(() => {
    if (!isOpen) return;
    if (!projectStatuses.length) dispatch(fetchProjectStatuses());
    if (!projectCategories.length) dispatch(fetchProjectCategories());
    if (!projectHealths.length) dispatch(fetchProjectHealth());
    if (!priorities.length) dispatch(fetchProjectPriorities());
    if (!clients.data?.length) {
      dispatch(fetchClients({ index: 1, size: 5, field: null, order: null, search: null }));
    }
    // Lookups only need loading once per open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, dispatch]);

  useEffect(() => {
    if (!isOpen || !project?.id || projectLoading) return;
    if (populatedProjectIdRef.current === project.id) return;

    populatedProjectIdRef.current = project.id;
    const projectLead = project.project_manager?.id ? project.project_manager : null;
    form.setFieldsValue(buildFormValues(project));
    setSelectedProjectLead(projectLead);
  }, [isOpen, project, projectLoading, form]);

  const handleUpgrade = useCallback(() => dispatch(toggleUpgradeModal()), [dispatch]);

  const handleClose = useCallback(() => {
    populatedProjectIdRef.current = null;
    form.resetFields();
    setActiveSection('details');
    setSelectedProjectLead(null);
    dispatch(setProjectData({} as IProjectViewModel));
    dispatch(setDrawerProjectId(null));
    dispatch(closeProjectSettingsModal());
    onClose();
  }, [dispatch, form, onClose]);

  const handleSubmit = async (values: SoftwareSettingsFormValues) => {
    if (!projectId || !project) return;

    try {
      const csrfToken = await ensureCsrfToken();
      if (!csrfToken) {
        notification.error({
          message: t('securityTokenValidationFailed', {
            defaultValue: 'Security token validation failed. Please try again.',
          }),
        });
        return;
      }

      const response = await updateProject({
        id: projectId,
        project: buildProjectModel({
          project,
          values,
          projectLead: selectedProjectLead,
          canAssignLead: permissions.assignPm,
          canManageVisibility: canEditSettings,
        }),
      });

      if (!response?.data?.done) {
        notification.error({
          message:
            response?.data?.message ||
            t('softwareSettings.saveError', { defaultValue: 'Could not save project settings' }),
        });
        return;
      }

      if (response.data.body) dispatch(mergeProject(response.data.body));
      notification.success({
        message: t('softwareSettings.saved', { defaultValue: 'Project settings saved' }),
        duration: 2,
      });

      const hasKeyChanged = (values.key ?? '').toUpperCase() !== (project.key ?? '').toUpperCase();
      const targetProjectId = projectId;
      handleClose();

      if (navigateToProjectOnUpdate) {
        navigate(`/worklenz/projects/${targetProjectId}?tab=backlog`);
        return;
      }
      if (hasKeyChanged) window.location.reload();
    } catch (error) {
      logger.error('Error saving software project settings', error);
      notification.error({
        message: t('softwareSettings.saveError', { defaultValue: 'Could not save project settings' }),
      });
    }
  };

  const handleDeleteProject = useCallback(async () => {
    if (!projectId) return;

    setIsDeletingProject(true);
    try {
      const projectName = decodeHtmlEntities(project?.name ?? '');
      const response = await deleteProject(projectId);
      if (!response?.data?.done) {
        notification.error({
          message:
            response?.data?.message ||
            t('deleteProjectError', { defaultValue: 'Failed to delete project. Please try again.' }),
        });
        return;
      }

      dispatch(setProject({} as IProjectViewModel));
      dispatch(setProjectId(null));
      handleClose();
      navigate('/worklenz/projects');
      notification.success({
        message: t('softwareSettings.deleted', {
          defaultValue: '"{{name}}" has been permanently deleted.',
          name: projectName,
        }),
        duration: 3,
      });
    } catch (error) {
      logger.error('Error deleting software project', error);
    } finally {
      setIsDeletingProject(false);
    }
  }, [projectId, project?.name, deleteProject, dispatch, handleClose, navigate, t]);

  const handleFieldsChange = () => {
    setHasFormErrors(form.getFieldsError().some(field => field.errors.length > 0));
  };

  const sections = useMemo<SectionItem[]>(() => {
    if (!projectId) return [];

    const items: SectionItem[] = [
      {
        key: 'details',
        group: 'project',
        icon: <ProfileOutlined />,
        label: t('softwareSettings.detailsTab', { defaultValue: 'Details' }),
        isFormSection: true,
        content: (
          <SoftwareDetailsSection
            form={form}
            project={project}
            disabled={!canEditSettings}
            isFreePlan={isFreePlan}
          />
        ),
      },
      {
        key: 'team',
        group: 'project',
        icon: <TeamOutlined />,
        label: t('softwareSettings.teamTab', { defaultValue: 'Team & access' }),
        isFormSection: true,
        content: (
          <SoftwareTeamAccessSection
            selectedProjectLead={selectedProjectLead}
            onProjectLeadChange={setSelectedProjectLead}
            disabled={!canEditSettings}
            canAssignLead={permissions.assignPm}
            canManageVisibility={canEditSettings}
            hasBusinessAccess={hasBusinessAccess}
            isFreePlan={isFreePlan}
            onUpgrade={handleUpgrade}
          />
        ),
      },
      {
        key: 'workflow',
        group: 'delivery',
        icon: <BranchesOutlined />,
        label: t('softwareSettings.workflowTab', { defaultValue: 'Workflow' }),
        content: (
          <Flex vertical gap={16}>
            <SectionHeader
              title={t('softwareSettings.workflowTitle', { defaultValue: 'Workflow' })}
              description={t('softwareSettings.workflowDescription', {
                defaultValue:
                  'Statuses a work item moves through, from To Do to Done. Changes save automatically.',
              })}
            />
            <ManageStatusContent
              projectId={projectId}
              disabled={!canEditSettings && !permissions.statuses}
            />
          </Flex>
        ),
      },
      {
        key: 'sprints',
        group: 'delivery',
        icon: <ThunderboltOutlined />,
        label: softwareLabels.phasePlural,
        content: (
          <Flex vertical gap={16}>
            <SectionHeader
              title={softwareLabels.phasePlural}
              description={t('softwareSettings.sprintsDescription', {
                defaultValue:
                  'Plan, start and complete sprints, and choose what happens to finished work. Changes save automatically.',
              })}
            />
            <ManagePhaseContent
              projectId={projectId}
              disabled={!canEditSettings && !permissions.phases}
            />
          </Flex>
        ),
      },
      {
        key: 'estimation',
        group: 'delivery',
        icon: <NumberOutlined />,
        label: t('softwareSettings.estimationTab', { defaultValue: 'Estimation' }),
        content: isProjectReady ? (
          <SoftwareEstimationSection
            key={project?.id}
            projectId={projectId}
            initialScale={project?.story_point_scale}
            disabled={!canEditSettings}
          />
        ) : null,
      },
      {
        key: 'customFields',
        group: 'configuration',
        icon: <TableOutlined />,
        label: t('softwareSettings.customFieldsTab', { defaultValue: 'Custom fields' }),
        content: (
          <CustomColumnsSettingsSection
            projectId={projectId}
            disabled={!canEditSettings && !permissions.customColumns}
          />
        ),
      },
      {
        key: 'integrations',
        group: 'configuration',
        icon: <ApiOutlined />,
        label: t('integrationsTab', { defaultValue: 'Integrations' }),
        content: <IntegrationsSettingsSection projectId={projectId} projectName={project?.name} />,
      },
    ];

    if (canViewExport) {
      items.push({
        key: 'export',
        group: 'configuration',
        icon: <ExportOutlined />,
        label: t('softwareSettings.exportTab', { defaultValue: 'Export' }),
        content: <TaskExportSettingsSection projectId={projectId} />,
      });
    }

    items.push({
      key: 'dangerZone',
      group: 'danger',
      icon: <WarningOutlined style={{ color: token.colorError }} />,
      label: (
        <Typography.Text type="danger">
          {t('dangerZoneTab', { defaultValue: 'Danger Zone' })}
        </Typography.Text>
      ),
      content: (
        <DangerZoneSection
          onConfirmDelete={handleDeleteProject}
          isDeleting={isDeletingProject}
          canDelete={permissions.delete}
        />
      ),
    });

    return items;
  }, [
    projectId,
    project,
    form,
    t,
    token.colorError,
    canEditSettings,
    permissions,
    isFreePlan,
    hasBusinessAccess,
    selectedProjectLead,
    handleUpgrade,
    softwareLabels.phasePlural,
    isProjectReady,
    canViewExport,
    handleDeleteProject,
    isDeletingProject,
  ]);

  const menuItems = useMemo<MenuProps['items']>(() => {
    const groupLabels: Record<SectionGroup, string | null> = {
      project: t('softwareSettings.groupProject', { defaultValue: 'Project' }),
      delivery: t('softwareSettings.groupDelivery', { defaultValue: 'Delivery' }),
      configuration: t('softwareSettings.groupConfiguration', { defaultValue: 'Configuration' }),
      danger: null,
    };

    return SECTION_GROUP_ORDER.flatMap<NonNullable<MenuProps['items']>[number]>(group => {
      const children = sections
        .filter(section => section.group === group)
        .map(section => ({ key: section.key, icon: section.icon, label: section.label }));
      if (!children.length) return [];
      const label = groupLabels[group];
      return label
        ? [{ type: 'group' as const, key: `group-${group}`, label, children }]
        : [{ type: 'divider' as const, key: `divider-${group}` }, ...children];
    });
  }, [sections, t]);

  const activeItem = sections.find(section => section.key === activeSection) ?? sections[0];
  const isFormSectionActive = Boolean(activeItem?.isFormSection);
  const projectName = decodeHtmlEntities(project?.name ?? '');

  return (
    <AntModal
      open={isOpen}
      onCancel={handleClose}
      width={1080}
      destroyOnClose
      title={
        <Flex align="center" gap={12} className="min-w-0">
          <span
            aria-hidden
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold"
            style={{
              background: project?.color_code || token.colorPrimary,
              color: token.colorWhite,
            }}
          >
            {(project?.key || projectName).slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0">
            <Flex align="center" gap={8} className="min-w-0">
              <Typography.Text strong ellipsis style={{ fontSize: 16, maxWidth: 420 }}>
                {projectName || t('projectSettings', { defaultValue: 'Project Settings' })}
              </Typography.Text>
              {project?.key && (
                <Tag bordered={false} style={{ marginInlineEnd: 0, fontFamily: 'monospace' }}>
                  {project.key}
                </Tag>
              )}
              <Tag color="purple" bordered={false} style={{ marginInlineEnd: 0 }}>
                {t('softwareSettings.softwareBadge', { defaultValue: 'Software' })}
              </Tag>
            </Flex>
            <Typography.Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
              {t('projectSettings', { defaultValue: 'Project Settings' })}
            </Typography.Text>
          </div>
        </Flex>
      }
      styles={{
        content: { padding: 0, borderRadius: 12, overflow: 'hidden' },
        header: {
          padding: '14px 20px',
          margin: 0,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        },
        body: { padding: 0 },
        footer: {
          padding: '12px 20px',
          margin: 0,
          borderTop: `1px solid ${token.colorBorderSecondary}`,
        },
      }}
      footer={
        <Flex justify="space-between" align="center" gap={12} wrap="wrap">
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {isFormSectionActive
              ? t('softwareSettings.formFooterHint', {
                  defaultValue: 'Details and Team & access are saved together.',
                })
              : t('softwareSettings.autoSaveFooterHint', {
                  defaultValue: 'Changes in this section save automatically.',
                })}
          </Typography.Text>
          <Flex gap={8}>
            <Button onClick={handleClose}>{t('softwareSettings.close', { defaultValue: 'Close' })}</Button>
            {isFormSectionActive && canEditSettings && (
              <Button
                type="primary"
                onClick={() => form.submit()}
                loading={isUpdatingProject}
                disabled={!isProjectReady || hasFormErrors}
              >
                {t('softwareSettings.saveChanges', { defaultValue: 'Save changes' })}
              </Button>
            )}
          </Flex>
        </Flex>
      }
    >
      <Skeleton
        active
        paragraph={{ rows: 12 }}
        loading={!isProjectReady}
        style={{ padding: '20px 24px' }}
      >
        <Flex style={{ minHeight: 520 }}>
          <nav
            aria-label={t('projectSettings', { defaultValue: 'Project Settings' })}
            className="hidden shrink-0 overflow-y-auto sm:block"
            style={{
              width: 232,
              borderRight: `1px solid ${token.colorBorderSecondary}`,
              background: token.colorFillQuaternary,
              padding: '8px',
              maxHeight: '72vh',
            }}
          >
            <Menu
              mode="inline"
              selectedKeys={activeItem ? [activeItem.key] : []}
              items={menuItems}
              onClick={({ key }) => setActiveSection(key as SoftwareSettingsSection)}
              style={{ border: 'none', background: 'transparent' }}
            />
          </nav>

          <div className="min-w-0 flex-1 overflow-y-auto" style={{ padding: '20px 24px', maxHeight: '72vh' }}>
            <div className="mb-4 sm:hidden">
              <Menu
                mode="horizontal"
                selectedKeys={activeItem ? [activeItem.key] : []}
                items={sections.map(section => ({ key: section.key, label: section.label }))}
                onClick={({ key }) => setActiveSection(key as SoftwareSettingsSection)}
              />
            </div>

            {!canEditSettings && (
              <Alert
                type="warning"
                showIcon
                className="mb-4"
                message={t('noPermission')}
              />
            )}

            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              onFieldsChange={handleFieldsChange}
            >
              {sections
                .filter(section => section.isFormSection)
                .map(section => (
                  <div key={section.key} hidden={section.key !== activeItem?.key}>
                    {section.content}
                  </div>
                ))}
            </Form>

            {!isFormSectionActive && activeItem?.content}
          </div>
        </Flex>
      </Skeleton>
    </AntModal>
  );
};

const buildFormValues = (project: IProjectViewModel): SoftwareSettingsFormValues => ({
  name: decodeHtmlEntities(project.name ?? ''),
  key: project.key ?? '',
  notes: project.notes ? decodeHtmlEntities(project.notes.slice(0, 500)) : '',
  color_code: project.color_code,
  status_id: project.status_id,
  health_id: project.health_id ?? undefined,
  priority_id: project.priority_id ?? undefined,
  category_id: project.category_id ?? null,
  client_id: project.client_id ?? null,
  client_name: project.client_name ?? null,
  start_date: project.start_date ? dayjs(project.start_date) : null,
  end_date: project.end_date ? dayjs(project.end_date) : null,
  finance_access:
    typeof project.project_manager?.finance_access === 'boolean'
      ? project.project_manager.finance_access
      : true,
  auto_assign_task_creator: Boolean(project.auto_assign_task_creator),
  restrict_task_creation: Boolean(project.restrict_task_creation),
  restrict_tasks_to_assignee: Boolean(project.restrict_tasks_to_assignee),
});

/**
 * update_project overwrites every column it receives, so settings this modal
 * does not expose are carried over from the loaded project unchanged.
 */
const buildProjectModel = ({
  project,
  values,
  projectLead,
  canAssignLead,
  canManageVisibility,
}: BuildProjectModelArgs): IProjectViewModel => ({
  name: values.name,
  key: values.key?.toUpperCase(),
  notes: values.notes,
  color_code: values.color_code,
  status_id: values.status_id,
  health_id: values.health_id,
  priority_id: values.priority_id || null,
  category_id: values.category_id || null,
  client_id: values.client_id ?? undefined,
  client_name: values.client_name,
  start_date: values.start_date ? values.start_date.format('YYYY-MM-DD') : undefined,
  end_date: values.end_date ? values.end_date.format('YYYY-MM-DD') : undefined,
  project_manager: projectLead,
  ...(canAssignLead ? { finance_access: values.finance_access !== false } : {}),
  auto_assign_task_creator: Boolean(values.auto_assign_task_creator),
  restrict_task_creation: Boolean(values.restrict_task_creation),
  ...(canManageVisibility
    ? { restrict_tasks_to_assignee: Boolean(values.restrict_tasks_to_assignee) }
    : {}),
  working_days: project.working_days ?? 0,
  man_days: project.man_days ?? 0,
  hours_per_day: project.hours_per_day ?? 8,
  use_manual_progress: Boolean(project.use_manual_progress),
  use_weighted_progress: Boolean(project.use_weighted_progress),
  use_time_progress: Boolean(project.use_time_progress),
  phase_assignees_enabled: Boolean(project.phase_assignees_enabled),
  auto_assign_subtask_phase: Boolean(project.auto_assign_subtask_phase),
});

const SECTION_GROUP_ORDER: SectionGroup[] = ['project', 'delivery', 'configuration', 'danger'];

type SoftwareSettingsSection =
  | 'details'
  | 'team'
  | 'workflow'
  | 'sprints'
  | 'estimation'
  | 'customFields'
  | 'integrations'
  | 'export'
  | 'dangerZone';

type SectionGroup = 'project' | 'delivery' | 'configuration' | 'danger';

interface SectionItem {
  key: SoftwareSettingsSection;
  group: SectionGroup;
  icon: ReactNode;
  label: ReactNode;
  content: ReactNode;
  isFormSection?: boolean;
}

interface SoftwareProjectSettingsModalProps {
  onClose: () => void;
}

interface SoftwareSettingsFormValues {
  name: string;
  key?: string;
  notes?: string;
  color_code?: string;
  status_id?: string;
  health_id?: string;
  priority_id?: string;
  category_id?: string | null;
  client_id?: string | null;
  client_name?: string | null;
  start_date?: dayjs.Dayjs | null;
  end_date?: dayjs.Dayjs | null;
  finance_access?: boolean;
  auto_assign_task_creator?: boolean;
  restrict_task_creation?: boolean;
  restrict_tasks_to_assignee?: boolean;
}

interface BuildProjectModelArgs {
  project: IProjectViewModel;
  values: SoftwareSettingsFormValues;
  projectLead: ITeamMemberViewModel | null;
  canAssignLead: boolean;
  canManageVisibility: boolean;
}

export default SoftwareProjectSettingsModal;
