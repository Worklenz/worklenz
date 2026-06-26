import { IServerResponse } from '@/types/common.types';
import { IHolidayCalendarEvent } from '@/types/holiday/holiday.types';
import dayjs from 'dayjs';

export interface ISriLankanHoliday {
  date: string;
  name: string;
  type: 'Public' | 'Bank' | 'Mercantile' | 'Poya';
  description?: string;
  is_poya?: boolean;
  is_editable?: boolean;
}

export interface ISriLankanHolidayResponse {
  holidays: ISriLankanHoliday[];
  total: number;
  year: number;
  month?: number;
}

export interface ISriLankanCheckHolidayResponse {
  is_holiday: boolean;
  holiday?: ISriLankanHoliday;
  date: string;
}

// Sri Lankan Holiday API Configuration
const SRI_LANKA_API_BASE_URL = 'https://srilanka-holidays.vercel.app/api/v1';

/**
 * Sri Lankan Holiday API Service
 * Uses the dedicated srilanka-holidays API for accurate Sri Lankan holiday data
 * Source: https://github.com/Dilshan-H/srilanka-holidays
 */
export const sriLankanHolidayApiService = {
  /**
   * Get Sri Lankan holidays for a specific year
   */
  getHolidays: async (params: {
    year: number;
    month?: number;
    type?: 'Public' | 'Bank' | 'Mercantile' | 'Poya';
  }): Promise<IServerResponse<ISriLankanHoliday[]>> => {
    try {
      const queryParams = new URLSearchParams({
        year: params.year.toString(),
        format: 'json',
      });

      if (params.month) {
        queryParams.append('month', params.month.toString());
      }

      if (params.type) {
        queryParams.append('type', params.type);
      }

      // For now, return mock data as placeholder until API key is configured
      const mockSriLankanHolidays: ISriLankanHoliday[] = [
        {
          date: `${params.year}-01-01`,
          name: "New Year's Day",
          type: 'Public',
          description: 'Celebration of the first day of the Gregorian calendar year',
        },
        {
          date: `${params.year}-02-04`,
          name: 'Independence Day',
          type: 'Public',
          description: 'Commemorates the independence of Sri Lanka from British rule in 1948',
        },
        {
          date: `${params.year}-02-13`,
          name: 'Navam Full Moon Poya Day',
          type: 'Poya',
          description: 'Buddhist festival celebrating the full moon',
          is_poya: true,
        },
        {
          date: `${params.year}-03-15`,
          name: 'Medin Full Moon Poya Day',
          type: 'Poya',
          description: 'Buddhist festival celebrating the full moon',
          is_poya: true,
        },
        {
          date: `${params.year}-04-13`,
          name: 'Sinhala and Tamil New Year Day',
          type: 'Public',
          description: 'Traditional New Year celebrated by Sinhalese and Tamil communities',
        },
        {
          date: `${params.year}-04-14`,
          name: 'Day after Sinhala and Tamil New Year Day',
          type: 'Public',
          description: 'Second day of traditional New Year celebrations',
        },
        {
          date: `${params.year}-05-01`,
          name: 'May Day',
          type: 'Public',
          description: 'International Workers Day',
        },
        {
          date: `${params.year}-05-12`,
          name: 'Vesak Full Moon Poya Day',
          type: 'Poya',
          description: 'Celebrates the birth, enlightenment and passing away of Buddha',
          is_poya: true,
        },
        {
          date: `${params.year}-05-13`,
          name: 'Day after Vesak Full Moon Poya Day',
          type: 'Public',
          description: 'Additional day for Vesak celebrations',
        },
        {
          date: `${params.year}-06-11`,
          name: 'Poson Full Moon Poya Day',
          type: 'Poya',
          description: 'Commemorates the introduction of Buddhism to Sri Lanka',
          is_poya: true,
        },
        {
          date: `${params.year}-08-09`,
          name: 'Nikini Full Moon Poya Day',
          type: 'Poya',
          description: 'Buddhist festival celebrating the full moon',
          is_poya: true,
        },
        {
          date: `${params.year}-09-07`,
          name: 'Binara Full Moon Poya Day',
          type: 'Poya',
          description: 'Buddhist festival celebrating the full moon',
          is_poya: true,
        },
        {
          date: `${params.year}-10-07`,
          name: 'Vap Full Moon Poya Day',
          type: 'Poya',
          description: 'Buddhist festival celebrating the full moon',
          is_poya: true,
        },
        {
          date: `${params.year}-11-05`,
          name: 'Il Full Moon Poya Day',
          type: 'Poya',
          description: 'Buddhist festival celebrating the full moon',
          is_poya: true,
        },
        {
          date: `${params.year}-12-05`,
          name: 'Unduvap Full Moon Poya Day',
          type: 'Poya',
          description: 'Buddhist festival celebrating the full moon',
          is_poya: true,
        },
        {
          date: `${params.year}-12-25`,
          name: 'Christmas Day',
          type: 'Public',
          description: 'Christian celebration of the birth of Jesus Christ',
        },
      ];

      // Filter by month if specified
      let filteredHolidays = mockSriLankanHolidays;
      if (params.month) {
        filteredHolidays = mockSriLankanHolidays.filter(holiday => {
          const holidayMonth = dayjs(holiday.date).month() + 1; // dayjs months are 0-indexed
          return holidayMonth === params.month;
        });
      }

      // Filter by type if specified
      if (params.type) {
        filteredHolidays = filteredHolidays.filter(holiday => holiday.type === params.type);
      }

      return {
        done: true,
        body: filteredHolidays,
      } as IServerResponse<ISriLankanHoliday[]>;

      // TODO: Uncomment when API key is configured
      // const response = await fetch(`${SRI_LANKA_API_BASE_URL}/holidays?${queryParams}`, {
      //   headers: {
      //     'X-API-Key': process.env.SRI_LANKA_API_KEY || '',
      //     'Content-Type': 'application/json',
      //   },
      // });

      // if (!response.ok) {
      //   throw new Error(`Sri Lankan Holiday API error: ${response.status}`);
      // }

      // const data: ISriLankanHolidayResponse = await response.json();

      // return {
      //   done: true,
      //   body: data.holidays,
      // } as IServerResponse<ISriLankanHoliday[]>;
    } catch (error) {
      console.error('Error fetching Sri Lankan holidays:', error);
      return {
        done: false,
        body: [],
      } as IServerResponse<ISriLankanHoliday[]>;
    }
  },

  /**
   * Check if a specific date is a holiday in Sri Lanka
   */
  checkHoliday: async (params: {
    year: number;
    month: number;
    day: number;
  }): Promise<IServerResponse<ISriLankanCheckHolidayResponse>> => {
    try {
      // For now, use mock implementation
      const allHolidays = await sriLankanHolidayApiService.getHolidays({ year: params.year });

      if (!allHolidays.done || !allHolidays.body) {
        return {
          done: false,
          body: {
            is_holiday: false,
            date: `${params.year}-${params.month.toString().padStart(2, '0')}-${params.day.toString().padStart(2, '0')}`,
          },
        } as IServerResponse<ISriLankanCheckHolidayResponse>;
      }

      const checkDate = `${params.year}-${params.month.toString().padStart(2, '0')}-${params.day.toString().padStart(2, '0')}`;
      const holiday = allHolidays.body.find(h => h.date === checkDate);

      return {
        done: true,
        body: {
          is_holiday: !!holiday,
          holiday: holiday,
          date: checkDate,
        },
      } as IServerResponse<ISriLankanCheckHolidayResponse>;

      // TODO: Uncomment when API key is configured
      // const queryParams = new URLSearchParams({
      //   year: params.year.toString(),
      //   month: params.month.toString(),
      //   day: params.day.toString(),
      // });

      // const response = await fetch(`${SRI_LANKA_API_BASE_URL}/check_holiday?${queryParams}`, {
      //   headers: {
      //     'X-API-Key': process.env.SRI_LANKA_API_KEY || '',
      //     'Content-Type': 'application/json',
      //   },
      // });

      // if (!response.ok) {
      //   throw new Error(`Sri Lankan Holiday API error: ${response.status}`);
      // }

      // const data: ISriLankanCheckHolidayResponse = await response.json();

      // return {
      //   done: true,
      //   body: data,
      // } as IServerResponse<ISriLankanCheckHolidayResponse>;
    } catch (error) {
      console.error('Error checking Sri Lankan holiday:', error);
      return {
        done: false,
        body: {
          is_holiday: false,
          date: `${params.year}-${params.month.toString().padStart(2, '0')}-${params.day.toString().padStart(2, '0')}`,
        },
      } as IServerResponse<ISriLankanCheckHolidayResponse>;
    }
  },

  /**
   * Convert Sri Lankan holiday to calendar event format
   */
  convertToCalendarEvent: (holiday: ISriLankanHoliday): IHolidayCalendarEvent => {
    // Color coding for different holiday types
    const getColorCode = (type: string, isPoya?: boolean): string => {
      if (isPoya) return '#8B4513'; // Brown for Poya days
      switch (type) {
        case 'Public':
          return '#DC143C'; // Crimson for public holidays
        case 'Bank':
          return '#4682B4'; // Steel blue for bank holidays
        case 'Mercantile':
          return '#32CD32'; // Lime green for mercantile holidays
        case 'Poya':
          return '#8B4513'; // Brown for Poya days
        default:
          return '#f37070'; // Default red
      }
    };

    return {
      id: `lk-${holiday.date}-${holiday.name.replace(/\s+/g, '-').toLowerCase()}`,
      name: holiday.name,
      description: holiday.description || holiday.name,
      date: holiday.date,
      is_recurring: holiday.is_poya || false, // Poya days recur monthly
      holiday_type_name: holiday.type,
      color_code: getColorCode(holiday.type, holiday.is_poya),
      source: 'official' as const,
      is_editable: holiday.is_editable || false,
    };
  },
};
