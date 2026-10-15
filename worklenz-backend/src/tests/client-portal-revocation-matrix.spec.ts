/**
 * The invariant the design promises: every access change takes effect on the person's NEXT request.
 *
 * This test mounts the REAL client portal routers (legacy and v2) behind the real `authenticateClient` and
 * `requireClientSubject`, and calls every protected route with a still-valid token after access was taken
 * away in four ways. The routes are read from the router source files, so a route added later is covered
 * automatically instead of silently skipped.
 *
 *   removed       the company user was deleted (the login row still exists and is "active")
 *   deactivated   the company user was disabled
 *   unassigned    the user is Active but no longer assigned to the project (or the project's portal is off)
 *   plus /auth/refresh for the first two: a removed user must not be able to mint a new token.
 */
import fs from "fs";
import http from "http";
import path from "path";
import express from "express";

const mockQuery = jest.fn();

jest.mock("../config/db", () => ({
  __esModule: true,
  default: { query: (...args: unknown[]) => mockQuery(...args), pool: { connect: jest.fn() } },
}));
jest.mock("../shared/email", () => ({ __esModule: true, sendEmail: jest.fn(), sendEmailEnhanced: jest.fn(), EmailRequest: jest.fn() }));
jest.mock("../cron_jobs/helpers", () => ({ __esModule: true, getClientPortalBaseUrl: () => "https://portal.test" }));
jest.mock("../shared/storage", () => ({
  __esModule: true,
  createPresignedUploadUrl: jest.fn(async () => "https://storage.test/put"),
  createPresignedUrlWithClient: jest.fn(async () => "https://storage.test/get"),
  getProjectFileStorageKey: (t: string, p: string, f: string, e: string) => `${t}/${p}/${f}.${e}`,
  getObjectSize: jest.fn(),
  deleteObject: jest.fn(),
  getKey: jest.fn(),
  objectExists: jest.fn(),
  uploadBase64: jest.fn(),
  getRootDir: jest.fn(),
}));
jest.mock("../services/token-service", () => ({
  __esModule: true,
  default: {
    verifyClientToken: jest.fn(),
    getClientPermissions: jest.fn(async () => []),
    hasOrganizationAccess: jest.fn(async () => true),
    generateClientToken: jest.fn(() => "new.jwt"),
    getClientUserOrganizations: jest.fn(async () => []),
    toTokenOrganizations: jest.fn((organizations: unknown[]) => organizations),
    getInvitationByToken: jest.fn(),
  },
}));

import db from "../config/db";
import clientPortalApiRouter from "../routes/apis/client-portal-api-router";
import TokenService from "../services/token-service";
import { createQueryResult } from "./utils/db-mock";

const tokens = TokenService as unknown as Record<string, jest.Mock>;

const PAYLOAD = {
  clientId: "client-1",
  organizationId: "team-1",
  clientUserId: "login-1",
  email: "alex@brandbase.com",
  permissions: [],
  availableOrganizations: [],
};

// ─── The routes under test, read from the real router files ─────────────────

interface RouteDef {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
}

const UUID = "11111111-1111-4111-8111-111111111111";
const routerDir = path.join(__dirname, "..", "routes", "apis");

const routesIn = (source: string, prefix: string): RouteDef[] => {
  const found: RouteDef[] = [];
  for (const match of source.matchAll(/router\.(get|post|put|patch|delete)\(\s*"([^"]+)"/g)) {
    found.push({ method: match[1].toUpperCase() as RouteDef["method"], path: prefix + match[2].replace(/:[A-Za-z]+/g, UUID) });
  }
  return found;
};

const legacySource = fs.readFileSync(path.join(routerDir, "client-portal-api-router.ts"), "utf8");
const AUTH_LINE = "router.use(authenticateClient);";
const [publicPart, protectedPart] = legacySource.split(AUTH_LINE);

const PUBLIC_ROUTES = routesIn(publicPart, "");
const LEGACY_PROTECTED = routesIn(protectedPart, "");
const V2_PROTECTED = routesIn(fs.readFileSync(path.join(routerDir, "client-portal-v2-client-router.ts"), "utf8"), "/v2");
const PROTECTED: RouteDef[] = [...LEGACY_PROTECTED, ...V2_PROTECTED];

// ─── A server around the real router, and a database that follows the scenario ──

type Scenario = "active" | "removed" | "deactivated" | "unassigned";
let scenario: Scenario = "active";

const WRITES = /^\s*(INSERT|UPDATE|DELETE)\b/i;

const answer = async (sql: string) => {
  const text = String(sql);
  if (/FROM clients c\s+LEFT JOIN client_portal_access/.test(text)) {
    return createQueryResult([{ client_status: "active", portal_access_active: true }]);
  }
  // The login row survives removal and stays "active": that is exactly the gap this test guards.
  if (/FROM client_users cu\s+WHERE cu\.id = \$1/.test(text)) {
    return createQueryResult([{ login_status: "active", is_disabled: scenario === "deactivated" }]);
  }
  if (/FROM client_contacts cc\s+JOIN client_users cu/.test(text)) {
    const gone = scenario === "removed" || scenario === "deactivated";
    return createQueryResult(
      gone
        ? []
        : [{ contact_id: "cc-1", client_id: "client-1", team_id: "team-1", role: "admin", name: "Alex", email: "alex@brandbase.com", client_user_id: "login-1" }]
    );
  }
  // SUBJECT_PROJECTS_SQL: the projects this person can open (assignment AND portal switch on).
  if (/FROM projects p\s+JOIN project_client_settings/.test(text)) {
    return createQueryResult(scenario === "active" ? [{ id: UUID }] : []);
  }
  return createQueryResult([]);
};

