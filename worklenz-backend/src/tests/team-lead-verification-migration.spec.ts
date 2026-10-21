import { Client } from 'pg';

interface Migration {
  up(builder: { sql(statement: string): void }): Promise<void>;
}

const migration: Migration = require('../../database/pg-migrations/1758499205000_verify_team_lead_implementation');
const integration = process.env.TEST_TEAM_LEAD_DATABASE_URL ? describe : describe.skip;

// Use a disposable database only: the migration checks objects in public.
integration('Team Lead verification with legacy role data', () => {
  let client: Client;
  let migrationSql: string;

  beforeAll(async () => {
    const statements: string[] = [];
    await migration.up({ sql: statement => { statements.push(statement); } });
    migrationSql = statements.join('\n');
    client = new Client({ connectionString: process.env.TEST_TEAM_LEAD_DATABASE_URL });
    await client.connect();
  });

  beforeEach(async () => {
    await client.query('BEGIN');
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      CREATE TABLE teams (id UUID PRIMARY KEY DEFAULT uuid_generate_v4());
      CREATE TABLE roles (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        team_id UUID REFERENCES teams(id), name TEXT,
        admin_role BOOLEAN DEFAULT FALSE,
        owner BOOLEAN DEFAULT FALSE, default_role BOOLEAN DEFAULT FALSE
      );
      CREATE TABLE users (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), name TEXT, email TEXT);
      CREATE TABLE team_members (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), user_id UUID, team_id UUID,
        role_id UUID, active BOOLEAN DEFAULT TRUE
      );
      CREATE TABLE tasks_assignees (team_member_id UUID, task_id UUID);
      CREATE TABLE tasks (id UUID, status_id UUID, project_id UUID, archived BOOLEAN,
        end_date TIMESTAMPTZ, name TEXT);
      CREATE TABLE task_statuses (id UUID, name TEXT);
      CREATE TABLE task_work_log (id UUID, user_id UUID, task_id UUID, time_spent INTEGER,
        created_at TIMESTAMPTZ, description TEXT, logged_by_timer BOOLEAN);
      CREATE TABLE projects (id UUID, name TEXT);
      CREATE TABLE archived_projects (project_id UUID);
      CREATE FUNCTION is_owner(UUID, UUID) RETURNS BOOLEAN LANGUAGE SQL AS 'SELECT FALSE';
      INSERT INTO teams SELECT uuid_generate_v4() FROM generate_series(1, 19163);
      INSERT INTO roles(team_id, name, admin_role)
        SELECT id, 'Team Lead', TRUE FROM teams;
      INSERT INTO roles(name, admin_role, owner, default_role) VALUES
        ('Admin', TRUE, FALSE, FALSE), ('Owner', FALSE, TRUE, FALSE),
        ('Member', FALSE, FALSE, TRUE);
    `);

  });

  afterEach(async () => { await client.query('ROLLBACK'); });
  afterAll(async () => { await client.end(); });

  it('repairs all 19163 legacy roles, preserves other roles, and supports retries', async () => {
    const otherRoles = await client.query("SELECT * FROM roles WHERE name <> 'Team Lead' ORDER BY name");
    await client.query(migrationSql);
    await client.query(migrationSql);

    const result = await client.query(`SELECT COUNT(*)::INTEGER AS count FROM roles
      WHERE name = 'Team Lead' AND admin_role IS FALSE`);
    expect(result.rows[0].count).toBe(19163);
    expect((await client.query("SELECT * FROM roles WHERE name <> 'Team Lead' ORDER BY name")).rows)
      .toEqual(otherRoles.rows);
    expect((await client.query("SELECT * FROM team_lead_implementation_verification WHERE status = 'FAIL'")).rows)
      .toHaveLength(0);
  });

  it('normalizes a null legacy admin flag', async () => {
    await client.query("UPDATE roles SET admin_role = NULL WHERE name = 'Team Lead'");
    await client.query(migrationSql);
    expect((await client.query("SELECT COUNT(*)::INTEGER AS count FROM roles WHERE name = 'Team Lead' AND admin_role IS FALSE")).rows[0].count)
      .toBe(19163);
  });

  it('still rejects Team Leads incorrectly marked as owners', async () => {
    await client.query("UPDATE roles SET owner = TRUE WHERE name = 'Team Lead'");
    await expect(client.query(migrationSql)).rejects.toThrow('incorrectly marked as owner');
  });

  it('restores missing functions, views, and hierarchy column with working access checks', async () => {
    await client.query(migrationSql);
    const teamId = (await client.query('SELECT id FROM teams LIMIT 1')).rows[0].id;
    const leadRole = (await client.query("SELECT id FROM roles WHERE team_id = $1 AND name = 'Team Lead'", [teamId])).rows[0].id;
    const memberRole = (await client.query("SELECT id FROM roles WHERE name = 'Member'")).rows[0].id;
    const leadUser = (await client.query("INSERT INTO users(name) VALUES ('Lead') RETURNING id")).rows[0].id;
    const memberUser = (await client.query("INSERT INTO users(name) VALUES ('Report') RETURNING id")).rows[0].id;
    const outsiderUser = (await client.query("INSERT INTO users(name) VALUES ('Outsider') RETURNING id")).rows[0].id;
    const leadMember = (await client.query('INSERT INTO team_members(user_id, team_id, role_id) VALUES ($1,$2,$3) RETURNING id',
      [leadUser, teamId, leadRole])).rows[0].id;
    const report = (await client.query('INSERT INTO team_members(user_id, team_id, role_id, reports_to_member_id) VALUES ($1,$2,$3,$4) RETURNING id',
      [memberUser, teamId, memberRole, leadMember])).rows[0].id;
    const outsider = (await client.query('INSERT INTO team_members(user_id, team_id, role_id) VALUES ($1,$2,$3) RETURNING id',
      [outsiderUser, teamId, memberRole])).rows[0].id;

    expect((await client.query('SELECT is_team_lead_by_hierarchy($1,$2) AS allowed', [leadUser, teamId])).rows[0].allowed).toBe(true);
    expect((await client.query('SELECT managed_member_id FROM get_team_lead_managed_members($1,$2)', [leadUser, teamId])).rows)
      .toEqual([{ managed_member_id: report }]);
    expect((await client.query('SELECT can_team_lead_access_member($1,$2,$3) AS allowed', [leadUser, teamId, report])).rows[0].allowed).toBe(true);
    expect((await client.query('SELECT can_team_lead_access_member($1,$2,$3) AS allowed', [leadUser, teamId, outsider])).rows[0].allowed).toBe(false);
    const summary = (await client.query('SELECT * FROM get_user_permissions_summary($1,$2)', [leadUser, teamId])).rows[0];
    expect(summary).toMatchObject({ role_name: 'Team Lead', is_admin: false, is_team_lead: true,
      can_access_management: true, can_access_billing: false, managed_members_count: 1 });
    expect((await client.query('SELECT * FROM team_lead_member_stats')).rows).toHaveLength(1);
    expect((await client.query('SELECT * FROM team_lead_member_performance')).rows).toHaveLength(1);
    expect((await client.query('SELECT * FROM team_lead_time_logs')).rows).toHaveLength(0);
  });

  it('preserves existing function and view definitions', async () => {
    await client.query(migrationSql);
    await client.query(`CREATE OR REPLACE FUNCTION can_access_billing(_user_id UUID, _team_id UUID)
      RETURNS BOOLEAN LANGUAGE SQL AS 'SELECT TRUE'`);
    await client.query('CREATE VIEW custom_team_lead_stats AS SELECT * FROM team_lead_member_stats');
    await client.query(migrationSql);
    expect((await client.query('SELECT can_access_billing(NULL,NULL) AS allowed')).rows[0].allowed).toBe(true);
    expect((await client.query("SELECT to_regclass('custom_team_lead_stats') IS NOT NULL AS exists")).rows[0].exists).toBe(true);
  });

  it('repairs a partially installed schema', async () => {
    await client.query(migrationSql);
    await client.query('DROP FUNCTION is_team_lead_by_hierarchy(UUID, UUID)');
    await client.query('DROP FUNCTION can_access_team_management(UUID, UUID)');
    await client.query('DROP VIEW team_lead_member_stats');
    await client.query('DROP INDEX idx_reports_to_member_id');
    await client.query(migrationSql);
    expect((await client.query("SELECT * FROM team_lead_implementation_verification WHERE status = 'FAIL'")).rows)
      .toHaveLength(0);
  });
});
