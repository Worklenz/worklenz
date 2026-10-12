#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const files = fs.readdirSync(path.join(__dirname, '..', 'database', 'pg-migrations')).filter(file => file.endsWith('.js')).sort();
const invalid = files.filter(file => !/^\d{13}_.+\.js$/.test(file));
const byId = new Map();
for (const file of files) { const id = file.split('_')[0]; byId.set(id, [...(byId.get(id) || []), file]); }
const duplicates = [...byId.entries()].filter(([, matches]) => matches.length > 1);
if (invalid.length || duplicates.length) {
  if (invalid.length) console.error(`Invalid migration IDs:\n${invalid.join('\n')}`);
  if (duplicates.length) console.error(`Duplicate migration IDs:\n${duplicates.map(([id, matches]) => `${id}: ${matches.join(', ')}`).join('\n')}`);
  process.exit(1);
}
console.log(`Validated ${files.length} migration IDs.`);
