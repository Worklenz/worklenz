/**
 * Utility functions for formatting time durations
 */

/**
 * Format seconds to time string with hours, minutes, and seconds
 * @param totalSeconds - Total seconds to format
 * @returns Formatted string (e.g., "2h 30m 45s", "30m 45s", "45s")
 */
export const formatSecondsToTimeString = (totalSeconds: number): string => {
  if (!totalSeconds || totalSeconds === 0) return '0s';

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

  return parts.join(' ');
};

/**
 * Format seconds to hours and minutes only (no seconds)
 * @param totalSeconds - Total seconds to format
 * @returns Formatted string (e.g., "2h 30m", "30m", "0m")
 */
export const formatSecondsToHoursMinutes = (totalSeconds: number): string => {
  if (!totalSeconds || totalSeconds === 0) return '0m';

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h 0m`;
  }

  return `${minutes}m`;
};

/**
 * Format seconds to compact hours and minutes (no zero minutes)
 * @param totalSeconds - Total seconds to format
 * @returns Formatted string (e.g., "2h 30m", "30m", "2h")
 */
export const formatSecondsToCompactHoursMinutes = (totalSeconds: number): string => {
  if (!totalSeconds || totalSeconds === 0) return '0m';

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);

  return parts.length > 0 ? parts.join(' ') : '0m';
};

/**
 * Convert seconds to hours (decimal)
 * @param seconds - Number of seconds
 * @returns Number of hours as decimal
 */
export const secondsToHours = (seconds: number): number => {
  return seconds / 3600;
};

/**
 * Convert minutes to seconds
 * @param minutes - Number of minutes
 * @returns Number of seconds
 */
export const minutesToSeconds = (minutes: number): number => {
  return minutes * 60;
};

/**
 * Convert hours to seconds
 * @param hours - Number of hours
 * @returns Number of seconds
 */
export const hoursToSeconds = (hours: number): number => {
  return hours * 3600;
};
