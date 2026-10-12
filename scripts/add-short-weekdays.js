const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(__dirname, '..', 'worklenz-frontend', 'public', 'locales');
const LANGS = ['en', 'es', 'de', 'pt', 'zh', 'alb'];

const shortWeekdays = {
  en: { mondayShort: 'Mon', tuesdayShort: 'Tue', wednesdayShort: 'Wed', thursdayShort: 'Thu', fridayShort: 'Fri', saturdayShort: 'Sat', sundayShort: 'Sun' },
  es: { mondayShort: 'Lun', tuesdayShort: 'Mar', wednesdayShort: 'Mié', thursdayShort: 'Jue', fridayShort: 'Vie', saturdayShort: 'Sáb', sundayShort: 'Dom' },
  de: { mondayShort: 'Mo', tuesdayShort: 'Di', wednesdayShort: 'Mi', thursdayShort: 'Do', fridayShort: 'Fr', saturdayShort: 'Sa', sundayShort: 'So' },
  pt: { mondayShort: 'Seg', tuesdayShort: 'Ter', wednesdayShort: 'Qua', thursdayShort: 'Qui', fridayShort: 'Sex', saturdayShort: 'Sáb', sundayShort: 'Dom' },
  zh: { mondayShort: '周一', tuesdayShort: '周二', wednesdayShort: '周三', thursdayShort: '周四', fridayShort: '周五', saturdayShort: '周六', sundayShort: '周日' },
  alb: { mondayShort: 'Hën', tuesdayShort: 'Mar', wednesdayShort: 'Mër', thursdayShort: 'Enj', fridayShort: 'Pre', saturdayShort: 'Sht', sundayShort: 'Die' },
};

for (const lang of LANGS) {
  const filePath = path.join(LOCALES_DIR, lang, 'schedule.json');
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const short = shortWeekdays[lang];
  let added = 0;
  for (const [key, value] of Object.entries(short)) {
    if (!(key in data)) {
      data[key] = value;
      added++;
    }
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
  console.log(`${lang}: added ${added} short weekday keys`);
}

console.log('Done!');
