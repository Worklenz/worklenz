/**
 * Audit Log QA / acceptance (Audit log spec, task 8) against a real Postgres database.
 *
 * Opt-in (AUDIT_LOG_DB_TESTS=true) because it needs the DB_* connection from .env. Every query
 * the application code issues is routed through one connection inside a single transaction
 * that is always rolled back, so the real SQL functions, triggers and grants are exercised
 * without leaving fixtures, projects or audit rows behind. Application-level BEGIN/COMMIT/
 * ROLLBACK are mapped onto a savepoint, so no code path can commit into the database.
 *
 * Note: CURRENT_TIMESTAMP is the transaction start time, so inside this suite every new row
 * shares one created_at. The timestamp checks therefore assert the database stamped the row
 * itself (not the caller); real per-request timestamps come from production's one-statement
 * transactions.
 */
import http from "http";
import path from "path";
import { AddressInfo } from "net";
import bcrypt from "bcrypt";
import express, { NextFunction, Request, Response } from "express";
import { Client, QueryResult } from "pg";

import db from "../config/db";
import * as utils from "../shared/utils";
import * as auditLogService from "../services/audit-log.service";
import localLoginStrategy from "../passport/passport-strategies/passport-local-login";
import TeamMembersController from "../controllers/team-members-controller";
import ProjectsController from "../controllers/projects-controller";
import ProjectMembersController from "../controllers/project-members-controller";
import AdminCenterController from "../controllers/admin-center-controller";
import AuditLogController from "../controllers/audit-log-controller";
import AuditLogExportController from "../controllers/audit-log-export-controller";
import AuditLogRetentionController from "../controllers/audit-log-retention-controller";
import ActivitylogsController from "../controllers/activity-logs-controller";
import adminCenterApiRouter from "../routes/apis/admin-center-api-router";
import { insertToActivityLogs } from "../services/activity-logs/activity-logs.service";
import { IActivityLogAttributeTypes, IActivityLogChangeType } from "../services/activity-logs/interfaces";
import * as AuditLogExportService from "../services/audit-log-export/audit-log-export.service";
import { runAuditLogRetentionPurge } from "../cron_jobs/audit-log-retention-job";
import { IPassportSession } from "../interfaces/passport-session";
import { createMockRequest, createMockResponse } from "./utils/express-mock";

const mockTx: { client: Client | null; chain: Promise<unknown> } = {
  client: null,
  chain: Promise.resolve(),
};
const mockUploads: Array<{ key: string; body: Buffer }> = [];

jest.mock("../config/db", () => {
  const TX_CONTROL: Record<string, string> = {
    BEGIN: "SAVEPOINT app_tx",
    "START TRANSACTION": "SAVEPOINT app_tx",
    COMMIT: "RELEASE SAVEPOINT app_tx",
    END: "RELEASE SAVEPOINT app_tx",
    ROLLBACK: "ROLLBACK TO SAVEPOINT app_tx",
  };

  // One query at a time, each inside its own savepoint: a failing statement (e.g. a background
  // write) must not abort the surrounding test transaction.
  const run = (text: string, params?: unknown[]): Promise<QueryResult> => {
    const next = mockTx.chain.then(async () => {
      const client = mockTx.client;
      if (!client) throw new Error("audit-log acceptance: transaction client is not connected");

      const control = TX_CONTROL[text.trim().replace(/;$/, "").toUpperCase()];
      if (control) return client.query(control);

      await client.query("SAVEPOINT app_query");
      try {
        const result = await client.query(text, params);
        await client.query("RELEASE SAVEPOINT app_query");
        return result;
      } catch (error) {
        await client.query("ROLLBACK TO SAVEPOINT app_query");
        await client.query("RELEASE SAVEPOINT app_query");
        throw error;
      }
    });
    mockTx.chain = next.catch(() => undefined);
    return next;
  };

  const connect = async () => ({ query: run, release: () => undefined });
  return {
    __esModule: true,
    default: { query: run, connect, pool: { query: run, connect, on: () => undefined } },
  };
});

jest.mock("../services/notifications/notifications.service", () => ({
  NotificationsService: new Proxy({}, { get: () => () => Promise.resolve() }),
}));
jest.mock("../shared/email-templates", () =>
  new Proxy({}, { get: (_target, key) => (key === "__esModule" ? true : () => Promise.resolve()) })
);
jest.mock("../shared/paddle-utils", () => ({
  ...jest.requireActual("../shared/paddle-utils"),
  checkTeamSubscriptionStatus: async () => ({ subscription_status: "active" }),
}));
jest.mock("../shared/storage", () => ({
  ...jest.requireActual("../shared/storage"),
  uploadBuffer: async (body: Buffer, _contentType: string, key: string) => {
    mockUploads.push({ key, body });
    return true;
  },
  createPresignedUrlWithClient: async () => "https://storage.example.test/audit-log-export.csv",
}));
// Small caps so the sync/async split and the "newest rows kept" truncation can be exercised
// with a handful of rows instead of 20,000 / 500,000.
jest.mock("../services/audit-log-export/types", () => ({
  ...jest.requireActual("../services/audit-log-export/types"),
  AUDIT_LOG_EXPORT_SYNC_ROW_CAP: 10,
  AUDIT_LOG_EXPORT_MAX_ROWS: 5,
}));

interface MigrationModule {
  up: (pgm: { sql: (statement: string) => void }) => void;
}

interface AuditRow {
  id: string;
  created_at: Date;
  organization_id: string;
  team_id: string | null;
  actor_user_id: string | null;
  actor_name: string;
  category: string;
  event_type: string;
  description: string;
  old_value: string | null;
  new_value: string | null;
}

