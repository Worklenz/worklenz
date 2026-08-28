import { useEffect, useState, useCallback, useMemo, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Button,
  Divider,
  Flex,
  Form,
  Input,
  Menu,
  notification,
  Select,
  Skeleton,
  Space,
  Switch,
  Tooltip,
  Typography,
  theme,
  MenuProps,
} from '@/shared/antd-imports';
import { Modal as AntModal } from '@/shared/antd-imports';
import dayjs from 'dayjs';

import { fetchClients } from '@/features/settings/client/clientSlice';
import {
  useCreateProjectMutation,
  useDeleteProjectMutation,
  useGetProjectsQuery,
  useUpdateProjectMutation,
} from '@/api/projects/projects.v1.api.service';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { projectColors } from '@/lib/project/project-constants';
import { setProject, setProjectId, mergeProject } from '@/features/project/project.slice';
import { fetchProjectCategories } from '@/features/projects/lookups/projectCategories/projectCategoriesSlice';
import { fetchProjectHealth } from '@/features/projects/lookups/projectHealth/projectHealthSlice';
import { fetchProjectStatuses } from '@/features/projects/lookups/projectStatuses/projectStatusesSlice';
import { fetchProjectPriorities } from '@/features/projects/priority/projectPrioritySlice';

import ProjectManagerDropdown from '../project-manager-dropdown/project-manager-dropdown';
import ProjectBasicInfo from '../project-drawer/project-basic-info/project-basic-info';
import ProjectHealthSection from '../project-drawer/project-health-section/project-health-section';
import ProjectStatusSection from '../project-drawer/project-status-section/project-status-section';
import ProjectCategorySection from '../project-drawer/project-category-section/project-category-section';
import ProjectClientSection from '../project-drawer/project-client-section/project-client-section';
import ProjectPrioritySection from '../project-drawer/project-priority-section/project-priority-section';
import { ProjectDatePicker } from '../project-drawer/components/ProjectDatePicker';

import SettingsCard from './components/settings-card';
import StatusesSettingsSection from './sections/statuses-settings-section';
import PhasesSettingsSection from './sections/phases-settings-section';
import CustomColumnsSettingsSection from './sections/custom-columns-settings-section';
import IntegrationsSettingsSection from './sections/integrations-settings-section';
import DangerZoneSection from './sections/danger-zone-section';

import { IProjectViewModel } from '@/types/project/projectViewModel.types';
import { ITeamMemberViewModel } from '@/types/teamMembers/teamMembersGetResponse.types';
import { calculateTimeDifference } from '@/utils/calculate-time-difference';
import { formatDateTimeWithLocale } from '@/utils/format-date-time-with-locale';
import { decodeHtmlEntities } from '@/utils/html-entities';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import logger from '@/utils/errorLogger';
import { setProjectData, setProjectId as setDrawerProjectId } from '@/features/project/project-drawer.slice';
import { closeProjectSettingsModal } from '@/features/project/project-settings-modal.slice';
import { useAuthService } from '@/hooks/useAuth';
import { evt_projects_create } from '@/shared/worklenz-analytics-events';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { hasBusinessFeatureAccess, isFreeUser } from '@/ee/utils/subscription-utils';
import {
  CrownOutlined,
  InfoCircleOutlined,
  ProfileOutlined,
  SettingOutlined,
  DollarOutlined,
  TagsOutlined,
  FlagOutlined,
  TableOutlined,
  ApiOutlined,
  WarningOutlined,
} from '@/shared/antd-imports';
import { toggleUpgradeModal } from '@/features/admin-center/admin-center.slice';
import { ensureCsrfToken, refreshCsrfToken } from '@/api/api-client';
import { CURRENCY_OPTIONS } from '@/shared/currencies';
import { projectFinanceApiService } from '@/ee/api/project-finance-ratecard/project-finance.api.service';

