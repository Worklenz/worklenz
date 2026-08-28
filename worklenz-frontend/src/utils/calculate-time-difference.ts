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
import { enUS, es, pt, de, zhCN, sq } from 'date-fns/locale';
import { getLanguageFromLocalStorage } from './language-utils';

const JUST_NOW: Record<string, string> = {
  en: 'Just now',
  es: 'Justo ahora',
  pt: 'Agora mesmo',
  de: 'Gerade jetzt',
  zh: '刚刚',
  zh_cn: '刚刚',
  alb: 'Sapo tani',
};

const DATE_FNS_LOCALE: Record<string, typeof enUS> = {
  en: enUS,
  es: es,
  pt: pt,
  de: de,
  zh_cn: zhCN,
  alb: sq,
};

export function calculateTimeDifference(timestamp: string | Date, justNow?: string): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  const localeString = getLanguageFromLocalStorage();
  const locale = DATE_FNS_LOCALE[localeString] || enUS;
  const resolvedJustNow = justNow ?? JUST_NOW[localeString] ?? JUST_NOW.en;
  const now = new Date();

  const diffInSeconds = differenceInSeconds(now, date);
  if (diffInSeconds < 60) {
    return resolvedJustNow;
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

  return resolvedJustNow;
}
