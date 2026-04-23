import { ITaskCustomColumn, ITaskCustomColumnValue } from '@/types/tasks/task.types';

export const DRAWER_SUPPORTED_CUSTOM_FIELD_TYPES = [
  'date',
  'number',
  'selection',
  'people',
  'text',
] as const;

export const isDrawerSupportedCustomField = (column: ITaskCustomColumn) =>
  DRAWER_SUPPORTED_CUSTOM_FIELD_TYPES.includes(
    (column.custom_column_obj?.fieldType ||
      '') as (typeof DRAWER_SUPPORTED_CUSTOM_FIELD_TYPES)[number]
  );

export const getDrawerSupportedCustomFields = (customColumns: ITaskCustomColumn[]) =>
  customColumns.filter(isDrawerSupportedCustomField);

export const hasDrawerSupportedCustomFields = (customColumns: ITaskCustomColumn[]) =>
  customColumns.some(isDrawerSupportedCustomField);

const collectPeopleCustomFieldIds = (value: unknown, collectedIds: Set<string>) => {
  if (Array.isArray(value)) {
    value.forEach(item => collectPeopleCustomFieldIds(item, collectedIds));
    return;
  }

  if (typeof value !== 'string') return;

  const trimmedValue = value.trim();
  if (!trimmedValue) return;

  if (trimmedValue.startsWith('[')) {
    try {
      const parsedValue = JSON.parse(trimmedValue);
      collectPeopleCustomFieldIds(parsedValue, collectedIds);
      return;
    } catch {
      // Fall through and treat it as a raw string if parsing fails.
    }
  }

  collectedIds.add(trimmedValue);
};

export const parsePeopleCustomFieldValue = (value: ITaskCustomColumnValue): string[] => {
  const collectedIds = new Set<string>();
  collectPeopleCustomFieldIds(value, collectedIds);
  return Array.from(collectedIds);
};

export const getTaskCustomFieldDisplayName = (column: ITaskCustomColumn) =>
  column.name || column.custom_column_obj?.fieldTitle || column.key;

export const getTaskCustomNumberAffixes = (column: ITaskCustomColumn) => {
  const numberType = column.custom_column_obj?.numberType;
  const label = column.custom_column_obj?.label || undefined;
  const labelPosition = column.custom_column_obj?.labelPosition || 'left';

  if (numberType === 'percentage') {
    return {
      addonBefore: undefined,
      addonAfter: '%',
    };
  }

  if (numberType === 'withLabel') {
    return {
      addonBefore: labelPosition === 'left' ? label : undefined,
      addonAfter: labelPosition === 'right' ? label : undefined,
    };
  }

  return {
    addonBefore: undefined,
    addonAfter: undefined,
  };
};