let server: http.Server;
let baseUrl = "";

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/client-portal", clientPortalApiRouter);
  await new Promise<void>(resolve => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/client-portal`;
});

afterAll(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
});

beforeEach(() => {
  scenario = "active";
  mockQuery.mockReset();
  mockQuery.mockImplementation(answer);
  // Transactions run on a pooled connection that follows the same scenario.
  ((db as any).pool.connect as jest.Mock).mockReset();
  ((db as any).pool.connect as jest.Mock).mockResolvedValue({ query: (...args: unknown[]) => mockQuery(...args), release: jest.fn() });
  tokens.verifyClientToken.mockReset();
  tokens.verifyClientToken.mockReturnValue(PAYLOAD);
  tokens.hasOrganizationAccess.mockReset();
  tokens.hasOrganizationAccess.mockResolvedValue(true);
  tokens.generateClientToken.mockClear();
  jest.spyOn(console, "error").mockImplementation(() => undefined);
});

const call = async (route: RouteDef) => {
  const response = await fetch(baseUrl + route.path, {
    method: route.method,
    headers: { "content-type": "application/json", "x-client-token": "still.valid.token" },
    body: route.method === "GET" || route.method === "DELETE" ? undefined : JSON.stringify({}),
  });
  let body: any = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { status: response.status, body };
};

const writesRun = () => mockQuery.mock.calls.map(([sql]) => String(sql)).filter(sql => WRITES.test(sql));

// ─── The test ────────────────────────────────────────────────────────────────

describe("the route list is read from the real routers", () => {
  it("covers the legacy and v2 client routes, and treats only sign-in style routes as public", () => {
    expect(LEGACY_PROTECTED.length).toBeGreaterThan(30);
    expect(V2_PROTECTED.length).toBeGreaterThan(40);
    expect(PUBLIC_ROUTES.map(r => `${r.method} ${r.path}`)).toEqual(
      expect.arrayContaining(["POST /auth/otp/request", "POST /auth/otp/verify", "POST /auth/refresh", "GET /invitation/validate"])
    );
  });
});

describe.each<[Scenario, string]>([
  ["removed", "the company user was removed (the login is still active)"],
  ["deactivated", "the company user was deactivated"],
])("after %s: %s", (name) => {
  beforeEach(() => {
    scenario = name;
    // Worst case for both: the login's link to the portal is still there and the login is still active, so
    // only the per-request contact check can stop the request.
    tokens.hasOrganizationAccess.mockResolvedValue(true);
  });

  it.each(PROTECTED.map(route => [`${route.method} ${route.path}`, route] as const))("%s is refused", async (_label, route) => {
    const { status, body } = await call(route);
    expect([401, 403]).toContain(status);
    if (status === 403) expect(body?.body).toMatchObject({ code: "ACCESS_REVOKED" });
    expect(writesRun()).toEqual([]);
  });

  it("cannot mint a new token with /auth/refresh", async () => {
    const { status } = await call({ method: "POST", path: "/auth/refresh" });
    // refresh takes the token from the body
    const response = await fetch(`${baseUrl}/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: "still.valid.token" }),
    });
    expect(status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBe(401);
    expect(tokens.generateClientToken).not.toHaveBeenCalled();
  });
});

describe("after the user was unassigned from the project, or the project's portal was switched off", () => {
  beforeEach(() => {
    scenario = "unassigned";
  });

  // Routes addressed by a project or an item inside one. The person is still an Active user, so the request
  // is authenticated, but the project gate must refuse it: a 4xx, never data, and never a write.
  const ITEM_ROUTES = V2_PROTECTED.filter(route =>
    /\/(projects|files|approvals|change-requests|threads|notifications)\/11111111-/.test(route.path)
  ).filter(route => !/\/notifications\/|\/threads\/.*\/read$|\/files\/11111111-[^/]*\/access$/.test(route.path));

  it("selects item routes to check", () => {
    expect(ITEM_ROUTES.length).toBeGreaterThan(12);
  });

  it.each(ITEM_ROUTES.map(route => [`${route.method} ${route.path}`, route] as const))("%s is refused", async (_label, route) => {
    const { status } = await call(route);
    expect(status).toBeGreaterThanOrEqual(400);
    expect(status).toBeLessThan(500);
    expect(writesRun()).toEqual([]);
  });

  it("serves a file link for nothing: the access check finds no shared file in a project they cannot open", async () => {
    const { status } = await call({ method: "GET", path: `/v2/files/${UUID}/access?action=download` });
    expect(status).toBe(404);
  });

  it("returns empty lists, not other people's data, from the list routes", async () => {
    for (const listPath of ["/v2/projects", "/v2/approvals", "/v2/change-requests", "/v2/threads"]) {
      const { status, body } = await call({ method: "GET", path: listPath });
      expect(status).toBe(200);
      const payload = body?.body;
      expect(Array.isArray(payload) ? payload : payload?.items ?? []).toEqual([]);
    }
  });
});

describe("while access is intact, the same harness lets a request through", () => {
  it("does not refuse an Active, assigned user (guards against a test that refuses everything)", async () => {
    const { status } = await call({ method: "GET", path: "/v2/me" });
    expect([401, 403]).not.toContain(status);
  });
});
