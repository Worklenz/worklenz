#!/usr/bin/env node
// Synchronizes translation files from 'en' (source of truth) to all other locales.
// - Copies missing namespace files directly from 'en'.
// - Merges missing translation keys into existing files using the 'en' text as fallback.
// Run with --dry-run to preview changes without modifying files.

const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(__dirname, '..', 'public', 'locales');
const SOURCE_LANG = 'en';
const dryRun = process.argv.includes('--dry-run');

function walk(dir, base = dir) {
  const files = [];
  if (!fs.existsSync(dir)) return files;
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

function isObject(val) {
  return val !== null && typeof val === 'object' && !Array.isArray(val);
}

function countKeys(obj) {
  let count = 0;
  for (const [, v] of Object.entries(obj)) {
    if (isObject(v)) {
      count += countKeys(v);
    } else {
      count++;
    }
  }
  return count;
}

function syncObject(source, target) {
  let addedKeys = 0;
  const result = {};

  for (const [key, sourceVal] of Object.entries(source)) {
    if (!(key in target)) {
      result[key] = sourceVal;
      addedKeys += isObject(sourceVal) ? countKeys(sourceVal) : 1;
    } else {
      const targetVal = target[key];
      if (isObject(sourceVal) && isObject(targetVal)) {
        const nested = syncObject(sourceVal, targetVal);
        result[key] = nested.result;
        addedKeys += nested.addedKeys;
      } else {
        result[key] = targetVal;
      }
    }
  }

  // Preserve any existing keys in target that are not in source
  for (const [key, targetVal] of Object.entries(target)) {
    if (!(key in source)) {
      result[key] = targetVal;
    }
  }

  return { result, addedKeys };
}

const languages = fs
  .readdirSync(LOCALES_DIR, { withFileTypes: true })
  .filter(e => e.isDirectory() && e.name !== SOURCE_LANG)
  .map(e => e.name);

const sourceDir = path.join(LOCALES_DIR, SOURCE_LANG);
const sourceFiles = walk(sourceDir).sort();

let totalAddedFiles = 0;
let totalAddedKeys = 0;

console.log(dryRun ? '=== DRY RUN (No files will be modified) ===\n' : '=== Syncing Locales from en ===\n');

for (const lang of languages.sort()) {
  const langDir = path.join(LOCALES_DIR, lang);
  let langFilesAdded = 0;
  let langKeysAdded = 0;

  for (const rel of sourceFiles) {
    const sourceFilePath = path.join(sourceDir, rel);
    const targetFilePath = path.join(langDir, rel);

    const sourceContent = fs.readFileSync(sourceFilePath, 'utf8');
    let sourceData;
    try {
      sourceData = JSON.parse(sourceContent);
    } catch (err) {
      console.error(`Error parsing source file ${sourceFilePath}: ${err.message}`);
      continue;
    }

    if (!fs.existsSync(targetFilePath)) {
      langFilesAdded++;
      if (!dryRun) {
        fs.mkdirSync(path.dirname(targetFilePath), { recursive: true });
        fs.writeFileSync(targetFilePath, JSON.stringify(sourceData, null, 2) + '\n', 'utf8');
      }
      continue;
    }

    let targetData;
    try {
      targetData = JSON.parse(fs.readFileSync(targetFilePath, 'utf8'));
    } catch (err) {
      console.error(`Error parsing target file ${targetFilePath}: ${err.message}`);
      continue;
    }

    const { result, addedKeys } = syncObject(sourceData, targetData);

    if (addedKeys > 0) {
      langKeysAdded += addedKeys;
      if (!dryRun) {
        fs.writeFileSync(targetFilePath, JSON.stringify(result, null, 2) + '\n', 'utf8');
      }
    }
  }

  totalAddedFiles += langFilesAdded;
  totalAddedKeys += langKeysAdded;

  console.log(`${lang}: ${langFilesAdded} file(s) added, ${langKeysAdded} key(s) synced.`);
}

console.log(
  `\nSummary: ${totalAddedFiles} missing file(s) created, ${totalAddedKeys} missing key(s) synced across ${languages.length} locale(s).`
);
