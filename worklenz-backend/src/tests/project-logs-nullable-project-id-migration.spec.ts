import { Client } from 'pg';

interface MigrationBuilder { sql(statement: string): void }
interface Migration {
  up(builder: MigrationBuilder): Promise<void>;
  down(builder: MigrationBuilder): Promise<void>;
}

const migration: Migration = require('../../database/pg-migrations/1793702641435_allow-null-project-logs-project-id');
const integration = process.env.TEST_PROJECT_LOGS_DATABASE_URL ? describe : describe.skip;

const collectSql = async (step: (builder: MigrationBuilder) => Promise<void>) => {
  const statements: string[] = [];
  await step({ sql: statement => { statements.push(statement); } });
  return statements.join('\n');
};

// This URL must point to an empty disposable database, never the application DB.
integration('Nullable project_logs.project_id migration', () => {
  let client: Client;
  let upSql: string;
  let downSql: string;

  beforeAll(async () => {
    upSql = await collectSql(builder => migration.up(builder));
    downSql = await collectSql(builder => migration.down(builder));
    client = new Client({ connectionString: process.env.TEST_PROJECT_LOGS_DATABASE_URL });
    await client.connect();
  });

  beforeEach(async () => {
    await client.query('BEGIN');
    // Shape left by 1_tables.sql + 1757289600000_preserve_project_logs_after_deletion.
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      CREATE TABLE projects (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), name TEXT NOT NULL);
      CREATE TABLE project_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        project_id UUID NOT NULL,
        project_name TEXT,
        description TEXT NOT NULL,
        CONSTRAINT project_logs_projects_id_fk
          FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE SET NULL
      );
    `);
  });
  afterEach(async () => { await client.query('ROLLBACK'); });
  afterAll(async () => { await client.end(); });

  const createLoggedProject = async () => {
    const { rows } = await client.query("INSERT INTO projects(name) VALUES ('Website') RETURNING id");
    await client.query(
      "INSERT INTO project_logs(project_id, project_name, description) VALUES ($1, 'Website', 'Project deleted')",
      [rows[0].id],
    );
    return rows[0].id as string;
  };

  const isNullable = async () => (await client.query(`SELECT is_nullable FROM information_schema.columns
    WHERE table_name = 'project_logs' AND column_name = 'project_id'`)).rows[0].is_nullable === 'YES';

  it('reproduces the failure: deleting a project with logs is rejected before the migration', async () => {
    const projectId = await createLoggedProject();
    await expect(client.query('DELETE FROM projects WHERE id = $1', [projectId]))
      .rejects.toMatchObject({ code: '23502', column: 'project_id' });
  });

  it('deletes the project and keeps its logs with the project name', async () => {
    const projectId = await createLoggedProject();
    await client.query(upSql);
    await client.query('DELETE FROM projects WHERE id = $1', [projectId]);
    expect((await client.query('SELECT id FROM projects')).rows).toEqual([]);
    expect((await client.query('SELECT project_id, project_name FROM project_logs')).rows)
      .toEqual([{ project_id: null, project_name: 'Website' }]);
  });

  it('can be applied more than once', async () => {
    await client.query(upSql);
    await client.query(upSql);
    expect(await isNullable()).toBe(true);
  });

  it('down restores NOT NULL when no deleted-project logs exist', async () => {
    await createLoggedProject();
    await client.query(upSql);
    await client.query(downSql);
    expect(await isNullable()).toBe(false);
  });

  it('down keeps the column nullable instead of failing when deleted-project logs exist', async () => {
    const projectId = await createLoggedProject();
    await client.query(upSql);
    await client.query('DELETE FROM projects WHERE id = $1', [projectId]);
    await client.query(downSql);
    expect(await isNullable()).toBe(true);
    expect((await client.query('SELECT COUNT(*)::int AS count FROM project_logs')).rows[0].count).toBe(1);
  });
});
