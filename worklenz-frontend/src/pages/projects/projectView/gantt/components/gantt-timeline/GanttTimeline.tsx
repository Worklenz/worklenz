import React, { memo, useMemo, forwardRef, RefObject } from 'react';
import { theme } from '@/shared/antd-imports';
import { GanttViewMode } from '../../types/gantt-types';
import { TimelineUtils } from '../../utils/timeline-calculator';
import { useGanttContext } from '../../context/gantt-context';
import { useAppSelector } from '@/hooks/useAppSelector';

// Week zoom ticks by individual day, same as Day zoom (just narrower/zoomed further out) —
// it is not "one column per week". Only Month/Quarter/Year tick by a coarser unit, so this
// treats Day and Week identically wherever the fine (bottom) row's per-column look is
// decided, matching Planner > Timeline's TIMELINE_ZOOM_CFG (`unit: 'day'` for both).
const isDayTickMode = (viewMode: GanttViewMode) => viewMode === 'day' || viewMode === 'week';

// Bottom (fine) row label for a single column.
const getColumnLabel = (column: { date: Date }, viewMode: GanttViewMode): string => {
  const date = column.date;
  if (isDayTickMode(viewMode)) return date.getDate().toString();
  switch (viewMode) {
    case 'month':
      return date.toLocaleDateString('en-US', { month: 'short' });
    case 'quarter':
      return `Q${Math.ceil((date.getMonth() + 1) / 3)} ${date.getFullYear()}`;
    case 'year':
      return date.getFullYear().toString();
    default:
      return date.toLocaleDateString();
  }
};

// Day/Week stack a weekday abbreviation above the day number (e.g. "Mon" / "12"), matching
// Planner > Timeline's Days/Weeks zoom column cells exactly.
const getColumnSubLabel = (column: { date: Date }, viewMode: GanttViewMode): string | undefined => {
  if (!isDayTickMode(viewMode)) return undefined;
  return column.date.toLocaleDateString('en-US', { weekday: 'short' });
};

const isWeekendColumn = (column: { date: Date }, viewMode: GanttViewMode): boolean => {
  if (!isDayTickMode(viewMode)) return false;
  const day = column.date.getDay();
  return day === 0 || day === 6;
};

// Top (coarse) grouping row: which group a column's date belongs to, and that group's
// label — Day groups by month, Week groups by week number ("Week 23"), Month groups by
// year, Quarter groups by quarter. Year has no top row (topUnit === null in Planner's
// equivalent config). Mirrors PlannerTimelineView's TIMELINE_ZOOM_CFG.topUnit exactly.
const getTopGroupKey = (date: Date, viewMode: GanttViewMode): string | null => {
  switch (viewMode) {
    case 'day':
      return `month-${date.getFullYear()}-${date.getMonth()}`;
    case 'week':
      return `week-${date.getFullYear()}-${TimelineUtils.getWeekNumber(date)}`;
    case 'month':
      return `year-${date.getFullYear()}`;
    case 'quarter':
      return `quarter-${date.getFullYear()}-${Math.ceil((date.getMonth() + 1) / 3)}`;
    case 'year':
    default:
      return null;
  }
};

// Whether a given view mode renders a top grouping row at all — derived from getTopGroupKey
// itself (only 'year' has none) rather than a separately maintained list of view modes, so
// GanttTaskList.tsx's header-height calc can share this instead of hardcoding its own copy
// that would silently drift if a view mode's grouping ever changes.
export const hasTopHeaderRow = (viewMode: GanttViewMode): boolean =>
  getTopGroupKey(new Date(), viewMode) !== null;

