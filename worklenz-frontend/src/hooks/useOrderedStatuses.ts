import { useAppSelector } from '@/hooks/useAppSelector';
import { selectOrderedStatuses } from '@/features/taskAttributes/taskStatus.selectors';
import type { ITaskStatus } from '@/types/tasks/taskStatus.types';

/** Statuses for dropdowns/filters/menus in the project's configured category order. */
export const useOrderedStatuses = (): ITaskStatus[] => useAppSelector(selectOrderedStatuses);
