import { describe, expect, it } from 'vitest';
import {
  addSection,
  addWidget,
  DEFAULT_HOME_LAYOUT,
  getAddableWidgets,
  getOtherAllowedColumn,
  getVisibleWidgetIds,
  isDefaultHomeLayout,
  isGreetingVisible,
  isWidgetOnPage,
  moveWidgetRelativeTo,
  moveWidgetToIndex,
  removeSection,
  removeWidget,
  resolveHomeLayout,
  setSectionHidden,
  shiftWidget,
  type HomeLayout,
} from './homeLayout';
import {
  DEFAULT_HOME_SELECTIONS,
  resolveInitialAssignedGroup,
  sanitizeHomePreferences,
} from '@/features/home-page/homePreferences.slice';

describe('resolveHomeLayout', () => {
  it('returns the default layout for missing or malformed input', () => {
    expect(resolveHomeLayout(undefined)).toEqual(DEFAULT_HOME_LAYOUT);
    expect(resolveHomeLayout('nope')).toEqual(DEFAULT_HOME_LAYOUT);
    expect(resolveHomeLayout({ columns: { main: 'x', side: 4 }, hidden: 'y' })).toEqual(
      DEFAULT_HOME_LAYOUT
    );
  });

  it('drops unknown ids and duplicates', () => {
    const layout = resolveHomeLayout({
      columns: { main: ['priorities', 'bogus', 'priorities', 'stat-cards'], side: ['todo'] },
    });
    expect(layout.columns.main).toEqual(['priorities', 'stat-cards']);
    expect(layout.columns.side).toEqual(['todo', 'progress-donut']);
  });

  it('appends a widget missing from the saved layout to its default column', () => {
    const layout = resolveHomeLayout({ columns: { main: ['priorities'], side: [] } });
    expect(layout.columns.main).toEqual(['priorities', 'stat-cards']);
    expect(layout.columns.side).toEqual(['progress-donut', 'todo']);
  });

  it('sends a widget saved in a column it is not allowed in back to its default column', () => {
    const layout = resolveHomeLayout({
      columns: { main: [], side: ['priorities', 'stat-cards', 'todo', 'progress-donut'] },
    });
    expect(layout.columns.side).toEqual(['todo', 'progress-donut']);
    expect(layout.columns.main).toEqual(['stat-cards', 'priorities']);
  });

  it('keeps saved hidden widgets, Today’s Priorities included, and drops repeats and unknown ids', () => {
    const layout = resolveHomeLayout({ hidden: ['priorities', 'todo', 'todo', 'bogus'] });
    expect(layout.hidden).toEqual(['priorities', 'todo']);
  });

  it('keeps the greeting banner hidden when it was saved hidden', () => {
    expect(resolveHomeLayout({ hidden: ['greeting', 'greeting'] }).hidden).toEqual(['greeting']);
  });
});

