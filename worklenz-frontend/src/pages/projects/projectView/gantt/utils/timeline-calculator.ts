import { GanttViewMode, GanttTask } from '../types/gantt-types';

export interface TimelinePosition {
  left: number;
  width: number;
  isValid: boolean;
}

export interface TimelineBounds {
  startDate: Date;
  endDate: Date;
  totalDays: number;
  pixelsPerDay: number;
}

export class TimelineCalculator {
  private viewMode: GanttViewMode;
  private columnWidth: number;
  private timelineBounds: TimelineBounds;

  constructor(viewMode: GanttViewMode, columnWidth: number, startDate: Date, endDate: Date) {
    this.viewMode = viewMode;
    this.columnWidth = columnWidth;
    this.timelineBounds = this.calculateTimelineBounds(startDate, endDate);
  }

  /**
   * Calculate timeline bounds and pixels per day
   */
  private calculateTimelineBounds(startDate: Date, endDate: Date): TimelineBounds {
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const columnsCount = this.getColumnsCount();
    const totalWidth = columnsCount * this.columnWidth;
    const pixelsPerDay = totalWidth / totalDays;

    return {
      startDate,
      endDate,
      totalDays,
      pixelsPerDay,
    };
  }

  /**
   * Get number of columns based on view mode
   */
  private getColumnsCount(): number {
    switch (this.viewMode) {
      case 'day':
        return 30;
      case 'week':
        return 12;
      case 'month':
        return 12;
      case 'quarter':
        return 8;
      case 'year':
        return 5;
      default:
        return 12;
    }
  }

