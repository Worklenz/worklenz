import path from "path";
import { Client } from "pg";

import db from "../config/db";
import { log_error } from "../shared/utils";
import { PURGE_EXPIRED_AUDIT_EVENTS_SQL, runAuditLogRetentionPurge } from "../cron_jobs/audit-log-retention-job";

jest.mock("../config/db", () => ({
  query: jest.fn(),
  pool: { connect: jest.fn() },
}));

jest.mock("../shared/utils", () => ({
  log_error: jest.fn(),
}));

interface MigrationModule {
  up: (pgm: { sql: (statement: string) => void }) => void;
}

const MIGRATIONS_DIR = path.resolve(__dirname, "../../database/pg-migrations");
const AUDIT_MIGRATIONS = [
  "1791193625587_create-audit-events-table.js",
  "1791193625588_add-audit-log-retention-to-organizations.js",
  "1791267995553_allow-audit-events-fk-set-null.js",
];

const collectMigrationSql = (fileName: string): string => {
  const statements: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const migration = require(path.join(MIGRATIONS_DIR, fileName)) as MigrationModule;
  migration.up({ sql: (statement) => statements.push(statement) });
  return statements.join("\n");
};

const createLockClient = (options: { acquired?: boolean; purgeResult?: unknown; purgeError?: Error } = {}) => {
  const query = jest.fn().mockImplementation((sql: string) => {
    if (sql.includes("pg_try_advisory_lock")) {
      return Promise.resolve({ rows: [{ acquired: options.acquired ?? true }] });
    }
    if (sql === PURGE_EXPIRED_AUDIT_EVENTS_SQL) {
      if (options.purgeError) return Promise.reject(options.purgeError);
      return Promise.resolve(options.purgeResult ?? { rows: [{ deleted_count: 0 }] });
    }
    return Promise.resolve({ rows: [] });
  });
  const client = { query, release: jest.fn() };
  (db.pool.connect as jest.Mock).mockResolvedValue(client);
  return client;
};

const executedSql = (client: { query: jest.Mock }) => client.query.mock.calls.map(([sql]) => sql as string);

