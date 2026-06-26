import { GanttViewMode, GanttTask } from '../types/gantt-types';

export interface TimelineColumn {
  date: Date;
  index: number;
  key: string;
  width: number;
}

export interface TimelineConfiguration {
  columns: TimelineColumn[];
  totalWidth: number;
  startDate: Date;
  endDate: Date;
  pixelsPerDay: number;
}

/**
 * Unified Timeline Calculator
 * This class ensures consistent timeline calculations across all components
 */
export class UnifiedTimelineCalculator {
  private config: TimelineConfiguration;
  private viewMode: GanttViewMode;
  private columnWidth: number;

  constructor(viewMode: GanttViewMode, dateRange: { start: Date; end: Date }, columnWidth: number) {
    console.log('UnifiedTimelineCalculator constructor:', {
      viewMode,
      dateRange: {
        start: dateRange.start,
        end: dateRange.end,
        daysDiff: Math.ceil(
          (dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24)
        ),
      },
      columnWidth,
    });

    this.viewMode = viewMode;
    this.columnWidth = columnWidth;
    this.config = this.generateTimelineConfiguration(viewMode, dateRange, columnWidth);

    console.log('Generated timeline config:', {
      columnsCount: this.config.columns.length,
      totalWidth: this.config.totalWidth,
      pixelsPerDay: this.config.pixelsPerDay,
      firstColumn: this.config.columns[0],
      lastColumn: this.config.columns[this.config.columns.length - 1],
    });
  }

  /**
   * Generate timeline configuration with exact column-to-date mapping
   */
  private generateTimelineConfiguration(
    viewMode: GanttViewMode,
    dateRange: { start: Date; end: Date },
    columnWidth: number
  ): TimelineConfiguration {
    const columns: TimelineColumn[] = [];
    const { start, end } = dateRange;

    switch (viewMode) {
      case 'day': {
        const current = new Date(start);
        let index = 0;
        while (current <= end) {
          columns.push({
            date: new Date(current),
            index,
            key: `day-${current.getFullYear()}-${current.getMonth()}-${current.getDate()}`,
            width: columnWidth,
          });
          current.setDate(current.getDate() + 1);
          index++;
        }
        break;
      }

      case 'week': {
        const current = new Date(start);
        // Align to start of week (Sunday)
        current.setDate(current.getDate() - current.getDay());
        let index = 0;
        while (current <= end) {
          columns.push({
            date: new Date(current),
            index,
            key: `week-${current.getFullYear()}-${this.getWeekNumber(current)}`,
            width: columnWidth,
          });
          current.setDate(current.getDate() + 7);
          index++;
        }
        break;
      }

      case 'month': {
        const startYear = start.getFullYear();
        const startMonth = start.getMonth();
        const endYear = end.getFullYear();
        const endMonth = end.getMonth();

        let currentYear = startYear;
        let currentMonth = startMonth;
        let index = 0;

        while (currentYear < endYear || (currentYear === endYear && currentMonth <= endMonth)) {
          const date = new Date(currentYear, currentMonth, 1);
          columns.push({
            date,
            index,
            key: `month-${currentYear}-${currentMonth}`,
            width: columnWidth,
          });

          currentMonth++;
          if (currentMonth > 11) {
            currentMonth = 0;
            currentYear++;
          }
          index++;
        }
        break;
      }

      case 'quarter': {
        const startYear = start.getFullYear();
        const startQuarter = Math.ceil((start.getMonth() + 1) / 3);
        const endYear = end.getFullYear();
        const endQuarter = Math.ceil((end.getMonth() + 1) / 3);

        let currentYear = startYear;
        let currentQuarter = startQuarter;
        let index = 0;

        while (currentYear < endYear || (currentYear === endYear && currentQuarter <= endQuarter)) {
          const quarterStartMonth = (currentQuarter - 1) * 3;
          const date = new Date(currentYear, quarterStartMonth, 1);
          columns.push({
            date,
            index,
            key: `quarter-${currentYear}-${currentQuarter}`,
            width: columnWidth,
          });

          currentQuarter++;
          if (currentQuarter > 4) {
            currentQuarter = 1;
            currentYear++;
          }
          index++;
        }
        break;
      }

      case 'year': {
        const startYear = start.getFullYear();
        const endYear = end.getFullYear();
        let index = 0;

        for (let year = startYear; year <= endYear; year++) {
          columns.push({
            date: new Date(year, 0, 1),
            index,
            key: `year-${year}`,
            width: columnWidth,
          });
          index++;
        }
        break;
      }
    }

    const totalWidth = columns.length * columnWidth;
    const totalTimeSpan = end.getTime() - start.getTime();
    const pixelsPerDay = totalWidth / (totalTimeSpan / (1000 * 60 * 60 * 24));

    return {
      columns,
      totalWidth,
      startDate: start,
      endDate: end,
      pixelsPerDay,
    };
  }

