import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  CloseOutlined,
  Empty,
  Flex,
  OrderedListOutlined,
  PlusOutlined,
  ThunderboltOutlined,
} from '@/shared/antd-imports';
import { useParams } from 'react-router-dom';
import { useStore } from 'react-redux';

import { useAuthService } from '@/hooks/useAuth';
import useIsProjectManager from '@/hooks/useIsProjectManager';
import { useSprintActions } from '@/hooks/useSprintActions';
import TaskListV2 from '@/components/task-list-v2/TaskListV2';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  setLabels,
  setMembers,
  setPhases,
  setPriorities,
  setStatuses,
} from '@/features/tasks/tasks.slice';
import {
  GroupingType,
  selectCurrentGrouping,
  setCurrentGrouping,
} from '@/features/task-management/grouping.slice';
import {
  fetchTasksV3,
  setArchived,
  setSearch,
} from '@/features/task-management/task-management.slice';
import type { RootState } from '@/app/store';
import type { ITaskStatusViewModel } from '@/types/tasks/taskStatusGetResponse.types';
import { fetchPhasesByProjectId } from '@/features/projects/singleProject/phase/phases.slice';
import { UNMAPPED_PHASE_ID } from '@/features/task-management/task-list-mode-context';
import {
  fetchProjectEpics,
  setEpicFilter,
} from '@/features/projects/singleProject/epics/epics.slice';
import { EpicsDrawer } from '@/components/projects/epics/epics-drawer';
import { PointScaleModal } from '@/components/projects/story-points/point-scale-modal';

/**
 * Software-project Backlog: issues with no sprint/phase assignment, or all open
 * sprints plus the backlog when grouped by Sprint.
 * Reuses TaskListV2 with a pinned phase filter.
 */
