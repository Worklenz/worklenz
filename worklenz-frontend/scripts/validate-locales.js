#!/usr/bin/env node
// Fails the build if any locale JSON file under public/locales is invalid JSON.
// This is the exact class of bug that silently broke translations in production:
// a malformed file loads as an empty namespace with no error, so every t() call
// in it falls back to rendering the raw key.

const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(__dirname, '..', 'public', 'locales');

function walk(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
    } else if (entry.name.endsWith('.json')) {
      files.push(fullPath);
    }
  }
  return files;
}

const files = walk(LOCALES_DIR);
const errors = [];

for (const file of files) {
  try {
    JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    errors.push({ file: path.relative(process.cwd(), file), message: err.message });
  }
}

if (errors.length > 0) {
  console.error(`\nFound ${errors.length} invalid locale JSON file(s):\n`);
  for (const { file, message } of errors) {
    console.error(`  ${file}\n    ${message}\n`);
  }
  process.exit(1);
}

console.log(`Validated ${files.length} locale files — all valid JSON.`);
