import type { StatusCategoryOrder } from '@/types/project/status-category-order.types';
import type { ITaskStatus } from '@/types/tasks/taskStatus.types';
import type { Task, TaskGroup } from '@/types/task-management.types';

type CategoryStatus = Pick<ITaskStatus, 'category_id'> | Pick<TaskGroup, 'category_id'>;

export const getCategoryRank = (
  status: CategoryStatus | null | undefined,
  order: readonly string[]
): number => {
  const rank = order.indexOf(status?.category_id ?? '');
  return rank === -1 ? order.length : rank;
};

export const sortStatusesByCategory = (
  statuses: ITaskStatus[],
  order: StatusCategoryOrder
): ITaskStatus[] => {
  const statusPosition = new Map(statuses.map((status, index) => [status.id, index]));

  return [...statuses].sort((a, b) => {
    const categoryDifference = getCategoryRank(a, order) - getCategoryRank(b, order);
    if (categoryDifference !== 0) return categoryDifference;
    return (statusPosition.get(a.id) ?? 0) - (statusPosition.get(b.id) ?? 0);
  });
};

export const sortStatusGroupsByCategory = (
  groups: TaskGroup[],
  statuses: ITaskStatus[],
  order: StatusCategoryOrder
): TaskGroup[] => {
  const originalIndex = new Map(groups.map((group, index) => [group.id, index]));
  const statusPosition = new Map(statuses.map((status, index) => [status.id, index]));
  const statusById = new Map(statuses.map(status => [status.id, status]));

  return [...groups].sort((a, b) => {
    const categoryDifference =
      getCategoryRank(statusById.get(a.id) ?? a, order) -
      getCategoryRank(statusById.get(b.id) ?? b, order);
    if (categoryDifference !== 0) return categoryDifference;

    const aPosition = statusPosition.get(a.id) ?? originalIndex.get(a.id) ?? 0;
    const bPosition = statusPosition.get(b.id) ?? originalIndex.get(b.id) ?? 0;
    return aPosition - bPosition;
  });
};

export const filterEmptyStatusGroups = (
  groups: TaskGroup[],
  visibleTaskIds: ReadonlySet<string>
): TaskGroup[] => groups.filter(group => group.taskIds.some(taskId => visibleTaskIds.has(taskId)));

export const getDoneStatusGroupIds = (
  groups: TaskGroup[],
  statuses: ITaskStatus[]
): Set<string> => {
  const statusesById = new Map(
    statuses.filter(status => status.id).map(status => [status.id as string, status])
  );
  const doneCategoryIds = new Set(
    statuses.filter(status => status.is_done && status.category_id).map(status => status.category_id)
  );

  return new Set(
    groups
      .filter(group => {
        const statusId = group.id.replace(/^status-/, '');
        const status = statusesById.get(group.id) ?? statusesById.get(statusId);
        const categoryId = status?.category_id ?? group.category_id;
        return categoryId !== undefined && doneCategoryIds.has(categoryId);
      })
      .map(group => group.id)
  );
};

export const getCollapsedGroupIds = (
  groups: TaskGroup[],
  doneStatusGroupIds: ReadonlySet<string>,
  persistedCollapsedGroups: ReadonlySet<string>,
  groupCollapseOverrides: Readonly<Record<string, { collapsed: boolean }>>
): Set<string> =>
  new Set(
    groups
      .filter(group => {
        const override = groupCollapseOverrides[group.id]?.collapsed;
        return override ?? (persistedCollapsedGroups.has(group.id) || doneStatusGroupIds.has(group.id));
      })
      .map(group => group.id)
  );

const normalizeStatusName = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '');

const getStatusForTask = (
  task: Task,
  statusesById: Map<string | undefined, ITaskStatus>,
  statusesByName: Map<string, ITaskStatus>
) => statusesById.get(task.status) ?? statusesByName.get(normalizeStatusName(task.status));

export const sortTasksByStatusCategory = (
  tasks: Task[],
  statuses: ITaskStatus[],
  order: StatusCategoryOrder,
  direction: 'ASC' | 'DESC' = 'ASC'
): Task[] => {
  const statusesById = new Map(statuses.map(status => [status.id, status]));
  const statusesByName = new Map(
    statuses.map(status => [normalizeStatusName(status.name ?? ''), status])
  );
  const statusPosition = new Map(statuses.map((status, index) => [status.id, index]));
  const originalPosition = new Map(tasks.map((task, index) => [task.id, index]));
  const sortDirection = direction === 'ASC' ? 1 : -1;

  return [...tasks].sort((a, b) => {
    const aStatus = getStatusForTask(a, statusesById, statusesByName);
    const bStatus = getStatusForTask(b, statusesById, statusesByName);
    const categoryDifference = getCategoryRank(aStatus, order) - getCategoryRank(bStatus, order);
    if (categoryDifference !== 0) return categoryDifference * sortDirection;

    const aStatusPosition = statusPosition.get(aStatus?.id) ?? Number.MAX_SAFE_INTEGER;
    const bStatusPosition = statusPosition.get(bStatus?.id) ?? Number.MAX_SAFE_INTEGER;
    const statusDifference = aStatusPosition - bStatusPosition;
    if (statusDifference !== 0) return statusDifference * sortDirection;

    return (
      (a.order ?? 0) - (b.order ?? 0) ||
      (originalPosition.get(a.id) ?? 0) - (originalPosition.get(b.id) ?? 0)
    );
  });
};
