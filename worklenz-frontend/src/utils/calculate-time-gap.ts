import { formatDistanceToNow } from 'date-fns';
import { enUS, es, pt, zhTW } from 'date-fns/locale';
import { getLanguageFromLocalStorage } from './language-utils';

export function calculateTimeGap(timestamp: string | Date): string {
  const localeString = getLanguageFromLocalStorage();
  const locale = localeString === 'en' ? enUS : localeString === 'es' ? es : localeString === 'zh_tw' ? zhTW : pt;
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  return formatDistanceToNow(date, { addSuffix: true, locale });
}
