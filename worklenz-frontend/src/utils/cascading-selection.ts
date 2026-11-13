import {
  ITaskCustomColumn,
  ITaskCustomColumnSelectionOption,
  ITaskCustomColumnValue,
} from '@/types/tasks/task.types';

/**
 * Cascading (dependent) Selection custom fields.
 *
 * A Selection field may depend on one other Selection field (its parent). Each of its options
 * is grouped under one parent option via `parent_selection_id`. On a task, only the options
 * grouped under the task's current parent value can be picked.
 */

/** Type-dropdown value meaning "Selection field that depends on column <id>". */
export const DEPENDS_ON_TYPE_PREFIX = 'dependsOn:';

export const toDependsOnTypeValue = (parentColumnId: string) =>
  `${DEPENDS_ON_TYPE_PREFIX}${parentColumnId}`;

export const parseDependsOnTypeValue = (value: unknown): string | null =>
  typeof value === 'string' && value.startsWith(DEPENDS_ON_TYPE_PREFIX)
    ? value.slice(DEPENDS_ON_TYPE_PREFIX.length) || null
    : null;

export interface IDependentSelectionState {
  isDependent: boolean;
  parentColumn: ITaskCustomColumn | null;
  parentOption: ITaskCustomColumnSelectionOption | null;
  allowedOptions: ITaskCustomColumnSelectionOption[];
  /** Dependent field whose parent has no value on this task yet. */
  isAwaitingParent: boolean;
  /** Task holds a value that is not valid under its current parent value. */
  isCurrentValueInvalid: boolean;
}

const getColumnIdentifier = (column: ITaskCustomColumn) =>
  column.id || (column as ITaskCustomColumn & { uuid?: string }).uuid || '';

/** Task values may hold either the option name (UI writes) or its id (imports). */
export const findSelectionOption = (
  options: ITaskCustomColumnSelectionOption[],
  value: ITaskCustomColumnValue | undefined
): ITaskCustomColumnSelectionOption | null => {
  if (typeof value !== 'string' || !value) return null;
  return (
    options.find(option => option.selection_name === value) ||
    options.find(option => option.selection_id === value) ||
    null
  );
};

export const findParentColumn = (
  column: ITaskCustomColumn,
  columns: ITaskCustomColumn[]
): ITaskCustomColumn | null => {
  const config = column.custom_column_obj;
  if (config?.fieldType !== 'selection') return null;

  const { parentColumnId, parentColumnKey } = config;
  if (!parentColumnId && !parentColumnKey) return null;

  return (
    columns.find(
      candidate =>
        (parentColumnId && getColumnIdentifier(candidate) === parentColumnId) ||
        (parentColumnKey && candidate.key === parentColumnKey)
    ) || null
  );
};

export const getDependentSelectionState = (
  column: ITaskCustomColumn,
  columns: ITaskCustomColumn[],
  taskValues: Record<string, ITaskCustomColumnValue> | undefined
): IDependentSelectionState => {
  const options = column.custom_column_obj?.selectionsList || [];
  const parentColumn = findParentColumn(column, columns);

  if (!parentColumn) {
    return {
      isDependent: false,
      parentColumn: null,
      parentOption: null,
      allowedOptions: options,
      isAwaitingParent: false,
      isCurrentValueInvalid: false,
    };
  }

  const parentOption = findSelectionOption(
    parentColumn.custom_column_obj?.selectionsList || [],
    taskValues?.[parentColumn.key]
  );
  const allowedOptions = parentOption
    ? options.filter(option => option.parent_selection_id === parentOption.selection_id)
    : [];
  const currentValue = taskValues?.[column.key];
  const hasCurrentValue = typeof currentValue === 'string' && currentValue !== '';

  return {
    isDependent: true,
    parentColumn,
    parentOption,
    allowedOptions,
    isAwaitingParent: !parentOption,
    isCurrentValueInvalid: hasCurrentValue && !findSelectionOption(allowedOptions, currentValue),
  };
};

/**
 * Selection fields that `currentColumnId` may depend on: other Selection fields that do not
 * themselves depend on a field (max 2 levels, which also rules out cycles). A field that
 * already has dependents cannot become a dependent, so it gets no candidates.
 */
export const getEligibleParentColumns = (
  columns: ITaskCustomColumn[],
  currentColumnId: string | null
): ITaskCustomColumn[] => {
  if (
    currentColumnId &&
    columns.some(column => column.custom_column_obj?.parentColumnId === currentColumnId)
  ) {
    return [];
  }

  return columns.filter(
    column =>
      column.custom_column_obj?.fieldType === 'selection' &&
      getColumnIdentifier(column) !== currentColumnId &&
      !column.custom_column_obj?.parentColumnId &&
      !column.custom_column_obj?.parentColumnKey
  );
};
