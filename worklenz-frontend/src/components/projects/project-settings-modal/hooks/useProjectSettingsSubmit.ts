import { MutableRefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { notification } from '@/shared/antd-imports';

import {
  useCreateProjectMutation,
  useGetProjectsQuery,
  useUpdateProjectMutation,
} from '@/api/projects/projects.v1.api.service';
import { ensureCsrfToken } from '@/api/api-client';
import { progressTrackingApiService } from '@/api/reporting/progress-tracking.api.service';
import { projectFinanceApiService } from '@/api/project-finance-ratecard/project-finance.api.service';
import { mergeProject } from '@/features/project/project.slice';
import { closeProjectSettingsModal } from '@/features/project/project-settings-modal.slice';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { evt_projects_create } from '@/shared/worklenz-analytics-events';
import { IProjectViewModel } from '@/types/project/projectViewModel.types';
import { ITeamMemberViewModel } from '@/types/teamMembers/teamMembersGetResponse.types';
import logger from '@/utils/errorLogger';
import { SavedConfidence } from './useDeliveryConfidence';

interface UseProjectSettingsSubmitArgs {
  editMode: boolean;
  projectId: string | null;
  project: IProjectViewModel | null | undefined;
  selectedProjectManager: ITeamMemberViewModel | null;
  canAssignPm: boolean;
  canEditSettings: boolean;
  isEditable: boolean;
  hasFinanceAccess: boolean;
  savedConfidenceRef: MutableRefObject<SavedConfidence>;
  confidenceLoadedRef: MutableRefObject<boolean>;
}

/** Create or update the project from the settings form, then save the dependent settings. */
export const useProjectSettingsSubmit = ({
  editMode,
  projectId,
  project,
  selectedProjectManager,
  canAssignPm,
  canEditSettings,
  isEditable,
  hasFinanceAccess,
  savedConfidenceRef,
  confidenceLoadedRef,
}: UseProjectSettingsSubmitArgs) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { trackMixpanelEvent } = useMixpanelTracking();
  const { t } = useTranslation('project-drawer');
  const { t: tCommon } = useTranslation('common');

  const { requestParams } = useAppSelector(state => state.projectsReducer);
  const { navigateToProjectOnUpdate } = useAppSelector(state => state.projectSettingsModalReducer);

  const { refetch: refetchProjects } = useGetProjectsQuery(requestParams);
  const [updateProject, { isLoading: isUpdatingProject }] = useUpdateProjectMutation();
  const [createProject, { isLoading: isCreatingProject }] = useCreateProjectMutation();

  const handleFormSubmit = async (values: any) => {
    try {
      const csrfToken = await ensureCsrfToken();

      if (!csrfToken) {
        notification.error({
          message: tCommon('error.title', { defaultValue: 'Error' }),
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
        ...(canAssignPm ? { finance_access: values.finance_access !== false } : {}),
        use_manual_progress: Boolean(values.use_manual_progress),
        use_weighted_progress: Boolean(values.use_weighted_progress),
        use_time_progress: Boolean(values.use_time_progress),
        auto_assign_task_creator: Boolean(values.auto_assign_task_creator),
        restrict_task_creation: Boolean(values.restrict_task_creation),
        phase_assignees_enabled: Boolean(values.phase_assignees_enabled),
        members_can_view_client_team: Boolean(values.members_can_view_client_team),
        auto_assign_subtask_phase: Boolean(values.auto_assign_subtask_phase),
        ...(canEditSettings
          ? { restrict_tasks_to_assignee: Boolean(values.restrict_tasks_to_assignee) }
          : {}),
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

        if (editMode && projectId && hasFinanceAccess) {
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

        if (editMode && projectId && isEditable && confidenceLoadedRef.current) {
          const rawStatus = values.delivery_confidence;
          const nextStatus = !rawStatus || rawStatus === 'unset' ? null : rawStatus;
          const nextNote =
            typeof values.delivery_confidence_note === 'string' &&
            values.delivery_confidence_note.trim()
              ? values.delivery_confidence_note.trim()
              : null;
          const saved = savedConfidenceRef.current;
          if (nextStatus !== saved.status || nextNote !== saved.note) {
            try {
              const confidenceResponse = await progressTrackingApiService.updateConfidence(
                projectId,
                {
                  status: nextStatus,
                  note: nextNote,
                }
              );
              if (!confidenceResponse.done) {
                notification.error({
                  message: t('deliveryConfidenceSaveFailed', {
                    defaultValue: 'Could not save Delivery Confidence.',
                  }),
                });
              }
            } catch (error) {
              logger.error('Error saving delivery confidence', error);
              notification.error({
                message: t('deliveryConfidenceSaveFailed', {
                  defaultValue: 'Could not save Delivery Confidence.',
                }),
              });
            }
          }
        }

        if (!editMode) {
          trackMixpanelEvent(evt_projects_create);
          dispatch(closeProjectSettingsModal());
          navigate(
            `/worklenz/projects/${response.data.body.id}?tab=tasks-list&pinned_tab=tasks-list`
          );
          setTimeout(() => {
            window.location.reload();
          }, 100);
          return;
        }

        dispatch(closeProjectSettingsModal());
        refetchProjects();

        if (navigateToProjectOnUpdate && projectId) {
          navigate(`/worklenz/projects/${projectId}?tab=tasks-list&pinned_tab=tasks-list`);
          setTimeout(() => {
            window.location.reload();
          }, 100);
          return;
        }

        window.location.reload();
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

  return { handleFormSubmit, isSaving: isCreatingProject || isUpdatingProject };
};
