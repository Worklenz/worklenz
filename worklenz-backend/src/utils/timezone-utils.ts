import moment from "moment-timezone";
import { IRecurringSchedule } from "../interfaces/recurring-tasks";

export class TimezoneUtils {
  /**
   * Convert a date from one timezone to another
   */
  static convertTimezone(date: moment.Moment | Date | string, fromTz: string, toTz: string): moment.Moment {
    return moment.tz(date, fromTz).tz(toTz);
  }

  /**
   * Get the current time in a specific timezone
   */
  static nowInTimezone(timezone: string): moment.Moment {
    return moment.tz(timezone);
  }

  /**
   * Check if a recurring task should run based on timezone
   */
  static shouldRunInTimezone(schedule: IRecurringSchedule, timezone: string): boolean {
    const now = this.nowInTimezone(timezone);
    const scheduleTime = moment.tz(schedule.created_at, timezone);
    
    // Check if it's the right time of day (within a 1-hour window)
    const hourDiff = Math.abs(now.hour() - scheduleTime.hour());
    return hourDiff < 1;
  }

  /**
   * Calculate next end date considering timezone
   */
  static calculateNextEndDateWithTimezone(
    schedule: IRecurringSchedule, 
    lastDate: moment.Moment | Date | string,
    timezone: string
  ): moment.Moment {
    const lastMoment = moment.tz(lastDate, timezone);
    
    switch (schedule.schedule_type) {
      case "daily":
        return lastMoment.clone().add(1, "day");
        
      case "weekly":
        if (schedule.days_of_week && schedule.days_of_week.length > 0) {
          // Find next occurrence based on selected days
          let nextDate = lastMoment.clone();
          let daysChecked = 0;
          
          do {
            nextDate.add(1, "day");
            daysChecked++;
            if (schedule.days_of_week.includes(nextDate.day())) {
              return nextDate;
            }
          } while (daysChecked < 7);
          
          // If no valid day found, return next week's first selected day
          const sortedDays = [...schedule.days_of_week].sort((a, b) => a - b);
          nextDate = lastMoment.clone().add(1, "week").day(sortedDays[0]);
          return nextDate;
        }
        return lastMoment.clone().add(1, "week");
        
      case "monthly":
        if (schedule.date_of_month) {
          // Specific date of month
          let nextDate = lastMoment.clone().add(1, "month").date(schedule.date_of_month);
          
          // Handle months with fewer days
          if (nextDate.date() !== schedule.date_of_month) {
            nextDate = nextDate.endOf("month");
          }
          
          return nextDate;
        } else if (schedule.week_of_month && schedule.day_of_month !== undefined) {
          // Nth occurrence of a day in month
          const nextMonth = lastMoment.clone().add(1, "month").startOf("month");
          const targetDay = schedule.day_of_month;
          const targetWeek = schedule.week_of_month;
          
          // Find first occurrence of the target day
          let firstOccurrence = nextMonth.clone();
          while (firstOccurrence.day() !== targetDay) {
            firstOccurrence.add(1, "day");
          }
          
          // Calculate nth occurrence
          if (targetWeek === 5) {
            // Last occurrence
            let lastOccurrence = firstOccurrence.clone();
            let temp = firstOccurrence.clone().add(7, "days");
            
            while (temp.month() === nextMonth.month()) {
              lastOccurrence = temp.clone();
              temp.add(7, "days");
            }
            
            return lastOccurrence;
          } else {
            // Specific week number
            return firstOccurrence.add((targetWeek - 1) * 7, "days");
          }
        }
        return lastMoment.clone().add(1, "month");
        
      case "every_x_days":
        return lastMoment.clone().add(schedule.interval_days || 1, "days");
        
      case "every_x_weeks":
        return lastMoment.clone().add(schedule.interval_weeks || 1, "weeks");
        
      case "every_x_months":
        return lastMoment.clone().add(schedule.interval_months || 1, "months");
        
      default:
        return lastMoment.clone().add(1, "day");
    }
  }

  /**
   * Get all timezones that should be processed in the current hour
   */
  static getActiveTimezones(): string[] {
    const activeTimezones: string[] = [];
    const allTimezones = moment.tz.names();
    
    for (const tz of allTimezones) {
      const tzTime = moment.tz(tz);
      // Check if it's 11:00 AM in this timezone (matching the cron schedule)
      if (tzTime.hour() === 11) {
        activeTimezones.push(tz);
      }
    }
    
    return activeTimezones;
  }

  /**
   * Validate timezone string
   */
  static isValidTimezone(timezone: string): boolean {
    return moment.tz.zone(timezone) !== null;
  }

  /**
   * Get user's timezone or default to UTC
   */
  static getUserTimezone(userTimezone?: string): string {
    if (userTimezone && this.isValidTimezone(userTimezone)) {
      return userTimezone;
    }
    return "UTC";
  }
}