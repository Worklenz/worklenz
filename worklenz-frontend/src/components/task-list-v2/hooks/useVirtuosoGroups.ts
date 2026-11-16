import type { ITaskStatus } from '@/types/tasks/taskStatus.types';
import type { StatusCategoryOrder } from '@/types/project/status-category-order.types';
import {
  sortStatusGroupsByCategory,
  sortTasksByStatusCategory,
} from '@/utils/status-category-order';
import { useMemo } from 'react';
import { UNMAPPED_PHASE_ID } from '@/features/task-management/task-list-mode-context';
import { Task, TaskGroup } from '@/types/task-management.types';
import { ITaskPhase } from '@/types/tasks/taskPhase.types';
import { AddTaskRowItem } from '../constants/columns';

interface UseVirtuosoGroupsOptions {
  groups: TaskGroup[];
  allTasks: Task[];
  collapsedGroups: Set<string>;
  currentGrouping: string | null;
  urlProjectId?: string;
  insertAnchor: { groupId: string; afterTaskId: string | null } | null;
  isBacklogMode: boolean;
  isSoftwareProject: boolean;
  phaseList: ITaskPhase[];
  statuses?: ITaskStatus[];
  statusCategoryOrder?: StatusCategoryOrder;
  sortField?: string | null;
  sortOrder?: 'ASC' | 'DESC';
}

const EMPTY_STATUSES: ITaskStatus[] = [];
const EMPTY_CATEGORY_ORDER: StatusCategoryOrder = [];

export const useVirtuosoGroups = ({
  groups,
  allTasks,
  collapsedGroups,
  currentGrouping,
  urlProjectId,
  insertAnchor,
  isBacklogMode,
  isSoftwareProject,
  phaseList,
  statuses = EMPTY_STATUSES,
  statusCategoryOrder = EMPTY_CATEGORY_ORDER,
  sortField,
  sortOrder = 'ASC',
}: UseVirtuosoGroupsOptions) =>
  useMemo(() => {
    let currentTaskIndex = 0;
    const taskLookup = new Map(allTasks.map((task, index) => [task.id, { task, index }]));

    // Keep every configured status group, including empty ones, so users can add
    // tasks into statuses that do not yet have any work.
    const categoryOrderedGroups =
      currentGrouping === 'status'
        ? sortStatusGroupsByCategory(groups, statuses, statusCategoryOrder)
        : groups;

    // Software backlog: always keep Backlog (Unmapped), even when empty; active sprint first.
    const orderedGroups =
      isBacklogMode && isSoftwareProject
        ? (() => {
            const hasBacklog = groups.some(group => group.id === UNMAPPED_PHASE_ID);
            const withBacklog = hasBacklog
              ? groups
              : [
                  ...groups,
                  {
                    id: UNMAPPED_PHASE_ID,
                    title: UNMAPPED_PHASE_ID,
                    taskIds: [] as string[],
                    type: 'phase' as const,
                    color: '#fbc84c69',
                    groupValue: UNMAPPED_PHASE_ID.toLowerCase(),
                  },
                ];
            return [...withBacklog].sort((a, b) => {
              if (a.id === UNMAPPED_PHASE_ID) return 1;
              if (b.id === UNMAPPED_PHASE_ID) return -1;
              const aStatus = phaseList.find(phase => phase.id === a.id)?.sprint_status;
              const bStatus = phaseList.find(phase => phase.id === b.id)?.sprint_status;
              const rank = (status?: string | null) =>
                status === 'active' ? 0 : status === 'planned' ? 1 : 2;
              return rank(aStatus) - rank(bStatus);
            });
          })()
        : categoryOrderedGroups;

    return orderedGroups.map(group => {
      const isCurrentGroupCollapsed = collapsedGroups.has(group.id);

      const visibleTasks = isCurrentGroupCollapsed
        ? []
        : group.taskIds.flatMap(taskId => {
            const entry = taskLookup.get(taskId);
            return entry ? [entry.task] : [];
          });
      const orderedTasks =
        currentGrouping !== 'status' && sortField === 'status'
          ? sortTasksByStatusCategory(visibleTasks, statuses, statusCategoryOrder, sortOrder)
          : visibleTasks;
      const tasksForVirtuoso = orderedTasks.map(task => ({
        ...task,
        originalIndex: taskLookup.get(task.id)!.index,
      }));

      const addTaskItem: AddTaskRowItem = {
        id: `add-task-${group.id}-0`,
        isAddTaskRow: true,
        groupId: group.id,
        groupType: currentGrouping || 'status',
        groupValue: group.id, // Send the UUID that backend expects
        projectId: urlProjectId,
        rowId: `add-task-${group.id}-0`,
        autoFocus: false,
        isInsertMode: insertAnchor?.groupId === group.id && !!insertAnchor?.afterTaskId,
        insertAfterTaskId:
          insertAnchor?.groupId === group.id ? (insertAnchor.afterTaskId ?? null) : null,
      };

      let itemsWithAddTask: Array<(Task & { originalIndex: number }) | AddTaskRowItem> =
        tasksForVirtuoso;
      if (!isCurrentGroupCollapsed) {
        if (insertAnchor?.groupId === group.id && insertAnchor.afterTaskId) {
          const anchorIndex = tasksForVirtuoso.findIndex(
            task => task.id === insertAnchor.afterTaskId
          );
          if (anchorIndex >= 0) {
            const next: Array<(Task & { originalIndex: number }) | AddTaskRowItem> = [
              ...tasksForVirtuoso,
            ];
            next.splice(anchorIndex + 1, 0, addTaskItem);
            itemsWithAddTask = next;
          } else {
            itemsWithAddTask = [...tasksForVirtuoso, addTaskItem];
          }
        } else {
          itemsWithAddTask = [...tasksForVirtuoso, addTaskItem];
        }
      }

      const groupData = {
        ...group,
        tasks: itemsWithAddTask,
        startIndex: currentTaskIndex,
        count: itemsWithAddTask.length,
        actualCount: group.taskIds.length,
        groupValue: group.groupValue || group.title,
      };
      currentTaskIndex += itemsWithAddTask.length;
      return groupData;
    });
  }, [
    groups,
    allTasks,
    collapsedGroups,
    currentGrouping,
    urlProjectId,
    insertAnchor,
    isBacklogMode,
    isSoftwareProject,
    phaseList,
    statuses,
    statusCategoryOrder,
    sortField,
    sortOrder,
  ]);

export type VirtuosoGroupItem = ReturnType<typeof useVirtuosoGroups>[number];