export const ProjectSettingsModal = ({ onClose }: { onClose: () => void }) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { trackMixpanelEvent } = useMixpanelTracking();
  const { t } = useTranslation('project-drawer');
  const { t: tCommon } = useTranslation('common');
  const [form] = Form.useForm();
  const [loading, setLoading] = useState<boolean>(true);
  const currentSession = useAuthService().getCurrentSession();
  const { token } = theme.useToken();

  // State
  const [editMode, setEditMode] = useState<boolean>(false);
  const [selectedProjectManager, setSelectedProjectManager] = useState<ITeamMemberViewModel | null>(
    null
  );
  const [isFormValid, setIsFormValid] = useState<boolean>(true);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [activeSection, setActiveSection] = useState<string>('general');
  const [isDeletingProject, setIsDeletingProjectState] = useState<boolean>(false);

  // Selectors
  const { clients, loading: loadingClients } = useAppSelector(state => state.clientReducer);
  const { requestParams } = useAppSelector(state => state.projectsReducer);
  const { projectId, projectLoading, project } = useAppSelector(state => state.projectDrawerReducer);
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

  // API Hooks
  const { refetch: refetchProjects } = useGetProjectsQuery(requestParams);
  const [deleteProject] = useDeleteProjectMutation();
  const [updateProject, { isLoading: isUpdatingProject }] = useUpdateProjectMutation();
  const [createProject, { isLoading: isCreatingProject }] = useCreateProjectMutation();

  // Socket connection
  const { socket, connected } = useSocket();

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
      health_id: project?.health_id || projectHealths.find(health => health.is_default)?.id,
    };
  }, [project, projectStatuses, projectHealths, defaultPriorityId]);

  /**
   * Calculate working days between two dates (excluding weekends)
   */
  const calculateWorkingDays = useCallback(
    (
      startDate: dayjs.Dayjs | string | null | undefined,
      endDate: dayjs.Dayjs | string | null | undefined
    ): number => {
      if (!startDate || !endDate) return 0;

      const start = dayjs.isDayjs(startDate) ? startDate : dayjs(startDate);
      const end = dayjs.isDayjs(endDate) ? endDate : dayjs(endDate);

      if (!start.isValid() || !end.isValid()) return 0;
      if (start.isAfter(end)) return 0;

      let workingDays = 0;
      let currentDate = start.clone().startOf('day');
      const endDateNormalized = end.clone().startOf('day');

      while (currentDate.isBefore(endDateNormalized) || currentDate.isSame(endDateNormalized)) {
        const dayOfWeek = currentDate.day();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          workingDays++;
        }
        currentDate = currentDate.add(1, 'day');
      }

      return workingDays;
    },
    []
  );

  // Auth and permissions
  const isProjectManager = currentSession?.team_member_id == selectedProjectManager?.id;
  const isOwnerorAdmin = useAuthService().isOwnerOrAdmin();
  const isEditable = isProjectManager || isOwnerorAdmin;
  const isFree = isFreeUser(currentSession);
  const hasBusinessAccess = hasBusinessFeatureAccess(currentSession);
  const canManageBudgetSettings = hasBusinessAccess && (isProjectManager || isOwnerorAdmin);

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
          budget: project.budget ?? 0,
          currency: project.currency || 'USD',
        };

        form.setFieldsValue(formValues);

        if (formValues.start_date && formValues.end_date) {
          try {
            const days = calculateWorkingDays(formValues.start_date, formValues.end_date);
            form.setFieldsValue({ working_days: days });
          } catch (error) {
            logger.error('Error calculating working days when loading project', error);
          }
        }

        setSelectedProjectManager(project.project_manager || null);
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
      setLoading(false);
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

  // Socket event handlers
  const handleStartDateChangeResponse = useCallback(
    (data: { project_id: string; start_date: string }) => {
      try {
        if (data.project_id === projectId) {
          const newStartDate = data.start_date ? dayjs(data.start_date) : null;
          form.setFieldsValue({ start_date: newStartDate });

          const endDate = form.getFieldValue('end_date');
          if (newStartDate && endDate) {
            const days = calculateWorkingDays(newStartDate, endDate);
            form.setFieldsValue({ working_days: days });
          } else if (!newStartDate) {
            form.setFieldsValue({ working_days: 0 });
          }
        }
      } catch (error) {
        logger.error('Error handling start date change response:', error);
      }
    },
    [projectId, form, calculateWorkingDays]
  );

  const handleEndDateChangeResponse = useCallback(
    (data: { project_id: string; end_date: string }) => {
      try {
        if (data.project_id === projectId) {
          const newEndDate = data.end_date ? dayjs(data.end_date) : null;
          form.setFieldsValue({ end_date: newEndDate });

          const startDate = form.getFieldValue('start_date');
          if (startDate && newEndDate) {
            const days = calculateWorkingDays(startDate, newEndDate);
            form.setFieldsValue({ working_days: days });
          } else if (!newEndDate) {
            form.setFieldsValue({ working_days: 0 });
          }
        }
      } catch (error) {
        logger.error('Error handling end date change response:', error);
      }
    },
    [projectId, form, calculateWorkingDays]
  );

  useEffect(() => {
    if (connected && socket && projectId) {
      socket.on(SocketEvents.PROJECT_START_DATE_CHANGE.toString(), handleStartDateChangeResponse);
      socket.on(SocketEvents.PROJECT_END_DATE_CHANGE.toString(), handleEndDateChangeResponse);

      return () => {
        socket.removeListener(
          SocketEvents.PROJECT_START_DATE_CHANGE.toString(),
          handleStartDateChangeResponse
        );
        socket.removeListener(
          SocketEvents.PROJECT_END_DATE_CHANGE.toString(),
          handleEndDateChangeResponse
        );
      };
    }
  }, [connected, socket, projectId, handleStartDateChangeResponse, handleEndDateChangeResponse]);

  const resetForm = useCallback(() => {
    setEditMode(false);
    form.resetFields();
    form.setFieldsValue(defaultFormValues);
    setSelectedProjectManager(null);
  }, [form, defaultFormValues]);

  const handleStartDateChange = useCallback(
    (date: dayjs.Dayjs | null) => {
      try {
        form.setFieldsValue({ start_date: date });

        const endDate = form.getFieldValue('end_date');
        if (date && endDate) {
          const days = calculateWorkingDays(date, endDate);
          form.setFieldsValue({ working_days: days });
        } else if (!date) {
          form.setFieldsValue({ working_days: 0 });
        }

        if (socket && projectId) {
          socket.emit(
            SocketEvents.PROJECT_START_DATE_CHANGE.toString(),
            JSON.stringify({
              project_id: projectId,
              start_date: date?.format('YYYY-MM-DD'),
              time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            })
          );
        }
      } catch (error) {
        logger.error('Error handling start date change', error);
      }
    },
    [form, calculateWorkingDays, socket, projectId]
  );

  const handleEndDateChange = useCallback(
    (date: dayjs.Dayjs | null) => {
      try {
        form.setFieldsValue({ end_date: date });

        const startDate = form.getFieldValue('start_date');
        if (startDate && date) {
          const days = calculateWorkingDays(startDate, date);
          form.setFieldsValue({ working_days: days });
        } else if (!date) {
          form.setFieldsValue({ working_days: 0 });
        }

        if (socket && projectId) {
          socket.emit(
            SocketEvents.PROJECT_END_DATE_CHANGE.toString(),
            JSON.stringify({
              project_id: projectId,
              end_date: date?.format('YYYY-MM-DD'),
              time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            })
          );
        }
      } catch (error) {
        logger.error('Error handling end date change', error);
      }
    },
    [form, calculateWorkingDays, socket, projectId]
  );

  const handleUpgradeClick = useCallback(() => {
    dispatch(toggleUpgradeModal());
  }, [dispatch]);

  const handleFormSubmit = async (values: any) => {
    try {
      const csrfToken = await ensureCsrfToken();

      if (!csrfToken) {
        notification.error({
          message: tCommon('error'),
          description: t('securityTokenValidationFailed', {
            defaultValue: 'Security token validation failed. Please try again.',
          }),
        });
        return;
      }

      const projectModel: IProjectViewModel = {
        name: values.name,
        color_code: values.color_code,
        status_id: values.status_id,
        category_id: values.category_id || null,
        priority_id: values.priority_id || null,
        notes: values.notes,
        key: values.key,
        client_id: values.client_id,
        client_name: values.client_name,
        start_date: values.start_date ? dayjs(values.start_date).format('YYYY-MM-DD') : undefined,
        end_date: values.end_date ? dayjs(values.end_date).format('YYYY-MM-DD') : undefined,
        working_days: parseInt(values.working_days),
        man_days: parseInt(values.man_days),
        hours_per_day: parseInt(values.hours_per_day),
        project_manager: selectedProjectManager,
        use_manual_progress: Boolean(values.use_manual_progress),
        use_weighted_progress: Boolean(values.use_weighted_progress),
        use_time_progress: Boolean(values.use_time_progress),
        auto_assign_task_creator: Boolean(values.auto_assign_task_creator),
        restrict_task_creation: Boolean(values.restrict_task_creation),
        phase_assignees_enabled: Boolean(values.phase_assignees_enabled),
        health_id: values.health_id,
      };

      const action =
        editMode && projectId
          ? updateProject({ id: projectId, project: projectModel })
          : createProject(projectModel);

      const response = await action;

      if (response?.data?.done) {
        if (response.data.body) {
          dispatch(mergeProject(response.data.body));
        }

        if (editMode && projectId && hasBusinessAccess) {
          const selectedBudget = Number(values.budget ?? 0);
          const selectedCurrency = (values.currency || 'USD').toUpperCase();
          const currentBudget = Number(project?.budget ?? 0);
          const currentCurrency = (project?.currency || 'USD').toUpperCase();

          if (selectedBudget !== currentBudget) {
            await projectFinanceApiService.updateProjectBudget(projectId, selectedBudget);
          }

          if (selectedCurrency !== currentCurrency) {
            await projectFinanceApiService.updateProjectCurrency(projectId, selectedCurrency);
          }
        }

        if (!editMode) {
          trackMixpanelEvent(evt_projects_create);
          navigate(
            `/worklenz/projects/${response.data.body.id}?tab=tasks-list&pinned_tab=tasks-list`
          );
          setTimeout(() => {
            window.location.reload();
          }, 100);
        } else {
          dispatch(closeProjectSettingsModal());
          refetchProjects();
          window.location.reload();
        }
      } else {
        notification.error({ message: response?.data?.message });
        logger.error(
          editMode ? 'Error updating project' : 'Error creating project',
          response?.data?.message
        );
      }
    } catch (error) {
      logger.error('Error saving project', error);
    }
  };

  const handleVisibilityChange = useCallback(
    (visible: boolean) => {
      setModalVisible(visible);

      if (!visible) {
        resetForm();
      } else if (visible && projectId) {
        setLoading(true);
      } else if (visible && !projectId) {
        setLoading(false);
      }
    },
    [projectId, resetForm]
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

  const handleDeleteProject = useCallback(async () => {
    if (!projectId) return;

    setIsDeletingProjectState(true);
    try {
      const projectName = decodeHtmlEntities(project?.name ?? '');
      const res = await deleteProject(projectId);

      if (res?.data?.done) {
        dispatch(setProject({} as IProjectViewModel));
        dispatch(setProjectData({} as IProjectViewModel));
        dispatch(setProjectId(null));
        dispatch(closeProjectSettingsModal());
        navigate('/worklenz/projects');
        refetchProjects();

        notification.success({
          message: 'Project deleted',
          description: `"${projectName}" has been permanently deleted.`,
          duration: 3,
        });

        setTimeout(() => {
          window.location.reload();
        }, 3000);
      } else {
        const errorMessage =
          res?.data?.message ||
          t('deleteProjectError', { defaultValue: 'Failed to delete project. Please try again.' });
        notification.error({ message: errorMessage });
        logger.error('Error deleting project', res?.data?.message);
      }
    } catch (error) {
      logger.error('Error deleting project', error);
    } finally {
      setIsDeletingProjectState(false);
    }
  }, [projectId, project, deleteProject, dispatch, navigate, refetchProjects]);

  // ─── Date disabling helpers ───────────────────────────────────────────────
  const disabledStartDate = useCallback(
    (current: dayjs.Dayjs) => {
      const endDate = form.getFieldValue('end_date');
      return current && endDate ? current.isAfter(dayjs(endDate), 'day') : false;
    },
    [form]
  );

  const disabledEndDate = useCallback(
    (current: dayjs.Dayjs) => {
      const startDate = form.getFieldValue('start_date');
      return current && startDate ? current.isBefore(dayjs(startDate), 'day') : false;
    },
    [form]
  );

  const handleFieldsChange = (_: any, allFields: any[]) => {
    const isValid = allFields.every(field => field.errors.length === 0);
    setIsFormValid(isValid);
  };

  const handleManualProgressChange = (checked: boolean) => {
    if (checked) {
      form.setFieldsValue({
        use_manual_progress: true,
        use_weighted_progress: false,
        use_time_progress: false,
      });
    } else {
      form.setFieldsValue({ use_manual_progress: false });
    }
  };

  const handleWeightedProgressChange = (checked: boolean) => {
    if (checked) {
      form.setFieldsValue({
        use_manual_progress: false,
        use_weighted_progress: true,
        use_time_progress: false,
      });
    } else {
      form.setFieldsValue({ use_weighted_progress: false });
    }
  };

  const handleTimeProgressChange = (checked: boolean) => {
    if (checked) {
      form.setFieldsValue({
        use_manual_progress: false,
        use_weighted_progress: false,
        use_time_progress: true,
      });
    } else {
      form.setFieldsValue({ use_time_progress: false });
    }
  };

  const disabledForNonManagers = !isProjectManager && !isOwnerorAdmin;

  // ─── Sidebar sections ───────────────────────────────────────────────────
  const sectionItems = useMemo(() => {
    const items: { key: string; label: ReactNode; icon?: ReactNode; children: ReactNode }[] = [
      {
        key: 'general',
        icon: <ProfileOutlined />,
        label: t('generalTab', { defaultValue: 'General' }),
        children: (
          <Flex vertical gap={16}>
            <SettingsCard
              title={t('basicDetailsCardTitle', { defaultValue: 'Basic Details' })}
            >
              <ProjectBasicInfo
                editMode={editMode}
                project={project}
                form={form}
                disabled={disabledForNonManagers}
              />
              <ProjectStatusSection
                statuses={projectStatuses}
                form={form}
                t={t}
                disabled={disabledForNonManagers}
              />
              <ProjectHealthSection
                healths={projectHealths}
                form={form}
                t={t}
                disabled={isFree || disabledForNonManagers}
              />
              <ProjectCategorySection
                form={form}
                t={t}
                disabled={isFree || disabledForNonManagers}
              />
              <ProjectPrioritySection
                priorities={priorities}
                form={form}
                t={t}
                disabled={disabledForNonManagers}
              />

              <Form.Item name="notes" label={t('notes')}>
                <Input.TextArea
                  placeholder={t('enterNotes')}
                  disabled={disabledForNonManagers}
                  maxLength={500}
                  showCount
                />
              </Form.Item>
            </SettingsCard>

            <SettingsCard
              title={t('clientAndManagerCardTitle', { defaultValue: 'Client & Manager' })}
            >
              <ProjectClientSection
                clients={clients}
                form={form}
                t={t}
                project={project}
                loadingClients={loadingClients}
                disabled={disabledForNonManagers}
              />

              <Form.Item
                name="project_manager"
                label={
                  <Flex align="center" gap={4}>
                    <span>{t('projectManager')}</span>
                    {isFree && (
                      <Tooltip title={tCommon('upgrade-plan')} placement="top">
                        <Button
                          type="text"
                          size="small"
                          icon={
                            <CrownOutlined style={{ fontSize: '14px', color: token.colorWarning }} />
                          }
                          onClick={handleUpgradeClick}
                          aria-label={tCommon('upgrade-plan')}
                        />
                      </Tooltip>
                    )}
                  </Flex>
                }
                layout="horizontal"
              >
                <ProjectManagerDropdown
                  selectedProjectManager={selectedProjectManager}
                  setSelectedProjectManager={setSelectedProjectManager}
                  disabled={isFree || disabledForNonManagers}
                />
              </Form.Item>
            </SettingsCard>

            <SettingsCard
              title={t('timelineAndEstimatesCardTitle', {
                defaultValue: 'Timeline & Estimates',
              })}
            >
              <Form.Item name="date" layout="horizontal">
                <Flex gap={8}>
                  <Form.Item
                    name="start_date"
                    label={t('startDate')}
                    rules={[
                      {
                        validator: (_, value) => {
                          const endDate = form.getFieldValue('end_date');
                          if (value && endDate && dayjs(value).isAfter(dayjs(endDate), 'day')) {
                            return Promise.reject(
                              new Error(
                                t('startDateAfterEndDate', {
                                  defaultValue: 'Start date cannot be later than end date',
                                })
                              )
                            );
                          }
                          return Promise.resolve();
                        },
                      },
                    ]}
                  >
                    <ProjectDatePicker
                      field="start_date"
                      value={form.getFieldValue('start_date')}
                      disabled={disabledForNonManagers}
                      disabledDate={disabledStartDate}
                      onChange={date => {
                        try {
                          handleStartDateChange(date);
                          form.validateFields(['start_date', 'end_date']);
                        } catch (error) {
                          logger.error('Error calculating working days on start date change', error);
                        }
                      }}
                    />
                  </Form.Item>

                  <Form.Item
                    name="end_date"
                    label={t('endDate')}
                    rules={[
                      {
                        validator: (_, value) => {
                          const startDate = form.getFieldValue('start_date');
                          if (value && startDate && dayjs(value).isBefore(dayjs(startDate), 'day')) {
                            return Promise.reject(
                              new Error(
                                t('endDateBeforeStartDate', {
                                  defaultValue: 'End date cannot be earlier than start date',
                                })
                              )
                            );
                          }
                          return Promise.resolve();
                        },
                      },
                    ]}
                  >
                    <ProjectDatePicker
                      field="end_date"
                      value={form.getFieldValue('end_date')}
                      disabled={disabledForNonManagers}
                      disabledDate={disabledEndDate}
                      onChange={date => {
                        try {
                          handleEndDateChange(date);
                          form.validateFields(['start_date', 'end_date']);
                        } catch (error) {
                          logger.error('Error calculating working days on end date change', error);
                        }
                      }}
                    />
                  </Form.Item>
                </Flex>
              </Form.Item>

              <Form.Item
                name="working_days"
                label={t('estimateWorkingDays')}
                rules={[
                  {
                    validator: (_, value) => {
                      if (value === undefined || value >= 0) return Promise.resolve();
                      return Promise.reject(new Error(t('workingDaysValidationMessage', { min: 0 })));
                    },
                  },
                ]}
              >
                <Input type="number" min={0} disabled={disabledForNonManagers} />
              </Form.Item>

              <Form.Item
                name="man_days"
                label={t('estimateManDays')}
                rules={[
                  {
                    validator: (_, value) => {
                      if (value === undefined || value >= 0) return Promise.resolve();
                      return Promise.reject(new Error(t('manDaysValidationMessage', { min: 0 })));
                    },
                  },
                ]}
              >
                <Input
                  type="number"
                  min={0}
                  disabled={disabledForNonManagers}
                  onBlur={e => {
                    const value = parseInt(e.target.value, 10);
                    if (value < 0) form.setFieldsValue({ man_days: 0 });
                  }}
                />
              </Form.Item>

              <Form.Item
                name="hours_per_day"
                label={t('hoursPerDay')}
                rules={[
                  {
                    validator: (_, value) => {
                      if (value === undefined || (value >= 0 && value <= 24)) return Promise.resolve();
                      return Promise.reject(
                        new Error(t('hoursPerDayValidationMessage', { min: 0, max: 24 }))
                      );
                    },
                  },
                ]}
              >
                <Input
                  type="number"
                  min={0}
                  disabled={disabledForNonManagers}
                  onBlur={e => {
                    const value = parseInt(e.target.value, 10);
                    if (value < 0) form.setFieldsValue({ hours_per_day: 8 });
                  }}
                />
              </Form.Item>
            </SettingsCard>
          </Flex>
        ),
      },
      {
        key: 'advanced',
        icon: <SettingOutlined />,
        label: t('advancedSettingsTab', { defaultValue: 'Advanced Settings' }),
        children: (
          <Flex vertical gap={16}>
            <SettingsCard
              title={t('progressSettings')}
              description={t('progressSettingsDescription', {
                defaultValue:
                  'Configure how task progress is calculated for this project. Only one method can be active at a time.',
              })}
            >
              <Form.Item
              name="use_manual_progress"
              label={
                <Space>
                  <Typography.Text>{t('manualProgress')}</Typography.Text>
                  <Tooltip title={t('manualProgressTooltip')}>
                    <InfoCircleOutlined style={{ color: token.colorTextSecondary }} />
                  </Tooltip>
                </Space>
              }
              valuePropName="checked"
            >
              <Switch onChange={handleManualProgressChange} disabled={disabledForNonManagers} />
            </Form.Item>

            <Form.Item
              name="use_weighted_progress"
              label={
                <Space>
                  <Typography.Text>{t('weightedProgress')}</Typography.Text>
                  <Tooltip title={t('weightedProgressTooltip')}>
                    <InfoCircleOutlined style={{ color: token.colorTextSecondary }} />
                  </Tooltip>
                </Space>
              }
              valuePropName="checked"
            >
              <Switch onChange={handleWeightedProgressChange} disabled={disabledForNonManagers} />
            </Form.Item>

            <Form.Item
              name="use_time_progress"
              label={
                <Space>
                  <Typography.Text>{t('timeProgress')}</Typography.Text>
                  <Tooltip title={t('timeProgressTooltip')}>
                    <InfoCircleOutlined style={{ color: token.colorTextSecondary }} />
                  </Tooltip>
                </Space>
              }
              valuePropName="checked"
            >
              <Switch onChange={handleTimeProgressChange} disabled={disabledForNonManagers} />
            </Form.Item>
            </SettingsCard>

            <SettingsCard
              title={t('taskSettings', { defaultValue: 'Task Settings' })}
              description={t('taskSettingsDescription', {
                defaultValue: 'Configure default behavior for tasks created in this project.',
              })}
            >
              <Form.Item
              name="auto_assign_task_creator"
              label={
                <Space>
                  <Typography.Text>{t('autoAssignTaskCreator')}</Typography.Text>
                  <Tooltip title={t('autoAssignTaskCreatorTooltip')}>
                    <InfoCircleOutlined style={{ color: token.colorTextSecondary }} />
                  </Tooltip>
                </Space>
              }
              valuePropName="checked"
            >
              <Switch disabled={disabledForNonManagers} />
            </Form.Item>
            </SettingsCard>

            <SettingsCard
              title={t('accessControlSettings', { defaultValue: 'Access Control' })}
              description={t('accessControlSettingsDescription', {
                defaultValue: 'Control who can create and assign tasks in this project.',
              })}
            >
              {!hasBusinessAccess && (
              <Alert
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
                message={t('restrictTaskCreationBusinessPlanTitle', {
                  defaultValue: 'Business Plan Required',
                })}
                description={
                  <Flex justify="space-between" align="center" gap={12} wrap="wrap">
                    <Typography.Text>
                      {t('restrictTaskCreationBusinessPlanDescription', {
                        defaultValue:
                          'Restricting task creation to Admins and Team Leads is available on Business and Enterprise plans.',
                      })}
                    </Typography.Text>
                    <Button
                      type="primary"
                      icon={<CrownOutlined />}
                      onClick={handleUpgradeClick}
                      aria-label={tCommon('upgrade-plan')}
                    >
                      {tCommon('upgrade-plan')}
                    </Button>
                  </Flex>
                }
              />
            )}

            <Form.Item
              name="restrict_task_creation"
              label={
                <Space>
                  <Typography.Text>
                    {t('restrictTaskCreation', {
                      defaultValue: 'Restrict task assignment to Admins and Team Leads',
                    })}
                  </Typography.Text>
                  <Tooltip
                    title={t('restrictTaskCreationTooltip', {
                      defaultValue:
                        'When enabled, only Admins and Team Leads can create and assign tasks. Team Members can only view their assigned tasks.',
                    })}
                  >
                    <InfoCircleOutlined style={{ color: token.colorTextSecondary }} />
                  </Tooltip>
                </Space>
              }
              valuePropName="checked"
            >
              <Switch disabled={disabledForNonManagers || !hasBusinessAccess} />
            </Form.Item>
            </SettingsCard>

            <SettingsCard
              title={t('phaseAssigneesSettings', { defaultValue: 'Phase Assignees' })}
              description={t('phaseAssigneesSettingsDescription', {
                defaultValue:
                  'When enabled, each pipeline phase can have a dedicated assignee. Tasks can only be advanced by their phase assignee (admins can always override).',
              })}
            >
              <Form.Item
              name="phase_assignees_enabled"
              label={
                <Space>
                  <Typography.Text>
                    {t('phaseAssigneesEnabled', { defaultValue: 'Enable Phase Assignees' })}
                  </Typography.Text>
                  <Tooltip
                    title={t('phaseAssigneesEnabledTooltip', {
                      defaultValue:
                        'When enabled, each phase in the pipeline can have a default assignee who is automatically assigned and responsible for completing tasks in that phase.',
                    })}
                  >
                    <InfoCircleOutlined style={{ color: token.colorTextSecondary }} />
                  </Tooltip>
                </Space>
              }
              valuePropName="checked"
            >
              <Switch disabled={disabledForNonManagers} />
            </Form.Item>
            </SettingsCard>
          </Flex>
        ),
      },
      {
        key: 'budget',
        icon: <DollarOutlined />,
        label: t('budgetSettingsTab', { defaultValue: 'Budget Settings' }),
        children: (
          <SettingsCard
            title={t('budgetSettingsTab', { defaultValue: 'Budget Settings' })}
          >
            {!hasBusinessAccess && (
              <Alert
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
                message={t('budgetBusinessPlanTitle', { defaultValue: 'Business Plan Required' })}
                description={
                  <Flex justify="space-between" align="center" gap={12} wrap="wrap">
                    <Typography.Text>
                      {t('budgetBusinessPlanDescription', {
                        defaultValue:
                          'Project budget settings are available on Business and Enterprise plans.',
                      })}
                    </Typography.Text>
                    <Button
                      type="primary"
                      icon={<CrownOutlined />}
                      onClick={handleUpgradeClick}
                      aria-label={tCommon('upgrade-plan')}
                    >
                      {tCommon('upgrade-plan')}
                    </Button>
                  </Flex>
                }
              />
            )}

            {!editMode && (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
                message={t('budgetCreateFirstTitle', { defaultValue: 'Create Project First' })}
                description={t('budgetCreateFirstDescription', {
                  defaultValue:
                    'Save the project first, then return to configure budget and currency settings.',
                })}
              />
            )}

            <Form.Item
              name="budget"
              label={t('budgetAmountLabel', { defaultValue: 'Project Budget' })}
              rules={[
                {
                  validator: (_, value) => {
                    if (value === undefined || value === null || Number(value) >= 0) {
                      return Promise.resolve();
                    }
                    return Promise.reject(
                      new Error(
                        t('budgetValidationMessage', {
                          defaultValue: 'Budget must be 0 or greater',
                        })
                      )
                    );
                  },
                },
              ]}
            >
              <Input
                type="number"
                min={0}
                step="0.01"
                disabled={!canManageBudgetSettings || !editMode}
                placeholder={t('budgetAmountPlaceholder', { defaultValue: 'Enter project budget' })}
              />
            </Form.Item>

            <Form.Item
              name="currency"
              label={t('budgetCurrencyLabel', { defaultValue: 'Currency' })}
              rules={[
                {
                  required: false,
                  message: t('budgetCurrencyRequired', { defaultValue: 'Please select a currency' }),
                },
              ]}
            >
              <Select
                showSearch
                options={CURRENCY_OPTIONS}
                disabled={!canManageBudgetSettings || !editMode}
                placeholder={t('budgetCurrencyPlaceholder', { defaultValue: 'Select currency' })}
                filterOption={(input, option) =>
                  String(option?.label || '')
                    .toLowerCase()
                    .includes(input.toLowerCase())
                }
              />
            </Form.Item>
          </SettingsCard>
        ),
      },
    ];

    if (editMode && projectId) {
      items.push(
        {
          key: 'statuses',
          icon: <TagsOutlined />,
          label: t('statusesTab', { defaultValue: 'Statuses' }),
          children: <StatusesSettingsSection projectId={projectId} />,
        },
        {
          key: 'phases',
          icon: <FlagOutlined />,
          label: t('phasesTab', { defaultValue: 'Phases' }),
          children: <PhasesSettingsSection projectId={projectId} />,
        },
        {
          key: 'customColumns',
          icon: <TableOutlined />,
          label: t('customColumnsTab', { defaultValue: 'Custom Columns' }),
          children: <CustomColumnsSettingsSection projectId={projectId} />,
        },
        {
          key: 'integrations',
          icon: <ApiOutlined />,
          label: t('integrationsTab', { defaultValue: 'Integrations' }),
          children: (
            <IntegrationsSettingsSection
              projectId={projectId}
              projectName={project?.name}
            />
          ),
        },
        {
          key: 'dangerZone',
          icon: <WarningOutlined />,
          label: (
            <Typography.Text type="danger">
              {t('dangerZoneTab', { defaultValue: 'Danger Zone' })}
            </Typography.Text>
          ),
          children: (
            <DangerZoneSection
              onConfirmDelete={handleDeleteProject}
              isDeleting={isDeletingProject}
              canDelete={isProjectManager || isOwnerorAdmin}
            />
          ),
        }
      );
    }

    return items;
  }, [
    t,
    tCommon,
    editMode,
    project,
    form,
    disabledForNonManagers,
    projectStatuses,
    projectHealths,
    priorities,
    isFree,
    clients,
    loadingClients,
    selectedProjectManager,
    token,
    handleUpgradeClick,
    disabledStartDate,
    disabledEndDate,
    handleStartDateChange,
    handleEndDateChange,
    hasBusinessAccess,
    canManageBudgetSettings,
    projectId,
    isDeletingProject,
    isProjectManager,
    isOwnerorAdmin,
    handleDeleteProject,
  ]);

  const menuItems: MenuProps['items'] = sectionItems.map(item => ({
    key: item.key,
    label: item.label,
    icon: item.icon,
  }));

  const activeItem = sectionItems.find(item => item.key === activeSection) ?? sectionItems[0];

  useEffect(() => {
    if (!sectionItems.some(item => item.key === activeSection)) {
      setActiveSection('general');
    }
  }, [sectionItems, activeSection]);

  return (
    <AntModal
      title={
        <Typography.Text style={{ fontWeight: 600, fontSize: 16 }}>
          {projectId
            ? t('projectSettings', { defaultValue: 'Project Settings' })
            : t('createProject')}
        </Typography.Text>
      }
      width={1040}
      open={isProjectSettingsModalOpen}
      onCancel={handleModalClose}
      destroyOnClose
      afterOpenChange={handleVisibilityChange}
      styles={{
        content: { padding: 0, borderRadius: 12, overflow: 'hidden' },
        header: {
          padding: '16px 20px',
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
        <Flex justify="end">
          {(isProjectManager || isOwnerorAdmin) && (
            <Button
              type="primary"
              onClick={() => form.submit()}
              loading={isCreatingProject || isUpdatingProject}
              disabled={!isFormValid}
            >
              {editMode ? t('update') : t('create')}
            </Button>
          )}
        </Flex>
      }
    >
      <Skeleton
        active
        paragraph={{ rows: 12 }}
        loading={editMode && (loading || projectLoading)}
        style={{ padding: '20px 24px' }}
      >
        <Flex style={{ minHeight: 480 }}>
          <div
            style={{
              width: 248,
              flexShrink: 0,
              borderRight: `1px solid ${token.colorBorderSecondary}`,
              background: token.colorFillTertiary,
              padding: '12px 8px',
            }}
          >
            <Menu
              mode="inline"
              selectedKeys={[activeItem.key]}
              items={menuItems}
              onClick={({ key }) => setActiveSection(key)}
              style={{ border: 'none', background: 'transparent' }}
            />
          </div>

          <div style={{ flex: 1, padding: '20px 24px', overflowY: 'auto', maxHeight: '70vh' }}>
            {!isEditable && (
              <Alert
                message={t('noPermission')}
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}

            <Form
              form={form}
              layout="vertical"
              onFinish={handleFormSubmit}
              initialValues={defaultFormValues}
              onFieldsChange={handleFieldsChange}
            >
              <div style={{ display: activeItem.key === 'general' ? 'block' : 'none' }}>
                {sectionItems.find(item => item.key === 'general')?.children}
              </div>
              <div style={{ display: activeItem.key === 'advanced' ? 'block' : 'none' }}>
                {sectionItems.find(item => item.key === 'advanced')?.children}
              </div>
              <div style={{ display: activeItem.key === 'budget' ? 'block' : 'none' }}>
                {sectionItems.find(item => item.key === 'budget')?.children}
              </div>
            </Form>

            {!['general', 'advanced', 'budget'].includes(activeItem.key) && activeItem.children}

            {editMode && (
              <Flex vertical gap={4}>
                <Divider />
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {t('createdAt')}&nbsp;
                  <Tooltip title={formatDateTimeWithLocale(project?.created_at || '')}>
                    {calculateTimeDifference(project?.created_at || '', t('justNow', { defaultValue: 'Just now' }))}
                  </Tooltip>{' '}
                  {t('by')} {project?.project_owner || ''}
                </Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {t('updatedAt')}&nbsp;
                  <Tooltip title={formatDateTimeWithLocale(project?.updated_at || '')}>
                    {calculateTimeDifference(project?.updated_at || '', t('justNow', { defaultValue: 'Just now' }))}
                  </Tooltip>
                </Typography.Text>
              </Flex>
            )}
          </div>
        </Flex>
      </Skeleton>
    </AntModal>
  );
};

export default ProjectSettingsModal;
