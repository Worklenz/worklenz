import dayjs from 'dayjs';
import { getLanguageFromLocalStorage } from './language-utils';

export const currentDateString = (): string => {
  const date = dayjs();
  const localeString = getLanguageFromLocalStorage();

  // Map language codes to dayjs locales
  let locale = 'en'; // Default to English
  switch (localeString) {
    case 'en':
      locale = 'en';
      break;
    case 'es':
      locale = 'es';
      break;
    case 'pt':
      locale = 'pt';
      break;
    case 'de':
      locale = 'de';
      break;
    case 'zh':
      locale = 'zh-cn';
      break;
    case 'alb':
      locale = 'sq'; // Albanian locale code for dayjs
      break;
    default:
      locale = 'en';
  }

  // Get localized "Today is" text
  let todayText = 'Today is'; // Default English
  switch (localeString) {
    case 'en':
      todayText = 'Today is';
      break;
    case 'es':
      todayText = 'Hoy es';
      break;
    case 'pt':
      todayText = 'Hoje é';
      break;
    case 'de':
      todayText = 'Heute ist';
      break;
    case 'zh':
      todayText = '今天是';
      break;
    case 'alb':
      todayText = 'Sot është';
      break;
    default:
      todayText = 'Today is';
  }

  return `${todayText} ${date.locale(locale).format('dddd, MMMM DD, YYYY')}`;
};