describe('layout editing', () => {
  it('hides and shows a widget without losing its position', () => {
    const hidden = setSectionHidden(DEFAULT_HOME_LAYOUT, 'stat-cards', true);
    expect(getVisibleWidgetIds(hidden, 'main')).toEqual(['priorities']);
    expect(hidden.columns.main).toEqual(['stat-cards', 'priorities']);
    expect(setSectionHidden(hidden, 'stat-cards', false)).toEqual(DEFAULT_HOME_LAYOUT);
  });

  it('hides and shows the greeting banner without touching the columns', () => {
    const hidden = setSectionHidden(DEFAULT_HOME_LAYOUT, 'greeting', true);
    expect(isGreetingVisible(hidden)).toBe(false);
    expect(hidden.columns).toEqual(DEFAULT_HOME_LAYOUT.columns);
    expect(setSectionHidden(hidden, 'greeting', false)).toEqual(DEFAULT_HOME_LAYOUT);
  });

  it('hides Today’s Priorities like any other widget, and brings it back where it was', () => {
    const hidden = setSectionHidden(DEFAULT_HOME_LAYOUT, 'priorities', true);
    expect(getVisibleWidgetIds(hidden, 'main')).toEqual(['stat-cards']);
    expect(hidden.columns.main).toEqual(['stat-cards', 'priorities']);
    expect(setSectionHidden(hidden, 'priorities', false)).toEqual(DEFAULT_HOME_LAYOUT);
  });

  it('shifts a widget within its column and stops at the ends', () => {
    const down = shiftWidget(DEFAULT_HOME_LAYOUT, 'stat-cards', 1);
    expect(down.columns.main).toEqual(['priorities', 'stat-cards']);
    expect(shiftWidget(down, 'stat-cards', 1)).toBe(down);
    expect(shiftWidget(DEFAULT_HOME_LAYOUT, 'stat-cards', -1)).toBe(DEFAULT_HOME_LAYOUT);
  });

  it('moves a widget between columns where allowed and rejects it where not', () => {
    const moved = moveWidgetToIndex(DEFAULT_HOME_LAYOUT, 'todo', 'main', 1);
    expect(moved.columns.main).toEqual(['stat-cards', 'todo', 'priorities']);
    expect(moved.columns.side).toEqual(['progress-donut']);
    expect(moveWidgetToIndex(DEFAULT_HOME_LAYOUT, 'priorities', 'side', 0)).toBe(
      DEFAULT_HOME_LAYOUT
    );
  });

  it('offers a column move only to widgets that can sit in both columns', () => {
    expect(getOtherAllowedColumn(DEFAULT_HOME_LAYOUT, 'todo')).toBe('main');
    expect(getOtherAllowedColumn(DEFAULT_HOME_LAYOUT, 'priorities')).toBeNull();
  });

  it('does not mutate the layout it is given', () => {
    const snapshot = JSON.stringify(DEFAULT_HOME_LAYOUT);
    moveWidgetToIndex(DEFAULT_HOME_LAYOUT, 'todo', 'main', 0);
    setSectionHidden(DEFAULT_HOME_LAYOUT, 'todo', true);
    expect(JSON.stringify(DEFAULT_HOME_LAYOUT)).toBe(snapshot);
    expect(isDefaultHomeLayout(DEFAULT_HOME_LAYOUT)).toBe(true);
  });
});

const OPTIONAL_IDS = ['team-members', 'assigned-by-me', 'mentions', 'continue'] as const;

describe('optional widgets', () => {
  it('are not on the default page, so the default layout is unchanged', () => {
    expect(DEFAULT_HOME_LAYOUT.columns).toEqual({
      main: ['stat-cards', 'priorities'],
      side: ['progress-donut', 'todo'],
    });
    expect(DEFAULT_HOME_LAYOUT.hidden).toEqual([]);
  });

  it('are not appended to a layout saved before they existed', () => {
    const layout = resolveHomeLayout({
      columns: { main: ['stat-cards', 'priorities'], side: ['progress-donut', 'todo'] },
    });
    for (const id of OPTIONAL_IDS) expect(isWidgetOnPage(layout, id)).toBe(false);
    expect(isDefaultHomeLayout(layout)).toBe(true);
  });

  it('are kept where the user put them, in either column', () => {
    const layout = resolveHomeLayout({
      columns: { main: ['stat-cards', 'continue', 'priorities'], side: ['mentions', 'progress-donut', 'todo'] },
    });
    expect(layout.columns.main).toEqual(['stat-cards', 'continue', 'priorities']);
    expect(layout.columns.side).toEqual(['mentions', 'progress-donut', 'todo']);
  });

  it('drops a stale hidden entry for an optional widget that is no longer on the page', () => {
    expect(resolveHomeLayout({ hidden: ['continue', 'todo'] }).hidden).toEqual(['todo']);
    const placed = resolveHomeLayout({ columns: { main: [], side: ['continue'] }, hidden: ['continue'] });
    expect(placed.hidden).toEqual(['continue']);
  });

  it('are offered by "Add widget" until they are on the page', () => {
    expect(getAddableWidgets(DEFAULT_HOME_LAYOUT).map(w => w.id)).toEqual([...OPTIONAL_IDS]);
    const added = addWidget(DEFAULT_HOME_LAYOUT, 'continue');
    expect(getAddableWidgets(added).map(w => w.id)).toEqual(['team-members', 'assigned-by-me', 'mentions']);
  });

  it('are offered again along with a core widget that was hidden', () => {
    const hidden = setSectionHidden(DEFAULT_HOME_LAYOUT, 'progress-donut', true);
    expect(getAddableWidgets(hidden).map(w => w.id)).toEqual(['progress-donut', ...OPTIONAL_IDS]);
  });
});

