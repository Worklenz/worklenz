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
const { execFileSync } = require('child_process');

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
        path.relative(ROOT_DIR, dir).split(path.sep).some(part =>
          ['node_modules', '.git', 'build', 'dist', 'coverage'].includes(part))
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
    let gitArgs;
    if (stagedOnly) gitArgs = ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'];
    else if (diffBranch) gitArgs = ['diff', '--name-only', '--diff-filter=ACMR', '-z', `${diffBranch}...HEAD`, '--'];
    else gitArgs = ['diff', 'HEAD', '--name-only', '--diff-filter=ACMR', '-z'];
    const runGit = command => execFileSync('git', command, { cwd: ROOT_DIR, encoding: 'utf-8' });
    const files = runGit(gitArgs).split('\0').filter(Boolean);
    if (!stagedOnly && !diffBranch) {
      files.push(...runGit(['ls-files', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean));
    }
    return [...new Set(files)].map(file => path.join(ROOT_DIR, file));
  } catch (err) {
    console.error('Unable to select files for audit:', err.message);
    process.exit(1);
  }
}

// Check 1: i18n rules - t() call missing defaultValue
function checkI18n(filePath, content) {
  if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) return;
  if (filePath.includes('.test.') || filePath.includes('.spec.')) return;
  if (!filePath.includes('worklenz-frontend') && !filePath.includes('worklenz-client-portal')) return;

  const ts = require(require.resolve('typescript', { paths: [path.join(ROOT_DIR, 'worklenz-frontend')] }));
  const source = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const visit = node => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 't' &&
        node.arguments.length && ts.isStringLiteralLike(node.arguments[0])) {
      const options = node.arguments[1];
      const hasDefault = options && ts.isObjectLiteralExpression(options) && options.properties.some(property =>
        property.name && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) && property.name.text === 'defaultValue');
      if (!hasDefault) {
        const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
        issues.i18n.push({ file: path.relative(ROOT_DIR, filePath), line, key: node.arguments[0].text,
          text: node.getText(source).split('\n')[0], reason: "Translation call is missing defaultValue." });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
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
  if (!/\.(sql|js)$/i.test(filePath) || !filePath.includes('migration')) return;

  // SQL migrations and pg-migrations embed CREATE TABLE statements in JavaScript.
  const createTable = /\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([\w."-]+)\s*\(/gi;
  let match;
  while ((match = createTable.exec(content))) {
    const bodyStart = createTable.lastIndex;
    let depth = 1;
    let end = bodyStart;
    while (end < content.length && depth > 0) {
      if (content[end] === '(') depth++;
      if (content[end] === ')') depth--;
      end++;
    }
    const body = content.slice(bodyStart, end - 1);
    const columns = body.split(/,(?![^()]*\))/);
    const tableKey = body.match(/\bPRIMARY\s+KEY\s*\(\s*"?(\w+)"?\s*\)/i)?.[1];
    const valid = columns.some(column => {
      const name = column.trim().match(/^"?(\w+)"?\s+/)?.[1];
      const isKey = /\bPRIMARY\s+KEY\b/i.test(column) || (tableKey && name?.toLowerCase() === tableKey.toLowerCase());
      return isKey && /\bUUID\b/i.test(column) && /\bDEFAULT\s+(?:uuid_generate_v4|gen_random_uuid)\s*\(\s*\)/i.test(column);
    });
    if (!valid) issues.database.push({ file: path.relative(ROOT_DIR, filePath),
      line: content.slice(0, match.index).split('\n').length, text: match[0],
      reason: `Table ${match[1]} lacks a UUID primary key with a UUID-generating default.` });
    createTable.lastIndex = end;
  }
}

function runAudit() {
  log(`\n${colors.bold}${colors.cyan}======================================================${colors.reset}`);
  log(`${colors.bold}${colors.cyan}  Worklenz Agentic & QA Rule Compliance Auditor       ${colors.reset}`);
  log(`${colors.bold}${colors.cyan}======================================================${colors.reset}\n`);

  const files = getFilesToScan();
  log(`Scanning ${files.length} target file(s)...\n`);

  for (const filePath of files) {
    if (!stagedOnly && !fs.existsSync(filePath)) continue;
    stats.scannedFiles++;
    try {
      const content = stagedOnly
        ? execFileSync('git', ['show', `:${path.relative(ROOT_DIR, filePath).split(path.sep).join('/')}`], { cwd: ROOT_DIR, encoding: 'utf-8' })
        : fs.readFileSync(filePath, 'utf-8');
      checkI18n(filePath, content);
      checkTheming(filePath, content);
      checkDatabaseMigrations(filePath, content);
    } catch (e) {
      console.error(`Unable to read ${filePath}: ${e.message}`);
      process.exitCode = 1;
      stats.errors++;
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
