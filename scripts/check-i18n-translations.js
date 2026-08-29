/**
 * i18n Translation Consistency Checker
 *
 * Compares all translation files across all languages against the English (en)
 * source of truth. Reports:
 *   1. Missing files (present in en but not in other languages)
 *   2. Extra files (present in other languages but not in en)
 *   3. Missing keys (keys present in en but not in other languages)
 *   4. Extra keys (keys present in other languages but not in en)
 *   5. Untranslated values (values identical to English)
 *   6. Invalid JSON files
 */

const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(__dirname, '..', 'worklenz-frontend', 'public', 'locales');
const SOURCE_LANG = 'en';

// Get all language directories
const languages = fs.readdirSync(LOCALES_DIR, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name)
  .sort();

console.log(`\n=== i18n Translation Consistency Checker ===\n`);
console.log(`Locales directory: ${LOCALES_DIR}`);
console.log(`Languages found: ${languages.join(', ')}\n`);

// Collect all JSON files per language (relative paths)
function getAllJsonFiles(lang) {
  const langDir = path.join(LOCALES_DIR, lang);
  const results = [];

  function walk(dir, base = '') {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = base ? `${base}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(fullPath, relPath);
      } else if (entry.name.endsWith('.json')) {
        results.push(relPath);
      }
    }
  }

  walk(langDir);
  return results.sort();
}

// Flatten nested JSON object into dot-notation keys
function flattenObject(obj, prefix = '', result = {}) {
  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flattenObject(value, newKey, result);
    } else {
      result[newKey] = value;
    }
  }
  return result;
}

// Read and parse a JSON file, return object with __error__ if invalid
function readJsonFile(lang, relPath) {
  const filePath = path.join(LOCALES_DIR, lang, relPath);
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    return { __error__: err.message };
  }
}

// Collect all files per language
const filesByLang = {};
for (const lang of languages) {
  filesByLang[lang] = getAllJsonFiles(lang);
}

const sourceFiles = filesByLang[SOURCE_LANG];

// ============================================================
// 1. MISSING / EXTRA FILES
// ============================================================
console.log('================================================================================');
console.log('1. FILE COMPARISON (vs English source)');
console.log('================================================================================\n');

const fileIssues = {};

for (const lang of languages) {
  if (lang === SOURCE_LANG) continue;

  const langFiles = filesByLang[lang];
  const missingFiles = sourceFiles.filter(f => !langFiles.includes(f));
  const extraFiles = langFiles.filter(f => !sourceFiles.includes(f));

  if (missingFiles.length > 0 || extraFiles.length > 0) {
    fileIssues[lang] = { missingFiles, extraFiles };

    console.log(`\n[${lang.toUpperCase()}]`);
    if (missingFiles.length > 0) {
      console.log(`  MISSING FILES (${missingFiles.length}):`);
      missingFiles.forEach(f => console.log(`    - ${f}`));
    }
    if (extraFiles.length > 0) {
      console.log(`  EXTRA FILES (${extraFiles.length}):`);
      extraFiles.forEach(f => console.log(`    - ${f}`));
    }
  } else {
    console.log(`\n[${lang.toUpperCase()}] OK - All ${sourceFiles.length} files present, no extras`);
  }
}

// ============================================================
// 2. KEY COMPARISON & UNTRANSLATED VALUES
// ============================================================
console.log('\n\n================================================================================');
console.log('2. KEY & VALUE COMPARISON (vs English source)');
console.log('================================================================================\n');

const allIssues = {};
let totalMissingKeys = 0;
let totalExtraKeys = 0;
let totalUntranslated = 0;
let totalInvalidJson = 0;

for (const lang of languages) {
  if (lang === SOURCE_LANG) continue;

  const langFiles = filesByLang[lang];
  const langIssues = {
    missingKeys: {},
    extraKeys: {},
    untranslated: {},
    invalidJson: []
  };

  // Check each source file
  for (const relPath of sourceFiles) {
    // Skip files that don't exist in this language
    if (!langFiles.includes(relPath)) continue;

    const sourceData = readJsonFile(SOURCE_LANG, relPath);
    const langData = readJsonFile(lang, relPath);

    // Check for invalid JSON
    if (sourceData.__error__) {
      langIssues.invalidJson.push(`${relPath} (source has invalid JSON: ${sourceData.__error__})`);
      totalInvalidJson++;
      continue;
    }
    if (langData.__error__) {
      langIssues.invalidJson.push(`${relPath} (invalid JSON: ${langData.__error__})`);
      totalInvalidJson++;
      continue;
    }

    const sourceFlat = flattenObject(sourceData);
    const langFlat = flattenObject(langData);

    const sourceKeys = Object.keys(sourceFlat);
    const langKeys = Object.keys(langFlat);

    // Missing keys
    const missing = sourceKeys.filter(k => !(k in langFlat));
    if (missing.length > 0) {
      langIssues.missingKeys[relPath] = missing;
      totalMissingKeys += missing.length;
    }

    // Extra keys
    const extra = langKeys.filter(k => !(k in sourceFlat));
    if (extra.length > 0) {
      langIssues.extraKeys[relPath] = extra;
      totalExtraKeys += extra.length;
    }

    // Untranslated values (identical to English)
    const untranslated = sourceKeys.filter(k => {
      if (!(k in langFlat)) return false;
      const srcVal = String(sourceFlat[k]);
      const langVal = String(langFlat[k]);
      // Only flag if the English value is non-trivial (not empty, not just numbers/symbols)
      if (!srcVal || srcVal.length < 2) return false;
      // Skip if the value contains interpolation variables only
      if (/^[\{\}\s]+$/.test(srcVal)) return false;
      return srcVal === langVal;
    });

    if (untranslated.length > 0) {
      langIssues.untranslated[relPath] = untranslated;
      totalUntranslated += untranslated.length;
    }
  }

  allIssues[lang] = langIssues;

  // Print summary for this language
  const missingCount = Object.values(langIssues.missingKeys).reduce((a, b) => a + b.length, 0);
  const extraCount = Object.values(langIssues.extraKeys).reduce((a, b) => a + b.length, 0);
  const untranslatedCount = Object.values(langIssues.untranslated).reduce((a, b) => a + b.length, 0);

  console.log(`\n[${lang.toUpperCase()}]`);
  console.log(`  Missing keys: ${missingCount}`);
  console.log(`  Extra keys:   ${extraCount}`);
  console.log(`  Untranslated: ${untranslatedCount}`);
  console.log(`  Invalid JSON: ${langIssues.invalidJson.length}`);

  // Print details for missing keys
  if (missingCount > 0) {
    console.log(`\n  MISSING KEYS:`);
    for (const [file, keys] of Object.entries(langIssues.missingKeys)) {
      console.log(`    ${file}:`);
      keys.forEach(k => console.log(`      - ${k}`));
    }
  }

  // Print details for extra keys
  if (extraCount > 0) {
    console.log(`\n  EXTRA KEYS:`);
    for (const [file, keys] of Object.entries(langIssues.extraKeys)) {
      console.log(`    ${file}:`);
      keys.forEach(k => console.log(`      - ${k}`));
    }
  }

  // Print details for untranslated values
  if (untranslatedCount > 0) {
    console.log(`\n  UNTRANSLATED VALUES (identical to English):`);
    for (const [file, keys] of Object.entries(langIssues.untranslated)) {
      console.log(`    ${file}:`);
      keys.forEach(k => console.log(`      - ${k}`));
    }
  }

  // Print invalid JSON
  if (langIssues.invalidJson.length > 0) {
    console.log(`\n  INVALID JSON:`);
    langIssues.invalidJson.forEach(f => console.log(`    - ${f}`));
  }
}

// ============================================================
// 3. SUMMARY
// ============================================================
console.log('\n\n================================================================================');
console.log('3. OVERALL SUMMARY');
console.log('================================================================================\n');

const summary = {
  languages: languages.length,
  sourceFiles: sourceFiles.length,
  totalMissingKeys,
  totalExtraKeys,
  totalUntranslated,
  totalInvalidJson,
  languagesWithFileIssues: Object.keys(fileIssues).length,
  languagesWithKeyIssues: Object.keys(allIssues).filter(l =>
    Object.values(allIssues[l].missingKeys).reduce((a, b) => a + b.length, 0) > 0 ||
    Object.values(allIssues[l].extraKeys).reduce((a, b) => a + b.length, 0) > 0 ||
    Object.values(allIssues[l].untranslated).reduce((a, b) => a + b.length, 0) > 0 ||
    allIssues[l].invalidJson.length > 0
  ).length
};

console.log(`Languages analyzed: ${summary.languages}`);
console.log(`Source files (en): ${summary.sourceFiles}`);
console.log(`Total missing keys: ${summary.totalMissingKeys}`);
console.log(`Total extra keys: ${summary.totalExtraKeys}`);
console.log(`Total untranslated values: ${summary.totalUntranslated}`);
console.log(`Total invalid JSON files: ${summary.totalInvalidJson}`);
console.log(`Languages with file issues: ${summary.languagesWithFileIssues}`);
console.log(`Languages with key/value issues: ${summary.languagesWithKeyIssues}`);

// Per-language breakdown
console.log('\nPer-language breakdown:');
console.log('+---------+--------------+------------+--------------+---------------+--------------+');
console.log('| Language| Files        | Missing    | Extra        | Untranslated  | Invalid JSON |');
console.log('+---------+--------------+------------+--------------+---------------+--------------+');

for (const lang of languages) {
  if (lang === SOURCE_LANG) continue;
  const issues = allIssues[lang];
  const missingCount = Object.values(issues.missingKeys).reduce((a, b) => a + b.length, 0);
  const extraCount = Object.values(issues.extraKeys).reduce((a, b) => a + b.length, 0);
  const untranslatedCount = Object.values(issues.untranslated).reduce((a, b) => a + b.length, 0);
  const fileCount = filesByLang[lang].length;

  console.log(`| ${lang.padEnd(7)} | ${String(fileCount).padEnd(12)} | ${String(missingCount).padEnd(10)} | ${String(extraCount).padEnd(12)} | ${String(untranslatedCount).padEnd(13)} | ${String(issues.invalidJson.length).padEnd(12)} |`);
}
console.log('+---------+--------------+------------+--------------+---------------+--------------+');

// Final verdict
console.log('\n================================================================================');
const hasIssues = summary.totalMissingKeys > 0 || summary.totalExtraKeys > 0 ||
  summary.totalUntranslated > 0 || summary.totalInvalidJson > 0 ||
  summary.languagesWithFileIssues > 0;

if (hasIssues) {
  console.log('ISSUES FOUND - Translation files are NOT fully consistent across all languages.');
} else {
  console.log('ALL TRANSLATION FILES ARE CONSISTENT ACROSS ALL LANGUAGES.');
}
console.log('================================================================================\n');