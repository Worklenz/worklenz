import dayjs from 'dayjs';
import 'dayjs/locale/pl';
import 'dayjs/locale/ko';
import { getLanguageFromLocalStorage } from './language-utils';

const localeMap: Record<string, string> = {
  'en': 'en',
  'es': 'es',
  'pt': 'pt',
  'de': 'de',
  'zh_cn': 'zh-cn',
  'alb': 'sq',
  'pl': 'pl',
  'ko': 'ko',
};

const todayTextMap: Record<string, string> = {
  'en': 'Today is',
  'es': 'Hoy es',
  'pt': 'Hoje é',
  'de': 'Heute ist',
  'zh_cn': '今天是',
  'alb': 'Sot është',
  'pl': 'Dziś jest',
  'ko': '오늘은',
};

export const currentDateString = (): string => {
  const date = dayjs();
  const localeString = getLanguageFromLocalStorage();
  const locale = localeMap[localeString] || 'en';
  const todayText = todayTextMap[localeString] || 'Today is';

  return `${todayText} ${date.locale(locale).format('dddd, MMMM DD, YYYY')}`;
};
