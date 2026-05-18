import { format } from 'date-fns';
import { enUS, es, pt, zhTW } from 'date-fns/locale';
import { getLanguageFromLocalStorage } from './language-utils';

export const formatDateTimeWithLocale = (dateString: string): string => {
  if (!dateString) return '';

  const date = new Date(dateString);
  const localeString = getLanguageFromLocalStorage();
  const locale = localeString === 'en' ? enUS : localeString === 'es' ? es : localeString === 'zh_tw' ? zhTW : pt;
  return format(date, 'MMM d, yyyy, h:mm:ss a', { locale });
};