  /**
   * Calculate task bar position and width based on timeline columns
   */
  calculateTaskPosition(
    startDate: Date | null,
    endDate: Date | null
  ): {
    left: number;
    width: number;
    isValid: boolean;
  } {
    if (!startDate || !endDate || this.config.columns.length === 0) {
      return { left: 0, width: 0, isValid: false };
    }

    // For day view, use precise column-based positioning
    if (this.viewMode === 'day') {
      return this.calculateDayViewPosition(startDate, endDate);
    }

    // For other view modes, use percentage-based positioning
    const startPosition = this.dateToPixelPosition(startDate);
    const endPosition = this.dateToPixelPosition(endDate);

    const left = Math.max(0, startPosition);
    const width = Math.max(this.columnWidth * 0.1, endPosition - startPosition);

    return {
      left,
      width,
      isValid: true,
    };
  }

  /**
   * Calculate precise position for day view by finding exact column matches
   */
  private calculateDayViewPosition(
    startDate: Date,
    endDate: Date
  ): {
    left: number;
    width: number;
    isValid: boolean;
  } {
    // Normalize dates to start of day for comparison
    const startDay = new Date(startDate);
    startDay.setHours(0, 0, 0, 0);

    const endDay = new Date(endDate);
    endDay.setHours(0, 0, 0, 0);

    // Find start and end column indices
    let startColumnIndex = -1;
    let endColumnIndex = -1;

    for (let i = 0; i < this.config.columns.length; i++) {
      const columnDate = new Date(this.config.columns[i].date);
      columnDate.setHours(0, 0, 0, 0);

      // Find the first column that matches or is after the start date
      if (startColumnIndex === -1 && columnDate.getTime() === startDay.getTime()) {
        startColumnIndex = i;
      }

      // Find the last column that matches the end date
      if (columnDate.getTime() === endDay.getTime()) {
        endColumnIndex = i;
      }
    }

    // If we didn't find exact matches, find the closest columns
    if (startColumnIndex === -1) {
      for (let i = 0; i < this.config.columns.length; i++) {
        const columnDate = new Date(this.config.columns[i].date);
        columnDate.setHours(0, 0, 0, 0);

        if (columnDate.getTime() >= startDay.getTime()) {
          startColumnIndex = i;
          break;
        }
      }
    }

    if (endColumnIndex === -1) {
      for (let i = this.config.columns.length - 1; i >= 0; i--) {
        const columnDate = new Date(this.config.columns[i].date);
        columnDate.setHours(0, 0, 0, 0);

        if (columnDate.getTime() <= endDay.getTime()) {
          endColumnIndex = i;
        } else {
          break;
        }
      }
    }

    // If we couldn't find exact matches, fall back to percentage-based
    if (startColumnIndex === -1 || endColumnIndex === -1) {
      const startPosition = this.dateToPixelPosition(startDate);
      const endPosition = this.dateToPixelPosition(endDate);

      return {
        left: Math.max(0, startPosition),
        width: Math.max(this.columnWidth * 0.1, endPosition - startPosition),
        isValid: true,
      };
    }

    const left = startColumnIndex * this.columnWidth;
    const width = Math.max(
      this.columnWidth,
      (endColumnIndex - startColumnIndex + 1) * this.columnWidth
    );

    return {
      left,
      width,
      isValid: true,
    };
  }

