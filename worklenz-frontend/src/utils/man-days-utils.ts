/**
 * Utility functions for converting between hours and man days
 */

/**
 * Convert hours to man days
 * @param hours - Number of hours
 * @param hoursPerDay - Working hours per day (default: 8)
 * @returns Number of man days
 */
export const hoursToManDays = (hours: number, hoursPerDay: number = 8): number => {
  if (hours <= 0 || hoursPerDay <= 0) return 0;
  return Number((hours / hoursPerDay).toFixed(2));
};

/**
 * Convert man days to hours
 * @param manDays - Number of man days
 * @param hoursPerDay - Working hours per day (default: 8)
 * @returns Number of hours
 */
export const manDaysToHours = (manDays: number, hoursPerDay: number = 8): number => {
  if (manDays <= 0 || hoursPerDay <= 0) return 0;
  return Number((manDays * hoursPerDay).toFixed(2));
};

/**
 * Convert seconds to man days
 * @param seconds - Number of seconds
 * @param hoursPerDay - Working hours per day (default: 8)
 * @returns Number of man days
 */
export const secondsToManDays = (seconds: number, hoursPerDay: number = 8): number => {
  if (seconds <= 0 || hoursPerDay <= 0) return 0;
  const hours = seconds / 3600;
  return hoursToManDays(hours, hoursPerDay);
};

/**
 * Convert man days to seconds
 * @param manDays - Number of man days
 * @param hoursPerDay - Working hours per day (default: 8)
 * @returns Number of seconds
 */
export const manDaysToSeconds = (manDays: number, hoursPerDay: number = 8): number => {
  if (manDays <= 0 || hoursPerDay <= 0) return 0;
  const hours = manDaysToHours(manDays, hoursPerDay);
  return hours * 3600;
};

/**
 * Format man days for display
 * @param manDays - Number of man days
 * @param precision - Number of decimal places (default: 1)
 * @param hoursPerDay - Working hours per day (default: 8)
 * @returns Formatted string (e.g., '2d 3h 30m')
 */
export const formatManDays = (
  manDays: number,
  precision: number = 1,
  hoursPerDay: number = 8
): string => {
  if (manDays <= 0) return '0d';

  const days = Math.floor(manDays);
  const remainder = manDays - days;
  const totalHours = remainder * hoursPerDay;
  const hours = Math.floor(totalHours);
  const minutes = Math.round((totalHours - hours) * 60);

  let result = '';
  if (days > 0) result += `${days}d`;
  if (hours > 0) result += (result ? ' ' : '') + `${hours}h`;
  if (minutes > 0) result += (result ? ' ' : '') + `${minutes}m`;
  if (!result) result = `${manDays.toFixed(precision)}d`;
  return result;
};

/**
 * Parse man days from string input
 * @param input - String input (e.g., "2.5", "2.5d", "2.5 days")
 * @returns Number of man days or null if invalid
 */
export const parseManDays = (input: string): number | null => {
  if (!input || typeof input !== 'string') return null;

  // Remove common suffixes and trim
  const cleaned = input
    .toLowerCase()
    .replace(/\s*(days?|d)\s*$/g, '')
    .trim();

  const parsed = parseFloat(cleaned);

  if (isNaN(parsed) || parsed < 0) return null;

  return parsed;
};

/**
 * Calculate cost based on man days and rate
 * @param manDays - Number of man days
 * @param manDayRate - Rate per man day
 * @returns Total cost
 */
export const calculateManDaysCost = (manDays: number, manDayRate: number): number => {
  if (manDays <= 0 || manDayRate <= 0) return 0;
  return Number((manDays * manDayRate).toFixed(2));
};

/**
 * Convert hourly rate to man day rate
 * @param hourlyRate - Rate per hour
 * @param hoursPerDay - Working hours per day (default: 8)
 * @returns Rate per man day
 */
export const hourlyRateToManDayRate = (hourlyRate: number, hoursPerDay: number = 8): number => {
  if (hourlyRate <= 0 || hoursPerDay <= 0) return 0;
  return Number((hourlyRate * hoursPerDay).toFixed(2));
};

/**
 * Convert man day rate to hourly rate
 * @param manDayRate - Rate per man day
 * @param hoursPerDay - Working hours per day (default: 8)
 * @returns Rate per hour
 */
export const manDayRateToHourlyRate = (manDayRate: number, hoursPerDay: number = 8): number => {
  if (manDayRate <= 0 || hoursPerDay <= 0) return 0;
  return Number((manDayRate / hoursPerDay).toFixed(2));
};

/**
 * Calculate effort variance in man days
 * @param actualManDays - Actual man days spent
 * @param estimatedManDays - Estimated man days
 * @returns Effort variance in man days (positive = over estimate, negative = under estimate)
 */
export const calculateEffortVariance = (
  actualManDays: number,
  estimatedManDays: number
): number => {
  if (actualManDays < 0 || estimatedManDays < 0) return 0;
  return Number((actualManDays - estimatedManDays).toFixed(2));
};

/**
 * Format effort variance for display
 * @param varianceManDays - Variance in man days
 * @param precision - Number of decimal places (default: 1)
 * @returns Formatted string with sign and label
 */
export const formatEffortVariance = (varianceManDays: number, precision: number = 1): string => {
  if (varianceManDays === 0) return 'On track';

  const absVariance = Math.abs(varianceManDays);
  const rounded = Number(absVariance.toFixed(precision));
  const sign = varianceManDays > 0 ? '+' : '-';

  if (rounded === 1) {
    return `${sign}1 day`;
  } else if (rounded < 1) {
    return `${sign}${rounded}d`;
  } else {
    return `${sign}${rounded} days`;
  }
};

/**
 * Get variance status color based on effort variance
 * @param varianceManDays - Variance in man days
 * @returns Color code for UI display
 */
export const getVarianceColor = (varianceManDays: number): string => {
  if (varianceManDays === 0) return '#52c41a'; // Green - on track
  if (varianceManDays > 0) return '#ff4d4f'; // Red - over estimate
  return '#1890ff'; // Blue - under estimate
};
