import { TimeEntriesGroupBy, TimeEntriesScope } from '@/api/tasks/task-time-logs.api.service';

/**
 * Turns a column's base pixel width into a flexible one (grow + shrink
 * around that basis) instead of a hard `width` + `flexShrink: 0` pair. With
 * every column doing this, the row's columns share out whatever width is
 * left over roughly evenly and spread across the full content area instead
 * of clustering to the left with dead space after the last column — the
 * problem a single non-growing identity column (or any other fixed-width
 * column) caused before.
 */
export function flexCol(px: number): { flex: string } {
  return { flex: `1 1 ${px}px` };
}

/**
 * Column widths shared by the grouped list's header row, its group rows, and
 * its expanded entry rows — a single source of truth so all three stay
 * pixel-aligned as a real table would, even though none of them is an actual
 * `<table>` element (hand-rolled flex rows, same approach as the flat
 * table's own column layout).
 */
export const GROUPED_COLUMN_WIDTHS = {
  member: 130,
  project: 150,
  status: 100,
  priority: 90,
  billable: 80,
  time: 90,
  dueDate: 90,
  createdAt: 100,
  actions: 64,
} as const;

/**
 * Which optional columns an expanded entry row needs, given the current
 * grouping — a column is only shown when it isn't already redundant with the
 * group's own identity column (e.g. grouping by Member already names the
 * member in the group header, so entry rows don't repeat it as its own
 * column). The Task column is always shown, since no grouping is by task.
 */
export function getGroupedColumnVisibility(
  groupBy: Exclude<TimeEntriesGroupBy, 'none'>,
  scope: TimeEntriesScope
) {
  return {
    showMember: groupBy !== 'member' && scope === 'all',
    // Project is already the group's own identity when grouping by Project —
    // only Member/Client groups need it as its own column.
    showProject: groupBy === 'client' || groupBy === 'member',
  };
}

/** i18n key for the group identity column's header label, which changes to
 * match whatever dimension is currently being grouped by. */
export function getGroupIdentityColumnKey(groupBy: Exclude<TimeEntriesGroupBy, 'none'>): string {
  switch (groupBy) {
    case 'member':
      return 'colMember';
    case 'project':
      return 'colProject';
    case 'client':
      return 'colClient';
  }
}

/**
 * Column widths for the top-level, always-visible group summary row — a
 * rollup of each group's billable/non-billable split, not a mirror of the
 * flat table's per-entry columns (those only make sense once a group is
 * expanded — see GROUPED_COLUMN_WIDTHS above and colVisibility for that).
 * Entries and tasks are separate columns (not one combined cell) so each
 * value reads as plainly as any other table column.
 */
export const ROLLUP_COLUMN_WIDTHS = {
  secondary: 90,
  totalEntries: 110,
  billableEntries: 100,
  billableTasks: 90,
  billableTime: 100,
  nonBillableEntries: 110,
  nonBillableTasks: 100,
  nonBillableTime: 110,
} as const;

/**
 * The rollup row's one dimension-dependent column: how many distinct
 * projects a Member/Client group touched, or how many distinct members
 * contributed to a Project group (only meaningful under All scope, where
 * more than one person's entries can land in the same group).
 */
export function getRollupSecondaryColumn(
  groupBy: Exclude<TimeEntriesGroupBy, 'none'>,
  scope: TimeEntriesScope
): { field: 'project_count' | 'member_count'; labelKey: string; defaultLabel: string } | null {
  if (groupBy === 'member' || groupBy === 'client') {
    return { field: 'project_count', labelKey: 'colProjects', defaultLabel: 'Projects' };
  }
  if (groupBy === 'project' && scope === 'all') {
    return { field: 'member_count', labelKey: 'colMembers', defaultLabel: 'Members' };
  }
  return null;
}
