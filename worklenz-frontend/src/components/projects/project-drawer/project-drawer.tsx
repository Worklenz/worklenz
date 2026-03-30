import { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Button,
  DatePicker,
  Divider,
  Drawer,
  Flex,
  Form,
  Input,
  notification,
  Popconfirm,
  Skeleton,
  Space,
  Switch,
  Tabs,
  Tooltip,
  Typography,
  theme,
  TabsProps,
} from '@/shared/antd-imports';
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
import { setProject, setProjectId } from '@/features/project/project.slice';
import { fetchProjectCategories } from '@/features/projects/lookups/projectCategories/projectCategoriesSlice';
import { fetchProjectHealth } from '@/features/projects/lookups/projectHealth/projectHealthSlice';
import { fetchProjectStatuses } from '@/features/projects/lookups/projectStatuses/projectStatusesSlice';

import ProjectManagerDropdown from '../project-manager-dropdown/project-manager-dropdown';
import ProjectBasicInfo from './project-basic-info/project-basic-info';
import ProjectHealthSection from './project-health-section/project-health-section';
import ProjectStatusSection from './project-status-section/project-status-section';
import ProjectCategorySection from './project-category-section/project-category-section';
import ProjectClientSection from './project-client-section/project-client-section';
import { ProjectDatePicker } from './components/ProjectDatePicker';

import { IProjectViewModel } from '@/types/project/projectViewModel.types';
import { ITeamMemberViewModel } from '@/types/teamMembers/teamMembersGetResponse.types';
import { calculateTimeDifference } from '@/utils/calculate-time-difference';
import { formatDateTimeWithLocale } from '@/utils/format-date-time-with-locale';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import logger from '@/utils/errorLogger';
import {
  setProjectData,
  toggleProjectDrawer,
  setProjectId as setDrawerProjectId,
} from '@/features/project/project-drawer.slice';
import useIsProjectManager from '@/hooks/useIsProjectManager';
import { useAuthService } from '@/hooks/useAuth';
import { evt_projects_create } from '@/shared/worklenz-analytics-events';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { isFreeUser } from '@/utils/subscription-utils';
import { CrownOutlined } from '@ant-design/icons';
import { toggleUpgradeModal } from '@/features/admin-center/admin-center.slice';
import { ensureCsrfToken, refreshCsrfToken } from '@/api/api-client';

