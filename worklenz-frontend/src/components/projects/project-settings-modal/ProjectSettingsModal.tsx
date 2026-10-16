import { useEffect, useState, useCallback, useMemo, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Flex, Form, Skeleton, Typography, theme } from '@/shared/antd-imports';
import { Modal as AntModal } from '@/shared/antd-imports';
import dayjs from 'dayjs';

import { fetchClients } from '@/features/settings/client/clientSlice';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { projectColors } from '@/lib/project/project-constants';
import { fetchProjectCategories } from '@/features/projects/lookups/projectCategories/projectCategoriesSlice';
import { fetchProjectHealth } from '@/features/projects/lookups/projectHealth/projectHealthSlice';
import { fetchProjectStatuses } from '@/features/projects/lookups/projectStatuses/projectStatusesSlice';
import { fetchProjectPriorities } from '@/features/projects/priority/projectPrioritySlice';
import useProjectPermissions from '@/hooks/useProjectPermissions';

import StatusesSettingsSection from './sections/statuses-settings-section';
import PhasesSettingsSection from './sections/phases-settings-section';
import CustomColumnsSettingsSection from './sections/custom-columns-settings-section';
import IntegrationsSettingsSection from './sections/integrations-settings-section';
import TaskExportSettingsSection from './sections/task-export-settings-section';
import DangerZoneSection from './sections/danger-zone-section';
import PrivacySettingsSection from './sections/privacy-settings-section';
import GeneralSettingsSection from './sections/GeneralSettingsSection';
import AdvancedSettingsSection from './sections/AdvancedSettingsSection';
import BudgetSettingsSection from './sections/BudgetSettingsSection';
import ProjectSettingsHeader from './components/ProjectSettingsHeader';
import ProjectSettingsFooter from './components/ProjectSettingsFooter';
import { ProjectSettingsNav, ProjectSettingsMobileNav } from './components/ProjectSettingsNav';
import ProjectAuditInfo from './components/ProjectAuditInfo';
import { useDeliveryConfidence } from './hooks/useDeliveryConfidence';
import { useProjectSettingsSubmit } from './hooks/useProjectSettingsSubmit';
import { useProjectDeletion } from './hooks/useProjectDeletion';
import { useProjectDateSync } from './hooks/useProjectDateSync';
import { calculateWorkingDays } from './utils/calculate-working-days';
import { FORM_SECTION_KEYS, SettingsSectionItem } from './project-settings.constants';
import { getAddonSlotItems } from '@/addons/addon-slots';

import { IProjectViewModel } from '@/types/project/projectViewModel.types';
import { ITeamMemberViewModel } from '@/types/teamMembers/teamMembersGetResponse.types';
import { decodeHtmlEntities } from '@/utils/html-entities';
import logger from '@/utils/errorLogger';
import {
  fetchProjectData,
  setProjectData,
  setProjectId as setDrawerProjectId,
} from '@/features/project/project-drawer.slice';
import { closeProjectSettingsModal } from '@/features/project/project-settings-modal.slice';
import { useAuthService } from '@/hooks/useAuth';
import { hasTaskExportRoleAccess } from '@/utils/task-export-access';
import { isTeamLeadRole } from '@/types/roles/role.types';
import { canUseFeature, isFreeUser } from '@/utils/subscription-utils';
import {
  ProfileOutlined,
  SettingOutlined,
  DollarOutlined,
  TagsOutlined,
  FlagOutlined,
  TableOutlined,
  ApiOutlined,
  ExportOutlined,
  WarningOutlined,
  LockOutlined,
} from '@/shared/antd-imports';
import { toggleUpgradeModal } from '@/features/admin-center/admin-center.slice';
import { refreshCsrfToken } from '@/api/api-client';
import { isSoftwareProjectType } from '@/lib/project/software-project';
import { SoftwareProjectSettingsModal } from '../software-project-settings-modal/software-project-settings-modal';

export const ProjectSettingsModal = ({ onClose }: { onClose: () => void }) => {
  const { projectId, project } = useAppSelector(state => state.projectDrawerReducer);
  const isSoftwareProject = Boolean(projectId) && isSoftwareProjectType(project?.project_type);

  if (isSoftwareProject) return <SoftwareProjectSettingsModal onClose={onClose} />;
  return <GeneralProjectSettingsModal onClose={onClose} />;
};

