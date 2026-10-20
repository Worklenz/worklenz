import './dashboard-stack.css';
import { WIDGET_COMPONENTS } from './widgets';
import type { ClientDashboardV2, DashboardWidgetInstance } from '@/types/v2';

const CHART_HEIGHT = 320;

const isTile = (widget: DashboardWidgetInstance): boolean => widget.type.startsWith('tile-');
const isHalf = (widget: DashboardWidgetInstance): boolean => !isTile(widget) && widget.w <= 6;

type Block = { kind: 'tiles'; widgets: DashboardWidgetInstance[] } | { kind: 'widget'; widget: DashboardWidgetInstance; wide: boolean };

/**
 * Groups the arranged widgets into blocks: neighbouring summary tiles share one evenly filled row,
 * half-width widgets pair up two across, and a half-width widget left without a partner spans the row
 * instead of leaving a hole.
 */
const toBlocks = (ordered: DashboardWidgetInstance[]): Block[] => {
  const blocks: Block[] = [];
  let halfRun: Array<Extract<Block, { kind: 'widget' }>> = [];
  const closeHalfRun = () => {
    if (halfRun.length % 2 === 1) halfRun[halfRun.length - 1].wide = true;
    halfRun = [];
  };
  for (const widget of ordered) {
    if (isTile(widget)) {
      closeHalfRun();
      const last = blocks[blocks.length - 1];
      if (last?.kind === 'tiles') last.widgets.push(widget);
      else blocks.push({ kind: 'tiles', widgets: [widget] });
    } else if (isHalf(widget)) {
      const block: Extract<Block, { kind: 'widget' }> = { kind: 'widget', widget, wide: false };
      blocks.push(block);
      halfRun.push(block);
    } else {
      closeHalfRun();
      blocks.push({ kind: 'widget', widget, wide: true });
    }
  }
  closeHalfRun();
  return blocks;
};

/**
 * The overview below desktop width: widgets flow in reading order (top to bottom, left to right as
 * arranged on desktop) with natural heights, so nothing is cramped or clipped inside a fixed-height
 * cell. Arranging is a desktop feature; this view is read-only.
 */
export const DashboardStack = ({ data, widgets }: { data: ClientDashboardV2; widgets: DashboardWidgetInstance[] }) => {
  const ordered = widgets.filter(widget => !widget.hidden).sort((a, b) => a.y - b.y || a.x - b.x);
  return (
    <div className="dashboard-stack">
      {toBlocks(ordered).map(block => {
        if (block.kind === 'tiles') {
          return (
            <div key={block.widgets.map(widget => widget.type).join('+')} className="dashboard-stack__item dashboard-stack__tiles">
              {block.widgets.map(widget => {
                const Body = WIDGET_COMPONENTS[widget.type];
                return <Body key={widget.type} data={data} settings={widget.settings} />;
              })}
            </div>
          );
        }
        const { widget, wide } = block;
        const Body = WIDGET_COMPONENTS[widget.type];
        return (
          <div
            key={widget.type}
            className={`dashboard-stack__item ${wide ? 'dashboard-stack__item--wide' : 'dashboard-stack__item--half'}`}
            style={widget.type.startsWith('chart-') ? { height: CHART_HEIGHT } : undefined}
          >
            <Body data={data} settings={widget.settings} />
          </div>
        );
      })}
    </div>
  );
};
