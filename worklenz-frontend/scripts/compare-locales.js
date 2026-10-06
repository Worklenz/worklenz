#!/usr/bin/env node
// Reports translation key drift between 'en' (source of truth) and every other
// locale: missing namespace files, and missing keys within shared files.
// Informational only — does not fail the build, since i18next's fallbackLng
// already covers missing keys at runtime. Run with --strict to exit non-zero
// (e.g. for a CI job you want to enforce this on).

const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(__dirname, '..', 'public', 'locales');
const SOURCE_LANG = 'en';
const strict = process.argv.includes('--strict');

function walk(dir, base = dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath, base));
    } else if (entry.name.endsWith('.json')) {
      files.push(path.relative(base, fullPath));
    }
  }
  return files;
}

function flattenKeys(obj, prefix = '') {
  const keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...flattenKeys(v, key));
    } else {
      keys.push(key);
    }
  }
  return keys;
}

const languages = fs
  .readdirSync(LOCALES_DIR, { withFileTypes: true })
  .filter(e => e.isDirectory() && e.name !== SOURCE_LANG)
  .map(e => e.name);

const sourceDir = path.join(LOCALES_DIR, SOURCE_LANG);
const sourceFiles = walk(sourceDir).sort();

let totalMissingFiles = 0;
let totalMissingKeys = 0;
const report = [];

for (const lang of languages.sort()) {
  const langDir = path.join(LOCALES_DIR, lang);
  const missingFiles = [];
  const fileIssues = [];

  for (const rel of sourceFiles) {
    const langFile = path.join(langDir, rel);
    if (!fs.existsSync(langFile)) {
      missingFiles.push(rel);
      continue;
    }

    let sourceData, langData;
    try {
      sourceData = JSON.parse(fs.readFileSync(path.join(sourceDir, rel), 'utf8'));
      langData = JSON.parse(fs.readFileSync(langFile, 'utf8'));
    } catch {
      continue; // invalid JSON is validate-locales.js's job to report
    }

    const sourceKeys = new Set(flattenKeys(sourceData));
    const langKeys = new Set(flattenKeys(langData));
    const missingKeys = [...sourceKeys].filter(k => !langKeys.has(k));

    if (missingKeys.length > 0) {
      fileIssues.push({ file: rel, missingKeys });
      totalMissingKeys += missingKeys.length;
    }
  }

  totalMissingFiles += missingFiles.length;
  if (missingFiles.length > 0 || fileIssues.length > 0) {
    report.push({ lang, missingFiles, fileIssues });
  }
}

if (report.length === 0) {
  console.log('No translation drift found — all locales match en.');
  process.exit(0);
}

for (const { lang, missingFiles, fileIssues } of report) {
  console.log(`\n=== ${lang} ===`);
  if (missingFiles.length > 0) {
    console.log(`  Missing namespace files (${missingFiles.length}):`);
    for (const f of missingFiles) console.log(`    - ${f}`);
  }
  for (const { file, missingKeys } of fileIssues) {
    console.log(`  ${file}: missing ${missingKeys.length} key(s)`);
    for (const k of missingKeys.slice(0, 10)) console.log(`    - ${k}`);
    if (missingKeys.length > 10) console.log(`    ... and ${missingKeys.length - 10} more`);
  }
}

console.log(
  `\nTotal: ${totalMissingFiles} missing file(s), ${totalMissingKeys} missing key(s) across ${languages.length} locale(s).`
);

if (strict && (totalMissingFiles > 0 || totalMissingKeys > 0)) {
  process.exit(1);
}
