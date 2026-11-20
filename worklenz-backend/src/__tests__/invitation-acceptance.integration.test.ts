import { randomUUID } from "crypto";
import { Pool } from "pg";

interface Migration { up(pgm: { sql(statement: string): void }): void }
const migration: Migration = require("../../database/pg-migrations/1794260003000_secure_invitation_acceptance");
const integration = process.env.TEST_SECURITY_DATABASE_URL ? describe : describe.skip;

integration("invitation acceptance", () => {
  const schema = `invitation_test_${randomUUID().replace(/-/g, "")}`;
  let admin: Pool;
  let pool: Pool;
  const user = randomUUID();
  const other = randomUUID();
  const team = randomUUID();
  const member = randomUUID();

  beforeAll(async () => {
    admin = new Pool({ connectionString: process.env.TEST_SECURITY_DATABASE_URL });
    await admin.query(`CREATE SCHEMA ${schema}`);
    pool = new Pool({ connectionString: process.env.TEST_SECURITY_DATABASE_URL, options: `-c search_path=${schema},public` });
    await pool.query(`
      CREATE TABLE users(id UUID PRIMARY KEY, email TEXT);
      CREATE TABLE team_members(id UUID PRIMARY KEY, team_id UUID, user_id UUID, active BOOLEAN);
      CREATE TABLE email_invitations(team_id UUID, team_member_id UUID, email TEXT);
      CREATE TABLE user_notifications(user_id UUID, team_id UUID, message TEXT, read BOOLEAN);
    `);
    const statements: string[] = [];
    migration.up({ sql: statement => statements.push(statement) });
    for (const statement of statements) await pool.query(statement);
    await pool.query("INSERT INTO users VALUES ($1, 'invitee@example.com'), ($2, 'other@example.com')", [user, other]);
  });
  beforeEach(async () => {
    await pool.query("TRUNCATE team_members, email_invitations");
    await pool.query("INSERT INTO team_members VALUES ($1, $2, NULL, TRUE)", [member, team]);
    await pool.query("INSERT INTO email_invitations VALUES ($1, $2, 'invitee@example.com')", [team, member]);
  });
  afterAll(async () => {
    if (pool) await pool.end();
    if (admin) { await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await admin.end(); }
  });
  it("rejects another user and preserves the invitation", async () => {
    const result = await pool.query("SELECT accept_invitation($1, $2, $3) AS result", ["other@example.com", member, other]);
    expect(result.rows[0].result).toBeNull();
    expect((await pool.query("SELECT user_id FROM team_members WHERE id = $1", [member])).rows[0].user_id).toBeNull();
  });
  it.each([false, true])("accepts the recipient when already linked: %s", async linked => {
    if (linked) await pool.query("UPDATE team_members SET user_id = $1 WHERE id = $2", [user, member]);
    const result = await pool.query("SELECT accept_invitation($1, $2, $3) AS result", ["INVITEE@example.com", member, user]);
    expect(result.rows[0].result.id).toBe(team);
    expect((await pool.query("SELECT count(*)::int AS count FROM email_invitations")).rows[0].count).toBe(0);
  });
  it("does not replace another member even with a matching invitation", async () => {
    await pool.query("UPDATE team_members SET user_id = $1 WHERE id = $2", [other, member]);
    const result = await pool.query("SELECT accept_invitation($1, $2, $3) AS result", ["invitee@example.com", member, user]);
    expect(result.rows[0].result).toBeNull();
  });
  it("allows only one concurrent claim", async () => {
    const results = await Promise.all(Array.from({ length: 2 }, () => pool.query(
      "SELECT accept_invitation($1, $2, $3) AS result", ["invitee@example.com", member, user]
    )));
    expect(results.filter(result => result.rows[0].result !== null)).toHaveLength(1);
  });
});
