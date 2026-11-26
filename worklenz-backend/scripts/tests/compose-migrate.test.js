'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { runComposeMigrations } = require('../compose-migrate');

function mockDatabase({ fresh, hasHistory, recorded }) {
  const queries = [];
  let closed = false;
  return {
    queries,
    get closed() { return closed; },
    async query(sql) {
      queries.push(sql);
      if (sql.includes('to_regclass')) return { rows: [{ fresh, has_history: hasHistory }] };
      if (sql.includes('SELECT EXISTS')) return { rows: [{ recorded }] };
      if (sql.startsWith('DROP TABLE')) return { rows: [] };
      throw new Error(`Unexpected query: ${sql}`);
    },
    async end() { closed = true; },
  };
}

test('migrates a fresh base schema and clears the marker only after success', async () => {
  const db = mockDatabase({ fresh: true, hasHistory: false });
  let runs = 0;
  await runComposeMigrations(db, () => { runs++; return { status: 0 }; });
  assert.equal(runs, 1);
  assert(db.queries.some(q => q.startsWith('DROP TABLE')));
  assert(db.closed);
});

test('rejects an existing database without recorded migration history', async () => {
  for (const hasHistory of [false, true]) {
    const db = mockDatabase({ fresh: false, hasHistory, recorded: false });
    let runs = 0;
    await assert.rejects(runComposeMigrations(db, () => { runs++; return { status: 0 }; }), /no recorded Node migration history/);
    assert.equal(runs, 0);
    assert(db.closed);
  }
});

test('allows an existing database with migration history', async () => {
  const db = mockDatabase({ fresh: false, hasHistory: true, recorded: true });
  let runs = 0;
  await runComposeMigrations(db, () => { runs++; return { status: 0 }; });
  assert.equal(runs, 1);
  assert(!db.queries.some(q => q.startsWith('DROP TABLE')));
});

test('preserves the fresh-install marker when a migration fails', async () => {
  const db = mockDatabase({ fresh: true, hasHistory: false });
  await assert.rejects(runComposeMigrations(db, () => ({ status: 1 })), /Migration process failed/);
  assert(!db.queries.some(q => q.startsWith('DROP TABLE')));
  assert(db.closed);
});
