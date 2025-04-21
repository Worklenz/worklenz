import dayjs from 'dayjs';
import { getLanguageFromLocalStorage } from './language-utils';

export const currentDateString = (): string => {
  const date = dayjs();
  const localeString = getLanguageFromLocalStorage();
  const locale = localeString === 'en' ? 'en' : localeString === 'es' ? 'es' : 'pt';

  const todayText =
    localeString === 'en' ? 'Today is' : localeString === 'es' ? 'Hoy es' : 'Hoje é';
  return `${todayText} ${date.locale(locale).format('dddd, MMMM DD, YYYY')}`;
};