const GeneralProjectSettingsModal = ({ onClose }: { onClose: () => void }) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('project-drawer');
  const [form] = Form.useForm();
  const [loading, setLoading] = useState<boolean>(true);
  const authService = useAuthService();
  const currentSession = authService.getCurrentSession();
  const { token } = theme.useToken();

  // State
  const [editMode, setEditMode] = useState<boolean>(false);
  const [selectedProjectManager, setSelectedProjectManager] = useState<ITeamMemberViewModel | null>(
    null
  );
  const [isFormValid, setIsFormValid] = useState<boolean>(true);
  const [settingsLoadFailed, setSettingsLoadFailed] = useState<boolean>(false);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [activeSection, setActiveSection] = useState<string>('general');

  // Selectors
  const { clients } = useAppSelector(state => state.clientReducer);
  const { projectId, projectLoading, project } = useAppSelector(
    state => state.projectDrawerReducer
  );
  const { isOpen: isProjectSettingsModalOpen } = useAppSelector(
    state => state.projectSettingsModalReducer
  );
  const { projectStatuses } = useAppSelector(state => state.projectStatusesReducer);
  const { projectHealths } = useAppSelector(state => state.projectHealthReducer);
  const { projectCategories } = useAppSelector(state => state.projectCategoriesReducer);
  const { priorities } = useAppSelector(state => state.projectPriorityReducer);
  const defaultPriorityId = useMemo(
    () => (priorities ?? []).find(priority => priority.name === 'Medium')?.id,
    [priorities]
  );

  // Memoized values
  const defaultFormValues = useMemo(() => {
    return {
      color_code: project?.color_code || projectColors[0],
      status_id: project?.status_id || projectStatuses.find(status => status.is_default)?.id,
      client_id: project?.client_id || null,
      client: project?.client_name || null,
      category_id: project?.category_id || null,
      priority_id: project?.priority_id || defaultPriorityId,
      working_days: project?.working_days || 0,
      man_days: project?.man_days || 0,
      hours_per_day: project?.hours_per_day || 8,
      use_manual_progress: project?.use_manual_progress || false,
      use_weighted_progress: project?.use_weighted_progress || false,
      use_time_progress: project?.use_time_progress || false,
      auto_assign_task_creator: project?.auto_assign_task_creator || false,
      restrict_task_creation: project?.restrict_task_creation || false,
      phase_assignees_enabled: project?.phase_assignees_enabled || false,
      restrict_tasks_to_assignee: project?.restrict_tasks_to_assignee || false,
      auto_assign_subtask_phase: project?.auto_assign_subtask_phase || false,
      health_id: project?.health_id || projectHealths.find(health => health.is_default)?.id,
    };
  }, [project, projectStatuses, projectHealths, defaultPriorityId]);

  // Auth and permissions — keyed by the modal's project id (not team role / form PM field).
  const { permissions, isProjectManager, financeAccess } = useProjectPermissions(projectId);
  const isOwnerorAdmin = authService.isOwnerOrAdmin();
  const isTeamLead = isTeamLeadRole(authService.role);
  // Create mode (no project yet): Owner/Admin only. Edit mode: server permissions for that project.
  const isEditable = projectId ? permissions.settings : isOwnerorAdmin;
  const isFree = isFreeUser(currentSession);
  const hasFinanceAccess = canUseFeature(currentSession, 'finance_module');
  const canRestrictTaskCreation = canUseFeature(currentSession, 'restrict_task_creation');
  const canViewExport = hasTaskExportRoleAccess(isOwnerorAdmin, isProjectManager, isTeamLead);
  const canManageBudgetSettings = projectId
    ? hasFinanceAccess && permissions.finance && financeAccess
    : hasFinanceAccess && isOwnerorAdmin;
  const canAssignPm = projectId ? permissions.assignPm : isOwnerorAdmin;
  const canDeleteProject = projectId ? permissions.delete : false;

  const { savedConfidenceRef, confidenceLoadedRef } = useDeliveryConfidence(
    form,
    modalVisible,
    projectId
  );
  const { handleFormSubmit, isSaving } = useProjectSettingsSubmit({
    editMode,
    projectId,
    project,
    selectedProjectManager,
    canAssignPm,
    canEditSettings: permissions.settings,
    isEditable,
    hasFinanceAccess,
    savedConfidenceRef,
    confidenceLoadedRef,
  });
  const { handleDeleteProject, isDeletingProject } = useProjectDeletion(projectId, project);

  // Effects
  useEffect(() => {
    const loadInitialData = async () => {
      const fetchPromises = [];
      if (projectStatuses.length === 0) fetchPromises.push(dispatch(fetchProjectStatuses()));
      if (projectCategories.length === 0) fetchPromises.push(dispatch(fetchProjectCategories()));
      if (projectHealths.length === 0) fetchPromises.push(dispatch(fetchProjectHealth()));
      if (priorities.length === 0) fetchPromises.push(dispatch(fetchProjectPriorities()));
      if (!clients.data?.length) {
        fetchPromises.push(
          dispatch(fetchClients({ index: 1, size: 5, field: null, order: null, search: null }))
        );
      }
      await Promise.all(fetchPromises);
    };

    loadInitialData();
  }, [dispatch, priorities.length]);

  useEffect(() => {
    if (modalVisible && projectId && project && !projectLoading) {
      setEditMode(true);
      setSettingsLoadFailed(false);

      try {
        const formValues: any = {
          ...project,
          name: decodeHtmlEntities(project.name),
          notes: project.notes ? decodeHtmlEntities(project.notes.slice(0, 500)) : '',
          start_date: project.start_date ? dayjs(project.start_date) : null,
          end_date: project.end_date ? dayjs(project.end_date) : null,
          working_days: project.working_days || 0,
          use_manual_progress: project.use_manual_progress || false,
          use_weighted_progress: project.use_weighted_progress || false,
          use_time_progress: project.use_time_progress || false,
          auto_assign_task_creator: project.auto_assign_task_creator || false,
          restrict_task_creation: project.restrict_task_creation || false,
          phase_assignees_enabled: project.phase_assignees_enabled || false,
          restrict_tasks_to_assignee: project.restrict_tasks_to_assignee || false,
          auto_assign_subtask_phase: project.auto_assign_subtask_phase || false,
          budget: project.budget ?? 0,
          currency: project.currency || 'USD',
        };

        const projectManager = project.project_manager?.id ? project.project_manager : null;

        form.setFieldsValue({
          ...formValues,
          project_manager: projectManager,
          finance_access:
            typeof project.project_manager?.finance_access === 'boolean'
              ? project.project_manager.finance_access
              : true,
        });

        if (formValues.start_date && formValues.end_date) {
          try {
            const days = calculateWorkingDays(formValues.start_date, formValues.end_date);
            form.setFieldsValue({ working_days: days });
          } catch (error) {
            logger.error('Error calculating working days when loading project', error);
          }
        }

        setSelectedProjectManager(projectManager);
        setLoading(false);

        refreshCsrfToken().catch(error => {
          console.warn('[CSRF] Failed to refresh token for project update:', error);
        });
      } catch (error) {
        logger.error('Error setting form values in project settings modal', error);
        setLoading(false);
      }
    } else if (modalVisible && !projectId) {
      setEditMode(false);
      setLoading(false);

      const currentValues = form.getFieldsValue();
      const isFormPristine = !form.isFieldsTouched(true);
      if (isFormPristine && !currentValues.color_code) {
        form.setFieldsValue({
          ...defaultFormValues,
          budget: 0,
          currency: 'USD',
        });
      }
      setSelectedProjectManager(null);

      refreshCsrfToken().catch(error => {
        console.warn('[CSRF] Failed to refresh token for project creation:', error);
      });
    } else if (modalVisible && projectId && !project && !projectLoading) {
      // The project exists (we have a real projectId) but fetching its current
      // settings failed (network blip, etc). We still set editMode so that IF the
      // user manages to submit, it calls updateProject on this project instead of
      // createProject — which would otherwise silently create a duplicate. But the
      // form's fields are empty/default here, not the project's real values, so we
      // block submission (see isFormValid below) until a retry succeeds: saving now
      // would overwrite the real project's fields with blanks (update_project sets
      // columns directly, it does not preserve existing values for omitted fields).
      setEditMode(true);
      setLoading(false);
      setSettingsLoadFailed(true);
    }
  }, [
    modalVisible,
    projectId,
    project,
    projectLoading,
    form,
    calculateWorkingDays,
    defaultFormValues,
  ]);

  const handleRetryLoadSettings = useCallback(() => {
    if (!projectId) return;
    setLoading(true);
    dispatch(fetchProjectData(projectId))
      .unwrap()
      .then(projectData => {
        dispatch(setProjectData(projectData));
      })
      .catch(error => {
        logger.error('Retry: failed to fetch project data for settings', error);
        setLoading(false);
      });
  }, [dispatch, projectId]);

  useEffect(() => {
    if (modalVisible && projectId && projectLoading) {
      setLoading(true);
    }
  }, [modalVisible, projectId, projectLoading]);

  useEffect(() => {
    if (!modalVisible || projectId || !defaultPriorityId) return;

    const currentPriorityId = form.getFieldValue('priority_id');
    if (!currentPriorityId) {
      form.setFieldValue('priority_id', defaultPriorityId);
    }
  }, [defaultPriorityId, modalVisible, form, projectId]);

  const resetForm = useCallback(() => {
    setEditMode(false);
    form.resetFields();
    form.setFieldsValue(defaultFormValues);
    setSelectedProjectManager(null);
  }, [form, defaultFormValues]);
  const { handleStartDateChange, handleEndDateChange, disabledStartDate, disabledEndDate } =
    useProjectDateSync(form, projectId);

  const handleUpgradeClick = useCallback(() => {
    dispatch(toggleUpgradeModal());
  }, [dispatch]);
  const handleVisibilityChange = useCallback(
    (visible: boolean) => {
      setModalVisible(visible);

      if (!visible) {
        resetForm();
      } else if (visible && projectId) {
        setLoading(true);
        // Ensure manager is restored when modal opens with already-loaded project data
        if (project?.project_manager?.id && !projectLoading) {
          setSelectedProjectManager(project.project_manager);
          setLoading(false);
        }
      } else if (visible && !projectId) {
        setLoading(false);
      }
    },
    [projectId, resetForm, project, projectLoading]
  );

  const handleModalClose = useCallback(() => {
    setLoading(true);
    setModalVisible(false);
    setActiveSection('general');
    resetForm();
    dispatch(setProjectData({} as IProjectViewModel));
    dispatch(setDrawerProjectId(null));
    dispatch(closeProjectSettingsModal());
    onClose();
  }, [resetForm, dispatch, onClose]);
  const handleFieldsChange = (_: any, allFields: any[]) => {
    const isValid = allFields.every(field => field.errors.length === 0);
    setIsFormValid(isValid);
  };

  const disabledForNonManagers = projectId ? !permissions.settings : !isOwnerorAdmin;

  // ─── Sidebar sections ───────────────────────────────────────────────────
  const sectionItems = useMemo(() => {
    // Sections that need an existing project show a placeholder until it has been created.
    const createFirstPlaceholder = (
      <Alert
        type="info"
        showIcon
        message={t('sectionAvailableAfterCreateTitle', {
          defaultValue: 'Available after project is created',
        })}
        description={t('sectionAvailableAfterCreateDescription', {
          defaultValue:
            'Statuses, phases, custom columns, integrations, and danger zone can be configured once the project exists. Complete General settings and click Create first.',
        })}
      />
    );

    const guardedSection = (children: ReactNode) =>
      editMode && projectId ? children : createFirstPlaceholder;

    const items: SettingsSectionItem[] = [
      {
        key: 'general',
        icon: <ProfileOutlined />,
        label: t('generalTab', { defaultValue: 'General' }),
        children: (
          <GeneralSettingsSection
            form={form}
            project={project}
            projectId={projectId}
            editMode={editMode}
            disabled={disabledForNonManagers}
            isFree={isFree}
            canAssignPm={canAssignPm}
            selectedProjectManager={selectedProjectManager}
            setSelectedProjectManager={setSelectedProjectManager}
            onUpgradeClick={handleUpgradeClick}
            disabledStartDate={disabledStartDate}
            disabledEndDate={disabledEndDate}
            onStartDateChange={handleStartDateChange}
            onEndDateChange={handleEndDateChange}
          />
        ),
      },
      {
        key: 'advanced',
        icon: <SettingOutlined />,
        label: t('advancedSettingsTab', { defaultValue: 'Advanced Settings' }),
        children: (
          <AdvancedSettingsSection
            form={form}
            disabled={disabledForNonManagers}
            canRestrictTaskCreation={canRestrictTaskCreation}
            onUpgradeClick={handleUpgradeClick}
          />
        ),
      },
      ...(isOwnerorAdmin
        ? [
            {
              key: 'privacy',
              icon: <LockOutlined />,
              label: t('projectPrivacyTab', { defaultValue: 'Project Privacy' }),
              children: <PrivacySettingsSection disabled={!isOwnerorAdmin} />,
            },
          ]
        : []),
      ...(canManageBudgetSettings
        ? [
            {
              key: 'budget',
              icon: <DollarOutlined />,
              label: t('budgetSettingsTab', { defaultValue: 'Budget Settings' }),
              children: (
                <BudgetSettingsSection
                  editMode={editMode}
                  canManage={canManageBudgetSettings}
                  hasFinanceAccess={hasFinanceAccess}
                  onUpgradeClick={handleUpgradeClick}
                />
              ),
            },
          ]
        : []),
    ];

    items.push(
      {
        key: 'statuses',
        icon: <TagsOutlined />,
        label: t('statusesTab', { defaultValue: 'Statuses' }),
        children: guardedSection(
          <StatusesSettingsSection projectId={projectId} disabled={disabledForNonManagers} />
        ),
      },
      {
        key: 'phases',
        icon: <FlagOutlined />,
        label: t('phasesTab', { defaultValue: 'Phases' }),
        children: guardedSection(
          <PhasesSettingsSection projectId={projectId} disabled={disabledForNonManagers} />
        ),
      },
      {
        key: 'customColumns',
        icon: <TableOutlined />,
        label: t('customColumnsTab', { defaultValue: 'Custom Columns' }),
        children: guardedSection(
          <CustomColumnsSettingsSection projectId={projectId} disabled={disabledForNonManagers} />
        ),
      },
      {
        key: 'integrations',
        icon: <ApiOutlined />,
        label: t('integrationsTab', { defaultValue: 'Integrations' }),
        children: guardedSection(
          <IntegrationsSettingsSection projectId={projectId} projectName={project?.name} />
        ),
      },
      ...(canViewExport
        ? [
            {
              key: 'taskExport',
              icon: <ExportOutlined />,
              label: t('taskExportTab', { defaultValue: 'Task Export' }),
              children: guardedSection(
                projectId ? <TaskExportSettingsSection projectId={projectId} /> : null
              ),
            },
          ]
        : []),
      ...getAddonSlotItems('projectSettingsTabs')
        .filter(item => Boolean(item.component))
        .map(item => {
          const AddonComponent = item.component!;
          return {
            key: item.key,
            icon: item.icon,
            label: item.labelKey
              ? t(item.labelKey, { defaultValue: item.defaultLabel || item.key })
              : item.defaultLabel || item.key,
            children: guardedSection(
              <AddonComponent project={project} projectId={projectId} editMode={editMode} />
            ),
          };
        }),
      {
        key: 'dangerZone',
        icon: <WarningOutlined />,
        label: (
          <Typography.Text type="danger">
            {t('dangerZoneTab', { defaultValue: 'Danger Zone' })}
          </Typography.Text>
        ),
        children: guardedSection(
          <DangerZoneSection
            onConfirmDelete={handleDeleteProject}
            isDeleting={isDeletingProject}
            canDelete={canDeleteProject}
          />
        ),
      }
    );

    return items;
  }, [
    t,
    editMode,
    project,
    form,
    disabledForNonManagers,
    isFree,
    selectedProjectManager,
    handleUpgradeClick,
    disabledStartDate,
    disabledEndDate,
    handleStartDateChange,
    handleEndDateChange,
    hasFinanceAccess,
    canRestrictTaskCreation,
    canManageBudgetSettings,
    projectId,
    isDeletingProject,
    isOwnerorAdmin,
    canDeleteProject,
    canAssignPm,
    canViewExport,
    handleDeleteProject,
  ]);

  const activeItem = sectionItems.find(item => item.key === activeSection) ?? sectionItems[0];
  const isFormSectionActive = FORM_SECTION_KEYS.includes(activeItem.key);

  useEffect(() => {
    if (!sectionItems.some(item => item.key === activeSection)) {
      setActiveSection('general');
    }
  }, [sectionItems, activeSection]);

  return (
    <AntModal
      title={<ProjectSettingsHeader projectId={projectId} project={project} />}
      width={1080}
      // Antd anchors the dialog 100px down and reserves 24px beneath it, which pushed
      // the footer off-screen; a 24px offset keeps the whole dialog inside the viewport.
      style={{ top: 24 }}
      open={isProjectSettingsModalOpen}
      onCancel={handleModalClose}
      destroyOnHidden
      afterOpenChange={handleVisibilityChange}
      styles={{
        content: { padding: 0, borderRadius: 12, overflow: 'hidden' },
        header: {
          padding: '16px 20px',
          margin: 0,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        },
        // The body is the single scroll container: capping its height keeps the dialog
        // (and .ant-modal-wrap) inside the viewport while header and footer stay put.
        body: { padding: 0, maxHeight: 'calc(100vh - 200px)', overflow: 'auto' },
        footer: {
          padding: '12px 20px',
          margin: 0,
          borderTop: `1px solid ${token.colorBorderSecondary}`,
        },
      }}
      footer={
        <ProjectSettingsFooter
          editMode={editMode}
          isFormSectionActive={isFormSectionActive}
          canSave={isEditable}
          isSaving={isSaving}
          saveDisabled={!isFormValid || settingsLoadFailed}
          onClose={handleModalClose}
          onSave={() => form.submit()}
        />
      }
    >
      <Skeleton
        active
        paragraph={{ rows: 12 }}
        loading={editMode && (loading || projectLoading)}
        style={{ padding: '20px 24px' }}
      >
        <Flex style={{ minHeight: 'min(480px, calc(100vh - 200px))' }}>
          <ProjectSettingsNav
            sections={sectionItems}
            activeKey={activeItem.key}
            onSelect={setActiveSection}
          />

          <div className="min-w-0" style={{ flex: 1, padding: '20px 24px' }}>
            <ProjectSettingsMobileNav
              sections={sectionItems}
              activeKey={activeItem.key}
              onSelect={setActiveSection}
            />

            {!isEditable && (
              <Alert
                message={t('noPermission')}
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}

            {settingsLoadFailed && (
              <Alert
                message={t('loadSettingsFailedTitle', {
                  defaultValue: 'Could not load project settings',
                })}
                description={t('loadSettingsFailedDescription', {
                  defaultValue:
                    'The project was created, but its current settings could not be loaded. Saving is disabled until this succeeds, to avoid overwriting the project with blank fields.',
                })}
                type="error"
                showIcon
                style={{ marginBottom: 16 }}
                action={
                  <Button size="small" loading={loading} onClick={handleRetryLoadSettings}>
                    {t('retry', { defaultValue: 'Retry' })}
                  </Button>
                }
              />
            )}

            {/* Form sections stay mounted so every field is submitted by the Update button */}
            <Form
              form={form}
              layout="vertical"
              onFinish={handleFormSubmit}
              initialValues={defaultFormValues}
              onFieldsChange={handleFieldsChange}
            >
              {sectionItems
                .filter(item => FORM_SECTION_KEYS.includes(item.key))
                .map(item => (
                  <div
                    key={item.key}
                    style={{ display: activeItem.key === item.key ? 'block' : 'none' }}
                  >
                    {item.children}
                  </div>
                ))}
            </Form>

            {!isFormSectionActive && activeItem.children}

            {editMode && <ProjectAuditInfo project={project} />}
          </div>
        </Flex>
      </Skeleton>
    </AntModal>
  );
};

export default ProjectSettingsModal;