describe('addWidget', () => {
  it('places a new widget in its default column, above the widget that fills the column', () => {
    const withContinue = addWidget(DEFAULT_HOME_LAYOUT, 'continue');
    const added = addWidget(withContinue, 'mentions');
    expect(added.columns.side).toEqual(['progress-donut', 'todo', 'mentions', 'continue']);
    expect(added.columns.main).toEqual(DEFAULT_HOME_LAYOUT.columns.main);
    expect(isWidgetOnPage(added, 'mentions')).toBe(true);
  });

  it('puts a new widget at the end of its column on the default page, where nothing fills it', () => {
    expect(addWidget(DEFAULT_HOME_LAYOUT, 'mentions').columns.side).toEqual(['progress-donut', 'todo', 'mentions']);
  });

  it('appends to a column that has nothing filling it', () => {
    const layout: HomeLayout = {
      columns: { main: ['stat-cards', 'priorities', 'todo'], side: ['progress-donut'] },
      hidden: [],
    };
    expect(addWidget(layout, 'continue').columns.side).toEqual(['progress-donut', 'continue']);
  });

  it('brings a hidden widget back where it was instead of placing it again', () => {
    const hidden = setSectionHidden(DEFAULT_HOME_LAYOUT, 'progress-donut', true);
    expect(addWidget(hidden, 'progress-donut')).toEqual(DEFAULT_HOME_LAYOUT);
  });

  it('leaves a widget that is already on the page alone', () => {
    expect(addWidget(DEFAULT_HOME_LAYOUT, 'todo')).toBe(DEFAULT_HOME_LAYOUT);
  });

  it('adds every optional widget exactly once', () => {
    const all = OPTIONAL_IDS.reduce(addWidget, DEFAULT_HOME_LAYOUT);
    const placed = [...all.columns.main, ...all.columns.side];
    expect(new Set(placed).size).toBe(placed.length);
    expect(placed).toHaveLength(8);
    expect(all.columns.side.at(-1)).toBe('continue');
  });

  it('does not mutate the layout it is given', () => {
    const snapshot = JSON.stringify(DEFAULT_HOME_LAYOUT);
    addWidget(DEFAULT_HOME_LAYOUT, 'continue');
    expect(JSON.stringify(DEFAULT_HOME_LAYOUT)).toBe(snapshot);
  });
});

describe('removeWidget', () => {
  it('takes an optional widget off the page entirely, back to the default layout', () => {
    const added = addWidget(DEFAULT_HOME_LAYOUT, 'continue');
    expect(removeWidget(added, 'continue')).toEqual(DEFAULT_HOME_LAYOUT);
    expect(isDefaultHomeLayout(removeWidget(added, 'continue'))).toBe(true);
  });

  it('also forgets a hidden entry for an optional widget', () => {
    const hidden = setSectionHidden(addWidget(DEFAULT_HOME_LAYOUT, 'continue'), 'continue', true);
    expect(removeWidget(hidden, 'continue').hidden).toEqual([]);
  });

  it('only hides a core widget, so it keeps its place for when it comes back', () => {
    const removed = removeWidget(DEFAULT_HOME_LAYOUT, 'progress-donut');
    expect(removed.hidden).toEqual(['progress-donut']);
    expect(removed.columns).toEqual(DEFAULT_HOME_LAYOUT.columns);
    expect(addWidget(removed, 'progress-donut')).toEqual(DEFAULT_HOME_LAYOUT);
  });

  it('removes Task priorities like any core widget: hidden, keeping its place', () => {
    const removed = removeWidget(DEFAULT_HOME_LAYOUT, 'priorities');
    expect(removed.hidden).toEqual(['priorities']);
    expect(removed.columns).toEqual(DEFAULT_HOME_LAYOUT.columns);
  });
});

