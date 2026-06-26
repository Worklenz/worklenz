import { holidayApiService } from '@/api/holiday/holiday.api.service';
import { scheduleAPIService } from '@/api/schedule/schedule.api.service';
import dayjs from 'dayjs';
import logger from '@/utils/errorLogger';

export interface UtilizationParams {
  fromDate: string;
  toDate: string;
  workingDays?: string[];
  workingHoursPerDay?: number;
}

export interface UtilizationResult {
  totalWorkingDays: number;
  totalExpectedHours: number;
  holidaysCount: number;
  holidayDates: string[];
}

class UtilizationCalculator {
  private holidayCache: Map<string, string[]> = new Map();
  private cacheTimeout = 1000 * 60 * 15; // 15 minutes cache
  private requestQueue: Map<string, Promise<any>> = new Map();

  /**
   * Calculate working days excluding weekends and holidays
   */
  async calculateWorkingDays(params: UtilizationParams): Promise<UtilizationResult> {
    try {
      // Get organization working settings if not provided
      const workingDays = params.workingDays || (await this.getDefaultWorkingDays());
      const workingHoursPerDay = params.workingHoursPerDay || (await this.getDefaultWorkingHours());

      // Get holidays for the date range
      const holidays = await this.getHolidaysForRange(params.fromDate, params.toDate);
      const holidayDates = holidays.map(h => h.date);

      // Calculate working days
      let totalWorkingDays = 0;
      let current = dayjs(params.fromDate);
      const end = dayjs(params.toDate);

      while (current.isSameOrBefore(end)) {
        const dayName = current.format('dddd');
        const dateStr = current.format('YYYY-MM-DD');

        const isWorkingDay = workingDays.includes(dayName);
        const isHoliday = holidayDates.includes(dateStr);

        if (isWorkingDay && !isHoliday) {
          totalWorkingDays++;
        }

        current = current.add(1, 'day');
      }

      const totalExpectedHours = totalWorkingDays * workingHoursPerDay;

      return {
        totalWorkingDays,
        totalExpectedHours,
        holidaysCount: holidayDates.length,
        holidayDates,
      };
    } catch (error) {
      logger.error('Error calculating working days with holidays', error);
      // Fallback to simple weekday calculation
      return this.calculateWorkingDaysSimple(params);
    }
  }

  /**
   * Get holidays for a date range (with caching and deduplication)
   */
  private async getHolidaysForRange(fromDate: string, toDate: string) {
    const cacheKey = `${fromDate}-${toDate}`;

    // Check cache first
    if (this.holidayCache.has(cacheKey)) {
      const cachedHolidays = this.holidayCache.get(cacheKey);
      if (cachedHolidays) {
        return cachedHolidays.map(date => ({ date }));
      }
    }

    // Check if a request for this range is already in progress
    if (this.requestQueue.has(cacheKey)) {
      const existingRequest = this.requestQueue.get(cacheKey);
      return await existingRequest;
    }

    // Create new request and add to queue
    const requestPromise = this.fetchHolidaysFromAPI(fromDate, toDate, cacheKey);
    this.requestQueue.set(cacheKey, requestPromise);

    try {
      const result = await requestPromise;
      return result;
    } finally {
      // Remove from queue when done
      this.requestQueue.delete(cacheKey);
    }
  }

  private async fetchHolidaysFromAPI(fromDate: string, toDate: string, cacheKey: string) {
    try {
      // Since the combined endpoint doesn't exist, use existing endpoints
      const startYear = new Date(fromDate).getFullYear();
      const endYear = new Date(toDate).getFullYear();

      // Use the existing organization holidays endpoint
      const allHolidays: any[] = [];

      // Fetch holidays for each year in the range
      for (let year = startYear; year <= endYear; year++) {
        try {
          const res = await holidayApiService.getOrganizationHolidays(year);
          if (res.done && res.body) {
            // Filter holidays to the date range
            const filteredHolidays = res.body.filter((holiday: any) => {
              const holidayDate = holiday.date;
              return holidayDate >= fromDate && holidayDate <= toDate;
            });
            allHolidays.push(...filteredHolidays);
          }
        } catch (yearError) {
          logger.warn(`Failed to fetch holidays for year ${year}:`, yearError);
        }
      }

      if (allHolidays.length > 0) {
        // Cache the holiday dates
        const holidayDates = allHolidays.map(h => h.date);
        this.holidayCache.set(cacheKey, holidayDates);

        // Set cache expiration
        setTimeout(() => {
          this.holidayCache.delete(cacheKey);
        }, this.cacheTimeout);

        return allHolidays.map(h => ({
          id: h.id,
          date: h.date,
          name: h.name,
          source: 'custom', // Default to custom since we don't have official holidays yet
        }));
      }
    } catch (error) {
      logger.error('Error fetching holidays for utilization calculation', error);
      // If rate limited (429), add longer delay before retry
      if (error.response?.status === 429) {
        logger.warn('Rate limited on holiday API, implementing backoff');
        // Don't cache failed requests, but don't retry immediately
        setTimeout(() => {
          this.holidayCache.delete(cacheKey);
        }, 5000); // 5 second delay before allowing retry
      }
    }

    return [];
  }

  /**
   * Fallback calculation without holidays
   */
  private async calculateWorkingDaysSimple(params: UtilizationParams): Promise<UtilizationResult> {
    const workingDays = params.workingDays || (await this.getDefaultWorkingDays());
    const workingHoursPerDay = params.workingHoursPerDay || (await this.getDefaultWorkingHours());

    let totalWorkingDays = 0;
    let current = dayjs(params.fromDate);
    const end = dayjs(params.toDate);

    while (current.isSameOrBefore(end)) {
      const dayName = current.format('dddd');
      if (workingDays.includes(dayName)) {
        totalWorkingDays++;
      }
      current = current.add(1, 'day');
    }

    return {
      totalWorkingDays,
      totalExpectedHours: totalWorkingDays * workingHoursPerDay,
      holidaysCount: 0,
      holidayDates: [],
    };
  }

  /**
   * Get default working days from organization settings
   */
  private async getDefaultWorkingDays(): Promise<string[]> {
    try {
      const res = await scheduleAPIService.fetchScheduleSettings();
      if (res?.done && res.body?.workingDays) {
        return res.body.workingDays;
      }
    } catch (error) {
      logger.error('Error fetching working days', error);
    }

    // Default fallback
    return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  }

  /**
   * Get default working hours per day from organization settings
   */
  private async getDefaultWorkingHours(): Promise<number> {
    try {
      const res = await scheduleAPIService.fetchScheduleSettings();
      if (res?.done && res.body?.workingHours) {
        return res.body.workingHours;
      }
    } catch (error) {
      logger.error('Error fetching working hours', error);
    }

    // Default fallback
    return 8;
  }

  /**
   * Calculate utilization percentage with holiday awareness
   */
  calculateUtilizationPercentage(loggedHours: number, expectedHours: number): number {
    if (expectedHours === 0) return 0;
    return Math.round((loggedHours / expectedHours) * 100 * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Clear holiday cache (useful when holiday settings change)
   */
  clearCache(): void {
    this.holidayCache.clear();
    this.requestQueue.clear();
  }
}

// Export singleton instance
export const utilizationCalculator = new UtilizationCalculator();
