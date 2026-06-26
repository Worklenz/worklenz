import { useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { clearSelection } from '@/features/task-management/selection.slice';
import { fetchTasksV3 } from '@/features/task-management/task-management.slice';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { taskListBulkActionsApiService } from '@/api/tasks/task-list-bulk-actions.api.service';
import { fetchLabels } from '@/features/taskAttributes/taskLabelSlice';
import { checkTaskDependencyStatus } from '@/utils/check-task-dependency-status';
import alertService from '@/services/alerts/alertService';
import logger from '@/utils/errorLogger';
import {
  evt_project_task_list_bulk_archive,
  evt_project_task_list_bulk_assign_me,
  evt_project_task_list_bulk_assign_members,
  evt_project_task_list_bulk_change_phase,
  evt_project_task_list_bulk_change_priority,
  evt_project_task_list_bulk_change_status,
  evt_project_task_list_bulk_delete,
  evt_project_task_list_bulk_update_labels,
  evt_project_task_list_bulk_change_due_date,
} from '@/shared/worklenz-analytics-events';
import {
  IBulkTasksLabelsRequest,
  IBulkTasksPhaseChangeRequest,
  IBulkTasksPriorityChangeRequest,
  IBulkTasksStatusChangeRequest,
  IBulkTasksDueDateChangeRequest,
} from '@/types/tasks/bulk-action-bar.types';
import { ITaskLabel } from '@/types/tasks/taskLabel.types';
import { ITeamMemberViewModel } from '@/types/teamMembers/teamMembersGetResponse.types';
import { ITaskAssignee } from '@/types/tasks/task.types';

export const useBulkActions = () => {
  const dispatch = useAppDispatch();
  const { projectId } = useParams();
  const { trackMixpanelEvent } = useMixpanelTracking();
  const { t } = useTranslation('task-list-table');

  // FIX: Get archived state from taskManagement slice instead of taskReducer
  const archived = useAppSelector(state => state.taskManagement.archived);

  // Loading states for individual actions
  const [loadingStates, setLoadingStates] = useState({
    status: false,
    priority: false,
    phase: false,
    assignToMe: false,
    assignMembers: false,
    labels: false,
    archive: false,
    delete: false,
    duplicate: false,
    export: false,
    dueDate: false,
    startDate: false,
  });

  // Helper function to update loading state
  const updateLoadingState = useCallback((action: keyof typeof loadingStates, loading: boolean) => {
    setLoadingStates(prev => ({ ...prev, [action]: loading }));
  }, []);

  // Helper function to refetch tasks after bulk action
  const refetchTasks = useCallback(() => {
    if (projectId) {
      dispatch(fetchTasksV3(projectId));
    }
  }, [dispatch, projectId]);

  const handleClearSelection = useCallback(() => {
    dispatch(clearSelection());
  }, [dispatch]);

  const handleBulkStatusChange = useCallback(
    async (statusId: string, selectedTaskIds: string[]) => {
      if (!statusId || !projectId || !selectedTaskIds.length) return;

      try {
        updateLoadingState('status', true);

        // Check task dependencies before proceeding
        for (const taskId of selectedTaskIds) {
          const canContinue = await checkTaskDependencyStatus(taskId, statusId);
          if (!canContinue) {
            if (selectedTaskIds.length > 1) {
              alertService.warning(
                t('errors.incompleteDependencies', { defaultValue: 'Incomplete Dependencies!' }),
                t('errors.someDependenciesNotCompleted', {
                  defaultValue:
                    'Some tasks were not updated. Please ensure all dependent tasks are completed before proceeding.',
                })
              );
            } else {
              alertService.error(
                t('errors.taskNotCompleted', { defaultValue: 'Task is not completed' }),
                t('errors.completeTaskDependencies', {
                  defaultValue: 'Please complete the task dependencies before proceeding',
                })
              );
            }
            return;
          }
        }

        const body: IBulkTasksStatusChangeRequest = {
          tasks: selectedTaskIds,
          status_id: statusId,
        };

        const res = await taskListBulkActionsApiService.changeStatus(body, projectId);
        if (res.done) {
          trackMixpanelEvent(evt_project_task_list_bulk_change_status);
          dispatch(clearSelection());
          refetchTasks();
        }
      } catch (error) {
        logger.error('Error changing status:', error);
      } finally {
        updateLoadingState('status', false);
      }
    },
    [projectId, trackMixpanelEvent, dispatch, refetchTasks, updateLoadingState, t]
  );

  const handleBulkPriorityChange = useCallback(
    async (priorityId: string, selectedTaskIds: string[]) => {
      if (!priorityId || !projectId || !selectedTaskIds.length) return;

      try {
        updateLoadingState('priority', true);

        const body: IBulkTasksPriorityChangeRequest = {
          tasks: selectedTaskIds,
          priority_id: priorityId,
        };

        const res = await taskListBulkActionsApiService.changePriority(body, projectId);
        if (res.done) {
          trackMixpanelEvent(evt_project_task_list_bulk_change_priority);
          dispatch(clearSelection());
          refetchTasks();
        }
      } catch (error) {
        logger.error('Error changing priority:', error);
      } finally {
        updateLoadingState('priority', false);
      }
    },
    [projectId, trackMixpanelEvent, dispatch, refetchTasks, updateLoadingState]
  );

  const handleBulkPhaseChange = useCallback(
    async (phaseId: string, selectedTaskIds: string[]) => {
      if (!phaseId || !projectId || !selectedTaskIds.length) return;

      try {
        updateLoadingState('phase', true);

        const body: IBulkTasksPhaseChangeRequest = {
          tasks: selectedTaskIds,
          phase_id: phaseId,
        };

        const res = await taskListBulkActionsApiService.changePhase(body, projectId);
        if (res.done) {
          trackMixpanelEvent(evt_project_task_list_bulk_change_phase);
          dispatch(clearSelection());
          refetchTasks();
        }
      } catch (error) {
        logger.error('Error changing phase:', error);
      } finally {
        updateLoadingState('phase', false);
      }
    },
    [projectId, trackMixpanelEvent, dispatch, refetchTasks, updateLoadingState]
  );

  const handleBulkAssignToMe = useCallback(
    async (selectedTaskIds: string[]) => {
      if (!projectId || !selectedTaskIds.length) return;

      try {
        updateLoadingState('assignToMe', true);

        const body = {
          tasks: selectedTaskIds,
          project_id: projectId,
        };

        const res = await taskListBulkActionsApiService.assignToMe(body);
        if (res.done) {
          trackMixpanelEvent(evt_project_task_list_bulk_assign_me);
          dispatch(clearSelection());
          refetchTasks();
        }
      } catch (error) {
        logger.error('Error assigning to me:', error);
      } finally {
        updateLoadingState('assignToMe', false);
      }
    },
    [projectId, trackMixpanelEvent, dispatch, refetchTasks, updateLoadingState]
  );

  const handleBulkAssignMembers = useCallback(
    async (memberIds: string[], selectedTaskIds: string[]) => {
      if (!projectId || !selectedTaskIds.length) return;

      try {
        updateLoadingState('assignMembers', true);

        // Convert memberIds to member objects - this would need to be handled by the component
        // For now, we'll just pass the IDs and let the API handle it
        const body = {
          tasks: selectedTaskIds,
          project_id: projectId,
          members: memberIds.map(id => ({
            id: id,
            name: '',
            team_member_id: id,
            project_member_id: id,
          })) as ITaskAssignee[],
        };

        const res = await taskListBulkActionsApiService.assignTasks(body);
        if (res.done) {
          trackMixpanelEvent(evt_project_task_list_bulk_assign_members);
          dispatch(clearSelection());
          refetchTasks();
        }
      } catch (error) {
        logger.error('Error assigning tasks:', error);
      } finally {
        updateLoadingState('assignMembers', false);
      }
    },
    [projectId, trackMixpanelEvent, dispatch, refetchTasks, updateLoadingState]
  );

  const handleBulkAddLabels = useCallback(
    async (labelIds: string[], selectedTaskIds: string[]) => {
      if (!projectId || !selectedTaskIds.length) return;

      try {
        updateLoadingState('labels', true);

        // Convert labelIds to label objects - this would need to be handled by the component
        // For now, we'll just pass the IDs and let the API handle it
        const body: IBulkTasksLabelsRequest = {
          tasks: selectedTaskIds,
          labels: labelIds.map(id => ({ id, name: '', color: '' })) as ITaskLabel[],
          text: null,
        };

        const res = await taskListBulkActionsApiService.assignLabels(body, projectId);
        if (res.done) {
          trackMixpanelEvent(evt_project_task_list_bulk_update_labels);
          dispatch(clearSelection());
          dispatch(fetchLabels()); // Refetch labels in case new ones were created
          refetchTasks();
        }
      } catch (error) {
        logger.error('Error updating labels:', error);
      } finally {
        updateLoadingState('labels', false);
      }
    },
    [projectId, trackMixpanelEvent, dispatch, refetchTasks, updateLoadingState]
  );

  const handleBulkArchive = useCallback(
    async (selectedTaskIds: string[]) => {
      if (!projectId || !selectedTaskIds.length) return;

      try {
        updateLoadingState('archive', true);

        const body = {
          tasks: selectedTaskIds,
          project_id: projectId,
        };

        // Pass archived state to API - when archived=true, it will unarchive
        const res = await taskListBulkActionsApiService.archiveTasks(body, archived);
        if (res.done) {
          trackMixpanelEvent(evt_project_task_list_bulk_archive);
          dispatch(clearSelection());
          // Don't refetch tasks immediately - they'll disappear from current view
          // Tasks will appear in correct list when user switches archive filter
          refetchTasks();
        }
      } catch (error) {
        logger.error('Error archiving tasks:', error);
      } finally {
        updateLoadingState('archive', false);
      }
    },
    [projectId, archived, trackMixpanelEvent, dispatch, refetchTasks, updateLoadingState]
  );

  const handleBulkDelete = useCallback(
    async (selectedTaskIds: string[]) => {
      if (!projectId || !selectedTaskIds.length) return;

      try {
        updateLoadingState('delete', true);

        const body = {
          tasks: selectedTaskIds,
          project_id: projectId,
        };

        const res = await taskListBulkActionsApiService.deleteTasks(body, projectId);
        if (res.done) {
          trackMixpanelEvent(evt_project_task_list_bulk_delete);
          dispatch(clearSelection());
          refetchTasks();
        }
      } catch (error) {
        logger.error('Error deleting tasks:', error);
      } finally {
        updateLoadingState('delete', false);
      }
    },
    [projectId, trackMixpanelEvent, dispatch, refetchTasks, updateLoadingState]
  );

  const handleBulkDuplicate = useCallback(
    async (selectedTaskIds: string[]) => {
      if (!projectId || !selectedTaskIds.length) return;

      try {
        updateLoadingState('duplicate', true);
        // TODO: Implement bulk duplicate API call when available
        // For now, just clear selection and refetch
        dispatch(clearSelection());
        refetchTasks();
      } catch (error) {
        logger.error('Error duplicating tasks:', error);
      } finally {
        updateLoadingState('duplicate', false);
      }
    },
    [projectId, dispatch, refetchTasks, updateLoadingState]
  );

  const handleBulkExport = useCallback(
    async (selectedTaskIds: string[]) => {
      if (!projectId || !selectedTaskIds.length) return;

      try {
        updateLoadingState('export', true);
        // TODO: Implement bulk export API call when available
      } catch (error) {
        logger.error('Error exporting tasks:', error);
      } finally {
        updateLoadingState('export', false);
      }
    },
    [projectId, updateLoadingState]
  );

  const handleBulkSetDueDate = useCallback(
    async (date: string, selectedTaskIds: string[]) => {
      if (!projectId || !selectedTaskIds.length) return;

      try {
        updateLoadingState('dueDate', true);

        const body: IBulkTasksDueDateChangeRequest = {
          tasks: selectedTaskIds,
          end_date: date || null,
        };

        const res = await taskListBulkActionsApiService.changeDueDate(body, projectId);
        if (res.done) {
          trackMixpanelEvent(evt_project_task_list_bulk_change_due_date);
          dispatch(clearSelection());
          refetchTasks();
          // alertService.success(
          //   date ? 'Due date updated' : 'Due date cleared',
          //   date ? 'Due date has been set for selected tasks' : 'Due date has been cleared for selected tasks'
          // );
        }
      } catch (error) {
        logger.error('Error setting due date:', error);
        alertService.error('Error', 'Failed to update due date');
      } finally {
        updateLoadingState('dueDate', false);
      }
    },
    [projectId, trackMixpanelEvent, dispatch, refetchTasks, updateLoadingState]
  );

  const handleBulkSetStartDate = useCallback(
    async (date: string, selectedTaskIds: string[]) => {
      if (!projectId || !selectedTaskIds.length) return;

      try {
        updateLoadingState('startDate', true);

        const body: IBulkTasksDueDateChangeRequest = {
          tasks: selectedTaskIds,
          start_date: date || null,
        };

        const res = await taskListBulkActionsApiService.changeStartDate(body, projectId);
        console.log('START DATE RESPONSE:', res); // temporary log
        if (res.done) {
          trackMixpanelEvent(evt_project_task_list_bulk_change_due_date);
          dispatch(clearSelection());
          await dispatch(fetchTasksV3(projectId)); // wait for refetch to complete
        } else {
          console.log('res.done is false — API did not return done:true');
          alertService.error('Error', 'Failed to update start date');
        }
      } catch (error) {
        logger.error('Error setting start date:', error);
        alertService.error('Error', 'Failed to update start date');
      } finally {
        updateLoadingState('startDate', false);
      }
    },
    [projectId, trackMixpanelEvent, dispatch, updateLoadingState]
  );

  return {
    handleClearSelection,
    handleBulkStatusChange,
    handleBulkPriorityChange,
    handleBulkPhaseChange,
    handleBulkAssignToMe,
    handleBulkAssignMembers,
    handleBulkAddLabels,
    handleBulkArchive,
    handleBulkDelete,
    handleBulkDuplicate,
    handleBulkExport,
    handleBulkSetDueDate,
    handleBulkSetStartDate,
    loadingStates,
  };
};
