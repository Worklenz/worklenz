import dayjs from 'dayjs';
import { formatDate } from './dateUtils';

// Shared by project-view-updates.tsx and chat-box.tsx so both chat threads
// group messages by day identically. Callers pass their own `t` (from
// useTranslation) so the separator translates in each namespace.
export const formatDateForSeparator = (date: string, t: (key: string, opts?: Record<string, unknown>) => string) => {
  const today = dayjs();
  const commentDate = dayjs(date);

  if (commentDate.isSame(today, 'day')) {
    return t('today', { defaultValue: 'Today' });
  } else if (commentDate.isSame(today.subtract(1, 'day'), 'day')) {
    return t('yesterday', { defaultValue: 'Yesterday' });
  } else {
    // 'LL' is dayjs's localized long-date token (via localizedFormat, loaded
    // by dateUtils.ts) — it resolves to the active locale's own month/day/year
    // ordering instead of a fixed English pattern.
    return formatDate(commentDate, 'LL');
  }
};

export const isDifferentDay = (date1: string, date2: string) => {
  return !dayjs(date1).isSame(dayjs(date2), 'day');
};
