import { describe, expect, it } from 'vitest';
import {
  OVERVIEW_WIDGET_KEYS,
  type OverviewLayout,
  type OverviewLayoutItem,
} from '@/types/client-portal/v2/overview';
import { applyGeometry, defaultLayout, moveWidget, reconcileLayout, visibleKeys } from './overview-layout';

describe('overview layout', () => {
  it('default layout lists every widget exactly once, overdue invoices hidden', () => {
    const { widgets } = defaultLayout();
    expect(widgets.map(item => item.key).sort()).toEqual([...OVERVIEW_WIDGET_KEYS].sort());
    expect(widgets.find(item => item.key === 'kpi_overdue_invoices')?.hidden).toBe(true);
  });

  it('falls back to the default when nothing is saved', () => {
    expect(reconcileLayout(null)).toEqual(defaultLayout());
    expect(reconcileLayout(undefined)).toEqual(defaultLayout());
  });

  it('keeps the saved geometry and appends missing widgets hidden', () => {
    const saved: OverviewLayout = {
      version: 1,
      widgets: [{ key: 'mentions_me', x: 0, y: 0, w: 12, h: 8, hidden: false }],
    };
    const { widgets } = reconcileLayout(saved);
    expect(widgets[0]).toEqual(saved.widgets[0]);
    expect(widgets).toHaveLength(OVERVIEW_WIDGET_KEYS.length);
    expect(widgets.slice(1).every(item => item.hidden)).toBe(true);
  });

  it('drops unknown and duplicate keys and clamps geometry', () => {
    const saved = {
      version: 1,
      widgets: [
        { key: 'gone_widget', x: 0, y: 0, w: 6, h: 6, hidden: false },
        { key: 'mentions_me', x: 20, y: 0, w: 99, h: 1, hidden: false },
        { key: 'mentions_me', x: 0, y: 0, w: 6, h: 6, hidden: true },
      ],
    } as unknown as OverviewLayout;
    const { widgets } = reconcileLayout(saved);
    expect(widgets.filter(item => item.key === 'mentions_me')).toEqual([
      { key: 'mentions_me', x: 0, y: 0, w: 12, h: 4, hidden: false },
    ]);
    expect(widgets.some(item => (item.key as string) === 'gone_widget')).toBe(false);
  });

  it('converts the legacy list shape', () => {
    const legacy: OverviewLayoutItem[] = [
      { key: 'kpi_awaiting_approvals', size: 's', visible: true },
      { key: 'mentions_me', size: 'l', visible: true },
      { key: 'pending_approvals', size: 'm', visible: false },
    ];
    const { widgets } = reconcileLayout(legacy);
    expect(widgets[0]).toMatchObject({ key: 'kpi_awaiting_approvals', x: 0, y: 0, w: 3, hidden: false });
    expect(widgets[1]).toMatchObject({ key: 'mentions_me', x: 0, w: 12, hidden: false });
    expect(widgets[1].y).toBeGreaterThan(0);
    expect(widgets[2]).toMatchObject({ key: 'pending_approvals', hidden: true });
    expect(widgets).toHaveLength(OVERVIEW_WIDGET_KEYS.length);
  });

  it('moves widgets, applies geometry and lists visible keys', () => {
    const { widgets } = defaultLayout();
    const moved = moveWidget(widgets, 'kpi_unread_discussions', -1);
    const before = widgets.find(item => item.key === 'kpi_delayed_milestones')!;
    expect(moved.find(item => item.key === 'kpi_unread_discussions')).toMatchObject({ x: before.x, y: before.y });

    expect(applyGeometry(widgets, [])).toBe(widgets);
    const changed = applyGeometry(widgets, [{ i: 'mentions_me', x: 0, y: 40, w: 12, h: 8 }]);
    expect(changed.find(item => item.key === 'mentions_me')).toMatchObject({ y: 40, w: 12 });

    expect(visibleKeys(widgets)).not.toContain('kpi_overdue_invoices');
  });
});
