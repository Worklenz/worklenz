import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useGetMeQuery } from '@/store/api-v2';
import { formatDate, formatDateTime, toIanaZone } from '@/utils/dates';

/** Date formatters bound to the signed-in user's time zone (Settings > Language and Region). */
export const useFormatters = () => {
  const { t } = useTranslation();
  const { data: me } = useGetMeQuery();
  const zone = useMemo(() => toIanaZone(me?.timezone), [me?.timezone]);
  const empty = t('common.noDate', { defaultValue: '—' });

  const date = useCallback((value: string | null | undefined) => formatDate(value, empty, zone), [empty, zone]);
  const dateTime = useCallback((value: string | null | undefined) => formatDateTime(value, zone), [zone]);

  return { date, dateTime, zone };
};