interface FixtureUser {
  userId: string;
  teamMemberId: string;
  name: string;
  email: string;
  session: IPassportSession;
}

type Handler = (req: any, res: any) => Promise<unknown>;

const MIGRATIONS_DIR = path.resolve(__dirname, "../../database/pg-migrations");
const SCHEMA_MIGRATIONS = [
  "1791193625587_create-audit-events-table.js",
  "1791193625588_add-audit-log-retention-to-organizations.js",
  "1791259941477_create-audit-log-export-jobs.js",
];
const FK_SET_NULL_MIGRATION = "1791267995553_allow-audit-events-fk-set-null.js";
const LOGIN_PASSWORD = "Audit-Acceptance-1!";

const collectMigrationSql = (fileName: string): string => {
  const statements: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const migration = require(path.join(MIGRATIONS_DIR, fileName)) as MigrationModule;
  migration.up({ sql: (statement) => statements.push(statement) });
  return statements.join("\n");
};

/** Lets fire-and-forget audit writes (queueMicrotask / void async) reach the database. */
const settle = async () => {
  for (let i = 0; i < 10; i++) {
    await new Promise((resolve) => setImmediate(resolve));
    await mockTx.chain;
  }
};

const call = async (handler: Handler, options: Parameters<typeof createMockRequest>[0]) => {
  const res = createMockResponse();
  await handler(createMockRequest(options), res);
  await settle();
  return res;
};

const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

const describeWithDb = process.env.AUDIT_LOG_DB_TESTS === "true" ? describe : describe.skip;