describe("runAuditLogRetentionPurge", () => {
  beforeEach(() => jest.clearAllMocks());

  it("purges through purge_expired_audit_events() and returns the deleted count", async () => {
    const client = createLockClient({ purgeResult: { rows: [{ deleted_count: 7 }] } });

    await expect(runAuditLogRetentionPurge()).resolves.toBe(7);

    expect(executedSql(client)).toContain(PURGE_EXPIRED_AUDIT_EVENTS_SQL);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it("never issues a raw DELETE against audit_events itself", async () => {
    const client = createLockClient({ purgeResult: { rows: [{ deleted_count: 3 }] } });

    await runAuditLogRetentionPurge();

    executedSql(client).forEach((sql) => expect(sql).not.toMatch(/DELETE\s+FROM/i));
    expect(db.query).not.toHaveBeenCalled();
  });

  it("purges every organization in one sweep (no organization argument)", async () => {
    expect(PURGE_EXPIRED_AUDIT_EVENTS_SQL).toMatch(/purge_expired_audit_events\(\)/);
  });

  it("releases the advisory lock after purging", async () => {
    const client = createLockClient();

    await runAuditLogRetentionPurge();

    const sql = executedSql(client);
    expect(sql.findIndex((s) => s.includes("pg_advisory_unlock"))).toBeGreaterThan(
      sql.indexOf(PURGE_EXPIRED_AUDIT_EVENTS_SQL)
    );
  });

  it("skips the purge when another instance holds the lock", async () => {
    const client = createLockClient({ acquired: false });

    await expect(runAuditLogRetentionPurge()).resolves.toBeNull();

    expect(executedSql(client)).not.toContain(PURGE_EXPIRED_AUDIT_EVENTS_SQL);
    expect(executedSql(client).some((s) => s.includes("pg_advisory_unlock"))).toBe(false);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it("logs and swallows purge failures, still releasing the lock and connection", async () => {
    const error = new Error("boom");
    const client = createLockClient({ purgeError: error });

    await expect(runAuditLogRetentionPurge()).resolves.toBeNull();

    expect(log_error).toHaveBeenCalledWith(error);
    expect(executedSql(client).some((s) => s.includes("pg_advisory_unlock"))).toBe(true);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it("treats a missing count as zero", async () => {
    createLockClient({ purgeResult: { rows: [] } });

    await expect(runAuditLogRetentionPurge()).resolves.toBe(0);
  });
});

describe("purge_expired_audit_events() definition", () => {
  const purgeSql = collectMigrationSql(AUDIT_MIGRATIONS[1]);

  it("deletes only rows older than the owning organization's retention window", () => {
    expect(purgeSql).toMatch(/DELETE FROM audit_events ae\s+USING organizations o\s+WHERE o\.id = ae\.organization_id/);
    expect(purgeSql).toMatch(
      /ae\.created_at < NOW\(\) - \(o\.audit_log_retention_months \|\| ' months'\)::INTERVAL/
    );
  });

  it("is the only DELETE in the audit log migrations", () => {
    const allSql = AUDIT_MIGRATIONS.map(collectMigrationSql).join("\n");
    expect(allSql.match(/DELETE\s+FROM\s+audit_events/gi)).toHaveLength(1);
  });

  it("opens the append-only trigger only for the duration of its own transaction", () => {
    expect(purgeSql).toMatch(/set_config\('worklenz\.audit_purge_in_progress', 'on', true\)/);
    expect(purgeSql).toMatch(/SECURITY DEFINER/);
  });
});

/**
 * Real-Postgres check of the purge behaviour. Opt-in (AUDIT_LOG_DB_TESTS=true) because it
 * needs the DB_* connection from .env. Applies the audit migrations inside a transaction,
 * exercises them against existing organizations/teams, and always rolls back.
 */
const describeWithDb = process.env.AUDIT_LOG_DB_TESTS === "true" ? describe : describe.skip;

describeWithDb("audit log retention against Postgres", () => {
  let client: Client;
  let orgA: { org_id: string; team_id: string; user_id: string };
  let orgB: { org_id: string; team_id: string; user_id: string };

  const insertEvent = (org: typeof orgA, label: string, age: string, teamId = org.team_id) =>
    client.query(
      `INSERT INTO audit_events (organization_id, team_id, actor_user_id, actor_name, category, event_type, description, created_at)
       VALUES ($1, $2, $3, 'retention-test', 'access', 'login_success', $4, NOW() - $5::INTERVAL)`,
      [org.org_id, teamId, org.user_id, label, age]
    );

  const expectBlocked = async (sql: string, params: unknown[] = []) => {
    await client.query("SAVEPOINT blocked_check");
    await expect(client.query(sql, params)).rejects.toThrow(/append-only/);
    await client.query("ROLLBACK TO SAVEPOINT blocked_check");
  };

  beforeAll(async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require("dotenv").config();
    client = new Client({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
    });
    await client.connect();
    await client.query("BEGIN");

    const alreadyApplied = await client.query("SELECT to_regclass('public.audit_events') IS NOT NULL AS applied");
    const fkSetNullMigration = AUDIT_MIGRATIONS[AUDIT_MIGRATIONS.length - 1];
    if (!alreadyApplied.rows[0].applied) {
      for (const fileName of AUDIT_MIGRATIONS.slice(0, -1)) {
        await client.query(collectMigrationSql(fileName));
      }
    }
    // CREATE OR REPLACE, so it also brings a database that predates it up to date.
    await client.query(collectMigrationSql(fkSetNullMigration));

    const orgs = await client.query(
      `SELECT o.id AS org_id, t.id AS team_id, t.user_id
       FROM organizations o
       JOIN teams t ON t.user_id = o.user_id
       ORDER BY o.created_at
       LIMIT 2`
    );
    if (orgs.rows.length < 2) throw new Error("Need at least two organizations with teams in the database");
    [orgA, orgB] = orgs.rows;

    await client.query("UPDATE organizations SET audit_log_retention_months = 3 WHERE id = $1", [orgA.org_id]);
    await client.query("UPDATE organizations SET audit_log_retention_months = 24 WHERE id = $1", [orgB.org_id]);
    await client.query("SAVEPOINT seeded");
  });

  afterAll(async () => {
    await client?.query("ROLLBACK");
    await client?.end();
  });

  afterEach(async () => {
    await client.query("ROLLBACK TO SAVEPOINT seeded");
  });

  it("removes only entries older than each organization's own retention window", async () => {
    await insertEvent(orgA, "A-4mo", "4 months");
    await insertEvent(orgA, "A-1mo", "1 month");
    await insertEvent(orgB, "B-4mo", "4 months");
    await insertEvent(orgB, "B-25mo", "25 months");

    await client.query("SELECT purge_expired_audit_events()");

    const survivors = await client.query(
      "SELECT description FROM audit_events WHERE actor_name = 'retention-test' ORDER BY description"
    );
    expect(survivors.rows.map((r) => r.description)).toEqual(["A-1mo", "B-4mo"]);
  });

  it("blocks direct deletes and edits outside the purge", async () => {
    await insertEvent(orgA, "A-1mo", "1 month");

    await expectBlocked("DELETE FROM audit_events WHERE description = 'A-1mo'");
    await expectBlocked("UPDATE audit_events SET description = 'tampered' WHERE description = 'A-1mo'");
    await expectBlocked("UPDATE audit_events SET actor_user_id = $1 WHERE description = 'A-1mo'", [orgB.user_id]);
  });

  it("keeps entries (with team_id nulled) when their team is deleted", async () => {
    const team = await client.query(
      "INSERT INTO teams (name, user_id) VALUES ('retention-test-team', $1) RETURNING id",
      [orgB.user_id]
    );
    await insertEvent(orgB, "B-team", "1 day", team.rows[0].id);

    await client.query("DELETE FROM teams WHERE id = $1", [team.rows[0].id]);

    const row = await client.query("SELECT team_id FROM audit_events WHERE description = 'B-team'");
    expect(row.rows).toEqual([{ team_id: null }]);
  });
});
