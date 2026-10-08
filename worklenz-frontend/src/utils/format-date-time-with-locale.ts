import { format } from 'date-fns';
import { enUS, es, pt, de, zhCN, sq, pl, fr } from 'date-fns/locale';
import i18n from '@/i18n';
import { getLanguageFromLocalStorage } from './language-utils';

const DATE_FNS_LOCALE: Record<string, typeof enUS> = {
  en: enUS,
  es: es,
  pt: pt,
  de: de,
  zh: zhCN,
  zh_cn: zhCN,
  'zh-cn': zhCN,
  alb: sq,
  sq: sq,
  pl: pl,
  fr: fr,
};

export const formatDateTimeWithLocale = (dateString: string, language?: string): string => {
  if (!dateString) return '';

  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  const currentLanguage = (
    language ||
    (typeof i18n !== 'undefined' && i18n?.language) ||
    getLanguageFromLocalStorage() ||
    'en'
  )
    .toLowerCase()
    .trim();

  const locale =
    DATE_FNS_LOCALE[currentLanguage] ||
    DATE_FNS_LOCALE[currentLanguage.replace('-', '_')] ||
    DATE_FNS_LOCALE[currentLanguage.split(/[-_]/)[0]] ||
    enUS;
  return format(date, 'MMM d, yyyy, h:mm:ss a', { locale });
};

