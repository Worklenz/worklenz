import type { ITaskCustomColumn } from '@/types/tasks/task.types';
import { findParentColumn } from './cascading-selection';
import { getTaskCustomFieldDisplayName } from './task-custom-columns';

/** Both cascading selections and formula operands prevent changing a referenced field's type. */
export const getCustomColumnTypeDependentNames = (
  columns: ITaskCustomColumn[],
  columnId: string | null,
  columnKey?: string
): string[] => {
  if (!columnId) return [];
  const key = columnKey ?? columns.find(column => column.id === columnId)?.key;
  return columns.filter(column => {
    if (findParentColumn(column, columns)?.id === columnId) return true;
    const config = column.custom_column_obj;
    return Boolean(key && config?.fieldType === 'formula' &&
      (config.firstNumericColumnKey === key || config.secondNumericColumnKey === key));
  }).map(getTaskCustomFieldDisplayName);
};
