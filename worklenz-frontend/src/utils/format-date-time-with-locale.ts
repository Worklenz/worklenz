import { format } from 'date-fns';
import { enUS, es, pt, de, pl, ko, zhCN } from 'date-fns/locale';
import { getLanguageFromLocalStorage } from './language-utils';

const getDateFnsLocale = (lang: string) => {
  const localeMap: Record<string, any> = {
    'en': enUS,
    'es': es,
    'pt': pt,
    'de': de,
    'pl': pl,
    'ko': ko,
    'zh_cn': zhCN,
  };
  return localeMap[lang] || enUS;
};

export const formatDateTimeWithLocale = (dateString: string): string => {
  if (!dateString) return '';

  const date = new Date(dateString);
  const localeString = getLanguageFromLocalStorage();
  const locale = getDateFnsLocale(localeString);
  return format(date, 'MMM d, yyyy, h:mm:ss a', { locale });
};
