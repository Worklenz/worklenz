import { arrayMove } from '@dnd-kit/sortable';
import type { SelectionType } from '../selection-type-column/selection-type-column';

/**
 * Rebuilds the flat selections list after reordering siblings under one parent
 * (or the unassigned group). Keeps parent_selection_id links and other groups intact.
 */
export const reorderSelectionsInGroup = (
  selections: SelectionType[],
  groupIds: string[],
  activeId: string,
  overId: string
): SelectionType[] | null => {
  const oldIndex = groupIds.indexOf(activeId);
  const newIndex = groupIds.indexOf(overId);
  if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return null;

  const reorderedGroupIds = arrayMove(groupIds, oldIndex, newIndex);
  const selectionById = new Map(selections.map(selection => [selection.selection_id, selection]));
  const reorderedGroup = reorderedGroupIds
    .map(id => selectionById.get(id))
    .filter((selection): selection is SelectionType => Boolean(selection));
  const groupIdSet = new Set(groupIds);
  const result: SelectionType[] = [];
  let insertedGroup = false;

  for (const selection of selections) {
    if (!groupIdSet.has(selection.selection_id)) {
      result.push(selection);
      continue;
    }
    if (!insertedGroup) {
      result.push(...reorderedGroup);
      insertedGroup = true;
    }
  }

  return result;
};