export const ProjectDrawer = ({ onClose }: { onClose: () => void }) => {
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
  const [drawerVisible, setDrawerVisible] = useState<boolean>(false);

  // Selectors
  const { clients, loading: loadingClients } = useAppSelector(state => state.clientReducer);
  const { requestParams } = useAppSelector(state => state.projectsReducer);
  const { isProjectDrawerOpen, projectId, projectLoading, project } = useAppSelector(
    state => state.projectDrawerReducer
  );
  const { projectStatuses } = useAppSelector(state => state.projectStatusesReducer);
  const { projectHealths } = useAppSelector(state => state.projectHealthReducer);
  const { projectCategories } = useAppSelector(state => state.projectCategoriesReducer);

  // API Hooks
  const { refetch: refetchProjects } = useGetProjectsQuery(requestParams);
  const [deleteProject, { isLoading: isDeletingProject }] = useDeleteProjectMutation();
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
      working_days: project?.working_days || 0,
      man_days: project?.man_days || 0,
      hours_per_day: project?.hours_per_day || 8,
      use_manual_progress: project?.use_manual_progress || false,
      use_weighted_progress: project?.use_weighted_progress || false,
      use_time_progress: project?.use_time_progress || false,
      auto_assign_task_creator: project?.auto_assign_task_creator || false,
      health_id: project?.health_id || projectHealths.find(health => health.is_default)?.id,
    };
  }, [project, projectStatuses, projectHealths]);

  /**
   * Calculate working days between two dates (excluding weekends)
   */
  const calculateWorkingDays = useCallback((
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
  }, []);

  // Auth and permissions
  const isProjectManager = currentSession?.team_member_id == selectedProjectManager?.id;
  const isOwnerorAdmin = useAuthService().isOwnerOrAdmin();
  const isEditable = isProjectManager || isOwnerorAdmin;
  const isFree = isFreeUser(currentSession);

  // Effects
  useEffect(() => {
    const loadInitialData = async () => {
      const fetchPromises = [];
      if (projectStatuses.length === 0) fetchPromises.push(dispatch(fetchProjectStatuses()));
      if (projectCategories.length === 0) fetchPromises.push(dispatch(fetchProjectCategories()));
      if (projectHealths.length === 0) fetchPromises.push(dispatch(fetchProjectHealth()));
      if (!clients.data?.length) {
        fetchPromises.push(
          dispatch(fetchClients({ index: 1, size: 5, field: null, order: null, search: null }))
        );
      }
      await Promise.all(fetchPromises);
    };

    loadInitialData();
  }, [dispatch]);

  useEffect(() => {
    if (drawerVisible && projectId && project && !projectLoading) {
      console.log('Populating form with project data:', project);
      setEditMode(true);

      try {
        const formValues: any = {
          ...project,
          start_date: project.start_date ? dayjs(project.start_date) : null,
          end_date: project.end_date ? dayjs(project.end_date) : null,
          working_days: project.working_days || 0,
          use_manual_progress: project.use_manual_progress || false,
          use_weighted_progress: project.use_weighted_progress || false,
          use_time_progress: project.use_time_progress || false,
          auto_assign_task_creator: project.auto_assign_task_creator || false,
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
        console.error('Error setting form values:', error);
        logger.error('Error setting form values in project drawer', error);
        setLoading(false);
      }
    } else if (drawerVisible && !projectId) {
      setEditMode(false);
      setLoading(false);

      const currentValues = form.getFieldsValue();
      const isFormPristine = !form.isFieldsTouched(true);
      if (isFormPristine && !currentValues.color_code) {
        form.setFieldsValue(defaultFormValues);
      }
      setSelectedProjectManager(null);

      refreshCsrfToken().catch(error => {
        console.warn('[CSRF] Failed to refresh token for project creation:', error);
      });
    } else if (drawerVisible && projectId && !project && !projectLoading) {
      console.warn('Project drawer is visible but no project data available');
      setLoading(false);
    } else if (drawerVisible && projectId) {
      console.log('Drawer visible, waiting for project data to load...');
    }
  }, [drawerVisible, projectId, project, projectLoading, form, calculateWorkingDays, defaultFormValues]);

  useEffect(() => {
    if (drawerVisible && projectId && projectLoading) {
      console.log('Project data is loading, maintaining loading state');
      setLoading(true);
    }
  }, [drawerVisible, projectId, projectLoading]);

  // Socket event handlers
  const handleStartDateChangeResponse = useCallback((data: { project_id: string; start_date: string }) => {
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
  }, [projectId, form, calculateWorkingDays]);

  const handleEndDateChangeResponse = useCallback((data: { project_id: string; end_date: string }) => {
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
  }, [projectId, form, calculateWorkingDays]);

  useEffect(() => {
    if (connected && socket && projectId) {
      socket.on(SocketEvents.PROJECT_START_DATE_CHANGE.toString(), handleStartDateChangeResponse);
      socket.on(SocketEvents.PROJECT_END_DATE_CHANGE.toString(), handleEndDateChangeResponse);

      return () => {
        socket.removeListener(SocketEvents.PROJECT_START_DATE_CHANGE.toString(), handleStartDateChangeResponse);
        socket.removeListener(SocketEvents.PROJECT_END_DATE_CHANGE.toString(), handleEndDateChangeResponse);
      };
    }
  }, [connected, socket, projectId, handleStartDateChangeResponse, handleEndDateChangeResponse]);

  const resetForm = useCallback(() => {
    setEditMode(false);
    form.resetFields();
    form.setFieldsValue(defaultFormValues);
    setSelectedProjectManager(null);
  }, [form, defaultFormValues]);

  const recalculateWorkingDays = useCallback(() => {
    const startDate = form.getFieldValue('start_date');
    const endDate = form.getFieldValue('end_date');

    if (startDate && endDate) {
      try {
        const days = calculateWorkingDays(startDate, endDate);
        form.setFieldsValue({ working_days: days });
      } catch (error) {
        logger.error('Error recalculating working days', error);
      }
    } else if (!startDate || !endDate) {
      form.setFieldsValue({ working_days: 0 });
    }
  }, [form, calculateWorkingDays]);

  const handleStartDateChange = useCallback((date: dayjs.Dayjs | null) => {
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
  }, [form, calculateWorkingDays, socket, projectId]);

  const handleEndDateChange = useCallback((date: dayjs.Dayjs | null) => {
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
  }, [form, calculateWorkingDays, socket, projectId]);

  const handleUpgradeClick = useCallback(() => {
    dispatch(toggleUpgradeModal());
  }, [dispatch]);

  const handleFormSubmit = async (values: any) => {
    try {
      const csrfToken = await ensureCsrfToken();

      if (!csrfToken) {
        notification.error({
          message: tCommon('error'),
          description: 'Security token validation failed. Please try again.',
        });
        return;
      }

      const projectModel: IProjectViewModel = {
        name: values.name,
        color_code: values.color_code,
        status_id: values.status_id,
        category_id: values.category_id || null,
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
        health_id: values.health_id,
      };

      const action =
        editMode && projectId
          ? updateProject({ id: projectId, project: projectModel })
          : createProject(projectModel);

      const response = await action;

      if (response?.data?.done) {
        if (!editMode) {
          trackMixpanelEvent(evt_projects_create);
          navigate(
            `/worklenz/projects/${response.data.body.id}?tab=tasks-list&pinned_tab=tasks-list`
          );
          setTimeout(() => {
            window.location.reload();
          }, 100);
        } else {
          dispatch(toggleProjectDrawer());
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
      console.log('Drawer visibility changed:', visible, 'Project ID:', projectId);
      setDrawerVisible(visible);

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

  const handleDrawerClose = useCallback(() => {
    setLoading(true);
    setDrawerVisible(false);
    resetForm();
    dispatch(setProjectData({} as IProjectViewModel));
    dispatch(setDrawerProjectId(null));
    dispatch(toggleProjectDrawer());
    onClose();
  }, [resetForm, dispatch, onClose]);

  const handleDeleteProject = async () => {
    if (!projectId) return;

    try {
      const res = await deleteProject(projectId);
      if (res?.data?.done) {
        dispatch(setProject({} as IProjectViewModel));
        dispatch(setProjectData({} as IProjectViewModel));
        dispatch(setProjectId(null));
        dispatch(toggleProjectDrawer());
        navigate('/worklenz/projects');
        refetchProjects();
        window.location.reload();
      } else {
        notification.error({ message: res?.data?.message });
        logger.error('Error deleting project', res?.data?.message);
      }
    } catch (error) {
      logger.error('Error deleting project', error);
    }
  };

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
      form.setFieldsValue({ use_manual_progress: true, use_weighted_progress: false, use_time_progress: false });
    } else {
      form.setFieldsValue({ use_manual_progress: false });
    }
  };

  const handleWeightedProgressChange = (checked: boolean) => {
    if (checked) {
      form.setFieldsValue({ use_manual_progress: false, use_weighted_progress: true, use_time_progress: false });
    } else {
      form.setFieldsValue({ use_weighted_progress: false });
    }
  };

  const handleTimeProgressChange = (checked: boolean) => {
    if (checked) {
      form.setFieldsValue({ use_manual_progress: false, use_weighted_progress: false, use_time_progress: true });
    } else {
      form.setFieldsValue({ use_time_progress: false });
    }
  };

  // ─── Tab items ────────────────────────────────────────────────────────────
  const tabItems: TabsProps['items'] = [
    {
      key: 'general',
      label: t('generalTab', { defaultValue: 'General' }),
      children: (
        <>
          <ProjectBasicInfo
            editMode={editMode}
            project={project}
            form={form}
            disabled={!isProjectManager && !isOwnerorAdmin}
          />
          <ProjectStatusSection
            statuses={projectStatuses}
            form={form}
            t={t}
            disabled={!isProjectManager && !isOwnerorAdmin}
          />
          <ProjectHealthSection
            healths={projectHealths}
            form={form}
            t={t}
            disabled={isFree || (!isProjectManager && !isOwnerorAdmin)}
          />
          <ProjectCategorySection
            categories={projectCategories}
            form={form}
            t={t}
            disabled={isFree || (!isProjectManager && !isOwnerorAdmin)}
          />

          <Form.Item name="notes" label={t('notes')}>
            <Input.TextArea
              placeholder={t('enterNotes')}
              disabled={!isProjectManager && !isOwnerorAdmin}
            />
          </Form.Item>

          <ProjectClientSection
            clients={clients}
            form={form}
            t={t}
            project={project}
            loadingClients={loadingClients}
            disabled={!isProjectManager && !isOwnerorAdmin}
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
              disabled={isFree || (!isProjectManager && !isOwnerorAdmin)}
            />
          </Form.Item>

          {/* ── Date fields with cross-validation ── */}
          <Form.Item name="date" layout="horizontal">
            <Flex gap={8}>
              {/* START DATE */}
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
                  disabled={!isProjectManager && !isOwnerorAdmin}
                  disabledDate={disabledStartDate}
                  onChange={date => {
                    try {
                      form.setFieldsValue({ start_date: date });
                      const endDate = form.getFieldValue('end_date');
                      if (date && endDate) {
                        const days = calculateWorkingDays(date, endDate);
                        form.setFieldsValue({ working_days: days });
                      } else if (!date) {
                        form.setFieldsValue({ working_days: 0 });
                      }
                      // Cross-validate so the error clears on the other field too
                      form.validateFields(['start_date', 'end_date']);
                    } catch (error) {
                      logger.error('Error calculating working days on start date change', error);
                    }
                  }}
                />
              </Form.Item>

              {/* END DATE */}
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
                  disabled={!isProjectManager && !isOwnerorAdmin}
                  disabledDate={disabledEndDate}
                  onChange={date => {
                    try {
                      form.setFieldsValue({ end_date: date });
                      const startDate = form.getFieldValue('start_date');
                      if (startDate && date) {
                        const days = calculateWorkingDays(startDate, date);
                        form.setFieldsValue({ working_days: days });
                      } else if (!date) {
                        form.setFieldsValue({ working_days: 0 });
                      }
                      // Cross-validate so the error clears on the other field too
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
            <Input type="number" min={0} disabled={!isProjectManager && !isOwnerorAdmin} />
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
              disabled={!isProjectManager && !isOwnerorAdmin}
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
              disabled={!isProjectManager && !isOwnerorAdmin}
              onBlur={e => {
                const value = parseInt(e.target.value, 10);
                if (value < 0) form.setFieldsValue({ hours_per_day: 8 });
              }}
            />
          </Form.Item>
        </>
      ),
    },
    {
      key: 'advanced',
      label: t('advancedSettingsTab', { defaultValue: 'Advanced Settings' }),
      children: (
        <>
          <Typography.Title level={5} style={{ marginTop: 0 }}>
            {t('progressSettings')}
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 16 }}>
            {t('progressSettingsDescription', {
              defaultValue:
                'Configure how task progress is calculated for this project. Only one method can be active at a time.',
            })}
          </Typography.Paragraph>

          <Form.Item
            name="use_manual_progress"
            label={
              <Space>
                <Typography.Text>{t('manualProgress')}</Typography.Text>
                <Tooltip title={t('manualProgressTooltip')}>
                  <Button type="text" size="small" icon={<Typography.Text>ⓘ</Typography.Text>} />
                </Tooltip>
              </Space>
            }
            valuePropName="checked"
          >
            <Switch
              onChange={handleManualProgressChange}
              disabled={!isProjectManager && !isOwnerorAdmin}
            />
          </Form.Item>

          <Form.Item
            name="use_weighted_progress"
            label={
              <Space>
                <Typography.Text>{t('weightedProgress')}</Typography.Text>
                <Tooltip title={t('weightedProgressTooltip')}>
                  <Button type="text" size="small" icon={<Typography.Text>ⓘ</Typography.Text>} />
                </Tooltip>
              </Space>
            }
            valuePropName="checked"
          >
            <Switch
              onChange={handleWeightedProgressChange}
              disabled={!isProjectManager && !isOwnerorAdmin}
            />
          </Form.Item>

          <Form.Item
            name="use_time_progress"
            label={
              <Space>
                <Typography.Text>{t('timeProgress')}</Typography.Text>
                <Tooltip title={t('timeProgressTooltip')}>
                  <Button type="text" size="small" icon={<Typography.Text>ⓘ</Typography.Text>} />
                </Tooltip>
              </Space>
            }
            valuePropName="checked"
          >
            <Switch
              onChange={handleTimeProgressChange}
              disabled={!isProjectManager && !isOwnerorAdmin}
            />
          </Form.Item>

          <Divider />

          <Typography.Title level={5}>
            {t('taskSettings', { defaultValue: 'Task Settings' })}
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 16 }}>
            {t('taskSettingsDescription', {
              defaultValue: 'Configure default behavior for tasks created in this project.',
            })}
          </Typography.Paragraph>

          <Form.Item
            name="auto_assign_task_creator"
            label={
              <Space>
                <Typography.Text>{t('autoAssignTaskCreator')}</Typography.Text>
                <Tooltip title={t('autoAssignTaskCreatorTooltip')}>
                  <Button type="text" size="small" icon={<Typography.Text>ⓘ</Typography.Text>} />
                </Tooltip>
              </Space>
            }
            valuePropName="checked"
          >
            <Switch disabled={!isProjectManager && !isOwnerorAdmin} />
          </Form.Item>
        </>
      ),
    },
  ];

  return (
    <Drawer
      title={
        <Typography.Text style={{ fontWeight: 500, fontSize: 16 }}>
          {projectId ? t('editProject') : t('createProject')}
        </Typography.Text>
      }
      open={isProjectDrawerOpen}
      onClose={handleDrawerClose}
      destroyOnClose
      afterOpenChange={handleVisibilityChange}
      footer={
        <Flex justify="space-between">
          <Space>
            {editMode && (isProjectManager || isOwnerorAdmin) && (
              <Popconfirm
                title={t('deleteConfirmation')}
                description={t('deleteConfirmationDescription')}
                onConfirm={handleDeleteProject}
                okText={t('yes')}
                cancelText={t('no')}
              >
                <Button danger type="dashed" loading={isDeletingProject}>
                  {t('delete')}
                </Button>
              </Popconfirm>
            )}
          </Space>
          <Space>
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
          </Space>
        </Flex>
      }
    >
      {!isEditable && (
        <Alert message={t('noPermission')} type="warning" showIcon style={{ marginBottom: 16 }} />
      )}
      <Skeleton active paragraph={{ rows: 12 }} loading={editMode && (loading || projectLoading)}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleFormSubmit}
          initialValues={defaultFormValues}
          onFieldsChange={handleFieldsChange}
        >
          <Tabs defaultActiveKey="general" items={tabItems} />
        </Form>

        {editMode && (
          <Flex vertical gap={4}>
            <Divider />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {t('createdAt')}&nbsp;
              <Tooltip title={formatDateTimeWithLocale(project?.created_at || '')}>
                {calculateTimeDifference(project?.created_at || '')}
              </Tooltip>{' '}
              {t('by')} {project?.project_owner || ''}
            </Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {t('updatedAt')}&nbsp;
              <Tooltip title={formatDateTimeWithLocale(project?.updated_at || '')}>
                {calculateTimeDifference(project?.updated_at || '')}
              </Tooltip>
            </Typography.Text>
          </Flex>
        )}
      </Skeleton>
    </Drawer>
  );
};

export default ProjectDrawer;