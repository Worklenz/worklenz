import { useEffect, useState } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout/legacy';
import 'react-grid-layout/css/styles.css';
import './overview-grid.css';
import { Col, Row } from '@/shared/antd-imports';
import type { OverviewResponse, OverviewWidgetInstance } from '@/types/client-portal/v2/overview';
import { WIDGET_META } from './overview-layout';
import { WidgetByKey } from './widget-registry';
import { WidgetEditFrame } from './WidgetEditFrame';
import { useIsDesktop } from './useIsDesktop';
import type { OverviewLayoutApi } from './useOverviewLayout';

interface GridItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const ResponsiveGrid = WidthProvider(Responsive);

const BREAKPOINTS = { lg: 996, md: 768, sm: 480, xs: 0 };
const COLS = { lg: 12, md: 12, sm: 6, xs: 1 };
const ROW_HEIGHT = 40;
const MARGIN: [number, number] = [16, 16];

interface OverviewGridProps {
  layout: OverviewLayoutApi;
  data: OverviewResponse | undefined;
  isFetching: boolean;
  onRetry: () => void;
}

/**
 * The widget grid. Positions are stored for the 12-column desktop layout; on narrow screens a stacked
 * arrangement is derived from it and drag/resize are off, so a phone never saves (or overwrites) the
 * desktop arrangement.
 */
export const OverviewGrid = ({ layout, data, isFetching, onRetry }: OverviewGridProps) => {
  const isDesktop = useIsDesktop();
  const [breakpoint, setBreakpoint] = useState('lg');
  const [flashing, setFlashing] = useState<string | null>(null);
  const { lastAdded } = layout;

  // A widget just added from "Add widget" lands at the bottom of the grid, possibly off screen: wait
  // for the grid to settle, then scroll to it, give it focus and outline it for a moment.
  useEffect(() => {
    if (!lastAdded) return undefined;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const settle = window.setTimeout(() => {
      const element = document.querySelector<HTMLElement>(`[data-widget="${lastAdded.key}"]`);
      element?.scrollIntoView?.({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
      element?.focus({ preventScroll: true });
      setFlashing(lastAdded.key);
    }, 350);
    const clear = window.setTimeout(() => setFlashing(null), 2200);
    return () => {
      window.clearTimeout(settle);
      window.clearTimeout(clear);
    };
  }, [lastAdded]);

  const isWide = breakpoint === 'lg' || breakpoint === 'md';
  const canArrange = layout.isEditing && isWide;
  const visible = layout.widgets.filter(widget => !widget.hidden);

  const renderBody = (widget: OverviewWidgetInstance) => (
    <WidgetByKey
      widgetKey={widget.key}
      result={data?.[widget.key]}
      loading={isFetching && !data?.[widget.key]}
      onRetry={onRetry}
    />
  );

  if (!isDesktop) {
    const ordered = [...visible].sort((a, b) => a.y - b.y || a.x - b.x);
    return (
      <Row gutter={[16, 16]}>
        {ordered.map(widget => (
          <Col key={widget.key} xs={widget.w <= 3 ? 12 : 24} sm={widget.w <= 3 ? 12 : 24}>
            <div style={{ height: widget.w <= 3 ? WIDGET_META[widget.key].size.h * ROW_HEIGHT : 360 }}>
              {renderBody(widget)}
            </div>
          </Col>
        ))}
      </Row>
    );
  }

  const items = visible.map(widget => ({
    i: widget.key,
    x: widget.x,
    y: widget.y,
    w: widget.w,
    h: widget.h,
    minW: WIDGET_META[widget.key].min.w,
    minH: WIDGET_META[widget.key].min.h,
  }));

  return (
    <ResponsiveGrid
      className="overview-grid"
      layouts={{ lg: items, md: items }}
      breakpoints={BREAKPOINTS}
      cols={COLS}
      rowHeight={ROW_HEIGHT}
      margin={MARGIN}
      containerPadding={[0, 0]}
      isDraggable={canArrange}
      isResizable={canArrange}
      draggableHandle=".overview-drag-handle"
      draggableCancel=".overview-no-drag"
      onBreakpointChange={(next: string) => setBreakpoint(next)}
      onLayoutChange={(current: ReadonlyArray<GridItem>) => {
        if (canArrange) layout.setGeometry(current);
      }}
    >
      {visible.map(widget => (
        <div key={widget.key} data-widget={widget.key} tabIndex={-1} style={{ outline: 'none' }}>
          <WidgetEditFrame widget={widget} isEditing={layout.isEditing} layout={layout} isFlashing={flashing === widget.key}>
            {renderBody(widget)}
          </WidgetEditFrame>
        </div>
      ))}
    </ResponsiveGrid>
  );
};
