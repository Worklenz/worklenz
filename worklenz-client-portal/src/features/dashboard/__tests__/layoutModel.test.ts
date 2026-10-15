import { describe, expect, it } from 'vitest';
import type { DashboardLayoutV2 } from '@/types/v2';
import { GRID_COLS, applyGeometry, defaultLayout, moveWidget, reconcileLayout } from '../layoutModel';
import { selectProjects } from '../widgets';

const ctx = { invoicesVisible: false };

describe('defaultLayout', () => {
  it('reproduces the original dashboard with the charts hidden', () => {
    const { widgets } = defaultLayout(ctx);
    const visible = widgets.filter(item => !item.hidden).map(item => item.type);
    expect(visible).toEqual([
      'tile-active-projects',
      'tile-pending-actions',
      'tile-upcoming-milestones',
      'needs-action',
      'upcoming-milestones',
      'projects',
      'recent-activity',
    ]);
    expect(widgets.filter(item => item.hidden).map(item => item.type)).toEqual(['chart-projects-by-status', 'chart-project-progress', 'chart-open-items']);
  });

  it('adds the unpaid tile only when invoices are visible and shares the row evenly', () => {
    expect(defaultLayout(ctx).widgets.some(item => item.type === 'tile-unpaid')).toBe(false);
    const tiles = defaultLayout({ invoicesVisible: true }).widgets.filter(item => item.type.startsWith('tile-'));
    expect(tiles).toHaveLength(4);
    expect(tiles.every(item => item.w === GRID_COLS / 4)).toBe(true);
  });
});

describe('reconcileLayout', () => {
  it('falls back to the default for nothing or an unknown version', () => {
    expect(reconcileLayout(null, ctx)).toEqual(defaultLayout(ctx));
    expect(reconcileLayout({ version: 2 } as unknown as DashboardLayoutV2, ctx)).toEqual(defaultLayout(ctx));
  });

  it('drops unknown, duplicate and ineligible widgets and clamps geometry', () => {
    const saved = {
      version: 1,
      widgets: [
        { type: 'projects', x: 99, y: -4, w: 40, h: 1, hidden: false },
        { type: 'projects', x: 0, y: 0, w: 3, h: 3, hidden: false },
        { type: 'tile-unpaid', x: 0, y: 0, w: 3, h: 3, hidden: false },
        { type: 'made-up', x: 0, y: 0, w: 3, h: 3, hidden: false },
      ],
    } as unknown as DashboardLayoutV2;
    const { widgets } = reconcileLayout(saved, ctx);
    const projects = widgets.filter(item => item.type === 'projects');
    expect(projects).toHaveLength(1);
    expect(projects[0]).toMatchObject({ x: 0, y: 0, w: GRID_COLS, h: 5 });
    expect(widgets.some(item => item.type === 'tile-unpaid' || (item.type as string) === 'made-up')).toBe(false);
  });

  it('appends widgets added since the layout was saved as hidden, below the rest', () => {
    const saved: DashboardLayoutV2 = { version: 1, widgets: [{ type: 'projects', x: 0, y: 0, w: 12, h: 10, hidden: false }] };
    const { widgets } = reconcileLayout(saved, ctx);
    const added = widgets.filter(item => item.type !== 'projects');
    expect(added.length).toBeGreaterThan(0);
    expect(added.every(item => item.hidden && item.y >= 10)).toBe(true);
  });

  it('repairs malformed project settings', () => {
    const saved = {
      version: 1,
      widgets: [{ type: 'projects', x: 0, y: 0, w: 12, h: 10, hidden: false, settings: { projectIds: 'nope', cardFields: ['status', 'bogus'], view: 'weird' } }],
    } as unknown as DashboardLayoutV2;
    const projects = reconcileLayout(saved, ctx).widgets.find(item => item.type === 'projects');
    expect(projects?.settings).toEqual({ projectIds: 'all', cardFields: ['status'], view: 'cards' });
  });
});

describe('moveWidget', () => {
  it('swaps reading order with the neighbour and does nothing at the ends', () => {
    const { widgets } = defaultLayout(ctx);
    const moved = moveWidget(widgets, 'needs-action', 1);
    const needs = moved.find(item => item.type === 'needs-action');
    const milestones = moved.find(item => item.type === 'upcoming-milestones');
    expect(needs).toMatchObject({ x: 6, y: 3 });
    expect(milestones).toMatchObject({ x: 0, y: 3 });
    expect(moveWidget(widgets, 'tile-active-projects', -1)).toBe(widgets);
  });
});

describe('applyGeometry', () => {
  it('returns the same array when the grid reports nothing new', () => {
    const { widgets } = defaultLayout(ctx);
    const items = widgets.filter(item => !item.hidden).map(item => ({ i: item.type, x: item.x, y: item.y, w: item.w, h: item.h }));
    expect(applyGeometry(widgets, items)).toBe(widgets);
  });

  it('applies new geometry to visible widgets only', () => {
    const { widgets } = defaultLayout(ctx);
    const next = applyGeometry(widgets, [
      { i: 'projects', x: 0, y: 5, w: 6, h: 7 },
      { i: 'chart-open-items', x: 5, y: 5, w: 5, h: 5 },
    ]);
    expect(next.find(item => item.type === 'projects')).toMatchObject({ y: 5, w: 6, h: 7 });
    expect(next.find(item => item.type === 'chart-open-items')).toEqual(widgets.find(item => item.type === 'chart-open-items'));
  });
});

describe('selectProjects', () => {
  const projects = [{ id: 'a' }, { id: 'b' }, { id: 'c' }] as Parameters<typeof selectProjects>[0];
  const base = { cardFields: [], view: 'cards' as const };

  it('shows every project by default, including newly shared ones', () => {
    expect(selectProjects(projects, { ...base, projectIds: 'all' })).toHaveLength(3);
    expect(selectProjects(projects)).toHaveLength(3);
  });

  it('shows only the chosen projects and ignores ones no longer shared', () => {
    expect(selectProjects(projects, { ...base, projectIds: ['b', 'gone'] }).map(project => project.id)).toEqual(['b']);
  });
});
