const mockQuery = jest.fn();

jest.mock("../config/db", () => ({
  __esModule: true,
  default: { query: (...args: unknown[]) => mockQuery(...args), pool: { connect: jest.fn() } },
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
  },
}));

import { authenticateClient } from "../middlewares/client-auth-middleware";
import ClientPortalAuthController from "../controllers/client-portal/client-portal-auth-controller";
import TokenService from "../services/token-service";
import { createQueryResult } from "./utils/db-mock";

const tokens = TokenService as unknown as Record<string, jest.Mock>;

const PAYLOAD = { clientId: "client-1", organizationId: "team-1", clientUserId: "login-1", email: "alex@brandbase.com", permissions: [] };

/** The login is still `active` after a company user is removed: only the contact row is gone. */
const arrange = (contactStillActive: boolean) =>
  mockQuery.mockImplementation(async (sql: string) => {
    const text = String(sql);
    if (/FROM clients c\s+LEFT JOIN client_portal_access/.test(text)) {
      return createQueryResult([{ client_status: "active", portal_access_active: true }]);
    }
    if (/FROM client_contacts cc\s+JOIN client_users cu/.test(text)) {
      // loadClientSubject: no row once the contact was removed or deactivated.
      return createQueryResult(
        contactStillActive
          ? [{ contact_id: "cc-1", client_id: "client-1", team_id: "team-1", role: "member", name: "Alex", email: "alex@brandbase.com", client_user_id: "login-1" }]
          : []
      );
    }
    // getLoginAccessState: the login row is active and no disabled contact is found.
    return createQueryResult([{ exists: true, login_status: "active", is_disabled: false, id: "login-1", status: "active" }]);
  });

const response = () => {
  const res: any = { statusCode: 200, body: undefined };
  res.status = jest.fn((code: number) => { res.statusCode = code; return res; });
  res.json = jest.fn((body: unknown) => { res.body = body; return res; });
  return res;
};

beforeEach(() => {
  mockQuery.mockReset();
  tokens.verifyClientToken.mockReset();
  tokens.verifyClientToken.mockReturnValue(PAYLOAD);
});

describe("a removed client user with a still-valid token", () => {
  const callMiddleware = async () => {
    const req: any = { method: "GET", headers: { "x-client-token": "t" }, query: {} };
    const res = response();
    const next = jest.fn();
    await authenticateClient(req, res, next);
    return { res, next };
  };

  it("is refused by every route behind authenticateClient", async () => {
    arrange(false);
    const { res, next } = await callMiddleware();
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body.body).toMatchObject({ code: "ACCESS_REVOKED" });
  });

  it("still works while they are an Active company user", async () => {
    arrange(true);
    const { next } = await callMiddleware();
    expect(next).toHaveBeenCalled();
  });

  it("cannot mint a new token with /auth/refresh", async () => {
    arrange(false);
    const req: any = { body: { token: "t" } };
    const res = response();
    await ClientPortalAuthController.refreshClientToken(req, res);
    expect(res.statusCode).toBe(401);
    expect(tokens.generateClientToken).not.toHaveBeenCalled();
  });

  it("can refresh while Active", async () => {
    arrange(true);
    const req: any = { body: { token: "t" } };
    const res = response();
    await ClientPortalAuthController.refreshClientToken(req, res);
    expect(res.body?.body?.token ?? res.body?.data?.token).toBe("new.jwt");
  });
});
