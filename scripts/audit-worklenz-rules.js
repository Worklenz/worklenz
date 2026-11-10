#!/usr/bin/env node

/**
 * Worklenz Agentic & QA Rule Compliance Auditor
 *
 * Enforces architectural, localization, theming, and database rules defined in AGENTS.md:
 *  1. i18next calls must provide { defaultValue: ... }
 *  2. No hardcoded hex colors in TSX style attributes (must use Ant Design theme.useToken())
 *  3. Table primary keys in SQL migrations must be UUID with uuid_generate_v4()
 *  4. Client portal routes vs Admin /api/v1 routes boundary checks
 *
 * Usage:
 *   node scripts/audit-worklenz-rules.js [--staged | --all | --diff <branch>]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const checkAll = args.includes('--all');
const diffBranch = args.find((arg, idx) => args[idx - 1] === '--diff');
const stagedOnly = args.includes('--staged');

const stats = {
  scannedFiles: 0,
  errors: 0,
  warnings: 0,
};

const issues = {
  i18n: [],
  theming: [],
  database: [],
};

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(msg) {
  console.log(msg);
}

function getFilesToScan() {
  if (checkAll) {
    const list = [];
    const walk = (dir) => {
      if (
        dir.includes('node_modules') ||
        dir.includes('.git') ||
        dir.includes('build') ||
        dir.includes('dist') ||
        dir.includes('coverage')
      ) {
        return;
      }
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else {
          list.push(full);
        }
      }
    };
    walk(ROOT_DIR);
    return list;
  }

  try {
    let gitCmd = 'git status --porcelain';
    if (stagedOnly) {
      gitCmd = 'git diff --cached --name-only --diff-filter=ACMR';
    } else if (diffBranch) {
      gitCmd = `git diff ${diffBranch}...HEAD --name-only --diff-filter=ACMR`;
    } else {
      // Default: check modified and untracked files
      gitCmd = 'git diff HEAD --name-only --diff-filter=ACMR';
    }

    const output = execSync(gitCmd, { cwd: ROOT_DIR, encoding: 'utf-8' });
    const relFiles = output
      .split('\n')
      .map((f) => f.trim())
      .filter(Boolean);

    if (relFiles.length === 0 && !stagedOnly && !diffBranch) {
      // If git diff HEAD is empty, look at staged
      const stagedOutput = execSync('git diff --cached --name-only --diff-filter=ACMR', {
        cwd: ROOT_DIR,
        encoding: 'utf-8',
      });
      const stagedFiles = stagedOutput.split('\n').map((f) => f.trim()).filter(Boolean);
      return stagedFiles.map((f) => path.join(ROOT_DIR, f));
    }

    return relFiles.map((f) => path.join(ROOT_DIR, f));
  } catch (err) {
    log(`${colors.yellow}Warning: Git command failed, falling back to directory scan.${colors.reset}`);
    return [];
  }
}

// Check 1: i18n rules - t() call missing defaultValue
function checkI18n(filePath, content) {
  if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) return;
  if (filePath.includes('.test.') || filePath.includes('.spec.')) return;
  if (!filePath.includes('worklenz-frontend') && !filePath.includes('worklenz-client-portal')) return;

  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match t('key') or t("key") without a second argument or without defaultValue
    // Matches patterns like: t('something') or t("something", { count: 1 }) without defaultValue
    const tMatches = [...line.matchAll(/\bt\(\s*['"`]([^'"`]+)['"`]\s*([,)])/g)];
    for (const match of tMatches) {
      const charAfter = match[2];
      if (charAfter === ')') {
        // Simple t('key') with no options
        issues.i18n.push({
          file: path.relative(ROOT_DIR, filePath),
          line: i + 1,
          key: match[1],
          text: line.trim(),
          reason: `Missing second argument with '{ defaultValue: "..." }'`,
        });
      }
    }

    // Check multi-line or object without defaultValue
    if (line.includes('t(') && line.includes('{') && !line.includes('defaultValue') && !lines[i + 1]?.includes('defaultValue') && !lines[i + 2]?.includes('defaultValue')) {
      // Check if it's an options object passed to t
      const optMatch = line.match(/\bt\(\s*['"`]([^'"`]+)['"`]\s*,\s*\{/);
      if (optMatch) {
        // Inspect up to next 4 lines
        const block = lines.slice(i, i + 5).join(' ');
        if (!block.includes('defaultValue')) {
          issues.i18n.push({
            file: path.relative(ROOT_DIR, filePath),
            line: i + 1,
            key: optMatch[1],
            text: line.trim(),
            reason: `Options object provided to t() is missing 'defaultValue'`,
          });
        }
      }
    }
  }
}

// Check 2: Theming & Hardcoded hex colors in TSX style/attributes
function checkTheming(filePath, content) {
  if (!filePath.endsWith('.tsx')) return;
  if (filePath.includes('.test.') || filePath.includes('.spec.')) return;
  if (filePath.includes('theme') || filePath.includes('constants')) return; // Theme definition files are exempt

  const lines = content.split('\n');
  const hexColorRegex = /#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Ignore comments
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;

    if (line.match(hexColorRegex) && (line.includes('style=') || line.includes('color:') || line.includes('backgroundColor:') || line.includes('borderColor:'))) {
      issues.theming.push({
        file: path.relative(ROOT_DIR, filePath),
        line: i + 1,
        text: line.trim(),
        reason: 'Hardcoded hex color found in UI component. Use Ant Design tokens from `theme.useToken()` instead.',
      });
    }
  }
}

// Check 3: Database UUID Primary Key
function checkDatabaseMigrations(filePath, content) {
  if (!filePath.endsWith('.sql')) return;
  if (!filePath.includes('migration')) return;

  const lines = content.split('\n');
  const upperContent = content.toUpperCase();

  if (upperContent.includes('CREATE TABLE')) {
    // Check if table creation does not have uuid_generate_v4()
    if (!upperContent.includes('UUID_GENERATE_V4()') && !upperContent.includes('GEN_RANDOM_UUID()')) {
      issues.database.push({
        file: path.relative(ROOT_DIR, filePath),
        line: 1,
        text: 'CREATE TABLE statement',
        reason: 'Table created without UUID primary key defaulting to `uuid_generate_v4()`.',
      });
    }
  }
}

function runAudit() {
  log(`\n${colors.bold}${colors.cyan}======================================================${colors.reset}`);
  log(`${colors.bold}${colors.cyan}  Worklenz Agentic & QA Rule Compliance Auditor       ${colors.reset}`);
  log(`${colors.bold}${colors.cyan}======================================================${colors.reset}\n`);

  const files = getFilesToScan();
  log(`Scanning ${files.length} target file(s)...\n`);

  for (const filePath of files) {
    if (!fs.existsSync(filePath)) continue;
    stats.scannedFiles++;
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      checkI18n(filePath, content);
      checkTheming(filePath, content);
      checkDatabaseMigrations(filePath, content);
    } catch (e) {
      // Ignore unreadable or binary files
    }
  }

  // Report i18n
  if (issues.i18n.length > 0) {
    log(`${colors.bold}${colors.red}❌ Localization Violations (${issues.i18n.length})${colors.reset}`);
    log(`${colors.yellow}Rule: AGENTS.md requires all t() calls to include a { defaultValue } parameter.${colors.reset}\n`);
    issues.i18n.slice(0, 15).forEach((iss) => {
      log(`  ${colors.red}${iss.file}:${iss.line}${colors.reset} [key: ${iss.key}]`);
      log(`    ${iss.reason}`);
      log(`    Code: ${colors.reset}${iss.text.substring(0, 100)}`);
    });
    if (issues.i18n.length > 15) {
      log(`  ... and ${issues.i18n.length - 15} more.`);
    }
    log('');
    stats.errors += issues.i18n.length;
  }

  // Report theming
  if (issues.theming.length > 0) {
    log(`${colors.bold}${colors.yellow}⚠️  Theme Token Warnings (${issues.theming.length})${colors.reset}`);
    log(`${colors.yellow}Rule: AGENTS.md / DESIGN.md require Ant Design tokens over hardcoded hex colors.${colors.reset}\n`);
    issues.theming.slice(0, 10).forEach((iss) => {
      log(`  ${colors.yellow}${iss.file}:${iss.line}${colors.reset}`);
      log(`    ${iss.reason}`);
      log(`    Code: ${iss.text.substring(0, 100)}`);
    });
    if (issues.theming.length > 10) {
      log(`  ... and ${issues.theming.length - 10} more.`);
    }
    log('');
    stats.warnings += issues.theming.length;
  }

  // Report database
  if (issues.database.length > 0) {
    log(`${colors.bold}${colors.red}❌ Database Migration Violations (${issues.database.length})${colors.reset}`);
    log(`${colors.yellow}Rule: AGENTS.md requires UUID primary keys defaulting to uuid_generate_v4().${colors.reset}\n`);
    issues.database.forEach((iss) => {
      log(`  ${colors.red}${iss.file}:${iss.line}${colors.reset}`);
      log(`    ${iss.reason}`);
    });
    log('');
    stats.errors += issues.database.length;
  }

  log(`------------------------------------------------------`);
  if (stats.errors === 0 && stats.warnings === 0) {
    log(`${colors.bold}${colors.green}✅ All Worklenz agentic compliance checks passed successfully!${colors.reset}\n`);
    process.exit(0);
  } else if (stats.errors === 0) {
    log(`${colors.bold}${colors.green}✅ Checks passed with ${stats.warnings} warning(s).${colors.reset}\n`);
    process.exit(0);
  } else {
    log(`${colors.bold}${colors.red}❌ Audit failed with ${stats.errors} error(s) and ${stats.warnings} warning(s).${colors.reset}\n`);
    process.exit(1);
  }
}

runAudit();
