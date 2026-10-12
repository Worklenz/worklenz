const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(__dirname, '..', 'worklenz-frontend', 'public', 'locales');
const LANGS = ['en', 'es', 'de', 'pt', 'zh', 'alb'];

const utilKeys = {
  en: { utilAvailable: 'Available (<80%)', utilNear: 'Near capacity (80–100%)', utilOver: 'Over-allocated (>100%)' },
  es: { utilAvailable: 'Disponible (<80%)', utilNear: 'Cerca de la capacidad (80–100%)', utilOver: 'Sobreasignado (>100%)' },
  de: { utilAvailable: 'Verfügbar (<80%)', utilNear: 'Nahe der Kapazität (80–100%)', utilOver: 'Überlastet (>100%)' },
  pt: { utilAvailable: 'Disponível (<80%)', utilNear: 'Perto da capacidade (80–100%)', utilOver: 'Sobreatribuído (>100%)' },
  zh: { utilAvailable: '可用 (<80%)', utilNear: '接近容量 (80–100%)', utilOver: '超负荷 (>100%)' },
  alb: { utilAvailable: 'I disponueshëm (<80%)', utilNear: 'Afër kapacitetit (80–100%)', utilOver: 'Mbivendosur (>100%)' },
};

for (const lang of LANGS) {
  const filePath = path.join(LOCALES_DIR, lang, 'schedule.json');
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const util = utilKeys[lang];
  let added = 0;
  for (const [key, value] of Object.entries(util)) {
    if (!(key in data)) {
      data[key] = value;
      added++;
    }
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
  console.log(`${lang}: added ${added} util keys`);
}

console.log('Done!');
