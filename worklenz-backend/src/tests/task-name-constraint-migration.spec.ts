import { Client } from 'pg';

interface Migration {
  up(builder: { sql(statement: string): void }): Promise<void>;
}

const migration: Migration = require('../../database/pg-migrations/1785196802000_fix_task_name_constraint_to_250_chars');
const integration = process.env.TEST_TASK_NAME_DATABASE_URL ? describe : describe.skip;

// This URL must point to an empty disposable database, never the application DB.
integration('Task name constraint migration', () => {
  let client: Client;
  let migrationSql: string;

  beforeAll(async () => {
    const statements: string[] = [];
    await migration.up({ sql: statement => { statements.push(statement); } });
    migrationSql = statements.join('\n');
    client = new Client({ connectionString: process.env.TEST_TASK_NAME_DATABASE_URL });
    await client.connect();
  });

  beforeEach(async () => {
    await client.query('BEGIN');
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      CREATE TABLE tasks (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), name TEXT,
        archived BOOLEAN DEFAULT FALSE,
        CONSTRAINT tasks_name_check CHECK (CHAR_LENGTH(name) <= 500)
      );
    `);
  });
  afterEach(async () => { await client.query('ROLLBACK'); });
  afterAll(async () => { await client.end(); });

  const isValidated = async () => (await client.query(`SELECT convalidated FROM pg_constraint
    WHERE conrelid = 'tasks'::regclass AND conname = 'tasks_name_check'`)).rows[0].convalidated;

  it('preserves legacy names and supports retrying the migration', async () => {
    const originalName = 'x'.repeat(500);
    await client.query('INSERT INTO tasks(name) VALUES ($1)', [originalName]);
    await client.query(migrationSql);
    await client.query(migrationSql);
    expect((await client.query('SELECT name FROM tasks')).rows).toEqual([{ name: originalName }]);
    expect(await isValidated()).toBe(false);
  });

  it('accepts exactly 250 Unicode characters', async () => {
    await client.query(migrationSql);
    const name = '🙂'.repeat(250);
    await client.query('INSERT INTO tasks(name) VALUES ($1)', [name]);
    expect((await client.query('SELECT name FROM tasks')).rows[0].name).toBe(name);
    expect(await isValidated()).toBe(true);
  });

  it('rejects a new overlong name even when legacy rows remain', async () => {
    await client.query('INSERT INTO tasks(name) VALUES ($1)', ['x'.repeat(500)]);
    await client.query(migrationSql);
    await expect(client.query('INSERT INTO tasks(name) VALUES ($1)', ['x'.repeat(251)]))
      .rejects.toMatchObject({ code: '23514', constraint: 'tasks_name_check' });
  });

  it('checks updates to legacy rows and permits correcting their names', async () => {
    await client.query('INSERT INTO tasks(name) VALUES ($1)', ['x'.repeat(500)]);
    await client.query(migrationSql);
    await client.query('SAVEPOINT invalid_update');
    await expect(client.query('UPDATE tasks SET archived = TRUE'))
      .rejects.toMatchObject({ code: '23514', constraint: 'tasks_name_check' });
    await client.query('ROLLBACK TO SAVEPOINT invalid_update');
    await client.query("UPDATE tasks SET name = 'Corrected name', archived = TRUE");
    await client.query('ALTER TABLE tasks VALIDATE CONSTRAINT tasks_name_check');
    expect(await isValidated()).toBe(true);
  });

  it('validates compliant existing data immediately', async () => {
    await client.query('INSERT INTO tasks(name) VALUES ($1), (NULL)', ['x'.repeat(250)]);
    await client.query(migrationSql);
    expect(await isValidated()).toBe(true);
  });

  it('keeps the runner transaction intact so a later failure can roll it back', async () => {
    await client.query('SAVEPOINT before_migration');
    await client.query(migrationSql);
    await client.query('ROLLBACK TO SAVEPOINT before_migration');
    // Rolling back restores the old 500-character constraint.
    await client.query('INSERT INTO tasks(name) VALUES ($1)', ['x'.repeat(500)]);
    expect((await client.query('SELECT CHAR_LENGTH(name) AS length FROM tasks')).rows[0].length).toBe(500);
  });
});
