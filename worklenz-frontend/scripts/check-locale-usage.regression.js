const assert = require('node:assert/strict');
const { test } = require('node:test');
const { collectTranslationCalls, hasTranslation } = require('./check-locale-usage');

test('detects source keys missing from every locale, even with a fallback', () => {
  const calls = collectTranslationCalls(`
    const { t } = useTranslation('settings/import-export');
    t('steps.previewCsv', { defaultValue: 'Preview' });
  `, '/src/import.tsx');
  assert.equal(calls[0].namespace, 'settings/import-export');
  assert.equal(hasTranslation({ steps: {} }, calls[0].key), false);
  assert.equal(hasTranslation({ steps: { previewCsv: 'Preview' } }, calls[0].key), true);
});

test('resolves aliased translators in their own component scopes', () => {
  const calls = collectTranslationCalls(`
    function First() { const { t: translate } = useTranslation('first'); translate('name'); }
    function Second() { const { t: translate } = useTranslation('second'); translate('name'); }
  `, '/src/scopes.tsx');
  assert.deepEqual(calls.map(({ namespace, key }) => ({ namespace, key })), [
    { namespace: 'first', key: 'name' }, { namespace: 'second', key: 'name' },
  ]);
});

test('resolves key prefixes and explicit namespace overrides', () => {
  const calls = collectTranslationCalls(`
    const { t } = useTranslation(['home', 'common'], { keyPrefix: 'calendar' });
    t('today'); t('common:cancel'); t('save', { ns: 'settings' });
  `, '/src/prefix.tsx');
  assert.deepEqual(calls.map(({ namespace, key }) => ({ namespace, key })), [
    { namespace: 'home', key: 'calendar.today' },
    { namespace: 'common', key: 'cancel' },
    { namespace: 'settings', key: 'calendar.save' },
  ]);
});

test('checks passed import translators while skipping dynamic keys', () => {
  const calls = collectTranslationCalls(`t('importStep.previewCsvTitle'); tt('steps.previewCsv', 'Preview'); t(dynamicKey);`,
    '/src/pages/settings/import-export/import-source-modal/components/Preview.tsx');
  assert.equal(calls.length, 2);
  assert.ok(calls.every(call => call.namespace === 'settings/import-export'));
});

test('recognizes plural variants and reports missing namespaces', () => {
  assert.equal(hasTranslation({ tasks_one: 'Task', tasks_other: 'Tasks' }, 'tasks'), true);
  assert.equal(hasTranslation(undefined, 'endDate'), false);
});

test('import previews and project end dates are translated in frontend and backend resources', () => {
  const fs = require('fs');
  const path = require('path');
  const languages = ['en', 'alb', 'de', 'es', 'fr', 'pl', 'pt', 'zh'];
  const front = path.join(__dirname, '../public/locales');
  const back = path.join(__dirname, '../../worklenz-backend/src/public/locales');
  const keys = {
    'settings/import-export': [
      'steps.previewCsv', 'importStep.previewCsvTitle', 'importStep.previewCsvHelp',
      'importStep.csvPreviewLabelWithFile', 'importStep.csvPreviewLabel',
    ],
    'all-project-list': ['endDate'],
  };
  const get = (data, key) => key.split('.').reduce((node, part) => node?.[part], data);
  const variables = value => (value.match(/\{\{[^}]+\}\}/g) || []).sort();
  for (const [namespace, namespaceKeys] of Object.entries(keys)) {
    const english = JSON.parse(fs.readFileSync(path.join(front, 'en', `${namespace}.json`), 'utf8'));
    for (const language of languages) {
      for (const directory of [front, back]) {
        const file = path.join(directory, language, `${namespace}.json`);
        const data = JSON.parse(fs.readFileSync(file, 'utf8'));
        for (const key of namespaceKeys) {
          const value = get(data, key);
          assert.equal(typeof value, 'string', `${language}/${namespace}:${key}`);
          assert.ok(value.length > 0);
          assert.deepEqual(variables(value), variables(get(english, key)));
          if (language !== 'en') assert.notEqual(value, get(english, key));
        }
      }
    }
  }
});

test('reported import, template, and team-member namespaces are complete in every locale copy', () => {
  const fs = require('fs');
  const path = require('path');
  const front = path.join(__dirname, '../public/locales');
  const back = path.join(__dirname, '../../worklenz-backend/src/public/locales');
  const languages = ['en', 'alb', 'de', 'es', 'fr', 'pl', 'pt', 'zh'];
  const reportedKeys = {
    'settings/import-export': ['common.previous'],
    'settings/project-templates': ['confirmImport'],
    'settings/team-members': [
      'teamLeadText', 'roleDescriptionTeamLead', 'adminText', 'roleDescriptionAdmin',
      'inviteWithEmailTab', 'memberEmailLabel', 'memberEmailPlaceholder', 'noResultFound',
      'addMemberEmailHint',
    ],
  };
  const read = (directory, language, namespace) =>
    JSON.parse(fs.readFileSync(path.join(directory, language, `${namespace}.json`), 'utf8'));
  const stringKeys = (data, prefix = '') => Object.entries(data).flatMap(([key, value]) => {
    const keyPath = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string' ? [keyPath] : stringKeys(value, keyPath);
  });
  const get = (data, key) => key.split('.').reduce((node, part) => node?.[part], data);
  for (const [namespace, keys] of Object.entries(reportedKeys)) {
    for (const language of languages) {
      const source = read(front, language, namespace);
      for (const directory of [front, back]) {
        const locale = read(directory, language, namespace);
        // Check whole namespaces so additional dynamic role keys are covered too.
        for (const key of new Set([...keys, ...stringKeys(source)])) {
          const value = get(locale, key);
          assert.equal(typeof value, 'string', `${directory}/${language}/${namespace}:${key}`);
          assert.ok(value.trim().length > 0);
        }
      }
    }
  }
});
