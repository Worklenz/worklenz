#!/usr/bin/env node
// Checks that every locale's {{variable}} interpolation placeholders match the English
// source exactly. A translated string can be correctly worded and still be broken at
// runtime if it drops a placeholder a component supplies (the value never appears) or
// keeps one the component doesn't supply (i18next renders the literal "{{name}}" text).
// Neither the key-presence check (locales:usage) nor the drift check (locales:compare)
// nor the untranslated-content check (locales:untranslated) catches this class of bug.
// Run with --strict to exit non-zero (e.g. for a CI job you want to enforce this on).

const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(__dirname, '..', 'public', 'locales');
const SOURCE_LANGUAGE = 'en';
const strict = process.argv.includes('--strict');
const namespaceArgument = process.argv.find(argument => argument.startsWith('--namespace='));
const namespaceFilter = namespaceArgument?.split('=', 2)[1];

const walk = (dir, base = dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(filePath, base);
    return entry.name.endsWith('.json') ? [path.relative(base, filePath)] : [];
  });

const collectStringLeaves = (value, prefix = '') =>
  Object.entries(value).flatMap(([key, child]) => {
    const keyPath = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child)) {
      return collectStringLeaves(child, keyPath);
    }
    return typeof child === 'string' ? [[keyPath, child]] : [];
  });

const getByPath = (value, keyPath) => keyPath.split('.').reduce((current, key) => current?.[key], value);

// {{name}}, {{count}}, etc. Plural/context suffixes (_one, _other, _zero) are read like any
// other key, so their placeholder sets are checked against the matching English variant.
const placeholdersOf = value => {
  const matches = value.match(/\{\{\s*[\w.-]+\s*\}\}/g) ?? [];
  return new Set(matches.map(match => match.replace(/\s+/g, '')));
};

const setsEqual = (a, b) => a.size === b.size && [...a].every(item => b.has(item));

const sourceDir = path.join(LOCALES_DIR, SOURCE_LANGUAGE);
const sourceFiles = walk(sourceDir).filter(relativeFile => !namespaceFilter || relativeFile === namespaceFilter);
const locales = fs
  .readdirSync(LOCALES_DIR, { withFileTypes: true })
  .filter(entry => entry.isDirectory() && entry.name !== SOURCE_LANGUAGE)
  .map(entry => entry.name);

let mismatchCount = 0;
const report = {};

for (const relativeFile of sourceFiles) {
  const sourceValue = JSON.parse(fs.readFileSync(path.join(sourceDir, relativeFile), 'utf8'));
  const sourceLeaves = collectStringLeaves(sourceValue);

  for (const locale of locales) {
    const localeFile = path.join(LOCALES_DIR, locale, relativeFile);
    if (!fs.existsSync(localeFile)) continue;
    const localeValue = JSON.parse(fs.readFileSync(localeFile, 'utf8'));

    for (const [keyPath, sourceText] of sourceLeaves) {
      const sourcePlaceholders = placeholdersOf(sourceText);
      if (sourcePlaceholders.size === 0) continue;

      const localeText = getByPath(localeValue, keyPath);
      if (typeof localeText !== 'string') continue;

      const localePlaceholders = placeholdersOf(localeText);
      if (!setsEqual(sourcePlaceholders, localePlaceholders)) {
        mismatchCount++;
        const missing = [...sourcePlaceholders].filter(p => !localePlaceholders.has(p));
        const extra = [...localePlaceholders].filter(p => !sourcePlaceholders.has(p));
        report[locale] ??= [];
        report[locale].push({ file: relativeFile, keyPath, missing, extra });
      }
    }
  }
}

if (mismatchCount === 0) {
  console.log('No interpolation placeholder mismatches found.');
  process.exit(0);
}

console.log('Interpolation placeholder mismatches found:\n');
for (const [locale, entries] of Object.entries(report)) {
  console.log(`${locale}: ${entries.length} mismatch(es)`);
  for (const { file, keyPath, missing, extra } of entries) {
    const parts = [];
    if (missing.length) parts.push(`missing ${missing.join(', ')}`);
    if (extra.length) parts.push(`extra ${extra.join(', ')}`);
    console.log(`  - ${file}#${keyPath}: ${parts.join('; ')}`);
  }
  console.log('');
}
console.log(`Total: ${mismatchCount} mismatch(es) across ${Object.keys(report).length} locale(s).`);

if (strict) process.exit(1);
