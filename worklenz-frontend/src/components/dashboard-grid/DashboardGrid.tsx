import React, { useEffect, useState } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout/legacy';
import 'react-grid-layout/css/styles.css';
import './dashboard-grid.css';
import { Col, Row } from '@/shared/antd-imports';
import { GRID_COLS, type GridWidgetInstance, type WidgetDefinition } from './layout-model';
import { WidgetEditFrame } from './WidgetEditFrame';
import { useIsDesktop } from './useIsDesktop';
import type { DashboardLayoutApi } from './useDashboardLayoutDraft';

interface GridItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const ResponsiveGrid = WidthProvider(Responsive);

const BREAKPOINTS = { lg: 996, md: 768, sm: 480, xs: 0 };
const COLS = { lg: GRID_COLS, md: GRID_COLS, sm: 6, xs: 1 };
const ROW_HEIGHT = 40;
const MARGIN: [number, number] = [16, 16];

export interface DashboardGridProps<TType extends string, TConfig = unknown> {
  layout: DashboardLayoutApi<TType, TConfig>;
  catalogue: WidgetDefinition<TType>[];
  titleOf: (type: TType) => string;
  /** One-line "what is this" shown under each title in the empty-slot "Add widget" picker. */
  descriptionOf?: (type: TType) => string | undefined;
  renderWidget: (widget: GridWidgetInstance<TType, TConfig>) => React.ReactNode;
  /**
   * Page-level default for whether the edit frame offers "hide" (singleton) or "remove"
   * (multi-instance). A catalogue entry's own `repeatable: true` overrides this per widget type,
   * so a mostly-singleton page (Reports > Overview) can still let a few widget types repeat.
   */
  mode: 'singleton' | 'multi';
  extraSettingsFor?: (widget: GridWidgetInstance<TType, TConfig>) => React.ReactNode;
  i18nNamespace?: string;
}

/**
 * The widget grid. Positions are stored for the 12-column desktop layout; on narrow screens the
 * grid falls back to a stacked, read-only arrangement so a phone never saves (or overwrites) the
 * desktop layout. Ported from worklenz-business's client-portal-v2 overview grid.
 */
export function DashboardGrid<TType extends string, TConfig = unknown>({
  layout,
  catalogue,
  titleOf,
  renderWidget,
  mode,
  extraSettingsFor,
  i18nNamespace,
}: DashboardGridProps<TType, TConfig>) {
  const isDesktop = useIsDesktop();
  const [breakpoint, setBreakpoint] = useState('lg');
  const [flashing, setFlashing] = useState<string | null>(null);
  const { lastAdded } = layout;
  const metaOf = (type: TType) => catalogue.find(def => def.type === type);

  // A widget just added lands at the bottom of the grid, possibly off screen: wait for the grid to
  // settle, then scroll to it, give it focus and outline it for a moment.
  useEffect(() => {
    if (!lastAdded) return undefined;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const settle = window.setTimeout(() => {
      const element = document.querySelector<HTMLElement>(`[data-widget-id="${lastAdded.id}"]`);
      if (element) {
        const rect = element.getBoundingClientRect();
        const isOffScreen = rect.top < 0 || rect.bottom > window.innerHeight;
        // 'nearest' moves the page the minimum distance (and not at all if already visible), so
        // adding a widget doesn't make the whole screen jump.
        if (isOffScreen) element.scrollIntoView?.({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest' });
        element.focus({ preventScroll: true });
      }
      setFlashing(lastAdded.id);
    }, 450);
    const clear = window.setTimeout(() => setFlashing(null), 2200);
    return () => {
      window.clearTimeout(settle);
      window.clearTimeout(clear);
    };
  }, [lastAdded]);

  const isWide = breakpoint === 'lg' || breakpoint === 'md';
  const canArrange = layout.isEditing && isWide;
  const visible = layout.widgets.filter(widget => !widget.hidden);

  if (!isDesktop) {
    const ordered = [...visible].sort((a, b) => a.y - b.y || a.x - b.x);
    return (
      <Row gutter={[16, 16]}>
        {ordered.map(widget => (
          <Col key={widget.id} xs={widget.w <= 6 ? 12 : 24} sm={widget.w <= 6 ? 12 : 24}>
            <div style={{ height: (metaOf(widget.type)?.size.h ?? widget.h) * ROW_HEIGHT }}>{renderWidget(widget)}</div>
          </Col>
        ))}
      </Row>
    );
  }

  const items = visible.map(widget => ({
    i: widget.id,
    x: widget.x,
    y: widget.y,
    w: widget.w,
    h: widget.h,
    minW: metaOf(widget.type)?.min.w ?? 1,
    minH: metaOf(widget.type)?.min.h ?? 1,
  }));

  return (
    <ResponsiveGrid
      className="wl-dashboard-grid"
      layouts={{ lg: items, md: items }}
      breakpoints={BREAKPOINTS}
      cols={COLS}
      rowHeight={ROW_HEIGHT}
      margin={MARGIN}
      containerPadding={[0, 0]}
      isDraggable={canArrange}
      isResizable={canArrange}
      resizeHandles={['se', 'sw', 'ne', 'nw']}
      draggableHandle=".wl-dashboard-drag-handle"
      draggableCancel=".wl-dashboard-no-drag"
      onBreakpointChange={(next: string) => setBreakpoint(next)}
      onLayoutChange={(current: ReadonlyArray<GridItem>) => {
        if (canArrange) layout.setGeometry(current);
      }}
    >
      {visible.map(widget => {
        const meta = metaOf(widget.type);
        const title = titleOf(widget.type);
        const isMulti = mode === 'multi' || Boolean(meta?.repeatable);
        return (
          <div key={widget.id} data-widget-id={widget.id} tabIndex={-1} style={{ outline: 'none' }}>
            <WidgetEditFrame
              title={title}
              isEditing={layout.isEditing}
              isFlashing={flashing === widget.id}
              onHide={!isMulti ? () => layout.hide(widget.id) : undefined}
              onRemove={isMulti ? () => layout.remove(widget.id) : undefined}
              extraSettings={extraSettingsFor?.(widget)}
              i18nNamespace={i18nNamespace}
            >
              {renderWidget(widget)}
            </WidgetEditFrame>
          </div>
        );
      })}
    </ResponsiveGrid>
  );
}
