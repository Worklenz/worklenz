import { format } from 'date-fns';
import { enUS, es, pt, de, zhCN, sq } from 'date-fns/locale';
import { getLanguageFromLocalStorage } from './language-utils';

const DATE_FNS_LOCALE: Record<string, typeof enUS> = {
  en: enUS,
  es: es,
  pt: pt,
  de: de,
  zh_cn: zhCN,
  alb: sq,
};

export const formatDateTimeWithLocale = (dateString: string): string => {
  if (!dateString) return '';

  const date = new Date(dateString);
  const locale = DATE_FNS_LOCALE[getLanguageFromLocalStorage()] || enUS;
  return format(date, 'MMM d, yyyy, h:mm:ss a', { locale });
};