describe('moveWidgetRelativeTo', () => {
  const layout = addWidget(addWidget(DEFAULT_HOME_LAYOUT, 'continue'), 'mentions');
  const side = layout.columns.side;

  it('starts from the arrangement the tests assume', () => {
    expect(side).toEqual(['progress-donut', 'todo', 'mentions', 'continue']);
  });

  it('puts a widget before or after another in the same column', () => {
    expect(moveWidgetRelativeTo(layout, 'mentions', 'side', 'progress-donut', 'before').columns.side).toEqual([
      'mentions',
      'progress-donut',
      'todo',
      'continue',
    ]);
    expect(moveWidgetRelativeTo(layout, 'progress-donut', 'side', 'todo', 'after').columns.side).toEqual([
      'todo',
      'progress-donut',
      'mentions',
      'continue',
    ]);
  });

  it('moves a widget to another column, next to a target there', () => {
    const moved = moveWidgetRelativeTo(layout, 'continue', 'main', 'priorities', 'before');
    expect(moved.columns.main).toEqual(['stat-cards', 'continue', 'priorities']);
    expect(moved.columns.side).toEqual(['progress-donut', 'todo', 'mentions']);
  });

  it('moves to the end of a column when there is no target, even an empty one', () => {
    expect(moveWidgetRelativeTo(layout, 'continue', 'main', null, 'after').columns.main).toEqual([
      'stat-cards',
      'priorities',
      'continue',
    ]);
    const emptied: HomeLayout = { columns: { main: ['stat-cards', 'priorities', 'progress-donut', 'todo'], side: [] }, hidden: [] };
    expect(moveWidgetRelativeTo(emptied, 'todo', 'side', null, 'after').columns.side).toEqual(['todo']);
  });

  it('rejects a column the widget cannot sit in', () => {
    expect(moveWidgetRelativeTo(layout, 'priorities', 'side', 'continue', 'after')).toBe(layout);
  });

  it('returns the same layout for a move that changes nothing', () => {
    expect(moveWidgetRelativeTo(layout, 'continue', 'side', 'mentions', 'after')).toBe(layout);
    expect(moveWidgetRelativeTo(layout, 'continue', 'side', null, 'after')).toBe(layout);
    expect(moveWidgetRelativeTo(layout, 'continue', 'side', 'continue', 'after')).toBe(layout);
  });

  it('returns the same layout when the target is not in that column', () => {
    expect(moveWidgetRelativeTo(layout, 'continue', 'main', 'mentions', 'before')).toBe(layout);
  });

  it('keeps hidden widgets in their slots', () => {
    const withHidden = setSectionHidden(layout, 'continue', true);
    const moved = moveWidgetRelativeTo(withHidden, 'mentions', 'side', 'progress-donut', 'after');
    expect(moved.columns.side).toEqual(['progress-donut', 'mentions', 'todo', 'continue']);
    expect(moved.hidden).toEqual(['continue']);
  });
});

describe('adding a widget at the spot it is dropped', () => {
  // What dragging a row out of "Add widget" does: put it on the page, then move it to the drop spot.
  const dropAt = (
    layout: HomeLayout,
    id: Parameters<typeof addWidget>[1],
    column: 'main' | 'side',
    targetId: Parameters<typeof moveWidgetRelativeTo>[3],
    position: 'before' | 'after'
  ) => moveWidgetRelativeTo(addWidget(layout, id), id, column, targetId, position);

  it('lands before the widget it is dropped above, in either column', () => {
    expect(dropAt(DEFAULT_HOME_LAYOUT, 'continue', 'side', 'progress-donut', 'before').columns.side).toEqual([
      'continue',
      'progress-donut',
      'todo',
    ]);
    expect(dropAt(DEFAULT_HOME_LAYOUT, 'continue', 'main', 'priorities', 'before').columns.main).toEqual([
      'stat-cards',
      'continue',
      'priorities',
    ]);
  });

  it('lands after the last widget when dropped below the column, and in an emptied column', () => {
    expect(dropAt(DEFAULT_HOME_LAYOUT, 'mentions', 'side', 'todo', 'after').columns.side).toEqual([
      'progress-donut',
      'todo',
      'mentions',
    ]);
    const emptied: HomeLayout = {
      columns: { main: ['stat-cards', 'priorities', 'progress-donut', 'todo'], side: [] },
      hidden: [],
    };
    expect(dropAt(emptied, 'continue', 'side', null, 'after').columns.side).toEqual(['continue']);
  });

  it('is on the page exactly once afterwards, and nowhere else', () => {
    const dropped = dropAt(DEFAULT_HOME_LAYOUT, 'continue', 'main', 'stat-cards', 'after');
    const placed = [...dropped.columns.main, ...dropped.columns.side];
    expect(placed.filter(id => id === 'continue')).toHaveLength(1);
    expect(isWidgetOnPage(dropped, 'continue')).toBe(true);
  });

  it('brings a removed core widget back at the drop spot, not where it used to be', () => {
    const removed = removeWidget(DEFAULT_HOME_LAYOUT, 'progress-donut');
    const dropped = dropAt(removed, 'progress-donut', 'main', 'priorities', 'before');
    expect(dropped.hidden).toEqual([]);
    expect(dropped.columns.main).toEqual(['stat-cards', 'progress-donut', 'priorities']);
    expect(dropped.columns.side).toEqual(['todo']);
  });

  it('is refused for a column the widget cannot sit in, so nothing is added by the move', () => {
    const removed = removeWidget(DEFAULT_HOME_LAYOUT, 'stat-cards');
    // The drop logic never offers such a target; the model also refuses it, leaving the widget where addWidget put it.
    const dropped = dropAt(removed, 'stat-cards', 'side', 'todo', 'after');
    expect(dropped.columns.side).not.toContain('stat-cards');
  });
});