const getTopGroupLabel = (date: Date, viewMode: GanttViewMode): string => {
  switch (viewMode) {
    case 'day':
      return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    case 'week':
      // Include the month alongside the week number — a bare "Week 25" gives no sense
      // of when that week actually falls without counting columns back to the nearest
      // month boundary.
      return `Week ${TimelineUtils.getWeekNumber(date)} · ${date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
    case 'month':
      return `${date.getFullYear()}`;
    case 'quarter':
      return `Q${Math.ceil((date.getMonth() + 1) / 3)} ${date.getFullYear()}`;
    default:
      return '';
  }
};

interface GanttTimelineProps {
  viewMode: GanttViewMode;
  containerRef: RefObject<HTMLDivElement | null>;
  dateRange?: { start: Date; end: Date };
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
}

const GanttTimeline = forwardRef<HTMLDivElement, GanttTimelineProps>(
  ({ viewMode, onScroll }, ref) => {
    // Get timeline calculator, highlighted date range, and shouldScroll from context
    const { timelineCalculator, highlightedDateRange, shouldScroll } = useGanttContext();
    const { token } = theme.useToken();
    const themeMode = useAppSelector(state => state.themeReducer.mode);
    // Dim the header's column dividers to match GanttChart.tsx's GridColumn lines below —
    // full-strength colorBorderSecondary reads much heavier in dark mode across this many
    // adjacent vertical lines than it does for a single border elsewhere.
    const gridBorderColor = themeMode === 'dark' ? `${token.colorBorderSecondary}40` : token.colorBorderSecondary;

    // Bottom (fine) row — one cell per real timelineCalculator column, each using its own
    // width (uniform for Day/Week's day-ticks, variable per real month for Month) rather
    // than a single shared column width. This is what keeps the header's cells exactly the
    // width GanttChart.tsx's grid columns and task bars use, since both read from the same
    // calculator instance.
    const bottomColumns = useMemo(() => {
      if (!timelineCalculator) return [];
      return timelineCalculator.getColumns().map((column: any) => ({
        key: column.key,
        date: column.date as Date,
        width: column.width as number,
        label: getColumnLabel(column, viewMode),
        subLabel: getColumnSubLabel(column, viewMode),
        isWeekend: isWeekendColumn(column, viewMode),
      }));
    }, [timelineCalculator, viewMode]);

    // Top (coarse) grouping row — spans consecutive bottom columns that share the same
    // group key, its width the sum of those columns' real widths (mirrors Planner >
    // Timeline's topGroups builder exactly).
    const topGroups = useMemo(() => {
      const groups: Array<{ key: string; label: string; width: number }> = [];
      bottomColumns.forEach(column => {
        const key = getTopGroupKey(column.date, viewMode);
        if (key === null) return;
        const last = groups[groups.length - 1];
        if (last && last.key === key) {
          last.width += column.width;
        } else {
          groups.push({ key, label: getTopGroupLabel(column.date, viewMode), width: column.width });
        }
      });
      return groups;
    }, [bottomColumns, viewMode]);

    const totalWidth = timelineCalculator ? timelineCalculator.getTotalWidth() : 0;

    const hasTopHeaders = topGroups.length > 0;
    // Header row heights match Planner > Timeline's TOP_HEADER_HEIGHT/UNIT_HEADER_HEIGHT
    // constants exactly, instead of the much taller h-20/h-10 (80px/40px) this used before.
    const TOP_HEADER_HEIGHT = 24;
    const UNIT_HEADER_HEIGHT = 34;

    return (
      <div
        ref={ref}
        onScroll={onScroll}
        className={`flex-shrink-0 overflow-y-hidden ${
          shouldScroll ? 'overflow-x-auto' : 'overflow-x-hidden'
        } scrollbar-hide flex flex-col`}
        style={{
          height: hasTopHeaders ? TOP_HEADER_HEIGHT + UNIT_HEADER_HEIGHT : UNIT_HEADER_HEIGHT,
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          backgroundColor: token.colorBgContainer,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        {hasTopHeaders && (
          <div
            className="flex"
            style={{
              width: `${totalWidth}px`,
              minWidth: shouldScroll ? 'auto' : '100%',
              height: TOP_HEADER_HEIGHT,
              borderBottom: `1px solid ${token.colorBorderSecondary}`,
            }}
          >
            {topGroups.map(header => (
              <div
                key={header.key}
                className="flex items-center justify-center text-center text-xs font-semibold text-gray-800 dark:text-gray-200 flex-shrink-0 px-2 whitespace-nowrap"
                style={{
                  width: `${header.width}px`,
                  borderRight: `1px solid ${gridBorderColor}`,
                }}
                title={header.label}
              >
                {header.label}
              </div>
            ))}
          </div>
        )}
        <div
          className="flex"
          style={{ width: `${totalWidth}px`, minWidth: shouldScroll ? 'auto' : '100%', height: UNIT_HEADER_HEIGHT }}
        >
          {bottomColumns.map((header, index) => {
            // Check if this column should be highlighted
            let isHighlighted = false;

            if (highlightedDateRange) {
              const colDate = new Date(header.date);
              colDate.setHours(0, 0, 0, 0);

              const highlightStart = new Date(highlightedDateRange.start);
              highlightStart.setHours(0, 0, 0, 0);

              const highlightEnd = new Date(highlightedDateRange.end);
              highlightEnd.setHours(0, 0, 0, 0);

              isHighlighted = colDate >= highlightStart && colDate <= highlightEnd;
            }

            return (
            <div
              key={header.key}
              className={`flex flex-col items-center justify-center text-center text-xs font-medium text-gray-700 dark:text-gray-300 flex-shrink-0 ${
                isDayTickMode(viewMode) ? 'px-1' : 'px-2'
              } ${
                isDayTickMode(viewMode) && header.width < 50
                  ? 'whitespace-nowrap overflow-hidden text-ellipsis'
                  : 'whitespace-nowrap'
              }`}
              style={{
                width: `${header.width}px`,
                borderRight: `1px solid ${gridBorderColor}`,
                backgroundColor: isHighlighted
                  ? `${token.colorPrimary}26`
                  : header.isWeekend
                    ? token.colorFillQuaternary
                    : undefined,
              }}
              title={header.label}
            >
              {header.subLabel && (
                <span style={{ fontSize: 12, fontWeight: 500, opacity: 0.55, lineHeight: 1.3 }}>
                  {header.subLabel}
                </span>
              )}
              <span style={{ lineHeight: 1.3 }}>{header.label}</span>
            </div>
            );
          })}
        </div>
      </div>
    );
  }
);

GanttTimeline.displayName = 'GanttTimeline';

export default memo(GanttTimeline);
