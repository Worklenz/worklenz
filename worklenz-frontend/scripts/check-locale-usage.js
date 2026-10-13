#!/usr/bin/env node
// Check literal translation calls against English, including keys absent from
// every language (which comparing locale files alone cannot detect).
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const ROOT_DIR = path.join(__dirname, '..');
const IMPORT_NAMESPACE = 'settings/import-export';

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}

function literal(node) {
  return node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    ? node.text
    : undefined;
}

function property(node, name) {
  if (!node || !ts.isObjectLiteralExpression(node)) return undefined;
  return node.properties.find(item => item.name?.getText() === name)?.initializer;
}

function visit(node, callback) {
  callback(node);
  ts.forEachChild(node, child => visit(child, callback));
}

function collectTranslationCalls(source, fileName) {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  const bindings = new Map();

  function setBinding(node, name, binding) {
    let scope = node;
    while (scope && !ts.isBlock(scope) && !ts.isSourceFile(scope)) scope = scope.parent;
    if (!bindings.has(scope)) bindings.set(scope, new Map());
    bindings.get(scope).set(name, binding);
  }

  function getBinding(node, name) {
    while (node) {
      const binding = bindings.get(node)?.get(name);
      if (binding) return binding;
      node = node.parent;
    }
    return undefined;
  }

  // These components/hooks receive the import wizard's translator as a prop.
  // Restrict this convention to that directory; other passed translators have
  // no statically known namespace and are deliberately skipped.
  if (fileName.replace(/\\/g, '/').includes('/settings/import-export/')) {
    setBinding(file, 't', { namespace: IMPORT_NAMESPACE, prefix: '' });
    setBinding(file, 'tt', { namespace: IMPORT_NAMESPACE, prefix: '' });
  }

  visit(file, node => {
    if (!ts.isVariableDeclaration(node) || !node.initializer ||
        !ts.isCallExpression(node.initializer) ||
        node.initializer.expression.getText(file) !== 'useTranslation') return;

    const argument = node.initializer.arguments[0];
    let namespace = argument
      ? literal(argument) || (ts.isArrayLiteralExpression(argument) ? literal(argument.elements[0]) : undefined)
      : 'common';
    if (!namespace && argument && ts.isIdentifier(argument)) {
      visit(file, declaration => {
        if (ts.isVariableDeclaration(declaration) && declaration.name.getText(file) === argument.text) {
          namespace = literal(declaration.initializer);
        }
      });
    }
    if (!namespace || !ts.isObjectBindingPattern(node.name)) return;

    for (const element of node.name.elements) {
      if ((element.propertyName || element.name).getText(file) === 't') {
        setBinding(node, element.name.getText(file), {
          namespace,
          prefix: literal(property(node.initializer.arguments[1], 'keyPrefix')) || '',
        });
      }
    }
  });

  const calls = [];
  visit(file, node => {
    if (!ts.isCallExpression(node)) return;
    const binding = getBinding(node, node.expression.getText(file));
    let key = literal(node.arguments[0]);
    if (!binding || !key) return;
    let namespace = literal(property(node.arguments[1], 'ns')) || binding.namespace;
    const separator = key.indexOf(':');
    if (separator >= 0) {
      namespace = key.slice(0, separator);
      key = key.slice(separator + 1);
    } else if (binding.prefix) {
      key = `${binding.prefix}.${key}`;
    }
    calls.push({ namespace, key, line: file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1 });
  });
  return calls;
}

function hasTranslation(data, key) {
  if (!data) return false;
  const get = keyPath => data[keyPath] ?? keyPath.split('.').reduce((value, part) => value?.[part], data);
  // i18next can select a plural variant when count is passed.
  return [key, `${key}_one`, `${key}_other`].some(candidate => get(candidate) !== undefined);
}

function main() {
  const localeDirectory = path.join(ROOT_DIR, 'public', 'locales', 'en');
  const namespaces = Object.fromEntries(walk(localeDirectory)
    .filter(file => file.endsWith('.json'))
    .map(file => [path.relative(localeDirectory, file).replace(/\\/g, '/').slice(0, -5), JSON.parse(fs.readFileSync(file, 'utf8'))]));
  const missing = [];
  let checked = 0;
  for (const file of walk(path.join(ROOT_DIR, 'src')).filter(file => /\.tsx?$/.test(file))) {
    for (const call of collectTranslationCalls(fs.readFileSync(file, 'utf8'), file)) {
      checked++;
      if (!hasTranslation(namespaces[call.namespace], call.key)) {
        missing.push({ ...call, file: path.relative(ROOT_DIR, file) });
      }
    }
  }
  if (!missing.length) {
    console.log(`Checked ${checked} literal translation calls — all keys exist in English.`);
    return;
  }
  for (const call of missing) console.error(`${call.file}:${call.line}: ${call.namespace}:${call.key}`);
  console.error(`${missing.length} translation call(s) reference missing English keys.`);
  process.exitCode = 1;
}

if (require.main === module) main();
module.exports = { collectTranslationCalls, hasTranslation };