describe('the greeting banner as a removable section', () => {
  it('is removed by hiding it, and does not touch the columns', () => {
    const removed = removeSection(DEFAULT_HOME_LAYOUT, 'greeting');
    expect(isGreetingVisible(removed)).toBe(false);
    expect(removed.hidden).toEqual(['greeting']);
    expect(removed.columns).toEqual(DEFAULT_HOME_LAYOUT.columns);
  });

  it('comes back when it is added again, leaving the default layout', () => {
    const added = addSection(removeSection(DEFAULT_HOME_LAYOUT, 'greeting'), 'greeting');
    expect(added).toEqual(DEFAULT_HOME_LAYOUT);
    expect(isDefaultHomeLayout(added)).toBe(true);
  });

  it('is not offered by the widget list, which only lists widgets', () => {
    expect(getAddableWidgets(removeSection(DEFAULT_HOME_LAYOUT, 'greeting')).map(w => w.id)).toEqual([
      ...OPTIONAL_IDS,
    ]);
  });

  it('passes a widget through to addWidget / removeWidget', () => {
    const added = addSection(DEFAULT_HOME_LAYOUT, 'continue');
    expect(added).toEqual(addWidget(DEFAULT_HOME_LAYOUT, 'continue'));
    expect(removeSection(added, 'continue')).toEqual(DEFAULT_HOME_LAYOUT);
  });
});

describe('pinned assigned-to-me/by-me default', () => {
  it('keeps a valid pinned group and drops anything else', () => {
    const pinnedBy = sanitizeHomePreferences({ selections: { pinnedAssignedGroup: 1 } });
    expect(pinnedBy.selections.pinnedAssignedGroup).toBe(1);
    expect(sanitizeHomePreferences({ selections: { pinnedAssignedGroup: 0 } }).selections.pinnedAssignedGroup).toBe(0);
    expect(sanitizeHomePreferences({ selections: { pinnedAssignedGroup: 'x' } }).selections.pinnedAssignedGroup).toBeNull();
  });

  it('opens on the pinned group, otherwise on the one last used', () => {
    const base = DEFAULT_HOME_SELECTIONS;
    expect(resolveInitialAssignedGroup({ ...base, assignedGroup: 1, pinnedAssignedGroup: null })).toBe(1);
    expect(resolveInitialAssignedGroup({ ...base, assignedGroup: 1, pinnedAssignedGroup: 0 })).toBe(0);
  });
});

describe('sanitizeHomePreferences', () => {
  it('fills in the default tab config for preferences saved before tabs were configurable', () => {
    expect(sanitizeHomePreferences({}).tabs).toEqual({
      order: ['All', 'Today', 'Overdue', 'Upcoming', 'NoDueDate', 'Pinned'],
      hidden: [],
    });
  });

  it('falls back to defaults field by field', () => {
    const prefs = sanitizeHomePreferences({
      selections: { period: 'year', assignedGroup: 7, priorityTab: 'Nope', sort: { field: 'x' } },
    });
    expect(prefs.selections).toEqual({
      period: 'week',
      assignedGroup: 0,
      pinnedAssignedGroup: null,
      priorityTab: 'All',
      sort: null,
    });
  });

  it('keeps valid selections', () => {
    const prefs = sanitizeHomePreferences({
      selections: {
        period: 'today',
        assignedGroup: 1,
        priorityTab: 'Pinned',
        sort: { field: 'priority', order: 'desc' },
      },
    });
    expect(prefs.selections).toEqual({
      period: 'today',
      assignedGroup: 1,
      pinnedAssignedGroup: null,
      priorityTab: 'Pinned',
      sort: { field: 'priority', order: 'desc' },
    });
  });
});
