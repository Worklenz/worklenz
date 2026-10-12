import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Select, Typography, message } from '@/shared/antd-imports';

import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  addPhaseWithDates,
  completeSprint as completeSprintThunk,
  fetchPhasesByProjectId,
  startSprint as startSprintThunk,
} from '@/features/projects/singleProject/phase/phases.slice';
import { fetchTasksV3 } from '@/features/task-management/task-management.slice';
import { fetchEnhancedKanbanGroups } from '@/features/enhanced-kanban/enhanced-kanban.slice';
import { getSoftwareProjectLabels } from '@/lib/project/software-project';
import { ITaskPhase } from '@/types/tasks/taskPhase.types';

/**
 * Sprint lifecycle actions (create, start, complete) shared by the Backlog sprint
 * headers and the Manage Sprints panel. Callers of `completeSprint` must render
 * `sprintModalContextHolder` so the confirm dialog inherits the app theme.
 */
export const useSprintActions = (projectId?: string | null) => {
  const { t } = useTranslation('phases-drawer');
  const dispatch = useAppDispatch();
  const [modal, sprintModalContextHolder] = Modal.useModal();
  const project = useAppSelector(state => state.projectReducer.project);
  const phaseList = useAppSelector(state => state.phaseReducer.phaseList);
  const softwareLabels = getSoftwareProjectLabels(project?.project_type);
  const autoArchiveDone = project?.auto_archive_on_sprint_complete !== false;

  const refreshSprintData = useCallback(async () => {
    if (!projectId) return;
    await Promise.all([
      dispatch(fetchPhasesByProjectId(projectId)),
      dispatch(fetchTasksV3(projectId)),
      dispatch(fetchEnhancedKanbanGroups(projectId)),
    ]);
  }, [dispatch, projectId]);

  const startSprint = useCallback(
    async (phaseId: string): Promise<boolean> => {
      if (!projectId) return false;
      try {
        await dispatch(startSprintThunk({ phaseId, projectId })).unwrap();
        message.success(t('sprintStarted', { defaultValue: 'Sprint started' }));
        await refreshSprintData();
        return true;
      } catch (error: unknown) {
        message.error(
          getErrorMessage(error) || t('sprintStartError', { defaultValue: 'Could not start sprint' })
        );
        return false;
      }
    },
    [dispatch, projectId, refreshSprintData, t]
  );

  const completeSprint = useCallback(
    (phaseId: string, incompleteCount?: number) => {
      if (!projectId) return;
      const sprintName = phaseList.find(phase => phase.id === phaseId)?.name ?? '';

      const plannedSprints = phaseList.filter(
        phase => phase.id !== phaseId && phase.sprint_status === 'planned'
      );
      let destination: string | null = null;

      modal.confirm({
        title: sprintName
          ? t('completeSprintNamedTitle', { defaultValue: 'Complete {{name}}', name: sprintName })
          : t('completeSprintTitle', { defaultValue: 'Complete sprint' }),
        content: (
          <div className="flex flex-col gap-3 mt-3">
            {incompleteCount !== undefined && (
              <Typography.Text strong>
                {t('completeSprintIncompleteCount', {
                  defaultValue: '{{count}} incomplete work item(s) must move to another destination.',
                  count: incompleteCount,
                })}
              </Typography.Text>
            )}
            <Typography.Text type="secondary">
              {autoArchiveDone
                ? t('completeSprintHintArchive', {
                    defaultValue:
                      'Incomplete issues will move to the destination you choose. Done issues will be archived.',
                  })
                : t('completeSprintHintKeep', {
                    defaultValue:
                      'Incomplete issues will move to the destination you choose. Done issues stay in this sprint.',
                  })}
            </Typography.Text>
            <div>
              <Typography.Text className="block mb-1.5 text-xs">
                {t('moveIncompleteTo', { defaultValue: 'Move incomplete work to' })}
              </Typography.Text>
              <Select
                defaultValue={BACKLOG_DESTINATION}
                className="w-full"
                aria-label={t('moveIncompleteTo', { defaultValue: 'Move incomplete work to' })}
                onChange={value => {
                  destination = value === BACKLOG_DESTINATION ? null : value;
                }}
                options={[
                  { value: BACKLOG_DESTINATION, label: softwareLabels.unmapped },
                  ...plannedSprints.map(phase => ({ value: phase.id, label: phase.name })),
                ]}
              />
            </div>
          </div>
        ),
        okText: t('completeSprintTitle', { defaultValue: 'Complete sprint' }),
        cancelText: t('cancel', { defaultValue: 'Cancel' }),
        onOk: async () => {
          try {
            const result = await dispatch(
              completeSprintThunk({ phaseId, projectId, destinationPhaseId: destination })
            ).unwrap();
            const archived = result?.body?.archived_count ?? 0;
            const moved = result?.body?.moved_count ?? 0;
            const destinationName = destination
              ? plannedSprints.find(phase => phase.id === destination)?.name ?? ''
              : softwareLabels.unmapped;

            const summaryParts = [t('sprintCompleted', { defaultValue: 'Sprint completed' })];
            if (moved > 0) {
              summaryParts.push(
                t('sprintIncompleteMoved', {
                  defaultValue: '{{count}} incomplete issue(s) moved to {{destination}}',
                  count: moved,
                  destination: destinationName,
                })
              );
            }
            if (archived > 0) {
              summaryParts.push(
                t('sprintDoneArchived', {
                  defaultValue: '{{count}} done issue(s) archived',
                  count: archived,
                })
              );
            }
            message.success(summaryParts.join('. '));
            await refreshSprintData();
          } catch (error: unknown) {
            message.error(
              getErrorMessage(error) ||
                t('sprintCompleteError', { defaultValue: 'Could not complete sprint' })
            );
            throw error;
          }
        },
      });
    },
    [autoArchiveDone, dispatch, modal, phaseList, projectId, refreshSprintData, softwareLabels.unmapped, t]
  );

  const createSprint = useCallback(async (): Promise<ITaskPhase | null> => {
    if (!projectId) return null;
    const name = t('newSprintName', {
      defaultValue: 'Sprint {{number}}',
      number: phaseList.length + 1,
    });
    try {
      const response = await dispatch(addPhaseWithDates({ projectId, name })).unwrap();
      message.success(t('sprintCreated', { defaultValue: '{{name}} created', name }));
      await refreshSprintData();
      return response?.body ?? null;
    } catch (error: unknown) {
      message.error(
        getErrorMessage(error) || t('sprintCreateError', { defaultValue: 'Could not create sprint' })
      );
      return null;
    }
  }, [dispatch, phaseList.length, projectId, refreshSprintData, t]);

  return { startSprint, completeSprint, createSprint, refreshSprintData, sprintModalContextHolder };
};

const getErrorMessage = (error: unknown): string | undefined =>
  (error as { message?: string } | undefined)?.message;

const BACKLOG_DESTINATION = 'backlog';