  /**
   * Calculate task bar position and width
   */
  calculateTaskPosition(task: GanttTask): TimelinePosition {
    if (!task.start_date || !task.end_date) {
      return { left: 0, width: 0, isValid: false };
    }

    const taskStart = new Date(task.start_date);
    const taskEnd = new Date(task.end_date);

    // Ensure task dates are within timeline bounds
    const clampedStart = new Date(
      Math.max(taskStart.getTime(), this.timelineBounds.startDate.getTime())
    );
    const clampedEnd = new Date(Math.min(taskEnd.getTime(), this.timelineBounds.endDate.getTime()));

    // Calculate days from timeline start
    const daysFromStart = Math.floor(
      (clampedStart.getTime() - this.timelineBounds.startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const taskDuration = Math.ceil(
      (clampedEnd.getTime() - clampedStart.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Calculate pixel positions
    const left = daysFromStart * this.timelineBounds.pixelsPerDay;
    const width = Math.max(taskDuration * this.timelineBounds.pixelsPerDay, 10); // Minimum 10px width

    return {
      left: Math.max(0, left),
      width,
      isValid: true,
    };
  }

  /**
   * Calculate milestone position (single point in time)
   */
  calculateMilestonePosition(date: Date): { left: number; isValid: boolean } {
    if (!date) {
      return { left: 0, isValid: false };
    }

    const milestoneDate = new Date(date);

    // Check if milestone is within timeline bounds
    if (
      milestoneDate < this.timelineBounds.startDate ||
      milestoneDate > this.timelineBounds.endDate
    ) {
      return { left: 0, isValid: false };
    }

    const daysFromStart = Math.floor(
      (milestoneDate.getTime() - this.timelineBounds.startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const left = daysFromStart * this.timelineBounds.pixelsPerDay;

    return {
      left: Math.max(0, left),
      isValid: true,
    };
  }

  /**
   * Calculate dependency line coordinates
   */
  calculateDependencyLine(
    fromTask: GanttTask,
    toTask: GanttTask,
    rowHeight: number = 36
  ): {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    isValid: boolean;
  } {
    const fromPosition = this.calculateTaskPosition(fromTask);
    const toPosition = this.calculateTaskPosition(toTask);

    if (!fromPosition.isValid || !toPosition.isValid) {
      return { x1: 0, y1: 0, x2: 0, y2: 0, isValid: false };
    }

    // Assume tasks are in different rows - would need actual row indices in real implementation
    const fromY = 0; // Would be calculated based on task index * rowHeight
    const toY = rowHeight; // Would be calculated based on task index * rowHeight

    return {
      x1: fromPosition.left + fromPosition.width, // End of source task
      y1: fromY + rowHeight / 2,
      x2: toPosition.left, // Start of target task
      y2: toY + rowHeight / 2,
      isValid: true,
    };
  }

  /**
   * Convert pixel position back to date
   */
  pixelToDate(pixelPosition: number): Date {
    const daysFromStart = pixelPosition / this.timelineBounds.pixelsPerDay;
    const targetDate = new Date(this.timelineBounds.startDate);
    targetDate.setDate(targetDate.getDate() + daysFromStart);
    return targetDate;
  }

  /**
   * Get today line position
   */
  getTodayLinePosition(): { left: number; isVisible: boolean } {
    const today = new Date();
    const position = this.calculateMilestonePosition(today);

    return {
      left: position.left,
      isVisible: position.isValid,
    };
  }

  /**
   * Calculate weekend/holiday shading areas
   */
  getWeekendAreas(): Array<{ left: number; width: number }> {
    const weekendAreas: Array<{ left: number; width: number }> = [];
    const current = new Date(this.timelineBounds.startDate);

    while (current <= this.timelineBounds.endDate) {
      // Saturday (6) and Sunday (0)
      if (current.getDay() === 0 || current.getDay() === 6) {
        const position = this.calculateMilestonePosition(current);
        if (position.isValid) {
          weekendAreas.push({
            left: position.left,
            width: this.timelineBounds.pixelsPerDay,
          });
        }
      }
      current.setDate(current.getDate() + 1);
    }

    return weekendAreas;
  }

  /**
   * Get timeline bounds for external use
   */
  getTimelineBounds(): TimelineBounds {
    return { ...this.timelineBounds };
  }

  /**
   * Update calculator with new parameters
   */
  updateParameters(
    viewMode: GanttViewMode,
    columnWidth: number,
    startDate: Date,
    endDate: Date
  ): void {
    this.viewMode = viewMode;
    this.columnWidth = columnWidth;
    this.timelineBounds = this.calculateTimelineBounds(startDate, endDate);
  }
}

/**
 * Utility functions for timeline calculations
 */
export const TimelineUtils = {
  /**
   * Get smart timeline date range based on project tasks
   */
  getSmartDateRange(tasks: GanttTask[], viewMode: GanttViewMode): { start: Date; end: Date } {
    if (!tasks.length) {
      // Default to current year
      const start = new Date();
      start.setMonth(0, 1); // January 1st
      const end = new Date();
      end.setMonth(11, 31); // December 31st
      return { start, end };
    }

    // Find earliest start date and latest end date
    let earliestStart: Date | null = null;
    let latestEnd: Date | null = null;

    tasks.forEach(task => {
      if (task.start_date) {
        if (!earliestStart || task.start_date < earliestStart) {
          earliestStart = task.start_date;
        }
      }
      if (task.end_date) {
        if (!latestEnd || task.end_date > latestEnd) {
          latestEnd = task.end_date;
        }
      }

      // Check subtasks too
      if (task.children) {
        task.children.forEach(subtask => {
          if (subtask.start_date && (!earliestStart || subtask.start_date < earliestStart)) {
            earliestStart = subtask.start_date;
          }
          if (subtask.end_date && (!latestEnd || subtask.end_date > latestEnd)) {
            latestEnd = subtask.end_date;
          }
        });
      }
    });

    // Add padding based on view mode
    const start = earliestStart || new Date();
    const end = latestEnd || new Date();

    switch (viewMode) {
      case 'day':
        start.setDate(start.getDate() - 7); // 1 week before
        end.setDate(end.getDate() + 7); // 1 week after
        break;
      case 'week':
        start.setDate(start.getDate() - 14); // 2 weeks before
        end.setDate(end.getDate() + 14); // 2 weeks after
        break;
      case 'month':
        start.setMonth(start.getMonth() - 1); // 1 month before
        end.setMonth(end.getMonth() + 1); // 1 month after
        break;
      case 'quarter':
        start.setMonth(start.getMonth() - 3); // 1 quarter before
        end.setMonth(end.getMonth() + 3); // 1 quarter after
        break;
      case 'year':
        start.setFullYear(start.getFullYear() - 1); // 1 year before
        end.setFullYear(end.getFullYear() + 1); // 1 year after
        break;
    }

    return { start, end };
  },

  /**
   * Format date based on view mode
   */
  formatDateForViewMode(date: Date, viewMode: GanttViewMode): string {
    switch (viewMode) {
      case 'day':
        return date.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
      case 'week':
        return `Week ${this.getWeekNumber(date)}`;
      case 'month':
        return date.toLocaleDateString('en-US', { month: 'short' });
      case 'quarter':
        return `Q${Math.ceil((date.getMonth() + 1) / 3)} ${date.getFullYear()}`;
      case 'year':
        return date.getFullYear().toString();
      default:
        return date.toLocaleDateString();
    }
  },

  /**
   * Get week number of the year
   */
  getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  },
};
