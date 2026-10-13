import { describe, expect, it } from 'vitest';
import {
  addInstance,
  applyGeometry,
  GridLayout,
  hideWidget,
  moveWidget,
  reconcileLayout,
  removeInstance,
  resizeWidget,
  showWidget,
  visibleWidgets,
  WidgetDefinition,
} from '../layout-model';

type Type = 'kpi_a' | 'kpi_b' | 'list_c' | 'chart_d';

const DEFS: WidgetDefinition<Type>[] = [
  { type: 'kpi_a', titleKey: 'a', defaultTitle: 'A', size: { w: 3, h: 3 }, min: { w: 2, h: 3 } },
  { type: 'kpi_b', titleKey: 'b', defaultTitle: 'B', size: { w: 3, h: 3 }, min: { w: 2, h: 3 } },
  { type: 'list_c', titleKey: 'c', defaultTitle: 'C', size: { w: 6, h: 9 }, min: { w: 3, h: 4 } },
  { type: 'chart_d', titleKey: 'd', defaultTitle: 'D', size: { w: 6, h: 8 }, min: { w: 3, h: 6 }, hiddenByDefault: true },
];

describe('reconcileLayout (singleton mode)', () => {
  it('builds the default layout with every widget exactly once, hiddenByDefault respected', () => {
    const { widgets } = reconcileLayout(null, { widgets: DEFS });
    expect(widgets.map(item => item.type).sort()).toEqual(['chart_d', 'kpi_a', 'kpi_b', 'list_c'].sort());
    expect(widgets.find(item => item.type === 'chart_d')?.hidden).toBe(true);
    // id === type in singleton mode
    expect(widgets.every(item => item.id === item.type)).toBe(true);
  });

  it('falls back to the default when nothing is saved', () => {
    expect(reconcileLayout(null, { widgets: DEFS })).toEqual(reconcileLayout(undefined, { widgets: DEFS }));
  });

  it('keeps saved geometry and appends a newly released widget hidden', () => {
    const saved: GridLayout<Type> = {
      version: 1,
      widgets: [{ id: 'list_c', type: 'list_c', x: 0, y: 0, w: 12, h: 8, hidden: false }],
    };
    const { widgets } = reconcileLayout(saved, { widgets: DEFS });
    expect(widgets[0]).toEqual(saved.widgets[0]);
    expect(widgets).toHaveLength(DEFS.length);
    expect(widgets.slice(1).every(item => item.hidden)).toBe(true);
  });

  it('drops unknown types and duplicates, clamps geometry to the grid', () => {
    const saved = {
      version: 1,
      widgets: [
        { id: 'gone', type: 'gone_widget', x: 0, y: 0, w: 6, h: 6, hidden: false },
        { id: 'list_c', type: 'list_c', x: 20, y: 0, w: 99, h: 1, hidden: false },
        { id: 'list_c', type: 'list_c', x: 0, y: 0, w: 6, h: 6, hidden: true },
      ],
    } as unknown as GridLayout<Type>;
    const { widgets } = reconcileLayout(saved, { widgets: DEFS });
    expect(widgets.filter(item => item.type === 'list_c')).toEqual([
      { id: 'list_c', type: 'list_c', x: 0, y: 0, w: 12, h: 4, hidden: false },
    ]);
    expect(widgets.some(item => (item.type as string) === 'gone_widget')).toBe(false);
  });

  it('drops widgets an eligibility check rejects', () => {
    const { widgets } = reconcileLayout(null, { widgets: DEFS, isEligible: type => type !== 'kpi_b' });
    expect(widgets.some(item => item.type === 'kpi_b')).toBe(false);
  });

  it('moves widgets, applies geometry, and lists visible widgets', () => {
    const { widgets } = reconcileLayout(null, { widgets: DEFS });
    const moved = moveWidget(widgets, 'kpi_b', -1);
    const before = widgets.find(item => item.id === 'kpi_a')!;
    expect(moved.find(item => item.id === 'kpi_b')).toMatchObject({ x: before.x, y: before.y });

    expect(applyGeometry(widgets, [])).toBe(widgets);
    const changed = applyGeometry(widgets, [{ i: 'list_c', x: 0, y: 40, w: 12, h: 8 }]);
    expect(changed.find(item => item.id === 'list_c')).toMatchObject({ y: 40, w: 12 });

    expect(visibleWidgets(widgets).some(item => item.type === 'chart_d')).toBe(false);
  });

  it('hides and shows a widget', () => {
    const { widgets } = reconcileLayout(null, { widgets: DEFS });
    const hidden = hideWidget(widgets, 'kpi_a');
    expect(hidden.find(item => item.id === 'kpi_a')?.hidden).toBe(true);
    const shown = showWidget(hidden, 'chart_d', DEFS[3]);
    expect(shown.find(item => item.id === 'chart_d')).toMatchObject({ hidden: false, w: 6, h: 8 });
  });

  it('resizes within the widget minimum and clamps x to stay on the grid', () => {
    const { widgets } = reconcileLayout(null, { widgets: DEFS });
    const resized = resizeWidget(widgets, 'kpi_a', { w: 1 }, { w: 2, h: 3 });
    expect(resized.find(item => item.id === 'kpi_a')?.w).toBe(2);
  });
});