describeWithDb("audit log acceptance against Postgres (task 8)", () => {
  let fixture: { orgId: string; ownerId: string; teamId: string; otherOrgId: string };
  let owner: IPassportSession;
  let admin: FixtureUser;
  let teamLead: FixtureUser;
  let member: FixtureUser;
  let loginUser: FixtureUser;
  let baselineIds: string[] = [];
  let logErrorSpy: jest.SpyInstance;

  const query = (text: string, params?: unknown[]) => db.query(text, params);

  const loadSession = async (userId: string): Promise<IPassportSession> => {
    const result = await query("SELECT deserialize_user($1) AS session", [userId]);
    return result.rows[0].session as IPassportSession;
  };

  const createUser = async (roleName: string, label: string, password?: string): Promise<FixtureUser> => {
    const suffix = Math.random().toString(36).slice(2, 10);
    const email = `qa-audit-${label}-${suffix}@acceptance.test`;
    const name = `QA ${label} ${suffix}`;
    const user = await query(
      `INSERT INTO users (name, email, password, timezone_id, active_team)
       VALUES ($1, $2, $3, (SELECT id FROM timezones WHERE name = 'Asia/Colombo'), $4)
       RETURNING id`,
      [name, email, password ? bcrypt.hashSync(password, 4) : null, fixture.teamId]
    );
    const teamMember = await query(
      `INSERT INTO team_members (user_id, team_id, role_id, active)
       VALUES ($1, $2, (SELECT id FROM roles WHERE team_id = $2 AND name = $3 ORDER BY admin_role DESC LIMIT 1), TRUE)
       RETURNING id`,
      [user.rows[0].id, fixture.teamId, roleName]
    );
    return {
      userId: user.rows[0].id,
      teamMemberId: teamMember.rows[0].id,
      name,
      email,
      session: await loadSession(user.rows[0].id),
    };
  };

  /** Audit rows written for the fixture org since the current test started. */
  const newEvents = async (eventType?: string): Promise<AuditRow[]> => {
    const result = await query(
      `SELECT * FROM audit_events
       WHERE organization_id = $1
         AND NOT (id = ANY($2::UUID[]))
         AND ($3::TEXT IS NULL OR event_type = $3)
       ORDER BY ctid`,
      [fixture.orgId, baselineIds, eventType ?? null]
    );
    return result.rows as AuditRow[];
  };

  const transactionTimestamp = async (): Promise<string> =>
    (await query("SELECT transaction_timestamp() AS ts")).rows[0].ts.toISOString();

  const insertEvent = (
    orgId: string,
    overrides: Partial<Record<"category" | "event_type" | "description" | "actor_user_id" | "actor_name", string | null>> & {
      createdAt?: string;
      age?: string;
    } = {}
  ) =>
    query(
      `INSERT INTO audit_events (organization_id, actor_user_id, actor_name, category, event_type, description, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::TIMESTAMPTZ, NOW() - COALESCE($8, '0 seconds')::INTERVAL))
       RETURNING id`,
      [
        orgId,
        overrides.actor_user_id ?? null,
        overrides.actor_name ?? "QA seed",
        overrides.category ?? "access",
        overrides.event_type ?? "login_success",
        overrides.description ?? "seeded",
        overrides.createdAt ?? null,
        overrides.age ?? null,
      ]
    );

  const createProject = async (name: string) => {
    const status = await query("SELECT id FROM sys_project_statuses ORDER BY is_default DESC, sort_order LIMIT 1");
    const res = await call(ProjectsController.create as Handler, {
      user: owner,
      body: { name, color_code: "#70a6f3", notes: null, status_id: status.rows[0].id },
    });
    expect(res.body).toMatchObject({ done: true });
    return res.body.body as { id: string; name: string };
  };

  beforeAll(async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require("dotenv").config();
    const client = new Client({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
    });
    await client.connect();
    await client.query("BEGIN");
    mockTx.client = client;

    const hasSchema = await query("SELECT to_regclass('public.audit_log_export_jobs') IS NOT NULL AS applied");
    if (!hasSchema.rows[0].applied) {
      for (const fileName of SCHEMA_MIGRATIONS) await query(collectMigrationSql(fileName));
    }
    // Idempotent (CREATE OR REPLACE) - brings a database that predates it up to date.
    await query(collectMigrationSql(FK_SET_NULL_MIGRATION));

    const orgs = await query(
      `SELECT o.id AS org_id, o.user_id AS owner_id, t.id AS team_id
       FROM organizations o
       JOIN users u ON u.id = o.user_id
       JOIN teams t ON t.id = u.active_team AND t.user_id = o.user_id
       WHERE EXISTS (SELECT 1 FROM task_activity_logs tal WHERE tal.team_id = t.id)
       ORDER BY o.created_at
       LIMIT 1`
    );
    if (!orgs.rows.length) throw new Error("Need an organization whose owner's team has task activity logs");
    const otherOrg = await query("SELECT id FROM organizations WHERE id <> $1 ORDER BY created_at LIMIT 1", [
      orgs.rows[0].org_id,
    ]);
    fixture = {
      orgId: orgs.rows[0].org_id,
      ownerId: orgs.rows[0].owner_id,
      teamId: orgs.rows[0].team_id,
      otherOrgId: otherOrg.rows[0].id,
    };

    await query(
      `INSERT INTO roles (name, team_id, admin_role, default_role, owner)
       SELECT 'Team Lead', $1, TRUE, FALSE, FALSE
       WHERE NOT EXISTS (SELECT 1 FROM roles WHERE team_id = $1 AND name = 'Team Lead')`,
      [fixture.teamId]
    );
    // Some older workspaces have no team_members row for their owner; project creation needs one.
    await query(
      `INSERT INTO team_members (user_id, team_id, role_id, active)
       SELECT $1, $2, (SELECT id FROM roles WHERE team_id = $2 AND owner IS TRUE LIMIT 1), TRUE
       WHERE NOT EXISTS (SELECT 1 FROM team_members WHERE user_id = $1 AND team_id = $2)`,
      [fixture.ownerId, fixture.teamId]
    );
    await query("UPDATE organizations SET audit_log_retention_months = 12 WHERE id IN ($1, $2)", [
      fixture.orgId,
      fixture.otherOrgId,
    ]);

    owner = await loadSession(fixture.ownerId);
    admin = await createUser("Admin", "admin");
    teamLead = await createUser("Team Lead", "teamlead");
    member = await createUser("Member", "member");
    loginUser = await createUser("Member", "login", LOGIN_PASSWORD);

    await mockTx.client.query("SAVEPOINT seeded");
  });

  afterAll(async () => {
    await mockTx.chain;
    await mockTx.client?.query("ROLLBACK");
    await mockTx.client?.end();
    mockTx.client = null;
  });

  beforeEach(async () => {
    const existing = await query("SELECT COALESCE(array_agg(id), '{}') AS ids FROM audit_events WHERE organization_id = $1", [
      fixture.orgId,
    ]);
    baselineIds = existing.rows[0].ids;
    logErrorSpy = jest.spyOn(utils, "log_error");
  });

  afterEach(async () => {
    await settle();
    const auditWriteFailures = logErrorSpy.mock.calls.filter(
      ([, context]) => (context as { scope?: string } | undefined)?.scope === "logAuditEvent"
    );
    expect(auditWriteFailures).toEqual([]);
    await mockTx.client?.query("ROLLBACK TO SAVEPOINT seeded");
  });

  describe("8.1 each category records the right actor, timestamp and old/new value", () => {
    const expectStampedNow = async (row: AuditRow) => {
      expect(row.created_at.toISOString()).toBe(await transactionTimestamp());
    };

    const loginAttempt = (email: string, password: string) =>
      new Promise<unknown>((resolve) => {
        const req = { session: {}, flash: () => undefined, body: {} };
        (localLoginStrategy as unknown as { _verify: (...args: unknown[]) => void })._verify(
          req,
          email,
          password,
          (_error: unknown, user: unknown) => resolve(user)
        );
      });

    it("Access & Authentication: failed and successful logins", async () => {
      expect(await loginAttempt(loginUser.email, "wrong-password")).toBe(false);
      expect(await loginAttempt(loginUser.email, LOGIN_PASSWORD)).toMatchObject({ id: loginUser.userId });
      await settle();

      const [failed] = await newEvents("login_failed");
      expect(failed).toMatchObject({
        category: "access",
        actor_user_id: loginUser.userId,
        actor_name: loginUser.name,
        team_id: fixture.teamId,
        description: "Incorrect email or password",
        old_value: null,
        new_value: null,
      });
      await expectStampedNow(failed);

      const succeeded = await newEvents("login_success");
      expect(succeeded).toHaveLength(1);
      expect(succeeded[0]).toMatchObject({ category: "access", actor_user_id: loginUser.userId });
    });

    it("User & Role Management: invite, role change (old → new) and removal", async () => {
      const inviteEmail = `qa-audit-invitee-${Date.now()}@acceptance.test`;
      await TeamMembersController.createOrInviteMembers(
        { team_id: fixture.teamId, emails: [inviteEmail], role_name: "Member", is_admin: false },
        owner
      );
      await settle();
      const [invited] = await newEvents("member_invited");
      expect(invited).toMatchObject({ category: "user", actor_user_id: owner.id, actor_name: owner.name });
      expect(invited.description).toContain(inviteEmail.split("@")[0]);
      await expectStampedNow(invited);

      const roleRes = await call(TeamMembersController.update as Handler, {
        user: owner,
        params: { id: member.teamMemberId },
        body: { role_name: "Admin", is_admin: true },
      });
      expect(roleRes.body?.done).toBe(true);
      const [roleChanged] = await newEvents("role_changed");
      expect(roleChanged).toMatchObject({
        category: "user",
        actor_user_id: owner.id,
        old_value: "Member",
        new_value: "Admin",
      });
      expect(roleChanged.description).toContain(member.name);

      const removeRes = await call(TeamMembersController.deleteById as Handler, {
        user: owner,
        params: { id: member.teamMemberId },
      });
      expect(removeRes.body?.done).toBe(true);
      const [removed] = await newEvents("member_removed");
      expect(removed).toMatchObject({ category: "user", actor_user_id: owner.id });
      expect(removed.description).toContain(member.name);
    });

    it("Permission & Settings Changes: project privacy, workspace setting and retention", async () => {
      const project = await createProject(`QA privacy ${Date.now()}`);
      const projectRow = await query("SELECT key, color_code, status_id FROM projects WHERE id = $1", [project.id]);
      const privacyRes = await call(ProjectsController.update as Handler, {
        user: owner,
        params: { id: project.id },
        body: {
          name: project.name,
          key: projectRow.rows[0].key,
          color_code: projectRow.rows[0].color_code,
          status_id: projectRow.rows[0].status_id,
          restrict_tasks_to_assignee: true,
        },
      });
      expect(privacyRes.body?.done).toBe(true);
      const [privacy] = await newEvents("project_privacy_changed");
      expect(privacy).toMatchObject({ category: "permission", actor_user_id: owner.id, old_value: "false", new_value: "true" });

      const previousContact = (await query("SELECT contact_number FROM organizations WHERE id = $1", [fixture.orgId])).rows[0]
        .contact_number;
      await call(AdminCenterController.updateOwnerContactNumber as Handler, {
        user: owner,
        body: { contact_number: "0771234567" },
      });
      const [setting] = await newEvents("workspace_setting_changed");
      expect(setting).toMatchObject({
        category: "permission",
        actor_user_id: owner.id,
        old_value: previousContact,
        new_value: "0771234567",
      });

      await call(AuditLogRetentionController.update as Handler, { user: owner, body: { retention_months: 24 } });
      const [retention] = await newEvents("retention_window_changed");
      expect(retention).toMatchObject({ category: "permission", actor_user_id: owner.id, old_value: "12", new_value: "24" });
      await expectStampedNow(retention);
    });

    it("Project & Workspace Lifecycle: create, archive, restore, delete and rename", async () => {
      const project = await createProject(`QA lifecycle ${Date.now()}`);
      await call(ProjectsController.toggleArchive as Handler, { user: owner, params: { id: project.id } });
      await call(ProjectsController.toggleArchive as Handler, { user: owner, params: { id: project.id } });
      const deleteRes = await call(ProjectsController.deleteById as Handler, { user: owner, params: { id: project.id } });
      expect(deleteRes.body?.done).toBe(true);

      const lifecycle = (await newEvents()).filter((row) => row.category === "lifecycle");
      expect(lifecycle.map((row) => row.event_type)).toEqual([
        "project_created",
        "project_archived",
        "project_restored",
        "project_deleted",
      ]);
      lifecycle.forEach((row) => {
        expect(row.actor_user_id).toBe(owner.id);
        expect(row.description).toContain(project.name);
      });

      const sharedProject = await createProject(`QA archive all ${Date.now()}`);
      await call(ProjectsController.toggleArchiveAll as Handler, { user: owner, params: { id: sharedProject.id } });
      await call(ProjectsController.toggleArchiveAll as Handler, { user: owner, params: { id: sharedProject.id } });
      const archiveAll = (await newEvents()).filter((row) => row.description.includes(sharedProject.name));
      expect(archiveAll.map((row) => row.event_type)).toEqual(["project_created", "project_archived", "project_restored"]);
      archiveAll.forEach((row) => expect(row.actor_user_id).toBe(owner.id));

      const previousName = (await query("SELECT organization_name FROM organizations WHERE id = $1", [fixture.orgId])).rows[0]
        .organization_name;
      await call(AdminCenterController.updateOrganizationName as Handler, { user: owner, body: { name: "QA Renamed Workspace" } });
      const [renamed] = await newEvents("workspace_renamed");
      expect(renamed).toMatchObject({ old_value: previousName, new_value: "QA Renamed Workspace", actor_user_id: owner.id });
    });

    it("shows the new entries in the Audit Log API with the actor and summary counts", async () => {
      await call(AdminCenterController.updateOrganizationName as Handler, { user: owner, body: { name: "QA Listed Workspace" } });

      const list = await call(AuditLogController.getAuditEvents as Handler, { user: admin.session, query: { size: "5" } });
      expect(list.body.done).toBe(true);
      expect(list.body.body.data[0]).toMatchObject({
        event_type: "workspace_renamed",
        actor_name: owner.name,
        actor_user_id: owner.id,
        actor_in_workspace: true,
        new_value: "QA Listed Workspace",
      });

      const summary = await call(AuditLogController.getSummary as Handler, { user: admin.session, query: {} });
      const total = (await query("SELECT COUNT(*)::INT AS n FROM audit_events WHERE organization_id = $1", [fixture.orgId]))
        .rows[0].n;
      expect(summary.body.body.total).toBe(total);
    });

    it("flags actors removed from the workspace while keeping their recorded name", async () => {
      const inserted = await insertEvent(fixture.orgId, {
        actor_user_id: member.userId,
        actor_name: member.name,
        event_type: "login_success",
      });
      await query("DELETE FROM team_members WHERE id = $1", [member.teamMemberId]);

      const list = await call(AuditLogController.getAuditEvents as Handler, {
        user: admin.session,
        query: { size: "50", category: "access" },
      });
      const row = list.body.body.data.find((item: { id: string }) => item.id === inserted.rows[0].id);
      expect(row).toMatchObject({ actor_name: member.name, actor_user_id: member.userId, actor_in_workspace: false });
    });

    it("never flags the workspace owner as removed, even without a team membership row", async () => {
      const inserted = await insertEvent(fixture.orgId, { actor_user_id: owner.id, actor_name: owner.name });
      await query(
        `DELETE FROM team_members tm
         USING teams t, organizations o
         WHERE t.id = tm.team_id AND o.user_id = t.user_id AND o.id = $1 AND tm.user_id = $2`,
        [fixture.orgId, owner.id]
      );

      const list = await call(AuditLogController.getAuditEvents as Handler, {
        user: admin.session,
        query: { size: "50", category: "access" },
      });
      const row = list.body.body.data.find((item: { id: string }) => item.id === inserted.rows[0].id);
      expect(row).toMatchObject({ actor_user_id: owner.id, actor_in_workspace: true });
    });
  });

  describe("project settings and team member actions", () => {
    it("logs one Project setting changed entry per changed field, with readable old → new values", async () => {
      const project = await createProject(`QA settings ${Date.now()}`);
      const projectRow = await query("SELECT key, color_code, status_id FROM projects WHERE id = $1", [project.id]);
      const statuses = await query(
        `SELECT id, name FROM sys_project_statuses WHERE id <> $1 ORDER BY sort_order LIMIT 1`,
        [projectRow.rows[0].status_id]
      );
      const previousStatus = await query("SELECT name FROM sys_project_statuses WHERE id = $1", [projectRow.rows[0].status_id]);

      const res = await call(ProjectsController.update as Handler, {
        user: owner,
        params: { id: project.id },
        body: {
          name: project.name,
          key: projectRow.rows[0].key,
          color_code: projectRow.rows[0].color_code,
          status_id: statuses.rows[0].id,
          notes: "QA notes",
        },
      });
      expect(res.body?.done).toBe(true);

      const changes = await newEvents("project_setting_changed");
      const byDescription = Object.fromEntries(changes.map((row) => [row.description, row]));
      expect(byDescription[`Project "${project.name}": Status changed`]).toMatchObject({
        category: "permission",
        actor_user_id: owner.id,
        old_value: previousStatus.rows[0].name,
        new_value: statuses.rows[0].name,
      });
      expect(byDescription[`Project "${project.name}": Notes changed`]).toMatchObject({ old_value: null, new_value: "QA notes" });
      expect(Object.keys(byDescription)).not.toContain(`Project "${project.name}": Name changed`);

      const unchangedRes = await call(ProjectsController.update as Handler, {
        user: owner,
        params: { id: project.id },
        body: {
          name: project.name,
          key: projectRow.rows[0].key,
          color_code: projectRow.rows[0].color_code,
          status_id: statuses.rows[0].id,
          notes: "QA notes",
        },
      });
      expect(unchangedRes.body?.done).toBe(true);
      expect(await newEvents("project_setting_changed")).toHaveLength(changes.length);
    });

    it("logs member detail, activation and invitation-resend actions", async () => {
      const renameRes = await call(TeamMembersController.updateMemberName as Handler, {
        user: owner,
        params: { id: member.teamMemberId },
        body: { name: "QA Renamed Member" },
      });
      expect(renameRes.body?.done).toBe(true);
      const [renamed] = await newEvents("member_updated");
      expect(renamed).toMatchObject({
        category: "user",
        actor_user_id: owner.id,
        description: "QA Renamed Member: Name changed",
        old_value: member.name,
        new_value: "QA Renamed Member",
      });

      await call(TeamMembersController.toggleMemberActiveStatus as Handler, {
        user: owner,
        params: { id: member.teamMemberId },
        query: { active: "true", email: member.email },
      });
      const deactivated = await newEvents("member_deactivated");
      expect(deactivated).toHaveLength(1);
      expect(deactivated[0]).toMatchObject({ category: "user", actor_user_id: owner.id });
      expect(deactivated[0].description).toContain("QA Renamed Member");
    });

    it("logs project members being added and removed", async () => {
      const project = await createProject(`QA project members ${Date.now()}`);
      const addRes = await call(ProjectMembersController.create as Handler, {
        user: owner,
        body: { project_id: project.id, team_member_id: admin.teamMemberId },
      });
      expect(addRes.body?.done).toBe(true);
      const [added] = await newEvents("project_member_added");
      expect(added).toMatchObject({
        category: "user",
        actor_user_id: owner.id,
        description: `Added ${admin.name} to project "${project.name}"`,
      });

      const projectMember = await query("SELECT id FROM project_members WHERE project_id = $1 AND team_member_id = $2", [
        project.id,
        admin.teamMemberId,
      ]);
      const removeRes = await call(ProjectMembersController.deleteById as Handler, {
        user: owner,
        params: { id: projectMember.rows[0].id },
        query: { current_project_id: project.id },
      });
      expect(removeRes.body?.done).toBe(true);
      const [removed] = await newEvents("project_member_removed");
      expect(removed).toMatchObject({
        category: "user",
        actor_user_id: owner.id,
        description: `Removed ${admin.name} from project "${project.name}"`,
      });
    });
  });

  describe("8.2 Member and Team Lead cannot call the Audit Log API", () => {
    let server: http.Server;
    let baseUrl: string;

    const sessionsByRole = (): Record<string, IPassportSession> => ({
      owner,
      admin: admin.session,
      teamlead: teamLead.session,
      member: member.session,
    });

    const request = async (role: string, method: string, url: string, body?: unknown) => {
      const response = await fetch(`${baseUrl}/admin-center${url}`, {
        method,
        headers: { "content-type": "application/json", "x-qa-role": role },
        body: body ? JSON.stringify(body) : undefined,
      });
      await settle();
      return response.status;
    };

    beforeAll(async () => {
      const app = express();
      app.use(express.json());
      app.use((req: Request, _res: Response, next: NextFunction) => {
        (req as Request & { user?: IPassportSession }).user = sessionsByRole()[req.header("x-qa-role") || ""];
        next();
      });
      app.use("/admin-center", adminCenterApiRouter);
      server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
      baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    });

    afterAll(async () => {
      await new Promise((resolve) => server.close(resolve));
    });

    it("has a Team Lead whose role row is flagged admin_role, the case most likely to leak", async () => {
      expect(teamLead.session.role_name).toBe("Team Lead");
      const role = await query(
        "SELECT r.admin_role FROM team_members tm JOIN roles r ON r.id = tm.role_id WHERE tm.id = $1",
        [teamLead.teamMemberId]
      );
      expect(role.rows[0].admin_role).toBe(true);
    });

    const READ_ENDPOINTS: Array<[string, string]> = [
      ["GET", "/organization/audit-log"],
      ["GET", "/organization/audit-log/summary"],
      ["GET", "/organization/audit-log/retention"],
      ["GET", "/organization/audit-log/export/latest"],
      ["POST", "/organization/audit-log/export"],
    ];

    it.each(["member", "teamlead"])("returns 403 to a %s on every audit log endpoint", async (role) => {
      for (const [method, url] of READ_ENDPOINTS) {
        expect([method, url, await request(role, method, url)]).toEqual([method, url, 403]);
      }
      expect(await request(role, "PUT", "/organization/audit-log/retention", { retention_months: 3 })).toBe(403);
    });

    it("lets an Admin read and export but not change retention", async () => {
      for (const [method, url] of READ_ENDPOINTS) {
        expect([method, url, await request("admin", method, url)]).toEqual([method, url, 200]);
      }
      expect(await request("admin", "PUT", "/organization/audit-log/retention", { retention_months: 3 })).toBe(403);
    });

    it("lets the Owner change retention", async () => {
      expect(await request("owner", "PUT", "/organization/audit-log/retention", { retention_months: 24 })).toBe(200);
      expect(await request("owner", "GET", "/organization/audit-log")).toBe(200);
    });
  });

  describe("8.3 export reflects the current filters and keeps the newest rows at the cap", () => {
    const ownerInColombo = () => ({ ...owner, timezone_name: "Asia/Colombo" });

    const parseCsvRows = (buffer: Buffer): string[][] =>
      buffer
        .toString("utf8")
        .replace(/^\uFEFF/, "")
        .split("\n")
        .slice(1)
        .filter((line) => line.startsWith('"20'))
        .map((line) => line.slice(1, -1).split('","'));

    const exportCsv = async (session: IPassportSession, filters: Record<string, string>) => {
      const res = await call(AuditLogExportController.create as Handler, { user: session, query: filters });
      expect(res.statusCode).toBe(200);
      return res.body as Buffer;
    };

    it("exports exactly the rows the list shows for the same filters", async () => {
      const day = (time: string) => `2026-03-10T${time}+05:30`;
      await insertEvent(fixture.orgId, { category: "access", event_type: "login_failed", actor_user_id: admin.userId, actor_name: admin.name, description: "QA-A1", createdAt: day("09:00:00") });
      await insertEvent(fixture.orgId, { category: "access", event_type: "login_success", actor_user_id: admin.userId, actor_name: admin.name, description: "QA-A2", createdAt: day("10:00:00") });
      await insertEvent(fixture.orgId, { category: "access", event_type: "login_success", actor_user_id: teamLead.userId, actor_name: teamLead.name, description: "QA-A3", createdAt: day("11:00:00") });
      await insertEvent(fixture.orgId, { category: "lifecycle", event_type: "project_created", actor_user_id: admin.userId, actor_name: admin.name, description: "QA-L1", createdAt: day("12:00:00") });
      await insertEvent(fixture.orgId, { category: "access", event_type: "login_success", actor_user_id: admin.userId, actor_name: admin.name, description: "QA-A4", createdAt: "2026-03-12T10:00:00+05:30" });

      const filters = { start_date: "2026-03-10", end_date: "2026-03-10", category: "access", actor_user_id: admin.userId };
      const list = await call(AuditLogController.getAuditEvents as Handler, { user: ownerInColombo(), query: filters });
      const listed = list.body.body.data.map((row: AuditRow) => row.description);
      expect(listed).toEqual(["QA-A2", "QA-A1"]);

      const csvRows = parseCsvRows(await exportCsv(ownerInColombo(), filters));
      expect(csvRows.map((row) => row[4])).toEqual(listed);
      expect(csvRows.map((row) => row[3])).toEqual(["Login succeeded", "Login failed"]);

      const searched = parseCsvRows(
        await exportCsv(ownerInColombo(), { start_date: "2026-03-10", end_date: "2026-03-12", search: "failed" })
      );
      expect(searched.map((row) => row[4])).toEqual(["QA-A1"]);
    });

    it("uses the viewer's timezone for the date range (Reports pattern)", async () => {
      await insertEvent(fixture.orgId, { description: "QA-early-morning", createdAt: "2026-03-11T02:00:00+05:30" });
      const filters = { start_date: "2026-03-11", end_date: "2026-03-11" };

      const colombo = parseCsvRows(await exportCsv(ownerInColombo(), filters));
      expect(colombo.map((row) => row[4])).toContain("QA-early-morning");

      const utc = parseCsvRows(await exportCsv({ ...owner, timezone_name: "UTC" }, filters));
      expect(utc.map((row) => row[4])).not.toContain("QA-early-morning");
    });

    it("writes old → new values into the exported Details column", async () => {
      await call(AdminCenterController.updateOrganizationName as Handler, { user: owner, body: { name: "QA Export Workspace" } });
      const rows = parseCsvRows(await exportCsv(owner, { search: "QA Export Workspace" }));
      expect(rows[0][4]).toMatch(/→ QA Export Workspace\)$/);
    });

    it("keeps only the newest rows when the result is over the cap, newest first", async () => {
      for (let i = 1; i <= 8; i++) {
        await insertEvent(fixture.orgId, { description: `QA-cap-${i}`, createdAt: `2026-04-0${i}T10:00:00+05:30` });
      }
      const res = await call(AuditLogExportController.create as Handler, {
        user: ownerInColombo(),
        query: { start_date: "2026-04-01", end_date: "2026-04-08" },
      });
      const csv = (res.body as Buffer).toString("utf8");
      expect(parseCsvRows(res.body).map((row) => row[4])).toEqual(["QA-cap-8", "QA-cap-7", "QA-cap-6", "QA-cap-5", "QA-cap-4"]);
      expect(csv).toContain("Export limited to the first 5 events");
    });

    it("hands a large export to a background job that replays the same filters and cap", async () => {
      for (let i = 1; i <= 12; i++) {
        await insertEvent(fixture.orgId, { description: `QA-async-${i}`, createdAt: `2026-05-${String(i).padStart(2, "0")}T10:00:00+05:30` });
      }
      await insertEvent(fixture.orgId, { category: "lifecycle", event_type: "project_created", description: "QA-async-other-category", createdAt: "2026-05-20T10:00:00+05:30" });
      const filters = { start_date: "2026-05-01", end_date: "2026-05-31", category: "access" };

      const res = await call(AuditLogExportController.create as Handler, { user: ownerInColombo(), query: filters });
      expect(res.statusCode).toBe(202);
      const jobId = res.body.body.job.id as string;

      const second = await call(AuditLogExportController.create as Handler, { user: ownerInColombo(), query: filters });
      expect(second.statusCode).toBe(409);

      const job = await AuditLogExportService.getJob(jobId);
      expect(job?.filters).toMatchObject({ categories: ["access"], timezone: "Asia/Colombo" });
      mockUploads.length = 0;
      await AuditLogExportService.processJob(job!);
      expect(parseCsvRows(mockUploads[0].body).map((row) => row[4])).toEqual([
        "QA-async-12",
        "QA-async-11",
        "QA-async-10",
        "QA-async-9",
        "QA-async-8",
      ]);

      const download = await call(AuditLogExportController.download as Handler, { user: owner, params: { jobId } });
      expect(download.body.body.url).toBe("https://storage.example.test/audit-log-export.csv");
    });
  });

  describe("8.4 retention job with a shortened window", () => {
    it("purges only this workspace's entries older than the new 3-month window", async () => {
      const keep1 = await insertEvent(fixture.orgId, { description: "QA-1mo", age: "1 month" });
      const keep2 = await insertEvent(fixture.orgId, { description: "QA-2mo", age: "2 months 27 days" });
      const drop1 = await insertEvent(fixture.orgId, { description: "QA-4mo", age: "4 months" });
      const drop2 = await insertEvent(fixture.orgId, { description: "QA-11mo", age: "11 months" });
      const otherOrg = await insertEvent(fixture.otherOrgId, { description: "QA-other-4mo", age: "4 months" });

      const res = await call(AuditLogRetentionController.update as Handler, { user: owner, body: { retention_months: 3 } });
      expect(res.body.body.retention_months).toBe(3);

      const purged = await runAuditLogRetentionPurge();
      expect(purged).toBeGreaterThanOrEqual(2);

      const ids = [keep1, keep2, drop1, drop2, otherOrg].map((r) => r.rows[0].id);
      const survivors = await query("SELECT description FROM audit_events WHERE id = ANY($1::UUID[]) ORDER BY description", [ids]);
      expect(survivors.rows.map((r) => r.description)).toEqual(["QA-1mo", "QA-2mo", "QA-other-4mo"]);

      const [retentionChange] = await newEvents("retention_window_changed");
      expect(retentionChange).toMatchObject({ old_value: "12", new_value: "3" });
    });

    it("rejects a window outside 3-24 months and leaves the setting unchanged", async () => {
      const res = await call(AuditLogRetentionController.update as Handler, { user: owner, body: { retention_months: 1 } });
      expect(res.statusCode).toBe(400);
      const months = (await query("SELECT audit_log_retention_months AS m FROM organizations WHERE id = $1", [fixture.orgId])).rows[0].m;
      expect(months).toBe(12);
      expect(await newEvents("retention_window_changed")).toEqual([]);
    });

    it("gives the application role no way to delete or edit entries except the purge", async () => {
      await insertEvent(fixture.orgId, { description: "QA-role-check", age: "1 day" });
      const asAppRole = async (sql: string) => {
        await mockTx.client!.query("SAVEPOINT role_check");
        await mockTx.client!.query("SET LOCAL ROLE worklenz_client");
        try {
          await mockTx.client!.query(sql);
          return "allowed";
        } catch (error) {
          return (error as Error).message;
        } finally {
          await mockTx.client!.query("ROLLBACK TO SAVEPOINT role_check");
        }
      };

      expect(await asAppRole("DELETE FROM audit_events WHERE description = 'QA-role-check'")).toMatch(/permission denied/);
      expect(await asAppRole("UPDATE audit_events SET description = 'x' WHERE description = 'QA-role-check'")).toMatch(/permission denied/);
      expect(await asAppRole("SELECT purge_expired_audit_events()")).toBe("allowed");
    });
  });

  describe("8.5 the per-task Activity Log is unchanged", () => {
    let taskId: string;

    const taskActivityLog = async () => {
      const res = await call(ActivitylogsController.get as Handler, { user: owner, params: { id: taskId } });
      expect(res.body.done).toBe(true);
      return res.body.body as { logs: Array<Record<string, unknown>> };
    };

    beforeEach(async () => {
      const task = await query(
        `SELECT tal.task_id FROM task_activity_logs tal JOIN tasks t ON t.id = tal.task_id
         WHERE tal.team_id = $1 GROUP BY tal.task_id ORDER BY COUNT(*) DESC LIMIT 1`,
        [fixture.teamId]
      );
      taskId = task.rows[0].task_id;
    });

    it("audited admin actions add nothing to a task's Activity Log", async () => {
      const before = await taskActivityLog();
      const activityCountBefore = (await query("SELECT COUNT(*)::INT AS n FROM task_activity_logs WHERE team_id = $1", [fixture.teamId])).rows[0].n;

      await call(AdminCenterController.updateOrganizationName as Handler, { user: owner, body: { name: "QA Regression Workspace" } });
      await call(AuditLogRetentionController.update as Handler, { user: owner, body: { retention_months: 24 } });
      await call(TeamMembersController.update as Handler, {
        user: owner,
        params: { id: member.teamMemberId },
        body: { role_name: "Admin", is_admin: true },
      });

      expect((await newEvents()).length).toBe(3);
      expect(await taskActivityLog()).toEqual(before);
      const activityCountAfter = (await query("SELECT COUNT(*)::INT AS n FROM task_activity_logs WHERE team_id = $1", [fixture.teamId])).rows[0].n;
      expect(activityCountAfter).toBe(activityCountBefore);
    });

    it("task edits still land in the task's Activity Log and never in the Audit Log", async () => {
      const before = await taskActivityLog();

      await insertToActivityLogs({
        task_id: taskId,
        team_id: fixture.teamId,
        attribute_type: IActivityLogAttributeTypes.NAME,
        user_id: owner.id as string,
        log_type: IActivityLogChangeType.UPDATE,
        old_value: "QA old task name",
        new_value: "QA new task name",
      } as Parameters<typeof insertToActivityLogs>[0]);
      await settle();

      const after = await taskActivityLog();
      expect(after.logs.length).toBe(before.logs.length + 1);
      expect(await newEvents()).toEqual([]);
    });
  });

  describe("8.6 audited actions show no perceptible slowdown", () => {
    const timeInvite = async (label: string) => {
      const started = process.hrtime.bigint();
      await TeamMembersController.createOrInviteMembers(
        {
          team_id: fixture.teamId,
          emails: [`qa-audit-latency-${label}-${Math.random().toString(36).slice(2)}@acceptance.test`],
          role_name: "Member",
          is_admin: false,
        },
        owner
      );
      const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
      await settle();
      return elapsedMs;
    };

    it("returns from logAuditEvent synchronously, without waiting on the database", async () => {
      const started = process.hrtime.bigint();
      for (let i = 0; i < 100; i++) {
        auditLogService.logAuditEvent({
          organizationId: fixture.orgId,
          actor: { userId: owner.id as string, name: owner.name as string },
          eventType: "workspace_setting_changed",
          description: `QA latency ${i}`,
        });
      }
      const perCallMs = Number(process.hrtime.bigint() - started) / 1e6 / 100;
      await settle();

      expect(perCallMs).toBeLessThan(1);
      expect((await newEvents("workspace_setting_changed")).length).toBe(100);
    });

    it("an invite with audit logging is within a few milliseconds of one without", async () => {
      await timeInvite("warmup");
      const withAudit: number[] = [];
      const withoutAudit: number[] = [];
      for (let i = 0; i < 7; i++) withAudit.push(await timeInvite(`on-${i}`));

      const spy = jest.spyOn(auditLogService, "logAuditEvent").mockImplementation(() => undefined);
      for (let i = 0; i < 7; i++) withoutAudit.push(await timeInvite(`off-${i}`));
      spy.mockRestore();

      const overheadMs = median(withAudit) - median(withoutAudit);
      // eslint-disable-next-line no-console
      console.log(
        `audit-log latency: invite median ${median(withAudit).toFixed(1)} ms with audit, ` +
          `${median(withoutAudit).toFixed(1)} ms without (overhead ${overheadMs.toFixed(1)} ms)`
      );
      expect(overheadMs).toBeLessThan(25);
    });
  });
});
