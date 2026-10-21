import { randomUUID } from 'crypto';
import { Pool } from 'pg';

interface Migration {
  up(pgm: { sql(statement: string): void }): void;
  down(pgm: { sql(statement: string): void }): void;
}
const migration: Migration = require('../../database/pg-migrations/1792487961615_oss-invitation-security');
const integration = process.env.TEST_SECURITY_DATABASE_URL ? describe : describe.skip;

// This must point to a disposable database. Application DB_* credentials are never used.
integration('OSS security database guards', () => {
  const schema = `security_test_${randomUUID().replace(/-/g, '')}`;
  let pool: Pool;
  let admin: Pool;
  let teamId: string;
  const apply = async (direction: 'up' | 'down') => {
    const statements: string[] = [];
    migration[direction]({ sql: statement => { statements.push(statement); } });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const sql of statements) await client.query(sql);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  };
  beforeAll(async () => {
    admin = new Pool({ connectionString: process.env.TEST_SECURITY_DATABASE_URL });
    await admin.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await admin.query(`CREATE SCHEMA ${schema}`);
    pool = new Pool({ connectionString: process.env.TEST_SECURITY_DATABASE_URL,
      options: `-c search_path=${schema},public`, max: 20 });
    await pool.query(`
      CREATE TABLE teams(id UUID PRIMARY KEY DEFAULT uuid_generate_v4());
      CREATE TABLE tasks(id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), description TEXT);
      CREATE TABLE email_invitations(id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), team_id UUID);
      CREATE TABLE blocked_signup_email_domains(domain TEXT PRIMARY KEY, active BOOLEAN DEFAULT TRUE);
      CREATE TABLE blocked_task_content_hosts(host TEXT PRIMARY KEY, active BOOLEAN DEFAULT TRUE);
      INSERT INTO blocked_signup_email_domains VALUES ('existing.example', TRUE);
      INSERT INTO blocked_task_content_hosts VALUES ('bad.example', TRUE);
    `);
    await apply('up');
    teamId = (await pool.query('INSERT INTO teams DEFAULT VALUES RETURNING id')).rows[0].id;
  });
  beforeEach(async () => {
    await pool.query('TRUNCATE email_invitations, security_invitation_counters');
    await pool.query('UPDATE security_invitation_policy SET max_per_window = 5, window_seconds = 3600, invitations_paused = FALSE');
  });
  afterAll(async () => {
    if (pool) await pool.end();
    if (admin) { await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await admin.end(); }
  });
  it('can be reapplied without changing production blocklists or policy settings', async () => {
    await apply('up');
    expect((await pool.query('SELECT max_per_window FROM security_invitation_policy')).rows[0].max_per_window).toBe(5);
    expect((await pool.query('SELECT domain FROM blocked_signup_email_domains')).rows[0].domain).toBe('existing.example');
    expect((await pool.query('SELECT host FROM blocked_task_content_hosts')).rows[0].host).toBe('bad.example');
  });
  it.each([
    'https://bad.example/file', '<a href="https://BAD.EXAMPLE.:443/file">open</a>',
    'https://bad&period;example/file', 'https://&#x000062;ad.example/file',
    '//child.bad.example/file', 'https://user:password@bad.example/file',
    'https://safe.example@bad.example/file', 'https://%62ad.example/file',
    '<a href="https&#58;&#47;&#47;bad.example/file">open</a>',
    'https&colon;&sol;&sol;bad.example/file', String.raw`https:\\bad.example/file`,
  ])('rejects a blocked URL: %s', async description => {
    await expect(pool.query('INSERT INTO tasks(description) VALUES ($1)', [description]))
      .rejects.toThrow('ERROR_SECURITY_BLOCKED_TASK_HOST');
  });
  it.each([
    'https://notbad.example/file', 'https://bad.example.safe.example/file',
    'https://safe.example/bad.example', 'https://safe.example/?target=bad.example',
    'https://bad.example@safe.example/file', 'A plain mention of bad.example', '',
  ])('allows unrelated content: %s', async description => {
    await expect(pool.query('INSERT INTO tasks(description) VALUES ($1)', [description])).resolves.toBeDefined();
  });
  it('also protects task updates and honors deactivated hosts', async () => {
    const id = (await pool.query("INSERT INTO tasks(description) VALUES ('safe') RETURNING id")).rows[0].id;
    await expect(pool.query("UPDATE tasks SET description = 'https://bad.example' WHERE id = $1", [id]))
      .rejects.toThrow('ERROR_SECURITY_BLOCKED_TASK_HOST');
    await pool.query("UPDATE blocked_task_content_hosts SET active = FALSE WHERE host = 'bad.example'");
    await expect(pool.query("UPDATE tasks SET description = 'https://bad.example' WHERE id = $1", [id])).resolves.toBeDefined();
    await pool.query("UPDATE blocked_task_content_hosts SET active = TRUE WHERE host = 'bad.example'");
  });
  it('caps concurrent invitations across independent connections', async () => {
    const results = await Promise.allSettled(Array.from({ length: 20 }, () =>
      pool.query('INSERT INTO email_invitations(team_id) VALUES ($1)', [teamId])));
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(5);
    const rejected = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
    expect(rejected).toHaveLength(15);
    for (const result of rejected) expect(result.reason.message).toBe('ERROR_SECURITY_INVITATION_LIMIT');
  });
  it('rolls back reservations with failed batches and survives deleted invitations', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('INSERT INTO email_invitations(team_id) SELECT $1 FROM generate_series(1, 5)', [teamId]);
      await client.query('ROLLBACK');
      await pool.query('INSERT INTO email_invitations(team_id) SELECT $1 FROM generate_series(1, 5)', [teamId]);
      await pool.query('DELETE FROM email_invitations');
      await expect(pool.query('INSERT INTO email_invitations(team_id) VALUES ($1)', [teamId]))
        .rejects.toThrow('ERROR_SECURITY_INVITATION_LIMIT');
    } finally { client.release(); }
  });
  it('isolates teams and resets expired windows', async () => {
    const other = (await pool.query('INSERT INTO teams DEFAULT VALUES RETURNING id')).rows[0].id;
    await pool.query('INSERT INTO email_invitations(team_id) SELECT $1 FROM generate_series(1, 5)', [teamId]);
    await expect(pool.query('INSERT INTO email_invitations(team_id) VALUES ($1)', [other])).resolves.toBeDefined();
    await pool.query("UPDATE security_invitation_counters SET expires_at = CURRENT_TIMESTAMP - INTERVAL '1 second'");
    await expect(pool.query('INSERT INTO email_invitations(team_id) VALUES ($1)', [teamId])).resolves.toBeDefined();
  });
  it('reserves outbound email separately to cover invitations to existing members', async () => {
    const results = await Promise.allSettled(Array.from({ length: 12 }, () =>
      pool.query("SELECT reserve_security_invitation($1, 'email')", [teamId])));
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(5);
    await expect(pool.query('INSERT INTO email_invitations(team_id) VALUES ($1)', [teamId])).resolves.toBeDefined();
  });
  it('can disable quotas while continuing to honor the invitation pause', async () => {
    await pool.query('UPDATE security_invitation_policy SET max_per_window = 0');
    await pool.query('INSERT INTO email_invitations(team_id) SELECT $1 FROM generate_series(1, 20)', [teamId]);
    await pool.query('UPDATE security_invitation_policy SET invitations_paused = TRUE');
    await expect(pool.query('INSERT INTO email_invitations(team_id) VALUES ($1)', [teamId]))
      .rejects.toThrow('ERROR_SECURITY_INVITATIONS_PAUSED');
    await expect(pool.query("SELECT reserve_security_invitation($1, 'email')", [teamId]))
      .rejects.toThrow('ERROR_SECURITY_INVITATIONS_PAUSED');
  });
  it('preserves policy and event history on rollback and supports reapplying', async () => {
    await pool.query("INSERT INTO security_events(team_id, event_type) VALUES ($1, 'test')", [teamId]);
    await apply('down');
    expect((await pool.query('SELECT COUNT(*)::INT AS count FROM security_events')).rows[0].count).toBe(1);
    expect((await pool.query('SELECT host FROM blocked_task_content_hosts')).rows[0].host).toBe('bad.example');
    await expect(pool.query("INSERT INTO tasks(description) VALUES ('https://bad.example')")).resolves.toBeDefined();
    await apply('up');
  });
  it('creates UUID blocklist keys on fresh installations', async () => {
    await apply('down');
    await pool.query('DROP TABLE blocked_signup_email_domains, blocked_task_content_hosts');
    await apply('up');
    for (const table of ['blocked_signup_email_domains', 'blocked_task_content_hosts']) {
      const columns = await pool.query(`SELECT data_type, column_default FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2 AND column_name = 'id'`, [schema, table]);
      expect(columns.rows[0].data_type).toBe('uuid');
      expect(columns.rows[0].column_default).toContain('uuid_generate_v4');
    }
  });

});
