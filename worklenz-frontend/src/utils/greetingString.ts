import dayjs from 'dayjs';
import { getLanguageFromLocalStorage } from './language-utils';

export const greetingString = (name: string): string => {
  const date = dayjs();
  const hours = date.hour();
  let greet;

  if (hours < 12) greet = 'morning';
  else if (hours >= 12 && hours < 16) greet = 'afternoon';
  else if (hours >= 16 && hours < 24) greet = 'evening';

  const language = getLanguageFromLocalStorage();
  let greetingPrefix = 'Hi';
  let greetingSuffix = 'Good';
  let morning = 'morning';
  let afternoon = 'afternoon';
  let evening = 'evening';

  if (language === 'es') {
    greetingPrefix = 'Hola';
    greetingSuffix = 'Buen';
    morning = 'mañana';
    afternoon = 'tarde';
    evening = 'noche';
  } else if (language === 'pt') {
    greetingPrefix = 'Olá';
    greetingSuffix = 'Bom';
    morning = 'manhã';
    afternoon = 'tarde';
    evening = 'noite';
  } else if (language === 'alb') {
    greetingPrefix = 'Përshëndetje';
    greetingSuffix = 'të mbarë';
    morning = 'mëngjesi';
    afternoon = 'pasdite';
    evening = 'mbrëmja';
  } else if (language === 'de') {
    greetingPrefix = 'Hallo';
    greetingSuffix = 'Guten';
    morning = 'Morgen';
    afternoon = 'Tag';
    evening = 'Abend';
  } else if (language === 'zh') {
    greetingPrefix = '你好';
    greetingSuffix = '';
    morning = '早上好';
    afternoon = '下午好';
    evening = '晚上好';
  }

  // Get the localized time period based on the current time
  let localizedTimePeriod;
  if (greet === 'morning') localizedTimePeriod = morning;
  else if (greet === 'afternoon') localizedTimePeriod = afternoon;
  else localizedTimePeriod = evening;

  // Handle Chinese language which has different structure
  if (language === 'zh') {
    return `${greetingPrefix} ${name}, ${localizedTimePeriod}!`;
  }

  return `${greetingPrefix} ${name}, ${greetingSuffix} ${localizedTimePeriod}!`;
};
