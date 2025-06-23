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
  }

  return `${greetingPrefix} ${name}, ${greetingSuffix} ${greet}!`;
};
