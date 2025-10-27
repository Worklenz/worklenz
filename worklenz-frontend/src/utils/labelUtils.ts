import { ITaskLabel } from '@/types/tasks/taskLabel.types';

/**
 * Sorts labels to show selected labels first
 * @param labels - All available labels
 * @param selectedLabels - Currently selected labels
 * @returns Sorted array with selected labels first
 */
export const sortLabelsBySelection = (
  labels: ITaskLabel[],
  selectedLabels: ITaskLabel[]
): ITaskLabel[] => {
  return [...labels].sort((a, b) => {
    const aSelected = selectedLabels.some(label => label.id === a.id);
    const bSelected = selectedLabels.some(label => label.id === b.id);

    if (aSelected && !bSelected) return -1;
    if (!aSelected && bSelected) return 1;
    return 0;
  });
};

/**
 * Checks if a label is selected
 * @param labelId - ID of the label to check
 * @param selectedLabels - Currently selected labels
 * @returns true if label is selected
 */
export const isLabelSelected = (
  labelId: string,
  selectedLabels?: ITaskLabel[]
): boolean => {
  if (!selectedLabels || selectedLabels.length === 0) return false;
  return selectedLabels.some(label => label.id === labelId);
};
