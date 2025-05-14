export interface ITaskRecurringSchedule {
    type: 'daily' | 'weekly' | 'monthly' | 'interval';
    dayOfWeek?: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday (for weekly tasks)
    dayOfMonth?: number; // 1 - 31 (for monthly tasks)
    weekOfMonth?: number; // 1 = 1st week, 2 = 2nd week, ..., 5 = Last week (for monthly tasks)
    hour: number; // Time of the day in 24-hour format
    minute: number; // Minute of the hour
    interval?: {
        days?: number;   // Interval in days (for every x days)
        weeks?: number;  // Interval in weeks (for every x weeks)
        months?: number; // Interval in months (for every x months)
    };
}

export interface ITaskRecurringScheduleData {
    task_id?: string,
    id?: string,
    schedule_type?: string
}