export const ProjectViewBacklog = () => {
  const { t } = useTranslation('project-view');
  const dispatch = useAppDispatch();
  const { projectId } = useParams();
  const previousPhasesRef = useRef<string[] | null>(null);
  const previousGroupingRef = useRef<GroupingType | null>(null);
  const phases = useAppSelector(state => state.taskReducer.phases);
  const currentGrouping = useAppSelector(selectCurrentGrouping);
  const error = useAppSelector(state => state.taskManagement.error);
  const { phaseList } = useAppSelector(state => state.phaseReducer);
  const isGuest = useAppSelector(state => state.projectReducer.project?.is_guest === true);
  const isOwnerOrAdmin = useAuthService().isOwnerOrAdmin();
  const isProjectManager = useIsProjectManager();
  const canManageSprints = (isOwnerOrAdmin || isProjectManager) && !isGuest;
  const { createSprint } = useSprintActions(projectId);
  const [isCreatingSprint, setIsCreatingSprint] = useState(false);
  const [isEpicsDrawerOpen, setIsEpicsDrawerOpen] = useState(false);
  const [isPointScaleOpen, setIsPointScaleOpen] = useState(false);
  const epics = useAppSelector(state => state.epicsReducer.epics);
  const filterEpicId = useAppSelector(state => state.epicsReducer.filterEpicId);
  const filteredEpic = filterEpicId ? epics.find(epic => epic.id === filterEpicId) : undefined;
  const reduxStore = useStore<RootState>();

  // The Backlog has no filter bar, so filters set in the List tab are suspended while it is open.
  const clearListFilters = () => {
    const { taskReducer } = reduxStore.getState();
    dispatch(setSearch(''));
    dispatch(setArchived(false));
    dispatch(setPriorities([]));
    dispatch(setStatuses([]));
    dispatch(setLabels(taskReducer.labels.map(label => ({ ...label, selected: false }))));
    dispatch(
      setMembers(taskReducer.taskAssignees.map(member => ({ ...member, selected: false })))
    );
  };

  const restoreListFilters = (snapshot: ListFilterSnapshot) => {
    const { taskReducer } = reduxStore.getState();
    dispatch(setSearch(snapshot.search));
    dispatch(setArchived(snapshot.archived));
    dispatch(setPriorities(snapshot.priorities));
    dispatch(setStatuses(snapshot.statuses));
    dispatch(
      setLabels(
        taskReducer.labels.map(label => ({
          ...label,
          selected: !!label.id && snapshot.selectedLabelIds.includes(label.id),
        }))
      )
    );
    dispatch(
      setMembers(
        taskReducer.taskAssignees.map(member => ({
          ...member,
          selected: !!member.id && snapshot.selectedMemberIds.includes(member.id),
        }))
      )
    );
  };

  useEffect(() => {
    previousPhasesRef.current = phases;
    previousGroupingRef.current = currentGrouping;
    const previousFilters = captureListFilters(reduxStore.getState());
    clearListFilters();

    if (projectId) {
      void dispatch(fetchPhasesByProjectId(projectId));
      void dispatch(fetchProjectEpics(projectId));
    }

    return () => {
      const restorePhases = previousPhasesRef.current ?? [];
      const restoreGrouping = previousGroupingRef.current;
      dispatch(setEpicFilter(null));
      dispatch(setPhases(restorePhases.filter(id => id !== UNMAPPED_PHASE_ID)));
      if (restoreGrouping) {
        dispatch(setCurrentGrouping(restoreGrouping));
      }
      restoreListFilters(previousFilters);
    };
    // Intentionally run once on mount/unmount for this tab.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, projectId]);

  // Every open sprint is listed above the Backlog (no sprint) section.
  const backlogPhaseFilter = useMemo(() => {
    const openSprintIds = phaseList
      .filter(phase => phase.id && phase.sprint_status !== 'completed')
      .map(phase => phase.id);
    return [...openSprintIds, UNMAPPED_PHASE_ID];
  }, [phaseList]);

  // The Backlog is always grouped by sprint with the sprint filter pinned (also after a saved
  // preference loads or filters are cleared). Both are applied before a single fetch.
  useEffect(() => {
    const isGroupedBySprint = currentGrouping === 'phase';
    const isFilterApplied =
      phases.length === backlogPhaseFilter.length &&
      backlogPhaseFilter.every(id => phases.includes(id));
    if (isGroupedBySprint && isFilterApplied) return;

    if (!isGroupedBySprint) dispatch(setCurrentGrouping('phase'));
    if (!isFilterApplied) dispatch(setPhases(backlogPhaseFilter));
    if (projectId) {
      void dispatch(fetchTasksV3(projectId));
    }
  }, [backlogPhaseFilter, currentGrouping, dispatch, phases, projectId]);

  const handleCreateSprint = async () => {
    setIsCreatingSprint(true);
    await createSprint();
    setIsCreatingSprint(false);
  };

  const handleFilterEpic = (epicId: string | null) => {
    dispatch(setEpicFilter(epicId));
    if (epicId) setIsEpicsDrawerOpen(false);
    if (projectId) void dispatch(fetchTasksV3(projectId));
  };

  const handleClearEpicFilter = () => {
    handleFilterEpic(null);
  };

  const backlogActions = (
    <Flex align="center" gap={8} wrap="wrap" className="mb-2.5">
      {filteredEpic && (
        <Button
          size="small"
          color="primary"
          variant="outlined"
          icon={<CloseOutlined />}
          iconPosition="end"
          onClick={handleClearEpicFilter}
          aria-label={t('epicFilterClear', {
            defaultValue: 'Remove epic filter {{name}}',
            name: filteredEpic.name,
          })}
        >
          {t('epicFilterChip', { defaultValue: 'Epic: {{name}}', name: filteredEpic.name })}
        </Button>
      )}
      <Flex gap={8} className="ml-auto">
        {canManageSprints && (
          <Button
            size="small"
            icon={<OrderedListOutlined />}
            onClick={() => setIsPointScaleOpen(true)}
          >
            {t('pointScaleButton', { defaultValue: 'Point scale' })}
          </Button>
        )}
        <Button size="small" icon={<ThunderboltOutlined />} onClick={() => setIsEpicsDrawerOpen(true)}>
          {t('epicsTitle', { defaultValue: 'Epics' })}
        </Button>
        {canManageSprints && (
          <Button
            size="small"
            icon={<PlusOutlined />}
            loading={isCreatingSprint}
            onClick={handleCreateSprint}
          >
            {t('createSprint', { defaultValue: 'Create sprint' })}
          </Button>
        )}
      </Flex>
    </Flex>
  );

  return (
    <div className="flex flex-col">

      {projectId && (
        <EpicsDrawer
          open={isEpicsDrawerOpen}
          projectId={projectId}
          canManage={canManageSprints}
          onClose={() => setIsEpicsDrawerOpen(false)}
          onFilterEpic={handleFilterEpic}
        />
      )}

      {projectId && (
        <PointScaleModal
          open={isPointScaleOpen}
          projectId={projectId}
          onClose={() => setIsPointScaleOpen(false)}
        />
      )}

      {error ? (
        <>
          {backlogActions}
          <Flex vertical align="center" justify="center" style={{ padding: 48 }}>
            <Empty
              description={t('backlogLoadError', {
                defaultValue: 'Could not load backlog. Please try again.',
              })}
            />
          </Flex>
        </>
      ) : (
        <TaskListV2 mode="backlog" belowToolbar={backlogActions} />
      )}
    </div>
  );
};

const captureListFilters = (state: RootState): ListFilterSnapshot => ({
  search: state.taskManagement.search ?? '',
  archived: state.taskManagement.archived,
  priorities: state.taskReducer.priorities,
  statuses: state.taskReducer.statuses,
  selectedLabelIds: state.taskReducer.labels
    .filter(label => label.selected && label.id)
    .map(label => label.id as string),
  selectedMemberIds: state.taskReducer.taskAssignees
    .filter(member => member.selected && member.id)
    .map(member => member.id as string),
});

interface ListFilterSnapshot {
  search: string;
  archived: boolean;
  priorities: string[];
  statuses: ITaskStatusViewModel[];
  selectedLabelIds: string[];
  selectedMemberIds: string[];
}

export default ProjectViewBacklog;
