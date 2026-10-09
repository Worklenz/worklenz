import { formatDistanceToNow } from 'date-fns';
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

export function calculateTimeGap(timestamp: string | Date, language?: string): string {
  if (!timestamp) return '';
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

  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  if (isNaN(new Date(date).getTime())) return '';
  return formatDistanceToNow(date, { addSuffix: true, locale });
}

