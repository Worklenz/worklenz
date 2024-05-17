export interface IGanttDateRange {
  isSunday?: boolean;
  isToday?: boolean;
  isWeekend?: boolean;
  isLastDayOfWeek?: boolean;
  isLastDayOfMonth?: boolean;
  date?: Date;
}

export interface IGanttWeekRange {
  max?: number;
  min?: number;
  month_name?: string;
  week_index?: number;
  days_of_week?: IGanttDateRange[];
}

export interface IGanttMonthRange {
  max?: number;
  min?: number;
  month_name?: string;
  month_index?: number;
  days_of_month?: IGanttDateRange[];
}
