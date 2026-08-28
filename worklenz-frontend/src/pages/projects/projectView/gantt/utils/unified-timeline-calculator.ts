import { GanttViewMode, GanttTask } from '../types/gantt-types';

export interface TimelineColumn {
  date: Date; // start of this column's span
  endDate: Date; // inclusive end of this column's span
  index: number;
  key: string;
  width: number; // this column's own pixel width — variable for Month/Quarter/Year units
  left: number; // cumulative pixel offset from the start of the timeline
}

type TimelineUnit = 'day' | 'month' | 'year';

// Which fine-grained unit each view mode ticks by. Day and Week both tick by individual
// day — Week is not "one column per week", it's the same day-by-day ruler as Day, just
// zoomed further out (smaller pxPerDay) with a "Week N" grouping row instead of a month
// grouping row. This mirrors Planner > Timeline's TIMELINE_ZOOM_CFG exactly, and is what
// makes Day/Week immune to the variable-column-width problem entirely (every column is
// exactly one day, always pxPerDay wide) — only Month/Quarter/Year need variable widths,
// since a 28-day Feb and a 31-day Jan can't both be "one column" of equal real duration.
const UNIT_BY_VIEW_MODE: Record<GanttViewMode, TimelineUnit> = {
  day: 'day',
  week: 'day',
  month: 'month',
  quarter: 'month',
  year: 'year',
};