  /**
   * Convert date to exact pixel position on timeline
   */
  private dateToPixelPosition(date: Date): number {
    const targetTime = date.getTime();
    const timelineStartTime = this.config.startDate.getTime();
    const timelineEndTime = this.config.endDate.getTime();

    // Clamp date to timeline bounds
    const clampedTime = Math.max(timelineStartTime, Math.min(timelineEndTime, targetTime));

    // Calculate position as percentage of total timeline
    const timeProgress = (clampedTime - timelineStartTime) / (timelineEndTime - timelineStartTime);

    return timeProgress * this.config.totalWidth;
  }

  /**
   * Convert pixel position to date
   */
  pixelPositionToDate(pixelPosition: number): Date {
    const progress = Math.max(0, Math.min(1, pixelPosition / this.config.totalWidth));
    const timelineSpan = this.config.endDate.getTime() - this.config.startDate.getTime();
    const targetTime = this.config.startDate.getTime() + progress * timelineSpan;

    return new Date(targetTime);
  }

  /**
   * Find which column a pixel position falls into
   */
  pixelToColumnIndex(pixelPosition: number): number {
    return Math.max(
      0,
      Math.min(this.config.columns.length - 1, Math.floor(pixelPosition / this.columnWidth))
    );
  }

  /**
   * Get column by index
   */
  getColumn(index: number): TimelineColumn | null {
    return this.config.columns[index] || null;
  }

  /**
   * Get all timeline columns
   */
  getColumns(): TimelineColumn[] {
    return [...this.config.columns];
  }

  /**
   * Get timeline configuration
   */
  getConfiguration(): TimelineConfiguration {
    return { ...this.config };
  }

  /**
   * Helper: Get week number of the year
   */
  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }

  /**
   * Create date range that aligns with view mode boundaries
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

    // Find task date boundaries
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

    console.log('Date collection results:', {
      tasksCount: tasks.length,
      earliestDate,
      latestDate,
      viewMode,
    });

    // Ensure we have valid start and end dates, with proper fallback handling
    let start: Date;
    let end: Date;

    if (earliestDate && latestDate) {
      start = new Date(earliestDate);
      end = new Date(latestDate);
      console.log('Using task dates for range:', { start, end });
    } else if (earliestDate) {
      start = new Date(earliestDate);
      end = new Date(earliestDate);
      end.setDate(end.getDate() + 30); // Add 30 days as fallback
      console.log('Using earliest date with 30-day extension:', { start, end });
    } else if (latestDate) {
      end = new Date(latestDate);
      start = new Date(latestDate);
      start.setDate(start.getDate() - 30); // Subtract 30 days as fallback
      console.log('Using latest date with 30-day extension backward:', { start, end });
    } else {
      // No dates found, create a reasonable default range
      const today = new Date();
      start = new Date(today);
      start.setDate(start.getDate() - 15);
      end = new Date(today);
      end.setDate(end.getDate() + 15);
      console.log('Using default date range (no task dates found):', { start, end });
    }

    // Align boundaries to view mode
    switch (viewMode) {
      case 'day':
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        if (padding) {
          start.setDate(start.getDate() - 7);
          end.setDate(end.getDate() + 7);
        }
        break;
      case 'week':
        start.setDate(start.getDate() - start.getDay());
        start.setHours(0, 0, 0, 0);
        end.setDate(end.getDate() + (6 - end.getDay()));
        end.setHours(23, 59, 59, 999);
        if (padding) {
          start.setDate(start.getDate() - 14);
          end.setDate(end.getDate() + 14);
        }
        break;
      case 'month':
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        end.setMonth(end.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
        if (padding) {
          start.setMonth(start.getMonth() - 1);
          end.setMonth(end.getMonth() + 1);
        }
        break;
      case 'quarter':
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
