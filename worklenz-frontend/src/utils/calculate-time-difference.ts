import {
  differenceInSeconds,
  differenceInMinutes,
  differenceInHours,
  differenceInDays,
  differenceInWeeks,
  differenceInMonths,
  differenceInYears,
  formatDistanceToNow,
} from 'date-fns';
import { enUS, es, pt } from 'date-fns/locale';
import { getLanguageFromLocalStorage } from './language-utils';

export function calculateTimeDifference(timestamp: string | Date): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  const localeString = getLanguageFromLocalStorage();
  const locale = localeString === 'en' ? enUS : localeString === 'es' ? es : pt;
  const now = new Date();

  const diffInSeconds = differenceInSeconds(now, date);
  if (diffInSeconds < 60) {
    return 'Just now';
  }

  const distanceFunctions = [
    differenceInYears,
    differenceInMonths,
    differenceInWeeks,
    differenceInDays,
    differenceInHours,
    differenceInMinutes,
  ];

  for (const distanceFunction of distanceFunctions) {
    if (distanceFunction(now, date) > 0) {
      return formatDistanceToNow(date, { addSuffix: true, locale });
    }
  }

  return 'Just now';
}
