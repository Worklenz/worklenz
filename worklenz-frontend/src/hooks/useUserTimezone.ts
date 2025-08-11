import { useState, useEffect } from 'react';

/**
 * Custom hook to get and manage user's timezone
 * @returns {Object} Object containing timezone and related utilities
 */
export const useUserTimezone = () => {
  const [timezone, setTimezone] = useState<string>('UTC');
  const [timezoneOffset, setTimezoneOffset] = useState<string>('+00:00');

  useEffect(() => {
    // Get browser's timezone
    const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setTimezone(browserTimezone);

    // Calculate timezone offset
    const date = new Date();
    const offset = -date.getTimezoneOffset();
    const hours = Math.floor(Math.abs(offset) / 60);
    const minutes = Math.abs(offset) % 60;
    const sign = offset >= 0 ? '+' : '-';
    const formattedOffset = `${sign}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    setTimezoneOffset(formattedOffset);
  }, []);

  /**
   * Format a date in the user's timezone
   * @param date - Date to format
   * @param format - Format options
   * @returns Formatted date string
   */
  const formatInUserTimezone = (date: Date | string, format?: Intl.DateTimeFormatOptions) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleString('en-US', {
      timeZone: timezone,
      ...format
    });
  };

  /**
   * Get the start of day in user's timezone
   * @param date - Date to get start of day for
   * @returns Date object representing start of day
   */
  const getStartOfDayInTimezone = (date: Date = new Date()) => {
    const localDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
    localDate.setHours(0, 0, 0, 0);
    return localDate;
  };

  /**
   * Get the end of day in user's timezone
   * @param date - Date to get end of day for
   * @returns Date object representing end of day
   */
  const getEndOfDayInTimezone = (date: Date = new Date()) => {
    const localDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
    localDate.setHours(23, 59, 59, 999);
    return localDate;
  };

  return {
    timezone,
    timezoneOffset,
    formatInUserTimezone,
    getStartOfDayInTimezone,
    getEndOfDayInTimezone,
    setTimezone
  };
};