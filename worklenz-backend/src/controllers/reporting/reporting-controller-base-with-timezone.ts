import WorklenzControllerBase from "../worklenz-controller-base";
import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import db from "../../config/db";
import moment from "moment-timezone";
import { DATE_RANGES } from "../../shared/constants";

export default abstract class ReportingControllerBaseWithTimezone extends WorklenzControllerBase {
  
  /**
   * Get the user's timezone from the database or request
   * @param userId - The user ID
   * @returns The user's timezone or 'UTC' as default
   */
  protected static async getUserTimezone(userId: string): Promise<string> {
    const q = `SELECT tz.name as timezone 
               FROM users u 
               JOIN timezones tz ON u.timezone_id = tz.id 
               WHERE u.id = $1`;
    const result = await db.query(q, [userId]);
    return result.rows[0]?.timezone || "UTC";
  }

  /**
   * Generate date range clause with timezone support
   * @param key - Date range key (e.g., YESTERDAY, LAST_WEEK)
   * @param dateRange - Array of date strings
   * @param userTimezone - User's timezone (e.g., 'America/New_York')
   * @returns SQL clause for date filtering
   */
  protected static getDateRangeClauseWithTimezone(key: string, dateRange: string[], userTimezone: string) {
    // For custom date ranges
    if (dateRange.length === 2) {
      try {
        // Handle different date formats that might come from frontend
        let startDate, endDate;
        
        // Try to parse the date - it might be a full JS Date string or ISO string
        if (dateRange[0].includes("GMT") || dateRange[0].includes("(")) {
          // Parse JavaScript Date toString() format
          startDate = moment(new Date(dateRange[0]));
          endDate = moment(new Date(dateRange[1]));
        } else {
          // Parse ISO format or other formats
          startDate = moment(dateRange[0]);
          endDate = moment(dateRange[1]);
        }
        
        // Convert to user's timezone and get start/end of day
        const start = startDate.tz(userTimezone).startOf("day");
        const end = endDate.tz(userTimezone).endOf("day");
        
        // Convert to UTC for database comparison
        const startUtc = start.utc().format("YYYY-MM-DD HH:mm:ss");
        const endUtc = end.utc().format("YYYY-MM-DD HH:mm:ss");
        
        if (start.isSame(end, "day")) {
          // Single day selection
          return `AND twl.created_at >= '${startUtc}'::TIMESTAMP AND twl.created_at <= '${endUtc}'::TIMESTAMP`;
        }
        
        return `AND twl.created_at >= '${startUtc}'::TIMESTAMP AND twl.created_at <= '${endUtc}'::TIMESTAMP`;
      } catch (error) {
        console.error("Error parsing date range:", error, { dateRange, userTimezone });
        // Fallback to current date if parsing fails
        const now = moment.tz(userTimezone);
        const startUtc = now.clone().startOf("day").utc().format("YYYY-MM-DD HH:mm:ss");
        const endUtc = now.clone().endOf("day").utc().format("YYYY-MM-DD HH:mm:ss");
        return `AND twl.created_at >= '${startUtc}'::TIMESTAMP AND twl.created_at <= '${endUtc}'::TIMESTAMP`;
      }
    }

    // For predefined ranges, calculate based on user's timezone
    const now = moment.tz(userTimezone);
    let startDate, endDate;

    switch (key) {
      case DATE_RANGES.YESTERDAY:
        startDate = now.clone().subtract(1, "day").startOf("day");
        endDate = now.clone().subtract(1, "day").endOf("day");
        break;
      case DATE_RANGES.LAST_WEEK:
        startDate = now.clone().subtract(1, "week").startOf("week");
        endDate = now.clone().subtract(1, "week").endOf("week");
        break;
      case DATE_RANGES.LAST_MONTH:
        startDate = now.clone().subtract(1, "month").startOf("month");
        endDate = now.clone().subtract(1, "month").endOf("month");
        break;
      case DATE_RANGES.LAST_QUARTER:
        startDate = now.clone().subtract(3, "months").startOf("day");
        endDate = now.clone().endOf("day");
        break;
      default:
        return "";
    }

    if (startDate && endDate) {
      const startUtc = startDate.utc().format("YYYY-MM-DD HH:mm:ss");
      const endUtc = endDate.utc().format("YYYY-MM-DD HH:mm:ss");
      return `AND twl.created_at >= '${startUtc}'::TIMESTAMP AND twl.created_at <= '${endUtc}'::TIMESTAMP`;
    }

    return "";
  }

  /**
   * Format dates for display in user's timezone
   * @param date - Date to format
   * @param userTimezone - User's timezone
   * @param format - Moment format string
   * @returns Formatted date string
   */
  protected static formatDateInTimezone(date: string | Date, userTimezone: string, format = "YYYY-MM-DD HH:mm:ss") {
    return moment.tz(date, userTimezone).format(format);
  }

  /**
   * Get working days count between two dates in user's timezone
   * @param startDate - Start date
   * @param endDate - End date
   * @param userTimezone - User's timezone
   * @returns Number of working days
   */
  protected static getWorkingDaysInTimezone(startDate: string, endDate: string, userTimezone: string): number {
    const start = moment.tz(startDate, userTimezone);
    const end = moment.tz(endDate, userTimezone);
    let workingDays = 0;
    
    const current = start.clone();
    while (current.isSameOrBefore(end, "day")) {
      // Monday = 1, Friday = 5
      if (current.isoWeekday() >= 1 && current.isoWeekday() <= 5) {
        workingDays++;
      }
      current.add(1, "day");
    }
    
    return workingDays;
  }
}