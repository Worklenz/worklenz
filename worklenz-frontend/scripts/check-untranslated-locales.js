#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(__dirname, '..', 'public', 'locales');
const SOURCE_LANGUAGE = 'en';
const ALLOWED_SOURCE_VALUES = new Set([
  '—',
  '...',
  'OK',
  'Ok',
  'ETC',
  'N/A',
  'UTIL',
  '% Used',
  'Total $',
  'KB',
  'MB',
  'GB',
  'TB',
  'URL',
  'ID',
  'Pro',
  'AppSumo Special',
  'Slack',
  'Microsoft Teams',
  'Teams',
  'GitHub',
  'LinkedIn',
  'Google',
  'Apple',
  'Excel',
  'YouTube',
  'Discord',
  'Facebook',
  'Google Drive',
  'Google Calendar',
  'Twitter',
  'Worklenz',
  'Deutsch',
  'Español',
  'Português',
  'Shqip',
  '简体中文',
  'English',
  'Status',
  'Total',
  'Normal',
  'Email',
  'No',
  'Name',
  'Phase',
  'Actions',
  'Client',
  'Import',
  'Export',
  'Filter',
  'Marketing',
  'Plan',
  'Menu',
  'Logo',
  'Date',
  'Currency',
  'Role',
  'Offline',
  'Online',
  'Overview',
  'Startup',
  'Startups',
  'Reports',
  'Chats',
  'Color',
  'Designer',
  'Bytes',
  'Roadmap',
  'Version',
  'Labels',
  'Mobile App',
  'Notifications',
  'Configuration',
  'System & Integrations',
  'Subtotal',
  'Estimation',
  'Optimal',
  'Text',
  'Links',
  'Manager',
  'Tickets',
  'Details',
  'Position',
  'Admin',
  'Cancel',
  'Category',
  'Company',
  'Draft',
  'Error',
  'General',
  'Info',
  'Parent',
  'Switch',
  'URGENT',
  'Weekend',
  'min',
  'Formula',
  'Single Sign-On (SSO)',
  'Option {n}',
  'Frontend, Backend, Full-stack',
  'Team',
  'Timer',
  'Service',
  'Message',
  'Messages',
  'Question',
  'Visible',
  'Dates',
  'Documentation',
  'Expression',
  'Construction',
  'Freelancer',
  'Reporter',
  'Upgrade',
  'Downgrade',
  'Optional',
  '(Optional)',
  'in',
  'clients',
  'Conversations',
  'phases',
  'Services',
  'page',
  'question',
  'POC',
  'POCs',
  'Software',
  'Sprint',
  'Sprints',
  'Fibonacci',
  'Linear',
  'Branding',
  'Phases',
  'Points',
  'pts',
  'Bug',
  'Bugs',
  'item',
  'Problem',
  'Person',
]);

const isAllowableValue = value => {
  if (typeof value !== 'string') return true;
  const trimmed = value.trim();
  if (trimmed.length < 2) return true;
  if (ALLOWED_SOURCE_VALUES.has(trimmed)) return true;

  // Numbers, percentages, math, punctuation, ranges, e.g. "0–25%", "(> 110%)", "0.00"
  if (/^[\d\s.,\-–—+/%$€£¥#@:;*()\[\]{}<>]+$/.test(trimmed)) return true;

  // Phone masks or placeholder patterns like "07xxxxxxxx"
  if (/^0\d+[xX]+$/.test(trimmed)) return true;

  // Variable-stripped check: remove {{...}} and punctuation/numbers
  const stripped = trimmed
    .replace(/\{\{[^}]+\}\}/g, '')
    .replace(/<\/?\d+>/g, '')
    .replace(/[\d\s.,\-–—+/%$€£¥#@:;*()\[\]{}<>\/]+/g, ' ')
    .trim();
  if (!stripped) return true;

  // If every remaining word in the stripped string is an allowable token, allow it
  const words = stripped.split(/\s+/).filter(w => w.length > 1);
  if (!words.length || words.every(w => ALLOWED_SOURCE_VALUES.has(w))) return true;

  // Common file types (e.g. "PNG, JPG, WEBP")
  if (/^(?:PNG|JPG|JPEG|WEBP|SVG|PDF|CSV|XLSX?)(?:,\s*(?:PNG|JPG|JPEG|WEBP|SVG|PDF|CSV|XLSX?))*$/i.test(trimmed)) return true;

  // Email, name, slash commands, or domain placeholders
  if (/@/.test(trimmed) && /\.[a-z]{2,}$/i.test(trimmed)) return true;
  if (/^(?:ex:\s*[A-Z0-9]+|Jordan Lee|\/invite\s+@\w+)$/i.test(trimmed)) return true;

  // Rate period suffixes (e.g. "/month", "/year", "/page")
  if (/^\/(?:month|year|day|hour|week|page)$/i.test(trimmed)) return true;

  return false;
};

const ENGLISH_MARKERS = /\b(projected|revenue|profit|forecast|this month|next month|billable|invoice|budget|utilization|project|member|client|search|retry)\b/gi;
const namespaceArgument = process.argv.find(argument => argument.startsWith('--namespace='));
const namespaceFilter = namespaceArgument?.split('=', 2)[1];
const strict = process.argv.includes('--strict');

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

const getByPath = (value, keyPath) =>
  keyPath.split('.').reduce((current, key) => current?.[key], value);

const hasLikelyEnglishText = value => {
  if (typeof value !== 'string') return false;
  const matches = value.match(ENGLISH_MARKERS) ?? [];
  return (
    /\bvs\s+(?:last|this)\s+month\b/i.test(value) ||
    new Set(matches.map(match => match.toLowerCase())).size >= 2
  );
};

const sourceDir = path.join(LOCALES_DIR, SOURCE_LANGUAGE);
const sourceFiles = walk(sourceDir).filter(relativeFile => !namespaceFilter || relativeFile === namespaceFilter);

if (namespaceFilter && !sourceFiles.length) {
  console.error(`No English locale namespace found for: ${namespaceFilter}`);
  process.exit(1);
}
const languages = fs
  .readdirSync(LOCALES_DIR, { withFileTypes: true })
  .filter(entry => entry.isDirectory() && entry.name !== SOURCE_LANGUAGE)
  .map(entry => entry.name)
  .sort();

const issues = [];

for (const language of languages) {
  for (const relativeFile of sourceFiles) {
    const sourcePath = path.join(sourceDir, relativeFile);
    const localePath = path.join(LOCALES_DIR, language, relativeFile);
    if (!fs.existsSync(localePath)) continue;

    const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
    const locale = JSON.parse(fs.readFileSync(localePath, 'utf8'));
    const matchingKeys = collectStringLeaves(source)
      .filter(([keyPath, englishValue]) => {
        if (isAllowableValue(englishValue)) return false;
        const localeValue = getByPath(locale, keyPath);
        return localeValue === englishValue || hasLikelyEnglishText(localeValue);
      })
      .map(([keyPath]) => keyPath);

    if (matchingKeys.length) issues.push({ language, relativeFile, matchingKeys });
  }
}

if (!issues.length) {
  console.log('No copied English locale values found.');
  process.exit(0);
}

console.error('Copied English locale values found:');
for (const { language, relativeFile, matchingKeys } of issues) {
  console.error(`\n${language}/${relativeFile}: ${matchingKeys.length}`);
  for (const key of matchingKeys) console.error(`  - ${key}`);
}

if (strict) {
  process.exit(1);
} else {
  console.warn('\nNote: Run with --strict to exit non-zero.');
  process.exit(0);
}
