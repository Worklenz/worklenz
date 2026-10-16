import { formatDistanceToNow } from 'date-fns';
import { enUS, es, pt, de, zhCN, sq, zhTW } from 'date-fns/locale';
import i18n from '@/i18n';

export function calculateTimeGap(timestamp: string | Date): string {
  const lng = (i18n.language || 'en').split('-')[0];
  const locale =
    lng === 'en'
      ? enUS
      : lng === 'es'
        ? es
        : lng === 'pt'
          ? pt
          : lng === 'de'
            ? de
            : lng === 'zh'
              ? zhCN
              : lng === 'alb'
                ? sq
                : lng === 'zh_tw'
                  ? zhTW
                  : enUS;
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  return formatDistanceToNow(date, { addSuffix: true, locale });
}
