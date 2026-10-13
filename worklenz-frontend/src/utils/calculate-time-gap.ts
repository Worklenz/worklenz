import { formatDistanceToNow } from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';
import { es } from 'date-fns/locale/es';
import { pt } from 'date-fns/locale/pt';
import { de } from 'date-fns/locale/de';
import { zhCN } from 'date-fns/locale/zh-CN';
import { sq } from 'date-fns/locale/sq';
import { pl } from 'date-fns/locale/pl';
import { fr } from 'date-fns/locale/fr';
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