function daysBetween(from: Date, to: Date): number {
  // Date-only day difference via UTC epoch of each local calendar date — immune to DST
  // (a plain (to.getTime()-from.getTime())/86400000 can be off by a fractional day across
  // a DST boundary).
  const utcFrom = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const utcTo = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((utcTo - utcFrom) / 86400000);
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Unified Timeline Calculator
 *
 * Single-formula continuous model, matching Planner > Timeline's zoom mechanism: every
 * position on the timeline — grid columns, header cells, task bars, the today line — is
 * `daysSinceRangeStart(date) * pxPerDay`. There is exactly one source of truth (rangeStart
 * + pxPerDay), so there is no separate "grid" computation that can drift out of alignment
 * with the header or with where a task bar actually renders — which is what the old
 * column-count/column-width-based model kept doing at Week/Month zoom.
 */
export class UnifiedTimelineCalculator {
  private viewMode: GanttViewMode;
  private unit: TimelineUnit;
  private pxPerDay: number;
  private rangeStart: Date;
  private rangeEnd: Date;
  private columns: TimelineColumn[];
  private totalWidth: number;

  constructor(viewMode: GanttViewMode, dateRange: { start: Date; end: Date }, pxPerDay: number) {
    this.viewMode = viewMode;
    this.unit = UNIT_BY_VIEW_MODE[viewMode] ?? 'day';
    this.pxPerDay = pxPerDay > 0 ? pxPerDay : 1;
    this.rangeStart = startOfDay(dateRange.start);
    this.rangeEnd = new Date(dateRange.end);
    this.columns = this.generateColumns();
    const last = this.columns[this.columns.length - 1];
    this.totalWidth = last ? last.left + last.width : 0;
  }

  private columnKey(date: Date): string {
    switch (this.unit) {
      case 'day':
        return `day-${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      case 'month':
        return `month-${date.getFullYear()}-${date.getMonth()}`;
      case 'year':
        return `year-${date.getFullYear()}`;
    }
  }

  private generateColumns(): TimelineColumn[] {
    const columns: TimelineColumn[] = [];
    let cursor = new Date(this.rangeStart);
    let left = 0;
    let index = 0;

    // Safety cap so a misconfigured range can never spin the loop forever.
    const MAX_COLUMNS = 20000;

    while (cursor <= this.rangeEnd && index < MAX_COLUMNS) {
      let stepEnd: Date; // exclusive — start of the next column
      let colEndDate: Date; // inclusive end date of this column's own span

      if (this.unit === 'day') {
        stepEnd = new Date(cursor);
        stepEnd.setDate(stepEnd.getDate() + 1);
        colEndDate = new Date(cursor);
      } else if (this.unit === 'month') {
        stepEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
        colEndDate = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
      } else {
        stepEnd = new Date(cursor.getFullYear() + 1, 0, 1);
        colEndDate = new Date(cursor.getFullYear(), 11, 31);
      }

      const days = Math.max(1, daysBetween(cursor, stepEnd));
      const width = days * this.pxPerDay;

      columns.push({
        date: new Date(cursor),
        endDate: colEndDate,
        index,
        key: this.columnKey(cursor),
        width,
        left,
      });

      left += width;
      cursor = stepEnd;
      index++;
    }

    return columns;
  }

  /**
   * Calculate task bar position and width — a pure continuous day-based formula, the same
   * one used to size every column's width above, so a bar can never drift out of alignment
   * with the grid/header regardless of zoom level or how far it is from the range start.
   */
  calculateTaskPosition(
    startDate: Date | null,
    endDate: Date | null
  ): {
    left: number;
    width: number;
    isValid: boolean;
  } {
    if (!startDate || !endDate) {
      return { left: 0, width: 0, isValid: false };
    }

    const start = startOfDay(startDate);
    const end = startOfDay(endDate);

    // Clamp both bounds against the timeline range — a task whose dates fall outside a
    // stale/just-recomputed range (e.g. right after editing a due date) should sit at the
    // grid's edge rather than push the bar (and scrollable area) out to an arbitrary offset.
    const minWidth = this.pxPerDay * 0.3;
    const rawLeft = daysBetween(this.rangeStart, start) * this.pxPerDay;
    const left = this.totalWidth > 0 ? Math.max(0, Math.min(rawLeft, this.totalWidth)) : Math.max(0, rawLeft);

    const rawWidth = (daysBetween(start, end) + 1) * this.pxPerDay;
    const maxWidth = this.totalWidth > 0 ? Math.max(minWidth, this.totalWidth - left) : rawWidth;
    const width = Math.max(minWidth, Math.min(rawWidth, maxWidth));

    return { left, width, isValid: true };
  }

  /**
   * Convert a pixel position back to a date, with fractional-hour precision (matching the
   * old Day-view "hour within the column" behavior) — same continuous formula in reverse.
   */
  pixelPositionToDate(pixelPosition: number): Date {
    const fractionalDays = Math.max(0, pixelPosition / this.pxPerDay);
    const wholeDays = Math.floor(fractionalDays);
    const hourFraction = (fractionalDays - wholeDays) * 24;

    const result = new Date(this.rangeStart);
    result.setDate(result.getDate() + wholeDays);
    result.setHours(Math.floor(hourFraction), Math.round((hourFraction % 1) * 60), 0, 0);
    return result;
  }

  /**
   * Find the column whose span contains the given date (e.g. for "is this column today").
   */
  getColumnAtDate(date: Date): TimelineColumn | null {
    const target = startOfDay(date).getTime();
    for (const column of this.columns) {
      const colStart = startOfDay(column.date).getTime();
      const colEnd = new Date(column.endDate);
      colEnd.setHours(23, 59, 59, 999);
      if (target >= colStart && target <= colEnd.getTime()) {
        return column;
      }
    }
    return null;
  }

  getColumn(index: number): TimelineColumn | null {
    return this.columns[index] ?? null;
  }

  getColumns(): TimelineColumn[] {
    return this.columns;
  }

  getTotalWidth(): number {
    return this.totalWidth;
  }

  getPxPerDay(): number {
    return this.pxPerDay;
  }

  getUnit(): TimelineUnit {
    return this.unit;
  }

  /**
   * Create date range that aligns with view mode boundaries — rounds to whichever unit
   * the top grouping row uses (Day/Week round to a unit their topUnit needs: Day groups by
   * month, Week groups by whole weeks; Month/Quarter/Year round to whole years), then pads
   * by one of that same unit on each side, so the first/last group is never a partial one.
   * Mirrors Planner > Timeline's topUnit-based boundary rounding, applied dynamically off
   * the actual earliest/latest task dates rather than a fixed window.
   */
  static createAlignedDateRange(
    tasks: GanttTask[],
    viewMode: GanttViewMode,
    padding: boolean = true
  ): { start: Date; end: Date } {
    if (!tasks.length) {
      const today = new Date();
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 6, 0);
      return { start, end };
    }

    let earliestDate: Date | null = null;
    let latestDate: Date | null = null;

    const collectDates = (taskList: GanttTask[]) => {
      taskList.forEach(task => {
        if (task.start_date) {
          if (!earliestDate || task.start_date < earliestDate) {
            earliestDate = task.start_date;
          }
        }
        if (task.end_date) {
          if (!latestDate || task.end_date > latestDate) {
            latestDate = task.end_date;
          }
        }
        if (task.children) {
          collectDates(task.children);
        }
      });
    };

    collectDates(tasks);

    let start: Date;
    let end: Date;

    if (earliestDate && latestDate) {
      start = new Date(earliestDate);
      end = new Date(latestDate);
    } else if (earliestDate) {
      start = new Date(earliestDate);
      end = new Date(earliestDate);
      end.setDate(end.getDate() + 30);
    } else if (latestDate) {
      end = new Date(latestDate);
      start = new Date(latestDate);
      start.setDate(start.getDate() - 30);
    } else {
      const today = new Date();
      start = new Date(today);
      start.setDate(start.getDate() - 15);
      end = new Date(today);
      end.setDate(end.getDate() + 15);
    }

    switch (viewMode) {
      case 'day':
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        end.setMonth(end.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
        if (padding) {
          start.setMonth(start.getMonth() - 1);
          end.setMonth(end.getMonth() + 1);
        }
        break;
      case 'week':
        // Round to whole weeks (Sunday-to-Saturday) — Week zoom groups its top header row
        // by week number, so a partial week at either edge would look like a cut-off group.
        start.setDate(start.getDate() - start.getDay());
        start.setHours(0, 0, 0, 0);
        end.setDate(end.getDate() + (6 - end.getDay()));
        end.setHours(23, 59, 59, 999);
        if (padding) {
          start.setDate(start.getDate() - 7);
          end.setDate(end.getDate() + 7);
        }
        break;
      case 'month':
        start.setMonth(0, 1);
        start.setHours(0, 0, 0, 0);
        end.setMonth(11, 31);
        end.setHours(23, 59, 59, 999);
        if (padding) {
          start.setFullYear(start.getFullYear() - 1);
          end.setFullYear(end.getFullYear() + 1);
        }
        break;
      case 'quarter': {
        const startQuarter = Math.floor(start.getMonth() / 3);
        const endQuarter = Math.floor(end.getMonth() / 3);
        start.setMonth(startQuarter * 3, 1);
        start.setHours(0, 0, 0, 0);
        end.setMonth((endQuarter + 1) * 3, 0);
        end.setHours(23, 59, 59, 999);
        if (padding) {
          start.setMonth(start.getMonth() - 3);
          end.setMonth(end.getMonth() + 3);
        }
        break;
      }
      case 'year':
        start.setMonth(0, 1);
        start.setHours(0, 0, 0, 0);
        end.setMonth(11, 31);
        end.setHours(23, 59, 59, 999);
        if (padding) {
          start.setFullYear(start.getFullYear() - 1);
          end.setFullYear(end.getFullYear() + 1);
        }
        break;
    }

    return { start, end };
  }
}