describe('reconcileLayout (multi-instance mode)', () => {
  it('keeps several instances of the same type, each with its own id and config', () => {
    const saved: GridLayout<Type, { note: string }> = {
      version: 1,
      widgets: [
        { id: 'list_c-1', type: 'list_c', x: 0, y: 0, w: 6, h: 9, hidden: false, config: { note: 'first' } },
        { id: 'list_c-2', type: 'list_c', x: 6, y: 0, w: 6, h: 9, hidden: false, config: { note: 'second' } },
      ],
    };
    const { widgets } = reconcileLayout(saved, { widgets: DEFS, multiInstance: true });
    expect(widgets).toHaveLength(2);
    expect(widgets.map(item => item.config?.note)).toEqual(['first', 'second']);
    // No "fill in missing widgets as hidden" behaviour in multi-instance mode.
  });

  it('adds and removes instances', () => {
    const { widgets } = reconcileLayout(null, { widgets: DEFS, multiInstance: true });
    expect(widgets).toHaveLength(0);
    const { widgets: withOne, id } = addInstance(widgets, 'kpi_a', DEFS[0]);
    expect(withOne).toHaveLength(1);
    const { widgets: withTwo } = addInstance(withOne, 'kpi_a', DEFS[0]);
    expect(withTwo).toHaveLength(2);
    expect(new Set(withTwo.map(item => item.id)).size).toBe(2);
    expect(removeInstance(withTwo, id)).toHaveLength(1);
  });

  it('caps the number of instances read back from a saved layout', () => {
    const saved: GridLayout<Type> = {
      version: 1,
      widgets: Array.from({ length: 5 }, (_, index) => ({
        id: `kpi_a-${index}`,
        type: 'kpi_a' as const,
        x: 0,
        y: index,
        w: 3,
        h: 3,
        hidden: false,
      })),
    };
    const { widgets } = reconcileLayout(saved, { widgets: DEFS, multiInstance: true, maxInstances: 2 });
    expect(widgets).toHaveLength(2);
  });
});

describe('reconcileLayout (per-type repeatable, otherwise singleton)', () => {
  const REPEATABLE_DEFS: WidgetDefinition<Type>[] = [
    ...DEFS.slice(0, 3),
    { ...DEFS[3], repeatable: true, hiddenByDefault: undefined },
  ];

  it('has no default instance of a repeatable type, but still defaults the singleton ones', () => {
    const { widgets } = reconcileLayout(null, { widgets: REPEATABLE_DEFS });
    expect(widgets.map(item => item.type).sort()).toEqual(['kpi_a', 'kpi_b', 'list_c']);
  });

  it('keeps several saved instances of a repeatable type without colliding ids', () => {
    const saved: GridLayout<Type, { note: string }> = {
      version: 1,
      widgets: [
        { id: 'chart_d-1', type: 'chart_d', x: 0, y: 0, w: 6, h: 8, hidden: false, config: { note: 'first' } },
        { id: 'chart_d-2', type: 'chart_d', x: 6, y: 0, w: 6, h: 8, hidden: false, config: { note: 'second' } },
      ],
    };
    const { widgets } = reconcileLayout(saved, { widgets: REPEATABLE_DEFS });
    expect(widgets.filter(item => item.type === 'chart_d')).toHaveLength(2);
    expect(widgets.filter(item => item.type === 'chart_d').map(item => item.config?.note)).toEqual(['first', 'second']);
    // Singleton types still get their usual hidden placeholders alongside the repeatable instances.
    expect(widgets.filter(item => item.type === 'kpi_a' || item.type === 'kpi_b' || item.type === 'list_c')).toHaveLength(3);
  });

  it('still forbids duplicates of a non-repeatable type', () => {
    const saved = {
      version: 1,
      widgets: [
        { id: 'list_c', type: 'list_c', x: 0, y: 0, w: 6, h: 9, hidden: false },
        { id: 'list_c-dup', type: 'list_c', x: 6, y: 0, w: 6, h: 9, hidden: false },
      ],
    } as unknown as GridLayout<Type>;
    const { widgets } = reconcileLayout(saved, { widgets: REPEATABLE_DEFS });
    expect(widgets.filter(item => item.type === 'list_c')).toHaveLength(1);
  });
});
