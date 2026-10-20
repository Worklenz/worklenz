import { useEffect, useState } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout/legacy';
import 'react-grid-layout/css/styles.css';
import './dashboard-grid.css';
import { WIDGET_META } from './layoutModel';
import { WIDGET_COMPONENTS } from './widgets';
import { WidgetFrame } from './WidgetFrame';
import { DashboardStack } from './DashboardStack';
import { useIsDesktop } from './useIsDesktop';
import type { DashboardLayoutApi } from './useDashboardLayout';
import type { ClientDashboardV2 } from '@/types/v2';

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

interface DashboardGridProps {
  data: ClientDashboardV2;
  layout: DashboardLayoutApi;
}

/**
 * The widget grid. Positions are stored for the 12-column desktop layout; on narrow screens the grid
 * derives a stacked arrangement from it and drag/resize are switched off, so a phone never saves
 * (or overwrites) the desktop arrangement.
 */
export const DashboardGrid = ({ data, layout }: DashboardGridProps) => {
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
      const element = document.querySelector<HTMLElement>(`[data-widget="${lastAdded.type}"]`);
      element?.scrollIntoView?.({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
      element?.focus({ preventScroll: true });
      setFlashing(lastAdded.type);
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

  if (!isDesktop) return <DashboardStack data={data} widgets={layout.widgets} />;

  const items = visible.map(widget => ({
    i: widget.type,
    x: widget.x,
    y: widget.y,
    w: widget.w,
    h: widget.h,
    minW: WIDGET_META[widget.type].min.w,
    minH: WIDGET_META[widget.type].min.h,
  }));

  return (
    <ResponsiveGrid
      className="dashboard-grid"
      layouts={{ lg: items, md: items }}
      breakpoints={BREAKPOINTS}
      cols={COLS}
      rowHeight={ROW_HEIGHT}
      margin={MARGIN}
      containerPadding={[0, 0]}
      isDraggable={canArrange}
      isResizable={canArrange}
      draggableHandle=".dashboard-drag-handle"
      draggableCancel=".dashboard-no-drag"
      onBreakpointChange={(next: string) => setBreakpoint(next)}
      onLayoutChange={(current: ReadonlyArray<GridItem>) => {
        if (canArrange) layout.setGeometry(current);
      }}
    >
      {visible.map(widget => {
        const Body = WIDGET_COMPONENTS[widget.type];
        return (
          <div key={widget.type} data-widget={widget.type} tabIndex={-1} style={{ outline: 'none' }}>
            <WidgetFrame
              widget={widget}
              isEditing={layout.isEditing}
              layout={layout}
              projects={data.projects}
              isFlashing={flashing === widget.type}
            >
              <Body data={data} settings={widget.settings} />
            </WidgetFrame>
          </div>
        );
      })}
    </ResponsiveGrid>
  );
};
